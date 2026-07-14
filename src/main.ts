import { app, Tray, BrowserWindow, Menu, nativeImage, ipcMain, powerMonitor, dialog } from 'electron';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { ClaudeCodeAdapter } from './adapters/claude-code';
import { StateMachine } from './state-machine';
import { hasOnboarded, markOnboarded, hasOfferedHookBackfill, markHookBackfillOffered } from './onboarding-store';
import { installClaudeHooks, hasManagedHooks, renameClaudeHookUrl } from './claude-settings';
import { AppSettings, DEFAULT_SETTINGS, readSettings, writeSettings, validateSettings } from './settings-store';

// Prevent Dock icon on macOS — this is a menu-bar-only app
app.dock?.hide();

// `npm run dev` sets this so every window opens with its DevTools attached
// (detached, so it doesn't cover the window it's inspecting).
const isDev = Boolean(process.env.MEANWAILE_DEV);

// The widget's own size (matches popover.css's #root).
const POPOVER_WIDTH = 440;
const POPOVER_HEIGHT = 540;

let tray: Tray | null = null;
let popover: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let httpServer: http.Server | null = null;
let autoOpenTimer: ReturnType<typeof setTimeout> | null = null;
let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };

const adapter = new ClaudeCodeAdapter();
const machine = new StateMachine();

function createPopover(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    // Fully transparent ARGB - without this a transparent window still
    // falls back to an opaque black fill, which showed through popover.css's
    // rounded body as a solid black ring (the "double border" bug).
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'popover', 'index.html'));
  if (isDev) {
    // Show it immediately instead of waiting for a tray click, and skip the
    // blur-hide below - otherwise focusing the detached DevTools window would
    // instantly hide the very popover it's inspecting.
    win.webContents.once('did-finish-load', () => {
      win.show();
      win.webContents.openDevTools({ mode: 'detach' });
    });
  }

  // Debounce blur: the tray-icon click triggers a momentary blur right after
  // show(), which would instantly close the popover without this guard.
  let blurTimer: ReturnType<typeof setTimeout> | null = null;
  win.on('blur', () => {
    if (isDev) return;
    blurTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.hide();
    }, 150);
  });
  win.on('focus', () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
  });
  win.on('closed', () => { popover = null; });

  return win;
}

function showPopover(): void {
  /* v8 ignore next */
  if (!tray) return;

  if (!popover || popover.isDestroyed()) {
    popover = createPopover();
  }

  const trayBounds = tray.getBounds();
  const winBounds = popover.getBounds();

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  popover.setPosition(x, y);
  // Toggle visibleOnAllWorkspaces on just for the show() call so macOS places
  // the window on the currently active Space rather than the Space it was
  // last shown on. Leaving it permanently true stops the toggle from
  // re-triggering on the next show(), which is what caused the popup to jump
  // back to a previous Space when reopened after being hidden. Resetting it
  // back to false must happen on a later tick, not synchronously right after
  // show() — doing it synchronously races the Space assignment and caused an
  // earlier version of this same bug (see commit 6c278a1).
  popover.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  popover.show();
  popover.focus();
  const openedPopover = popover;
  setTimeout(() => {
    if (openedPopover && !openedPopover.isDestroyed()) {
      openedPopover.setVisibleOnAllWorkspaces(false, { visibleOnFullScreen: true });
    }
  }, 150);
}

function togglePopover(): void {
  if (popover && !popover.isDestroyed() && popover.isVisible()) {
    popover.hide();
    return;
  }
  showPopover();
}

// Called autoOpenDelaySeconds after the agent starts working. If nothing has
// interrupted that timer (agent already responded — see onStateChange) and
// the system has been idle for the whole window (no keys/clicks/trackpad
// input, which also covers window/Space switches since those require input),
// surface the popover automatically.
function maybeAutoOpenPopover(): void {
  if (popover && !popover.isDestroyed() && popover.isVisible()) return;
  if (powerMonitor.getSystemIdleTime() * 1000 >= currentSettings.autoOpenDelaySeconds * 1000) {
    showPopover();
  }
}

function hookUrlFor(port: number): string {
  return `http://localhost:${port}/hook`;
}

function claudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function startHttpServer(port: number): void {
  httpServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hook') {
      res.writeHead(404);
      res.end();
      return;
    }

    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');

      try {
        const body = JSON.parse(raw);
        adapter.emit(body);
      } catch {
        console.warn('[hook] could not parse body:', raw);
      }
    });
  });

  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`[meanwaile] HTTP server listening on http://127.0.0.1:${port}/hook`);
  });
}

function stopHttpServer(): void {
  httpServer?.close();
  httpServer = null;
}

