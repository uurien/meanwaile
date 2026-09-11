import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// End-to-end wiring of main.ts: adapters → StateMachine + ExecutionTracker →
// native notifications, game interruptions, tray counters and IPC. Runs in
// its own module registry so the tracker / state-machine singletons start
// clean, separate from tests/main.test.ts.

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
    getBounds: vi.fn(() => ({ width: 440, height: 540 })),
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => { winHandlers[event] = handler; }),
    loadFile: vi.fn(),
    webContents: { send: vi.fn(), openDevTools: vi.fn() },
    handlers: winHandlers,
  };

  const trayHandlers: Record<string, (...a: unknown[]) => void> = {};
  const tray = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    popUpContextMenu: vi.fn(),
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => { trayHandlers[event] = handler; }),
    getBounds: vi.fn(() => ({ x: 100, y: 50, width: 22, height: 22 })),
    handlers: trayHandlers,
  };

  const screen = {
    getDisplayMatching: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } })),
    getPrimaryDisplay: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } })),
  };

  const appHandlers: Record<string, (...a: unknown[]) => void> = {};
  const app = {
    dock: { hide: vi.fn(), setIcon: vi.fn() },
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => { appHandlers[event] = handler; }),
    quit: vi.fn(),
    focus: vi.fn(),
    setLoginItemSettings: vi.fn(),
    getVersion: vi.fn(() => '0.8.1'),
    setAboutPanelOptions: vi.fn(),
    showAboutPanel: vi.fn(),
    getPath: vi.fn(() => '/fake/userData'),
    handlers: appHandlers,
  };

  let capturedHttpHandler: ((req: Record<string, unknown>, res: Record<string, unknown>) => void) | null = null;
  const serverHandlers: Record<string, (...a: unknown[]) => void> = {};
  const server = {
    listen: vi.fn((_p: unknown, _h: unknown, cb?: () => void) => cb?.()),
    close: vi.fn(),
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => { serverHandlers[event] = handler; }),
    handlers: serverHandlers,
  };
  const httpCreateServer = vi.fn((handler: (req: Record<string, unknown>, res: Record<string, unknown>) => void) => {
    capturedHttpHandler = handler;
    return server;
  });

  const ipcMainHandlers: Record<string, (...a: unknown[]) => void> = {};
  const ipcMain = {
    on: vi.fn((event: string, handler: (...a: unknown[]) => void) => { ipcMainHandlers[event] = handler; }),
    handle: vi.fn((event: string, handler: (...a: unknown[]) => void) => { ipcMainHandlers[event] = handler; }),
    handlers: ipcMainHandlers,
  };

  const powerMonitor = { getSystemIdleTime: vi.fn(() => 0) };
  const dialog = { showMessageBox: vi.fn(async () => ({ response: 1 })) };

  const notificationInstance = { on: vi.fn(), show: vi.fn() };
  const Notification = Object.assign(vi.fn(() => notificationInstance), { isSupported: vi.fn(() => true) });

  const DEFAULT_SETTINGS = {
    httpPort: 3821,
    autoOpenDelaySeconds: 15,
    autoOpenGames: true,
    notificationsEnabled: false,
    notifyNeedsUser: true,
    notifyFinished: true,
    notificationSound: 'none' as const,
  };
  const readSettings = vi.fn(() => ({ ...DEFAULT_SETTINGS }));
  const writeSettings = vi.fn();
  const validateSettings = vi.fn((input: Record<string, unknown>) => {
    const pick = (k: string, d: unknown) => (input[k] === undefined ? d : input[k]);
    return {
      ok: true,
      settings: {
        httpPort: Number(input.httpPort),
        autoOpenDelaySeconds: Number(input.autoOpenDelaySeconds),
        autoOpenGames: pick('autoOpenGames', true),
        notificationsEnabled: pick('notificationsEnabled', false),
        notifyNeedsUser: pick('notifyNeedsUser', true),
        notifyFinished: pick('notifyFinished', true),
        notificationSound: pick('notificationSound', 'none'),
      },
    };
  });

  const hasManagedHooks = vi.fn(() => false);
  const renameClaudeHookUrl = vi.fn();
  const hasManagedCodexHooks = vi.fn(() => false);
  const renameCodexHookUrl = vi.fn();

  return {
    win, tray, screen, app, server, ipcMain, powerMonitor, dialog,
    Notification, notificationInstance,
    DEFAULT_SETTINGS, readSettings, writeSettings, validateSettings,
    hasManagedHooks, renameClaudeHookUrl, hasManagedCodexHooks, renameCodexHookUrl,
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
  Notification: mocks.Notification,
}));
vi.mock('electron-squirrel-startup', () => ({ default: false }));
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
  hasManagedHooks: mocks.hasManagedHooks,
  renameClaudeHookUrl: mocks.renameClaudeHookUrl,
}));
vi.mock('../src/codex-settings', () => ({
  installCodexHooks: vi.fn(),
  hasManagedHooks: mocks.hasManagedCodexHooks,
  renameCodexHookUrl: mocks.renameCodexHookUrl,
  hasCodexInstalled: vi.fn(() => false),
}));
vi.mock('../src/codex-config', () => ({ ensureCodexHooksFeatureEnabled: vi.fn() }));
vi.mock('../src/settings-store', () => ({
  DEFAULT_SETTINGS: mocks.DEFAULT_SETTINGS,
  readSettings: mocks.readSettings,
  writeSettings: mocks.writeSettings,
  validateSettings: mocks.validateSettings,
}));
vi.mock('../src/game-installer', () => ({
  installGame: vi.fn(async () => {}),
  uninstallGame: vi.fn(),
  readInstalledGames: vi.fn(() => []),
}));
vi.mock('../src/games-gallery', () => ({ fetchCatalog: vi.fn(async () => ({ ok: true, games: [] })) }));
vi.mock('../src/e2e-hooks', () => ({ installE2ETestHooks: vi.fn() }));

