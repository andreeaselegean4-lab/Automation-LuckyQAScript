/**
 * game.constants.ts
 *
 * All game-specific constants for Sands of Fortune: Hold & Win
 * Engine: et=tr  |  API: POST /demoplay  |  Grid: 5 reels × 3 rows
 *
 * Sources:
 *   - Live paytable inspection
 *   - Live DOM inspection (CSS selectors, UI elements)
 *   - stub.js: https://cdn2.avocadospins.com/client/sands-of-fortune-client/latest/stub.js
 *
 * Features:
 *   - Wild: substitutes for all symbols except Scatter and Coin
 *   - Scatter: 3+ triggers Free Spins
 *   - Hold & Win bonus: triggered by 6+ coins on the grid, 3 respins
 *   - 4 Jackpot tiers: MINI, MINOR, MAJOR, GRAND
 *   - Free Spins: 10 free spins awarded by 3+ scatter symbols
 *   - Left-to-right pay, 10 paylines
 *   - Egyptian / desert theme
 */

// ── Game Identity ─────────────────────────────────────────────────────────────

export const GAME_ID       = 'sands-of-fortune';
export const GAME_BRAND_ID = 'tr';
export const GAME_NAME     = 'Sands of Fortune: Hold & Win';

// ── RTP Brand Configuration ───────────────────────────────────────────────────

/**
 * ToucanRoyale uses a single brand ID ('tr') with a fixed RTP.
 */
export const RTP_BRAND_MAP: Record<string, number> = {
  'tr': 96.0,
};

// ── API ───────────────────────────────────────────────────────────────────────

/** Path fragment matched in every demoplay network request */
export const SPIN_API_PATH = '/demoplay';

// ── Grid dimensions ───────────────────────────────────────────────────────────

export const REELS = 5;
export const ROWS  = 3;

// ── Symbols ───────────────────────────────────────────────────────────────────

/**
 * Symbol ID → name map for Sands of Fortune.
 *
 * Symbol IDs observed from stub.js display arrays and API responses:
 *   HP symbols: 1-4 (high pay)
 *   LP symbols: 5-8 (low pay)
 *   COLLECTOR: 9  (coin/chest — appears in H&W bonus)
 *   COIN: 10  (prize coin with currency value)
 *   SCATTER: 11  (triggers free spins)
 *   WILD: 0  (substitutes for all except scatter/coin)
 */
export const SYMBOLS: Record<number, string> = {
  0:    'WILD',
  1:    'HP1',      // Pharaoh / highest pay
  2:    'HP2',      // Anubis
  3:    'HP3',      // Eye of Horus
  4:    'HP4',      // Scarab
  5:    'LP1',      // A
  6:    'LP2',      // K
  7:    'LP3',      // Q
  8:    'LP4',      // J
  9:    'COLLECTOR', // Coin collector (chest)
  10:   'COIN',     // Prize coin with value
  11:   'SCATTER',  // Free spins trigger
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
  [0, 1, 2, 1, 0], // L4  — V shape
  [2, 1, 0, 1, 2], // L5  — inverted V
  [0, 0, 1, 0, 0], // L6  — slight dip
  [2, 2, 1, 2, 2], // L7  — slight rise
  [1, 0, 0, 0, 1], // L8  — U shape
  [1, 2, 2, 2, 1], // L9  — inverted U
  [0, 1, 0, 1, 0], // L10 — zigzag
];

// ── Hold & Win (Bonus Game) ──────────────────────────────────────────────────

/**
 * The COLLECTOR symbol (chest) that gathers coin values during the bonus.
 * In Sands of Fortune, COLLECTOR = 10 (COIN symbol).
 */
export const COLLECTOR_COIN = 10;

/**
 * Symbol IDs that represent prize coins in the Hold & Win game.
 * COIN (10) = gold coin/chest with currency value.
 */
export const PRIZE_COIN_LIST: readonly number[] = [10];

/**
 * Collection thresholds — game-specific progression thresholds for
 * the coin collection meter.
 */
export const COLLECTION_THRESHOLDS: readonly number[] = [0, 1, 15, 30, 50];

// ── Jackpots ──────────────────────────────────────────────────────────────────

/**
 * Sands of Fortune has 4 jackpot tiers.
 * Multipliers based on total bet.
 */
export const JACKPOTS: Record<string, { name: string; multiplier: number }> = {
  MINI:  { name: 'MINI',  multiplier: 20   },
  MINOR: { name: 'MINOR', multiplier: 50   },
  MAJOR: { name: 'MAJOR', multiplier: 200  },
  GRAND: { name: 'GRAND', multiplier: 500  },
};

// ── Free Spins ────────────────────────────────────────────────────────────────

/** 3 scatter symbols trigger free spins */
export const FREE_SPINS_TRIGGER_COUNT = 3;

/** Free spins award: 10 free spins for 3+ scatters */
export const FREE_SPINS_AWARDS: readonly number[] = [10];

// ── Game Feature Flags ───────────────────────────────────────────────────────

/**
 * Feature flags — set to true/false depending on which features the current
 * game supports. Tests that target a specific feature will auto-skip when
 * the flag is false, so the same test suite works across different games.
 */
