import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import * as path from 'path';

// Linux-only: mirrors topRightPosition() in src/main.ts (Linux AppIndicator/
// StatusNotifierItem trays report zeroed-out bounds, so the popover opens at
// the work area's top-right corner regardless of the real tray position).
// The formula is duplicated here on purpose rather than imported, so this
// test verifies actual runtime behavior instead of just calling back into
// the same code it's meant to check.
test.skip(process.platform !== 'linux', 'topRightPosition() is Linux-only');

test.describe('tray click opens the popover in the right place', () => {
  let electronApp: ElectronApplication;
  let popoverPage: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..', 'dist', 'main.js')],
      env: { ...process.env, MEANWAILE_E2E: '1' },
    });
    popoverPage = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  // Attaches a screenshot of the popover to the HTML report whenever the
  // test fails, so a visual regression (wrong position, blank/black window,
  // etc.) can be inspected without reproducing it locally - the report is
  // uploaded as a downloadable CI artifact (see ci.yml).
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    try {
      const screenshot = await popoverPage.screenshot();
      await testInfo.attach('popover-screenshot', { body: screenshot, contentType: 'image/png' });
    } catch (err) {
      console.warn('[e2e] could not capture failure screenshot:', err);
    }
  });

  test('popover opens at the work area top-right when the tray icon is clicked', async () => {
    const workArea = await electronApp.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);

    await electronApp.evaluate(() => (global as any).__meanwaile_e2e__.clickTray());

    await expect
      .poll(async () => electronApp.evaluate(() => (global as any).__meanwaile_e2e__.getPopoverBounds()))
      .not.toBeNull();

    const bounds = await electronApp.evaluate(() => (global as any).__meanwaile_e2e__.getPopoverBounds());

    const margin = 8;
    expect(bounds.x).toBe(workArea.x + workArea.width - bounds.width - margin);
    expect(bounds.y).toBe(workArea.y + margin);
  });
});
