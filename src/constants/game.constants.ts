/**
 * game.constants.ts
 *
 * All game-specific constants for Coins of Fate
 * Engine: et=ng  |  API: POST /demoplay  |  Grid: 5 reels × 3 rows
 *
 * Sources:
 *   - Live paytable inspection (6 pages)
 *   - Live DOM inspection (CSS selectors, UI elements)
 *
 * Features:
 *   - Mystery Coin: flips to reveal a mystery symbol
 *   - Mega Coin: 3×3 symbol, guarantees wins
 *   - Statue Feature: awakened statues improve coins for bigger wins
 *   - Both-ways pay (left-to-right AND right-to-left)
 *   - NO jackpots, NO free spins, NO WILD, NO SCATTER
 */

// ── Game Identity ─────────────────────────────────────────────────────────────

export const GAME_ID       = 'coins-of-fate';
export const GAME_BRAND_ID = '95';   // default brand — see RTP_BRAND_MAP below
export const GAME_NAME     = 'Coins of Fate';

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
 * Symbol ID → name map for Coins of Fate.
 *
 * 9 regular symbols + 2 special coin symbols:
 *   CLEOPATRA (highest), HORUS, SCARAB, ANKH — themed symbols
 *   A, K, Q, J, TEN — card symbols (lowest)
 *   MYSTERY_COIN — flips to reveal a mystery symbol
 *   MEGA_COIN — 3×3 oversized coin, guarantees wins
 *
 * No WILD, no SCATTER in this game.
 */
export const SYMBOLS: Record<number, string> = {
  0:  'BLANK',
  1:  'CLEOPATRA',
  2:  'HORUS',
  3:  'SCARAB',
  4:  'ANKH',
  5:  'A',
  6:  'K',
  7:  'Q',
  8:  'J',
  9:  'TEN',
  10: 'MYSTERY_COIN',
  11: 'MEGA_COIN',
};

/** All valid symbol IDs as a Set for fast membership checks */
export const VALID_SYMBOL_IDS = new Set(Object.keys(SYMBOLS).map(Number));

// ── Paylines ──────────────────────────────────────────────────────────────────

/**
 * 10 paylines for the 5×3 grid (both-ways pay).
 * Each entry is an array of row indices (0=top, 1=mid, 2=bottom), one per reel.
 */
export const PAYLINES: readonly number[][] = [
  [1, 1, 1, 1, 1], // L1  — middle row
  [0, 0, 0, 0, 0], // L2  — top row
  [2, 2, 2, 2, 2], // L3  — bottom row
  [0, 1, 2, 1, 0], // L4  — V-shape down
  [2, 1, 0, 1, 2], // L5  — V-shape up
  [0, 0, 1, 2, 2], // L6  — diagonal down-right
  [2, 2, 1, 0, 0], // L7  — diagonal up-right
  [0, 1, 1, 1, 0], // L8  — zigzag low
  [2, 1, 1, 1, 2], // L9  — zigzag high
  [1, 0, 1, 2, 1], // L10 — wave
];

// ── Hold & Win (Coin Game) ────────────────────────────────────────────────────

/**
 * Mystery Coin symbol — triggers the coin feature.
 */
export const COLLECTOR_COIN = 10;

/**
 * Symbol IDs that represent prize coins.
 * MYSTERY_COIN (10) and MEGA_COIN (11).
 */
export const PRIZE_COIN_LIST: readonly number[] = [10, 11];

/**
 * Collection thresholds (if applicable).
 * Coins of Fate uses statue-based progression, not tier thresholds.
 */
export const COLLECTION_THRESHOLDS: readonly number[] = [];

// ── Jackpots ──────────────────────────────────────────────────────────────────

/**
 * Coins of Fate has NO jackpot tiers.
 * Empty object — jackpot tests will be skipped automatically.
 */
export const JACKPOTS: Record<string, { name: string; multiplier: number }> = {};

// ── Free Spins ────────────────────────────────────────────────────────────────

/**
 * Coins of Fate has NO free spins mechanic.
 */
export const FREE_SPINS_TRIGGER_COUNT = 0;
export const FREE_SPINS_AWARDS: readonly number[] = [];

// ── Turbo / FastPlay ──────────────────────────────────────────────────────────

/** Animation speed multiplier in turbo mode */
export const TURBO_TIME_SCALE = 1.5;

// ── Debug Trigger Names ───────────────────────────────────────────────────────

/**
 * Scenario names for debug mode.
 * Game-specific triggers for Coins of Fate + legacy triggers
 * (kept for backwards compatibility with non-compliance tests).
 */
export const DEBUG_TRIGGERS = {
  // Coins of Fate triggers
  MYSTERY_COIN:          'mystery coin',
  MEGA_COIN:             'mega coin',
  STATUE_FEATURE:        'statue feature',
  REGULAR_WIN:           'regular win',
  BIG_WIN:               'big win',
  // Legacy triggers (from other games — kept for compilation)
  COIN_BONUS:            'coin bonus',
  FREE_GAMES:            'free games',
  GRAND_JACKPOT:         'grand-jackpot',
  MAJOR_JACKPOT:         'major-jackpot',
  MINOR_JACKPOT:         'minor-jackpot',
  MINI_JACKPOT:          'mini-jackpot',
  BONUS_WITH_PAYLINE:    'regular win + coin bonus',
  ALL_JACKPOTS_IN_FREE:  'free games with all wins',
  NEAR_MISS:             'anticipation',
} as const;

export type DebugTrigger = typeof DEBUG_TRIGGERS[keyof typeof DEBUG_TRIGGERS];
