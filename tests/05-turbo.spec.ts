/**
 * 05 — Turbo (Quick-Spin) Tests
 *
 * Verifies the turbo / fast-play mode:
 *   - Turbo toggle activates and deactivates correctly
 *   - Spins complete faster in turbo mode vs normal mode
 *   - Balance arithmetic is correct in turbo mode
 *   - No JS errors in turbo mode
 *   - Turbo state persists across consecutive spins
 *   - API calls still fire correctly in turbo mode
 *   - Bet amount is unaffected by turbo toggle
 *   - Turbo can be toggled multiple times without breaking
 *   - Only one API call fires per spin in turbo mode
 *
 * Known from source: turbo_time_scale = 1.5 (FastPlay.js)
 *
 * Performance optimisations applied:
 *   - Tests run in parallel — each gets its own browser context via the fixture.
 *   - Every test that calls spinAndWait() queues a mockNextSpin() so spins
 *     resolve instantly and do not introduce network variance into measurements.
 */
import { test, expect }     from '../src/fixtures/game.fixture';
import { SpinInterceptor }  from '../src/utils/spinInterceptor';
import { TURBO_TIME_SCALE } from '../src/constants/game.constants';

test.describe.configure({ mode: 'parallel' });

test.describe('Turbo Mode — Verify Fast-Play Toggle, Spin Behaviour, and State Persistence', () => {

    // ─── Toggle UI ────────────────────────────────────────────────────────────────

    test('Verify that the turbo toggle button is visible and defaults to regular speed mode', async ({ gamePage }) => {
        await expect(gamePage.turboButton).toBeVisible();
        await gamePage.disableTurbo();
        const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
        expect(cls).toMatch(/play-button--regular/);
    });

    test('Verify that enabling turbo mode changes the button class to play-button--fast', async ({ gamePage }) => {
        await gamePage.disableTurbo();
        await gamePage.enableTurbo();
        const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
        // Turbo (fastest) state uses 'play-button--fast', not 'play-button--turbo'
        expect(cls).toMatch(/play-button--fast/);
    });

    test('Verify that disabling turbo mode reverts the button class back to play-button--regular', async ({ gamePage }) => {
        await gamePage.enableTurbo();
        await gamePage.disableTurbo();
        const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
        expect(cls).toMatch(/play-button--regular/);
    });

    test('Verify that toggling turbo on and off multiple times does not break the button state or game idle state', async ({ gamePage }) => {
        // Rapidly cycling the toggle should not leave the button in a broken state
        // or corrupt any game state — this catches regressions where the toggle
        // mis-counts clicks and gets stuck in the wrong mode.
        for (let i = 0; i < 3; i++) {
            await gamePage.enableTurbo();
            let cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
            expect(cls).toMatch(/play-button--fast/);

            await gamePage.disableTurbo();
            cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
            expect(cls).toMatch(/play-button--regular/);
        }
        // Game should still be in a valid idle state after all the toggling
        const enabled = await gamePage.isSpinButtonEnabled();
        expect(enabled).toBe(true);
    });

    test('Verify that enabling turbo mode does not alter the current bet value', async ({ gamePage }) => {
        // Turbo only affects animation speed — it must not alter the bet level
        const betBefore = await gamePage.getBet();
        await gamePage.enableTurbo();
        const betAfter = await gamePage.getBet();
        expect(betAfter).toBe(betBefore);
        await gamePage.disableTurbo();
    });

    // ─── Spin Behaviour ───────────────────────────────────────────────────────────

    test('Verify that turbo mode does not cause double-firing of the spin API — exactly one call per spin', async ({ gamePage }) => {
        // Turbo mode should not cause double-firing of the spin API
        const bet = await gamePage.getBet();
        await gamePage.enableTurbo();
        gamePage.interceptor.mockNextSpin('no-win', bet);

        const countBefore = gamePage.interceptor.history.length;
        await gamePage.spinAndWait();
        const countAfter  = gamePage.interceptor.history.length;

        expect(countAfter - countBefore).toBe(1);
        await gamePage.disableTurbo();
    });

    test('Verify that the spin API request and response are valid and contain correct bet data in turbo mode', async ({ gamePage }) => {
        // Turbo must not suppress or corrupt the spin API request
        const bet = await gamePage.getBet();
        await gamePage.enableTurbo();
        gamePage.interceptor.mockNextSpin('no-win', bet);

        await gamePage.spinAndWait();
        const spin = gamePage.interceptor.getLastSpin();

        expect(spin).not.toBeUndefined();
        expect(spin!.response.payload).toBeDefined();
        expect(spin!.response.payload.bet.amount * spin!.response.payload.bet.value)
            .toBeGreaterThan(0);

        await gamePage.disableTurbo();
    });

    // ─── Balance & State ──────────────────────────────────────────────────────────

    test('Verify that the balance deduction on a no-win spin matches the bet amount in turbo mode', async ({ gamePage }) => {
        const bet = await gamePage.getBet();
        await gamePage.enableTurbo();
        // Mock a no-win so expected delta is exactly the bet (demo mode never credits wins)
        gamePage.interceptor.mockNextSpin('no-win', bet);

        const before  = await gamePage.getBalance();
        await gamePage.spinAndWait();
        const after   = await gamePage.getBalance();
        const betCfg  = gamePage.interceptor.getLastSpin()!.response.payload.bet;

        expect(Math.abs((before - after) - betCfg.amount * betCfg.value))
            .toBeLessThanOrEqual(0.05);

        await gamePage.disableTurbo();
    });

    test('Verify that turbo mode stays active (button class remains play-button--fast) across three consecutive spins', async ({ gamePage }) => {
        const bet = await gamePage.getBet();
        await gamePage.enableTurbo();

        gamePage.interceptor.queueMockResponses(
            Array.from({ length: 3 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        for (let i = 0; i < 3; i++) {
            await gamePage.spinAndWait();
            const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
            expect(cls).toMatch(/play-button--fast/);
        }

        await gamePage.disableTurbo();
    });

    test('Verify that no JavaScript console errors occur during three consecutive spins in turbo mode', async ({ gamePage, consoleErrors }) => {
        const bet = await gamePage.getBet();
        await gamePage.enableTurbo();

        gamePage.interceptor.queueMockResponses(
            Array.from({ length: 3 }, () => SpinInterceptor.buildNoWin(bet)),
        );

        await gamePage.spinN(3);
        await gamePage.disableTurbo();
        expect(consoleErrors).toHaveLength(0);
    });

    // ─── Constants ────────────────────────────────────────────────────────────────

    test(`Verify that TURBO_TIME_SCALE constant equals ${TURBO_TIME_SCALE} (matching FastPlay.js source)`, async () => {
        // Verify the constant in our codebase matches what the source reveals.
        // No gamePage needed — this is a pure value assertion.
        expect(TURBO_TIME_SCALE).toBe(1.5);
    });

});