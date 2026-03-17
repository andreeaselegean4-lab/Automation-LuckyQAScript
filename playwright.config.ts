import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment-specific .env file.
// Usage: ENV=toucan npx playwright test
// Falls back to .env if ENV is not set.
const envFile = process.env['ENV'] ? `.env.${process.env['ENV']}` : '.env.NovomaticGames';
dotenv.config({ path: envFile });

export default defineConfig({
  testDir:     './tests',
  globalSetup: './global-setup.ts',

  // Per-test timeout — spins take ~2-3s, bonus rounds ~10s, endurance tests longer
  timeout: 90_000,
  expect: { timeout: 15_000 },

  // fullyParallel: false keeps tests within a file sequential by default.
  // Individual test files opt in to intra-file parallelism via
  // test.describe.configure({ mode: 'parallel' }), which runs safely because
  // each test gets its own browser context and gstoken from the fixture.
  fullyParallel: false,

  // Run multiple test FILES concurrently.
  workers: process.env['CI'] ? 2 : 4,

  // Retry once on CI to absorb transient network issues
  retries: process.env['CI'] ? 1 : 0,

  reporter: [
    ['html',  { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json',  { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env['BASE_URL'] || 'https://gs.avocadospins.com',

    headless: false,

    // Fixed viewport for deterministic coordinate-based fallbacks
    viewport: { width: 1280, height: 720 },

    screenshot:          'only-on-failure',
    video:               'retain-on-failure',
    trace:               'retain-on-failure',
    ignoreHTTPSErrors:   true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // SwiftShader WebGL so the PixiJS canvas renders correctly in headless mode
        launchOptions: {
          args: [
            '--disable-web-security',
            '--use-angle=metal',
            '--ignore-gpu-blocklist',
            '--enable-webgl',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],

  outputDir: 'test-results',
});
