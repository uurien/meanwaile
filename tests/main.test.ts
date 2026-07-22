import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock state ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const winHandlers: Record<string, (...a: unknown[]) => void> = {};
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
    webContents: { send: vi.fn(), openDevTools: vi.fn() },
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

  const screen = {
    getDisplayMatching: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } })),
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

  let capturedHttpHandler: ((req: Record<string, unknown>, res: Record<string, unknown>) => void) | null = null;
  const server = {
    listen: vi.fn((_p: unknown, _h: unknown, cb?: () => void) => cb?.()),
    close: vi.fn(),
  };
  const httpCreateServer = vi.fn(
    (handler: (req: Record<string, unknown>, res: Record<string, unknown>) => void) => {
      capturedHttpHandler = handler;
      return server;
    },
  );

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
  const hasOnboarded = vi.fn(() => true);
  const markOnboarded = vi.fn();
  const hasOfferedHookBackfill = vi.fn(() => true);
  const markHookBackfillOffered = vi.fn();
  const hasOfferedCodexHookBackfill = vi.fn(() => true);
  const markCodexHookBackfillOffered = vi.fn();
  const installClaudeHooks = vi.fn();
  const hasManagedHooks = vi.fn(() => false);
  const renameClaudeHookUrl = vi.fn();
  const installCodexHooks = vi.fn();
  const hasManagedCodexHooks = vi.fn(() => false);
  const renameCodexHookUrl = vi.fn();
  const hasCodexInstalled = vi.fn(() => false);
  const ensureCodexHooksFeatureEnabled = vi.fn();

  const DEFAULT_SETTINGS = { httpPort: 3821, autoOpenDelaySeconds: 15 };
  const readSettings = vi.fn(() => ({ ...DEFAULT_SETTINGS }));
  const writeSettings = vi.fn();
  const validateSettings = vi.fn((input: Record<string, unknown>) => {
    const httpPort = Number(input.httpPort);
    const autoOpenDelaySeconds = Number(input.autoOpenDelaySeconds);
    if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
      return { ok: false, error: 'Port must be an integer between 1 and 65535.' };
    }
    if (!Number.isFinite(autoOpenDelaySeconds) || autoOpenDelaySeconds <= 0) {
      return { ok: false, error: 'Seconds must be a positive number.' };
    }
    return { ok: true, settings: { httpPort, autoOpenDelaySeconds } };
  });

  return {
    win,
    tray,
    screen,
    server,
    app,
    ipcMain,
    powerMonitor,
    dialog,
    hasOnboarded,
    markOnboarded,
    hasOfferedHookBackfill,
    markHookBackfillOffered,
    hasOfferedCodexHookBackfill,
    markCodexHookBackfillOffered,
    installClaudeHooks,
    hasManagedHooks,
    renameClaudeHookUrl,
    installCodexHooks,
    hasManagedCodexHooks,
    renameCodexHookUrl,
    hasCodexInstalled,
    ensureCodexHooksFeatureEnabled,
    DEFAULT_SETTINGS,
    readSettings,
    writeSettings,
    validateSettings,
    BrowserWindow: vi.fn(() => win),
    Tray: vi.fn(() => tray),
    Menu: { buildFromTemplate: vi.fn(() => ({})) },
    nativeImage: { createFromPath: vi.fn(() => ({ setTemplateImage: vi.fn() })) },
    httpCreateServer,
    httpHandler: () => capturedHttpHandler,
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
  screen: mocks.screen,
}));

vi.mock('electron-squirrel-startup', () => ({ default: false }));

vi.mock('http', () => ({ createServer: mocks.httpCreateServer }));

vi.mock('../src/onboarding-store', () => ({
  hasOnboarded: mocks.hasOnboarded,
  markOnboarded: mocks.markOnboarded,
  hasOfferedHookBackfill: mocks.hasOfferedHookBackfill,
  markHookBackfillOffered: mocks.markHookBackfillOffered,
  hasOfferedCodexHookBackfill: mocks.hasOfferedCodexHookBackfill,
  markCodexHookBackfillOffered: mocks.markCodexHookBackfillOffered,
}));

vi.mock('../src/claude-settings', () => ({
  installClaudeHooks: mocks.installClaudeHooks,
  hasManagedHooks: mocks.hasManagedHooks,
  renameClaudeHookUrl: mocks.renameClaudeHookUrl,
}));

