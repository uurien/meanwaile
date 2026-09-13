# Linux/Wayland notes

## Tray fixes (confirmed, wired into `src/main.ts`)

`src/tray-platform.ts` has two confirmed, tested fixes:

- **Tray icon** (`trayIconFileName`) — macOS's template-image auto-inversion has no Linux equivalent.
- **Menu wiring** (`shouldPersistContextMenu`) — AppIndicator/StatusNotifierItem trays never emit `click`/`right-click` at all, so the context menu must be registered via `tray.setContextMenu()` up front instead of shown on demand.

## Popover positioning — open problem, not solved

Confirmed on real hardware that `Tray.getBounds()`, `screen.getCursorScreenPoint()`, and `BrowserWindow.setPosition()` (both called after creation and passed to the constructor) are all unreliable-to-useless under GNOME/Mutter's native Wayland backend — clients simply don't get to control window placement there. The popover currently just opens wherever the compositor puts it (observed: top-left), and that's the accepted state for now.

Do not re-attempt:

1. Forcing `app.commandLine.appendSwitch('ozone-platform', 'x11')` to route through XWayland — tried, caused a GPU-process crash loop (`exit_code=139`) without even fixing `getBounds()`, since AppIndicator icons are managed over D-Bus independent of the app's Ozone backend.
2. A cursor-position or top-right-corner fallback via `setPosition()` — also confirmed ignored.

A real fix would need a draggable region so the user can position it manually (Wayland does respect user-initiated moves) — not yet built.

## Packaging

Done: `forge.config.js` has a `@electron-forge/maker-deb` entry producing `out/make/deb/x64/*.deb` (needs `bin: 'Meanwaile'` set explicitly — the packaged binary is capitalized, but the maker's default `bin` follows the lowercase `name` and fails to find it otherwise). CI builds it the same way as macOS/Windows: `ci.yml`'s `build-and-test`/`package` matrices and `release-publish.yml`'s `build-linux` job all include Ubuntu, installing `fakeroot`/`dpkg` first since `electron-installer-debian` needs them.