import '../src/main';

function postHook(body: Record<string, unknown>, url = '/hook') {
  const handler = mocks.httpHandler()!;
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
  handler(req as never, res as never);
  dataHandlers.forEach((cb) => cb(JSON.stringify(body)));
  endHandlers.forEach((cb) => cb());
}

const ipc = (name: string, ...args: unknown[]) => mocks.ipcMain.handlers[name]?.({}, ...args);
const sends = (channel: string) =>
  mocks.win.webContents.send.mock.calls.filter(([c]) => c === channel).map(([, payload]) => payload);
const lastActivity = () => sends('activity-change').at(-1) as
  | { active: { id: string; adapterId: string; projectName?: string; status: string }[]; recent: unknown[]; counts: Record<string, number> }
  | undefined;
const interruptions = () => sends('agent-interruption') as { transition: string; counts: Record<string, number> }[];
const notificationArgs = () => mocks.Notification.mock.calls.map(([opts]) => opts as { title: string; body: string; silent: boolean });

async function setSettings(over: Record<string, unknown>) {
  await ipc('settings-save', {
    httpPort: 3821,
    autoOpenDelaySeconds: 15,
    autoOpenGames: true,
    notificationsEnabled: false,
    notifyNeedsUser: true,
    notifyFinished: true,
    notificationSound: 'none',
    ...over,
  });
}

beforeAll(async () => {
  await mocks.app.handlers['ready']();
});

beforeEach(() => {
  mocks.win.webContents.send.mockClear();
  mocks.Notification.mockClear();
  mocks.notificationInstance.show.mockClear();
  mocks.tray.setToolTip.mockClear();
  mocks.win.isVisible.mockReturnValue(false);
});

describe('multi-agent activity projection', () => {
  it('keeps Claude and Codex on different projects as two distinct working executions', () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'c1', cwd: '/home/u/website' }, '/hook');
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'x1', cwd: '/home/u/api' }, '/hook/codex');

    const snap = lastActivity()!;
    expect(snap.counts.working).toBe(2);
    const byProject = Object.fromEntries(snap.active.map((e) => [e.projectName, e.adapterId]));
    expect(byProject.website).toBe('claude-code');
    expect(byProject.api).toBe('codex');

    postHook({ hook_event_name: 'Stop', session_id: 'c1' }, '/hook');
    postHook({ hook_event_name: 'Stop', session_id: 'x1' }, '/hook/codex');
  });

  it('keeps two sessions in the same project separate', () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'a', cwd: '/home/u/app' });
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'b', cwd: '/home/u/app' });

    const snap = lastActivity()!;
    expect(snap.counts.working).toBe(2);
    expect(new Set(snap.active.map((e) => e.id)).size).toBe(2);
    expect(snap.active.every((e) => e.projectName === 'app')).toBe(true);

    postHook({ hook_event_name: 'Stop', session_id: 'a' });
    postHook({ hook_event_name: 'Stop', session_id: 'b' });
  });
});

