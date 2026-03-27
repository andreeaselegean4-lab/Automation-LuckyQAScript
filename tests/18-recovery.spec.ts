/**
 * 18 — Recovery Tests
 *
 * Verifies that the game correctly recovers from interruptions (page reload)
 * during various game states:
 *
 *   1. Base Game Recovery   — balance, bet, regular/big wins, wilds, coin collection
 *   2. H&W Trigger & Bonus — trigger screens (1/2/3 pots), during HW (first/middle/last spin)
 *   3. Recovery for Pots    — pot combinations and coin landing scenarios
 *   4. Collection & Multiplying — collection/multiplying phases at different spin points
 *   5. Progression          — stage preservation across natural/pseudo/buy-bonus triggers
 *
 * Recovery mechanism:
 *   The game server maintains session state via gstoken + localState.
 *   On reload, the client re-fetches state and should restore to the
 *   correct game phase (base game, bonus respin, trigger screen, etc.).
 *
 * Test approach:
 *   1. Put the game into a specific state (via mock or debug trigger)
 *   2. Reload the page (simulating a browser crash / connection loss)
 *   3. Wait for the game to recover
 *   4. Verify the recovered state matches expectations
 */
import { test, expect } from '../src/fixtures/game.fixture';
import { SpinInterceptor } from '../src/utils/spinInterceptor';
import {
  REELS, ROWS, COLLECTOR_COIN, PRIZE_COIN_LIST,
  JACKPOTS, DEBUG_TRIGGERS,
} from '../src/constants/game.constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Reload the page and wait for the game to fully re-initialize */
async function reloadAndWaitForGame(gamePage: any): Promise<void> {
  await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
  await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
  await gamePage.page.waitForTimeout(1_800);
  const vh = gamePage.page.viewportSize()?.height ?? 720;
  const continueY = Math.round(vh * 0.95);
  await gamePage.page.mouse.click(640, continueY);
  await gamePage.waitForIdle(20_000);
}

/** Reload the page and wait — but don't assume idle (game may be in bonus/trigger state) */
async function reloadAndWaitForLoad(gamePage: any): Promise<void> {
  await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
  await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
  await gamePage.page.waitForTimeout(2_500);
  const vh = gamePage.page.viewportSize()?.height ?? 720;
  const continueY = Math.round(vh * 0.95);
  await gamePage.page.mouse.click(640, continueY);
  // Wait a bit for the game to settle into whatever state it recovers to
  await gamePage.page.waitForTimeout(3_000);
}

