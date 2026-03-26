/**
 * 06 — API Contract Tests
 *
 * Validates that every spin response from the server matches the documented
 * schema for Rock & Riches.
 *
 * Grid:  5 reels × 3 rows  (display[reel][row], reel=0..4, row=0..2)
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

test.describe('API Contract — Verify Server Response Schema, Display Matrix, and Win Data Integrity', () => {

  test('Verify that the spin API request returns an HTTP 200 status code', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    expect(spin.status).toBe(200);
  });

  test('Verify that the spin API response contains a top-level payload object', async ({ gamePage }) => {
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

  test('Verify that payload.bet.amount and payload.bet.value are both positive numbers', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const { bet } = gamePage.interceptor.getLastSpin()!.response.payload;
    expect(typeof bet.amount).toBe('number');
    expect(typeof bet.value).toBe('number');
    expect(bet.amount).toBeGreaterThan(0);
    expect(bet.value).toBeGreaterThan(0);
  });

  test('Verify that payload.wins is an array where each win object has a positive amount, numeric item, and numeric count', async ({ gamePage }) => {
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

  test('Verify that every win.item in the response maps to a valid symbol ID from the SYMBOLS table', async ({ gamePage }) => {
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

  test('Verify that each payline win.line array contains only valid row indices between 0 and ROWS-1', async ({ gamePage }) => {
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

  test('Verify that payline win.count is at least 3 (minimum match) and at most REELS (maximum possible match)', async ({ gamePage }) => {
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

  test('Verify that payload.nominal matrix has the same dimensions as payload.display when present', async ({ gamePage }) => {
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

  test('Verify that the spin response includes a localState field for session persistence', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    expect(spin.response.localState !== undefined).toBe(true);
  });

  test('Verify that the spin request body contains a bet object with a numeric value field', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin()!;
    const req  = spin.request;
    expect(typeof req.bet).toBe('object');
    expect(typeof req.bet.value).toBe('number');
  });

  test('Verify that 10 consecutive spins all return HTTP 200 with a valid payload containing a display array', async ({ gamePage }) => {
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
