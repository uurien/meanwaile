import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright-core';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type Rect = { x: number; y: number; width: number; height: number };

// Mirrors popoverPosition()/topRightPosition() in src/main.ts, duplicated on
// purpose rather than imported, so this test verifies actual runtime
// behavior instead of just calling back into the code it's meant to check.
//
// Linux (AppIndicator/StatusNotifierItem trays report zeroed-out bounds,
// regardless of X11 vs Wayland - tray-relative placement is meaningless
// there) opens at the work area's top-right corner. macOS/Windows center
// under the tray icon, flipped vertically depending on which half of the
// work area the tray sits in.
function expectedPosition(trayBounds: Rect, workArea: Rect, winBounds: { width: number; height: number }) {
  if (process.platform === 'linux') {
    const margin = 8;
    return {
      x: Math.round(workArea.x + workArea.width - winBounds.width - margin),
      y: Math.round(workArea.y + margin),
    };
  }

  const rawX = trayBounds.x + trayBounds.width / 2 - winBounds.width / 2;
  const x = Math.round(Math.min(Math.max(rawX, workArea.x), workArea.x + workArea.width - winBounds.width));

  const trayIsInLowerHalf = trayBounds.y > workArea.y + workArea.height / 2;
  const y = Math.round(
    trayIsInLowerHalf ? trayBounds.y - winBounds.height - 4 : trayBounds.y + trayBounds.height + 4,
  );

  return { x, y };
}

// A screenshot of just the popover's own web contents doesn't show whether
// it landed in the right place on screen - which is the one thing this test
// checks. Grab the whole desktop instead, composited for real so a
// transparent window isn't just a blank box:
// - Linux: Xvfb has no compositor of its own, so picom is started in ci.yml
//   and ImageMagick's `import` grabs the X11 root window.
// - macOS: screencapture is built in and composites correctly already.
// - Windows: no built-in CLI for this, so a small PowerShell script copies
//   the whole virtual screen via System.Drawing.
function captureDesktop(outputPath: string): void {
  if (process.platform === 'darwin') {
    execFileSync('screencapture', ['-x', outputPath]);
    return;
  }
  if (process.platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
      '$b = [System.Windows.Forms.SystemInformation]::VirtualScreen',
      '$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height',
      '$g = [System.Drawing.Graphics]::FromImage($bmp)',
      '$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)',
      `$bmp.Save('${outputPath}')`,
    ].join('; ');
    execFileSync('powershell', ['-NoProfile', '-Command', script]);
    return;
  }
  execFileSync('import', ['-window', 'root', outputPath]);
}

test.describe('tray click opens the popover next to the tray icon', () => {
  let electronApp: ElectronApplication;
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

    const args = [path.join(__dirname, '..', 'dist', 'main.js'), `--user-data-dir=${userDataDir}`];
    if (process.platform === 'linux') {
      // --no-sandbox: GitHub Actions' ubuntu-latest runners restrict
      // unprivileged user namespaces (AppArmor), which Electron's Chromium
      // sandbox needs - without this flag the app hangs on launch under
      // Xvfb until the test times out, instead of actually starting.
      // --disable-gpu: Xvfb has no real GPU: without this the GPU process
      // fails and the window paints nothing at all.
      args.push('--no-sandbox', '--disable-gpu');
    }

    electronApp = await electron.launch({ args, env: { ...process.env, MEANWAILE_E2E: '1' } });
    await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  // Attaches a screenshot of the whole desktop to the HTML report whenever
  // the test fails, so a visual regression (wrong position, blank window,
  // etc.) can be inspected without reproducing it locally - the report is
  // uploaded as a downloadable CI artifact (see ci.yml).
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    try {
      const desktopPath = testInfo.outputPath('desktop.png');
      captureDesktop(desktopPath);
      await testInfo.attach('desktop-screenshot', { path: desktopPath, contentType: 'image/png' });
    } catch (err) {
      console.warn('[e2e] could not capture failure screenshot:', err);
    }
  });

  test('popover opens next to the tray icon', async () => {
    const workArea = await electronApp.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);
    const trayBounds = await electronApp.evaluate<Rect>(() => (global as any).__meanwaile_e2e__.getTrayBounds());

    await electronApp.evaluate(() => (global as any).__meanwaile_e2e__.clickTray());

    await expect
      .poll(async () => electronApp.evaluate(() => (global as any).__meanwaile_e2e__.getPopoverBounds()))
      .not.toBeNull();

    const bounds = await electronApp.evaluate<Rect>(() => (global as any).__meanwaile_e2e__.getPopoverBounds());
    const expected = expectedPosition(trayBounds, workArea, bounds);

    expect(bounds.x).toBe(expected.x);
    expect(bounds.y).toBe(expected.y);
  });
});
