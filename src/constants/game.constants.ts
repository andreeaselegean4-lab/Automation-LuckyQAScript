/**
 * game.constants.ts
 *
 * All game-specific constants for Bonsai Gold 2: Age of Prosperity
 * Engine: et=ng  |  API: POST /demoplay  |  Grid: 5 reels × 3 rows
 *
 * Sources:
 *   - Live API inspection (network capture of real /demoplay responses)
 *   - Live DOM inspection (CSS selectors, UI elements)
 */

// ── Game Identity ─────────────────────────────────────────────────────────────

export const GAME_ID       = 'bonsai-gold-2';
export const GAME_BRAND_ID = '95';   // default brand — see RTP_BRAND_MAP below
export const GAME_NAME     = 'Bonsai Gold 2: Age of Prosperity';

// ── RTP Brand Configuration ───────────────────────────────────────────────────

/**
 * Maps the numeric Brand ID (used as `brandId` in the launcher API and JWT)
 * to its corresponding theoretical RTP percentage.
 *
 * To run compliance tests for a specific RTP, set GAME_BRAND_ID in .env:
 *   GAME_BRAND_ID=90  → tests the 90.0% RTP variant
 *   GAME_BRAND_ID=93  → tests the 92.5% RTP variant
 *   GAME_BRAND_ID=94  → tests the 94.0% RTP variant
 *   GAME_BRAND_ID=95  → tests the 95.0% RTP variant (default)
 */
export const RTP_BRAND_MAP: Record<string, number> = {
  '90': 90.0,
  '93': 92.5,
  '94': 94.0,
  '95': 95.0,
};

// ── API ───────────────────────────────────────────────────────────────────────

/** Path fragment matched in every demoplay network request */
export const SPIN_API_PATH = '/demoplay';

// ── Grid dimensions ───────────────────────────────────────────────────────────

export const REELS = 5;
export const ROWS  = 3;

// ── Symbols ───────────────────────────────────────────────────────────────────

/**
 * Symbol ID → name map.
 * Negative key -11 (STICKY) is valid in JS and returned by Object.keys() as '-11'.
 *
 * From ResponseAdapter.js:
 *   WILD    = 9
 *   COIN    = 10   (CHEST that triggers Hold & Win)
 *   STICKY  = -11  (locked coin symbol during respins)
 *   SCATTER = 11
 */
export const SYMBOLS: Record<number, string> = {
  0:   'BLANK',
  1:   'SYMBOL_1',
  2:   'SYMBOL_2',
  3:   'SYMBOL_3',
  4:   'SYMBOL_4',
  5:   'SYMBOL_5',
  6:   'SYMBOL_6',
  7:   'SYMBOL_7',
  8:   'SYMBOL_8',
  9:   'WILD',
  10:  'COIN',
  11:  'SCATTER',
  [-11]: 'STICKY',
};

/** All valid symbol IDs as a Set for fast membership checks */
export const VALID_SYMBOL_IDS = new Set(Object.keys(SYMBOLS).map(Number));

// ── Paylines ──────────────────────────────────────────────────────────────────

/**
 * Standard paylines for the 5×3 grid.
 * Each entry is an array of row indices (0=top, 1=mid, 2=bottom), one per reel.
 * win.line in API responses uses the same format.
 */
export const PAYLINES: readonly number[][] = [
  [1, 1, 1, 1, 1], // L1 — middle row
  [0, 0, 0, 0, 0], // L2 — top row
  [2, 2, 2, 2, 2], // L3 — bottom row
  [0, 1, 2, 1, 0], // L4 — V-shape down
  [2, 1, 0, 1, 2], // L5 — V-shape up
  [0, 0, 1, 2, 2], // L6 — diagonal down-right
  [2, 2, 1, 0, 0], // L7 — diagonal up-right
  [0, 1, 1, 1, 0], // L8 — zigzag low
  [2, 1, 1, 1, 2], // L9 — zigzag high
  [1, 0, 1, 2, 1], // L10
  [1, 2, 1, 0, 1], // L11
  [0, 1, 0, 1, 0], // L12
  [2, 1, 2, 1, 2], // L13
  [1, 0, 0, 0, 1], // L14
  [1, 2, 2, 2, 1], // L15
  [0, 0, 1, 0, 0], // L16
  [2, 2, 1, 2, 2], // L17
  [0, 1, 2, 2, 2], // L18
  [2, 1, 0, 0, 0], // L19
  [1, 1, 0, 1, 1], // L20
];

// ── Hold & Win (Coin Game) ────────────────────────────────────────────────────

/**
 * The COIN/CHEST symbol that fills the grid in the base game.
 * 6+ of these on the grid triggers the Hold & Win bonus.
 * From ResponseAdapter.js: COIN = 10
 */
export const COLLECTOR_COIN = 10;

/**
 * Symbol IDs that represent prize coins in the Hold & Win game.
 * These are the same as COIN (10) — jackpot is determined by server value.
 */
export const PRIZE_COIN_LIST: readonly number[] = [10];

/**
 * Number of coin symbols needed to unlock each jackpot tier.
 * [0-coin baseline, 1-coin entry, 15-coin MINI, 30-coin MAJOR, 50-coin GRAND]
 */
export const COLLECTION_THRESHOLDS: readonly number[] = [0, 1, 15, 30, 50];

// ── Jackpots ──────────────────────────────────────────────────────────────────

export const JACKPOTS = {
  MINI:  { name: 'MINI',  multiplier: 25   },
  MINOR: { name: 'MINOR', multiplier: 50   },
  MAJOR: { name: 'MAJOR', multiplier: 250  },
  GRAND: { name: 'GRAND', multiplier: 5000 },
} as const;

// ── Free Spins ────────────────────────────────────────────────────────────────

/** Minimum SCATTER symbols to trigger free spins */
export const FREE_SPINS_TRIGGER_COUNT = 3;

/** Free spin awards for 3 / 4 / 5 scatters */
export const FREE_SPINS_AWARDS: readonly number[] = [10, 12, 15];

// ── Turbo / FastPlay ──────────────────────────────────────────────────────────

/** Animation speed multiplier in turbo mode (from FastPlay.js) */
export const TURBO_TIME_SCALE = 1.5;

// ── Debug Trigger Names ───────────────────────────────────────────────────────

/**
 * Scenario names from stub.js — only available when GAME_URL_DEBUG is used.
 * These map to deterministic RNG seeds that produce specific outcomes.
 */
export const DEBUG_TRIGGERS = {
  COIN_BONUS:            'coin bonus',
  FREE_GAMES:            'free games',
  REGULAR_WIN:           'regular win',
  GRAND_JACKPOT:         'grand-jackpot',
  MAJOR_JACKPOT:         'major-jackpot',
  MINOR_JACKPOT:         'minor-jackpot',
  MINI_JACKPOT:          'mini-jackpot',
  BIG_WIN:               'coin bonus with one mini game',
  BONUS_WITH_PAYLINE:    'regular win + coin bonus',
  ALL_JACKPOTS_IN_FREE:  'free games with all wins',
  NEAR_MISS:             'anticipation',
} as const;

export type DebugTrigger = typeof DEBUG_TRIGGERS[keyof typeof DEBUG_TRIGGERS];
