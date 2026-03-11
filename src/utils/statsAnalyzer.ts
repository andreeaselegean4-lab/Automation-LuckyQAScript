/**
 * statsAnalyzer.ts
 *
 * Statistical analysis utilities for spin history collected by SpinInterceptor.
 *
 * Used by:
 *   - 07-win-payout.spec.ts  → validatePaylineWins()
 *   - 09-rng-stats.spec.ts   → computeRTP(), computeSymbolFrequencies(), checkForPatterns(), summary()
 */

import type { SpinRecord } from './spinInterceptor';
import { REELS, ROWS, PAYLINES, VALID_SYMBOL_IDS, COLLECTOR_COIN, PRIZE_COIN_LIST } from '../constants/game.constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RTPResult {
  rtp:        number;   // percentage (e.g. 96.5)
  totalBet:   number;
  totalWon:   number;
  spinCount:  number;
}

export interface PaylineValidation {
  spinIndex: number;
  valid:     boolean;
  details?:  string;
}

export interface PatternResult {
  maxIdenticalDisplayStreak: number;
  maxWinStreak:              number;
  maxNoWinStreak:            number;
}

export interface AnalysisSummary {
  spinCount: number;
  rtp:       number;
  winRate:   number;
  patterns:  PatternResult;
}

// ── StatsAnalyzer ─────────────────────────────────────────────────────────────

export class StatsAnalyzer {
  private readonly _history: SpinRecord[];

  constructor(history: SpinRecord[]) {
    this._history = history;
  }

  // ── RTP ──────────────────────────────────────────────────────────────────

  computeRTP(): RTPResult {
    let totalBet = 0;
    let totalWon = 0;

    for (const spin of this._history) {
      const { bet, wins } = spin.response.payload;
      totalBet += bet.amount * bet.value;
      totalWon += (wins ?? []).reduce((s, w) => s + w.amount, 0);
    }

    const spinCount = this._history.length;
    const rtp       = spinCount > 0 && totalBet > 0 ? (totalWon / totalBet) * 100 : 0;

    return { rtp, totalBet, totalWon, spinCount };
  }

  // ── Symbol frequencies ────────────────────────────────────────────────────

  /**
   * Returns a map of symbolId → total count across all cells in history.
   * Grid is 5 reels × 3 rows = 15 cells per spin.
   */
  computeSymbolFrequencies(): Record<number, number> {
    const freq: Record<number, number> = {};

    for (const spin of this._history) {
      const { display } = spin.response.payload;
      if (!Array.isArray(display)) continue;

      for (const reel of display) {
        if (!Array.isArray(reel)) continue;
        for (const symbolId of reel) {
          freq[symbolId] = (freq[symbolId] ?? 0) + 1;
        }
      }
    }

    return freq;
  }

  // ── Pattern detection ─────────────────────────────────────────────────────

  checkForPatterns(): PatternResult {
    let maxIdenticalDisplayStreak = 1;
    let maxWinStreak               = 0;
    let maxNoWinStreak             = 0;

    let currentIdentical = 1;
    let currentWin       = 0;
    let currentNoWin     = 0;

    for (let i = 0; i < this._history.length; i++) {
      const spin    = this._history[i]!;
      const hasWin  = (spin.response.payload.wins?.length ?? 0) > 0;

      // Win / no-win streaks
      if (hasWin) {
        currentWin++;
        currentNoWin = 0;
      } else {
        currentNoWin++;
        currentWin = 0;
      }
      maxWinStreak   = Math.max(maxWinStreak,   currentWin);
      maxNoWinStreak = Math.max(maxNoWinStreak, currentNoWin);

      // Identical display streak
      if (i > 0) {
        const prev = this._history[i - 1]!;
        if (this._displaysEqual(prev.response.payload.display, spin.response.payload.display)) {
          currentIdentical++;
        } else {
          currentIdentical = 1;
        }
        maxIdenticalDisplayStreak = Math.max(maxIdenticalDisplayStreak, currentIdentical);
      }
    }

    return { maxIdenticalDisplayStreak, maxWinStreak, maxNoWinStreak };
  }

  private _displaysEqual(a: number[][], b: number[][]): boolean {
    if (!a || !b || a.length !== b.length) return false;
    for (let col = 0; col < a.length; col++) {
      const ac = a[col]!;
      const bc = b[col]!;
      if (!ac || !bc || ac.length !== bc.length) return false;
      for (let row = 0; row < ac.length; row++) {
        if (ac[row] !== bc[row]) return false;
      }
    }
    return true;
  }

  // ── Payline validation ────────────────────────────────────────────────────

  /**
   * Cross-checks the wins[] array against the display for payline wins.
   * Non-payline wins (COIN/SCATTER) are skipped.
   * Returns one validation result per spin.
   */
  validatePaylineWins(): PaylineValidation[] {
    const results: PaylineValidation[] = [];

    for (let idx = 0; idx < this._history.length; idx++) {
      const spin    = this._history[idx]!;
      const payload = spin.response.payload;
      const display = payload.display;

      if (!Array.isArray(display) || display.length !== REELS) {
        results.push({ spinIndex: idx, valid: false, details: `display has ${display?.length ?? 0} reels, expected ${REELS}` });
        continue;
      }

      let spinValid = true;
      let details   = '';

      for (const win of (payload.wins ?? [])) {
        // Skip coin / scatter wins — they are not payline wins
        const isCoinWin = (PRIZE_COIN_LIST as readonly number[]).includes(win.item) || win.item === COLLECTOR_COIN;
        const isScatter = win.item === 11;
        if (isCoinWin || isScatter || !Array.isArray(win.line)) continue;

        // Validate that the symbol appears at each payline position
        const line   = win.line as number[];
        const item   = win.item;
        const wild   = 9;
        let matchCount = 0;

        for (let reel = 0; reel < line.length && reel < REELS; reel++) {
          const rowIdx = line[reel];
          if (rowIdx == null || rowIdx < 0 || rowIdx >= ROWS) {
            spinValid = false;
            details   = `win.line[${reel}]=${rowIdx} out of range`;
            break;
          }
          const symbolAtPos = display[reel]?.[rowIdx];
          if (symbolAtPos === item || symbolAtPos === wild || item === wild) {
            matchCount++;
          }
        }

        // The win.count should approximately match the payline match count
        if (spinValid && matchCount < 3) {
          spinValid = false;
          details   = `item ${item} only matched ${matchCount} cells on payline, expected ≥3`;
        }

        if (!VALID_SYMBOL_IDS.has(item)) {
          spinValid = false;
          details   = `unknown symbol id ${item}`;
        }
      }

      results.push({ spinIndex: idx, valid: spinValid, details: details || undefined });
    }

    return results;
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  summary(): AnalysisSummary {
    const { rtp }   = this.computeRTP();
    const patterns  = this.checkForPatterns();
    const wins      = this._history.filter(s => (s.response.payload.wins?.length ?? 0) > 0);
    const winRate   = this._history.length > 0
      ? (wins.length / this._history.length) * 100
      : 0;

    return {
      spinCount: this._history.length,
      rtp,
      winRate,
      patterns,
    };
  }
}
