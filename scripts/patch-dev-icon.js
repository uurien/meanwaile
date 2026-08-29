'use strict';

// Unpackaged `electron .` (used by `npm run start`/`dev`) runs
// node_modules/electron/dist/Electron.app directly - there is no separate
// "Meanwaile.app" bundle yet. macOS's native About panel, Cmd+Tab switcher,
// and Force Quit dialog all read the app icon from that bundle's own
// Info.plist-registered resource (CFBundleIconFile, "electron.icns"), not
// from anything settable at runtime - app.dock.setIcon() only changes the
// transient Dock tile bitmap, which doesn't even apply here since this is a
// menu-bar-only app (app.dock.hide()). A packaged build gets the right icon
// for free because electron-forge overwrites that same resource file with
// ours (verified: out/*/Meanwaile.app/Contents/Resources/electron.icns is
// byte-identical to assets/app-icon.icns). This script does the same
// overwrite against the dev copy in node_modules, so dev runs match.
// Runs as the `postinstall` npm lifecycle script; macOS-only, since the
// electron.icns resource only exists in the Electron.app bundle.

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_SOURCE_ICNS = path.join(ROOT_DIR, 'assets', 'app-icon.icns');
const DEFAULT_TARGET_ICNS = path.join(
  ROOT_DIR,
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Resources',
  'electron.icns',
);

function patchDevIcon({
  sourcePath = DEFAULT_SOURCE_ICNS,
  targetPath = DEFAULT_TARGET_ICNS,
  platform = process.platform,
  log = console.log,
} = {}) {
  if (platform !== 'darwin') {
    log('[dev-icon] skipping, not macOS');
    return false;
  }
  if (!fs.existsSync(targetPath)) {
    log(`[dev-icon] skipping, no dev Electron.app at ${targetPath}`);
    return false;
  }

  const source = fs.readFileSync(sourcePath);
  const current = fs.readFileSync(targetPath);
  if (Buffer.compare(source, current) === 0) {
    log('[dev-icon] already up to date');
    return false;
  }

  fs.copyFileSync(sourcePath, targetPath);
  log(`[dev-icon] patched ${targetPath}`);
  return true;
}

module.exports = { patchDevIcon, DEFAULT_SOURCE_ICNS, DEFAULT_TARGET_ICNS };

if (require.main === module) {
  patchDevIcon();
}
