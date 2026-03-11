/**
 * GamePage.ts
 *
 * Page-object model for Sands of Fortune: Hold & Win.
 *
 * All interactive elements use real HTML/DOM selectors — the game UI is rendered
 * as HTML overlays on top of the WebGL canvas. The canvas itself is not
 * interacted with directly in tests.
 *
 * Selector reference (verified via live DOM inspection at 1280×720):
 *
 *   #spinButton            class: image-spin-button  [enabled | disabled]
 *   #autoplayButton        class: autoplay-button autoplay  [enabled | disabled]
 *   #menuButton            class: image-menu-button
 *   .fastplay-button       class: play-button--regular | play-button--turbo | play-button--fast
 *   .bet-button--increase  increases bet level
 *   .bet-button--decrease  decreases bet level
 *   .bet-value             displays current bet (e.g. "1.00")
 *   .balance-value         displays current balance
 *   .win-value             displays last win amount
 *   .loading-screen.ready  intro overlay shown when assets have loaded (click to dismiss)
 */

import { type Locator, type Page, expect } from '@playwright/test';
import { type SpinRecord, SpinInterceptor } from '../utils/spinInterceptor';

// ── BalanceTracker ────────────────────────────────────────────────────────────

export interface BalanceEntry {
  before: number;
  after:  number;
  delta:  number;
}

export class BalanceTracker {
  readonly history: BalanceEntry[] = [];
  private _last: number | null = null;
  private readonly _gamePage: GamePage;

  constructor(gamePage: GamePage) {
    this._gamePage = gamePage;
  }

  async init(): Promise<void> {
    this._last = await this._gamePage.getTopBarBalance();
  }

  async record(): Promise<void> {
    const current = await this._gamePage.getTopBarBalance();
    if (this._last !== null) {
      this.history.push({ before: this._last, after: current, delta: current - this._last });
    }
    this._last = current;
  }

  get lastBalance(): number {
    return this._last ?? 0;
  }
}

// ── DebugTrigger ──────────────────────────────────────────────────────────────

export class DebugTrigger {
  private readonly _page: Page;

  constructor(page: Page) {
    this._page = page;
  }

  /** Returns true if stub.js debug system is available on this build */
  async isAvailable(): Promise<boolean> {
    return this._page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return typeof w['$debug'] !== 'undefined' || typeof w['$resolve'] !== 'undefined';
    });
  }

  /**
   * Activate a named debug scenario from stub.js.
   * The scenario pre-seeds the RNG so the next spin produces a specific outcome.
   */
  async triggerScenario(name: string): Promise<void> {
    await this._page.evaluate((scenarioName: string) => {
      const w = window as unknown as Record<string, unknown>;
      // Try the direct debug object first
      const dbg = w['$debug'] as Record<string, (...args: unknown[]) => void> | undefined;
      if (dbg) {
        if (typeof dbg['trigger'] === 'function')     dbg['trigger'](scenarioName);
        else if (typeof dbg['setTrigger'] === 'function') dbg['setTrigger'](scenarioName);
        return;
      }
      // Try the deferred resolver pattern used by the game framework
      const resolve = w['$resolve'] as ((name: string, cb?: unknown) => (cb: (d: Record<string, unknown>) => void) => void) | undefined;
      if (typeof resolve === 'function') {
        resolve('$debug')((d: Record<string, unknown>) => {
          if (typeof d['trigger'] === 'function')     (d['trigger'] as (n: string) => void)(scenarioName);
          else if (typeof d['setTrigger'] === 'function') (d['setTrigger'] as (n: string) => void)(scenarioName);
        });
      }
    }, name);
  }
}

// ── GamePage ──────────────────────────────────────────────────────────────────

export class GamePage {
  readonly page:        Page;
  readonly interceptor: SpinInterceptor;
  readonly balance:     BalanceTracker;
  readonly debug:       DebugTrigger;

  // ── Locators ────────────────────────────────────────────────────────────

