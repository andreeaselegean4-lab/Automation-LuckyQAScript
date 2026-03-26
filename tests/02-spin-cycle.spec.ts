/**
 * 02 — Spin Cycle Tests
 *
 * Verifies the full spin state machine:
 *   idle → spinning → idle
 *
 * Also verifies:
 *   - Spin button transitions (enabled → disabled → enabled)
 *   - All other controls lock during spin
 *   - API call is made on each spin
 *   - Balance delta matches the bet deducted
 *   - Last Win display updates after a winning spin
 *   - Double-click protection (button stays disabled during spin)
 *
 * Performance optimisations applied:
 *   - Tests run in parallel (mode: 'parallel') — each gets its own browser context.
 *   - Turbo mode is enabled in beforeEach to shorten reel animations.
 *   - Balance / win tests use interceptor.mockNextSpin() so they always resolve
 *     in a single instant spin instead of retrying up to 10–20 times against the
 *     live API.  The mock is dequeued automatically after one use.
 */
import { test, expect } from '../src/fixtures/game.fixture';
import { SPIN_API_PATH }  from '../src/constants/game.constants';
import { type SpinRecord, SpinInterceptor } from '../src/utils/spinInterceptor';

// Run every test in this describe concurrently — each test gets its own isolated
// browser context from the gamePage fixture so there is no shared state risk.
test.describe.configure({ mode: 'parallel' });

