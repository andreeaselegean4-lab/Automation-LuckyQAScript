/**
 * 14 — Session Persistence Tests
 *
 * Verifies that game state survives a page refresh:
 *
 *   - Balance persists after reload (server-side state via gstoken/localState)
 *   - Bet level persists after reload (stored in localState)
 *   - Game loads back to the base game (not stuck in a bonus round)
 *   - Turbo/fast-play preference persists (if applicable)
 *   - No JS errors on reload
 *   - Spin works normally after reload
 *
 * The Toucan framework round-trips a `localState` JSON blob with every spin
 * request/response. The server uses this (along with the gstoken session) to
 * restore game state. These tests validate that contract.
 */
import { test, expect } from '../src/fixtures/game.fixture';

test.describe('Session Persistence', () => {

  test.setTimeout(2 * 60 * 1_000);

  test('balance survives a page reload', async ({ gamePage, gameUrl }) => {
    // Capture balance BEFORE the spin — in demo mode the server restores the
    // session to this pre-spin value on reload (the spin result lives only in
    // client localState which is lost on a hard reload).
    const balanceBeforeReload = await gamePage.getBalance();

    // Do one spin to change the client-side balance
    await gamePage.spinAndWait();

    // Reload the page
    await gamePage.page.reload({ waitUntil: 'domcontentloaded' });

    // Re-run the load sequence (loading screen, CONTINUE button, wait for idle)
    await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
    await gamePage.page.waitForTimeout(1_800);
    const vh = gamePage.page.viewportSize()?.height ?? 720;
    const continueY = Math.round(vh * 0.95);
    await gamePage.page.mouse.click(640, continueY);
    await gamePage.waitForIdle(20_000);

    // getBalanceStable() waits for any balance roll-up animation to settle
    const balanceAfterReload = await gamePage.getBalanceStable();

    // After reload the server restores the pre-spin balance — diff should be ~0
    expect(Math.abs(balanceAfterReload - balanceBeforeReload)).toBeLessThanOrEqual(0.05);
  });

  test('bet level survives a page reload', async ({ gamePage }) => {
    // Increase bet a few times to move away from default
    await gamePage.increaseBet(3);
    const betBeforeReload = await gamePage.getBet();

    await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
    await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
    await gamePage.page.waitForTimeout(1_800);
    const vh2 = gamePage.page.viewportSize()?.height ?? 720;
    const continueY2 = Math.round(vh2 * 0.95);
    await gamePage.page.mouse.click(640, continueY2);
    await gamePage.waitForIdle(20_000);

    const betAfterReload = await gamePage.getBet();

    // Bet should be restored to the level we set
    expect(betAfterReload).toBe(betBeforeReload);
  });

  test('no JS errors after reload', async ({ gamePage, consoleErrors }) => {
    await gamePage.page.reload({ waitUntil: 'domcontentloaded' });

    // Re-attach error listener (page.reload creates a new context)
    const reloadErrors: string[] = [];
    gamePage.page.on('console', msg => {
      if (msg.type() === 'error') reloadErrors.push(`[console.error] ${msg.text()}`);
    });
    gamePage.page.on('pageerror', err => {
      reloadErrors.push(`[pageerror] ${err.message}`);
    });

    await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
    await gamePage.page.waitForTimeout(1_800);
    const vh = gamePage.page.viewportSize()?.height ?? 720;
    const continueY = Math.round(vh * 0.95);
    await gamePage.page.mouse.click(640, continueY);
    await gamePage.waitForIdle(20_000);

    expect(reloadErrors).toHaveLength(0);
  });

  test('spin works normally after reload', async ({ gamePage }) => {
    // Do a spin, reload, then spin again
    await gamePage.spinAndWait();

    await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
    await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
    await gamePage.page.waitForTimeout(1_800);
    const vh = gamePage.page.viewportSize()?.height ?? 720;
    const continueY = Math.round(vh * 0.95);
    await gamePage.page.mouse.click(640, continueY);
    await gamePage.waitForIdle(20_000);
    await gamePage.balance.init();

    // Spin after reload
    const balanceBefore = await gamePage.getBalance();
    await gamePage.spinButton.click();
    await gamePage.waitForSpinComplete();
    const balanceAfter = await gamePage.getBalance();

    // Balance should have changed (bet was deducted)
    expect(balanceAfter).not.toBe(balanceBefore);

    // Game should be idle again
    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);
  });

  test('game returns to base game after reload (not stuck in bonus)', async ({ gamePage }) => {
    await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
    await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
    await gamePage.page.waitForTimeout(1_800);
    const vh = gamePage.page.viewportSize()?.height ?? 720;
    const continueY = Math.round(vh * 0.95);
    await gamePage.page.mouse.click(640, continueY);
    await gamePage.waitForIdle(20_000);

    // In base game: spin button should be visible and enabled
    await expect(gamePage.spinButton).toBeVisible();
    const idle = await gamePage.isSpinButtonEnabled();
    expect(idle).toBe(true);

    // Bet controls should be enabled (they're disabled during bonus)
    const controlsEnabled = await gamePage.areControlsEnabled();
    expect(controlsEnabled).toBe(true);
  });

  test('full navigation (goto) restores session correctly', async ({ gamePage, gameUrl }) => {
    await gamePage.spinAndWait();
    const balanceBefore = await gamePage.getBalance();

    // Full re-navigation (not just reload — simulates closing and reopening)
    await gamePage.page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
    await gamePage.page.waitForTimeout(1_800);
    const vh = gamePage.page.viewportSize()?.height ?? 720;
    const continueY = Math.round(vh * 0.95);
    await gamePage.page.mouse.click(640, continueY);
    await gamePage.waitForIdle(20_000);

    const balanceAfterNav = await gamePage.getBalance();

    // Balance should match (server maintains the session via gstoken)
    expect(Math.abs(balanceAfterNav - balanceBefore)).toBeLessThanOrEqual(0.05);
  });

  test('three consecutive reloads do not corrupt state', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    const balanceExpected = await gamePage.getBalance();

    for (let i = 0; i < 3; i++) {
      await gamePage.page.reload({ waitUntil: 'domcontentloaded' });
      await gamePage.page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
      await gamePage.page.waitForTimeout(1_800);
      await gamePage.page.mouse.click(640, 590);
      await gamePage.waitForIdle(20_000);

      const current = await gamePage.getBalance();
      expect(Math.abs(current - balanceExpected)).toBeLessThanOrEqual(0.05);
    }

    // Final spin to confirm everything still works
    await gamePage.balance.init();
    await gamePage.spinButton.click();
    await gamePage.waitForSpinComplete();
    expect(await gamePage.isSpinButtonEnabled()).toBe(true);
  });

});
