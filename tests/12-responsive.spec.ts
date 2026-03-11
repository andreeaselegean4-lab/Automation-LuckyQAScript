/**
 * 12 — Responsive Layout Tests
 *
 * Verifies the game renders correctly across a range of viewport sizes
 * representing mobile, tablet, and desktop devices.
 *
 * For each viewport:
 *   - Page loads without JS errors
 *   - Spin button is visible and clickable
 *   - Balance display is visible
 *   - A spin completes successfully (state machine intact)
 *   - No elements overflow the viewport (horizontal scrollbar check)
 *
 * Since all visuals render on a WebGL canvas (auto-scaled by the framework),
 * the primary risk is the HTML overlay controls not fitting or overlapping.
 */
import { test as base, expect } from '@playwright/test';
import { GamePage } from '../src/page-objects/GamePage';

// ── Viewport Definitions ─────────────────────────────────────────────────────

interface ViewportDef {
  label:  string;
  width:  number;
  height: number;
}

const VIEWPORTS: ViewportDef[] = [
  { label: 'iPhone SE (375×667)',           width: 375,  height: 667  },
  { label: 'iPhone 14 Pro (393×852)',       width: 393,  height: 852  },
  { label: 'iPad Mini (768×1024)',          width: 768,  height: 1024 },
  { label: 'iPad Pro landscape (1194×834)', width: 1194, height: 834  },
  { label: 'Laptop (1280×720)',             width: 1280, height: 720  },
  { label: 'Full HD (1920×1080)',           width: 1920, height: 1080 },
];

// ── Per-viewport test generation ─────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  base.describe(`Responsive — ${vp.label}`, () => {

    base.use({ viewport: { width: vp.width, height: vp.height } });

    let gamePage: GamePage;
    let consoleErrors: string[];

    base.beforeEach(async ({ page }) => {
      const url = process.env.GAME_URL;
      if (!url) throw new Error('GAME_URL not set');

      consoleErrors = GamePage.attachErrorListener(page);
      gamePage = new GamePage(page);
      await gamePage.interceptor.install();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait for assets to load
      await page.waitForSelector('.loading-screen.ready', { timeout: 60_000 });
      await page.waitForTimeout(2_000);

      // Click the CONTINUE button — on smaller viewports it may sit at a
      // different Y coordinate, so we use the viewport center-X and ~95% Y.
      const centerX = Math.round(vp.width / 2);
      const continueY = Math.round(vp.height * 0.95);
      await page.mouse.click(centerX, continueY);

      // Wait for idle
      await gamePage.waitForIdle(20_000);
      await gamePage.balance.init();
    });

    base('no JS errors on load', async () => {
      expect(consoleErrors).toHaveLength(0);
    });

    base('spin button is visible', async () => {
      await expect(gamePage.spinButton).toBeVisible();
    });

    base('balance display is visible', async () => {
      await expect(gamePage.balanceDisplay).toBeVisible();
    });

    base('balance is a positive number', async () => {
      const balance = await gamePage.getBalance();
      expect(balance).toBeGreaterThan(0);
    });

    base('a spin completes without error', async () => {
      await gamePage.spinAndWait();
      const idle = await gamePage.isSpinButtonEnabled();
      expect(idle).toBe(true);
      expect(consoleErrors).toHaveLength(0);
    });

    base('no horizontal overflow (no scrollbar)', async ({ page }) => {
      const hasHScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHScroll).toBe(false);
    });

    base('bet value is readable', async () => {
      const bet = await gamePage.getBet();
      expect(bet).toBeGreaterThan(0);
    });

  });
}
