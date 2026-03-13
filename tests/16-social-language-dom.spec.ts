/**
 * 16 — Social Language DOM Scan Tests
 *
 * Loads the game in each social locale and scans all visible DOM text
 * for forbidden RMG terminology. This catches hardcoded strings that
 * do NOT go through the translation file and would therefore be missed
 * by the CDN-based tests in 15-social-language.spec.ts.
 *
 * Covered locales:
 *   en_so — Social English
 *   es_so — Social Spanish
 *   de_so — Social German
 *
 * How it works:
 *   1. Authenticates with the launcher API using USERNAME/PASSWORD from .env
 *      (same flow as global-setup.ts) and requests a fresh game URL with the
 *      social locale — e.g. locale: 'en_so'.
 *   2. Loads the game fully using GamePage.load() — waits for the intro
 *      overlay to be dismissed and the spin button to be ready.
 *   3. Extracts all visible text nodes from the DOM (skips hidden, script,
 *      and style elements).
 *   4. Also opens the menu panel to expose paytable / help / info text
 *      that is not visible on the main screen.
 *   5. Scans every extracted string for forbidden RMG terms using the
 *      same word-boundary regex as the CDN tests.
 *   6. Fails with a detailed report: DOM path, offending text, matched
 *      forbidden word, and the approved social alternative.
 *
 * Skipping logic:
 *   - If USERNAME/PASSWORD are not set the test is skipped.
 *   - ALL-CAPS values are skipped (jackpot tier labels).
 */

import { test, expect, type Page }         from '@playwright/test';
import { GamePage }                        from '../src/page-objects/GamePage';
import { findViolations, FORBIDDEN_WORDS } from '../src/constants/social-language.constants';

// ── Config ────────────────────────────────────────────────────────────────────

const LAUNCHER_BASE = 'https://launcher.avocadospins.com';
const GAME_ID       = 'sands-of-fortune';

const SOCIAL_LOCALES = ['en_so', 'es_so', 'de_so'] as const;
type SocialLocale = typeof SOCIAL_LOCALES[number];

const LOCALE_LABELS: Record<SocialLocale, string> = {
  en_so: 'Social English',
  es_so: 'Social Spanish',
  de_so: 'Social German',
};

// ── Launcher auth & game URL ──────────────────────────────────────────────────

async function fetchJson<T>(url: string, opts: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Authenticate with the launcher and request a fresh game URL for the given
 * social locale. Mirrors the flow in global-setup.ts.
 */
async function getSocialGameUrl(locale: SocialLocale): Promise<string> {
  const username  = process.env['USERNAME'];
  const password  = process.env['PASSWORD'];
  const brandId   = process.env['GAME_BRAND_ID'] ?? 'tr';

  if (!username || !password) {
    throw new Error('USERNAME/PASSWORD not set in .env');
  }

  const { token } = await fetchJson<{ token: string }>(
    `${LAUNCHER_BASE}/api/auth/token`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    },
  );

  const { apiUrl } = await fetchJson<{ apiUrl: string }>(
    `${LAUNCHER_BASE}/conf/config.json`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  const { url } = await fetchJson<{ url: string }>(
    `${apiUrl}/game/url`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
        Accept:         'application/json, *.*',
      },
      body: JSON.stringify({
        gameId:     GAME_ID,
        mode:       'demo',
        currency:   'EUR',
        locale,
        brandId,
        playerId:   'player1',
        platform:   'web',
        lobbyUrl:   `${LAUNCHER_BASE}/`,
        minBet:     null,
        maxBet:     10_000,
        defaultBet: 1.0,
      }),
    },
  );

  return `${url}&mode=demo&locale=${locale}&et=${brandId}`;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

interface DomTextEntry {
  text: string;
  path: string;
}

interface ViolationReport {
  text:       string;
  path:       string;
  forbidden:  string;
  suggestion: string;
}

/**
 * Walk the DOM and return all visible text nodes with their element path.
 * Skips: script/style/noscript, hidden elements (display:none, visibility:hidden,
 * opacity:0), and strings shorter than 2 characters.
 */
async function extractVisibleText(page: Page): Promise<DomTextEntry[]> {
  return page.evaluate((): Array<{ text: string; path: string }> => {
    const results: Array<{ text: string; path: string }> = [];

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          const style = window.getComputedStyle(parent);
          if (
            style.display     === 'none'   ||
            style.visibility  === 'hidden' ||
            parseFloat(style.opacity) === 0
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.textContent?.trim() ?? '';
          if (!text) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim() ?? '';
      if (text.length < 2) continue;

      const parent = node.parentElement;
      const tag    = parent?.tagName.toLowerCase() ?? 'unknown';
      const id     = parent?.id ? `#${parent.id}` : '';
      const rawCls = parent?.className ?? '';
      const cls    = rawCls
        ? `.${rawCls.trim().split(/\s+/).join('.')}`
        : '';

      results.push({ text, path: `${tag}${id}${cls}` });
    }

    return results;
  });
}

