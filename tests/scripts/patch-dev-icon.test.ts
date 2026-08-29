import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { patchDevIcon } from '../../scripts/patch-dev-icon.js';

let tmpDirs: string[] = [];
function mkTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-dev-icon-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

function silentLog() {}

describe('patchDevIcon', () => {
  it('does nothing on non-macOS platforms', () => {
    const dir = mkTmpDir();
    const sourcePath = path.join(dir, 'source.icns');
    const targetPath = path.join(dir, 'target.icns');
    fs.writeFileSync(sourcePath, 'custom-icon');
    fs.writeFileSync(targetPath, 'electron-icon');

    const patched = patchDevIcon({ sourcePath, targetPath, platform: 'linux', log: silentLog });

    expect(patched).toBe(false);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('electron-icon');
  });

  it('does nothing when the dev Electron.app is not installed', () => {
    const dir = mkTmpDir();
    const sourcePath = path.join(dir, 'source.icns');
    fs.writeFileSync(sourcePath, 'custom-icon');

    const patched = patchDevIcon({
      sourcePath,
      targetPath: path.join(dir, 'missing', 'electron.icns'),
      platform: 'darwin',
      log: silentLog,
    });

    expect(patched).toBe(false);
  });

  it('overwrites the dev Electron.app icon resource with the app icon on macOS', () => {
    const dir = mkTmpDir();
    const sourcePath = path.join(dir, 'source.icns');
    const targetPath = path.join(dir, 'target.icns');
    fs.writeFileSync(sourcePath, 'custom-icon');
    fs.writeFileSync(targetPath, 'electron-icon');

    const patched = patchDevIcon({ sourcePath, targetPath, platform: 'darwin', log: silentLog });

    expect(patched).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('custom-icon');
  });

  it('is a no-op when the icon is already patched', () => {
    const dir = mkTmpDir();
    const sourcePath = path.join(dir, 'source.icns');
    const targetPath = path.join(dir, 'target.icns');
    fs.writeFileSync(sourcePath, 'custom-icon');
    fs.writeFileSync(targetPath, 'custom-icon');

    const patched = patchDevIcon({ sourcePath, targetPath, platform: 'darwin', log: silentLog });

    expect(patched).toBe(false);
  });
});
