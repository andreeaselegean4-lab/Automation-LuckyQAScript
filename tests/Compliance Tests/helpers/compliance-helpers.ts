/**
 * Shared helpers for MGA & IOM compliance tests.
 *
 * The Novomatic game engine renders paytable / rules content on a WebGL canvas,
 * NOT as HTML text nodes.  These helpers handle:
 *
 *   1. Opening / closing the info (rules) modal via DOM buttons
 *   2. Navigating through paytable pages (left / right arrows)
 *   3. Extracting visible text from each page via Tesseract.js OCR
 *
 * Selectors are written with CSS-comma fallbacks so they work across different
 * Novomatic game UIs (Infinite Hot, Bonsai Gold 2, etc.).
 */

import { type Page } from '@playwright/test';
import { createWorker, type Worker as TessWorker } from 'tesseract.js';

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

// ── OCR text extraction ──────────────────────────────────────────────────────

/**
 * Open the info panel, screenshot every paytable page, OCR each screenshot,
 * and return the combined text of all pages.
 *
 * @param page       Playwright Page (game must be loaded and idle)
 * @param maxPages   Maximum number of pages to navigate (safety limit)
 * @returns          Combined OCR text from all paytable pages
 */
export async function collectRulesTextOCR(
  page: Page,
  maxPages = 15,
): Promise<string> {
  // Make sure the info panel is open
  const opened = await openInfoPanel(page);
  if (!opened) return '';

  // Wait a bit for the first page to render on canvas
  await page.waitForTimeout(2_000);

  let worker: TessWorker | null = null;
  let fullText = '';

  try {
    worker = await createWorker('eng');

    for (let i = 0; i < maxPages; i++) {
      // Screenshot the whole viewport (canvas + DOM overlay)
      const buffer = await page.screenshot();
      const { data } = await worker.recognize(buffer);

      const pageText = data.text
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length >= 2)
        .join(' ');

      fullText += ' ' + pageText;

      // Try to navigate to next page
      const nextArrow = page.locator(MODAL_NEXT);
      const arrowVisible = await nextArrow.isVisible({ timeout: 1_000 }).catch(() => false);
      if (!arrowVisible) break;

      // Check if the arrow is interactive (some pages disable it at the end)
      const arrowClass = (await nextArrow.getAttribute('class').catch(() => '')) ?? '';
      if (!arrowClass.includes('interactive') && !arrowClass.includes('enabled')) {
        // Arrow exists but is not clickable — we've reached the last page
        break;
      }

      await nextArrow.click();
      await page.waitForTimeout(1_500);
    }
  } finally {
    if (worker) await worker.terminate();
  }

  return fullText;
}

/**
 * Get all DOM text from the page body.
 * Useful for checking elements rendered as HTML (balance, bet, clock, etc.).
 * Does NOT capture canvas-rendered text.
 */
export async function getBodyText(page: Page): Promise<string> {
  return (await page.locator('body').textContent()) ?? '';
}
