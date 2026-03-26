/**
 * 15 — Social Language Compliance Tests
 *
 * Verifies that translation files for social locale variants do NOT contain
 * Real Money Game (RMG) terminology that is forbidden under social language rules.
 *
 * Covered locales:
 *   en_so — Social English
 *   es_so — Social Spanish
 *   de_so — Social German
 *
 * Source rules:
 *   - "Social Language Rules EN ES" (12/8/2025)
 *   - "Social German Rules"
 *
 * How it works:
 *   1. Fetches the translation JS file for sands-of-fortune + social locale
 *      directly from the CDN (no game load required).
 *   2. Parses the file into a flat key→value map.
 *   3. Scans every string value for forbidden RMG terms using
 *      word-boundary regex (case-insensitive).
 *   4. Fails with a detailed report showing: key, offending value,
 *      matched forbidden word, and the approved social alternative.
 *
 * Skipping logic:
 *   - ALL-CAPS values are skipped (jackpot labels: GRAND, MAJOR, MINI, etc.)
 *   - If the CDN file returns 404 the test is skipped (locale not deployed yet)
 */

import { test, expect }                    from '@playwright/test';
import { fetchTranslationFile,
         parseTranslationContent,
         translationCdnUrl }               from '../src/utils/translationFetcher';
import { findViolations, FORBIDDEN_WORDS } from '../src/constants/social-language.constants';

// ── Config ────────────────────────────────────────────────────────────────────

const GAME_ID      = 'sands-of-fortune';
const SOCIAL_LOCALES = ['en_so', 'es_so', 'de_so'] as const;
type SocialLocale = typeof SOCIAL_LOCALES[number];

const LOCALE_LABELS: Record<SocialLocale, string> = {
  en_so: 'Social English',
  es_so: 'Social Spanish',
  de_so: 'Social German',
};

// ── Shared helpers ────────────────────────────────────────────────────────────

interface ViolationReport {
  key:        string;
  value:      string;
  forbidden:  string;
  suggestion: string;
}

function formatViolations(violations: ViolationReport[]): string {
  return violations
    .map(v =>
      `  KEY:        ${v.key}\n` +
      `  VALUE:      "${v.value}"\n` +
      `  FORBIDDEN:  "${v.forbidden}"\n` +
      `  USE INSTEAD: ${v.suggestion}`,
    )
    .join('\n\n');
}

// ── Suite: translation file reachability ─────────────────────────────────────

test.describe('Social Language CDN — Verify Translation File Availability for Social Locales', () => {

  for (const locale of SOCIAL_LOCALES) {
    test(`Verify that the ${LOCALE_LABELS[locale]} (${locale}) translation file is reachable and non-empty on the CDN`, async ({ page }) => {
      await page.goto('about:blank');
      const result = await fetchTranslationFile(page, GAME_ID, locale);

      if (result.status === 404) {
        test.skip(true, `Translation file not yet deployed for ${locale}`);
        return;
      }

      expect(result.ok, `CDN fetch failed — status ${result.status}: ${result.error ?? ''}`).toBe(true);
      expect(result.content.length, 'Translation file is empty').toBeGreaterThan(0);

      const url = translationCdnUrl(GAME_ID, locale);
      console.log(`✓ ${locale}: ${url} — ${result.content.length} bytes`);
    });
  }

});

// ── Suite: Social English (en_so) ─────────────────────────────────────────────