// Applies a validated settings change: persists it, and if the port changed,
// restarts the HTTP server on the new port. If hooks were already installed
// for the previous port (user opted in during onboarding), rewriting
// ~/.claude/settings.json to the new port is a separate, explicit
// confirmation — the user asked not to have that file edited silently on
// their behalf. The rename matches the exact previous URL only, so it can
// never touch another tool's hook that happens to share the /hook path.
async function applySettings(newSettings: AppSettings): Promise<void> {
  const portChanged = newSettings.httpPort !== currentSettings.httpPort;
  const previousHookUrl = hookUrlFor(currentSettings.httpPort);

  currentSettings = newSettings;
  writeSettings(app.getPath('userData'), newSettings);

  if (portChanged) {
    stopHttpServer();
    startHttpServer(currentSettings.httpPort);

    const settingsPath = claudeSettingsPath();
    if (hasManagedHooks(settingsPath, previousHookUrl)) {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        cancelId: 1,
        message: `Update the Claude Code hook in ${settingsPath} to use port ${currentSettings.httpPort}?`,
      });
      if (response === 0) {
        renameClaudeHookUrl(settingsPath, previousHookUrl, hookUrlFor(currentSettings.httpPort));
      }
    }
  }
}

function showSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 300,
    height: 260,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Meanwaile — Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, '..', 'src', 'settings', 'index.html'));
  if (isDev) settingsWindow.webContents.openDevTools({ mode: 'detach' });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// Runs once, on the very first launch ever. Two separate dialogs — never
// combined into one screen — so each choice reads as its own decision.
async function runOnboardingIfNeeded(): Promise<void> {
  const userDataDir = app.getPath('userData');
  console.log('userDataDir', userDataDir)
  if (hasOnboarded(userDataDir)) return;

  const loginResult = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Yes', 'No'],
    defaultId: 0,
    cancelId: 1,
    message: 'Launch Meanwaile automatically when you log in?',
  });
  if (loginResult.response === 0) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  const hooksResult = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Yes', 'No'],
    defaultId: 0,
    cancelId: 1,
    message: 'Automatically configure Claude Code hooks for Meanwaile?',
  });
  if (hooksResult.response === 0) {
    installClaudeHooks(claudeSettingsPath(), hookUrlFor(currentSettings.httpPort));
  }

  markOnboarded(userDataDir);
  // A fresh onboarding always installs (or explicitly declines) every
  // currently managed event, so there's never anything to backfill for it.
  markHookBackfillOffered(userDataDir);
}

// Users who opted into hooks on an earlier version won't have events added
// to MANAGED_HOOK_EVENTS since then (e.g. PreToolUse) in their settings.json.
// Asks once, explicitly — like the port-rename confirmation in applySettings,
// this file is only ever touched with the user's say-so, never silently.
async function offerHookBackfillIfNeeded(): Promise<void> {
  const userDataDir = app.getPath('userData');
  if (hasOfferedHookBackfill(userDataDir)) return;

  const settingsPath = claudeSettingsPath();
  const hookUrl = hookUrlFor(currentSettings.httpPort);
  if (hasManagedHooks(settingsPath, hookUrl)) {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
      message: `Meanwaile added a new Claude Code hook event since you last configured it. Add it to ${settingsPath}?`,
    });
    if (response === 0) {
      installClaudeHooks(settingsPath, hookUrl);
    }
  }

  markHookBackfillOffered(userDataDir);
}

app.on('ready', async () => {
  currentSettings = readSettings(app.getPath('userData'));

  await runOnboardingIfNeeded();
  await offerHookBackfillIfNeeded();

  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Meanwaile');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Exit', click: () => app.quit() },
  ]);
  tray.on('click', togglePopover);
  tray.on('right-click', () => tray!.popUpContextMenu(contextMenu));

  popover = createPopover();

  ipcMain.on('popover-close', () => { popover?.hide(); });
  ipcMain.on('open-settings', () => { showSettingsWindow(); });
  ipcMain.handle('settings-get', () => currentSettings);
  ipcMain.handle('settings-save', async (_event, incoming) => {
    const result = validateSettings(incoming);
    if (!result.ok) return result;

    await applySettings(result.settings);
    settingsWindow?.close();
    return result;
  });

  adapter.onEvent((event) => machine.handle(event));
  machine.onStateChange((snapshot) => {
    popover?.webContents.send('state-change', snapshot);

    if (autoOpenTimer) {
      clearTimeout(autoOpenTimer);
      autoOpenTimer = null;
    }
    if (snapshot.state === 'agent_working') {
      // setTimeout's clock and the OS's HID-idle clock don't share an origin:
      // by the time this fires at exactly the configured delay, getSystemIdleTime()
      // often reads a second short (e.g. 14 instead of 15) because of the delay
      // between the last real input and when the hook reached us and we armed
      // this timer. The extra buffer absorbs that gap so we don't miss the
      // threshold on every near-exact hit.
      autoOpenTimer = setTimeout(maybeAutoOpenPopover, currentSettings.autoOpenDelaySeconds * 1000 + 2000);
    }
  });

  startHttpServer(currentSettings.httpPort);
});

app.on('window-all-closed', () => {
  // Do not quit — this is a menu-bar app with no windows
});

app.on('before-quit', () => {
  stopHttpServer();
});
