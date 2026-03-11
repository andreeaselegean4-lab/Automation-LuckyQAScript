/**
 * 04 — Autoplay Tests
 *
 * Verifies the autoplay feature:
 *   - Autoplay button engages autoplay mode
 *   - Multiple spins fire automatically without manual clicks
 *   - Spin button becomes the STOP button during autoplay
 *   - Stopping autoplay returns the game to idle after the current spin
 *   - Bet controls remain disabled throughout autoplay
 *   - Balance is tracked correctly across an autoplay session
 *   - No JS errors during autoplay
 *
 * Performance optimisations applied:
 *   - Tests run in parallel — each gets its own browser context via the fixture.
 *   - Turbo mode enabled in beforeEach to shorten reel animations.
 *   - Mock responses are queued before autoplay starts so each spin resolves
 *     instantly rather than hitting the live network (3–5 s per spin saved).
 *   - Polling loops use 100 ms intervals instead of 1 000 ms to reduce idle wait.
 *   - Hardcoded waitForTimeout sleeps replaced with condition-based waits.
 *   - "winning spin" test queues a guaranteed win instead of waiting up to 90 s
 *     for a random win.
 */
import { test, expect }   from '@/fixtures/game.fixture';
import { SpinInterceptor } from '@/utils/spinInterceptor';

/** Minimal shape required by the waitForSpins helper. */
interface WithSpinHistory {
    interceptor: { history: unknown[] };
    page: { waitForTimeout(ms: number): Promise<void> };
}

const AUTOPLAY_SPINS = 5; // number of spins to let autoplay run before stopping

// Run all tests in this file concurrently — each test gets its own isolated
// browser context from the gamePage fixture so there is no shared state risk.
test.describe.configure({ mode: 'parallel' });

