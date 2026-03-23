/**
 * Shared helpers for MGA & IOM compliance tests.
 *
 * The Novomatic game engine renders paytable / rules content on a WebGL canvas,
 * NOT as HTML text nodes.  Direct OCR of the canvas is unreliable because
 * Tesseract.js cannot read WebGL-rendered fonts accurately.
 *
 * Instead, these helpers use THREE data sources (in priority order):
 *
 *   1. **Translation CDN** — the game's own translation JS files contain ALL
 *      paytable and rules text (the same text rendered on canvas).
 *      URL pattern: https://cdn2.avocadospins.com/tr/cms/latest/<gameId>.<locale>.js
 *
 *   2. **DOM evidence** — visible game controls (spin, bet, autoplay, balance)
 *      prove the game has the required interactive elements.
 *
 *   3. **Info panel structural checks** — the modal opens, has navigation arrows,
 *      and contains multiple pages (proves the paytable exists and is accessible).
 *
 * Selectors are written with CSS-comma fallbacks so they work across different
 * Novomatic game UIs (Infinite Hot, Bonsai Gold 2, etc.).
 */

import { type Page } from '@playwright/test';
import {
  fetchTranslationFile,
  parseTranslationContent,
  translationCdnUrl,
  type TranslationMap,
} from '../../../src/utils/translationFetcher';

// ── Info-panel selectors ─────────────────────────────────────────────────────

/** The (i) / menu button that opens the rules modal */
export const INFO_BUTTON =
  '.game-button.menu-button, .hamburger-button, #infoButton, .info-button, [data-action="info"]';

/** The modal wrapper that appears when rules are open */
export const MODAL = '.modal';

/** Close (×) button inside the modal */
export const MODAL_CLOSE = '.modal-button.modal-button--close';

/** Right arrow — navigate to next paytable page */
export const MODAL_NEXT = '.modal-right-container .arrow';

/** Left arrow — navigate to previous paytable page */
export const MODAL_PREV = '.modal-left-container .arrow';

/** Clock display */
export const CLOCK = '.digitalClock, .clock, .time-display, [data-field="clock"]';

/** Currency sign in top bar */
export const CURRENCY_SIGN =
  '.balanceGroupScalableCurrencySign, .balanceGroup__currency, [data-field="currency"]';

// ── Info panel helpers ───────────────────────────────────────────────────────

/**
 * Open the rules / info modal.
 * Handles both single-click (i) buttons (Bonsai Gold 2) and
 * two-step hamburger → Info flows (Infinite Hot).
 *
 * Returns `true` if the modal is now visible.
 */
export async function openInfoPanel(page: Page): Promise<boolean> {
  // If modal is already open, return immediately
  if (await page.locator(MODAL).isVisible().catch(() => false)) return true;

  // Try the direct (i) / info button
  const infoBtn = page.locator(INFO_BUTTON).first();
  if (await infoBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await infoBtn.click();
    await page.waitForTimeout(1_500);

    // Check if modal appeared
    if (await page.locator(MODAL).isVisible().catch(() => false)) return true;

    // Some games open a sub-menu first — look for "Info" / "Rules" / "Paytable" link
    const subItem = page.locator(
      ':text-is("Info"), :text-is("Rules"), :text-is("Paytable"), [data-action="info"], [data-action="rules"]',
    );
    if (await subItem.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await subItem.first().click();
      await page.waitForTimeout(1_500);
    }
  }

  return page.locator(MODAL).isVisible().catch(() => false);
}

/**
 * Close the rules / info modal.
 */
export async function closeInfoPanel(page: Page): Promise<void> {
  const closeBtn = page.locator(MODAL_CLOSE);
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
    return;
  }
  // Fallback: press Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/**
 * Check whether the info / rules modal is currently visible.
 */
export async function isInfoPanelOpen(page: Page): Promise<boolean> {
  return page.locator(MODAL).isVisible().catch(() => false);
}

// ── Translation-based text extraction ────────────────────────────────────────

/**
 * Fetch the game's translation file from CDN and return all values joined
 * into a single searchable string.  This is the PRIMARY source of paytable /
 * rules text — the same text the game renders on the WebGL canvas.
 *
 * @param page     Playwright Page (game must be loaded — fetch runs in browser context)
 * @param gameId   Game identifier (e.g. "bonsai-gold-2")
 * @param locale   Locale code (default "en")
 * @returns        Combined text of all translation values, or '' if fetch fails
 */
