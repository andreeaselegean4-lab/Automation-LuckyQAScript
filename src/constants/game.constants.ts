/**
 * game.constants.ts
 *
 * All game-specific constants for Thunder Vault: Hold & Win
 * Engine: et=ng  |  API: POST /demoplay  |  Grid: 3 reels × 3 rows
 *
 * Sources:
 *   - Live paytable inspection (8 pages)
 *   - Live DOM inspection (CSS selectors, UI elements)
 *
 * Features:
 *   - Collector (lightning bolt): appears on reel 2 only, gathers all Bonus symbols during Bonus Game
 *   - Bonus (gold hexagon coin): appears on reels 1 and 3, pays only during Bonus Game
 *   - Hold & Win bonus: triggered by at least 1 Bonus/Collector on each reel, 3 respins
 *   - 4 Jackpot tiers: MINI, MINOR, MAJOR, GRAND
 *   - Left-to-right pay only, 5 paylines
 *   - Classic fruit theme (no Wild, no Scatter, no Free Spins)
 */

// ── Game Identity ─────────────────────────────────────────────────────────────

export const GAME_ID       = 'thunder-vault';
export const GAME_BRAND_ID = '95';   // default brand — see RTP_BRAND_MAP below
export const GAME_NAME     = 'Thunder Vault: Hold & Win';

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

export const REELS = 3;
export const ROWS  = 3;

// ── Symbols ───────────────────────────────────────────────────────────────────

/**
 * Symbol ID → name map for Thunder Vault.
 *
 * 8 regular fruit/classic symbols + 2 special symbols:
 *   SEVEN (highest), BELL, HORSESHOE, GRAPE — high-value symbols
 *   WATERMELON, LEMON, ORANGE, CHERRY — low-value symbols
 *   COLLECTOR — lightning bolt, appears only on reel 2, gathers Bonus symbols
 *   COIN — gold hexagon, appears only on reels 1 & 3, pays during Bonus Game
 */
export const SYMBOLS: Record<number, string> = {
  0:    'BLANK',
  1:    'SEVEN',
  2:    'BELL',
  3:    'HORSESHOE',
  4:    'GRAPE',
  5:    'WATERMELON',
  6:    'LEMON',
  7:    'ORANGE',
  8:    'CHERRY',
  9:    'COLLECTOR',
  10:   'COIN',
  [-10]: 'STICKY',
};

/** All valid symbol IDs as a Set for fast membership checks */
export const VALID_SYMBOL_IDS = new Set(Object.keys(SYMBOLS).map(Number));

// ── Paylines ──────────────────────────────────────────────────────────────────

/**
 * 5 paylines for the 3×3 grid (left-to-right pay).
 * Each entry is an array of row indices (0=top, 1=mid, 2=bottom), one per reel.
 */
export const PAYLINES: readonly number[][] = [
  [0, 0, 0], // L1 — top row
  [1, 1, 1], // L2 — middle row
  [2, 2, 2], // L3 — bottom row
  [0, 1, 2], // L4 — diagonal down
  [2, 1, 0], // L5 — diagonal up
];

// ── Hold & Win (Bonus Game) ──────────────────────────────────────────────────

/**
 * The COLLECTOR symbol (lightning bolt) that gathers all Bonus symbols
 * during the Bonus Game. Appears only on reel 2.
 */
export const COLLECTOR_COIN = 9;

/**
 * Symbol IDs that represent prize coins in the Hold & Win game.
 * COIN (10) = gold hexagon with currency value.
 */
export const PRIZE_COIN_LIST: readonly number[] = [10];

/**
 * Collection thresholds — at least 1 Bonus/Collector on each reel triggers bonus.
 */
export const COLLECTION_THRESHOLDS: readonly number[] = [0, 3, 9];

// ── Jackpots ──────────────────────────────────────────────────────────────────

/**
 * Thunder Vault has 4 jackpot tiers.
 * Multipliers based on bet 1.00: MINI=20x, MINOR=50x, MAJOR=250x, GRAND=500x.
 */
export const JACKPOTS: Record<string, { name: string; multiplier: number }> = {
  MINI:  { name: 'MINI',  multiplier: 20  },
  MINOR: { name: 'MINOR', multiplier: 50  },
  MAJOR: { name: 'MAJOR', multiplier: 250 },
  GRAND: { name: 'GRAND', multiplier: 500 },
};

// ── Free Spins ────────────────────────────────────────────────────────────────

/** Thunder Vault has NO free spins — set trigger count impossibly high */
export const FREE_SPINS_TRIGGER_COUNT = 99;

/** No free spin awards */
export const FREE_SPINS_AWARDS: readonly number[] = [];

// ── Turbo / FastPlay ──────────────────────────────────────────────────────────

/** Animation speed multiplier in turbo mode */
export const TURBO_TIME_SCALE = 1.5;

// ── Debug Trigger Names ───────────────────────────────────────────────────────

/**
 * Scenario names for debug mode.
 * Game-specific triggers for Thunder Vault + legacy triggers
 * (kept for backwards compatibility with non-compliance tests).
 */
export const DEBUG_TRIGGERS = {
  COIN_BONUS:            'coin bonus',
  REGULAR_WIN:           'regular win',
  GRAND_JACKPOT:         'grand-jackpot',
  MAJOR_JACKPOT:         'major-jackpot',
  MINOR_JACKPOT:         'minor-jackpot',
  MINI_JACKPOT:          'mini-jackpot',
  BIG_WIN:               'coin bonus with one mini game',
  BONUS_WITH_PAYLINE:    'regular win + coin bonus',
  NEAR_MISS:             'anticipation',
  // Legacy triggers (kept for compilation compatibility)
  FREE_GAMES:            'free games',
  ALL_JACKPOTS_IN_FREE:  'free games with all wins',
  MYSTERY_COIN:          'mystery coin',
  MEGA_COIN:             'mega coin',
  STATUE_FEATURE:        'statue feature',
} as const;

export type DebugTrigger = typeof DEBUG_TRIGGERS[keyof typeof DEBUG_TRIGGERS];
