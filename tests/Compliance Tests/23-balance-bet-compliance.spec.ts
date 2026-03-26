/**
 * MGA & IOM Balance & Bet Compliance Tests
 *
 * TLIB-470 Balance immediately reflects bet placement
 * TLIB-180 All available stakes displayed (IOM)
 */
import { test, expect } from '../../src/fixtures/game.fixture';

test.describe('Balance & Bet Compliance', () => {
  test.describe.configure({ timeout: 180_000 });

  test('TLIB-470: Verify that the balance changes immediately when a spin is initiated (bet deducted in real time)', async ({ gamePage }) => {
    const balanceBefore = await gamePage.getBalance();
    expect(balanceBefore, 'Initial balance should be positive').toBeGreaterThan(0);

    const bet = await gamePage.getBet();
    expect(bet, 'Bet should be positive').toBeGreaterThan(0);

    // Click spin — don't wait for completion, check balance immediately
    await gamePage.spin();
    await gamePage.page.waitForTimeout(1_500);

    const balanceAfterClick = await gamePage.getTopBarBalance();
    expect(balanceAfterClick,
      'TLIB-470: Balance must change immediately when spin is initiated').not.toBe(balanceBefore);

    // Wait for spin to complete so next test starts cleanly
    await gamePage.waitForIdle(30_000).catch(() => {});
  });

  test('TLIB-87+179: Verify that the balance display remains visible both during and after a spin completes', async ({ gamePage }) => {
    await expect(gamePage.balanceDisplay).toBeVisible();
    await gamePage.spinAndWait();
    await expect(gamePage.balanceDisplay).toBeVisible();
  });

  test('TLIB-180 [IOM]: Verify that minimum and maximum bet stakes are available and max is greater than min', async ({ gamePage }) => {
    // Decrease to minimum
    await gamePage.decreaseBet(30);
    const minBet = await gamePage.getBet();

    // Increase to maximum
    await gamePage.increaseBet(60);
    const maxBet = await gamePage.getBet();

    expect(minBet, 'Minimum bet should be > 0').toBeGreaterThan(0);
    expect(maxBet, 'TLIB-180: Maximum bet must be > minimum bet').toBeGreaterThan(minBet);
  });
});
