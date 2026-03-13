import type { GameSelectors } from '../selectors';

// ── NovomaticGames selectors — verified against live DOM (Infinite Hot) ───────
// Inspected via: https://gs.avocadospins.com (demo launcher)

export const NOVOMATIC_GAMES_SELECTORS: GameSelectors = {
  // DOM selectors
  spinButton:         '#spinButton',
  // NovomaticGames uses capital-P: id="autoPlayButton"
  autoplayButton:     '#autoPlayButton',
  menuButton:         '#menuButton',
  // Turbo button cycles through play-button--regular/medium/fast; match all states
  turboButton:        '[class*="play-button--"]',
  betIncrease:        '.bet-button--increase',
  betDecrease:        '.bet-button--decrease',
  betValue:           '.bet-button-text--value',
  balanceDisplay:     '.balance__wrapper--value',
  // Last win lives inside .lastBalanceGroup in the top bar
  lastWinDisplay:     '.lastBalanceGroup .balanceGroup__value',
  loadingScreen:      '.loading-screen',
  loadingScreenReady: '.loading-screen.ready',

  // Class fragments
  // NovomaticGames has no separate "stop" icon — the spin button just gets
  // 'disabled' while a spin is in progress, so classSpinStop === classSpinDisabled
  classSpinStop:        'disabled',
  classSpinEnabled:     'enabled',
  classSpinDisabled:    'disabled',
  classTurboActive:     'play-button--fast',
  classTurboRegular:    'play-button--regular',
  classControlEnabled:  'enabled',
  classControlDisabled: 'disabled',
};