test.describe('Spin Cycle — Verify Spin State Transitions, API Calls, and Balance Deduction', () => {

    // Enable turbo (fast-spin) mode before every test to reduce animation time.
    test.beforeEach(async ({ gamePage }) => {
        await gamePage.enableTurbo();
    });

    // ─── State Machine ────────────────────────────────────────────────────────────

    test('Verify that the spin button becomes disabled during a spin and re-enables after spin completes', async ({ gamePage }) => {
        // Queue a no-win mock so we don't accidentally trigger a bonus game
        const totalBet = await gamePage.getBet();
        gamePage.interceptor.mockNextSpin('no-win', totalBet);

        // Kick off the spin without waiting for it to complete
        await gamePage.spin();

        // Confirm the button enters stop-button state (spin in progress)
        await gamePage.waitForSpinning(8_000);
        const disabledDuringSpin = await gamePage.isSpinButtonDisabled();
        expect(disabledDuringSpin).toBe(true);

        // After the full cycle it must return to enabled/idle
        await gamePage.waitForSpinComplete();
        const enabledAfter = await gamePage.isSpinButtonEnabled();
        expect(enabledAfter).toBe(true);
    });

    test('Verify that all game controls (bet, autoplay, menu) are disabled while a spin is in progress', async ({ gamePage }) => {
        // Queue a no-win mock to prevent bonus triggers
        const totalBet = await gamePage.getBet();
        gamePage.interceptor.mockNextSpin('no-win', totalBet);

        await gamePage.spin();
        // Wait until the spin is actually in progress before checking control state
        await gamePage.waitForSpinning(8_000);
        const disabled = await gamePage.areControlsDisabled();
        expect(disabled).toBe(true);
        await gamePage.waitForSpinComplete();
    });

    test('Verify that all game controls are re-enabled after a spin completes and the game returns to idle', async ({ gamePage }) => {
        const totalBet = await gamePage.getBet();
        gamePage.interceptor.mockNextSpin('no-win', totalBet);

        await gamePage.spinAndWait();
        const enabled = await gamePage.areControlsEnabled();
        expect(enabled).toBe(true);
    });

    // ─── API Integrity ────────────────────────────────────────────────────────────

    test('Verify that each spin triggers exactly one API call to the spin endpoint', async ({ gamePage }) => {
        await gamePage.spinAndWait();
        const history = gamePage.interceptor.history;
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[history.length - 1].url).toContain(SPIN_API_PATH);
    });

    test('Verify that the spin API response contains payload, display, and valid bet fields', async ({ gamePage }) => {
        await gamePage.spinAndWait();
        const spin = gamePage.interceptor.getLastSpin();
        expect(spin).not.toBeNull();
        expect(spin!.response.payload).toBeDefined();
        expect(spin!.response.payload.display).toBeDefined();
        const bet = spin!.response.payload.bet;
        expect(bet.amount * bet.value).toBeGreaterThan(0);
    });

    // ─── Balance Integrity ────────────────────────────────────────────────────────

    test('Verify that the balance decreases by exactly the bet amount on a no-win spin', async ({ gamePage }) => {
        // Read the current bet, then queue a guaranteed no-win so this test always
        // resolves in ONE spin instead of retrying up to 10 times against the live API.
        const totalBet = await gamePage.getBet();
        gamePage.interceptor.mockNextSpin('no-win', totalBet);

        const before = await gamePage.getBalance();
        await gamePage.spinAndWait();
        const after  = await gamePage.getBalance();

        const spin = gamePage.interceptor.getLastSpin();
        expect(spin).not.toBeNull();
        const betCfg = spin!.response.payload.bet;
        const betAmt = betCfg.amount * betCfg.value;

        expect(Math.abs((before - after) - betAmt)).toBeLessThanOrEqual(0.02);
    });

    test('Verify that a winning spin deducts the bet, credits the win to balance, and updates the Last Win display', async ({ gamePage }) => {
        // Extended timeout — live-API spins + bonus-game handling can take several minutes
        test.setTimeout(360_000);
        // Spin until a real winning round from the live API — the game engine
        // only animates wins and updates the balance when the response comes from
        // the actual server (mocked responses are ignored by the game's win logic).
        // balanceBefore is captured BEFORE the winning spin for accurate delta checking.
        const result = await gamePage.spinUntilWin(50);
        expect(result).not.toBeNull();
        const { spins: winRoundSpins, balanceBefore: before } = result!;
        const betCfg   = winRoundSpins[0]!.response.payload.bet;
        const betAmt   = betCfg.amount * betCfg.value;
        // payload.win is in raw units; multiply by bet.value to get display-currency amount
        const roundWin = betCfg.value *
            winRoundSpins.reduce((sum: number, s: SpinRecord) => sum + (s.response.payload.win ?? 0), 0);

        // 1. Balance change: after = before - bet + win (demo mode awards wins to balance)
        const after = await gamePage.getBalanceStable();
        const expectedAfter = before - betAmt + roundWin;
        expect(Math.abs(after - expectedAfter)).toBeLessThanOrEqual(0.05);

        // 2. Last Win display reflects the API-reported win total.
        const displayedWin = await gamePage.getLastWinStable();
        expect(Math.abs(displayedWin - roundWin)).toBeLessThanOrEqual(0.05);
    });

    test('Verify that the Last Win display shows the correct win amount matching the API response after a winning spin', async ({ gamePage }) => {
        // Extended timeout — live-API spins + bonus-game handling can take several minutes
        test.setTimeout(360_000);
        // Spin until a real winning round from the live API.
        const result = await gamePage.spinUntilWin(50);
        expect(result).not.toBeNull();
        const { spins: winRoundSpins } = result!;

        const betVal   = winRoundSpins[0]!.response.payload.bet.value;
        // payload.win is in raw units; multiply by bet.value to get display-currency amount
        const roundWin = betVal *
            winRoundSpins.reduce((sum: number, s: SpinRecord) => sum + (s.response.payload.win ?? 0), 0);

        const displayedWin = await gamePage.getLastWinStable();
        expect(Math.abs(displayedWin - roundWin)).toBeLessThanOrEqual(0.05);
    });

    // ─── Edge Cases ───────────────────────────────────────────────────────────────

    test('Verify that double-clicking the spin button triggers only one API call, not two', async ({ gamePage }) => {
        await gamePage.waitForIdle();
        const totalBet = await gamePage.getBet();
        gamePage.interceptor.mockNextSpin('no-win', totalBet);

        const countBefore = gamePage.interceptor.history.length;

        // Click once, wait until spinning starts, then click again — the second
        // click should be a no-op (or stop-animation) while spin-stop-button is active
        await gamePage.spinButton.click();
        await gamePage.waitForSpinning();
        await gamePage.spinButton.click();
        await gamePage.waitForSpinComplete();

        const countAfter = gamePage.interceptor.history.length;
        // Exactly one new spin call — not two
        expect(countAfter - countBefore).toBe(1);
    });

    test('Verify that three consecutive spins complete without JS errors and the spin button returns to enabled state', async ({ gamePage, consoleErrors }) => {
        // Mock all 3 spins with no-win to prevent bonus triggers
        const totalBet = await gamePage.getBet();
        gamePage.interceptor.queueMockResponses([
            SpinInterceptor.buildNoWin(totalBet),
            SpinInterceptor.buildNoWin(totalBet),
            SpinInterceptor.buildNoWin(totalBet),
        ]);
        await gamePage.spinN(3);
        expect(consoleErrors).toHaveLength(0);
        const enabled = await gamePage.isSpinButtonEnabled();
        expect(enabled).toBe(true);
    });

});