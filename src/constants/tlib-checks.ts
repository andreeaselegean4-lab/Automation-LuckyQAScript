/**
 * MGA & IOM TLIB Test Case IDs mapped to categories.
 * Source: 202508_MGA-IOM-Test-Sets_Client.xlsx
 */
export const TLIB = {
  // ─── UI / Display ─────────────────────────────────────────────────
  FREE_TO_PLAY_SAME_RULES:   'TLIB-23',
  CLOCK_VISIBLE:             'TLIB-27',
  TEXTS_TRANSLATED:          'TLIB-79',
  BALANCE_VISIBLE:           'TLIB-87',
  CURRENCY_CLEAR:            'TLIB-178',
  BALANCE_BET_DENOMINATION:  'TLIB-179',
  GAME_NAME_VISIBLE:         'TLIB-71',   // IOM
  STAKES_DISPLAYED:          'TLIB-180',  // IOM

  // ─── Rules Accessibility ──────────────────────────────────────────
  RULES_MATCH_SOURCE:        'TLIB-335',
  RULES_EASY_ACCESS:         'TLIB-339',
  RULES_ALWAYS_ACCESSIBLE:   'TLIB-340',
  RULES_NO_BET_REQUIRED:     'TLIB-341',

  // ─── Rules Content ────────────────────────────────────────────────
  RTP_DISPLAYED:             'TLIB-343',
  WIN_CALC_EXPLAINED:        'TLIB-345',
  INTERACTIONS_EXPLAINED:    'TLIB-348',
  WIN_AFFECTING_EXPLAINED:   'TLIB-351',
  STATES_OUTCOMES_EXPLAINED: 'TLIB-352',
  TIME_CRITICAL_EVENTS:      'TLIB-334',  // IOM
  MAX_WIN_MULTIPLIER:        'TLIB-344',  // IOM
  PAYOUT_DIRECTION:          'TLIB-346',  // IOM
  BET_PLACEMENT_EXPLAINED:   'TLIB-347',  // IOM

  // ─── Gameplay ─────────────────────────────────────────────────────
  MOBILE_VIEW:               'TLIB-382',
  BALANCE_REFLECTS_BET:      'TLIB-470',
  EXIT_FULLSCREEN:           'TLIB-609',

  // ─── Recovery (IOM) ───────────────────────────────────────────────
  RESTORE_FAILED_ROUND:      'TLIB-25',
  CONTINUE_INCOMPLETE:       'TLIB-26',
  DEVICE_INDEPENDENT:        'TLIB-56',

  // ─── Jackpot ──────────────────────────────────────────────────────
  JACKPOT_WIN_EXPLAINED:     'TLIB-370',
  JACKPOT_RTP:               'TLIB-371',  // IOM
  JACKPOT_LIMITS:            'TLIB-511',  // IOM
} as const;
