/**
 * 17 — Social Language Paytable OCR Tests
 *
 * The game's paytable / info panel is rendered entirely on a WebGL canvas —
 * there are no HTML text nodes to scan. This test takes screenshots of every
 * scroll position of the paytable canvas and uses Tesseract.js OCR to extract
 * text, then checks for forbidden RMG terminology.
 *
 * Covered locales:
 *   en_so — Social English
 *   es_so — Social Spanish
 *   de_so — Social German
 *
 * How it works:
 *   1. Authenticates with the launcher API (same as global-setup.ts) and
 *      requests a fresh game URL for the social locale.
 *   2. Loads the game, opens Menu → Info to reveal the paytable panel.
 *   3. Scrolls through the panel in steps, taking a screenshot at each position.
 *   4. Runs Tesseract.js OCR on each screenshot to extract visible text.
 *   5. Scans every extracted line for forbidden RMG terms using the same
 *      word-boundary regex as tests 15 and 16.
 *   6. Fails with a detailed report: page/scroll index, OCR text, forbidden
 *      word, and the approved social alternative.
 *
 * Skipping logic:
 *   - If USERNAME/PASSWORD are not set the test is skipped.
 *   - ALL-CAPS values are skipped (jackpot tier labels: GRAND, MAJOR, etc.).
 *   - Short OCR fragments under 3 characters are ignored.
 */

import { test, expect }                    from '@playwright/test';
import { createWorker }                    from 'tesseract.js';
import * as fs                             from 'fs';
import * as path                           from 'path';
import { findViolations, FORBIDDEN_WORDS } from '../src/constants/social-language.constants';
import { loadSelectors }                   from '../src/config/selectors';

// ── Config ────────────────────────────────────────────────────────────────────

const LAUNCHER_BASE  = 'https://launcher.avocadospins.com';
const GAME_ID        = process.env['GAME_ID'] ?? 'sands-of-fortune';
const SCROLL_STEPS   = 8;    // number of scroll positions to capture
const SCROLL_DELTA   = 400;  // pixels per scroll step

const SOCIAL_LOCALES = ['en_so', 'es_so', 'de_so'] as const;
type SocialLocale = typeof SOCIAL_LOCALES[number];

const LOCALE_LABELS: Record<SocialLocale, string> = {
  en_so: 'Social English',
  es_so: 'Social Spanish',
  de_so: 'Social German',
};

// Language hint for Tesseract per locale
const TESSERACT_LANG: Record<SocialLocale, string> = {
  en_so: 'eng',
  es_so: 'spa',
  de_so: 'deu',
};

