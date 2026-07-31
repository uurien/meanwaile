import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright-core';
import { execFileSync } from 'child_process';
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

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      // --no-sandbox: GitHub Actions' ubuntu-latest runners restrict
      // unprivileged user namespaces (AppArmor), which Electron's Chromium
      // sandbox needs - without this flag the app hangs on launch under
      // Xvfb until the test times out, instead of actually starting.
      args: [path.join(__dirname, '..', 'dist', 'main.js'), '--no-sandbox'],
      env: { ...process.env, MEANWAILE_E2E: '1' },
    });
    await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  // TEMP: attaching on every run (not just failures) so we can eyeball the
  // whole desktop once in CI. Revert to the failure-only check afterward.
  test.afterEach(async ({}, testInfo) => {
    try {
      const desktopPath = testInfo.outputPath('desktop.png');
      // page.screenshot() only captures the popover's own web contents, not
      // where it actually sits on screen - grab the whole Xvfb framebuffer
      // instead (requires imagemagick, installed in ci.yml).
      execFileSync('import', ['-window', 'root', desktopPath]);
      await testInfo.attach('desktop-screenshot', { path: desktopPath, contentType: 'image/png' });
    } catch (err) {
      console.warn('[e2e] could not capture desktop screenshot:', err);
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
