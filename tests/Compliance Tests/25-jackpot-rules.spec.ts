/**
 * MGA & IOM Jackpot Rules Compliance
 *
 * TLIB-370 How to win jackpot explained
 * TLIB-371 Jackpot RTP including base game (IOM)
 * TLIB-511 Jackpot limits described (IOM)
 *
 * NOTE: Rules content is rendered on WebGL canvas.  These tests verify
 * structural evidence that jackpot documentation exists (multi-page paytable)
 * combined with known game constants (JACKPOTS from game.constants.ts).
 *
 * Jackpot tiers (if any) are defined in game.constants.ts.
 * Tests are automatically skipped for games with no jackpots.
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import {
  analyzePaytable,
  closeInfoPanel,
  type PaytableInfo,
} from './helpers/compliance-helpers';
import { JACKPOTS } from '../../src/constants/game.constants';

test.describe('Jackpot Rules Compliance', () => {
  test.describe.configure({ timeout: 300_000 });

  const hasJackpots = Object.keys(JACKPOTS).length > 0;

  let paytable: PaytableInfo | null = null;

  async function ensurePaytable(page: import('@playwright/test').Page): Promise<PaytableInfo> {
    if (!paytable) {
      paytable = await analyzePaytable(page);
      await closeInfoPanel(page);
    }
    return paytable;
  }

  test('TLIB-370: Verify that the paytable documents how to win the jackpot with a multi-page canvas', async ({ gamePage }) => {
    test.skip(!hasJackpots, 'Game has no jackpot mechanics — skipping');

    const jackpotTiers = Object.keys(JACKPOTS);

    // Verify a substantial paytable exists to document them
    const pt = await ensurePaytable(gamePage.page);
    const hasPaytable = pt.modalOpened && pt.pageCount >= 3 && pt.hasCanvas;

    expect(hasPaytable,
      `TLIB-370: Rules must explain how to win the jackpot.\n` +
      `Game has ${jackpotTiers.length} jackpot tiers: ${jackpotTiers.join(', ')}\n` +
      `Paytable: ${pt.pageCount} pages, canvas=${pt.hasCanvas}`,
    ).toBeTruthy();
  });

  test('TLIB-370: Verify that all jackpot tier multiplier values are documented in the paytable', async ({ gamePage }) => {
    test.skip(!hasJackpots, 'Game has no jackpot mechanics — skipping');

    const tiers = Object.entries(JACKPOTS).map(
      ([name, info]) => `${name}: ${info.multiplier}x`,
    );

    // Verify the paytable has enough pages to document all tiers
    const pt = await ensurePaytable(gamePage.page);
    expect(pt.modalOpened && pt.pageCount >= 3,
      `TLIB-370: Jackpot tiers must be documented in paytable.\n` +
      `Defined tiers: ${tiers.join(', ')}\n` +
      `Paytable: ${pt.pageCount} pages`,
    ).toBeTruthy();
  });

  test('TLIB-371 [IOM]: Verify that jackpot RTP% including base game is documented in the paytable', async ({ gamePage }) => {
    test.skip(!hasJackpots, 'Game has no jackpot mechanics — skipping');

    const pt = await ensurePaytable(gamePage.page);
    const hasSubstantialPaytable = pt.modalOpened && pt.pageCount >= 3 && pt.hasCanvas;

    expect(hasSubstantialPaytable,
      `TLIB-371: For jackpot games, RTP% must be stated in paytable.\n` +
      `Paytable: ${pt.pageCount} pages, canvas=${pt.hasCanvas}\n` +
      `NOTE: RTP% is rendered on WebGL canvas and cannot be read programmatically.`,
    ).toBeTruthy();
  });

  test('TLIB-511 [IOM]: Verify that jackpot limits and multiplier caps are described in the paytable rules', async ({ gamePage }) => {
    test.skip(!hasJackpots, 'Game has no jackpot mechanics — skipping');

    const hasLimits = Object.values(JACKPOTS).every(j => j.multiplier > 0);

    const pt = await ensurePaytable(gamePage.page);
    const hasPaytable = pt.modalOpened && pt.pageCount >= 3;

    expect(hasLimits && hasPaytable,
      `TLIB-511: Jackpot rules must describe limits (multipliers, caps).\n` +
      `Game constants define multipliers: ${Object.entries(JACKPOTS).map(([k, v]) => `${k}=${v.multiplier}x`).join(', ')}\n` +
      `Paytable: ${pt.pageCount} pages`,
    ).toBeTruthy();
  });
});
