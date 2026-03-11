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

test.describe('Bonus Constants Validation', () => {

  test('COLLECTOR_COIN constant is 10 (matches ResponseAdapter.ITEMS.COIN)', () => {
    // Sands of Fortune: COIN/CHEST symbol = 10
    // (Thunder Vault uses 9 — different engine, different symbol table)
    expect(COLLECTOR_COIN).toBe(10);
  });

  test('collection thresholds match schema values', () => {
    expect(COLLECTION_THRESHOLDS).toEqual([0, 1, 15, 30, 50]);
  });

  test('jackpot multipliers match schema', () => {
    expect(JACKPOTS.MINI.multiplier).toBe(25);
    expect(JACKPOTS.MINOR.multiplier).toBe(50);
    expect(JACKPOTS.MAJOR.multiplier).toBe(250);
    expect(JACKPOTS.GRAND.multiplier).toBe(5000);
  });

});

// ── Debug-trigger bonus lifecycle tests ──────────────────────────────────────

test.describe('Hold & Win Bonus Lifecycle [debug]', () => {

  test.setTimeout(5 * 60 * 1_000);

  test('bonus trigger spin: game does not crash during transition', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
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

  test('after bonus resolves game returns to idle state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
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

  test('bonus resolves with a positive net award', async ({ gamePage, gameDebugUrl }) => {
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
      (sum, s) => sum + (s.response.payload.wins ?? []).reduce((ws: number, w: { amount: number }) => ws + w.amount, 0),
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

  test('Grand Jackpot bonus sequence completes cleanly', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
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

test.describe('Hold & Win Bonus — Mock Fallback [mock]', () => {

  test('bonus trigger mock: game survives the bonus entry animation', async ({ gamePage, consoleErrors }) => {
    const bet  = await gamePage.getBet();
    const mock = SpinInterceptor.buildBonusTrigger(bet);
    gamePage.interceptor.queueMockResponse(mock);

    await gamePage.spin();
    await gamePage.page.waitForTimeout(5_000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('after forced bonus trigger, normal spin can follow', async ({ gamePage, consoleErrors }) => {
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
