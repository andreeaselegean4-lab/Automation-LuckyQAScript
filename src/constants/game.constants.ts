/**
 * game.constants.ts
 *
 * All game-specific constants for Bounty of the Seas: Hold & Win
 * Engine: et=ng  |  API: POST /demoplay  |  Grid: 5 reels × 3 rows
 *
 * Sources:
 *   - Live paytable inspection (10 pages)
 *   - Live DOM inspection (CSS selectors, UI elements)
 *
 * Features:
 *   - Wild (gold skull coin): substitutes all except Scatter and Bonus, reels 2-5
 *   - Scatter (pirate ship): 3/4/5 trigger 10/12/15 Free Spins with added Wilds
 *   - Bonus (treasure chest): 6+ trigger Hold & Win bonus game
 *   - 4 Jackpot tiers: MINI, MINOR, MAJOR, GRAND
 *   - Left-to-right pay only
 */

// ── Game Identity ─────────────────────────────────────────────────────────────

export const GAME_ID       = 'bounty-of-the-seas';
export const GAME_BRAND_ID = '95';   // default brand — see RTP_BRAND_MAP below
export const GAME_NAME     = 'Bounty of the Seas: Hold & Win';

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
 * Symbol ID → name map for Bounty of the Seas.
 *
 * 8 regular symbols + 3 special symbols:
 *   CAPTAIN (highest), CROWN, CUP, RING — themed symbols
 *   A, K, Q, J — card symbols (lowest)
 *   WILD — gold skull coin, substitutes all except Scatter and Bonus (reels 2-5)
 *   SCATTER — pirate ship, triggers Free Spins
 *   BONUS — treasure chest, triggers Hold & Win bonus (COIN equivalent)
 *   STICKY — locked chest symbol during Hold & Win respins
 */
export const SYMBOLS: Record<number, string> = {
  0:    'BLANK',
  1:    'CAPTAIN',
  2:    'CROWN',
  3:    'CUP',
  4:    'RING',
  5:    'A',
  6:    'K',
  7:    'Q',
  8:    'J',
  9:    'WILD',
  10:   'COIN',
  11:   'SCATTER',
  [-11]: 'STICKY',
};

/** All valid symbol IDs as a Set for fast membership checks */
export const VALID_SYMBOL_IDS = new Set(Object.keys(SYMBOLS).map(Number));

// ── Paylines ──────────────────────────────────────────────────────────────────

/**
 * 10 paylines for the 5×3 grid (left-to-right pay).
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
 * The BONUS/CHEST symbol that triggers the Hold & Win game.
 * 6+ of these on the grid triggers the bonus.
 */
export const COLLECTOR_COIN = 10;

/**
 * Symbol IDs that represent prize coins in the Hold & Win game.
 * COIN (10) = treasure chest with currency value.
 */
export const PRIZE_COIN_LIST: readonly number[] = [10];

/**
 * Collection thresholds — fill all 15 cells for GRAND.
 */
export const COLLECTION_THRESHOLDS: readonly number[] = [0, 6, 15];

// ── Jackpots ──────────────────────────────────────────────────────────────────

/**
 * Bounty of the Seas has 4 jackpot tiers.
 * Multipliers based on bet 1.00: MINI=20x, MINOR=50x, MAJOR=250x, GRAND=1000x.
 */
export const JACKPOTS: Record<string, { name: string; multiplier: number }> = {
  MINI:  { name: 'MINI',  multiplier: 20   },
  MINOR: { name: 'MINOR', multiplier: 50   },
  MAJOR: { name: 'MAJOR', multiplier: 250  },
  GRAND: { name: 'GRAND', multiplier: 1000 },
};

// ── Free Spins ────────────────────────────────────────────────────────────────

/** Minimum SCATTER symbols to trigger free spins */
export const FREE_SPINS_TRIGGER_COUNT = 3;

/** Free spin awards for 3 / 4 / 5 scatters */
export const FREE_SPINS_AWARDS: readonly number[] = [10, 12, 15];

// ── Turbo / FastPlay ──────────────────────────────────────────────────────────

/** Animation speed multiplier in turbo mode */
export const TURBO_TIME_SCALE = 1.5;

// ── Debug Trigger Names ───────────────────────────────────────────────────────

/**
 * Scenario names for debug mode.
 * Game-specific triggers for Bounty of the Seas + legacy triggers
 * (kept for backwards compatibility with non-compliance tests).
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
  // Coins of Fate triggers (kept for compilation)
  MYSTERY_COIN:          'mystery coin',
  MEGA_COIN:             'mega coin',
  STATUE_FEATURE:        'statue feature',
} as const;

export type DebugTrigger = typeof DEBUG_TRIGGERS[keyof typeof DEBUG_TRIGGERS];
