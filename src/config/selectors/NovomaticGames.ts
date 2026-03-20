import type { GameSelectors } from '../selectors';

// ── NovomaticGames selectors ────────────────────────────────────────────────
// Verified against live DOM for:
//   - Infinite Hot (original)
//   - Bonsai Gold 2: Age of Prosperity
// Uses CSS comma fallbacks so the same selector set works across different
// Novomatic game UIs on the avocadospins launcher.

export const NOVOMATIC_GAMES_SELECTORS: GameSelectors = {
  // DOM selectors — comma-separated fallbacks for cross-game compatibility
  spinButton:         '#spinButton',
  autoplayButton:     '#autoPlayButton, .game-button.auto-play-button',
  menuButton:         '.hamburger-button, .game-button.menu-button',
  // Turbo button cycles through play-button--regular/medium/fast; match all states
  turboButton:        '[class*="play-button--"]',
  betIncrease:        '.bet-button--increase',
  betDecrease:        '.bet-button--decrease',
  betValue:           '.bet-button-text--value, .bet-button-text',
  balanceDisplay:     '.balance__wrapper--value',
  // Last win lives inside .lastBalanceGroup in the top bar
  lastWinDisplay:     '.lastBalanceGroup .balanceGroup__value, .lastBalanceGroup .balanceGroupScalableValue',
  loadingScreen:      '.loading-screen',
  loadingScreenReady: '.loading-screen.ready',

  // Class fragments
  // NovomaticGames spin button gets 'spin-stop-button' while a spin is in progress
  // (the button stays 'enabled' — it acts as a stop button, not a disabled one)
  classSpinStop:        'spin-stop-button',
  classSpinEnabled:     'enabled',
  classSpinDisabled:    'disabled',
  classTurboActive:     'play-button--fast',
  classTurboRegular:    'play-button--regular',
  classControlEnabled:  'enabled',
  classControlDisabled: 'disabled',
};
