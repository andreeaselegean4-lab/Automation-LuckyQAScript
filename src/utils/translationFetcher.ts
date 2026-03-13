/**
 * translationFetcher.ts
 *
 * Fetches and parses translation files from the Avocado Spins CDN.
 *
 * CDN URL pattern:
 *   https://cdn2.avocadospins.com/tr/cms/latest/<gameId>.<locale>.js
 *
 * Translation files are JS scripts that expose key-value pairs in one of
 * several formats (varies by game/build):
 *   1. window.__translations = { ... }
 *   2. module.exports = { ... }
 *   3. Loose key:"value" pairs
 *
 * All fetching is done via page.evaluate() (inside the browser) to ensure
 * proxy and CORS rules match the real game environment.
 */

import type { Page } from '@playwright/test';

const CDN_BASE = 'https://cdn2.avocadospins.com/tr/cms/latest';

export interface TranslationFetchResult {
  ok:      boolean;
  status:  number;
  content: string;
  error?:  string;
}

export type TranslationMap = Record<string, string>;

// ── CDN fetch ─────────────────────────────────────────────────────────────────

/**
 * Build the CDN URL for a given game + locale combination.
 */
export function translationCdnUrl(gameId: string, locale: string): string {
  return `${CDN_BASE}/${gameId}.${locale}.js`;
}

/**
 * Fetch a translation JS file via the browser's fetch API.
 * Running inside page.evaluate() bypasses server-side proxy restrictions.
 */
export async function fetchTranslationFile(
  page: Page,
  gameId: string,
  locale: string,
): Promise<TranslationFetchResult> {
  const url = translationCdnUrl(gameId, locale);

  return page.evaluate(async (cdnUrl: string) => {
    try {
      const res = await fetch(cdnUrl, { cache: 'no-store' });
      const text = await res.text();
      return { ok: res.ok, status: res.status, content: text };
    } catch (err) {
      return {
        ok:      false,
        status:  0,
        content: '',
        error:   String(err),
      };
    }
  }, url);
}

// ── Translation file parser ───────────────────────────────────────────────────

/**
 * Flatten a nested object to a flat Record<string, string> using dot-notation keys.
 * Only string leaf values are included.
 */
function flattenObject(obj: unknown, prefix = ''): TranslationMap {
  const result: TranslationMap = {};

  if (typeof obj !== 'object' || obj === null) return result;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value, fullKey));
    }
  }

  return result;
}

/**
 * Parse a translation JS file content into a flat key→value map.
 *
 * Tries three strategies in order:
 *   1. JSON extraction — find the first {...} block and parse it
 *   2. Key-value regex — extract "key":"value" / key: "value" pairs
 *   3. Returns empty map if all strategies fail
 */
export function parseTranslationContent(content: string): TranslationMap {
  if (!content || content.trim().length === 0) return {};

  // Strategy 1 — extract first balanced JSON object
  try {
    const jsonMatch = content.match(/(\{[\s\S]*\})/);
    if (jsonMatch?.[1]) {
      const parsed = JSON.parse(jsonMatch[1]) as unknown;
      const flat = flattenObject(parsed);
      if (Object.keys(flat).length > 0) return flat;
    }
  } catch { /* fall through */ }

  // Strategy 2 — regex key-value extraction
  try {
    const map: TranslationMap = {};
    // Matches: "key":"value"  or  "key": "value"  or  key: "value"
    const kvRegex = /["']?([\w.]+)["']?\s*:\s*["']((?:[^"'\\]|\\.)*)["']/g;
    let match: RegExpExecArray | null;
    while ((match = kvRegex.exec(content)) !== null) {
      const [, key, value] = match;
      if (key && value !== undefined) {
        map[key] = value.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\'/g, "'").replace(/\\"/g, '"');
      }
    }
    if (Object.keys(map).length > 0) return map;
  } catch { /* fall through */ }

  return {};
}
