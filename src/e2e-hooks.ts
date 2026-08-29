import type { BrowserWindow, Tray } from 'electron';

export type Rect = { x: number; y: number; width: number; height: number };

// The exact inputs showPopover() placed the popover against on its last run.
// macOS doesn't report a menu-bar tray icon's bounds stably in the first
// moments after launch, so an E2E test must not read tray.getBounds() a
// second time and expect it to match the reading that positioned the window
// - it has to assert against the very values that were used.
export interface PopoverPlacement {
  trayBounds: Rect;
  workArea: Rect;
}

export interface E2ETestHooks {
  clickTray: () => void;
  getPopoverBounds: () => Rect | null;
  getTrayBounds: () => Rect;
  getPopoverPlacement: () => PopoverPlacement | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __meanwaile_e2e__: E2ETestHooks | undefined;
}

// No-op unless MEANWAILE_E2E is set, so the call site in main.ts can be a
// plain, unconditional statement instead of a test-mode `if`. Playwright
// can't click a real OS tray icon (on Linux the shell never even forwards
// the click to the app, see tray-platform.ts), so this lets an E2E test
// trigger the exact same code path a real click does via electronApp.evaluate().
export function installE2ETestHooks(
  tray: Tray,
  getPopover: () => BrowserWindow | null,
  getPopoverPlacement: () => PopoverPlacement | null,
): void {
  if (!process.env.MEANWAILE_E2E) return;

  global.__meanwaile_e2e__ = {
    clickTray: () => tray.emit('click'),
    getPopoverBounds: () => {
      const win = getPopover();
      return win && !win.isDestroyed() ? win.getBounds() : null;
    },
    getTrayBounds: () => tray.getBounds(),
    getPopoverPlacement,
  };
}
