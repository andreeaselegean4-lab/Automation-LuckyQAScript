import type { GameSelectors } from '../selectors';

export const TOUCAN_ROYALE_SELECTORS: GameSelectors = {
  // DOM selectors
  spinButton:         '#spinButton',
  autoplayButton:     '#autoplayButton',
  menuButton:         '#menuButton',
  turboButton:        '.fastplay-button',
  betIncrease:        '.bet-button--increase',
  betDecrease:        '.bet-button--decrease',
  betValue:           '.bet-value',
  balanceDisplay:     '.balance-value',
  lastWinDisplay:     '.win-value',
  loadingScreen:      '.loading-screen',
  loadingScreenReady: '.loading-screen.ready',

  // Class fragments
  classSpinStop:        'image-stop-spin-button',
  classSpinEnabled:     'enabled',
  classSpinDisabled:    'disabled',
  classTurboActive:     'play-button--fast',
  classTurboRegular:    'play-button--regular',
  classControlEnabled:  'enabled',
  classControlDisabled: 'disabled',
};