vi.mock('../src/codex-settings', () => ({
  installCodexHooks: mocks.installCodexHooks,
  hasManagedHooks: mocks.hasManagedCodexHooks,
  renameCodexHookUrl: mocks.renameCodexHookUrl,
  hasCodexInstalled: mocks.hasCodexInstalled,
}));

vi.mock('../src/codex-config', () => ({
  ensureCodexHooksFeatureEnabled: mocks.ensureCodexHooksFeatureEnabled,
}));

vi.mock('../src/settings-store', () => ({
  DEFAULT_SETTINGS: mocks.DEFAULT_SETTINGS,
  readSettings: mocks.readSettings,
  writeSettings: mocks.writeSettings,
  validateSettings: mocks.validateSettings,
}));

import '../src/main';

// ─── Helpers ──────────────────────────────────────────────────────────────
function triggerApp(event: string) {
  return mocks.app.handlers[event]?.();
}

function triggerWin(event: string) {
  mocks.win.handlers[event]?.();
}

function triggerTray(event: string) {
  mocks.tray.handlers[event]?.();
}

function postHook(body: string, url = '/hook') {
  const handler = mocks.httpHandler();
  if (!handler) throw new Error('HTTP server not started');

  const dataHandlers: ((chunk: string) => void)[] = [];
  const endHandlers: (() => void)[] = [];
  const req = {
    method: 'POST',
    url,
    on: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
      if (event === 'data') dataHandlers.push(cb as (c: string) => void);
      if (event === 'end') endHandlers.push(cb as () => void);
    }),
  };
  const res = { writeHead: vi.fn(), end: vi.fn() };

  handler(req as unknown as Record<string, unknown>, res as unknown as Record<string, unknown>);
  dataHandlers.forEach((cb) => cb(body));
  endHandlers.forEach((cb) => cb());

  return res;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

// This block must run first and toggles `hasOnboarded` back to `true` in
// afterAll — main.ts is imported once at module scope, and every describe
// block below this one triggers `ready` assuming onboarding already happened
// (no dialogs), so they'd start failing/hanging if that assumption broke.
describe('first-run onboarding', () => {
  beforeAll(() => {
    mocks.hasOnboarded.mockReturnValue(false);
  });

  afterAll(() => {
    mocks.hasOnboarded.mockReturnValue(true);
  });

  beforeEach(() => {
    mocks.dialog.showMessageBox.mockReset();
    mocks.app.setLoginItemSettings.mockClear();
    mocks.installClaudeHooks.mockClear();
    mocks.installCodexHooks.mockClear();
    mocks.ensureCodexHooksFeatureEnabled.mockClear();
    mocks.markOnboarded.mockClear();
    mocks.hasCodexInstalled.mockReturnValue(false);
  });

  it('shows the login-item dialog before the Claude Code hooks dialog, in order', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(2);
    expect(mocks.dialog.showMessageBox.mock.calls[0][0].message).toMatch(/log in/i);
    expect(mocks.dialog.showMessageBox.mock.calls[1][0].message).toMatch(/hooks/i);
  });

  it('does not show the second dialog until the first has fully resolved', async () => {
    let resolveFirst!: (v: { response: number }) => void;
    mocks.dialog.showMessageBox
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ response: 1 });

    const readyPromise = triggerApp('ready');
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(1);

    resolveFirst({ response: 1 });
    await readyPromise;
    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('enables the login item when the user answers "Yes"', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
  });

  it('does not touch the login item when the user answers "No"', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('installs Claude Code hooks when the user answers "Yes"', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 0 });

    await triggerApp('ready');

    expect(mocks.installClaudeHooks).toHaveBeenCalledTimes(1);
    expect(mocks.installClaudeHooks.mock.calls[0][1]).toContain('3821');
  });

  it('does not install Claude Code hooks when the user answers "No"', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.installClaudeHooks).not.toHaveBeenCalled();
  });

  it('does not show a Codex dialog when Codex is not installed', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(2);
    expect(mocks.installCodexHooks).not.toHaveBeenCalled();
  });

  it('shows a third dialog for Codex hooks when Codex is installed, and installs on "Yes"', async () => {
    mocks.hasCodexInstalled.mockReturnValue(true);
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 0 });

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(3);
    expect(mocks.dialog.showMessageBox.mock.calls[2][0].message).toMatch(/codex/i);
    expect(mocks.installCodexHooks).toHaveBeenCalledTimes(1);
    expect(mocks.installCodexHooks.mock.calls[0][1]).toContain('3821');
    expect(mocks.ensureCodexHooksFeatureEnabled).toHaveBeenCalledTimes(1);
  });

  it('does not install Codex hooks when the user answers "No" to the Codex dialog', async () => {
    mocks.hasCodexInstalled.mockReturnValue(true);
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.installCodexHooks).not.toHaveBeenCalled();
    expect(mocks.ensureCodexHooksFeatureEnabled).not.toHaveBeenCalled();
  });

  it('marks onboarding complete once both dialogs are answered', async () => {
    mocks.dialog.showMessageBox
      .mockResolvedValueOnce({ response: 1 })
      .mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.markOnboarded).toHaveBeenCalledWith('/fake/userData');
  });

  it('skips onboarding entirely on a subsequent launch', async () => {
    mocks.hasOnboarded.mockReturnValueOnce(true);

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(mocks.app.setLoginItemSettings).not.toHaveBeenCalled();
    expect(mocks.installClaudeHooks).not.toHaveBeenCalled();
    expect(mocks.markOnboarded).not.toHaveBeenCalled();
  });

});

