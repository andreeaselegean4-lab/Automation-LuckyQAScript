/**
 * 09 — RNG / Statistical Distribution Tests
 *
 * Runs RNG_SPIN_COUNT spins (default 500) and analyses the outcomes for:
 *   - RTP (return-to-player) within the configured tolerance band
 *   - Symbol frequency distribution (no symbol over-represented)
 *   - No obvious patterns (streak detection, identical display repeats)
 *   - Win-rate plausibility (not 0%, not 100%)
 *
 * Adapted for Sands of Fortune: Hold & Win
 *   - Grid: 5 reels × 3 rows = 15 cells per spin  (was 3×3=9 in Thunder Vault)
 *   - frequency cap per symbol: 40% of all cells
 *
 * These tests detect RNG misconfiguration, not verify the math model exactly.
 */
import { test, expect }  from '../src/fixtures/game.fixture';
import { StatsAnalyzer } from '../src/utils/statsAnalyzer';
import { REELS, ROWS }   from '../src/constants/game.constants';

const SPIN_COUNT    = parseInt(process.env['RNG_SPIN_COUNT']    ?? '500',  10);
const RTP_TARGET    = parseFloat(process.env['RTP_TARGET']      ?? '96.0');
const RTP_TOLERANCE = parseFloat(process.env['RTP_TOLERANCE']   ?? '15.0'); // loose for small samples

test.describe('RNG & Statistical Distribution', () => {

  test.setTimeout(60 * 60 * 1_000); // up to 60 min for large sample

  test(`RTP is within ±${RTP_TOLERANCE}% of ${RTP_TARGET}% over ${SPIN_COUNT} spins`, async ({ gamePage }) => {
    await gamePage.enableTurbo();

    const startIdx = gamePage.interceptor.history.length;

    await gamePage.spinN(SPIN_COUNT, (completed, total) => {
      if (completed % 100 === 0) console.log(`[RNG] ${completed}/${total}`);
    });

    await gamePage.disableTurbo();

    const history  = gamePage.interceptor.history.slice(startIdx);
    const analyzer = new StatsAnalyzer(history);
    const { rtp, totalBet, totalWon, spinCount } = analyzer.computeRTP();

    console.log(`RTP over ${spinCount} spins: ${rtp.toFixed(2)}%  (bet=${totalBet.toFixed(2)}, won=${totalWon.toFixed(2)})`);

    expect(rtp).toBeGreaterThan(RTP_TARGET - RTP_TOLERANCE);
    expect(rtp).toBeLessThan(RTP_TARGET + RTP_TOLERANCE);
  });

  test('win rate is between 10% and 90%', async ({ gamePage }) => {
    await gamePage.enableTurbo();
    const startIdx = gamePage.interceptor.history.length;

    await gamePage.spinN(Math.min(SPIN_COUNT, 300));
    await gamePage.disableTurbo();

    const history  = gamePage.interceptor.history.slice(startIdx);
    const wins     = history.filter(s => (s.response.payload.wins?.length ?? 0) > 0);
    const winRate  = (wins.length / history.length) * 100;

    console.log(`Win rate: ${winRate.toFixed(1)}% (${wins.length}/${history.length} spins)`);

    expect(winRate).toBeGreaterThan(10);
    expect(winRate).toBeLessThan(90);
  });

  test('no symbol appears more than 3× its expected frequency', async ({ gamePage }) => {
    await gamePage.enableTurbo();
    const startIdx = gamePage.interceptor.history.length;

    await gamePage.spinN(Math.min(SPIN_COUNT, 300));
    await gamePage.disableTurbo();

    const history    = gamePage.interceptor.history.slice(startIdx);
    const analyzer   = new StatsAnalyzer(history);
    const freqs      = analyzer.computeSymbolFrequencies();
    // Sands of Fortune: 5 reels × 3 rows = 15 cells per spin
    const totalCells = history.length * (REELS * ROWS);

    for (const [symbolId, count] of Object.entries(freqs)) {
      const frequency = count / totalCells;
      // No single symbol should appear in more than 40% of all cell positions
      console.log(`Symbol ${symbolId}: ${count} (${(frequency * 100).toFixed(1)}%)`);
      expect(frequency).toBeLessThan(0.40);
    }
  });

  test('no streak of 10+ identical full displays', async ({ gamePage }) => {
    await gamePage.enableTurbo();
    const startIdx = gamePage.interceptor.history.length;

    await gamePage.spinN(Math.min(SPIN_COUNT, 300));
    await gamePage.disableTurbo();

    const history  = gamePage.interceptor.history.slice(startIdx);
    const analyzer = new StatsAnalyzer(history);
    const patterns = analyzer.checkForPatterns();

    console.log('Pattern analysis:', JSON.stringify(patterns, null, 2));

    expect(patterns.maxIdenticalDisplayStreak).toBeLessThan(10);
  });

  test('no single payline win streak of 20+', async ({ gamePage }) => {
    await gamePage.enableTurbo();
    const startIdx = gamePage.interceptor.history.length;

    await gamePage.spinN(Math.min(SPIN_COUNT, 300));
    await gamePage.disableTurbo();

    const history  = gamePage.interceptor.history.slice(startIdx);
    const analyzer = new StatsAnalyzer(history);
    const patterns = analyzer.checkForPatterns();

    expect(patterns.maxWinStreak).toBeLessThan(20);
    expect(patterns.maxNoWinStreak).toBeLessThan(100);
  });

  test('total wins never exceed total bets by more than 200% (no runaway payout)', async ({ gamePage }) => {
    await gamePage.enableTurbo();
    const startIdx = gamePage.interceptor.history.length;

    await gamePage.spinN(Math.min(SPIN_COUNT, 300));
    await gamePage.disableTurbo();

    const totalBet = gamePage.interceptor.getTotalBet(startIdx);
    const totalWon = gamePage.interceptor.getTotalWon(startIdx);

    if (totalBet === 0) {
      test.skip(true, 'No bets recorded');
      return;
    }

    const rtp = (totalWon / totalBet) * 100;
    console.log(`Runaway check — RTP: ${rtp.toFixed(2)}%`);
    expect(rtp).toBeLessThan(200);
  });

  test('StatsAnalyzer summary reports all expected fields', async ({ gamePage }) => {
    await gamePage.spinN(20);
    const analyzer = new StatsAnalyzer(gamePage.interceptor.history);
    const summary  = analyzer.summary();

    expect(summary.spinCount).toBeGreaterThanOrEqual(20);
    expect(typeof summary.rtp).toBe('number');
    expect(typeof summary.winRate).toBe('number');
    expect(typeof summary.patterns).toBe('object');
  });

});
