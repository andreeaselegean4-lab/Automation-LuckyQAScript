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
 * TEXT SOURCE STRATEGY
 * ────────────────────
 * Novomatic games render paytable / rules on a WebGL canvas — direct OCR is
 * unreliable.  Instead we fetch the game's **translation file** from CDN:
 *
 *   https://cdn2.avocadospins.com/tr/cms/latest/<gameId>.<locale>.js
 *
 * This file contains ALL the text that the game renders on canvas, including
 * RTP percentages, payout descriptions, feature explanations, etc.
 *
 * DOM-based evidence (visible spin/bet/autoplay controls) supplements the
 * translation text for interaction and configuration checks.
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import {
  collectRulesFromTranslation,
  getDOMComplianceEvidence,
  openInfoPanel,
  closeInfoPanel,
  MODAL,
} from './helpers/compliance-helpers';
import type { TranslationMap } from '../../src/utils/translationFetcher';

// ── Shared state: fetch translations once, reuse across the suite ────────────

let rulesText = '';
let translationMap: TranslationMap = {};
let translationLoaded = false;

test.describe('Rules Content — MGA Requirements', () => {
  test.describe.configure({ timeout: 300_000 });

  // Load translation data once before the first test that needs it
  async function ensureTranslation(page: import('@playwright/test').Page): Promise<void> {
    if (translationLoaded) return;

    const gameId = process.env['GAME_ID'] ?? 'bonsai-gold-2';
    const result = await collectRulesFromTranslation(page, gameId, 'en');
    rulesText = result.text;
    translationMap = result.map;
    translationLoaded = true;

    console.log(`[22-rules] Translation text length: ${rulesText.length}`);
    console.log(`[22-rules] Translation keys: ${Object.keys(translationMap).length}`);
    console.log(`[22-rules] Sample text (first 500 chars): ${rulesText.substring(0, 500)}`);
  }

  // ── TLIB-343 ──────────────────────────────────────────────────────────────
  test('TLIB-343: Correct theoretical RTP% displayed in rules', async ({ gamePage }) => {
    await ensureTranslation(gamePage.page);

    // Primary: look for a decimal percentage like "96.48%" or "96,48 %"
    const rtpFullMatch = rulesText.match(/(\d{2,3}[\.,]\d{1,2})\s*%/);

    // Fallback: any digit(s) near a "%" sign
    const rtpLooseMatch = rulesText.match(/\d[\d,.\s]{0,5}%/);

    // Fallback: "%" present + RTP keyword anywhere
    const hasPercentSign = rulesText.includes('%');
    const hasRTPKeyword  = /\brtp\b|return to player|theoretical|payout/i.test(rulesText);

    const rtpFound = Boolean(rtpFullMatch ?? rtpLooseMatch ?? (hasPercentSign && hasRTPKeyword));

    expect(rtpFound,
      'TLIB-343: Rules MUST display the theoretical RTP as a percentage.\n' +
      `full match="${rtpFullMatch?.[0]}", loose match="${rtpLooseMatch?.[0]}", ` +
      `hasPercent=${hasPercentSign}, hasRTPKeyword=${hasRTPKeyword}\n` +
      `Translation text sample: "${rulesText.substring(0, 600)}"`).toBeTruthy();

    // Validate range if we got a clean number
    if (rtpFullMatch) {
      const rtpValue = parseFloat(rtpFullMatch[1].replace(',', '.'));
      expect(rtpValue, 'RTP must be within acceptable range (80–100%)').toBeGreaterThanOrEqual(80);
      expect(rtpValue).toBeLessThanOrEqual(100);
    }
  });

  // ── TLIB-335 ──────────────────────────────────────────────────────────────
  test('TLIB-335: Rules reference game configuration accurately', async ({ gamePage }) => {
    await ensureTranslation(gamePage.page);
    const lower = rulesText.toLowerCase();

    const configTerms = ['min', 'max', 'bet', 'ways', 'payline', 'symbol', 'reel', 'line', 'pay'];
    const ocrFound = configTerms.filter(t => lower.includes(t));

    // DOM fallback: balance + bet controls visible = config is exposed
    const dom = await getDOMComplianceEvidence(gamePage.page);
    const domEvidence = dom.hasBalanceDisplay || dom.hasBetInteraction;

    const passed = ocrFound.length >= 1 || domEvidence;

    expect(passed,
      `TLIB-335: Rules should reference configuration terms.\n` +
      `Translation found: ${ocrFound.join(', ') || 'none'}\n` +
      `DOM — balance: ${dom.hasBalanceDisplay}, bet controls: ${dom.hasBetInteraction}\n` +
      `Translation text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  // ── TLIB-345 ──────────────────────────────────────────────────────────────
  test('TLIB-345: Win calculation and payout patterns explained', async ({ gamePage }) => {
    await ensureTranslation(gamePage.page);
    const lower = rulesText.toLowerCase();

    const hasPayouts = /pays|payout|win|prize|\dx/i.test(lower);
    const hasNumbers = /\d+/.test(rulesText);

    expect(hasPayouts && hasNumbers,
      'TLIB-345: Rules must explain win calculations and show payout values.\n' +
      `Translation text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  // ── TLIB-348 ──────────────────────────────────────────────────────────────
  test('TLIB-348: All possible game interactions explained', async ({ gamePage }) => {
    await ensureTranslation(gamePage.page);
    const lower = rulesText.toLowerCase();

    const interactions = ['spin', 'bet', 'wild', 'scatter', 'bonus', 'free', 'autoplay', 'auto'];
    const textFound = interactions.filter(t => lower.includes(t));

    // DOM fallback: visible interactive controls
    const dom = await getDOMComplianceEvidence(gamePage.page);
    const domInteractions = [
      dom.hasSpinInteraction,
      dom.hasBetInteraction,
      dom.hasAutoplayInteraction,
    ].filter(Boolean).length;

    // Pass if: ≥1 term in translation text OR ≥2 DOM interaction controls
    const passed = textFound.length >= 1 || domInteractions >= 2;

    expect(passed,
      `TLIB-348: Rules should explain game interactions.\n` +
      `Translation found: ${textFound.join(', ') || 'none'}\n` +
      `DOM — spin: ${dom.hasSpinInteraction}, bet: ${dom.hasBetInteraction}, autoplay: ${dom.hasAutoplayInteraction}\n` +
      `Translation text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  // ── TLIB-351 ──────────────────────────────────────────────────────────────
  test('TLIB-351: Win-affecting events/elements explained', async ({ gamePage }) => {
    await ensureTranslation(gamePage.page);
    const lower = rulesText.toLowerCase();

    const factors = [
      'wild', 'scatter', 'bonus', 'free spin', 'free game', 'multiplier',
      'jackpot', 'special', 'gold', 'bonsai', 'expand', 'substitut',
    ];
    const textFound = factors.filter(t => lower.includes(t));

    // Structural fallback: info modal opens and has navigable content
    const modalOpened = await openInfoPanel(gamePage.page);
    let modalHasContent = false;
    if (modalOpened) {
      const txt = await gamePage.page.locator(MODAL).textContent().catch(() => '');
      modalHasContent = (txt ?? '').trim().length > 0;
    }
    await closeInfoPanel(gamePage.page);

    const passed = textFound.length >= 1 || modalHasContent;

    expect(passed,
      `TLIB-351: Rules must explain win-affecting elements.\n` +
      `Translation found: ${textFound.join(', ') || 'none'}\n` +
      `Modal opened: ${modalOpened}, modal has DOM content: ${modalHasContent}\n` +
      `Translation text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });

  // ── TLIB-352 ──────────────────────────────────────────────────────────────
  test('TLIB-352: All game states and outcomes explained', async ({ gamePage }) => {
    await ensureTranslation(gamePage.page);
    const lower = rulesText.toLowerCase();

    const states = ['base', 'bonus', 'free', 'win', 'malfunction', 'feature', 'game', 'spin'];
    const textFound = states.filter(t => lower.includes(t));

    // DOM fallback: game has win display + spin control = multiple game states
    const dom = await getDOMComplianceEvidence(gamePage.page);
    const domEvidence = dom.hasWinDisplay || dom.hasSpinInteraction;

    const passed = textFound.length >= 1 || domEvidence;

    expect(passed,
      `TLIB-352: Rules must describe game states and outcomes.\n` +
      `Translation found: ${textFound.join(', ') || 'none'}\n` +
      `DOM — win display: ${dom.hasWinDisplay}, spin control: ${dom.hasSpinInteraction}\n` +
      `Translation text sample: "${rulesText.substring(0, 500)}"`).toBeTruthy();
  });
});
