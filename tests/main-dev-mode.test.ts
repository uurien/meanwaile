import { describe, it, expect, vi, beforeAll } from 'vitest';

// Covers the `isDev` branches in src/main.ts (MEANWAILE_DEV=1, set by
// `npm run dev`): every window opens with DevTools attached and the
// blur-to-hide debounce is skipped. `isDev` is a module-level constant
// read once at import time, and the main test file already has a single
// static `import '../src/main'` with MEANWAILE_DEV unset - so this needs
// its own file with a dynamic import, done after setting the env var.

const mocks = vi.hoisted(() => {
  const winHandlers: Record<string, (...a: unknown[]) => void> = {};
  const webContentsHandlers: Record<string, (...a: unknown[]) => void> = {};
  const win = {
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
    setMenuBarVisibility: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => false),
    setPosition: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    getBounds: vi.fn(() => ({ width: 320, height: 160 })),
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => {
      winHandlers[event] = handler;
    }),
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn(),
      once: vi.fn((event: string, handler: (...a: unknown[]) => void) => {
        webContentsHandlers[event] = handler;
      }),
      handlers: webContentsHandlers,
    },
    handlers: winHandlers,
  };

  const trayHandlers: Record<string, (...a: unknown[]) => void> = {};
  const tray = {
    setToolTip: vi.fn(),
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => {
      trayHandlers[event] = handler;
    }),
    getBounds: vi.fn(() => ({ x: 100, y: 50, width: 22, height: 22 })),
    popUpContextMenu: vi.fn(),
    handlers: trayHandlers,
  };

  const appHandlers: Record<string, (...a: unknown[]) => void> = {};
  const app = {
    dock: { hide: vi.fn() },
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => {
      appHandlers[event] = handler;
    }),
    quit: vi.fn(),
    setLoginItemSettings: vi.fn(),
    getPath: vi.fn(() => '/fake/userData'),
    handlers: appHandlers,
  };

  const server = { listen: vi.fn((_p: unknown, _h: unknown, cb?: () => void) => cb?.()), close: vi.fn() };
  const httpCreateServer = vi.fn(() => server);

  const ipcMainHandlers: Record<string, (...a: unknown[]) => void> = {};
  const ipcMain = {
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => {
      ipcMainHandlers[event] = handler;
    }),
    handle: vi.fn((event: string, handler: (...a: unknown[]) => void) => {
      ipcMainHandlers[event] = handler;
    }),
    handlers: ipcMainHandlers,
  };

  const powerMonitor = { getSystemIdleTime: vi.fn(() => 0) };
  const dialog = { showMessageBox: vi.fn(async () => ({ response: 1 })) };
  const DEFAULT_SETTINGS = { httpPort: 3821, autoOpenDelaySeconds: 15 };

  return {
    win,
    tray,
    app,
    ipcMain,
    powerMonitor,
    dialog,
    DEFAULT_SETTINGS,
    BrowserWindow: vi.fn(() => win),
    Tray: vi.fn(() => tray),
    Menu: { buildFromTemplate: vi.fn(() => ({})) },
    nativeImage: { createFromPath: vi.fn(() => ({ setTemplateImage: vi.fn() })) },
    httpCreateServer,
  };
});

vi.mock('electron', () => ({
  app: mocks.app,
  Tray: mocks.Tray,
  BrowserWindow: mocks.BrowserWindow,
  Menu: mocks.Menu,
  nativeImage: mocks.nativeImage,
  ipcMain: mocks.ipcMain,
  powerMonitor: mocks.powerMonitor,
  dialog: mocks.dialog,
}));

vi.mock('http', () => ({ createServer: mocks.httpCreateServer }));

vi.mock('../src/onboarding-store', () => ({
  hasOnboarded: vi.fn(() => true),
  markOnboarded: vi.fn(),
  hasOfferedHookBackfill: vi.fn(() => true),
  markHookBackfillOffered: vi.fn(),
  hasOfferedCodexHookBackfill: vi.fn(() => true),
  markCodexHookBackfillOffered: vi.fn(),
}));

vi.mock('../src/claude-settings', () => ({
  installClaudeHooks: vi.fn(),
  hasManagedHooks: vi.fn(() => false),
  renameClaudeHookUrl: vi.fn(),
}));

vi.mock('../src/codex-settings', () => ({
  installCodexHooks: vi.fn(),
  hasManagedHooks: vi.fn(() => false),
  renameCodexHookUrl: vi.fn(),
  hasCodexInstalled: vi.fn(() => false),
}));

vi.mock('../src/codex-config', () => ({
  ensureCodexHooksFeatureEnabled: vi.fn(),
}));

vi.mock('../src/settings-store', () => ({
  DEFAULT_SETTINGS: mocks.DEFAULT_SETTINGS,
  readSettings: vi.fn(() => ({ ...mocks.DEFAULT_SETTINGS })),
  writeSettings: vi.fn(),
  validateSettings: vi.fn(),
}));

beforeAll(async () => {
  process.env.MEANWAILE_DEV = '1';
  await import('../src/main');
  await (mocks.app.handlers['ready'] as () => Promise<void>)();
});

describe('MEANWAILE_DEV=1', () => {
  it('shows the popover and opens DevTools as soon as it finishes loading, instead of waiting for a tray click', () => {
    mocks.win.show.mockClear();
    mocks.win.webContents.openDevTools.mockClear();

    mocks.win.webContents.handlers['did-finish-load']?.();

    expect(mocks.win.show).toHaveBeenCalled();
    expect(mocks.win.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
  });

  it('skips the blur-to-hide debounce entirely', () => {
    mocks.win.hide.mockClear();

    mocks.win.handlers['blur']?.();

    expect(mocks.win.hide).not.toHaveBeenCalled();
  });

  it('opens the settings window with DevTools attached too', () => {
    mocks.win.webContents.openDevTools.mockClear();

    mocks.ipcMain.handlers['open-settings']?.();

    expect(mocks.win.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
  });
});
