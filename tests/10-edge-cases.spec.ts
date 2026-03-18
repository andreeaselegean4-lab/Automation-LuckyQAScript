/**
 * 10 — Edge Case / Forced Outcome Tests
 *
 * Uses two mechanisms to force deterministic outcomes:
 *
 *   A) SpinInterceptor.queueMockResponse() — intercepts the network response
 *      at the Playwright route level and substitutes a crafted payload.
 *      Works on any build (no stub.js required).
 *
 *   B) DebugTrigger.triggerScenario() — calls into the game's built-in
 *      stub.js debug system (?debug=true URL param).
 *      Only works when the build includes stub.js.
 *
 * Tests tagged [mock] use mechanism A; tests tagged [debug] use mechanism B.
 * The debug tests are skipped automatically when stub.js is unavailable.
 *
 * Adapted for Sands of Fortune: Hold & Win
 *   Debug trigger names match stub.js: 'grand-jackpot', 'coin bonus',
 *   'free games', 'anticipation' (near-miss), 'regular win + coin bonus'
 */
import { test, expect }                                        from '../src/fixtures/game.fixture';
import { SpinInterceptor }                                     from '../src/utils/spinInterceptor';
import { SYMBOLS, PRIZE_COIN_LIST, COLLECTOR_COIN, JACKPOTS, DEBUG_TRIGGERS } from '../src/constants/game.constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Navigate to the debug URL and wait for the game to be ready. */
async function navigateDebug(gamePage: import('../src/page-objects/GamePage').GamePage, debugUrl: string) {
  await gamePage.interceptor.install();
  await gamePage.page.goto(debugUrl, { waitUntil: 'domcontentloaded' });
  await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
  await gamePage.page.waitForTimeout(1_800);
  const viewport = gamePage.page.viewportSize();
  const cx = Math.round((viewport?.width  ?? 1280) / 2);
  const cy = Math.round((viewport?.height ?? 720)  * 0.9);
  await gamePage.page.mouse.click(cx, cy);
  await gamePage.waitForIdle(20_000);
  await gamePage.balance.init();
}

// ── Mock-based edge cases (no debug mode required) ────────────────────────────