test.describe('Social English (en_so) — Verify No Forbidden Real Money Gaming Terms in Translations', () => {

  test('Verify that the translation file can be parsed into a key-value map with at least 4 translation keys', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'en_so');

    if (result.status === 404) {
      test.skip(true, 'en_so translation file not deployed');
      return;
    }

    expect(result.ok).toBe(true);
    const map = parseTranslationContent(result.content);
    const keyCount = Object.keys(map).length;

    console.log(`en_so: ${keyCount} translation keys found`);
    expect(keyCount, 'Expected at least 4 translation keys').toBeGreaterThanOrEqual(4);
  });

  test('Verify that no forbidden Real Money Gaming terms appear in any translation string value', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'en_so');

    if (result.status === 404) {
      test.skip(true, 'en_so translation file not deployed');
      return;
    }

    expect(result.ok).toBe(true);

    const map        = parseTranslationContent(result.content);
    const violations: ViolationReport[] = [];

    for (const [key, value] of Object.entries(map)) {
      const matches = findViolations(value, 'en_so');
      for (const entry of matches) {
        violations.push({
          key,
          value,
          forbidden:  entry.word,
          suggestion: entry.suggestion,
        });
      }
    }

    if (violations.length > 0) {
      console.error(
        `\nen_so — ${violations.length} forbidden RMG term(s) found:\n\n` +
        formatViolations(violations),
      );
    }

    expect(
      violations.length,
      `Found ${violations.length} forbidden RMG term(s) in en_so translations:\n\n` +
      formatViolations(violations),
    ).toBe(0);
  });

  test('Verify that no high-risk RMG terms (bet, pay, cash, buy, gamble, payout) appear in English social translation values', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'en_so');

    if (result.status === 404) {
      test.skip(true, 'en_so translation file not deployed');
      return;
    }

    const map = parseTranslationContent(result.content);
    const highRisk = ['bet', 'pay', 'cash', 'buy', 'gamble', 'payout'];
    const hits: string[] = [];

    for (const [key, value] of Object.entries(map)) {
      // Skip ALL-CAPS (jackpot tiers)
      if (value === value.toUpperCase() && /[A-Z]/.test(value)) continue;

      for (const term of highRisk) {
        const regex = new RegExp(`(?<![\\w])${term}(?![\\w])`, 'i');
        if (regex.test(value)) {
          hits.push(`  ${key}: "${value}" (contains "${term}")`);
        }
      }
    }

    if (hits.length > 0) {
      console.warn(`\nen_so high-risk terms found:\n${hits.join('\n')}`);
    }

    expect(hits.length, `High-risk RMG terms detected:\n${hits.join('\n')}`).toBe(0);
  });

});

// ── Suite: Social Spanish (es_so) ─────────────────────────────────────────────

test.describe('Social Spanish (es_so) — Verify No Forbidden Real Money Gaming Terms in Translations', () => {

  test('Verify that the translation file can be parsed into a key-value map with at least 4 translation keys', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'es_so');

    if (result.status === 404) {
      test.skip(true, 'es_so translation file not deployed');
      return;
    }

    expect(result.ok).toBe(true);
    const map = parseTranslationContent(result.content);
    const keyCount = Object.keys(map).length;

    console.log(`es_so: ${keyCount} translation keys found`);
    expect(keyCount, 'Expected at least 4 translation keys').toBeGreaterThanOrEqual(4);
  });

  test('Verify that no forbidden Real Money Gaming terms appear in any translation string value', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'es_so');

    if (result.status === 404) {
      test.skip(true, 'es_so translation file not deployed');
      return;
    }

    expect(result.ok).toBe(true);

    const map        = parseTranslationContent(result.content);
    const violations: ViolationReport[] = [];

    for (const [key, value] of Object.entries(map)) {
      const matches = findViolations(value, 'es_so');
      for (const entry of matches) {
        violations.push({
          key,
          value,
          forbidden:  entry.word,
          suggestion: entry.suggestion,
        });
      }
    }

    if (violations.length > 0) {
      console.error(
        `\nes_so — ${violations.length} forbidden RMG term(s) found:\n\n` +
        formatViolations(violations),
      );
    }

    expect(
      violations.length,
      `Found ${violations.length} forbidden RMG term(s) in es_so translations:\n\n` +
      formatViolations(violations),
    ).toBe(0);
  });

  test('Verify that no high-risk RMG terms (apuesta, pago, comprar, apostar) appear in Spanish social translation values', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'es_so');

    if (result.status === 404) {
      test.skip(true, 'es_so translation file not deployed');
      return;
    }

    const map      = parseTranslationContent(result.content);
    const highRisk = ['apuesta', 'pago', 'comprar', 'apostar', 'efectivo', 'dinero'];
    const hits: string[] = [];

    for (const [key, value] of Object.entries(map)) {
      if (value === value.toUpperCase() && /[A-Z]/.test(value)) continue;

      for (const term of highRisk) {
        const regex = new RegExp(`(?<![\\w\\u00C0-\\u024F])${term}(?![\\w\\u00C0-\\u024F])`, 'i');
        if (regex.test(value)) {
          hits.push(`  ${key}: "${value}" (contains "${term}")`);
        }
      }
    }

    if (hits.length > 0) {
      console.warn(`\nes_so high-risk terms found:\n${hits.join('\n')}`);
    }

    expect(hits.length, `High-risk RMG terms detected:\n${hits.join('\n')}`).toBe(0);
  });

});

// ── Suite: Social German (de_so) ──────────────────────────────────────────────

