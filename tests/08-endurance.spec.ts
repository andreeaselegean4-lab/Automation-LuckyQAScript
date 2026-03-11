/**
 * 08 — Endurance Tests
 *
 * Runs a large number of consecutive spins at maximum speed to surface:
 *   - Memory leaks (JS heap growth)
 *   - UI freezes (spin button stuck disabled)
 *   - Balance desync (running total diverges from API data)
 *   - Console errors that only appear after many cycles
 *   - State machine stalls
 *
 * Default: ENDURANCE_SPIN_COUNT spins (env var, defaults to 200).
 * Set to 500+ for overnight stability runs.
 *
 * This test has a long timeout — configured in playwright.config.ts per-suite.
 */
import { test, expect }   from '../src/fixtures/game.fixture';

const SPIN_COUNT    = parseInt(process.env.ENDURANCE_SPIN_COUNT ?? '200', 10);
const HEAP_MAX_MB   = 512; // alert if heap exceeds this threshold

test.describe('Endurance', () => {

  // Long timeout for this suite
  test.setTimeout(30 * 60 * 1_000); // 30 minutes

  test(`${SPIN_COUNT}-spin endurance run — no freezes or errors`, async ({ gamePage, consoleErrors }) => {
    // Enable turbo to run faster
    await gamePage.enableTurbo();

    const heapReadings: number[] = [];
    let progressLog = '';

    await gamePage.spinN(SPIN_COUNT, async (completed, total) => {
      // Log progress every 50 spins
      if (completed % 50 === 0 || completed === total) {
        const heap = await gamePage.getHeapMB();
        if (heap !== null) heapReadings.push(heap);
        progressLog = `[Endurance] ${completed}/${total} spins | heap: ${heap ?? 'n/a'} MB`;
        console.log(progressLog);
      }
    });

    // ── Assertions ────────────────────────────────────────────────────────

    // 1. No console errors
    if (consoleErrors.length > 0) {
      console.error('Console errors detected during endurance run:');
      consoleErrors.forEach(e => console.error(e));
    }
    expect(consoleErrors).toHaveLength(0);

    // 2. Spin button is still enabled (no freeze / state machine stall)
    const stillIdle = await gamePage.isSpinButtonEnabled();
    expect(stillIdle).toBe(true);

    // 3. All SPIN_COUNT spins were recorded
    expect(gamePage.interceptor.history.length).toBeGreaterThanOrEqual(SPIN_COUNT);

    // 4. Heap did not exceed threshold
    if (heapReadings.length > 0) {
      const maxHeap = Math.max(...heapReadings);
      console.log(`Peak heap: ${maxHeap} MB (threshold: ${HEAP_MAX_MB} MB)`);
      expect(maxHeap).toBeLessThan(HEAP_MAX_MB);
    }

    await gamePage.disableTurbo();
  });

  test('heap does not grow unboundedly over 100 spins', async ({ gamePage }) => {
    test.setTimeout(10 * 60 * 1_000);

    await gamePage.enableTurbo();

    const readings: { spin: number; heapMB: number }[] = [];

    for (let i = 0; i < 100; i++) {
      await gamePage.spinAndWait();
      if (i % 10 === 0) {
        const h = await gamePage.getHeapMB();
        if (h !== null) readings.push({ spin: i, heapMB: h });
      }
    }

    await gamePage.disableTurbo();

    if (readings.length < 4) {
      test.skip(true, 'performance.memory not available (non-Chrome browser)');
      return;
    }

    // Compare first quarter vs last quarter of readings
    const firstQuarter = readings.slice(0, Math.floor(readings.length / 4));
    const lastQuarter  = readings.slice(-Math.floor(readings.length / 4));
    const avgFirst = firstQuarter.reduce((s, r) => s + r.heapMB, 0) / firstQuarter.length;
    const avgLast  = lastQuarter.reduce((s, r) => s + r.heapMB, 0) / lastQuarter.length;

    console.log(`Heap growth: avg first quarter=${avgFirst.toFixed(1)} MB  last quarter=${avgLast.toFixed(1)} MB`);

    // Allow up to 50% growth — more than that suggests a leak
    const growth = avgLast / avgFirst;
    expect(growth).toBeLessThan(1.5);
  });

  test('balance integrity maintained over 100 spins', async ({ gamePage }) => {
    test.setTimeout(10 * 60 * 1_000);

    await gamePage.enableTurbo();

    const startBalance = await gamePage.getBalance();
    const startIdx     = gamePage.interceptor.history.length;

    await gamePage.spinN(100);

    await gamePage.disableTurbo();

    const endBalance = await gamePage.getBalance();
    const spins      = gamePage.interceptor.history.slice(startIdx);

    // Compute expected balance from API data
    let expected = startBalance;
    for (const s of spins) {
      const b = s.response.payload.bet;
      expected -= b.amount * b.value;
      expected += (s.response.payload.wins ?? []).reduce((sum: number, w: { amount: number }) => sum + w.amount, 0);
    }

    const drift = Math.abs(endBalance - expected);
    console.log(`Balance drift after 100 spins: ${drift.toFixed(4)}`);
    // Allow up to £0.50 drift over 100 spins (floating-point rounding tolerance)
    expect(drift).toBeLessThan(0.50);
  });

  test('game recovers if spin takes longer than expected', async ({ gamePage }) => {
    // Simulate a slow network by adding a 2s delay via route interception
    await gamePage.page.route('**/demoplay', async route => {
      await new Promise(resolve => setTimeout(resolve, 2_000));
      await route.continue();
    });

    // The spin should still complete within waitForSpinComplete's 20s timeout
    await gamePage.spinAndWait();

    const enabled = await gamePage.isSpinButtonEnabled();
    expect(enabled).toBe(true);

    // Remove the slow route
    await gamePage.page.unroute('**/demoplay');
  });

});
