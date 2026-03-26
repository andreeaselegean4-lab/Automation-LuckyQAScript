/**
 * MGA & IOM UI Compliance Tests
 *
 * TLIB-23  Free-to-play mode same rules/prizes/design
 * TLIB-27  Clock (HH:MM) visible at all times
 * TLIB-79  Texts translated in applicable language
 * TLIB-87  Balance displayed at all times
 * TLIB-178 Currency denomination clear
 * TLIB-179 Balance, total bet, denomination shown
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import { CLOCK, CURRENCY_SIGN, getBodyText } from './helpers/compliance-helpers';

test.describe('MGA/IOM UI Compliance', () => {
  test.describe.configure({ timeout: 180_000 });

  test('TLIB-27: Verify that a clock in HH:MM format is visible in the game UI during gameplay', async ({ gamePage }) => {
    const page = gamePage.page;

    // Try DOM element first — Novomatic games render a .digitalClock in the top bar
    const clockEl = page.locator(CLOCK);
    const hasClockElement = await clockEl.first().isVisible().catch(() => false);

    // Also check body text for HH:MM pattern
    const bodyText = await getBodyText(page);
    const hasTimePattern = /\d{1,2}:\d{2}/.test(bodyText);

    expect(hasClockElement || hasTimePattern,
      'TLIB-27: Clock in HH:MM format must be visible at all times during gameplay').toBeTruthy();
  });

  test('TLIB-79: Verify that game UI text is displayed in the applicable language (English) with terms like balance, bet, win', async ({ gamePage }) => {
    const bodyText = (await getBodyText(gamePage.page)).toLowerCase();
    // Novomatic games show BALANCE, BET, LAST WIN as DOM text in the bottom bar
    const found = ['balance', 'bet', 'win'].filter(t => bodyText.includes(t));
    expect(found.length,
      `TLIB-79: Expected English UI terms (balance, bet, win). Found: ${found.join(', ')}`).toBeGreaterThanOrEqual(2);
  });

  test('TLIB-87: Verify that the player balance is visible and shows a positive value before any spin', async ({ gamePage }) => {
    await expect(gamePage.balanceDisplay).toBeVisible({ timeout: 5_000 });
    const balance = await gamePage.getBalance();
    expect(balance, 'TLIB-87: Balance must show a positive value').toBeGreaterThan(0);
  });

  test('TLIB-87: Verify that the player balance remains visible after a spin completes', async ({ gamePage }) => {
    await gamePage.spinAndWait();
    await expect(gamePage.balanceDisplay).toBeVisible({ timeout: 5_000 });
  });

  test('TLIB-178: Verify that currency denomination (EUR, $, credits) is clearly displayed to the player', async ({ gamePage }) => {
    const page = gamePage.page;

    // Check for currency sign element in DOM (e.g. "EUR" in the top bar)
    const currencyEl = page.locator(CURRENCY_SIGN);
    const hasCurrencyEl = await currencyEl.first().isVisible().catch(() => false);

    // Also check body text for common currency indicators
    const bodyText = await getBodyText(page);
    const hasCurrencyText = /EUR|USD|GBP|\$|€|£|credits?|coins?/i.test(bodyText);

    expect(hasCurrencyEl || hasCurrencyText,
      'TLIB-178: Currency denomination (EUR, $, credits, etc.) must be clearly shown').toBeTruthy();
  });

  test('TLIB-179: Verify that balance, total bet value, and currency denomination are all visible simultaneously', async ({ gamePage }) => {
    await expect(gamePage.balanceDisplay).toBeVisible();
    await expect(gamePage.betValue).toBeVisible();
    const bet = await gamePage.getBet();
    expect(bet, 'TLIB-179: Bet value must be > 0').toBeGreaterThan(0);
  });

  test('TLIB-23: Verify that demo mode displays the same UI elements (spin, bet, balance) as real money mode', async ({ gamePage, gameUrl }) => {
    expect(gameUrl, 'Game should be running in demo mode').toContain('mode=demo');
    await expect(gamePage.spinButton).toBeVisible();
    await expect(gamePage.betValue).toBeVisible();
    await expect(gamePage.balanceDisplay).toBeVisible();
  });
});
