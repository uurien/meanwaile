import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

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
    webContents: { send: vi.fn() },
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
  const installClaudeHooks = vi.fn();
  const hasManagedHooks = vi.fn(() => false);
  const renameClaudeHookUrl = vi.fn();

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
    server,
    app,
    ipcMain,
    powerMonitor,
    dialog,
    hasOnboarded,
    markOnboarded,
    installClaudeHooks,
    hasManagedHooks,
    renameClaudeHookUrl,
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
}));

vi.mock('http', () => ({ createServer: mocks.httpCreateServer }));

vi.mock('../src/onboarding-store', () => ({
  hasOnboarded: mocks.hasOnboarded,
  markOnboarded: mocks.markOnboarded,
}));

vi.mock('../src/claude-settings', () => ({
  installClaudeHooks: mocks.installClaudeHooks,
  hasManagedHooks: mocks.hasManagedHooks,
  renameClaudeHookUrl: mocks.renameClaudeHookUrl,
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

function postHook(body: string) {
  const handler = mocks.httpHandler();
  if (!handler) throw new Error('HTTP server not started');

  const dataHandlers: ((chunk: string) => void)[] = [];
  const endHandlers: (() => void)[] = [];
  const req = {
    method: 'POST',
    url: '/hook',
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
    mocks.markOnboarded.mockClear();
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

});

describe('popover-close IPC', () => {
  it('hides the popover when renderer sends popover-close', () => {
    mocks.win.hide.mockClear();
    mocks.ipcMain.handlers['popover-close']?.();
    expect(mocks.win.hide).toHaveBeenCalled();
  });
});

describe('state change IPC', () => {
  it('sends state-change to popover webContents when state transitions', () => {
    mocks.win.webContents.send.mockClear();
    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }));
    expect(mocks.win.webContents.send).toHaveBeenCalledWith(
      'state-change',
      expect.objectContaining({ state: 'agent_working' }),
    );
  });
});

describe('auto-open popover after idle timeout', () => {
  it('opens the popover if the system has been idle for the whole delay', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(17000);

    expect(mocks.win.show).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not open the popover if system activity was detected', () => {
    vi.useFakeTimers();
    mocks.win.isVisible.mockReturnValue(false);
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(2);

    postHook(JSON.stringify({ hook_event_name: 'UserPromptSubmit' }));
    vi.advanceTimersByTime(15000);

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
    vi.advanceTimersByTime(17000);

    expect(mocks.win.show).not.toHaveBeenCalled();
    mocks.win.isVisible.mockReturnValue(false);
    vi.useRealTimers();
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