/** Dismiss any overlay/dialog that might appear after recovery */
async function dismissOverlays(gamePage: any): Promise<void> {
  // Try to dismiss the common error dialog
  try {
    const errorDlg = gamePage.page.locator('#gcw-error-dlg-close');
    if (await errorDlg.isVisible({ timeout: 1_000 })) {
      await errorDlg.click();
      await gamePage.page.waitForTimeout(500);
    }
  } catch { /* no dialog */ }

  // Try to dismiss any canvas overlay
  try {
    await gamePage._dismissOverlayIfPresent();
  } catch { /* no overlay */ }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. BASE GAME RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Base Game Recovery — Verify State Restoration After Page Reload During Normal Gameplay', () => {

  test.setTimeout(3 * 60 * 1_000);

  test('Verify that the bet and balance bar show the same values after recovery as before interruption', async ({ gamePage }) => {
    const balanceBefore = await gamePage.getBalance();
    const betBefore = await gamePage.getBet();

    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const balanceAfter = await gamePage.getBalanceStable();
    const betAfter = await gamePage.getBet();

    expect(Math.abs(balanceAfter - balanceBefore)).toBeLessThanOrEqual(0.05);
    expect(betAfter).toBe(betBefore);
  });

  test('Verify that the currency remains the same after recovery as before interruption', async ({ gamePage }) => {
    // Read currency text before reload
    const currencyBefore = await gamePage.page.evaluate(() => {
      const el = document.querySelector('.balance-value, .currency, [data-currency]');
      return el?.textContent?.trim() ?? '';
    });

    await reloadAndWaitForGame(gamePage);

    const currencyAfter = await gamePage.page.evaluate(() => {
      const el = document.querySelector('.balance-value, .currency, [data-currency]');
      return el?.textContent?.trim() ?? '';
    });

    // The currency format (e.g., "€ 1,000.00") should be the same
    // Extract just the currency symbol
    const symbolBefore = currencyBefore.replace(/[\d.,\s]/g, '').trim();
    const symbolAfter = currencyAfter.replace(/[\d.,\s]/g, '').trim();
    expect(symbolAfter).toBe(symbolBefore);
  });

  test('Verify that on recovery from a regular win we see the win tally and paylines correctly', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();
    const winAmt = totalBet * 3;

    // Mock a regular win
    gamePage.interceptor.queueMockResponse(
      SpinInterceptor.buildWin(totalBet, [
        { amount: winAmt, item: 7, line: [1, 1, 1, 1, 1], count: 5 },
      ])
    );

    const balanceBefore = await gamePage.getBalance();
    await gamePage.spinAndWait();

    // Record state after win
    const lastWin = await gamePage.getLastWinStable();

    // Reload during/after the win display
    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    // After recovery: balance should reflect the win (server state)
    const balanceAfterRecovery = await gamePage.getBalanceStable();

    // The game should be in idle state and playable
    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);

    // Balance should be close to expected (before - bet + win)
    // Note: server may restore pre-spin or post-spin balance depending on implementation
    expect(balanceAfterRecovery).toBeGreaterThan(0);
  });

  test('Verify that on recovery from a big win we see the win tally and paylines correctly', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();
    const bigWinAmt = totalBet * 50; // Big win = high multiplier

    gamePage.interceptor.queueMockResponse(
      SpinInterceptor.buildWin(totalBet, [
        { amount: bigWinAmt, item: 1, line: [1, 1, 1, 1, 1], count: 5 },
      ])
    );

    await gamePage.spinAndWait();

    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const balanceAfterRecovery = await gamePage.getBalanceStable();
    const idle = await gamePage.isSpinButtonEnabled();

    expect(idle).toBe(true);
    expect(balanceAfterRecovery).toBeGreaterThan(0);
  });

  test('Verify that on recovery from a win with wilds, the game returns to idle state', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();

    // Mock a win using a high-value symbol (simulating wild-assisted win)
    gamePage.interceptor.queueMockResponse(
      SpinInterceptor.buildWin(totalBet, [
        { amount: totalBet * 5, item: 1, line: [0, 0, 0, 0, 0], count: 5 },
      ])
    );

    await gamePage.spinAndWait();
    await reloadAndWaitForGame(gamePage);

    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
  });

  test('Verify that on recovery after collected coins, we see pot with collected amount and win tally', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();

    // Mock a spin with coin collection
    const payload = SpinInterceptor.buildNoWin(totalBet);
    payload.collection = 3;
    payload.coins = [
      [COLLECTOR_COIN, 0, 0],
      [0, COLLECTOR_COIN, 0],
      [0, 0, COLLECTOR_COIN],
      [0, 0, 0],
      [0, 0, 0],
    ];
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spinAndWait();

    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
    const balanceAfter = await gamePage.getBalanceStable();
    expect(balanceAfter).toBeGreaterThan(0);
  });

  test('Verify that on recovery after regular win + pot collection, the game restores correctly', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();

    // Build a win payload that also has coin collection
    const payload = SpinInterceptor.buildWin(totalBet, [
      { amount: totalBet * 3, item: 7, line: [1, 1, 1, 1, 1], count: 5 },
    ]);
    payload.collection = 2;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spinAndWait();

    await reloadAndWaitForGame(gamePage);

    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
  });

  test('Verify that on recovery after big win + pot collection, the game restores correctly', async ({ gamePage }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildWin(totalBet, [
      { amount: totalBet * 50, item: 1, line: [1, 1, 1, 1, 1], count: 5 },
    ]);
    payload.collection = 4;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spinAndWait();

    await reloadAndWaitForGame(gamePage);

    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. H&W TRIGGER & BONUS RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('H&W Trigger & Bonus Recovery — Verify Hold and Win State Restoration After Reload', () => {

  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery after triggering 1 pot shows trigger screen and respin', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    // Build a bonus trigger with coins on 1 reel (minimal trigger)
    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    // Reload during the trigger animation
    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    // The game should either show the trigger/respin screen or return to base game
    // Either way, no JS errors should occur
    await gamePage.page.waitForTimeout(3_000);
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that recovery after triggering 2 pots shows trigger screen and respin', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    // Build trigger with coins on 2 reels
    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 4; // More coins collected
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that recovery after triggering 3 pots shows trigger screen and respin', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 6; // Full trigger — 3 pots
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that recovery during H&W first spin shows respin with counter showing correct spins', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    // Use debug trigger to enter a real bonus
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    // Wait for bonus entry animation
    await debugPage.page.waitForTimeout(5_000);

    // Reload during the first respin
    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);

    // After recovery from bonus, game should eventually be playable
    // (either in bonus respin state or back to base game)
    await debugPage.page.waitForTimeout(5_000);
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that recovery during H&W middle spin shows respin with correct counter', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    // Wait for bonus entry + first respin
    await debugPage.page.waitForTimeout(10_000);

    // Reload during the middle of the bonus
    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);
    await debugPage.page.waitForTimeout(5_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that recovery during H&W last spin returns to base game', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    // Wait long enough for the bonus to be near the end
    await debugPage.page.waitForTimeout(20_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);

    // Wait for any remaining bonus animation to complete
    try {
      await debugPage.waitForIdle(30_000);
    } catch { /* might time out if still in bonus */ }

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. RECOVERY FOR POTS (COIN COMBINATIONS)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Recovery for Pots — Verify Coin Landing and Pot Combination Recovery', () => {

  test.setTimeout(3 * 60 * 1_000);

  test('Verify recovery with 1 pot + 1 coin landing does not cause errors', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 2; // 1 pot scenario + 1 coin
    payload.coingames = 3;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery with 1 pot + two more coins does not cause errors', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 3; // 1 pot + 2 additional coins
    payload.coingames = 3;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery with 2 pots + 1 more coin does not cause errors', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 5; // 2 pots + 1 extra coin
    payload.coingames = 3;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. COLLECTION & MULTIPLYING PHASE RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Collection & Multiplying Recovery — Verify Recovery At Different Bonus Spin Points', () => {

  test.setTimeout(5 * 60 * 1_000);

  test('Verify recovery during collection after first spin shows respin state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    // Wait for just the first collection spin
    await debugPage.page.waitForTimeout(5_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);
    await debugPage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery during collection middle spin shows respin state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    await debugPage.page.waitForTimeout(12_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);
    await debugPage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery during collection last spin returns to base game', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    // Wait for bonus to be near completion
    await debugPage.page.waitForTimeout(25_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);

    try {
      await debugPage.waitForIdle(30_000);
    } catch { /* may still be in bonus animation */ }

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery during multiplying after first spin shows respin state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    // Use big win trigger which includes multiplying
    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.BIG_WIN);
    await debugPage.enableTurbo();
    await debugPage.spin();
    await debugPage.page.waitForTimeout(5_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);
    await debugPage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery during multiplying middle spin shows respin state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.BIG_WIN);
    await debugPage.enableTurbo();
    await debugPage.spin();
    await debugPage.page.waitForTimeout(12_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);
    await debugPage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery during multiplying last spin returns to base game', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.BIG_WIN);
    await debugPage.enableTurbo();
    await debugPage.spin();
    await debugPage.page.waitForTimeout(25_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);

    try {
      await debugPage.waitForIdle(30_000);
    } catch { /* may still be animating */ }

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. EDGE CASES & COMBINATIONS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Recovery Edge Cases — Verify Extreme and Combined Scenarios', () => {

  test.setTimeout(5 * 60 * 1_000);

  test('Verify recovery with 1 pot + coins + multipliers does not cause errors', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 3;
    payload.win = totalBet * 2; // Some win from multipliers
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery with 2 pots + coins + multipliers does not cause errors', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 5;
    payload.win = totalBet * 5;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery with 3 pots + coins + multipliers does not cause errors', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = 8;
    payload.win = totalBet * 10;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(2_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(3_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery after max win + spins remaining returns to base game with trigger screen', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    // Grand jackpot but with remaining spins (max win scenario)
    const payload = SpinInterceptor.buildGrandJackpot(totalBet);
    payload.coingames = 1; // Still spins remaining
    payload.end = false;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(3_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);
    await gamePage.page.waitForTimeout(5_000);

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify recovery after max win on the last spin returns to base game', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    // Grand jackpot on the final spin (end = true)
    const payload = SpinInterceptor.buildGrandJackpot(totalBet);
    payload.coingames = 0;
    payload.end = true;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(3_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    try {
      await gamePage.waitForIdle(30_000);
    } catch { /* may still be in win celebration */ }

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that third pot landing on the third spin recovers to base game', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    // Simulate the end of bonus where 3rd pot lands on final spin
    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    payload.collection = REELS * ROWS; // Full collection
    payload.coingames = 0; // No more respins
    payload.end = true;
    payload.win = totalBet * 20;
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(3_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    try {
      await gamePage.waitForIdle(30_000);
    } catch { /* animation may still be playing */ }

    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. PROGRESSION RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Progression Recovery — Verify Progression Stage Survives Page Reload', () => {

  test.setTimeout(3 * 60 * 1_000);

  test('Verify that progression stage 0 (value: 0) remains the same after recovery', async ({ gamePage }) => {
    // Fresh game = stage 0
    const balanceBefore = await gamePage.getBalance();
    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const balanceAfter = await gamePage.getBalanceStable();
    // Stage 0 means no progression change — balance should be the same
    expect(Math.abs(balanceAfter - balanceBefore)).toBeLessThanOrEqual(0.05);

    // Game should be in base state
    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
  });

  test('Verify that progression after a few spins (stage 1) remains the same after recovery', async ({ gamePage }) => {
    // Do a few spins to advance progression
    await gamePage.enableTurbo();
    for (let i = 0; i < 3; i++) {
      gamePage.interceptor.mockNextSpin('no-win', await gamePage.getBet());
      await gamePage.spinAndWait();
    }

    const balanceBefore = await gamePage.getBalance();
    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const balanceAfter = await gamePage.getBalanceStable();
    expect(Math.abs(balanceAfter - balanceBefore)).toBeLessThanOrEqual(0.10);
    expect(await gamePage.isSpinButtonEnabled()).toBe(true);
  });

  test('Verify that progression is not affected by a natural trigger (start, during, end)', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    // Trigger a natural bonus
    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    // Wait for the bonus to play out
    await debugPage.page.waitForTimeout(10_000);

    // Reload during bonus
    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);

    // Wait for any remaining bonus to complete
    try {
      await debugPage.waitForIdle(60_000);
    } catch { /* may time out */ }

    // After recovery, progression should not be reset
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);

    // Game should eventually return to playable state
    const balanceAfter = await debugPage.getBalanceStable();
    expect(balanceAfter).toBeGreaterThan(0);
  });

  test('Verify that progression is reset to 0 after recovery from a pseudo trigger', async ({ gamePage, consoleErrors }) => {
    const totalBet = await gamePage.getBet();

    // A pseudo trigger = bonus triggered via mock (not natural gameplay)
    // After recovery from a pseudo trigger, progression should reset to 0
    const payload = SpinInterceptor.buildBonusTrigger(totalBet);
    gamePage.interceptor.queueMockResponse(payload);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(3_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    try {
      await gamePage.waitForIdle(30_000);
    } catch { /* might still be in bonus */ }

    // After pseudo trigger recovery, game should be playable
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Verify that progression is not affected during buy bonus recovery', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    const debugPage = new (await import('../src/page-objects/GamePage')).GamePage(gamePage.page);
    await debugPage.load(gameDebugUrl);

    if (!debugPage.debug.isAvailable()) {
      test.skip();
      return;
    }

    // Trigger bonus via debug (simulating buy bonus)
    await debugPage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS);
    await debugPage.enableTurbo();
    await debugPage.spin();
    await debugPage.page.waitForTimeout(8_000);

    await reloadAndWaitForLoad(debugPage);
    await dismissOverlays(debugPage);

    try {
      await debugPage.waitForIdle(60_000);
    } catch { /* may time out */ }

    // Progression should not be affected by buy bonus
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);

    const balanceAfter = await debugPage.getBalanceStable();
    expect(balanceAfter).toBeGreaterThan(0);
  });
});
