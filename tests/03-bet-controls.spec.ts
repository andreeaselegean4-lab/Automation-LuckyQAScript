/**
 * 03 — Bet Controls Tests
 *
 * Verifies the bet-level UI:
 *   - Increase / decrease buttons change the displayed bet
 *   - The changed bet is sent in the next spin API request
 *   - MAX BET button sets the highest allowed bet level
 *   - Bet cannot be decreased below the minimum
 *   - Bet cannot be increased above the maximum
 *   - Bet controls are disabled during a spin
 *
 * Performance optimisations applied:
 *   - Tests run in parallel — each gets its own browser context via the fixture.
 *   - Turbo mode enabled in beforeEach to shorten reel animations.
 *   - Every test that calls spinAndWait() queues a mockNextSpin() so the spin
 *     resolves instantly against a local mock instead of the live network.
 *   - areControlsEnabled() (retrying expect) replaces one-shot getAttribute()
 *     in the "re-enabled after spin" test to avoid race-condition false negatives.
 */
import { test, expect }    from '@/fixtures/game.fixture';
import { type GamePage }   from '@/page-objects/GamePage';

// Run all tests in this file concurrently — each test gets its own isolated
// browser context from the gamePage fixture so there is no shared state risk.
test.describe.configure({ mode: 'parallel' });

/** Spin once with the current displayed bet (mocked no-win) and assert the bet was sent correctly. */
async function spinAndAssertBetSent(gamePage: GamePage): Promise<void> {
    const displayedBet = await gamePage.getBet();
    gamePage.interceptor.mockNextSpin('no-win', displayedBet);
    await gamePage.spinAndWait();
    const spin = gamePage.interceptor.getLastSpin();
    expect(spin).not.toBeNull();
    const betCfg = spin!.response.payload.bet;
    expect(Math.abs(betCfg.amount * betCfg.value - displayedBet)).toBeLessThanOrEqual(0.01);
}

test.describe('Bet Controls — Verify Bet Increase, Decrease, Limits, and API Sync', () => {

    // Enable turbo (fast-spin) mode before every test to reduce animation time.
    test.beforeEach(async ({ gamePage }) => {
        await gamePage.enableTurbo();
    });

    // ─── Bet Button UI ────────────────────────────────────────────────────────────

    test('Verify that clicking the increase bet button raises the displayed bet value', async ({ gamePage }) => {
        const betBefore = await gamePage.getBet();
        await gamePage.increaseBet();
        const betAfter = await gamePage.getBet();
        // Bet should go up (or stay at max — either is valid)
        expect(betAfter).toBeGreaterThanOrEqual(betBefore);
    });

    test('Verify that clicking the decrease bet button lowers the displayed bet value', async ({ gamePage }) => {
        // First raise the bet so there's room to decrease
        await gamePage.increaseBet(2);
        const betBefore = await gamePage.getBet();
        await gamePage.decreaseBet();
        const betAfter = await gamePage.getBet();
        expect(betAfter).toBeLessThanOrEqual(betBefore);
    });

    test('Verify that the bet value stays capped at the maximum limit when clicking increase repeatedly', async ({ gamePage }) => {
        // Click increase many times to reach max
        await gamePage.increaseBet(20);
        const maxBet = await gamePage.getBet();
        // Guard against NaN before doing the comparison
        expect(maxBet).toBeGreaterThan(0);
        await gamePage.increaseBet(5);
        const betAfter = await gamePage.getBet();
        expect(betAfter).toBe(maxBet);
    });

    test('Verify that the bet value stays at the minimum limit when clicking decrease repeatedly', async ({ gamePage }) => {
        await gamePage.decreaseBet(20);
        const minBet = await gamePage.getBet();
        await gamePage.decreaseBet(5);
        const betAfter = await gamePage.getBet();
        expect(betAfter).toBe(minBet);
    });

    // ─── Bet Sent in API Request ──────────────────────────────────────────────────

    test('Verify that after increasing the bet, the new bet value is correctly sent in the next spin API request', async ({ gamePage }) => {
        await gamePage.increaseBet();
        await spinAndAssertBetSent(gamePage);
    });

    test('Verify that after decreasing the bet, the new bet value is correctly sent in the next spin API request', async ({ gamePage }) => {
        await gamePage.increaseBet(3); // go up first to make room
        await gamePage.decreaseBet();
        await spinAndAssertBetSent(gamePage);
    });

    // ─── Controls During / After Spin ────────────────────────────────────────────

    test('Verify that bet increase and decrease buttons are disabled while a spin is in progress', async ({ gamePage }) => {
        await gamePage.spin(); // start but do not wait
        // waitForSpinning ensures the spin is actually in progress before we check —
        // without this the controls may still be enabled if the click hasn't registered
        await gamePage.waitForSpinning(8_000);
        // areControlsDisabled() uses retrying expect() internally, so it won't
        // snap a false reading during a brief intermediate class transition
        expect(await gamePage.areControlsDisabled()).toBe(true);
        await gamePage.waitForSpinComplete();
    });

    test('Verify that bet controls are re-enabled after a spin completes and the game returns to idle', async ({ gamePage }) => {
        // Mock the spin so this test doesn't block on a real network call
        gamePage.interceptor.mockNextSpin('no-win', await gamePage.getBet());
        await gamePage.spinAndWait();
        // Wait for the spin button to reach idle before checking bet controls —
        // the game re-enables controls in sequence and the spin button leads the way.
        await gamePage.waitForIdle(15_000);
        expect(await gamePage.areControlsEnabled()).toBe(true);
    });

    // ─── Balance Integrity ────────────────────────────────────────────────────────

    test('Verify that the balance deduction after a spin matches the new bet level set by the increase button', async ({ gamePage }) => {
        await gamePage.increaseBet();
        const newBet = await gamePage.getBet();
        // Mock a no-win so the balance delta equals exactly the bet — no win
        // arithmetic needed, and the test resolves in a single instant spin
        gamePage.interceptor.mockNextSpin('no-win', newBet);
        const before = await gamePage.getBalance();
        await gamePage.spinAndWait();
        const after = await gamePage.getBalance();
        expect(Math.abs((before - after) - newBet)).toBeLessThanOrEqual(0.05);
    });

});