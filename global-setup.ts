/**
 * global-setup.ts — Playwright global setup hook.
 *
 * Fetches a fresh gstoken from the mock-operator API before every test run.
 * Requires USERNAME and PASSWORD in .env (launcher credentials).
 *
 * Flow:
 *   1. POST /api/auth/token  → launcher JWT
 *   2. GET  /conf/config.json → apiUrl
 *   3. POST {apiUrl}/game/url → game URL with fresh gstoken for sands-of-fortune
 *   4. Overwrite process.env.GAME_URL and GAME_URL_DEBUG for this run
 */

import * as dotenv from 'dotenv';

const envFile = process.env['ENV'] ? `.env.${process.env['ENV']}` : '.env';
dotenv.config({ path: envFile });

const LAUNCHER_BASE = 'https://launcher.avocadospins.com';
const GAME_BRAND_ID = process.env['GAME_BRAND_ID'] ?? 'tr';
const GAME_PARAMS   = `&mode=demo&locale=en&et=${GAME_BRAND_ID}`;

async function fetchJson<T>(url: string, opts: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export default async function globalSetup(): Promise<void> {
  const username = process.env['LAUNCHER_USERNAME'];
  const password = process.env['LAUNCHER_PASSWORD'];

  if (!username || !password) {
    console.log('[global-setup] No LAUNCHER_USERNAME/LAUNCHER_PASSWORD in .env — using existing GAME_URL as-is.');
    return;
  }

  try {
    // 1. Get launcher auth JWT
    const { token } = await fetchJson<{ token: string }>(
      `${LAUNCHER_BASE}/api/auth/token`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      },
    );

    // 2. Resolve the operator API base URL
    const { apiUrl } = await fetchJson<{ apiUrl: string }>(
      `${LAUNCHER_BASE}/conf/config.json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // 3. Request a fresh game URL for Sands of Fortune
    const { url: gameUrl } = await fetchJson<{ url: string }>(
      `${apiUrl}/game/url`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
          Accept:         'application/json, *.*',
        },
        body: JSON.stringify({
          gameId:     process.env['GAME_ID'] ?? 'sands-of-fortune',
          mode:       'demo',
          currency:   'EUR',
          locale:     'en',
          brandId:    GAME_BRAND_ID,
          playerId:   'player1',
          platform:   'web',
          lobbyUrl:   `${LAUNCHER_BASE}/`,
          minBet:     null,
          maxBet:     10_000,
          defaultBet: 1.0,
        }),
      },
    );

    process.env['GAME_URL']       = gameUrl;
    process.env['GAME_URL_DEBUG'] = `${gameUrl}&debug=true`;

    // Log iat for diagnostics
    try {
      const tokenPart = gameUrl.split('gstoken=')[1]?.split('&')[0] ?? '';
      const payload   = JSON.parse(
        Buffer.from(tokenPart.split('.')[1] ?? '', 'base64').toString(),
      ) as Record<string, number>;
      console.log(`[global-setup] Fresh gstoken obtained (iat: ${payload['iat']})`);
    } catch {
      console.log('[global-setup] Fresh gstoken obtained.');
    }

  } catch (err) {
    console.error('[global-setup] Token refresh failed — tests will use existing GAME_URL:', (err as Error).message);
  }
}
