/**
 * selectors.ts
 *
 * Defines the GameSelectors interface and loads the correct selector set
 * based on the ENV environment variable.
 *
 * Usage:
 *   ENV=ToucanRoyale   npx playwright test  →  loads selectors/ToucanRoyale.ts
 *   ENV=NovomaticGames npx playwright test  →  loads selectors/NovomaticGames.ts
 */

import { TOUCAN_ROYALE_SELECTORS }    from './selectors/ToucanRoyale';
import { NOVOMATIC_GAMES_SELECTORS }  from './selectors/NovomaticGames';

export interface GameSelectors {
  // ── DOM element selectors (CSS) ──────────────────────────────────────────
  spinButton:        string;
  autoplayButton:    string;
  menuButton:        string;
  turboButton:       string;
  betIncrease:       string;
  betDecrease:       string;
  betValue:          string;
  balanceDisplay:    string;
  lastWinDisplay:    string;
  loadingScreen:     string;
  loadingScreenReady: string;

  // ── CSS class fragments (used in class-based state checks) ───────────────
  /** Class present on spin button while a spin is in progress (stop icon showing) */
  classSpinStop:        string;
  /** Class present on spin button when idle/enabled */
  classSpinEnabled:     string;
  /** Class present on spin button when disabled */
  classSpinDisabled:    string;
  /** Class present on turbo button when turbo/fast mode is active */
  classTurboActive:     string;
  /** Class present on turbo button when in regular (non-turbo) mode */
  classTurboRegular:    string;
  /** Class present on bet controls when enabled */
  classControlEnabled:  string;
  /** Class present on bet controls when disabled */
  classControlDisabled: string;
}

const SELECTOR_MAP: Record<string, GameSelectors> = {
  ToucanRoyale:    TOUCAN_ROYALE_SELECTORS,
  NovomaticGames:  NOVOMATIC_GAMES_SELECTORS,
};

export function loadSelectors(): GameSelectors {
  const env = process.env['ENV'] ?? 'NovomaticGames';
  return SELECTOR_MAP[env] ?? NOVOMATIC_GAMES_SELECTORS;
}
