import type { BrowserWindow, Tray } from 'electron';

export interface E2ETestHooks {
  clickTray: () => void;
  getPopoverBounds: () => { x: number; y: number; width: number; height: number } | null;
  getTrayBounds: () => { x: number; y: number; width: number; height: number };
}

declare global {
  // eslint-disable-next-line no-var
  var __meanwaile_e2e__: E2ETestHooks | undefined;
}

// Only installed when MEANWAILE_E2E is set (see main.ts) - Playwright can't
// click a real OS tray icon (on Linux the shell never even forwards the
// click to the app, see tray-platform.ts), so this lets an E2E test trigger
// the exact same code path a real click does via electronApp.evaluate().
export function installE2ETestHooks(tray: Tray, getPopover: () => BrowserWindow | null): void {
  global.__meanwaile_e2e__ = {
    clickTray: () => tray.emit('click'),
    getPopoverBounds: () => {
      const win = getPopover();
      return win && !win.isDestroyed() ? win.getBounds() : null;
    },
    getTrayBounds: () => tray.getBounds(),
  };
}
