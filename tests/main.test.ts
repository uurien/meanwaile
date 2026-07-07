import { describe, it, expect, vi, beforeAll } from 'vitest';

// ─── Hoisted mock state ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const winHandlers: Record<string, (...a: unknown[]) => void> = {};
  const win = {
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
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

  return {
    win,
    tray,
    server,
    app,
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
}));

vi.mock('http', () => ({ createServer: mocks.httpCreateServer }));

import '../src/main';

// ─── Helpers ──────────────────────────────────────────────────────────────
function triggerApp(event: string) {
  mocks.app.handlers[event]?.();
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
  beforeAll(() => {
    triggerApp('ready');
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

  it('context menu "Salir" click calls app.quit', () => {
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

  it('logs body object when hook_event_name is absent', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    postHook(JSON.stringify({ custom_field: 'value' }));
    expect(spy).toHaveBeenCalledWith('[hook]', expect.objectContaining({ custom_field: 'value' }));
    spy.mockRestore();
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