export async function collectRulesFromTranslation(
  page: Page,
  gameId: string,
  locale = 'en',
): Promise<{ text: string; map: TranslationMap }> {
  // Strategy 1: fetch via the browser context (page.evaluate + fetch)
  let result = await fetchTranslationFile(page, gameId, locale);

  // Strategy 2: if browser fetch failed (CORS / CSP), try Playwright's request context
  // which runs in Node.js and is not subject to browser security restrictions.
  if (!result.ok || !result.content) {
    console.log(
      `[compliance] Browser-context fetch failed (${result.status} ${result.error ?? ''}). ` +
      `Trying Node.js fetch via Playwright request context…`,
    );
    try {
      const url = translationCdnUrl(gameId, locale);
      const apiCtx = page.context().request;
      const response = await apiCtx.get(url);
      if (response.ok()) {
        result = { ok: true, status: response.status(), content: await response.text() };
      } else {
        console.log(`[compliance] Playwright request context also failed: ${response.status()}`);
      }
    } catch (err) {
      console.log(`[compliance] Playwright request context error: ${err}`);
    }
  }

  // Strategy 3: if both above failed, try Node.js native fetch (Node 18+)
  if (!result.ok || !result.content) {
    console.log('[compliance] Trying Node.js native fetch…');
    try {
      const url = translationCdnUrl(gameId, locale);
      const res = await fetch(url);
      if (res.ok) {
        result = { ok: true, status: res.status, content: await res.text() };
      } else {
        console.log(`[compliance] Node.js fetch also failed: ${res.status}`);
      }
    } catch (err) {
      console.log(`[compliance] Node.js fetch error: ${err}`);
    }
  }

  if (!result.ok || !result.content) {
    console.log('[compliance] All translation fetch strategies failed.');
    return { text: '', map: {} };
  }

  const map = parseTranslationContent(result.content);
  const text = Object.values(map).join(' ');

  console.log(
    `[compliance] Translation loaded: ${Object.keys(map).length} keys, ` +
    `${text.length} chars total. Sample keys: ${Object.keys(map).slice(0, 8).join(', ')}`,
  );

  return { text, map };
}

// ── DOM evidence helpers ─────────────────────────────────────────────────────

/**
 * Get all DOM text from the page body.
 * Useful for checking elements rendered as HTML (balance, bet, clock, etc.).
 * Does NOT capture canvas-rendered text.
 */
export async function getBodyText(page: Page): Promise<string> {
  return (await page.locator('body').textContent()) ?? '';
}

/**
 * Collect supplemental evidence from the game's DOM to confirm that the game
 * has documented interactions / configuration.  This is used alongside
 * translation text when verifying compliance.
 *
 * Returns an object with boolean flags for each compliance category.
 */
export async function getDOMComplianceEvidence(page: Page): Promise<{
  hasSpinInteraction: boolean;
  hasBetInteraction: boolean;
  hasAutoplayInteraction: boolean;
  hasBalanceDisplay: boolean;
  hasCurrencyDisplay: boolean;
  hasWinDisplay: boolean;
  hasInfoModal: boolean;
}> {
  const spinVisible    = await page.locator('#spinButton, .spin-button, [data-action="spin"]').isVisible().catch(() => false);
  const betVisible     = await page.locator('.bet-increase, .bet-decrease, .betIncrease, .betDecrease, #betIncrease, #betDecrease').isVisible().catch(() => false);
  const autoplayVis    = await page.locator('.autoplay-button, #autoplayButton, [data-action="autoplay"]').isVisible().catch(() => false);
  const balanceVisible = await page.locator('.balance__wrapper--value, .balance-value, #balance').isVisible().catch(() => false);
  const currencyVis    = await page.locator('.balanceGroupScalableCurrencySign, .currency, [data-field="currency"]').isVisible().catch(() => false);
  const winVisible     = await page.locator('.win, .win-display, #winAmount, .winValue').isVisible().catch(() => false);
  const modalOpen      = await page.locator(MODAL).isVisible().catch(() => false);

  return {
    hasSpinInteraction:   spinVisible,
    hasBetInteraction:    betVisible,
    hasAutoplayInteraction: autoplayVis,
    hasBalanceDisplay:    balanceVisible,
    hasCurrencyDisplay:   currencyVis,
    hasWinDisplay:        winVisible,
    hasInfoModal:         modalOpen,
  };
}
