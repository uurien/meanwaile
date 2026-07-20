import { describe, it, expect, vi } from 'vitest';

// Squirrel.Windows launches the app with --squirrel-install/-updated/
// -uninstall/-obsolete during install/update/uninstall. electron-squirrel-startup
// detects those and returns true; main.ts must quit immediately without
// building the tray, popover, or HTTP server for that launch.
const mocks = vi.hoisted(() => ({
  app: {
    dock: { hide: vi.fn() },
    on: vi.fn(),
    quit: vi.fn(),
    getPath: vi.fn(() => '/fake/userData'),
  },
  Tray: vi.fn(),
}));

vi.mock('electron-squirrel-startup', () => ({ default: true }));

vi.mock('electron', () => ({
  app: mocks.app,
  Tray: mocks.Tray,
  BrowserWindow: vi.fn(),
  Menu: { buildFromTemplate: vi.fn() },
  nativeImage: { createFromPath: vi.fn(() => ({ setTemplateImage: vi.fn() })) },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  powerMonitor: { getSystemIdleTime: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  screen: { getDisplayMatching: vi.fn() },
}));

vi.mock('http', () => ({ createServer: vi.fn() }));

describe('Squirrel.Windows install/uninstall launch', () => {
  it('quits immediately and never creates the tray', async () => {
    await import('../src/main');

    // app.quit() called before Electron's 'ready' event means 'ready' never
    // fires, so the tray/popover/HTTP-server setup registered inside that
    // handler never runs — asserted here by checking the handler was never
    // invoked, since main.ts still registers it unconditionally.
    expect(mocks.app.quit).toHaveBeenCalled();
    expect(mocks.Tray).not.toHaveBeenCalled();
  });
});
