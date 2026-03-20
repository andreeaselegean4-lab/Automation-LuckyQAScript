/**
 * MGA & IOM Rules Accessibility Tests
 *
 * TLIB-339 Rules accessible via easy-to-access button
 * TLIB-340 Rules accessible at all times / same device
 * TLIB-341 Rules accessible without placing a bet
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import {
  INFO_BUTTON,
  openInfoPanel,
  closeInfoPanel,
  isInfoPanelOpen,
} from './helpers/compliance-helpers';

test.describe('Rules Accessibility', () => {
  test.describe.configure({ timeout: 180_000 });

  test('TLIB-339: Rules accessible via easy-to-access button', async ({ gamePage }) => {
    const page = gamePage.page;

    // Verify an info/rules button is visible in the UI
    const infoBtn = page.locator(INFO_BUTTON);
    const hasInfoBtn = await infoBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasInfoBtn,
      'TLIB-339: An info/rules button must be visible in the game UI').toBeTruthy();

    // Click it and verify the rules modal opens
    const opened = await openInfoPanel(page);
    expect(opened,
      'TLIB-339: Clicking the info button must open the rules/paytable modal').toBeTruthy();

    await closeInfoPanel(page);
  });

  test('TLIB-340: Rules accessible at all times (before and after spin)', async ({ gamePage }) => {
    const page = gamePage.page;

    // Before spin — rules should be openable
    const openedBefore = await openInfoPanel(page);
    expect(openedBefore, 'Rules must be accessible before spinning').toBeTruthy();
    await closeInfoPanel(page);

    // Wait for game to be idle before spinning
    await gamePage.waitForIdle(10_000).catch(() => {});

    // Spin
    await gamePage.spinAndWait();

    // After spin — rules should still be openable
    const openedAfter = await openInfoPanel(page);
    expect(openedAfter, 'TLIB-340: Rules must be accessible after spinning').toBeTruthy();
    await closeInfoPanel(page);
  });

  test('TLIB-341: Rules accessible without placing a bet', async ({ gamePage }) => {
    const page = gamePage.page;

    // Fresh load — no bet placed yet — rules should work
    const opened = await openInfoPanel(page);
    expect(opened,
      'TLIB-341: Rules must be accessible without placing a bet first').toBeTruthy();
    await closeInfoPanel(page);
  });
});