function scanForViolations(entries: DomTextEntry[], locale: string): ViolationReport[] {
  const violations: ViolationReport[] = [];
  for (const entry of entries) {
    const matches = findViolations(entry.text, locale);
    for (const match of matches) {
      violations.push({
        text:       entry.text,
        path:       entry.path,
        forbidden:  match.word,
        suggestion: match.suggestion,
      });
    }
  }
  return violations;
}

function formatViolations(violations: ViolationReport[]): string {
  return violations
    .map(v =>
      `  PATH:        ${v.path}\n` +
      `  TEXT:        "${v.text}"\n` +
      `  FORBIDDEN:   "${v.forbidden}"\n` +
      `  USE INSTEAD: ${v.suggestion}`,
    )
    .join('\n\n');
}

// ── Test suites (one per locale) ──────────────────────────────────────────────

for (const locale of SOCIAL_LOCALES) {

  test.describe(`${LOCALE_LABELS[locale]} (${locale}) — DOM Hardcoded Text Scan`, () => {

    test('no forbidden RMG terms in main game UI', async ({ page }) => {
      if (!process.env['USERNAME'] || !process.env['PASSWORD']) {
        test.skip(true, 'USERNAME/PASSWORD not set in .env');
        return;
      }

      const gameUrl = await getSocialGameUrl(locale);
      const gamePage = new GamePage(page);
      await gamePage.load(gameUrl);

      const entries    = await extractVisibleText(page);
      const violations = scanForViolations(entries, locale);

      if (violations.length > 0) {
        console.error(
          `\n${locale} (main UI) — ${violations.length} forbidden RMG term(s) found in DOM:\n\n` +
          formatViolations(violations),
        );
      }

      expect(
        violations.length,
        `Found ${violations.length} forbidden RMG term(s) in ${locale} main UI DOM:\n\n` +
        formatViolations(violations),
      ).toBe(0);
    });

    test('no forbidden RMG terms in menu / paytable panel', async ({ page }) => {
      if (!process.env['USERNAME'] || !process.env['PASSWORD']) {
        test.skip(true, 'USERNAME/PASSWORD not set in .env');
        return;
      }

      const gameUrl  = await getSocialGameUrl(locale);
      const gamePage = new GamePage(page);
      await gamePage.load(gameUrl);

      // Open the menu to expose paytable / help / info text
      await gamePage.menuButton.click();
      await page.waitForTimeout(1_500);

      const entries    = await extractVisibleText(page);
      const violations = scanForViolations(entries, locale);

      if (violations.length > 0) {
        console.error(
          `\n${locale} (menu panel) — ${violations.length} forbidden RMG term(s) found in DOM:\n\n` +
          formatViolations(violations),
        );
      }

      expect(
        violations.length,
        `Found ${violations.length} forbidden RMG term(s) in ${locale} menu/paytable DOM:\n\n` +
        formatViolations(violations),
      ).toBe(0);
    });

  });

}

// ── Summary: all locales in one pass ─────────────────────────────────────────

test.describe('Social Language DOM — Full Compliance Summary', () => {

  test('scan all social locales and log DOM violation counts', async ({ page }) => {
    if (!process.env['USERNAME'] || !process.env['PASSWORD']) {
      test.skip(true, 'USERNAME/PASSWORD not set in .env');
      return;
    }

    const summary: Record<string, { mainViolations: number; menuViolations: number }> = {};

    for (const locale of SOCIAL_LOCALES) {
      const gameUrl  = await getSocialGameUrl(locale);
      const gamePage = new GamePage(page);
      await gamePage.load(gameUrl);

      const mainEntries = await extractVisibleText(page);
      const mainViol    = scanForViolations(mainEntries, locale);

      await gamePage.menuButton.click().catch(() => {});
      await page.waitForTimeout(1_500);

      const menuEntries = await extractVisibleText(page);
      const menuViol    = scanForViolations(menuEntries, locale);

      summary[locale] = {
        mainViolations: mainViol.length,
        menuViolations: menuViol.length,
      };

      await page.goto('about:blank');
    }

    console.log('\n══ Social Language DOM Compliance Report ══');
    for (const locale of SOCIAL_LOCALES) {
      const s = summary[locale];
      if (!s) continue;
      const total  = s.mainViolations + s.menuViolations;
      const status = total === 0 ? '✓ PASS' : `✗ FAIL (${total} violation(s))`;
      console.log(`\n${LOCALE_LABELS[locale]} (${locale}): ${status}`);
      console.log(`  Main UI violations:    ${s.mainViolations}`);
      console.log(`  Menu panel violations: ${s.menuViolations}`);
      console.log(`  Forbidden word entries checked: ${(FORBIDDEN_WORDS[locale] ?? []).length}`);
    }
    console.log('\n══════════════════════════════════════════');

    expect(true).toBe(true);
  });

});
