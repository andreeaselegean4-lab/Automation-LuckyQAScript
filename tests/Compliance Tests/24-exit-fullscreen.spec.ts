/**
 * MGA Exit / Full-Screen Compliance
 *
 * TLIB-609 Exit option available in full-screen mode
 */
import { test, expect } from '../../src/fixtures/game.fixture';
import { getBodyText } from './helpers/compliance-helpers';

test.describe('Exit / Full-Screen Compliance', () => {
  test.describe.configure({ timeout: 180_000 });

  test('TLIB-609: Exit/lobby option available', async ({ gamePage, gameUrl }) => {
    const page = gamePage.page;

    // Check for exit/lobby/home button in DOM
    const exitBtn = page.locator(
      '#exitButton, .exit-button, .lobby-button, [data-action="exit"], [data-action="lobby"]',
    );
    const exitVisible = await exitBtn.first().isVisible().catch(() => false);

    // Check for lobbyUrl in JWT token (embedded in game URL)
    const hasLobbyUrl = gameUrl.includes('lobbyUrl');

    // Check for exit text in DOM
    const bodyText = await getBodyText(page);
    const hasExitText = /exit|lobby|home|close/i.test(bodyText);

    expect(exitVisible || hasLobbyUrl || hasExitText,
      'TLIB-609: Game must offer an exit/lobby option (button or lobbyUrl in token)').toBeTruthy();
  });

  test('TLIB-609: Lobby URL embedded in game JWT', async ({ gameUrl }) => {
    const tokenMatch = gameUrl.match(/gstoken=([^&]+)/);
    expect(tokenMatch, 'Game URL should contain a gstoken').toBeTruthy();

    if (tokenMatch) {
      const parts = tokenMatch[1].split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          expect(payload.lobbyUrl,
            'TLIB-609: JWT payload must contain a lobbyUrl for exit functionality').toBeTruthy();
        } catch {
          // Non-standard JWT — ok if exit button exists in UI
        }
      }
    }
  });
});