export const FEATURES = {
  HOLD_AND_WIN:  true,   // Hold & Win bonus (coin collection + respins)
  FREE_SPINS:    true,   // Free spins / free games feature
  JACKPOTS:      true,   // Jackpot tiers (MINI, MINOR, MAJOR, GRAND)
  WILDS:         true,   // Wild symbols
  SCATTER:       true,   // Scatter symbols (triggers free spins)
  PROGRESSION:   true,   // Progression meter (collection thresholds)
  MULTIPLIERS:   false,  // Multiplying feature during bonus
  PROSPERITY:    false,  // Prosperity spin feature
  BUY_BONUS:     false,  // Buy bonus option
} as const;

// ── Turbo / FastPlay ──────────────────────────────────────────────────────────

/** Animation speed multiplier in turbo mode */
export const TURBO_TIME_SCALE = 1.5;

// ── Debug Trigger Names ───────────────────────────────────────────────────────

/**
 * Scenario names for debug mode (?debug=true → loads stub.js).
 *
 * These pre-seed the server-side RNG so the next spin produces a specific,
 * deterministic outcome.  Unlike mocks, the server state is REAL — which
 * means reload/recovery tests can verify true session restoration.
 *
 * Source: https://cdn2.avocadospins.com/client/sands-of-fortune-client/latest/stub.js
 */
export const DEBUG_TRIGGERS = {
  // ── Progression ──────────────────────────────────────────────────────
  PROGRESSION_TEST:                 'progression test',

  // ── Anticipation (near-miss) ─────────────────────────────────────────
  ANTICIPATION:                     'anticipation',

  // ── Regular Wins ─────────────────────────────────────────────────────
  REGULAR_WIN:                      'regular win',
  WILD:                             'wild',
  HP1: 'hp1', HP2: 'hp2', HP3: 'hp3', HP4: 'hp4',
  LP1: 'lp1', LP2: 'lp2', LP3: 'lp3', LP4: 'lp4',

  // ── Free Games (Scatter) ─────────────────────────────────────────────
  FREE_GAMES:                       'free games',
  FREE_GAMES_WITH_ALL_WINS:         'free games with all wins',
  FREE_GAMES_COIN_BONUS:            'free games + coin bonus at the same time',
  FREE_GAMES_TO_COIN_BONUS:         'free games to coin bonus',
  FREE_GAMES_TO_COIN_BONUS_LAST_FS: 'free games to coin bonus on the last FS',
  FG_AND_BIG_WIN:                   'FG and Big win at the same time',
  FG_AND_REGULAR_WIN:               'FG and Regular win at the same time',

  // ── Hold & Win / Coin Bonus ──────────────────────────────────────────
  COIN_BONUS:                       'coin bonus',
  COIN_BONUS_NO_EXTRA_CHESTS:       'coin bonus without extra chests',
  COIN_BONUS_ONE_MINI_GAME:         'coin bonus with one mini game',
  COIN_BONUS_TWO_MINI_GAMES:        'coin bonus with two mini games',
  COIN_BONUS_1x3_TO_5x3:           'coin bonus with 1x3 -> 5x3',
  COIN_BONUS_1x2_TO_2x2_2x3:       'coin bonus with 1x2 -> 2x2 + 2x3',
  COIN_BONUS_1x2_TO_2x3_2x2:       'coin bonus with 1x2 -> 2x3 + 2x2',
  COIN_BONUS_1x2_TO_2x2_3x3:       'coin bonus with 1x2 -> 2x2 + 3x3',
  COIN_BONUS_2x3:                   'coin bonus with 2x3',
  COIN_BONUS_3x2:                   'coin bonus with 3x2',
  COIN_BONUS_3x3:                   'coin bonus with 3x3',
  COIN_BONUS_4x3:                   'coin bonus with 4x3',
  REGULAR_WIN_COIN_BONUS:           'regular win + coin bonus',
  HW_AND_BIG_WIN:                   'H&W and Big win at the same time',
  HW_AND_REGULAR_WIN:               'H&W and regular win at the same time',
  MINI_GAME_NO_BIG_WIN:             'mini game without big win',

  // ── Jackpots ─────────────────────────────────────────────────────────
  GRAND_JACKPOT:                    'grand-jackpot',
  MAJOR_JACKPOT:                    'major-jackpot',
  MINOR_JACKPOT:                    'minor-jackpot',
  MINI_JACKPOT:                     'mini-jackpot',

  // ── Free Games → Hold & Win → Jackpot Combos ────────────────────────
  FG_HW_GRAND_x10:                  'FG -> H&W & Grand Jackpot x10',
  FG_HW_1ST_SPIN_JACKPOT:           'FG -> H&W on 1st spin -> Jackpot',
  FG_HW_1ST_SPIN_NO_JACKPOT:        'FG -> H&W on 1st spin -> Not Jackpot',
  FG_HW_LAST_SPIN_JACKPOT:          'FG -> H&W on last spin -> Jackpot',
  FG_HW_LAST_SPIN_NO_JACKPOT:       'FG -> H&W on last spin -> Not Jackpot',
} as const;

export type DebugTrigger = typeof DEBUG_TRIGGERS[keyof typeof DEBUG_TRIGGERS];