describe('interruptions and notifications across agents', () => {
  beforeEach(async () => {
    await setSettings({ notificationsEnabled: true });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();
  });

  it('one agent finishing while another works: counters drop, the game is interrupted, the notification names the remaining worker', async () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 's1', cwd: '/home/u/website' });
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 's2', cwd: '/home/u/api' });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();

    const recentBefore = (await ipc('activity-get')).recent.length;
    postHook({ hook_event_name: 'Stop', session_id: 's1' });

    expect(interruptions().at(-1)).toMatchObject({ transition: 'finished', counts: { working: 1 } });
    expect(lastActivity()!.counts.working).toBe(1);
    expect((await ipc('activity-get')).recent.length).toBe(recentBefore + 1);
    expect(notificationArgs().at(-1)).toMatchObject({
      title: 'Claude · website finished',
      body: '1 other agent is still working.',
      silent: true,
    });

    postHook({ hook_event_name: 'Stop', session_id: 's2' });
  });

  it('one agent needing the user while another works: needs-you counter rises, the game is interrupted and a notification is raised', () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 's1', cwd: '/home/u/website' });
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 's2' });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();

    postHook({ hook_event_name: 'Notification', notification_type: 'permission_prompt', session_id: 's1', cwd: '/home/u/website' });

    expect(interruptions().at(-1)).toMatchObject({ transition: 'needs_user' });
    expect(lastActivity()!.counts).toMatchObject({ working: 1, needsUser: 1 });
    expect(notificationArgs().at(-1)).toMatchObject({ title: 'Claude · website needs your attention' });

    postHook({ hook_event_name: 'Stop', session_id: 's1' });
    postHook({ hook_event_name: 'Stop', session_id: 's2' });
  });

  it('the last execution finishing zeroes the counters, interrupts the game and says no agents remain', () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'solo', cwd: '/home/u/website' });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();

    postHook({ hook_event_name: 'Stop', session_id: 'solo' });

    expect(interruptions().at(-1)).toMatchObject({ transition: 'finished', counts: { working: 0, needsUser: 0 } });
    expect(notificationArgs().at(-1)!.body).toBe('No other agents are active.');
    expect(mocks.tray.setToolTip.mock.calls.at(-1)![0]).toBe('Meanwaile');
  });
});

describe('idempotency and subagents', () => {
  beforeEach(async () => {
    await setSettings({ notificationsEnabled: true });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();
  });

  it('duplicate Notification / Stop hooks produce a single interruption and a single notification each', () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'dup', cwd: '/home/u/website' });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();

    postHook({ hook_event_name: 'Notification', notification_type: 'permission_prompt', session_id: 'dup' });
    postHook({ hook_event_name: 'Notification', notification_type: 'permission_prompt', session_id: 'dup' });
    expect(interruptions().filter((i) => i.transition === 'needs_user')).toHaveLength(1);

    postHook({ hook_event_name: 'Stop', session_id: 'dup' });
    postHook({ hook_event_name: 'Stop', session_id: 'dup' });
    expect(interruptions().filter((i) => i.transition === 'finished')).toHaveLength(1);
    expect(notificationArgs().filter((n) => n.title.includes('finished'))).toHaveLength(1);
  });

  it('SubagentStop never interrupts, notifies or moves the counters', () => {
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'parent', cwd: '/home/u/website' });
    const before = lastActivity()!.counts.working;
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();

    postHook({ hook_event_name: 'SubagentStop', session_id: 'parent', agent_id: 'child' });

    expect(sends('agent-interruption')).toHaveLength(0);
    expect(mocks.Notification).not.toHaveBeenCalled();
    // no activity-change was emitted at all for the ignored hook
    expect(sends('activity-change')).toHaveLength(0);

    postHook({ hook_event_name: 'Stop', session_id: 'parent' });
    expect(lastActivity()!.counts.working).toBe(before - 1);
  });
});