  /**
   * Visible spin/stop button (.last()) — used for click() and toBeVisible() assertions.
   * The game renders two #spinButton elements; the last one is the visible UI button.
   * Its classes use image-spin-button / image-stop-spin-button / hover — NOT enabled/disabled.
   */
  readonly spinButton: Locator;
  /** Autoplay toggle button (visible) */
  readonly autoplayButton: Locator;
  /** Hamburger menu button (visible) */
  readonly menuButton: Locator;
  /** Turbo / fast-play cycle button (visible) */
  readonly turboButton: Locator;
  /** Increase bet level (visible) */
  readonly betIncrease: Locator;
  /** Decrease bet level (visible) */
  readonly betDecrease: Locator;
  /** Bet value display */
  readonly betValue: Locator;
  /** Balance display */
  readonly balanceDisplay: Locator;
  /** Last Win display */
  readonly lastWinDisplay: Locator;
  /** Loading screen overlay (present until assets finish loading) */
  readonly loadingScreen: Locator;

  /**
   * Hidden state-tracking spin button (.first()) — used ONLY for class-based state checks.
   * This element (in #rightControls) is not visible but carries enabled/disabled/stop classes
   * that accurately reflect the game's spin state machine.
   */
  private readonly _spinState:   Locator;
  private readonly _betIncState: Locator;
  private readonly _betDecState: Locator;

  /** Last win amount captured immediately after spin response — before animation resets */
  private _winSnapshot: number = 0;

  constructor(page: Page) {
    this.page        = page;
    this.interceptor = new SpinInterceptor(page);
    this.balance     = new BalanceTracker(this);
    this.debug       = new DebugTrigger(page);

    // Visible buttons — for click() and toBeVisible()
    this.spinButton     = page.locator('#spinButton').last();
    this.autoplayButton = page.locator('#autoplayButton').last();
    this.menuButton     = page.locator('#menuButton').last();
    this.turboButton    = page.locator('.fastplay-button').last();
    this.betIncrease    = page.locator('.bet-button--increase').last();
    this.betDecrease    = page.locator('.bet-button--decrease').last();
    this.betValue       = page.locator('.bet-value').last();
    this.balanceDisplay = page.locator('.balance-value');
    this.lastWinDisplay = page.locator('.win-value');
    this.loadingScreen  = page.locator('.loading-screen');

    // Hidden state-tracking elements — for enabled/disabled/stop class checks
    this._spinState   = page.locator('#spinButton').first();
    this._betIncState = page.locator('.bet-button--increase').first();
    this._betDecState = page.locator('.bet-button--decrease').first();
  }

  // ── Static helpers ───────────────────────────────────────────────────────