describe('hook backfill for already-onboarded users', () => {
  beforeEach(() => {
    mocks.hasOnboarded.mockReturnValue(true);
    mocks.dialog.showMessageBox.mockReset();
    mocks.installClaudeHooks.mockClear();
    mocks.markHookBackfillOffered.mockClear();
    mocks.installCodexHooks.mockClear();
    mocks.ensureCodexHooksFeatureEnabled.mockClear();
    mocks.markCodexHookBackfillOffered.mockClear();
    mocks.hasCodexInstalled.mockReturnValue(false);
  });

  afterEach(() => {
    mocks.hasOfferedHookBackfill.mockReturnValue(true);
    mocks.hasOfferedCodexHookBackfill.mockReturnValue(true);
  });

  it('asks for confirmation and installs when the user confirms', async () => {
    mocks.hasOfferedHookBackfill.mockReturnValueOnce(false);
    mocks.hasManagedHooks.mockReturnValueOnce(true);
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(mocks.installClaudeHooks).toHaveBeenCalledTimes(1);
    expect(mocks.installClaudeHooks.mock.calls[0][1]).toContain('3821');
    expect(mocks.markHookBackfillOffered).toHaveBeenCalledWith('/fake/userData');
  });

  it('does not install anything when the user declines', async () => {
    mocks.hasOfferedHookBackfill.mockReturnValueOnce(false);
    mocks.hasManagedHooks.mockReturnValueOnce(true);
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.installClaudeHooks).not.toHaveBeenCalled();
    expect(mocks.markHookBackfillOffered).toHaveBeenCalledWith('/fake/userData');
  });

  it('does not ask at all for users who never opted into hooks', async () => {
    mocks.hasOfferedHookBackfill.mockReturnValueOnce(false);
    mocks.hasManagedHooks.mockReturnValueOnce(false);

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(mocks.installClaudeHooks).not.toHaveBeenCalled();
  });

  it('does not ask again once already offered', async () => {
    mocks.hasOfferedHookBackfill.mockReturnValueOnce(true);
    mocks.hasManagedHooks.mockReturnValueOnce(true);

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(mocks.installClaudeHooks).not.toHaveBeenCalled();
  });

  it('asks for confirmation and installs Codex hooks when the user confirms', async () => {
    mocks.hasOfferedCodexHookBackfill.mockReturnValueOnce(false);
    mocks.hasCodexInstalled.mockReturnValueOnce(true);
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(mocks.installCodexHooks).toHaveBeenCalledTimes(1);
    expect(mocks.installCodexHooks.mock.calls[0][1]).toContain('3821');
    expect(mocks.ensureCodexHooksFeatureEnabled).toHaveBeenCalledTimes(1);
    expect(mocks.markCodexHookBackfillOffered).toHaveBeenCalledWith('/fake/userData');
  });

  it('does not install Codex hooks when the user declines the Codex offer', async () => {
    mocks.hasOfferedCodexHookBackfill.mockReturnValueOnce(false);
    mocks.hasCodexInstalled.mockReturnValueOnce(true);
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });

    await triggerApp('ready');

    expect(mocks.installCodexHooks).not.toHaveBeenCalled();
    expect(mocks.ensureCodexHooksFeatureEnabled).not.toHaveBeenCalled();
    expect(mocks.markCodexHookBackfillOffered).toHaveBeenCalledWith('/fake/userData');
  });

  it('does not ask about Codex at all for users who do not have Codex installed', async () => {
    mocks.hasOfferedCodexHookBackfill.mockReturnValueOnce(false);
    mocks.hasCodexInstalled.mockReturnValueOnce(false);

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(mocks.installCodexHooks).not.toHaveBeenCalled();
  });

  it('does not ask again once the Codex offer was already made', async () => {
    mocks.hasOfferedCodexHookBackfill.mockReturnValueOnce(true);
    mocks.hasCodexInstalled.mockReturnValueOnce(true);

    await triggerApp('ready');

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(mocks.installCodexHooks).not.toHaveBeenCalled();
  });
});

