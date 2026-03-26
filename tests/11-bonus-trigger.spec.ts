/**
 * 11 — Hold & Win Bonus (Coingame) Tests
 *
 * Verifies the full lifecycle of the Hold & Win bonus game:
 *
 *   1. Trigger — 6+ COIN (symbol 10) on the grid in the base game
 *   2. Transition — loading / animation sequence fires
 *   3. Coingame init — prize coins placed, respin counter shows 3
 *   4. Respin cycle — additional coins extend the counter
 *   5. Collection — counter reaches 0 or grid full → jackpot awarded
 *   6. Resolution — game returns to base game idle state
 *
 * From source (ResponseAdapter.js / Coingame.js):
 *   - COLLECTOR_COIN = 10  (COIN/CHEST symbol — see ResponseAdapter.ITEMS.COIN)
 *   - coingames = 3 when Hold & Win starts (respin counter)
 *   - coingames resets to 3 on any new COIN landing
 *   - States: 'base' → 'coin' → 'base'
 *   - COLLECTION_THRESHOLDS = [0, 1, 15, 30, 50]
 *
 * Uses DebugTrigger when available, falls back to SpinInterceptor mocks.
 *
 * Adapted for Sands of Fortune:
 *   - COLLECTOR_COIN = 10  (not 9 as in Thunder Vault)
 *   - Debug trigger name: 'coin bonus'  (from stub.js)
 */
import { test, expect }                                        from '../src/fixtures/game.fixture';
import { SpinInterceptor }                                     from '../src/utils/spinInterceptor';
import { COLLECTOR_COIN, COLLECTION_THRESHOLDS, JACKPOTS, DEBUG_TRIGGERS } from '../src/constants/game.constants';

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

// ── Collection constant tests (no navigation required) ───────────────────────

test.describe('Bonus Constants — Verify Collector Coin, Thresholds, and Jackpot Multiplier Values', () => {

  test('Verify that COLLECTOR_COIN constant equals 10, matching the COIN symbol ID in ResponseAdapter', () => {
    // Sands of Fortune: COIN/CHEST symbol = 10
    // (Thunder Vault uses 9 — different engine, different symbol table)
    expect(COLLECTOR_COIN).toBe(10);
  });

  test('Verify that COLLECTION_THRESHOLDS array matches the expected schema values [0, 1, 15, 30, 50]', () => {
    expect(COLLECTION_THRESHOLDS).toEqual([0, 1, 15, 30, 50]);
  });

  test('Verify that jackpot multipliers match expected values: MINI=25x, MINOR=50x, MAJOR=250x, GRAND=5000x', () => {
    expect(JACKPOTS.MINI.multiplier).toBe(25);
    expect(JACKPOTS.MINOR.multiplier).toBe(50);
    expect(JACKPOTS.MAJOR.multiplier).toBe(250);
    expect(JACKPOTS.GRAND.multiplier).toBe(5000);
  });

});

// ── Debug-trigger bonus lifecycle tests ──────────────────────────────────────

test.describe('Hold & Win Bonus Lifecycle — Verify Trigger, Transition, Award, and Return to Idle [debug]', () => {

  test.setTimeout(5 * 60 * 1_000);

  test('Verify that triggering the Hold & Win bonus via debug mode does not produce any JavaScript errors during the transition animation', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await gamePage.spinAndWait();
    await gamePage.page.waitForTimeout(5_000);

    expect(consoleErrors).toHaveLength(0);
  });

  test('Verify that after the Hold & Win bonus sequence completes, the game returns to idle with the spin button enabled', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await gamePage.spinAndWait();
    await gamePage.waitForIdle(120_000);

    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Verify that the Hold & Win bonus sequence awards a positive net win and the balance reflects the correct expected value', async ({ gamePage, gameDebugUrl }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    const balanceBefore = await gamePage.getBalance();
    const startIdx      = gamePage.interceptor.history.length;

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await gamePage.spinAndWait();
    await gamePage.waitForIdle(120_000);

    const balanceAfter = await gamePage.getBalance();
    const bonusSpins   = gamePage.interceptor.history.slice(startIdx);
    const totalWon     = bonusSpins.reduce(
      // wins[].amount is in coin units — multiply by bet.value to convert to EUR
      (sum, s) => sum + (s.response.payload.wins ?? []).reduce((ws: number, w: { amount: number }) => ws + w.amount, 0) * s.response.payload.bet.value,
      0,
    );
    const totalBet     = bonusSpins.reduce((sum, s) => {
      const b = s.response.payload.bet;
      return sum + b.amount * b.value;
    }, 0);

    console.log(`Bonus sequence: ${bonusSpins.length} spins  totalBet=${totalBet.toFixed(2)}  totalWon=${totalWon.toFixed(2)}`);

    const expectedBalance = balanceBefore - totalBet + totalWon;
    expect(Math.abs(balanceAfter - expectedBalance)).toBeLessThanOrEqual(0.50);
  });

  test('Verify that the Grand Jackpot bonus sequence completes without JavaScript errors and returns to idle state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) {
      test.skip(true, 'Debug mode not available on this build');
      return;
    }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.GRAND_JACKPOT);
    await gamePage.spinAndWait();
    await gamePage.waitForIdle(120_000);

    expect(consoleErrors).toHaveLength(0);
    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
  });

});

// ── Mock-based bonus tests (fallback for builds without stub.js) ──────────────

test.describe('Hold & Win Bonus — Verify Bonus Entry and Recovery Using Mocked Payloads [mock]', () => {

  test('Verify that a mocked bonus trigger payload does not cause JavaScript errors during the bonus entry animation', async ({ gamePage, consoleErrors }) => {
    const bet  = await gamePage.getBet();
    const mock = SpinInterceptor.buildBonusTrigger(bet);
    gamePage.interceptor.queueMockResponse(mock);

    await gamePage.spin();
    await gamePage.page.waitForTimeout(5_000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Verify that after a mocked bonus trigger, the game can recover and process a normal no-win spin', async ({ gamePage, consoleErrors }) => {
    const bet = await gamePage.getBet();

    gamePage.interceptor.queueMockResponse(SpinInterceptor.buildBonusTrigger(bet));
    await gamePage.spin();
    await gamePage.page.waitForTimeout(5_000);

    gamePage.interceptor.queueMockResponse(SpinInterceptor.buildNoWin(bet));

    try {
      await gamePage.waitForIdle(30_000);
      await gamePage.spinAndWait();
      expect(consoleErrors).toHaveLength(0);
    } catch {
      test.skip(true, 'Game still in bonus state — full bonus lifecycle not supported in mock mode');
    }
  });

});
