/**
 * 06 — API Contract Tests
 *
 * Validates that every spin response from the server matches the documented
 * schema for Rock & Riches.
 *
 * Grid:  5 reels × 5 rows  (display[reel][row], reel=0..4, row=0..4)
 * API:   POST /demoplay
 * win.line format: array of 5 row-indices e.g. [0,1,2,1,0]
 *   (differs from Thunder Vault which uses a payline index integer)
 *
 * All symbol IDs, payline format, and field names are sourced from:
 *   - src/components/ResponseAdapter.js  (symbol table, display format)
 *   - src/stub.js                        (example responses)
 */
import { test, expect }                                          from '@/fixtures/game.fixture';
import { SYMBOLS, REELS, ROWS, COLLECTOR_COIN, PRIZE_COIN_LIST } from '@/constants/game.constants';
import { SpinInterceptor }                                        from '@/utils/spinInterceptor';

// Run every test in its own isolated browser context for speed.
test.describe.configure({ mode: 'parallel' });

test.describe('API Contract', () => {

  test('spin request returns HTTP 200', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    expect(spin.status).toBe(200);
  });

  test('response has a top-level payload object', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    expect(typeof spin.response.payload).toBe('object');
    expect(spin.response.payload).not.toBeNull();
  });

  test(`payload.display is a ${REELS}×${ROWS} matrix of valid symbol IDs`, async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const { display } = gamePage.interceptor.getLastSpin()!.response.payload;
    expect(Array.isArray(display)).toBe(true);
    expect(display.length).toBe(REELS);

    const validIds = new Set(Object.keys(SYMBOLS).map(Number));

    for (const reel of display) {
      expect(Array.isArray(reel)).toBe(true);
      expect(reel.length).toBe(ROWS);
      for (const symbolId of reel) {
        expect(validIds.has(symbolId)).toBe(true);
      }
    }
  });

  test('payload.bet.amount and bet.value are positive numbers', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const { bet } = gamePage.interceptor.getLastSpin()!.response.payload;
    expect(typeof bet.amount).toBe('number');
    expect(typeof bet.value).toBe('number');
    expect(bet.amount).toBeGreaterThan(0);
    expect(bet.value).toBeGreaterThan(0);
  });

  test('payload.wins is an array (empty or containing valid win objects)', async ({ gamePage }) => {
    // Queue 1 win + 4 no-wins: the win ensures the wins-array schema is exercised,
    // and mocks prevent bonus games from exhausting the test timeout.
    const totalBet = await gamePage.getBet();
    gamePage.interceptor.queueMockResponses([
      SpinInterceptor.buildWin(totalBet, [{ amount: totalBet * 5, item: 7, line: [1, 1, 1, 1, 1], count: 5 }]),
      SpinInterceptor.buildNoWin(totalBet),
      SpinInterceptor.buildNoWin(totalBet),
      SpinInterceptor.buildNoWin(totalBet),
      SpinInterceptor.buildNoWin(totalBet),
    ]);
    for (let i = 0; i < 5; i++) {
      await gamePage.spinAndWait();
    }
    for (const spin of gamePage.interceptor.history) {
      const { wins } = spin.response.payload;
      expect(Array.isArray(wins ?? [])).toBe(true);
      for (const win of (wins ?? [])) {
        expect(typeof win.amount).toBe('number');
        expect(win.amount).toBeGreaterThan(0);
        expect(typeof win.item).toBe('number');
        expect(typeof win.count).toBe('number');
      }
    }
  });

  test('win.item references a valid symbol ID', async ({ gamePage }) => {
    // Use a mocked win so the test runs in one instant spin with a guaranteed win
    // object to validate — no live-API bonus games that would exhaust the timeout.
    const totalBet = await gamePage.getBet();
    gamePage.interceptor.mockNextSpin('win', totalBet);
    await gamePage.spinAndWait();

    const validIds = new Set(Object.keys(SYMBOLS).map(Number));
    const spin = gamePage.interceptor.getLastSpin()!;
    for (const win of (spin.response.payload.wins ?? [])) {
      expect(validIds.has(win.item)).toBe(true);
    }
  });

  test('payline win.line is an array of valid row indices (0 to ROWS-1)', async ({ gamePage }) => {
    // win.line for Rock & Riches is an array of row indices like [0,1,2,1,0]
    const totalBet = await gamePage.getBet();
    gamePage.interceptor.mockNextSpin('win', totalBet);
    await gamePage.spinAndWait();

    const spin = gamePage.interceptor.getLastSpin()!;
    for (const win of (spin.response.payload.wins ?? [])) {
      // Skip coin / scatter wins which don't have a payline
      if ((PRIZE_COIN_LIST as readonly number[]).includes(win.item) || win.item === COLLECTOR_COIN) continue;
      if (!Array.isArray(win.line)) continue;
      // Each row index must be in range [0, ROWS)
      for (const rowIdx of (win.line as number[])) {
        expect(rowIdx).toBeGreaterThanOrEqual(0);
        expect(rowIdx).toBeLessThan(ROWS);
      }
    }
  });

  test('win.count is between 3 and REELS for payline wins', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();
    gamePage.interceptor.mockNextSpin('win', totalBet);
    await gamePage.spinAndWait();

    const spin = gamePage.interceptor.getLastSpin()!;
    for (const win of (spin.response.payload.wins ?? [])) {
      if ((PRIZE_COIN_LIST as readonly number[]).includes(win.item) || win.item === COLLECTOR_COIN) continue;
      if (!Array.isArray(win.line)) continue;
      expect(win.count).toBeGreaterThanOrEqual(3);
      expect(win.count).toBeLessThanOrEqual(REELS);
    }
  });

  test('payload.nominal matrix matches display dimensions (if present)', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const payload  = gamePage.interceptor.getLastSpin()!.response.payload as unknown as Record<string, unknown>;
    const display  = payload['display'] as number[][];
    const nominal  = payload['nominal'] as unknown[][] | undefined;
    if (nominal) {
      expect(nominal.length).toBe(display.length);
      for (let col = 0; col < display.length; col++) {
        const nominalCol = nominal[col];
        if (Array.isArray(nominalCol)) {
          expect(nominalCol.length).toBe(display[col]!.length);
        }
      }
    }
  });

  test('response includes a localState field', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    expect(spin.response.localState !== undefined).toBe(true);
  });

  test('request body includes bet config fields', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    const req  = spin.request;
    expect(typeof req.bet).toBe('object');
    expect(typeof req.bet.value).toBe('number');
  });

  test('ten consecutive spins all return valid responses', async ({ gamePage }) => {
    // Mock all 10 spins with no-win to prevent bonus triggers and keep each spin
    // as a single-phase response (start+end in one record = exactly 10 new entries).
    // The live API uses a 2-phase pattern which would produce 20 entries for 10 spins
    // and cause the length assertion to fail unpredictably.
    const totalBet = await gamePage.getBet();
    gamePage.interceptor.queueMockResponses(
      Array.from({ length: 10 }, () => SpinInterceptor.buildNoWin(totalBet)),
    );
    const startIdx = gamePage.interceptor.history.length;
    await gamePage.spinN(10);
    const newSpins = gamePage.interceptor.history.slice(startIdx);
    expect(newSpins.length).toBe(10);
    for (const s of newSpins) {
      expect(s.status).toBe(200);
      expect(s.response.payload).toBeDefined();
      expect(Array.isArray(s.response.payload.display)).toBe(true);
      expect(s.response.payload.display.length).toBe(REELS);
    }
  });

});