describe('main.ts top-level', () => {
  it('hides the dock icon on import', () => {
    expect(mocks.app.dock.hide).toHaveBeenCalled();
  });

  it('registers ready, window-all-closed, and before-quit handlers', () => {
    expect(mocks.app.handlers['ready']).toBeTypeOf('function');
    expect(mocks.app.handlers['window-all-closed']).toBeTypeOf('function');
    expect(mocks.app.handlers['before-quit']).toBeTypeOf('function');
  });
});

describe('app ready handler', () => {
  beforeAll(async () => {
    await triggerApp('ready');
  });

  it('creates the tray', () => {
    expect(mocks.Tray).toHaveBeenCalled();
    expect(mocks.tray.setToolTip).toHaveBeenCalledWith('Meanwaile');
  });

  it('registers click and right-click on tray', () => {
    expect(mocks.tray.handlers['click']).toBeTypeOf('function');
    expect(mocks.tray.handlers['right-click']).toBeTypeOf('function');
  });

  it('creates the initial popover window', () => {
    expect(mocks.BrowserWindow).toHaveBeenCalled();
  });

  it('starts the HTTP server', () => {
    expect(mocks.httpCreateServer).toHaveBeenCalled();
    expect(mocks.server.listen).toHaveBeenCalled();
  });

  it('registers blur/focus/closed on the window', () => {
    expect(mocks.win.handlers['blur']).toBeTypeOf('function');
    expect(mocks.win.handlers['focus']).toBeTypeOf('function');
    expect(mocks.win.handlers['closed']).toBeTypeOf('function');
  });

  it('right-click shows context menu', () => {
    triggerTray('right-click');
    expect(mocks.tray.popUpContextMenu).toHaveBeenCalled();
  });

  it('context menu "Exit" click calls app.quit', () => {
    const [items] = vi.mocked(mocks.Menu.buildFromTemplate).mock.calls[0] as [{ click: () => void }[]];
    items[0].click();
    expect(mocks.app.quit).toHaveBeenCalled();
  });
});

