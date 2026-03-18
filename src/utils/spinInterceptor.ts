/**
 * spinInterceptor.ts
 *
 * Playwright network-layer interceptor for the /demoplay endpoint.
 *
 * Responsibilities:
 *   - Record every request + response for assertion in tests
 *   - Allow individual or queued mock responses (no live network needed)
 *   - Expose static factory methods for building deterministic payloads
 *
 * Payload format (Bonsai Gold 2 — verified against live API):
 *   display:      number[][]   5 reels × 3 rows  (display[reel][row])
 *   coins:        number[][]   5 reels × 3 rows  coin values per cell (0 = no coin)
 *   initial:      null | number[][]   previous display (null for base game)
 *   coinsInitial: null | number[][]   previous coins state (null for base game)
 *   bet:          { amount: number; value: number }  totalBet = amount × value (amount=20)
 *   win:          number        total win this round
 *   wins:         WinObject[]   individual payline / feature wins
 *   collection:   number        coin count accumulated this round
 *   scenarioId:   number        RNG scenario identifier
 *   RoundMetadata: { betType: string }
 *   coingames?:   number        Hold & Win respin counter (0 = inactive)
 *   remaining?:   number        free spins remaining
 *   start, end:   boolean       round phase flags
 *   trigger?:     boolean       true when Hold & Win triggers on this spin
 */

import { type Page, type Route } from '@playwright/test';
import { SPIN_API_PATH, REELS, ROWS, COLLECTOR_COIN, JACKPOTS } from '../constants/game.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WinObject {
  amount: number;
  item:   number;
  line:   number[] | number;   // Sands of Fortune: array of row indices
  count:  number;
  freegames?: number;
}

export interface SpinPayload {
  display:       number[][];
  coins:         number[][];
  initial:       number[][] | null;
  coinsInitial:  number[][] | null;
  bet:           { amount: number; value: number };
  win:           number;
  wins:          WinObject[];
  collection:    number;
  scenarioId:    number;
  RoundMetadata: { betType: string };
  coingames?:    number;
  remaining?:    number;
  start?:        boolean;
  end?:          boolean;
  trigger?:      boolean;
}

export interface SpinRequest {
  bet:   { amount: number; value: number; index?: number };
  [key: string]: unknown;
}

