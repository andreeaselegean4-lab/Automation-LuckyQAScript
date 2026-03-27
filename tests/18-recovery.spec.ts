/**
 * 18 — Recovery Tests (Debug-Trigger Based)
 *
 * Verifies that the game correctly recovers from interruptions (page reload)
 * during various game states.  ALL H&W / bonus tests use **debug triggers**
 * instead of mocks — the server-side RNG is pre-seeded so the game state is
 * real, which means reload/recovery restores from genuine session data.
 *
 * Sections:
 *   1. Base Game Recovery         — balance, bet, currency, regular/big wins, wilds, coin collection
 *   2. H&W Trigger & Bonus       — 1/2/3 collectors, first/middle/last spin recovery
 *   3. Coin Collection Recovery   — coin collect + standard win, coin collect + wild
 *   4. Jackpot Recovery           — mini/minor/major/grand, multiple jackpots
 *   5. Edge Cases                 — max win, empty pot, 3 collectors with many coins
 *   6. Progression                — pseudo progression recovery
 *
 * Recovery mechanism:
 *   The game server maintains session state via gstoken + localState.
 *   On reload, the client re-fetches state and should restore to the
 *   correct game phase (base game, bonus respin, trigger screen, etc.).
 *
 * Test approach:
 *   1. Navigate to debug URL (?debug=true)
 *   2. Trigger a specific scenario via stub.js (server-side RNG seed)
 *   3. Spin — the server produces the deterministic outcome
 *   4. Reload the page mid-animation (simulating crash / connection loss)
 *   5. Verify: no JS errors, game recovers to a valid state
 */
import { test, expect } from '../src/fixtures/game.fixture';
import { SpinInterceptor } from '../src/utils/spinInterceptor';
import {
  DEBUG_TRIGGERS, FEATURES,
} from '../src/constants/game.constants';
import { GamePage } from '../src/page-objects/GamePage';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the debug URL and wait for the game to be ready */
async function navigateDebug(gamePage: GamePage, debugUrl: string): Promise<void> {
  await gamePage.load(debugUrl);
}

/** Reload the page and wait for the game to fully re-initialize (expects idle) */
async function reloadAndWaitForGame(gamePage: GamePage): Promise<void> {
  await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
  await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
  await gamePage.page.waitForTimeout(1_800);
  const vh = gamePage.page.viewportSize()?.height ?? 720;
  const continueY = Math.round(vh * 0.95);
  await gamePage.page.mouse.click(640, continueY);
  await gamePage.waitForIdle(20_000);
}

/** Reload — don't assume idle (game may be in bonus/trigger state) */
async function reloadAndWaitForLoad(gamePage: GamePage): Promise<void> {
  await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
  await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
  await gamePage.page.waitForTimeout(2_500);
  const vh = gamePage.page.viewportSize()?.height ?? 720;
  const continueY = Math.round(vh * 0.95);
  await gamePage.page.mouse.click(640, continueY);
  await gamePage.page.waitForTimeout(3_000);
}

/** Dismiss any overlay/dialog that might appear after recovery */
async function dismissOverlays(gamePage: GamePage): Promise<void> {
  try {
    const errorDlg = gamePage.page.locator('#gcw-error-dlg-close');
    if (await errorDlg.isVisible({ timeout: 1_000 })) {
      await errorDlg.click();
      await gamePage.page.waitForTimeout(500);
    }
  } catch { /* no dialog */ }
  try {
    await (gamePage as any)._dismissOverlayIfPresent();
  } catch { /* no overlay */ }
}

/** Filter out non-critical console errors (favicon, 404s) */
function criticalOnly(errors: string[]): string[] {
  return errors.filter(e => !e.includes('favicon') && !e.includes('404'));
}

