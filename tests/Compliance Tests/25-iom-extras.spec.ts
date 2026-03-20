/**
 * IOM-Specific Compliance Tests
 *
 * TLIB-71  Game name visible at all times
 * TLIB-334 Time-critical events explained in rules
 * TLIB-344 Max win multiplier displayed
 * TLIB-346 Payout direction/pattern illustrated
 * TLIB-347 Bet placement explained
 * TLIB-56  Outcome not device-dependent (server-side RNG)
 *
 * NOTE: Rules content is rendered on WebGL canvas — uses OCR extraction.
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import { collectRulesTextOCR, closeInfoPanel } from './helpers/compliance-helpers';

test.describe('IOM-Specific Compliance', () => {
  test.describe.configure({ timeout: 300_000 });

  test('TLIB-71 [IOM]: Game name visible at all times', async ({ gamePage }) => {
    const title = await gamePage.page.title();
    expect(title.length,
      'TLIB-71: Game name must be visible (page title)').toBeGreaterThan(0);
  });

  test('TLIB-344 [IOM]: Max win multiplier displayed in rules', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);

    const hasMaxWin = /max(imum)?\s*win|(\d[\d,]*)\s*x\s*(the\s*)?(total\s*)?bet|(\d[\d,]*)\s*x\s*stake/i.test(rulesText);
    expect(hasMaxWin,
      'TLIB-344: Rules must display the maximum possible win multiplier.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-346 [IOM]: Payout direction/pattern illustrated', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasDirection = /left.to.right|right.to.left|ways|payline|adjacent|consecutive|reel/i.test(lower);
    expect(hasDirection,
      'TLIB-346: Rules must illustrate payout direction (e.g., "left to right").\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-347 [IOM]: How bet is placed explained', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasBetExplanation =
      (/bet|stake|wager/i.test(lower)) &&
      (/place|select|choose|adjust|increase|decrease|total|per|line/i.test(lower));
    expect(hasBetExplanation,
      'TLIB-347: Rules must explain how the player places a bet.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-334 [IOM]: Time-critical events explained', async ({ gamePage }) => {
    const rulesText = await collectRulesTextOCR(gamePage.page);
    await closeInfoPanel(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasTimeCritical = /disconnect|timeout|interrupt|malfunction|void|cancel|error|recover/i.test(lower);
    expect(hasTimeCritical,
      'TLIB-334: Rules should explain how time-critical events are handled.\n' +
      `OCR text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  test('TLIB-56 [IOM]: Outcome independent of device (server-side RNG)', async ({ gamePage }) => {
    const apiCalls: string[] = [];
    gamePage.page.on('request', (req: any) => {
      const url = req.url();
      if (url.includes('demoplay') || url.includes('play') || url.includes('spin')) {
        apiCalls.push(url);
      }
    });

    await gamePage.spinAndWait();

    expect(apiCalls.length,
      'TLIB-56: Game must make server-side API calls for spin results (proving device independence)').toBeGreaterThan(0);
  });
});