test.describe('Social German (de_so) — Verify No Forbidden Real Money Gaming Terms in Translations', () => {

  test('Verify that the translation file can be parsed into a key-value map with at least 4 translation keys', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'de_so');

    if (result.status === 404) {
      test.skip(true, 'de_so translation file not deployed');
      return;
    }

    expect(result.ok).toBe(true);
    const map = parseTranslationContent(result.content);
    const keyCount = Object.keys(map).length;

    console.log(`de_so: ${keyCount} translation keys found`);
    expect(keyCount, 'Expected at least 4 translation keys').toBeGreaterThanOrEqual(4);
  });

  test('Verify that no forbidden Real Money Gaming terms appear in any translation string value', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'de_so');

    if (result.status === 404) {
      test.skip(true, 'de_so translation file not deployed');
      return;
    }

    expect(result.ok).toBe(true);

    const map        = parseTranslationContent(result.content);
    const violations: ViolationReport[] = [];

    for (const [key, value] of Object.entries(map)) {
      const matches = findViolations(value, 'de_so');
      for (const entry of matches) {
        violations.push({
          key,
          value,
          forbidden:  entry.word,
          suggestion: entry.suggestion,
        });
      }
    }

    if (violations.length > 0) {
      console.error(
        `\nde_so — ${violations.length} forbidden RMG term(s) found:\n\n` +
        formatViolations(violations),
      );
    }

    expect(
      violations.length,
      `Found ${violations.length} forbidden RMG term(s) in de_so translations:\n\n` +
      formatViolations(violations),
    ).toBe(0);
  });

  test('Verify that no high-risk RMG terms (wette, auszahlung, kaufen, bargeld) appear in German social translation values', async ({ page }) => {
    await page.goto('about:blank');
    const result = await fetchTranslationFile(page, GAME_ID, 'de_so');

    if (result.status === 404) {
      test.skip(true, 'de_so translation file not deployed');
      return;
    }

    const map      = parseTranslationContent(result.content);
    const highRisk = ['wette', 'auszahlung', 'kaufen', 'bargeld', 'glücksspiel', 'verlust'];
    const hits: string[] = [];

    for (const [key, value] of Object.entries(map)) {
      if (value === value.toUpperCase() && /[A-Z]/.test(value)) continue;

      for (const term of highRisk) {
        const regex = new RegExp(`(?<![\\w\\u00C0-\\u024F])${term}(?![\\w\\u00C0-\\u024F])`, 'i');
        if (regex.test(value)) {
          hits.push(`  ${key}: "${value}" (contains "${term}")`);
        }
      }
    }

    if (hits.length > 0) {
      console.warn(`\nde_so high-risk terms found:\n${hits.join('\n')}`);
    }

    expect(hits.length, `High-risk RMG terms detected:\n${hits.join('\n')}`).toBe(0);
  });

});

// ── Suite: Summary report ─────────────────────────────────────────────────────

test.describe('Social Language — Generate Full Translation Compliance Summary Report', () => {

  test('Generate a full compliance summary report scanning all social locales for forbidden RMG word violations', async ({ page }) => {
    await page.goto('about:blank');

    const summary: Record<string, { keys: number; violations: number; details: string[] }> = {};

    for (const locale of SOCIAL_LOCALES) {
      const result = await fetchTranslationFile(page, GAME_ID, locale);

      if (!result.ok) {
        summary[locale] = { keys: 0, violations: 0, details: [`SKIPPED — status ${result.status}`] };
        continue;
      }

      const map = parseTranslationContent(result.content);
      const details: string[] = [];
      let violationCount = 0;

      for (const [key, value] of Object.entries(map)) {
        const matches = findViolations(value, locale);
        for (const entry of matches) {
          violationCount++;
          details.push(`  [${locale}] ${key}: "${value}" → forbidden: "${entry.word}"`);
        }
      }

      summary[locale] = {
        keys:       Object.keys(map).length,
        violations: violationCount,
        details,
      };
    }

    // Log the full report regardless of pass/fail
    console.log('\n══ Social Language Compliance Report ══');
    for (const locale of SOCIAL_LOCALES) {
      const s = summary[locale];
      if (!s) continue;
      const status = s.violations === 0 ? '✓ PASS' : `✗ FAIL (${s.violations} violation(s))`;
      console.log(`\n${LOCALE_LABELS[locale]} (${locale}): ${status}`);
      console.log(`  Translation keys scanned: ${s.keys}`);
      console.log(`  Forbidden word entries checked: ${(FORBIDDEN_WORDS[locale] ?? []).length}`);
      if (s.details.length > 0) {
        console.log('  Violations:');
        s.details.forEach(d => console.log(d));
      }
    }
    console.log('\n══════════════════════════════════════');

    // This test always passes — it is a diagnostic/reporting test only
    expect(true).toBe(true);
  });

});