describe('window blur / focus / closed', () => {
  it('blur hides the window after a short timeout', async () => {
    vi.useFakeTimers();
    mocks.win.isDestroyed.mockReturnValue(false);
    triggerWin('blur');
    vi.advanceTimersByTime(200);
    expect(mocks.win.hide).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('blur does not hide a destroyed window', async () => {
    vi.useFakeTimers();
    mocks.win.hide.mockClear();
    mocks.win.isDestroyed.mockReturnValue(true);
    triggerWin('blur');
    vi.advanceTimersByTime(200);
    expect(mocks.win.hide).not.toHaveBeenCalled();
    mocks.win.isDestroyed.mockReturnValue(false);
    vi.useRealTimers();
  });

  it('focus cancels a pending blur timer', async () => {
    vi.useFakeTimers();
    mocks.win.hide.mockClear();
    triggerWin('blur');
    triggerWin('focus');
    vi.advanceTimersByTime(200);
    expect(mocks.win.hide).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('closed sets popover to null without crashing on subsequent hooks', () => {
    triggerWin('closed');
    expect(() => postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }))).not.toThrow();
  });
});

describe('togglePopover / showPopover', () => {
  it('tray click shows popover when not visible', () => {
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    triggerTray('click');
    expect(mocks.win.show).toHaveBeenCalled();
  });

  it('tray click hides popover when visible', () => {
    mocks.win.isVisible.mockReturnValue(true);
    mocks.win.hide.mockClear();
    triggerTray('click');
    expect(mocks.win.hide).toHaveBeenCalled();
    mocks.win.isVisible.mockReturnValue(false);
  });

  it('showPopover creates a new window when current one is destroyed', () => {
    mocks.win.isDestroyed.mockReturnValue(true);
    const callsBefore = mocks.BrowserWindow.mock.calls.length;
    triggerTray('click');
    expect(mocks.BrowserWindow.mock.calls.length).toBeGreaterThan(callsBefore);
    mocks.win.isDestroyed.mockReturnValue(false);
  });

  it('opens the popover above the tray icon when the tray sits in the lower half of the display (Windows-style taskbar)', () => {
    mocks.tray.getBounds.mockReturnValueOnce({ x: 700, y: 860, width: 22, height: 22 });
    mocks.screen.getDisplayMatching.mockReturnValueOnce({ workArea: { x: 0, y: 0, width: 1440, height: 900 } });
    mocks.win.getBounds.mockReturnValueOnce({ width: 440, height: 540 });
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.setPosition.mockClear();

    triggerTray('click');

    const [, y] = mocks.win.setPosition.mock.calls.at(-1)!;
    expect(y).toBeLessThan(860);
    expect(y).toBe(860 - 540 - 4);
  });

  it('opens the popover below the tray icon when the tray sits in the upper half of the display (macOS menu bar)', () => {
    mocks.tray.getBounds.mockReturnValueOnce({ x: 700, y: 10, width: 22, height: 22 });
    mocks.screen.getDisplayMatching.mockReturnValueOnce({ workArea: { x: 0, y: 0, width: 1440, height: 900 } });
    mocks.win.getBounds.mockReturnValueOnce({ width: 440, height: 540 });
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.setPosition.mockClear();

    triggerTray('click');

    const [, y] = mocks.win.setPosition.mock.calls.at(-1)!;
    expect(y).toBe(10 + 22 + 4);
  });

  it('clamps the popover horizontally so it never overflows the display work area', () => {
    mocks.tray.getBounds.mockReturnValueOnce({ x: 1420, y: 860, width: 22, height: 22 });
    mocks.screen.getDisplayMatching.mockReturnValueOnce({ workArea: { x: 0, y: 0, width: 1440, height: 900 } });
    mocks.win.getBounds.mockReturnValueOnce({ width: 440, height: 540 });
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.setPosition.mockClear();

    triggerTray('click');

    const [x] = mocks.win.setPosition.mock.calls.at(-1)!;
    expect(x).toBeLessThanOrEqual(1440 - 440);
    expect(x).toBeGreaterThanOrEqual(0);
  });

  it('re-enables visibleOnAllWorkspaces on show so the next show lands on the active Space', () => {
    vi.useFakeTimers();
    mocks.win.setVisibleOnAllWorkspaces.mockClear();
    mocks.win.isVisible.mockReturnValue(false);
    triggerTray('click');
    expect(mocks.win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ visibleOnFullScreen: true }),
    );
    vi.advanceTimersByTime(200);
    expect(mocks.win.setVisibleOnAllWorkspaces).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ visibleOnFullScreen: true }),
    );
    vi.useRealTimers();
  });

  it('does not reset visibleOnAllWorkspaces on a destroyed window', () => {
    vi.useFakeTimers();
    mocks.win.setVisibleOnAllWorkspaces.mockClear();
    mocks.win.isVisible.mockReturnValue(false);
    triggerTray('click');
    mocks.win.isDestroyed.mockReturnValue(true);
    vi.advanceTimersByTime(200);
    expect(mocks.win.setVisibleOnAllWorkspaces).not.toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ visibleOnFullScreen: true }),
    );
    mocks.win.isDestroyed.mockReturnValue(false);
    vi.useRealTimers();
  });
});

