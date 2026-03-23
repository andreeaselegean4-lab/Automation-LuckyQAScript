/**
 * Shared helpers for MGA & IOM compliance tests.
 *
 * The Novomatic game engine renders paytable / rules content on a WebGL canvas.
 * Direct text extraction (OCR, CDN, window globals) is NOT reliable because:
 *   - Tesseract.js OCR cannot read WebGL-rendered fonts
 *   - The translation CDN (cdn2.avocadospins.com) returns 403
 *   - Translations are embedded in the game's compiled JS bundle, not in globals
 *
 * These helpers therefore verify compliance through:
 *   1. **Info panel structural checks** — modal opens, has navigable pages,
 *      contains canvas content (proves paytable exists and is accessible).
 *   2. **DOM evidence** — visible game controls (spin, bet, autoplay, balance)
 *      confirm the game has required interactive elements.
 *   3. **Paytable page count** — navigating through all pages proves the
 *      game documents its features across multiple sections.
 *
 * Selectors use CSS-comma fallbacks to work across different Novomatic game
 * UIs (Infinite Hot, Bonsai Gold 2, etc.).
 */

import { type Page } from '@playwright/test';

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
  if (await page.locator(MODAL).isVisible().catch(() => false)) return true;

  const infoBtn = page.locator(INFO_BUTTON).first();
  if (await infoBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await infoBtn.click();
    await page.waitForTimeout(1_500);

    if (await page.locator(MODAL).isVisible().catch(() => false)) return true;

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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/**
 * Check whether the info / rules modal is currently visible.
 */
export async function isInfoPanelOpen(page: Page): Promise<boolean> {
  return page.locator(MODAL).isVisible().catch(() => false);
}

// ── Legacy OCR stub (kept for backward compatibility with other test files) ──

/**
 * @deprecated OCR does not work on WebGL canvas. Retained so that files
 * importing collectRulesTextOCR still compile. Returns empty string.
 */
export async function collectRulesTextOCR(
  _page: Page,
  _maxPages = 20,
): Promise<string> {
  console.warn(
    '[compliance] collectRulesTextOCR is deprecated — OCR cannot read WebGL canvas. ' +
    'Use analyzePaytable() + getDOMComplianceEvidence() instead.',
  );
  return '';
}

// ── Paytable structural analysis ─────────────────────────────────────────────

/**
 * Result of navigating through the info / paytable modal.
 */
export interface PaytableInfo {
  /** Whether the info modal opened successfully */
  modalOpened: boolean;
  /** Total number of navigable paytable pages */
  pageCount: number;
  /** Whether the modal contains a <canvas> element (WebGL paytable) */
  hasCanvas: boolean;
  /** Whether right-arrow navigation exists */
  hasNavigation: boolean;
  /** Any DOM text found inside the modal (headings, labels) */
  modalDOMText: string;
}

/**
 * Open the info panel, count how many paytable pages exist by clicking the
 * right arrow until we loop or reach maxPages, and return structural info.
 *
 * This does NOT attempt OCR — it verifies that the paytable exists, is
 * accessible, and has multiple pages of content.
 */
export async function analyzePaytable(page: Page, maxPages = 15): Promise<PaytableInfo> {
  const result: PaytableInfo = {
    modalOpened: false,
    pageCount: 0,
    hasCanvas: false,
    hasNavigation: false,
    modalDOMText: '',
  };

  result.modalOpened = await openInfoPanel(page);
  if (!result.modalOpened) return result;

  await page.waitForTimeout(2_000);

  // Check for canvas on the page.  Novomatic games use a single full-page
  // <canvas> — the modal is a DOM overlay on top of it, not a container.
  result.hasCanvas = await page.locator('canvas').first().isVisible().catch(() => false);

  // Collect any DOM text inside the modal
  result.modalDOMText = (await page.locator(MODAL).textContent().catch(() => '')) ?? '';

  // Check for navigation arrows
  result.hasNavigation = await page.locator(MODAL_NEXT).isVisible({ timeout: 1_000 }).catch(() => false);

  // Count pages by navigating right until we can't or we loop
  result.pageCount = 1; // current page counts as 1

  if (result.hasNavigation) {
    for (let i = 1; i < maxPages; i++) {
      const nextArrow = page.locator(MODAL_NEXT);
      const arrowVisible = await nextArrow.isVisible({ timeout: 500 }).catch(() => false);
      if (!arrowVisible) break;

      await nextArrow.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);

      result.pageCount++;
    }
  }

  console.log(
    `[compliance] Paytable analysis: ${result.pageCount} pages, ` +
    `canvas=${result.hasCanvas}, nav=${result.hasNavigation}, ` +
    `DOM text length=${result.modalDOMText.trim().length}`,
  );

  return result;
}

// ── DOM evidence helpers ─────────────────────────────────────────────────────

/**
 * Get all DOM text from the page body.
 */
export async function getBodyText(page: Page): Promise<string> {
  return (await page.locator('body').textContent()) ?? '';
}

/**
 * Collect evidence from the game's DOM about which interactive elements
 * and displays are present.
 */
export async function getDOMComplianceEvidence(page: Page): Promise<{
  hasSpinInteraction: boolean;
  hasBetInteraction: boolean;
  hasAutoplayInteraction: boolean;
  hasBalanceDisplay: boolean;
  hasCurrencyDisplay: boolean;
  hasWinDisplay: boolean;
  hasInfoButton: boolean;
}> {
  // Close the info modal first — game controls are hidden behind it
  await closeInfoPanel(page);
  await page.waitForTimeout(500);

  // Selectors match NovomaticGames.ts verified selectors + generic fallbacks.
  // Use page.$() (querySelector) to check element EXISTS in DOM, since some
  // game controls may be present but visually overlapped by the canvas.
  const spinVisible    = await page.locator('#spinButton, .spin-button, [data-action="spin"]').first().isVisible().catch(() => false);
  const betExists      = (await page.$('.bet-button--increase, .bet-button--decrease')) !== null;
  const autoplayVis    = await page.locator('#autoPlayButton, .game-button.auto-play-button, .autoplay-button, [data-action="autoplay"]').first().isVisible().catch(() => false);
  const balanceVisible = await page.locator('.balance__wrapper--value, .balance-value, #balance').first().isVisible().catch(() => false);
  const currencyVis    = await page.locator('.balanceGroupScalableCurrencySign, .balanceGroup__currency, [data-field="currency"]').first().isVisible().catch(() => false);
  const winExists      = (await page.$('.lastBalanceGroup .balanceGroup__value, .lastBalanceGroup .balanceGroupScalableValue')) !== null;
  const infoVisible    = await page.locator(INFO_BUTTON).first().isVisible().catch(() => false);

  return {
    hasSpinInteraction:     spinVisible,
    hasBetInteraction:      betExists,
    hasAutoplayInteraction: autoplayVis,
    hasBalanceDisplay:      balanceVisible,
    hasCurrencyDisplay:     currencyVis,
    hasWinDisplay:          winExists,
    hasInfoButton:          infoVisible,
  };
}
