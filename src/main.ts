import { app, Tray, BrowserWindow, Menu, nativeImage, ipcMain } from 'electron';
import * as http from 'http';
import * as path from 'path';
import { ClaudeCodeAdapter } from './adapters/claude-code';
import { StateMachine } from './state-machine';

const HTTP_PORT = 3821;

// Prevent Dock icon on macOS — this is a menu-bar-only app
app.dock?.hide();

let tray: Tray | null = null;
let popover: BrowserWindow | null = null;
let httpServer: http.Server | null = null;

const adapter = new ClaudeCodeAdapter();
const machine = new StateMachine();

function createPopover(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 160,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'popover', 'index.html'));

  // Debounce blur: the tray-icon click triggers a momentary blur right after
  // show(), which would instantly close the popover without this guard.
  let blurTimer: ReturnType<typeof setTimeout> | null = null;
  win.on('blur', () => {
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

function startHttpServer(): void {
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
        console.log('[hook]', body.hook_event_name ?? body);
        adapter.emit(body);
      } catch {
        console.warn('[hook] could not parse body:', raw);
      }
    });
  });

  httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[meanwaile] HTTP server listening on http://127.0.0.1:${HTTP_PORT}/hook`);
  });
}

app.on('ready', () => {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Meanwaile');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Salir', click: () => app.quit() },
  ]);
  tray.on('click', togglePopover);
  tray.on('right-click', () => tray!.popUpContextMenu(contextMenu));

  popover = createPopover();

  ipcMain.on('popover-close', () => { popover?.hide(); });

  adapter.onEvent((event) => machine.handle(event));
  machine.onStateChange((snapshot) => {
    popover?.webContents.send('state-change', snapshot);
  });

  startHttpServer();
});

app.on('window-all-closed', () => {
  // Do not quit — this is a menu-bar app with no windows
});

app.on('before-quit', () => {
  httpServer?.close();
});