describe('HTTP server request handler', () => {
  it('returns 404 for non-POST method', () => {
    const handler = mocks.httpHandler()!;
    const req = { method: 'GET', url: '/hook', on: vi.fn() };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler(req as unknown as Record<string, unknown>, res as unknown as Record<string, unknown>);
    expect(res.writeHead).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 404 for wrong URL', () => {
    const handler = mocks.httpHandler()!;
    const req = { method: 'POST', url: '/wrong', on: vi.fn() };
    const res = { writeHead: vi.fn(), end: vi.fn() };
    handler(req as unknown as Record<string, unknown>, res as unknown as Record<string, unknown>);
    expect(res.writeHead).toHaveBeenCalledWith(404);
  });

  it('returns 200 and processes valid JSON body', () => {
    const res = postHook(JSON.stringify({ hook_event_name: 'Stop' }));
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith('{}');
  });

  it('logs warning for invalid JSON body', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    postHook('not-json');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns 200 and routes /hook/codex to the Codex adapter', () => {
    const res = postHook(JSON.stringify({ hook_event_name: 'Stop' }), '/hook/codex');
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith('{}');
  });

});

describe('popover-close IPC', () => {
  it('hides the popover when renderer sends popover-close', () => {
    mocks.win.hide.mockClear();
    mocks.ipcMain.handlers['popover-close']?.();
    expect(mocks.win.hide).toHaveBeenCalled();
  });
});

describe('state change IPC', () => {
  // The state machine now tracks each session independently (see
  // state-machine.ts) and only drops to idle once every tracked session has
  // finished - so, since it's a module-level singleton shared across this
  // whole file, each test here must finish its own session with a matching
  // session_id afterwards. A bare Stop with no session_id only ever clears
  // the default/no-session key, and would otherwise leave s1/s2 stuck
  // "working" forever, breaking every later describe block's assumption
  // that a Stop resets the shared machine to idle.
  it('sends state-change to popover webContents when state transitions', () => {
    mocks.win.webContents.send.mockClear();
    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }));
    expect(mocks.win.webContents.send).toHaveBeenCalledWith(
      'state-change',
      expect.objectContaining({ state: 'agent_working' }),
    );
    postHook(JSON.stringify({ hook_event_name: 'Stop', session_id: 's1' }));
  });

  it('routes Codex hook events into the same shared state machine', () => {
    mocks.win.webContents.send.mockClear();
    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's2' }), '/hook/codex');
    expect(mocks.win.webContents.send).toHaveBeenCalledWith(
      'state-change',
      expect.objectContaining({ state: 'agent_working' }),
    );
    postHook(JSON.stringify({ hook_event_name: 'Stop', session_id: 's2' }), '/hook/codex');
  });
});