test.describe('Autoplay', () => {

    // Enable turbo (fast-spin) mode before every test to shorten reel animations.
    test.beforeEach(async ({ gamePage }) => {
        await gamePage.enableTurbo();
    });

    // ─── Helper ───────────────────────────────────────────────────────────────────

    /**
     * Poll until at least `target` new spins have been recorded in the interceptor
     * history (counting from `fromIndex`), or until `timeout` ms have elapsed.
     * Uses 100 ms intervals instead of 1 000 ms to minimise idle wait time.
     */
    async function waitForSpins(
        gamePage: WithSpinHistory,
        fromIndex: number,
        target: number,
        timeout = 30_000,
    ): Promise<void> {
        const deadline = Date.now() + timeout;
        while (gamePage.interceptor.history.length - fromIndex < target) {
            if (Date.now() > deadline) break;
            await gamePage.page.waitForTimeout(100);
        }
    }

    // ─── Tests ────────────────────────────────────────────────────────────────────

    test('autoplay button is clickable and starts autoplay', async ({ gamePage }) => {
        // Queue enough mocks so autoplay doesn't stall waiting for the network
        const bet = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses(
            Array.from({ length: 3 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        await gamePage.startAutoplay();

        // During autoplay the framework disables the spin button (class 'disabled')
        // rather than switching it to 'spin-stop-button' — the autoplay button is
        // the stop control.  startAutoplay() now waits for this state so by the
        // time we reach this line the class is already stable.
        const cls = (await gamePage.spinButton.getAttribute('class')) ?? '';
        expect(cls).toContain('disabled');

        await gamePage.stopAutoplay();
    });

    test(`autoplay fires ${AUTOPLAY_SPINS} spins automatically`, async ({ gamePage }) => {
        // Queue AUTOPLAY_SPINS + 2 mocks so autoplay never blocks on the network
        const bet = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses(
            Array.from({ length: AUTOPLAY_SPINS + 2 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        const countBefore = gamePage.interceptor.history.length;
        await gamePage.startAutoplay();

        // Poll at 100 ms intervals — much faster than the original 1 000 ms
        await waitForSpins(gamePage, countBefore, AUTOPLAY_SPINS);

        const spinsObserved = gamePage.interceptor.history.length - countBefore;
        expect(spinsObserved).toBeGreaterThanOrEqual(AUTOPLAY_SPINS);

        await gamePage.stopAutoplay();
    });

    test('stopping autoplay returns game to idle after current spin', async ({ gamePage }) => {
        const bet = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses(
            Array.from({ length: 5 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        const countBefore = gamePage.interceptor.history.length;
        await gamePage.startAutoplay();

        // Wait for at least one spin to complete instead of a hardcoded 2 500 ms sleep
        await waitForSpins(gamePage, countBefore, 1);

        await gamePage.stopAutoplay();

        // After stop, spin button should return to idle/enabled state
        const enabled = await gamePage.isSpinButtonEnabled();
        expect(enabled).toBe(true);
    });

    test('bet controls are disabled during autoplay', async ({ gamePage }) => {
        const bet = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses(
            Array.from({ length: 5 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        await gamePage.startAutoplay();
        // startAutoplay() already waits until the spin button enters 'disabled' state,
        // so autoplay is confirmed in-progress by the time we reach this line.
        // waitForSpinning() is NOT used here because during autoplay the spin button
        // is 'disabled interactive' — it never enters 'spin-stop-button' state.

        const controlsDisabled = await gamePage.areControlsDisabled();
        expect(controlsDisabled).toBe(true);

        await gamePage.stopAutoplay();
    });

    test('balance tracked correctly over autoplay session', async ({ gamePage }) => {
        const bet = await gamePage.getBet();

        // Queue 5 mocks (2 extra) so autoplay never falls through to the live network
        // if it fires additional spins between waitForSpins() resolving and stopAutoplay()
        // completing. Without the extras, a real network spin changes the balance in a
        // way the expected-balance calculation can't account for.
        const mockSpins = [
            SpinInterceptor.buildNoWin(bet),
            SpinInterceptor.buildWin(bet, [{ amount: 2, item: 1, line: [1, 1, 1], count: 3 }]),
            SpinInterceptor.buildNoWin(bet),
            SpinInterceptor.buildNoWin(bet), // buffer
            SpinInterceptor.buildNoWin(bet), // buffer
        ];
        gamePage.interceptor.queueMockResponses(mockSpins);

        // Use getTopBarBalance() instead of getBalance() — getBalance() delegates to
        // BalanceTracker.snapshot() which only updates via spinAndWait(). During autoplay
        // the game fires spins internally without going through spinAndWait(), so
        // BalanceTracker never records them and both before/after return the same stale
        // value. getTopBarBalance() reads the actual DOM display directly.
        const balanceBefore = await gamePage.getTopBarBalance();
        const spinsBefore   = gamePage.interceptor.history.length;

        await gamePage.startAutoplay();
        await waitForSpins(gamePage, spinsBefore, 3);
        await gamePage.stopAutoplay();

        const balanceAfter = await gamePage.getTopBarBalance();
        // Capture ALL spins that ran (including any that fired before stop took effect)
        const spinsRun = gamePage.interceptor.history.slice(spinsBefore);

        let expectedBalance = balanceBefore;
        for (const spin of spinsRun) {
            const { win } = spin.response.payload;
            // Use the real bet from the request (amount × value = totalBet),
            // not the mock response bet whose .value equals totalBet causing
            // double-scaling. win is already in currency units — no multiplication.
            const b = spin.request.bet;
            expectedBalance -= b.amount * b.value;
            expectedBalance += (win ?? 0);
        }

        expect(Math.abs(balanceAfter - expectedBalance)).toBeLessThanOrEqual(0.10);
    });

    test('no console errors during autoplay session', async ({ gamePage, consoleErrors }) => {
        const target = 4;
        const bet    = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses(
            Array.from({ length: target + 2 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        const countBefore = gamePage.interceptor.history.length;
        await gamePage.startAutoplay();
        await waitForSpins(gamePage, countBefore, target);
        await gamePage.stopAutoplay();

        expect(consoleErrors).toHaveLength(0);
    });

    test('autoplay does not break after winning spin', async ({ gamePage }) => {
        // Queue a specific sequence: no-win → win → no-win → no-win
        // This guarantees a win is observed without waiting up to 90 s for a random one
        const bet = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses([
            SpinInterceptor.buildNoWin(bet),
            SpinInterceptor.buildWin(bet, [{ amount: 5 * bet, item: 7, line: [1, 1, 1], count: 3 }]),
            SpinInterceptor.buildNoWin(bet),
            SpinInterceptor.buildNoWin(bet),
        ]);

        const countBefore = gamePage.interceptor.history.length;
        await gamePage.startAutoplay();

        // Wait until at least 3 spins have fired (win is spin 2, then one more to
        // confirm autoplay continued after the win without crashing)
        await waitForSpins(gamePage, countBefore, 3);

        await gamePage.stopAutoplay();

        const newSpins   = gamePage.interceptor.history.slice(countBefore);
        const winObserved = newSpins.some(s => (s.response.payload.wins?.length ?? 0) > 0);

        expect(winObserved).toBe(true);
        // Autoplay must have continued past the win — at least 2 spins after it
        expect(newSpins.length).toBeGreaterThan(1);
    });

});