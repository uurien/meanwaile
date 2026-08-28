'use strict';

// E2E install smoke test: launch the *installed* Meanwaile (from a real
// .deb / .dmg / Squirrel install, signed or not) and confirm it doesn't
// crash on open. It's deliberately dumb - spawn the installed binary,
// wait out a grace period, and check the process is still alive. A menu-bar
// app with no window has nothing else to assert on this early.
//
// Runs from ci.yml's `smoke-install` job, one leg per OS, after that leg
// has built and installed the platform's own installer. Not a Vitest test
// (it needs a real OS install), but the pure helpers below are covered by
// tests/scripts/smoke-open-installed.test.ts.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Long enough for Electron to get past `app.on('ready')` (tray icon, HTTP
// server, adapter wiring) and reveal a startup crash; short enough to keep
// the CI job quick. Override with SMOKE_GRACE_MS.
const DEFAULT_GRACE_MS = 15_000;

// Where each platform's installer drops the launchable executable:
// - macOS: the .app copied into /Applications, run its inner Mach-O directly
//   (bypasses LaunchServices/Gatekeeper, which is fine for a locally built,
//   un-quarantined bundle).
// - Windows: Squirrel installs a stub launcher at %LOCALAPPDATA%\<name>\<name>.exe
//   that always points at the current versioned app-x.y.z folder.
// - Linux: electron-installer-debian symlinks /usr/bin/<options.name> (lowercase
//   "meanwaile") to /opt/Meanwaile/Meanwaile.
function installedBinaryPath(platform, env = process.env, deps = {}) {
  const fsImpl = deps.fs || fs;
  if (platform === 'darwin') {
    return '/Applications/Meanwaile.app/Contents/MacOS/Meanwaile';
  }
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const root = path.join(localAppData, 'Meanwaile');
    // <root>\Meanwaile.exe is Squirrel's forwarding stub: it relaunches the
    // real app in the versioned app-<version>\ folder and exits 0 straight
    // away, which the smoke check would read as an instant self-exit. Watch
    // the versioned executable directly. (A fresh install has exactly one
    // app-* folder, so a lexical pick is enough here.)
    try {
      const appDir = fsImpl
        .readdirSync(root)
        .filter((name) => name.startsWith('app-'))
        .sort()
        .pop();
      if (appDir) {
        return path.join(root, appDir, 'Meanwaile.exe');
      }
    } catch {
      // No install dir yet - fall back to the stub path so the caller's
      // existsSync check produces the "did the installer run?" error.
    }
    return path.join(root, 'Meanwaile.exe');
  }
  if (platform === 'linux') {
    return '/usr/bin/meanwaile';
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

function launchArgs(platform, userDataDir) {
  const args = [`--user-data-dir=${userDataDir}`];
  if (platform === 'linux') {
    // Xvfb has no real GPU and GitHub's runners restrict user namespaces -
    // same flags the e2e/ Playwright specs pass for the same reasons.
    args.push('--no-sandbox', '--disable-gpu');
  }
  return args;
}

function classifyOutcome({ exitedEarly, code, signal }) {
  if (!exitedEarly) {
    return { ok: true, reason: 'still running after the grace period' };
  }
  if (code === 0) {
    return {
      ok: false,
      reason: 'app exited on its own during the grace period (a menu-bar app should stay running)',
    };
  }
  return {
    ok: false,
    reason: `app crashed on startup (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
  };
}

// A scratch userData dir pre-marked as fully onboarded, so `app.on('ready')`
// never opens the click-and-wait onboarding dialogs (see onboarding-store.ts)
// and the app can run unattended. Mirrors the e2e/ specs' beforeAll seeding.
function seedOnboardedUserDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-smoke-'));
  fs.writeFileSync(
    path.join(dir, 'onboarding.json'),
    JSON.stringify({ onboarded: true, hookBackfillOffered: true, codexHookBackfillOffered: true }),
  );
  return dir;
}

async function smokeOpen({
  platform = process.platform,
  graceMs = DEFAULT_GRACE_MS,
  env = process.env,
  // Test seams: point at a stub instead of the real install.
  binPath,
  spawnArgs,
} = {}) {
  const bin = binPath || installedBinaryPath(platform, env);
  if (!fs.existsSync(bin)) {
    throw new Error(`Installed binary not found at ${bin} - did the installer step run?`);
  }

  const userDataDir = seedOnboardedUserDataDir();
  const args = spawnArgs || launchArgs(platform, userDataDir);
  const child = spawn(bin, args, {
    env: { ...env, MEANWAILE_E2E: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ exitedEarly: false }), graceMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ exitedEarly: true, code, signal });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve({ exitedEarly: true, code: null, signal: null, error });
    });
  });

  if (!outcome.exitedEarly) {
    child.kill('SIGTERM');
  }
  fs.rmSync(userDataDir, { recursive: true, force: true });

  return { ...classifyOutcome(outcome), stderr, outcome };
}

async function main() {
  const graceMs = Number(process.env.SMOKE_GRACE_MS) || DEFAULT_GRACE_MS;
  console.log(`[smoke] platform=${process.platform} grace=${graceMs}ms`);

  const { ok, reason, stderr } = await smokeOpen({ graceMs });
  console.log(`[smoke] ${ok ? 'PASS' : 'FAIL'}: ${reason}`);
  if (!ok && stderr.trim()) {
    console.log(`[smoke] captured stderr:\n${stderr}`);
  }
  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_GRACE_MS,
  installedBinaryPath,
  launchArgs,
  classifyOutcome,
  seedOnboardedUserDataDir,
  smokeOpen,
};