describe('auto-open popover after idle timeout', () => {
  // The state machine is a module-level singleton shared across this whole
  // file and no longer re-notifies on a no-op transition (same state in,
  // same state out), so each test needs to start from a known, different
  // state — otherwise a same-state UserPromptSubmit here is a silent no-op
  // and never arms the auto-open timer.
  beforeEach(() => {
    postHook(JSON.stringify({ hook_event_name: 'Stop' }));
  });

  it('opens the popover if the system has been idle for the whole delay', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(15500);

    expect(mocks.win.show).toHaveBeenCalled();
    vi.useRealTimers();
  });

  // Keeping this buffer small (500ms, not several seconds) matters: a large
  // buffer widens the window in which a fast app-switch right after
  // submitting the prompt still reads as "idle" at check time, popping the
  // game open over whatever app the user switched to.
  it('does not fire before the delay plus the small clock-skew buffer', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(15499);
    expect(mocks.win.show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mocks.win.show).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not open the popover if system activity was detected', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(2);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(15500);

    expect(mocks.win.show).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancels the timer if the agent responds before the delay elapses', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(5000);
    postHook(JSON.stringify({ hook_event_name: 'Stop' }));
    vi.advanceTimersByTime(15000);

    expect(mocks.win.show).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not re-show an already visible popover', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(true);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(15500);

    expect(mocks.win.show).not.toHaveBeenCalled();
    mocks.win.isVisible.mockReturnValue(false);
    vi.useRealTimers();
  });

  // Characterization test, not a spec: this documents current behavior,
  // which is arguably not what a user would want, but changing it was
  // explicitly deferred rather than fixed here. PreToolUse only re-arms this
  // timer through one specific path - a needs_user -> agent_working retry
  // after a permission prompt (see the PreToolUse case in
  // claude-code.ts/codex.ts) - and maybeAutoOpenPopover() only checks
  // isVisible(), with no memory of "the user just closed this by hand". So a
  // tool call that merely resumes an already-open task can still pop the
  // window back open after the idle delay, even right after the user
  // dismissed it for that same task.
  it('a PreToolUse retry after needs_user can still reopen the popover even though the user just closed it by hand', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.win.hide.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    postHook(JSON.stringify({ hook_event_name: 'Notification', notification_type: 'permission_prompt' }));

    // User manually closes the popover while waiting on the permission prompt.
    mocks.ipcMain.handlers['popover-close']?.();
    expect(mocks.win.hide).toHaveBeenCalled();

    // Agent's next tool call (e.g. after the permission is approved in the
    // terminal) flips needs_user -> agent_working, re-arming the timer
    // exactly as a fresh UserPromptSubmit would.
    postHook(JSON.stringify({ hook_event_name: 'PreToolUse' }));
    vi.advanceTimersByTime(15500);

    expect(mocks.win.show).toHaveBeenCalled();
    vi.useRealTimers();
  });

  // Two-agent variant of the reported bug: the state machine now tracks
  // each session independently (see state-machine.ts), so agent 1 finishing
  // while agent 2 is still running does not change the aggregate state at
  // all - it stays agent_working, exactly as if nothing had happened. Agent
  // 2's later tool call is therefore a same-state no-op too, so it must not
  // re-arm the auto-open timer or pop the window back open.
  it('does not reopen the popover when a second still-active agent merely uses a tool, after the popover was closed once the first agent finished', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.win.hide.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    // Two agents start; after 15s idle the popover correctly auto-opens.
    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'agent-1' }));
    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'agent-2' }));
    vi.advanceTimersByTime(15500);
    expect(mocks.win.show).toHaveBeenCalledTimes(1);

    // Agent 1 finishes. Agent 2 is still running, so the aggregate state
    // correctly stays agent_working (no pause) - the player closes the
    // popover anyway.
    mocks.win.show.mockClear();
    postHook(JSON.stringify({ hook_event_name: 'Stop', session_id: 'agent-1' }));
    mocks.ipcMain.handlers['popover-close']?.();
    expect(mocks.win.hide).toHaveBeenCalled();

    // Agent 2, still running, makes a tool call - a same-state no-op, so it
    // must not re-arm the timer and pop the window back open.
    postHook(JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'agent-2' }));
    vi.advanceTimersByTime(15500);

    expect(mocks.win.show).not.toHaveBeenCalled();
    vi.useRealTimers();

    // Clean up agent-2, which this test never finishes, so it doesn't stay
    // stuck "working" in the shared machine for the rest of the file.
    postHook(JSON.stringify({ hook_event_name: 'Stop', session_id: 'agent-2' }));
  });
});

