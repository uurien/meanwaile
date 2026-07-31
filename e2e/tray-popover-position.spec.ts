import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import * as fs from 'fs';
import * as os from 'os';
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
  let userDataDir: string;

  test.beforeAll(async () => {
    // Pre-seed a scratch userData dir as already onboarded so app.on('ready')
    // never shows the real, click-and-wait onboarding dialogs (see
    // onboarding-store.ts) - avoids the app needing any test-mode awareness
    // of its own to run headless in CI.
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-e2e-'));
    fs.writeFileSync(
      path.join(userDataDir, 'onboarding.json'),
      JSON.stringify({ onboarded: true, hookBackfillOffered: true, codexHookBackfillOffered: true }),
    );

    electronApp = await electron.launch({
      // --no-sandbox: GitHub Actions' ubuntu-latest runners restrict
      // unprivileged user namespaces (AppArmor), which Electron's Chromium
      // sandbox needs - without this flag the app hangs on launch under
      // Xvfb until the test times out, instead of actually starting.
      // --disable-gpu: Xvfb has no real GPU: without this the GPU process
      // fails and the window paints nothing at all.
      args: [
        path.join(__dirname, '..', 'dist', 'main.js'),
        '--no-sandbox',
        '--disable-gpu',
        `--user-data-dir=${userDataDir}`,
      ],
      env: { ...process.env, MEANWAILE_E2E: '1' },
    });
    popoverPage = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  // Attaches a screenshot of the popover to the HTML report whenever the
  // test fails, so a visual regression (wrong position, blank window, etc.)
  // can be inspected without reproducing it locally - the report is
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
