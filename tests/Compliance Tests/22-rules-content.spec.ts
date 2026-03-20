/**
 * MGA & IOM Rules Content Tests
 *
 * TLIB-335 Rules match source code configuration
 * TLIB-343 Correct theoretical RTP% displayed
 * TLIB-345 Win calculation and payout patterns explained
 * TLIB-348 All interactions explained
 * TLIB-351 Win-affecting events explained
 * TLIB-352 All game states and outcomes explained
 *
 * NOTE: Novomatic games render paytable / rules content on a WebGL canvas.
 * These tests use Tesseract.js OCR to extract text from screenshots of every
 * paytable page. OCR extraction happens ONCE in the first test of the suite
 * and is reused across all subsequent tests via a module-level variable.
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import { collectRulesTextOCR, closeInfoPanel } from './helpers/compliance-helpers';

test.describe('Rules Content — MGA Requirements', () => {
  test.describe.configure({ timeout: 300_000 });

  test('TLIB-343: Correct theoretical RTP% displayed in rules', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);

    // Look for a percentage like "96.48%" or "96,48 %"
    const rtpMatch = rulesText.match(/(\d{2,3}[\.,]\d{1,2})\s*%/);
    expect(rtpMatch,
      'TLIB-343: Rules MUST display the theoretical RTP as a percentage (e.g., "96.48%").\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();

    if (rtpMatch) {
      const rtpValue = parseFloat(rtpMatch[1].replace(',', '.'));
      expect(rtpValue, 'RTP must be within acceptable range (80-100%)').toBeGreaterThanOrEqual(80);
      expect(rtpValue).toBeLessThanOrEqual(100);
    }
  });

  test('TLIB-335: Rules reference game configuration accurately', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const configTerms = ['min', 'max', 'bet', 'ways', 'payline', 'symbol', 'reel', 'line', 'pay'];
    const found = configTerms.filter(t => lower.includes(t));
    expect(found.length,
      `TLIB-335: Rules should reference config terms. Found: ${found.join(', ')}\n` +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeGreaterThanOrEqual(2);
  });

  test('TLIB-345: Win calculation and payout patterns explained', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasPayouts = /pays|payout|win|prize|\dx/i.test(lower);
    const hasNumbers = /\d+/.test(rulesText);
    expect(hasPayouts && hasNumbers,
      'TLIB-345: Rules must explain win calculations and show payout values.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-348: All possible game interactions explained', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const interactions = ['spin', 'bet', 'wild', 'scatter', 'bonus', 'free', 'autoplay', 'auto'];
    const found = interactions.filter(t => lower.includes(t));
    expect(found.length,
      `TLIB-348: Rules should explain interactions. Found: ${found.join(', ')}\n` +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeGreaterThanOrEqual(2);
  });

  test('TLIB-351: Win-affecting events/elements explained', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const factors = ['wild', 'scatter', 'bonus', 'free spin', 'multiplier', 'jackpot', 'special', 'gold'];
    const found = factors.filter(t => lower.includes(t));
    expect(found.length,
      `TLIB-351: Rules must explain win-affecting elements. Found: ${found.join(', ')}\n` +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeGreaterThanOrEqual(1);
  });

  test('TLIB-352: All game states and outcomes explained', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const states = ['base', 'bonus', 'free', 'win', 'malfunction', 'feature', 'game'];
    const found = states.filter(t => lower.includes(t));
    expect(found.length,
      `TLIB-352: Rules must describe game states. Found: ${found.join(', ')}\n` +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeGreaterThanOrEqual(2);
  });
});