// ── Launcher helpers ──────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, opts: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function getSocialGameUrl(locale: SocialLocale): Promise<string> {
  const username = process.env['USERNAME'];
  const password = process.env['PASSWORD'];
  const brandId  = process.env['GAME_BRAND_ID'] ?? 'tr';

  if (!username || !password) throw new Error('USERNAME/PASSWORD not set in .env');

  const { token } = await fetchJson<{ token: string }>(
    `${LAUNCHER_BASE}/api/auth/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) },
  );

  const { apiUrl } = await fetchJson<{ apiUrl: string }>(
    `${LAUNCHER_BASE}/conf/config.json`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const { url } = await fetchJson<{ url: string }>(
    `${apiUrl}/game/url`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json, *.*' },
      body: JSON.stringify({
        gameId: GAME_ID, mode: 'demo', currency: 'EUR', locale,
        brandId, playerId: 'player1', platform: 'web',
        lobbyUrl: `${LAUNCHER_BASE}/`, minBet: null, maxBet: 10_000, defaultBet: 1.0,
      }),
    },
  );

  return `${url}&mode=demo&locale=${locale}&et=${brandId}`;
}

// ── OCR helper ────────────────────────────────────────────────────────────────

/**
 * Run Tesseract OCR on an image buffer and return all extracted lines.
 */
async function ocrImageBuffer(buffer: Buffer, lang: string): Promise<string[]> {
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(buffer);
    return data.text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length >= 3);
  } finally {
    await worker.terminate();
  }
}

// ── Violation types ───────────────────────────────────────────────────────────

interface OcrViolation {
  scrollStep: number;
  line:       string;
  forbidden:  string;
  suggestion: string;
}

function formatOcrViolations(violations: OcrViolation[]): string {
  return violations
    .map(v =>
      `  SCROLL STEP: ${v.scrollStep}\n` +
      `  OCR TEXT:    "${v.line}"\n` +
      `  FORBIDDEN:   "${v.forbidden}"\n` +
      `  USE INSTEAD: ${v.suggestion}`,
    )
    .join('\n\n');
}

// ── Test suites ───────────────────────────────────────────────────────────────

for (const locale of SOCIAL_LOCALES) {

  test.describe(`${LOCALE_LABELS[locale]} (${locale}) — Paytable OCR Scan`, () => {

    test('no forbidden RMG terms in paytable canvas text', async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      if (!process.env['USERNAME'] || !process.env['PASSWORD']) {
        test.skip(true, 'USERNAME/PASSWORD not set in .env');
        return;
      }

      const sel     = loadSelectors();
      const gameUrl = await getSocialGameUrl(locale);
      await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(sel.loadingScreenReady, { timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(1_800);
      // Dismiss loading screen by clicking it directly, then fall back to coordinate click
      await page.locator(sel.loadingScreen).click({ force: true }).catch(async () => {
        const vp = page.viewportSize();
        await page.mouse.click(Math.round((vp?.width ?? 1280) / 2), Math.round((vp?.height ?? 720) * 0.9));
      });
      // Wait for menu button to become visible — confirms game animation is complete
      await page.locator(sel.menuButton).waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});

      // Open Menu → Info
      await page.locator(sel.menuButton).first().click();
      await page.waitForTimeout(1_500);
      await page.locator('text=Info').first().click();
      await page.waitForTimeout(2_000);

      const violations: OcrViolation[] = [];
      const screenshotDir = testInfo.outputPath('screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });

      // Scroll through the paytable and OCR each position
      for (let step = 0; step < SCROLL_STEPS; step++) {
        const screenshotPath = path.join(screenshotDir, `step-${step + 1}.png`);
        const buffer = await page.screenshot({ path: screenshotPath });

        const lines = await ocrImageBuffer(buffer, TESSERACT_LANG[locale]);
        console.log(`  [${locale}] Step ${step + 1} OCR lines:`, lines);

        for (const line of lines) {
          const matches = findViolations(line, locale);
          for (const match of matches) {
            violations.push({
              scrollStep: step + 1,
              line,
              forbidden:  match.word,
              suggestion: match.suggestion,
            });
          }
        }

        // Scroll down for next step
        await page.mouse.move(640, 400);
        await page.mouse.wheel(0, SCROLL_DELTA);
        await page.waitForTimeout(800);
      }

      if (violations.length > 0) {
        console.error(
          `\n${locale} (paytable OCR) — ${violations.length} forbidden RMG term(s) found:\n\n` +
          formatOcrViolations(violations),
        );
      }

      expect(
        violations.length,
        `Found ${violations.length} forbidden RMG term(s) in ${locale} paytable (OCR):\n\n` +
        formatOcrViolations(violations),
      ).toBe(0);
    });

  });

}

// ── Summary ───────────────────────────────────────────────────────────────────

test.describe('Social Language Paytable OCR — Full Compliance Summary', () => {

  test('scan all social locales and log paytable OCR violation counts', async ({ page }, testInfo) => {
    test.setTimeout(360_000);
    if (!process.env['USERNAME'] || !process.env['PASSWORD']) {
      test.skip(true, 'USERNAME/PASSWORD not set in .env');
      return;
    }

    const sel     = loadSelectors();
    const summary: Record<string, { violations: number }> = {};

    for (const locale of SOCIAL_LOCALES) {
      const gameUrl = await getSocialGameUrl(locale);
      await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(sel.loadingScreenReady, { timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(1_800);
      // Dismiss loading screen by clicking it directly, then fall back to coordinate click
      await page.locator(sel.loadingScreen).click({ force: true }).catch(async () => {
        const vp = page.viewportSize();
        await page.mouse.click(Math.round((vp?.width ?? 1280) / 2), Math.round((vp?.height ?? 720) * 0.9));
      });
      await page.waitForSelector(`${sel.spinButton}.enabled`, { timeout: 30_000 }).catch(() => {});

      await page.locator(sel.menuButton).first().click();
      await page.waitForTimeout(1_500);
      await page.locator('text=Info').first().click();
      await page.waitForTimeout(2_000);

      let violationCount = 0;
      const screenshotDir = testInfo.outputPath(`screenshots-${locale}`);
      fs.mkdirSync(screenshotDir, { recursive: true });

      for (let step = 0; step < SCROLL_STEPS; step++) {
        const screenshotPath = path.join(screenshotDir, `step-${step + 1}.png`);
        const buffer = await page.screenshot({ path: screenshotPath });
        const lines  = await ocrImageBuffer(buffer, TESSERACT_LANG[locale]);

        for (const line of lines) {
          violationCount += findViolations(line, locale).length;
        }

        await page.mouse.move(640, 400);
        await page.mouse.wheel(0, SCROLL_DELTA);
        await page.waitForTimeout(800);
      }

      summary[locale] = { violations: violationCount };
      await page.goto('about:blank');
    }

    console.log('\n══ Social Language Paytable OCR Report ══');
    for (const locale of SOCIAL_LOCALES) {
      const s      = summary[locale];
      const status = !s || s.violations === 0 ? '✓ PASS' : `✗ FAIL (${s.violations} violation(s))`;
      console.log(`\n${LOCALE_LABELS[locale]} (${locale}): ${status}`);
      console.log(`  Forbidden word entries checked: ${(FORBIDDEN_WORDS[locale] ?? []).length}`);
    }
    console.log('\n═════════════════════════════════════════');

    expect(true).toBe(true);
  });

});