describe('silent stale-agent discard', () => {
  it('removes an agent after ten minutes without hooks and does not finish, interrupt or notify', async () => {
    vi.useFakeTimers();
    await setSettings({ autoOpenGames: false, notificationsEnabled: true });
    const recentBefore = (await ipc('activity-get')).recent.length;

    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'goes-stale' });
    mocks.win.webContents.send.mockClear();
    mocks.Notification.mockClear();
    vi.advanceTimersByTime(10 * 60 * 1000 - 1);

    expect((await ipc('activity-get')).counts.active).toBe(1);
    expect(lastActivity()).toBeUndefined();

    vi.advanceTimersByTime(1);

    expect(lastActivity()!.counts).toMatchObject({ active: 0, working: 0, needsUser: 0 });
    expect((await ipc('activity-get')).recent).toHaveLength(recentBefore);
    expect(interruptions()).toHaveLength(0);
    expect(mocks.Notification).not.toHaveBeenCalled();
    expect(mocks.tray.setToolTip.mock.calls.at(-1)![0]).toBe('Meanwaile');
    expect(sends('state-change').at(-1)).toEqual({
      state: 'idle',
      sessionId: null,
      agentName: null,
      silent: true,
    });

    vi.useRealTimers();
    await setSettings({});
  });
});

describe('settings acceptance matrix', () => {
  it.each([
    { autoOpenGames: true, notificationsEnabled: false, timerArms: true, notifies: false },
    { autoOpenGames: false, notificationsEnabled: true, timerArms: false, notifies: true },
    { autoOpenGames: true, notificationsEnabled: true, timerArms: true, notifies: true },
    { autoOpenGames: false, notificationsEnabled: false, timerArms: false, notifies: false },
  ])('autoOpenGames=$autoOpenGames notificationsEnabled=$notificationsEnabled', async ({
    autoOpenGames, notificationsEnabled, timerArms, notifies,
  }) => {
    await setSettings({ autoOpenGames, notificationsEnabled });
    vi.useFakeTimers();
    mocks.win.show.mockClear();
    mocks.Notification.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    const sid = `matrix-${autoOpenGames}-${notificationsEnabled}`;
    postHook({ hook_event_name: 'UserPromptSubmit', session_id: sid, cwd: '/home/u/website' });
    vi.advanceTimersByTime(16000);
    expect(mocks.win.show).toHaveBeenCalledTimes(timerArms ? 1 : 0);

    postHook({ hook_event_name: 'Stop', session_id: sid });
    expect(mocks.Notification.mock.calls.length > 0).toBe(notifies);

    vi.useRealTimers();
    await setSettings({});
  });
});

describe('regressions preserved', () => {
  it('gallery install still tells the popover to refresh the Games tab', async () => {
    mocks.win.webContents.send.mockClear();
    await ipc('gallery-install', 'meanwaile-maze', '0.1.0');
    expect(sends('games-changed')).toHaveLength(1);
  });

  it('a port change still asks before rewriting an installed Claude hook', async () => {
    mocks.hasManagedHooks.mockReturnValueOnce(true);
    mocks.dialog.showMessageBox.mockClear();
    mocks.dialog.showMessageBox.mockResolvedValueOnce({ response: 0 });
    mocks.renameClaudeHookUrl.mockClear();

    await setSettings({ httpPort: 4321 });

    expect(mocks.dialog.showMessageBox).toHaveBeenCalledTimes(1);
    expect(mocks.renameClaudeHookUrl).toHaveBeenCalled();
    await ipc('settings-save', {
      httpPort: 3821, autoOpenDelaySeconds: 15, autoOpenGames: true, notificationsEnabled: false,
      notifyNeedsUser: true, notifyFinished: true, notificationSound: 'none',
    });
  });

  it('dismissing the popover suppresses the single-check auto-open for the rest of the turn', () => {
    vi.useFakeTimers();
    mocks.win.show.mockClear();
    mocks.powerMonitor.getSystemIdleTime.mockReturnValue(20);

    postHook({ hook_event_name: 'UserPromptSubmit', session_id: 'suppress' });
    postHook({ hook_event_name: 'Notification', notification_type: 'permission_prompt', session_id: 'suppress' });
    ipc('popover-close');
    mocks.win.show.mockClear();

    postHook({ hook_event_name: 'PreToolUse', session_id: 'suppress' });
    vi.advanceTimersByTime(16000);
    expect(mocks.win.show).not.toHaveBeenCalled();

    vi.useRealTimers();
    postHook({ hook_event_name: 'Stop', session_id: 'suppress' });
  });
});
