/**
 * game.fixture.ts
 *
 * Playwright custom fixtures for Sands of Fortune automation.
 *
 * Fixtures provided:
 *
 *   gamePage      — Fully initialised GamePage instance.
 *                   Navigates to GAME_URL, waits for load, dismisses intro,
 *                   initialises the balance tracker, and installs the
 *                   spin interceptor — all before the test body runs.
 *
 *   consoleErrors — Mutable string[] that accumulates every console.error
 *                   and uncaught page exception during the test.
 *                   Populated from the moment the fixture is created so errors
 *                   that occur during load are captured.
 *
 *   gameUrl       — The raw GAME_URL string (from .env).
 *                   Used by session-persistence tests that reload the page.
 *
 *   gameDebugUrl  — GAME_URL_DEBUG string (from .env).
 *                   Used by edge-case and bonus tests that need ?debug=true.
 */

import { test as base } from '@playwright/test';
import { GamePage }     from '../page-objects/GamePage';

// ── Fixture type declarations ─────────────────────────────────────────────────

interface GameFixtures {
  gamePage:     GamePage;
  consoleErrors: string[];
  gameUrl:      string;
  gameDebugUrl: string;
}

// ── Extended test / expect ────────────────────────────────────────────────────

export const test = base.extend<GameFixtures>({

  // ── consoleErrors ─────────────────────────────────────────────────────────
  // Attach error listener first so errors during load are captured.
  // eslint-disable-next-line no-empty-pattern
  consoleErrors: async ({ page }, use) => {
    const errors = GamePage.attachErrorListener(page);
    await use(errors);
  },

  // ── gameUrl ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line no-empty-pattern
  gameUrl: async ({}, use) => {
    const url = process.env['GAME_URL'];
    if (!url) throw new Error('GAME_URL is not set — copy .env.example to .env and fill in the token');
    await use(url);
  },

  // ── gameDebugUrl ──────────────────────────────────────────────────────────
  // eslint-disable-next-line no-empty-pattern
  gameDebugUrl: async ({}, use) => {
    const url = process.env['GAME_URL_DEBUG'] ?? (process.env['GAME_URL'] ? `${process.env['GAME_URL']}&debug=true` : '');
    if (!url) throw new Error('GAME_URL_DEBUG (or GAME_URL) is not set');
    await use(url);
  },

  // ── gamePage ──────────────────────────────────────────────────────────────
  // Depends on `gameUrl` to know where to navigate.
  gamePage: async ({ page, gameUrl }, use) => {
    const gamePage = new GamePage(page);
    await gamePage.load(gameUrl);
    await use(gamePage);
    // No teardown needed — Playwright disposes the page automatically
  },
});

export { expect } from '@playwright/test';