test.describe('Edge Cases — Mock Responses [mock]', () => {

  test('grand jackpot mock: balance increases by expected amount', async ({ gamePage }) => {
    const bet         = await gamePage.getBet();
    const mockPayload = SpinInterceptor.buildGrandJackpot(bet);
    gamePage.interceptor.queueMockResponse(mockPayload);

    const before = await gamePage.getBalance();
    await gamePage.spinAndWait();

    const spin       = gamePage.interceptor.getLastSpin()!;
    const wins       = spin.response.payload.wins ?? [];
    // wins[].amount is in coin units — multiply by bet.value to convert to EUR
    const coinValue  = spin.response.payload.bet.value;
    const totalWin   = wins.reduce((s: number, w: { amount: number }) => s + w.amount, 0) * coinValue;
    const after      = await gamePage.getBalance();

    expect(totalWin).toBeGreaterThan(0);
    expect(Math.abs((before - bet + totalWin) - after)).toBeLessThanOrEqual(0.10);
  });

  test('no-win mock: balance decreases by exactly the bet', async ({ gamePage }) => {
    const bet   = await gamePage.getBet();
    const mock  = SpinInterceptor.buildNoWin(bet);
    gamePage.interceptor.queueMockResponse(mock);

    const before = await gamePage.getBalance();
    await gamePage.spinAndWait();
    const after  = await gamePage.getBalance();

    expect(Math.abs(after - (before - bet))).toBeLessThanOrEqual(0.02);
  });

  test('winning mock: Last Win display shows correct amount', async ({ gamePage }) => {
    const bet     = await gamePage.getBet();
    const winAmt  = bet * 10;
    const mock    = SpinInterceptor.buildWin(bet, [{ amount: winAmt, item: 7, line: [1, 1, 1, 1, 1], count: 5 }]);
    gamePage.interceptor.queueMockResponse(mock);

    await gamePage.spinAndWait();
    const displayed = await gamePage.getLastWin();
    // winAmt is in coin units (passed to buildWin) — multiply by coinValue for EUR comparison
    const coinValue = mock.bet.value;
    expect(Math.abs(displayed - winAmt * coinValue)).toBeLessThanOrEqual(0.05);
  });

  test('Hold & Win bonus trigger mock: game handles bonus flag without crashing', async ({ gamePage, consoleErrors }) => {
    const bet  = await gamePage.getBet();
    const mock = SpinInterceptor.buildBonusTrigger(bet);
    gamePage.interceptor.queueMockResponse(mock);

    await gamePage.spin();
    // Give the bonus transition time to start
    await gamePage.page.waitForTimeout(5_000);

    // No JS errors regardless of whether the full bonus plays out
    expect(consoleErrors).toHaveLength(0);
  });

  test('free spins trigger mock: game handles free-spin flag without crashing', async ({ gamePage, consoleErrors }) => {
    const bet  = await gamePage.getBet();
    const mock = SpinInterceptor.buildFreeSpinsTrigger(bet);
    gamePage.interceptor.queueMockResponse(mock);

    await gamePage.spin();
    await gamePage.page.waitForTimeout(5_000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('three queued mocks fire in order', async ({ gamePage }) => {
    const bet = await gamePage.getBet();
    gamePage.interceptor.queueMockResponse(SpinInterceptor.buildNoWin(bet));
    gamePage.interceptor.queueMockResponse(SpinInterceptor.buildGrandJackpot(bet));
    gamePage.interceptor.queueMockResponse(SpinInterceptor.buildNoWin(bet));

    const startIdx = gamePage.interceptor.history.length;
    await gamePage.spinN(3);
    const [s1, s2, s3] = gamePage.interceptor.history.slice(startIdx);

    expect(s1!.response.payload.wins?.length ?? 0).toBe(0);                        // no-win
    expect((s2!.response.payload.wins?.length ?? 0)).toBeGreaterThan(0);           // grand jackpot
    expect(s3!.response.payload.wins?.length ?? 0).toBe(0);                        // no-win
  });

});

// ── Debug-trigger edge cases (requires ?debug=true build) ─────────────────────

test.describe('Edge Cases — Debug Trigger Scenarios [debug]', () => {

  test('Grand Jackpot scenario fires correctly', async ({ gamePage, gameDebugUrl }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    const bet = await gamePage.getBet();
    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.GRAND_JACKPOT);
    await gamePage.spinAndWait();

    const spin = gamePage.interceptor.getLastSpin()!;
    const wins   = spin.response.payload.wins ?? [];
    const total  = wins.reduce((s: number, w: { amount: number }) => s + w.amount, 0);
    expect(total).toBeGreaterThan(bet * JACKPOTS.MINI.multiplier);
  });

  test('Near-miss (anticipation) scenario does not award a jackpot win', async ({ gamePage, gameDebugUrl }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.NEAR_MISS);
    await gamePage.spinAndWait();

    const spin = gamePage.interceptor.getLastSpin()!;
    const wins = spin.response.payload.wins ?? [];
    const hasJackpot = wins.some((w: { item: number }) => (PRIZE_COIN_LIST as readonly number[]).includes(w.item));
    expect(hasJackpot).toBe(false);
  });

  test('Coin bonus scenario triggers without JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await gamePage.spinAndWait();
    await gamePage.page.waitForTimeout(3_000);

    expect(consoleErrors).toHaveLength(0);
  });

  test('Free Games scenario triggers without JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.FREE_GAMES);
    await gamePage.spinAndWait();
    await gamePage.page.waitForTimeout(3_000);

    expect(consoleErrors).toHaveLength(0);
    const spin = gamePage.interceptor.getLastSpin()!;
    expect(spin.response.payload.remaining ?? 0).toBeGreaterThan(0);
  });

  test('All Jackpots in Free Games produces multiple wins', async ({ gamePage, gameDebugUrl }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.ALL_JACKPOTS_IN_FREE);
    await gamePage.spinAndWait();

    const spin = gamePage.interceptor.getLastSpin()!;
    const wins = spin.response.payload.wins ?? [];
    expect(wins.length).toBeGreaterThanOrEqual(1);
  });

  test('Bonus trigger with payline win scenario', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.BONUS_WITH_PAYLINE);
    await gamePage.spinAndWait();
    await gamePage.page.waitForTimeout(3_000);

    expect(consoleErrors).toHaveLength(0);
  });

});
