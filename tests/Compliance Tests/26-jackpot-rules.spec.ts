/**
 * MGA & IOM Jackpot Rules Compliance
 *
 * TLIB-370 How to win jackpot explained
 * TLIB-371 Jackpot RTP including base game (IOM)
 * TLIB-511 Jackpot limits described (IOM)
 *
 * NOTE: Rules content is rendered on WebGL canvas — uses OCR extraction.
 * If no jackpot mechanics are detected, tests are skipped gracefully.
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import { collectRulesTextOCR, closeInfoPanel } from './helpers/compliance-helpers';

test.describe('Jackpot Rules Compliance', () => {
  test.describe.configure({ timeout: 300_000 });

  test('TLIB-370: Rules explain how to win the jackpot', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasJackpot = /jackpot|grand|major|minor|mini/i.test(lower);
    if (!hasJackpot) {
      test.skip(true, 'Game has no jackpot mechanics — skipping');
      return;
    }

    const hasExplanation = /jackpot/i.test(lower) &&
      (lower.includes('win') || lower.includes('trigger') || lower.includes('award') || lower.includes('collect'));
    expect(hasExplanation,
      'TLIB-370: Rules must explain how players can win the jackpot.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-370: Jackpot tier values disclosed', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    if (!/jackpot|grand|major|minor|mini/i.test(lower)) {
      test.skip(true, 'No jackpot mechanics detected');
      return;
    }

    const tiers = ['grand', 'major', 'minor', 'mini'];
    const found = tiers.filter(t => lower.includes(t));
    expect(found.length,
      `TLIB-370: Jackpot tiers should be named. Found: ${found.join(', ')}`).toBeGreaterThanOrEqual(1);

    const hasValues = /(\d+[\.,]?\d*)\s*(x|×|credits?|coins?|€|\$|£)/i.test(rulesText);
    expect(hasValues,
      'Jackpot prize values must be disclosed in rules.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-371 [IOM]: Jackpot RTP stated (including base game)', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    if (!/jackpot/i.test(lower)) {
      test.skip(true, 'No jackpot mechanics');
      return;
    }

    const rtpMatches = rulesText.match(/(\d{2,3}[\.,]\d{1,2})\s*%/g);
    expect(rtpMatches,
      'TLIB-371: For jackpot games, RTP% must be stated.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-511 [IOM]: Jackpot limits described', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    if (!/jackpot/i.test(lower)) {
      test.skip(true, 'No jackpot mechanics');
      return;
    }

    const hasLimits = /max|limit|cap|reset|seed|contribution|progressive/i.test(lower);
    expect(hasLimits,
      'TLIB-511: Jackpot rules must describe limits (max awards, caps, seeds, etc.).\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });
});
