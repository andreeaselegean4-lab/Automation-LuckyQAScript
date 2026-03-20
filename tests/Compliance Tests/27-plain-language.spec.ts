/**
 * Additional Compliance Checks (from QA Report)
 *
 * Plain language in paytable, loss conditions, coin prize range, malfunction clause
 *
 * NOTE: Rules content is rendered on WebGL canvas — uses OCR extraction.
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import { collectRulesTextOCR, closeInfoPanel } from './helpers/compliance-helpers';

test.describe('Plain Language & Prize Disclosure', () => {
  test.describe.configure({ timeout: 300_000 });

  test('Paytable uses clear, plain-language labels', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasSymbolNames = /symbol|wild|scatter|bonus|coin|pot|dragon|gold/i.test(lower);
    expect(hasSymbolNames,
      'Paytable must use plain language with clear symbol names.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('Loss conditions explicitly stated', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasLossCondition = /lose|lost|no.win|not.win|bet.is.lost|malfunction.voids|no winning/i.test(lower);
    expect(hasLossCondition,
      'Rules must state how a player can lose (e.g., "if no winning combination, the bet is lost").\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('Ways to win fully covered', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const found = ['match', 'win', 'pays', 'payout', 'symbol', 'ways', 'combination'].filter(t => lower.includes(t));
    expect(found.length,
      `Rules must cover ways to win. Found: ${found.join(', ')}\n` +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeGreaterThanOrEqual(2);
  });

  test('Coin/special symbol prize range disclosed (if applicable)', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    if (!/coin|collect|pot|hold.&.win|hold.and.win/i.test(lower)) {
      test.skip(true, 'No coin/collect mechanics detected');
      return;
    }

    const hasRange = /range|from.*to|min.*max|value.*between|\d+.*to.*\d+/i.test(lower);
    const hasValues = /\d+[\.,]?\d*\s*(x|×|credits?|coins?)/i.test(rulesText);
    expect(hasRange || hasValues,
      'Coin/collect prize value range must be clearly disclosed.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('Malfunction clause present', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    expect(/malfunction/i.test(lower),
      'Rules must include a malfunction clause ("Malfunction voids all pays and plays").\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });
});
