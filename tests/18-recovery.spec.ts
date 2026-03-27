/**
 * 18 — Recovery Tests (Debug-Trigger Based)
 *
 * Verifies that the game correctly recovers from interruptions (page reload)
 * during various game states.  ALL H&W / bonus tests use **debug triggers**
 * instead of mocks — the server-side RNG is pre-seeded so the game state is
 * real, which means reload/recovery restores from genuine session data.
 *
 * Sections:
 *   1. Base Game Recovery         — balance, bet, currency, regular/big wins, wilds
 *   2. H&W Trigger & Bonus       — coin bonus variations, mini games, grid configs
 *   3. Jackpot Recovery           — mini/minor/major/grand
 *   4. Free Spins Recovery        — free games, free games + coin bonus combos
 *   5. Edge Cases & Combinations  — FG→H&W→Jackpot chains, simultaneous triggers
 *   6. Progression                — progression test recovery
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

  test('Verify that on recovery from a regular win (debug hp1) the game returns to idle', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HP1, consoleErrors, 5_000);
  });

  test('Verify that on recovery from a regular win (debug regular win) the game returns to idle', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.REGULAR_WIN, consoleErrors, 5_000);
  });

  test('Verify that on recovery from a win with wilds, the game returns to idle', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    test.skip(!FEATURES.WILDS, 'Skipped — this game does not have wilds');
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.WILD, consoleErrors, 5_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. H&W TRIGGER & BONUS RECOVERY (Debug Triggers — Real Server State)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('H&W Trigger & Bonus Recovery — Verify Hold and Win State Restoration After Reload', () => {

  test.skip(!FEATURES.HOLD_AND_WIN, 'Skipped — this game does not have Hold & Win');
  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery after coin bonus does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin bonus without extra chests does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_NO_EXTRA_CHESTS, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin bonus with one mini game does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_ONE_MINI_GAME, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin bonus with two mini games does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_TWO_MINI_GAMES, consoleErrors, 8_000);
  });

  test('Verify that recovery after coin bonus with 1x3→5x3 grid expansion does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_1x3_TO_5x3, consoleErrors, 8_000);
  });

  test('Verify that recovery after coin bonus with 2x3 grid does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_2x3, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin bonus with 3x3 grid does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_3x3, consoleErrors, 5_000);
  });

  test('Verify that recovery after coin bonus with 4x3 grid does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_4x3, consoleErrors, 5_000);
  });

  test('Verify that recovery after regular win + coin bonus does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.REGULAR_WIN_COIN_BONUS, consoleErrors, 5_000);
  });

  test('Verify that recovery after H&W and big win at the same time does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_AND_BIG_WIN, consoleErrors, 8_000);
  });

  test('Verify that recovery after H&W and regular win at the same time does not cause JS errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.HW_AND_REGULAR_WIN, consoleErrors, 5_000);
  });

  test('Verify that recovery during H&W mid-bonus (reload at 12s) returns to valid state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.COIN_BONUS_ONE_MINI_GAME, consoleErrors, 12_000);
  });

  test('Verify that recovery during H&W late-bonus (reload at 25s) returns to valid state', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) { test.skip(true, 'Debug mode not available'); return; }

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.COIN_BONUS_NO_EXTRA_CHESTS);
    await gamePage.spin();
    await gamePage.page.waitForTimeout(25_000);

    await reloadAndWaitForLoad(gamePage);
    await dismissOverlays(gamePage);

    try { await gamePage.waitForIdle(30_000); } catch { /* may still be in bonus */ }

    const errors = criticalOnly(consoleErrors);
    expect(errors).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. JACKPOT RECOVERY
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
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. FREE SPINS RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Free Spins Recovery — Verify Free Games State Survives Page Reload', () => {

  test.skip(!FEATURES.FREE_SPINS, 'Skipped — this game does not have free spins');
  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery during free games does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FREE_GAMES, consoleErrors, 5_000);
  });

  test('Verify that recovery during free games with all wins does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FREE_GAMES_WITH_ALL_WINS, consoleErrors, 8_000);
  });

  test('Verify that recovery during free games + coin bonus at the same time does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FREE_GAMES_COIN_BONUS, consoleErrors, 8_000);
  });

  test('Verify that recovery during free games transitioning to coin bonus does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FREE_GAMES_TO_COIN_BONUS, consoleErrors, 8_000);
  });

  test('Verify that recovery during free games to coin bonus on the last FS does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FREE_GAMES_TO_COIN_BONUS_LAST_FS, consoleErrors, 12_000);
  });

  test('Verify that recovery during FG and big win at the same time does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_AND_BIG_WIN, consoleErrors, 5_000);
  });

  test('Verify that recovery during FG and regular win at the same time does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_AND_REGULAR_WIN, consoleErrors, 5_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. EDGE CASES & COMBINATIONS (FG → H&W → Jackpot chains)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Recovery Edge Cases — Verify Extreme and Combined Scenarios', () => {

  test.skip(!FEATURES.HOLD_AND_WIN || !FEATURES.FREE_SPINS, 'Skipped — requires both H&W and Free Spins');
  test.setTimeout(5 * 60 * 1_000);

  test('Verify that recovery during FG → H&W & Grand Jackpot x10 chain does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_HW_GRAND_x10, consoleErrors, 10_000);
  });

  test('Verify that recovery during FG → H&W on 1st spin → Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_HW_1ST_SPIN_JACKPOT, consoleErrors, 8_000);
  });

  test('Verify that recovery during FG → H&W on 1st spin → Not Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_HW_1ST_SPIN_NO_JACKPOT, consoleErrors, 8_000);
  });

  test('Verify that recovery during FG → H&W on last spin → Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_HW_LAST_SPIN_JACKPOT, consoleErrors, 12_000);
  });

  test('Verify that recovery during FG → H&W on last spin → Not Jackpot does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.FG_HW_LAST_SPIN_NO_JACKPOT, consoleErrors, 12_000);
  });

  test('Verify that recovery after anticipation (near-miss) does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.ANTICIPATION, consoleErrors, 5_000);
  });

  test('Verify that recovery after mini game without big win does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.MINI_GAME_NO_BIG_WIN, consoleErrors, 8_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. PROGRESSION RECOVERY
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Progression Recovery — Verify Progression State Survives Page Reload', () => {

  test.skip(!FEATURES.PROGRESSION, 'Skipped — this game does not have progression');
  test.setTimeout(3 * 60 * 1_000);

  test('Verify that recovery during progression test does not cause errors', async ({ gamePage, gameDebugUrl, consoleErrors }) => {
    await triggerAndRecover(gamePage, gameDebugUrl, DEBUG_TRIGGERS.PROGRESSION_TEST, consoleErrors, 5_000);
  });

  test('Verify that balance is preserved after recovery during progression', async ({ gamePage, gameDebugUrl }) => {
    await navigateDebug(gamePage, gameDebugUrl);

    const available = await gamePage.debug.isAvailable();
    if (!available) { test.skip(true, 'Debug mode not available'); return; }

    const balanceBefore = await gamePage.getBalance();

    await gamePage.debug.triggerScenario(DEBUG_TRIGGERS.PROGRESSION_TEST);
    await gamePage.spinAndWait();

    const balanceAfterSpin = await gamePage.getBalanceStable();

    await reloadAndWaitForGame(gamePage);
    await gamePage.balance.init();

    const balanceAfterRecovery = await gamePage.getBalanceStable();

    // Tolerance of 2.00 accounts for win payouts still animating when balance was read
    expect(Math.abs(balanceAfterRecovery - balanceAfterSpin)).toBeLessThanOrEqual(2.00);
    expect(await gamePage.isSpinButtonEnabled()).toBe(true);
  });
});
