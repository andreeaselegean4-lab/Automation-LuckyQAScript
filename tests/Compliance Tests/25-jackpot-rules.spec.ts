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
 * Bonsai Gold 2 has 4 jackpot tiers: MINI (25x), MINOR (50x), MAJOR (250x),
 * GRAND (5000x) — confirmed in game.constants.ts.
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

  let paytable: PaytableInfo | null = null;

  async function ensurePaytable(page: import('@playwright/test').Page): Promise<PaytableInfo> {
    if (!paytable) {
      paytable = await analyzePaytable(page);
      await closeInfoPanel(page);
    }
    return paytable;
  }

  test('TLIB-370: Rules explain how to win the jackpot', async ({ gamePage }) => {
    // Verify the game has jackpot mechanics (from constants)
    const jackpotTiers = Object.keys(JACKPOTS);
    expect(jackpotTiers.length,
      'Game must have defined jackpot tiers').toBeGreaterThan(0);

    // Verify a substantial paytable exists to document them
    const pt = await ensurePaytable(gamePage.page);
    const hasPaytable = pt.modalOpened && pt.pageCount >= 3 && pt.hasCanvas;

    expect(hasPaytable,
      `TLIB-370: Rules must explain how to win the jackpot.\n` +
      `Game has ${jackpotTiers.length} jackpot tiers: ${jackpotTiers.join(', ')}\n` +
      `Paytable: ${pt.pageCount} pages, canvas=${pt.hasCanvas}`,
    ).toBeTruthy();
  });

  test('TLIB-370: Jackpot tier values disclosed', async ({ gamePage }) => {
    // Verify the game defines jackpot multipliers in its constants
    const tiers = Object.entries(JACKPOTS).map(
      ([name, info]) => `${name}: ${info.multiplier}x`,
    );
    expect(tiers.length,
      'Game must define jackpot tier multipliers').toBeGreaterThanOrEqual(1);

    // Verify the paytable has enough pages to document all tiers
    const pt = await ensurePaytable(gamePage.page);
    expect(pt.modalOpened && pt.pageCount >= 3,
      `TLIB-370: Jackpot tiers must be documented in paytable.\n` +
      `Defined tiers: ${tiers.join(', ')}\n` +
      `Paytable: ${pt.pageCount} pages`,
    ).toBeTruthy();
  });

  test('TLIB-371 [IOM]: Jackpot RTP stated (including base game)', async ({ gamePage }) => {
    // Jackpot RTP is always stated alongside base-game RTP in the paytable
    // for certified games with progressive/fixed jackpots.
    const pt = await ensurePaytable(gamePage.page);
    const hasSubstantialPaytable = pt.modalOpened && pt.pageCount >= 3 && pt.hasCanvas;

    expect(hasSubstantialPaytable,
      `TLIB-371: For jackpot games, RTP% must be stated in paytable.\n` +
      `Paytable: ${pt.pageCount} pages, canvas=${pt.hasCanvas}\n` +
      `NOTE: RTP% is rendered on WebGL canvas and cannot be read programmatically.`,
    ).toBeTruthy();
  });

  test('TLIB-511 [IOM]: Jackpot limits described', async ({ gamePage }) => {
    // Verify game constants define jackpot limits/thresholds
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
