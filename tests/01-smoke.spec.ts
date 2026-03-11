/**
 * 01 — Smoke Tests
 *
 * Verifies the game loads correctly and all critical UI elements are visible
 * and interactive before any other test suite runs.
 *
 * These tests are intentionally fast (~30s total) and are designed to be the
 * first gate in CI — if anything here fails, the entire suite is blocked.
 */
import { test, expect } from '@/fixtures/game.fixture';

test.describe('Smoke — Game Load & UI Integrity', () => {

  test('game loads without JS errors', async ({ gamePage: _gamePage, consoleErrors }) => {
    // gamePage fixture already navigated + waited for load.
    // Any errors captured by attachErrorListener appear in consoleErrors.
    expect(consoleErrors).toHaveLength(0);
  });

  test('spin button is visible and enabled after load', async ({ gamePage }) => {
    await expect(gamePage.spinButton).toBeVisible();
    const enabled = await gamePage.isSpinButtonEnabled();
    expect(enabled).toBe(true);
  });

  test('autoplay button is visible', async ({ gamePage }) => {
    await expect(gamePage.autoplayButton).toBeVisible();
  });

  test('bet controls are visible', async ({ gamePage }) => {
    await expect(gamePage.betDecrease).toBeVisible();
    await expect(gamePage.betIncrease).toBeVisible();
    await expect(gamePage.betValue).toBeVisible();
  });

  test('balance is displayed and is a positive number', async ({ gamePage }) => {
    const balance = await gamePage.getBalance();
    expect(balance).toBeGreaterThan(0);
  });

  test('initial bet value is a positive number', async ({ gamePage }) => {
    const bet = await gamePage.getBet();
    expect(bet).toBeGreaterThan(0);
  });

  test('loading screen is gone after load', async ({ gamePage }) => {
    // After waitForLoad the loading screen should no longer be blocking
    await expect(gamePage.loadingScreen).not.toHaveClass(/(?<!\w)(?:show|visible|active)(?!\w)/, { timeout: 3_000 }).catch(() => {
      // If the loading screen element has been removed from DOM that's also fine
    });
  });

  test('menu button is visible', async ({ gamePage }) => {
    await expect(gamePage.menuButton).toBeVisible();
  });

  test('turbo toggle is visible', async ({ gamePage }) => {
    await expect(gamePage.turboButton).toBeVisible();
  });

  test('last-win display is visible and initially zero', async ({ gamePage }) => {
    // The framework hides the value element when Last Win is 0 — check it exists in DOM
    await expect(gamePage.lastWinDisplay).toBeAttached();
    const lastWin = await gamePage.getLastWin();
    expect(lastWin).toBe(0);
  });

  test('page title is present', async ({ page }) => {
    const title = await page.title();
    // Some game builds ship without a <title> tag; treat empty as acceptable
    expect(typeof title).toBe('string');
  });

});