describe('settings window IPC', () => {
  it('open-settings creates a settings window', () => {
    const callsBefore = mocks.BrowserWindow.mock.calls.length;
    mocks.ipcMain.handlers['open-settings']?.();
    expect(mocks.BrowserWindow.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('open-settings focuses the existing settings window instead of creating a new one', () => {
    mocks.win.focus.mockClear();
    const callsBefore = mocks.BrowserWindow.mock.calls.length;

    mocks.ipcMain.handlers['open-settings']?.();

    expect(mocks.BrowserWindow.mock.calls.length).toBe(callsBefore);
    expect(mocks.win.focus).toHaveBeenCalled();
  });

  it('settings-get returns the currently loaded settings', async () => {
    const result = await mocks.ipcMain.handlers['settings-get']?.();
    expect(result).toEqual({ httpPort: 3821, autoOpenDelaySeconds: 15 });
  });

  it('settings-save rejects an invalid port and does not touch the HTTP server', async () => {
    mocks.server.close.mockClear();

    const result = await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 0, autoOpenDelaySeconds: 15 });

    expect(result.ok).toBe(false);
    expect(mocks.server.close).not.toHaveBeenCalled();
  });

  it('settings-save persists valid settings and restarts the HTTP server on a new port', async () => {
    mocks.server.close.mockClear();
    mocks.httpCreateServer.mockClear();
    mocks.writeSettings.mockClear();

    const result = await mocks.ipcMain.handlers['settings-save']?.(
      {},
      { httpPort: 4000, autoOpenDelaySeconds: 20 },
    );

    expect(result.ok).toBe(true);
    expect(mocks.server.close).toHaveBeenCalled();
    expect(mocks.httpCreateServer).toHaveBeenCalled();
    expect(mocks.server.listen).toHaveBeenCalledWith(4000, '127.0.0.1', expect.any(Function));
    expect(mocks.writeSettings).toHaveBeenCalledWith('/fake/userData', {
      httpPort: 4000,
      autoOpenDelaySeconds: 20,
    });
  });

  it('asks for confirmation before renaming the Claude Code hook, and renames it when confirmed', async () => {
    mocks.hasManagedHooks.mockReturnValueOnce(true);
    mocks.renameClaudeHookUrl.mockClear();
    mocks.dialog.showMessageBox.mockClear();
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });

    await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 4500, autoOpenDelaySeconds: 20 });

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(mocks.renameClaudeHookUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('4000'),
      expect.stringContaining('4500'),
    );
  });

  it('does not rename the Claude Code hook when the confirmation is declined', async () => {
    mocks.hasManagedHooks.mockReturnValueOnce(true);
    mocks.renameClaudeHookUrl.mockClear();
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });

    await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 4600, autoOpenDelaySeconds: 20 });

    expect(mocks.renameClaudeHookUrl).not.toHaveBeenCalled();
  });

  it('does not ask for confirmation when hooks were never configured', async () => {
    mocks.hasManagedHooks.mockReturnValueOnce(false);
    mocks.dialog.showMessageBox.mockClear();

    await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 4700, autoOpenDelaySeconds: 20 });

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('does not touch the HTTP server when the saved port is unchanged', async () => {
    // Picks up from the 4700 port set by the previous test.
    mocks.server.close.mockClear();
    mocks.httpCreateServer.mockClear();

    const result = await mocks.ipcMain.handlers['settings-save']?.(
      {},
      { httpPort: 4700, autoOpenDelaySeconds: 45 },
    );

    expect(result.ok).toBe(true);
    expect(mocks.server.close).not.toHaveBeenCalled();
    expect(mocks.httpCreateServer).not.toHaveBeenCalled();
  });

  it('asks for confirmation before renaming the Codex hook, and renames it when confirmed', async () => {
    // Picks up from the 4700 port left by the tests above.
    mocks.hasManagedCodexHooks.mockReturnValueOnce(true);
    mocks.renameCodexHookUrl.mockClear();
    mocks.dialog.showMessageBox.mockClear();
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });

    await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 4800, autoOpenDelaySeconds: 20 });

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(mocks.renameCodexHookUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('4700'),
      expect.stringContaining('4800'),
    );
  });

  it('does not rename the Codex hook when the confirmation is declined', async () => {
    mocks.hasManagedCodexHooks.mockReturnValueOnce(true);
    mocks.renameCodexHookUrl.mockClear();
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });

    await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 4900, autoOpenDelaySeconds: 20 });

    expect(mocks.renameCodexHookUrl).not.toHaveBeenCalled();
  });

  it('does not ask for Codex confirmation when Codex hooks were never configured', async () => {
    mocks.hasManagedCodexHooks.mockReturnValueOnce(false);
    mocks.dialog.showMessageBox.mockClear();

    await mocks.ipcMain.handlers['settings-save']?.({}, { httpPort: 5000, autoOpenDelaySeconds: 20 });

    expect(mocks.dialog.showMessageBox).not.toHaveBeenCalled();
  });
});

describe('app lifecycle', () => {
  it('window-all-closed does not quit', () => {
    mocks.app.quit.mockClear();
    triggerApp('window-all-closed');
    expect(mocks.app.quit).not.toHaveBeenCalled();
  });

  it('before-quit closes the HTTP server', () => {
    triggerApp('before-quit');
    expect(mocks.server.close).toHaveBeenCalled();
  });
});