  /**
   * Attaches console.error and pageerror listeners to a Page.
   * Returns a mutable array that accumulates error strings.
   * Call this BEFORE navigation so errors during load are captured.
   */
  static attachErrorListener(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      errors.push(`[pageerror] ${err.message}`);
    });
    return errors;
  }

  // ── Navigation / load ────────────────────────────────────────────────────

  /**
   * Navigate to the game URL and wait for the game to be fully interactive.
   * Sequence:
   *   1. goto URL
   *   2. wait for .loading-screen.ready (intro overlay; up to 90 s)
   *   3. click CONTINUE / dismiss intro overlay
   *   4. waitForIdle
   *   5. init balance tracker
   */
  async load(url: string): Promise<void> {
    await this.interceptor.install();
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    // Wait for the intro overlay (.loading-screen.ready) — added when assets finish loading.
    // If it never appears (rare: already dismissed or different build), proceed anyway.
    await this.page.waitForSelector('.loading-screen.ready', { timeout: 90_000 }).catch(() => {});
    await this.page.waitForTimeout(1_800);

    // Dismiss intro animation — click near bottom-center of viewport
    const viewport = this.page.viewportSize();
    const cx = Math.round((viewport?.width  ?? 1280) / 2);
    const cy = Math.round((viewport?.height ?? 720)  * 0.9);
    await this.page.mouse.click(cx, cy);

    await this.waitForIdle(20_000);
    await this.balance.init();
  }

  // ── Spin controls ────────────────────────────────────────────────────────

  /** Click spin once — does NOT wait for the spin to complete */
  async spin(): Promise<void> {
    await this.spinButton.click();
  }

  /** Click spin and wait for the full spin cycle to finish */
  async spinAndWait(): Promise<void> {
    // Wait for the visible spin button to leave the stop/spinning state before clicking.
    // waitForSpinComplete watches the visible button (image-stop-spin-button class) and
    // also dismisses bonus-won overlays in its poll loop — so it correctly handles:
    //   • Normal spins: waits for reel animation to finish
    //   • Bonus auto-play: waits for all respins to complete
    //   • Bonus-won overlay: dismisses it so the button becomes clickable again
    // waitForIdle uses the hidden state element which gets 'enabled' immediately after
    // the API response (before animation ends) and therefore returns too early.
    // For mocked spins the button is already idle so this returns immediately.
    try { await this.waitForSpinComplete(120_000); } catch { /* proceed anyway */ }

    const histLenBefore = this.interceptor.history.length;
    await this.spinButton.click({ force: true });
    // Wait for the demoplay API response to be captured (works for mocked and real spins).
    await expect.poll(
      () => this.interceptor.history.length,
      { timeout: 30_000, intervals: [50, 100, 200, 500] },
    ).toBeGreaterThan(histLenBefore);
    // Capture win display BEFORE animations reset it — poll briefly for non-zero value
    this._winSnapshot = await this._pollForWin(1_500);
    // Allow win animations and balance display to settle
    await this.page.waitForTimeout(800);
    await this.balance.record();
  }

  /**
   * Spin until a non-bonus winning round is recorded (up to maxSpins).
   * Only returns for regular payline wins — bonus wins don't update the .win-value
   * display, so we skip those and keep spinning.
   * Handles the bonus "won" canvas overlay by clicking at canvas coordinates.
   *
   * Returns an object with:
   *   - spins: the spin records for the winning round
   *   - balanceBefore: balance BEFORE the winning spin (for accurate delta calculation)
   * Returns null if no win found within maxSpins.
   */
  async spinUntilWin(maxSpins = 30): Promise<{ spins: SpinRecord[]; balanceBefore: number } | null> {
    let prevRoundHadBonus = false;

    for (let i = 0; i < maxSpins; i++) {
      // If the previous round was a bonus, the "HOLD & WIN Bonus Game Won" canvas overlay
      // will be showing. Click the canvas at the "Start" button position to dismiss it,
      // then wait for the game to return to idle.
      if (prevRoundHadBonus) {
        // Wait for bonus auto-play to fully complete before dismissing the won screen.
        // Hold & Win bonuses keep the spin button disabled throughout — waitForIdle
        // only returns once all respins are done and the button re-enables.
        try { await this.waitForIdle(120_000); } catch { /* timed out — try canvas click anyway */ }
        await this.page.waitForTimeout(800);    // let won screen fully render
        await this._clickCanvasCenter();        // click "Start" / dismiss overlay
        await this.page.waitForTimeout(800);
        prevRoundHadBonus = false;
      }

      // Wait for game to reach idle state (handles any remaining animation/transitions)
      try {
        await this.waitForIdle(30_000);
      } catch { /* timed out — try to proceed anyway */ }

      const idxBefore = this.interceptor.history.length;
      // Wait for visible spin button to actually be clickable (no disabled CSS class)
      try {
        await expect(this.spinButton).not.toHaveClass(/\bdisabled\b/, { timeout: 10_000 });
      } catch { continue; }

      // Wait for win display to reset to 0 so _pollForWin won't capture a stale value
      const clearDeadline = Date.now() + 5_000;
      while (Date.now() < clearDeadline) {
        if ((await this.getLastWin()) === 0) break;
        await this.page.waitForTimeout(200);
      }
      // Reset snapshot so getLastWinStable() always reads a fresh value
      this._winSnapshot = 0;

      // Capture balance BEFORE this spin for accurate delta calculation
      const balanceBefore = await this.getTopBarBalance();
      await this.spinButton.click();

      // Wait for at least one spin response
      try {
        await expect.poll(
          () => this.interceptor.history.length,
          { timeout: 15_000, intervals: [100, 200, 500] },
        ).toBeGreaterThan(idxBefore);
      } catch {
        // No response — click may have been absorbed; retry
        continue;
      }

      // Allow bonus auto-play to finish: wait for history to stop growing (up to 30s)
      await this._waitForHistoryStable(idxBefore, 30_000);

      // Check if a bonus or free-spin feature was triggered this round
      const firstEntry = this.interceptor.history[idxBefore];
      const pl = firstEntry?.response.payload;
      const hadBonus = (pl?.coingames ?? 0) > 0 ||
                       pl?.trigger === true ||
                       (pl?.remaining ?? 0) > 0;
      if (hadBonus) {
        prevRoundHadBonus = true;
        // Use a longer stable window to capture all bonus respins (which can arrive
        // every 2–4 s) before setting idxBefore in the next iteration.
        await this._waitForHistoryStable(this.interceptor.history.length, 60_000, 4_000);
        continue;  // bonus/free-spin rounds skip — may have "won" canvas overlay
      }

      // Only accept simple rounds (≤2 records: live API uses start+end phases)
      // More than 2 records indicates a multi-spin feature (free spins, respins).
      const round = this.interceptor.history.slice(idxBefore);
      if (round.length > 2) continue;

      // Skip if ANY record in the round signals a bonus/free-spin feature
      const anyBonus = round.some(s =>
        s.response.payload.trigger === true ||
        (s.response.payload.coingames ?? 0) > 0 ||
        (s.response.payload.remaining ?? 0) > 0,
      );
      if (anyBonus) { prevRoundHadBonus = true; continue; }

      // Use the start-phase spin for win data — in the live API's 2-phase pattern,
      // the game logic (win amount) is reported in the start phase (start: true).
      // For single-phase spins (start: true, end: true) this is the same record.
      const startSpin = round.find(s => s.response.payload.start === true) ?? round[0]!;
      const isRegularWin = (startSpin.response.payload.win ?? 0) > 0;

      if (isRegularWin) {
        // Brief pause so the win counter animation has time to start before polling.
        await this.page.waitForTimeout(500);
        // Poll win display — give up to 10 s to capture the value even when turbo
        // mode shortens reel animations (the win counter still animates briefly).
        this._winSnapshot = await this._pollForWin(10_000);
        await this.page.waitForTimeout(500);
        await this.balance.record();
        // Return only the start-phase spin so tests use the correct win data
        return { spins: [startSpin], balanceBefore };
      }
    }
    return null;
  }

  /**
   * Attempt to dismiss canvas or DOM overlay by:
   * 1. Using JS to find and click a DOM element with "Start" text
   * 2. Falling back to mouse clicks at multiple canvas positions
   */
  private async _clickCanvasCenter(): Promise<void> {
    try {
      // Try JS-driven click — works even if element is not accessible via locator
      const clicked = await this.page.evaluate(() => {
        const texts = ['Start', 'START', 'start', 'OK', 'Continue', 'Collect'];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const el = node as HTMLElement;
          const txt = el.textContent?.trim() ?? '';
          if (texts.includes(txt) && el.offsetWidth > 0 && el.offsetHeight > 0) {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        await this.page.waitForTimeout(200);
        return;
      }
    } catch { /* ignore */ }

    // Fallback: mouse clicks at likely "Start" button positions on canvas
    try {
      const vp = this.page.viewportSize();
      const w = vp?.width  ?? 1280;
      const h = vp?.height ?? 720;
      // Try several y positions where "Start" button typically appears in the overlay
      for (const yFrac of [0.70, 0.75, 0.80, 0.65]) {
        await this.page.mouse.click(Math.round(w / 2), Math.round(h * yFrac));
        await this.page.waitForTimeout(150);
      }
    } catch { /* ignore */ }
  }

  /** Wait until the interceptor history stops growing for `requiredStableMs` ms */
  private async _waitForHistoryStable(
    idxBefore: number,
    timeout: number,
    requiredStableMs = 900,
  ): Promise<void> {
    const deadline = Date.now() + timeout;
    let lastLen = this.interceptor.history.length;
    let stableMs = 0;

    while (Date.now() < deadline) {
      await this.page.waitForTimeout(300);
      const currentLen = this.interceptor.history.length;
      if (currentLen > lastLen) {
        lastLen = currentLen;
        stableMs = 0;
      } else if (currentLen > idxBefore) {
        stableMs += 300;
        if (stableMs >= requiredStableMs) return;
      }
    }
  }

  /**
   * Run N spins sequentially.
   * @param n       - number of spins to run
   * @param onProgress - optional callback fired after each completed spin
   */
  async spinN(
    n: number,
    onProgress?: (completed: number, total: number) => void | Promise<void>,
  ): Promise<void> {
    for (let i = 0; i < n; i++) {
      await this.spinAndWait();
      if (onProgress) await onProgress(i + 1, n);
    }
  }

  // ── State waits ──────────────────────────────────────────────────────────

  /**
   * Wait until the spin button returns to idle (enabled, not spinning).
   * Throws if not idle within the timeout.
   */
  async waitForIdle(timeout = 20_000): Promise<void> {
    // _spinState (.first()) carries enabled/disabled classes and is updated by the game's
    // state machine regardless of which button was clicked. Safe for load-time + post-spin checks.
    await expect(this._spinState).toHaveClass(/enabled/, { timeout });
    await expect(this._spinState).not.toHaveClass(/(?<!\w)disabled(?!\w)/, { timeout: 3_000 }).catch(() => {});
  }

  /** Wait until the spin button enters the spinning / stop state */
  async waitForSpinning(timeout = 8_000): Promise<void> {
    // During a spin the visible button switches to image-stop-spin-button (shows STOP icon)
    await expect(this.spinButton).toHaveClass(/image-stop-spin-button/, { timeout });
  }

  /**
   * Wait for the full spin cycle to complete:
   *   spinning → idle
   * Also handles overlay screens (bonus, error) that can block the spin button state.
   */
  async waitForSpinComplete(timeout = 45_000): Promise<void> {
    await expect.poll(async () => {
      // Try to dismiss bonus/error overlays blocking the button
      await this._dismissOverlayIfPresent();
      const cls = (await this.spinButton.getAttribute('class').catch(() => '')) ?? '';
      return !cls.includes('image-stop-spin-button');
    }, { timeout, intervals: [300, 500, 1000] }).toBe(true);
  }

  // ── State queries ────────────────────────────────────────────────────────

  async isSpinButtonEnabled(): Promise<boolean> {
    const cls = (await this.spinButton.getAttribute('class')) ?? '';
    return !cls.includes('image-stop-spin-button') && !cls.includes('disabled');
  }

  async isSpinButtonDisabled(): Promise<boolean> {
    const cls = (await this.spinButton.getAttribute('class')) ?? '';
    // image-stop-spin-button = spin in progress (stop button showing); disabled = hard lock
    return cls.includes('image-stop-spin-button') || cls.includes('disabled');
  }

  /**
   * Returns true if bet controls AND autoplay button are all disabled.
   * Used to verify UI lock during a spin.
   * Uses the hidden state-tracking bet buttons which carry enabled/disabled classes.
   */
  async areControlsDisabled(): Promise<boolean> {
    const checks = await Promise.all([
      this._betIncState.getAttribute('class'),
      this._betDecState.getAttribute('class'),
    ]);
    return checks.every(cls => (cls ?? '').includes('disabled'));
  }

  /**
   * Returns true if bet controls are re-enabled after a spin.
   * Uses retrying expect() internally to handle brief re-enable transition.
   */
  async areControlsEnabled(): Promise<boolean> {
    try {
      await expect(this._betIncState).toHaveClass(/enabled/, { timeout: 10_000 });
      await expect(this._betDecState).toHaveClass(/enabled/, { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  // ── Balance / bet / win reads ────────────────────────────────────────────

  /**
   * Read balance via the BalanceTracker (updated on every spinAndWait call).
   * For a fresh read from DOM, use getTopBarBalance().
   */
  async getBalance(): Promise<number> {
    return this.getTopBarBalance();
  }

  /** Read balance directly from the DOM (.balance-value element) */
  async getTopBarBalance(): Promise<number> {
    const text = (await this.balanceDisplay.textContent()) ?? '0';
    return this._parseAmount(text);
  }

  /**
   * Poll until balance stabilises (stops changing for 500 ms).
   * Useful after a winning spin when the balance animates up.
   */
  async getBalanceStable(pollMs = 500, maxWaitMs = 10_000): Promise<number> {
    const deadline = Date.now() + maxWaitMs;
    let prev = await this.getTopBarBalance();
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(pollMs);
      const curr = await this.getTopBarBalance();
      if (curr === prev) return curr;
      prev = curr;
    }
    return prev;
  }

  async getBet(): Promise<number> {
    const text = (await this.betValue.textContent()) ?? '0';
    return this._parseAmount(text);
  }

  async getLastWin(): Promise<number> {
    const text = (await this.lastWinDisplay.textContent()) ?? '0';
    return this._parseAmount(text);
  }

  async getLastWinStable(pollMs = 500, maxWaitMs = 8_000): Promise<number> {
    // Return the snapshot captured immediately after spin if non-zero,
    // otherwise poll the DOM for a stable non-zero value.
    if (this._winSnapshot > 0) return this._winSnapshot;
    const deadline = Date.now() + maxWaitMs;
    let prev = await this.getLastWin();
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(pollMs);
      const curr = await this.getLastWin();
      if (curr === prev) return curr;
      prev = curr;
    }
    return prev;
  }

  /** Poll the win display until it shows a non-zero value, or timeout */
  private async _pollForWin(maxWaitMs: number): Promise<number> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const val = await this.getLastWin();
      if (val > 0) return val;
      await this.page.waitForTimeout(100);
    }
    return 0;
  }

  // ── Bet controls ─────────────────────────────────────────────────────────

  /** Click the increase-bet button one or more times. Stops early if already at maximum. */
  async increaseBet(times = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      const cls = (await this._betIncState.getAttribute('class')) ?? '';
      if (cls.includes('disabled')) return;
      // force: true bypasses the parent wrapper that intercepts pointer events
      await this.betIncrease.click({ force: true });
      await this.page.waitForTimeout(200);
    }
  }

  /** Click the decrease-bet button one or more times. Stops early if already at minimum. */
  async decreaseBet(times = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      const cls = (await this._betDecState.getAttribute('class')) ?? '';
      if (cls.includes('disabled')) return;
      // force: true bypasses the parent wrapper that intercepts pointer events
      await this.betDecrease.click({ force: true });
      await this.page.waitForTimeout(200);
    }
  }

  // ── Turbo mode ───────────────────────────────────────────────────────────

  /**
   * Enable turbo (fast-spin) mode.
   * The button cycles: regular → turbo → fast.
   * Clicks until the 'play-button--fast' class is present.
   */
  async enableTurbo(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      const cls = (await this.turboButton.getAttribute('class')) ?? '';
      if (cls.includes('play-button--fast')) return;
      await this.turboButton.click();
      await this.page.waitForTimeout(150);
    }
  }

  /** Disable turbo mode. Clicks until 'play-button--regular' class is present. */
  async disableTurbo(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      const cls = (await this.turboButton.getAttribute('class')) ?? '';
      if (cls.includes('play-button--regular')) return;
      await this.turboButton.click();
      await this.page.waitForTimeout(150);
    }
  }

  // ── Autoplay ─────────────────────────────────────────────────────────────

  /**
   * Start autoplay.
   * Waits until the spin button enters 'disabled' state (autoplay in progress).
   */
  async startAutoplay(): Promise<void> {
    await this.autoplayButton.click();
    // During autoplay the spin button is disabled (cannot be clicked)
    await expect(this._spinState).toHaveClass(/disabled/, { timeout: 10_000 });
  }

  /**
   * Stop autoplay.
   * Clicks the autoplay button again and waits for the spin button to re-enable.
   */
  async stopAutoplay(): Promise<void> {
    await this.autoplayButton.click();
    await this.waitForIdle(15_000);
  }

  // ── Memory ───────────────────────────────────────────────────────────────

  /** Returns current JS heap size in MB, or null if API is unavailable */
  async getHeapMB(): Promise<number | null> {
    return this.page.evaluate(() => {
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      if (!mem) return null;
      return mem.usedJSHeapSize / (1024 * 1024);
    });
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /**
   * Dismiss overlay screens that can block the spin button (bonus game win screen,
   * system error modal, etc.). Safe to call at any time — does nothing if no overlay.
   */
  /** Returns true if an overlay was found and dismissed */
  private async _dismissOverlayIfPresent(): Promise<boolean> {
    // Try text-based selectors for common overlay dismiss buttons.
    // These cover bonus game win screens ("Start"), error modals ("OK", "Close"), etc.
    const textCandidates = ['Start', 'OK', 'Continue', 'Close', 'Collect', 'Play'];
    for (const text of textCandidates) {
      try {
        const el = this.page.locator(`:text-is("${text}")`).first();
        if (await el.isVisible({ timeout: 50 })) {
          await el.click({ timeout: 300 });
          await this.page.waitForTimeout(300);
          return true;
        }
      } catch { /* not present — try next */ }
    }
    return false;
  }

  private _parseAmount(text: string): number {
    // Remove currency symbols, commas, spaces; handle "0.00" style
    const clean = text.replace(/[^0-9.-]/g, '');
    return parseFloat(clean) || 0;
  }
}
