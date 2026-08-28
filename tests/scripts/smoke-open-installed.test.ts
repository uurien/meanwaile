import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_GRACE_MS,
  installedBinaryPath,
  launchArgs,
  classifyOutcome,
  seedOnboardedUserDataDir,
  smokeOpen,
} from '../../scripts/smoke-open-installed.js';

const scratchFiles: string[] = [];

function writeStubBinary(body: string): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-smoke-stub-')), 'stub.js');
  fs.writeFileSync(file, body);
  scratchFiles.push(path.dirname(file));
  return file;
}

afterEach(() => {
  while (scratchFiles.length) {
    fs.rmSync(scratchFiles.pop()!, { recursive: true, force: true });
  }
});

describe('installedBinaryPath', () => {
  it('points at the app bundle executable on macOS', () => {
    expect(installedBinaryPath('darwin', {})).toBe('/Applications/Meanwaile.app/Contents/MacOS/Meanwaile');
  });

  it('points at the Squirrel shim under LOCALAPPDATA on Windows', () => {
    expect(installedBinaryPath('win32', { LOCALAPPDATA: 'C:\\Users\\ci\\AppData\\Local' })).toBe(
      path.join('C:\\Users\\ci\\AppData\\Local', 'Meanwaile', 'Meanwaile.exe'),
    );
  });

  it('falls back to the default AppData\\Local path when LOCALAPPDATA is unset on Windows', () => {
    const resolved = installedBinaryPath('win32', {});
    expect(resolved.endsWith(path.join('AppData', 'Local', 'Meanwaile', 'Meanwaile.exe'))).toBe(true);
  });

  it('points at the .deb-installed symlink on Linux', () => {
    expect(installedBinaryPath('linux', {})).toBe('/usr/bin/meanwaile');
  });

  it('throws for an unsupported platform', () => {
    expect(() => installedBinaryPath('freebsd', {})).toThrow(/unsupported platform/i);
  });
});

describe('launchArgs', () => {
  it('always pins a scratch user-data dir', () => {
    expect(launchArgs('darwin', '/tmp/ud')).toEqual(['--user-data-dir=/tmp/ud']);
  });

  it('adds the headless Chromium flags Xvfb needs on Linux', () => {
    expect(launchArgs('linux', '/tmp/ud')).toEqual([
      '--user-data-dir=/tmp/ud',
      '--no-sandbox',
      '--disable-gpu',
    ]);
  });
});

describe('classifyOutcome', () => {
  it('passes when the app is still running after the grace period', () => {
    expect(classifyOutcome({ exitedEarly: false })).toEqual({
      ok: true,
      reason: expect.stringMatching(/still running/i),
    });
  });

  it('fails when the app exits cleanly on its own (a menu-bar app should stay up)', () => {
    expect(classifyOutcome({ exitedEarly: true, code: 0, signal: null })).toMatchObject({ ok: false });
  });

  it('fails and reports the code/signal when the app crashes on startup', () => {
    const result = classifyOutcome({ exitedEarly: true, code: 139, signal: null });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/139/);
  });
});

describe('seedOnboardedUserDataDir', () => {
  it('writes an onboarding.json that marks every first-run prompt as already handled', () => {
    const dir = seedOnboardedUserDataDir();
    scratchFiles.push(dir);
    const onboarding = JSON.parse(fs.readFileSync(path.join(dir, 'onboarding.json'), 'utf8'));
    expect(onboarding).toMatchObject({
      onboarded: true,
      hookBackfillOffered: true,
      codexHookBackfillOffered: true,
    });
  });
});

describe('smokeOpen', () => {
  it('has a sane default grace period', () => {
    expect(DEFAULT_GRACE_MS).toBeGreaterThanOrEqual(5_000);
  });

  it('passes when the binary is still alive at the end of the grace window, and kills it', async () => {
    const stub = writeStubBinary('setInterval(() => {}, 1000);');
    const result = await smokeOpen({
      platform: 'linux',
      graceMs: 400,
      binPath: process.execPath,
      spawnArgs: [stub],
    });
    expect(result.ok).toBe(true);
  });

  it('fails when the binary exits on its own before the grace window ends', async () => {
    const stub = writeStubBinary('process.exit(0);');
    const result = await smokeOpen({
      platform: 'linux',
      graceMs: 5_000,
      binPath: process.execPath,
      spawnArgs: [stub],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/on its own/i);
  });

  it('fails and captures stderr when the binary crashes on startup', async () => {
    const stub = writeStubBinary('process.stderr.write("boom\\n"); process.exit(139);');
    const result = await smokeOpen({
      platform: 'linux',
      graceMs: 5_000,
      binPath: process.execPath,
      spawnArgs: [stub],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/139/);
    expect(result.stderr).toMatch(/boom/);
  });

  it('throws a helpful error when the installed binary is missing', async () => {
    await expect(
      smokeOpen({ platform: 'linux', binPath: '/does/not/exist/meanwaile' }),
    ).rejects.toThrow(/not found/i);
  });
});