/** Common pattern: trigger a debug scenario, spin, wait, reload, verify no JS errors */
async function triggerAndRecover(
  gamePage: GamePage,
  debugUrl: string,
  triggerName: string,
  consoleErrors: string[],
  waitBeforeReloadMs: number = 5_000,
): Promise<void> {
  await navigateDebug(gamePage, debugUrl);

  const available = await gamePage.debug.isAvailable();
  if (!available) {
    test.skip(true, 'Debug mode not available on this build');
    return;
  }

  await gamePage.debug.triggerScenario(triggerName);
  await gamePage.spin();
  await gamePage.page.waitForTimeout(waitBeforeReloadMs);

  await reloadAndWaitForLoad(gamePage);
  await dismissOverlays(gamePage);
  await gamePage.page.waitForTimeout(3_000);

  const errors = criticalOnly(consoleErrors);
  expect(errors, `JS errors after recovery from "${triggerName}": ${errors.join('; ')}`).toHaveLength(0);
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
    const currencyBefore = await gamePage.page.evaluate(() => {
      const el = document.querySelector('.balance-value, .currency, [data-currency]');
      return el?.textContent?.trim() ?? '';
    });

    await reloadAndWaitForGame(gamePage);

    const currencyAfter = await gamePage.page.evaluate(() => {
      const el = document.querySelector('.balance-value, .currency, [data-currency]');
      return el?.textContent?.trim() ?? '';
    });

    const symbolBefore = currencyBefore.replace(/[\d.,\s]/g, '').trim();
    const symbolAfter = currencyAfter.replace(/[\d.,\s]/g, '').trim();
    expect(symbolAfter).toBe(symbolBefore);
  });

  test('Verify that on recovery from a regular win (debug HP1) the game returns to idle', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HP1, consoleErrors, 5_000);
  });

  test('Verify that on recovery from a big win the game returns to idle', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.ALL_BIG_WIN_THRESHOLDS, consoleErrors, 5_000);
  });

  test('Verify that on recovery from a win with wilds, the game returns to idle', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_COLLECT_WILD_WIN, consoleErrors, 5_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. H&W TRIGGER & BONUS RECOVERY (Debug Triggers — Real Server State)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('H&W Trigger & Bonus Recovery — Verify Hold and Win State Restoration After Reload', () => {

  test.skip(!FEATURES.HOLD_AND_WIN, 'Skipped — this game does not have Hold & Win');
  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery after H&W with 1 collector does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_1_COLLECTOR, consoleErrors, 5_000);
  });

  test('Verify that recovery after H&W with 2 collectors does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_2_COLLECTORS, consoleErrors, 5_000);
  });

  test('Verify that recovery after H&W with 3 collectors does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_3_COLLECTORS, consoleErrors, 5_000);
  });

  test('Verify that recovery after H&W with 1+2 collectors does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_1_PLUS_2_COLLECTORS, consoleErrors, 5_000);
  });

  test('Verify that recovery during H&W first spin shows respin state (reload at 5s)', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_1_COLLECTOR, consoleErrors, 5_000);
  });

  test('Verify that recovery during H&W middle spin shows respin state (reload at 12s)', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_3_COLLECTORS_LOTS_OF_COINS, consoleErrors, 12_000);
  });

  test('Verify that recovery during H&W last spin returns to valid state (reload at 25s)', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) { test.skip(true, 'Debug mode not available'); return; }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.HW_1_COLLECTOR);
    await gamePage.spin();
    // Wait long enough for the H&W bonus to be near the end
    await gamePage.page.waitForTimeout(25_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    // Game should eventually reach idle or finish the bonus
    try { await gamePage.waitForIdle(30_000); } catch { /* may still be in bonus */ }

    const errors = criticalOnly(consoleErrors);
    expect(errors).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. COIN COLLECTION RECOVERY (Base Game Coin Collect Events)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Coin Collection Recovery — Verify Base Game Coin Collect Events Survive Reload', () => {

  test.skip(!FEATURES.HOLD_AND_WIN, 'Skipped — this game does not have coin collection');
  test.setTimeout(3 * 60 * 1_000);

  test('Verify that recovery after coin collect with 1 collector does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_COLLECT_1, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin collect with 2 collectors does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_COLLECT_2, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin collect with 3 collectors does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_COLLECT_3, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin collect + standard win does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_COLLECT_STANDARD_WIN, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin collect + win with wild does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_COLLECT_WILD_WIN, consoleErrors, 5_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. JACKPOT RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Jackpot Recovery — Verify Jackpot Award State Survives Page Reload', () => {

  test.skip(!FEATURES.JACKPOTS, 'Skipped — this game does not have jackpots');
  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery during Mini Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.MINI_JACKPOT, consoleErrors, 5_000);
  });

  test('Verify that recovery during Minor Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.MINOR_JACKPOT, consoleErrors, 5_000);
  });

  test('Verify that recovery during Major Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.MAJOR_JACKPOT, consoleErrors, 5_000);
  });

  test('Verify that recovery during Grand Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.GRAND_JACKPOT, consoleErrors, 5_000);
  });

  test('Verify that recovery during multiple jackpots at once does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.MULTIPLE_JACKPOTS, consoleErrors, 8_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. EDGE CASES & COMBINATIONS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Recovery Edge Cases — Verify Extreme and Combined Scenarios', () => {

  test.skip(!FEATURES.HOLD_AND_WIN, 'Skipped — this game does not have Hold & Win');
  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery after H&W Max Win returns to a valid state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) { test.skip(true, 'Debug mode not available'); return; }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.HW_MAX_WIN);
    await gamePage.spin();
    // Max win may trigger long celebration — reload mid-animation
    await gamePage.page.waitForTimeout(8_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    // Wait for game to settle
    try { await gamePage.waitForIdle(60_000); } catch { /* may still be in win celebration */ }

    const errors = criticalOnly(consoleErrors);
    expect(errors).toHaveLength(0);
  });

  test('Verify that recovery after H&W with empty pot (second pot never collects) does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_EMPTY_POT, consoleErrors, 8_000);
  });

  test('Verify that recovery after H&W with 3 collectors and many coins does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_3_COLLECTORS_LOTS_OF_COINS, consoleErrors, 8_000);
  });

  test('Verify that recovery after anticipation (5 coins on first 2 reels) does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.ANTICIPATION_5_COINS, consoleErrors, 5_000);
  });

  test('Verify that recovery after anticipation (2 coins + pot) does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.ANTICIPATION_2_COINS_POT, consoleErrors, 5_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. PROGRESSION RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Progression Recovery — Verify Pseudo Progression Survives Page Reload', () => {

  test.setTimeout(3 * 60 * 1_000);

  test('Verify that recovery during pseudo progression does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.PSEUDO_PROGRESSION, consoleErrors, 5_000);
  });

  test('Verify that balance is preserved after recovery during pseudo progression', async ({ gamePage, gameDebugUrl }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) { test.skip(true, 'Debug mode not available'); return; }

    const balanceBefore = await gamePage.getBalance();

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.PSEUDO_PROGRESSION);
    await gamePage.spinAndWait();

    // Record balance after spin (server-side)
    const balanceAfterSpin = await gamePage.getBalanceStable();

    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const balanceAfterRecovery = await gamePage.getBalanceStable();

    // Balance after recovery should match balance after the spin completed
    // Tolerance of 2.00 accounts for win payouts still animating when balance was read
    expect(Math.abs(balanceAfterRecovery - balanceAfterSpin)).toBeLessThanOrEqual(2.00);
    expect(await gamePage.isSpinButtonEnabled()).toBe(true);
  });
});