export interface SpinRecord {
  url:      string;
  status:   number;
  request:  SpinRequest;
  response: {
    payload:    SpinPayload;
    localState: unknown;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BET_AMOUNT = 20;
const DEMOPLAY_GLOB      = `**${SPIN_API_PATH}`;

/** A 5×3 grid of non-winning symbols (all low-value, no paylines, no coins) */
function neutralDisplay(): number[][] {
  return [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 1],
    [2, 3, 4],
    [5, 6, 7],
  ];
}

/** A 5×3 grid of zeros — no coin symbols present */
function emptyCoins(): number[][] {
  return [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
}

/** Build a bet config from a total bet amount */
function betConfig(totalBet: number): { amount: number; value: number } {
  return { amount: DEFAULT_BET_AMOUNT, value: totalBet / DEFAULT_BET_AMOUNT };
}

// ── SpinInterceptor ───────────────────────────────────────────────────────────

export class SpinInterceptor {
  /** Full history of every spin made during the test */
  readonly history: SpinRecord[] = [];

  /** Queue of mock payloads to return on the next spin(s) */
  private _queue: SpinPayload[] = [];

  /** Playwright Page reference */
  private readonly _page: Page;

  /** Whether the route handler is currently installed */
  private _installed = false;

  constructor(page: Page) {
    this._page = page;
  }

  // ── Installation ──────────────────────────────────────────────────────────

  /**
   * Register the Playwright route handler.
   * Must be called BEFORE page.goto() so requests during load are captured.
   */
  async install(): Promise<void> {
    if (this._installed) return;
    this._installed = true;

    await this._page.route(DEMOPLAY_GLOB, async (route: Route) => {
      const request = route.request();

      // Parse request body
      let parsedRequest: SpinRequest = { bet: { amount: DEFAULT_BET_AMOUNT, value: 1 } };
      try {
        const body = request.postData();
        if (body) parsedRequest = JSON.parse(body) as SpinRequest;
      } catch { /* not JSON — keep default */ }

      // If we have a mock queued, return it instead of the real network
      if (this._queue.length > 0) {
        const mockPayload = this._queue.shift()!;
        // Wrap in the same envelope the real API uses: { payload, localState }
        // so the game client can parse it correctly.
        const responseBody = JSON.stringify({ payload: mockPayload, localState: null });

        this.history.push({
          url:      request.url(),
          status:   200,
          request:  parsedRequest,
          response: { payload: mockPayload, localState: null },
        });

        await route.fulfill({
          status:      200,
          contentType: 'application/json',
          body:        responseBody,
        });
        return;
      }

      // Let the real request go through and record the response
      const response = await route.fetch();
      let payload: SpinPayload | null = null;
      let localState: unknown = null;

      try {
        // The API wraps the spin data: { payload: SpinPayload, localState: unknown }
        const full = await response.json() as { payload?: SpinPayload; localState?: unknown } & SpinPayload;
        payload    = full.payload ?? (full as SpinPayload);
        localState = full.localState ?? null;
      } catch {
        payload = null;
      }

      if (payload) {
        this.history.push({
          url:      request.url(),
          status:   response.status(),
          request:  parsedRequest,
          response: { payload, localState },
        });
      }

      await route.fulfill({ response });
    });
  }

  // ── Queue helpers ─────────────────────────────────────────────────────────

  /** Queue a single mock payload for the next spin */
  queueMockResponse(payload: SpinPayload): void {
    this._queue.push(payload);
  }

  /** Queue multiple mock payloads to be consumed in order */
  queueMockResponses(payloads: SpinPayload[]): void {
    this._queue.push(...payloads);
  }

  /**
   * Convenience wrapper: queue a 'no-win' or 'win' mock for the next spin.
   * @param type - 'no-win' or 'win'
   * @param totalBet - the total bet amount so the mock matches the displayed bet
   */
  mockNextSpin(type: 'no-win' | 'win', totalBet: number): void {
    if (type === 'no-win') {
      this._queue.unshift(SpinInterceptor.buildNoWin(totalBet));
    } else {
      const winAmt = totalBet * 5;
      this._queue.unshift(SpinInterceptor.buildWin(totalBet, [
        { amount: winAmt, item: 7, line: [1, 1, 1, 1, 1], count: 5 },
      ]));
    }
  }

  // ── History queries ───────────────────────────────────────────────────────

  /** Returns the most recent spin record, or null if none recorded yet */
  getLastSpin(): SpinRecord | null {
    return this.history.length > 0 ? this.history[this.history.length - 1]! : null;
  }

  /** Sum of all bets from history[fromIndex] onwards */
  getTotalBet(fromIndex = 0): number {
    return this.history.slice(fromIndex).reduce((sum, s) => {
      const b = s.response.payload.bet;
      return sum + b.amount * b.value;
    }, 0);
  }

  /** Sum of all wins from history[fromIndex] onwards, in EUR (currency units) */
  getTotalWon(fromIndex = 0): number {
    return this.history.slice(fromIndex).reduce((sum, s) => {
      const coinValue = s.response.payload.bet.value;
      return sum + (s.response.payload.wins ?? []).reduce((ws, w) => ws + w.amount, 0) * coinValue;
    }, 0);
  }

  // ── Static payload factories ──────────────────────────────────────────────

  /** Build a no-win response payload */
  static buildNoWin(totalBet: number): SpinPayload {
    return {
      display:       neutralDisplay(),
      coins:         emptyCoins(),
      initial:       null,
      coinsInitial:  null,
      bet:           betConfig(totalBet),
      win:           0,
      wins:          [],
      collection:    0,
      scenarioId:    12345,
      RoundMetadata: { betType: '' },
      coingames:     0,
      remaining:     0,
      start:         true,
      end:           true,
      trigger:       false,
    };
  }

  /**
   * Build a winning response payload.
   * Automatically generates a display grid where each winning symbol appears at the
   * correct reel/row position so the game engine can validate and animate the win.
   * @param wins - array of win objects (line is an array of row-indices, one per reel)
   */
  static buildWin(
    totalBet: number,
    wins: Array<{ amount: number; item: number; line: number[]; count: number }>,
  ): SpinPayload {
    const totalWin = wins.reduce((s, w) => s + w.amount, 0);

    // Start from neutral grid and overlay the winning symbols at the declared positions
    const display = neutralDisplay();
    for (const win of wins) {
      if (Array.isArray(win.line)) {
        win.line.forEach((row, reel) => {
          if (reel < display.length && row >= 0 && row < (display[reel]?.length ?? 0)) {
            display[reel]![row] = win.item;
          }
        });
      }
    }

    return {
      display,
      coins:         emptyCoins(),
      initial:       null,
      coinsInitial:  null,
      bet:           betConfig(totalBet),
      win:           totalWin,
      wins,
      collection:    0,
      scenarioId:    23456,
      RoundMetadata: { betType: '' },
      coingames:     0,
      remaining:     0,
      start:         true,
      end:           true,
      trigger:       false,
    };
  }

  /**
   * Build a Hold & Win bonus-trigger payload.
   * Puts 6 COIN (10) symbols on the grid and sets coingames = 3.
   */
  static buildBonusTrigger(totalBet: number): SpinPayload {
    const display = [
      [COLLECTOR_COIN, COLLECTOR_COIN, 1],
      [COLLECTOR_COIN, COLLECTOR_COIN, 2],
      [COLLECTOR_COIN, COLLECTOR_COIN, 3],
      [1, 2, 3],
      [4, 5, 6],
    ];
    // coins mirrors display for COIN positions
    const coins = display.map(reel => reel.map(sym => sym === COLLECTOR_COIN ? COLLECTOR_COIN : 0));
    return {
      display,
      coins,
      initial:       null,
      coinsInitial:  null,
      bet:           betConfig(totalBet),
      win:           0,
      wins:          [],
      collection:    6,
      scenarioId:    34567,
      RoundMetadata: { betType: '' },
      coingames:     3,
      remaining:     0,
      start:         true,
      end:           false,
      trigger:       true,
    };
  }

  /** Build a Grand Jackpot payload (full grid of COIN symbols, max collection) */
  static buildGrandJackpot(totalBet: number): SpinPayload {
    const winAmt = JACKPOTS.GRAND.multiplier * totalBet;
    const coinGrid: number[][] = Array.from({ length: REELS }, () =>
      Array.from({ length: ROWS }, () => COLLECTOR_COIN),
    );
    return {
      display:       coinGrid,
      coins:         coinGrid.map(r => [...r]),
      initial:       null,
      coinsInitial:  null,
      bet:           betConfig(totalBet),
      win:           winAmt,
      wins:          [{ amount: winAmt, item: COLLECTOR_COIN, line: -1, count: REELS * ROWS }],
      collection:    REELS * ROWS,
      scenarioId:    99999,
      RoundMetadata: { betType: '' },
      coingames:     0,
      remaining:     0,
      start:         true,
      end:           true,
      trigger:       false,
    };
  }

  /** Build a free-spins trigger payload (3 SCATTER symbols in display) */
  static buildFreeSpinsTrigger(totalBet: number): SpinPayload {
    return {
      display: [
        [11, 1, 2],  // SCATTER on reel 0
        [3, 11, 4],  // SCATTER on reel 1
        [5, 6, 11],  // SCATTER on reel 2
        [7, 8, 1],
        [2, 3, 4],
      ],
      coins:         emptyCoins(),
      initial:       null,
      coinsInitial:  null,
      bet:           betConfig(totalBet),
      win:           0,
      wins:          [{ amount: 0, item: 11, line: -1, count: 3, freegames: 10 }],
      collection:    0,
      scenarioId:    45678,
      RoundMetadata: { betType: '' },
      coingames:     0,
      remaining:     10,
      start:         true,
      end:           false,
      trigger:       false,
    };
  }
}
