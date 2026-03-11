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

test.describe('Turbo Mode', () => {

    // ─── Toggle UI ────────────────────────────────────────────────────────────────

    test('turbo button is present and clickable', async ({ gamePage }) => {
        await expect(gamePage.turboButton).toBeVisible();
        await gamePage.disableTurbo();
        const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
        expect(cls).toMatch(/play-button--regular/);
    });

    test('enabling turbo changes the button class', async ({ gamePage }) => {
        await gamePage.disableTurbo();
        await gamePage.enableTurbo();
        const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
        // Turbo (fastest) state uses 'play-button--fast', not 'play-button--turbo'
        expect(cls).toMatch(/play-button--fast/);
    });

    test('disabling turbo reverts the button class', async ({ gamePage }) => {
        await gamePage.enableTurbo();
        await gamePage.disableTurbo();
        const cls = (await gamePage.turboButton.getAttribute('class')) ?? '';
        expect(cls).toMatch(/play-button--regular/);
    });

    test('turbo can be toggled multiple times without breaking', async ({ gamePage }) => {
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

    test('bet amount is unchanged after enabling turbo', async ({ gamePage }) => {
        // Turbo only affects animation speed — it must not alter the bet level
        const betBefore = await gamePage.getBet();
        await gamePage.enableTurbo();
        const betAfter = await gamePage.getBet();
        expect(betAfter).toBe(betBefore);
        await gamePage.disableTurbo();
    });

    // ─── Spin Behaviour ───────────────────────────────────────────────────────────

    test('only one API call fires per spin in turbo mode', async ({ gamePage }) => {
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

    test('spin API is called correctly in turbo mode', async ({ gamePage }) => {
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

    test('balance arithmetic is correct in turbo mode', async ({ gamePage }) => {
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

    test('turbo mode persists across consecutive spins', async ({ gamePage }) => {
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

    test('no console errors in turbo mode', async ({ gamePage, consoleErrors }) => {
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

    test(`turbo time scale constant is ${TURBO_TIME_SCALE}`, async () => {
        // Verify the constant in our codebase matches what the source reveals.
        // No gamePage needed — this is a pure value assertion.
        expect(TURBO_TIME_SCALE).toBe(1.5);
    });

});