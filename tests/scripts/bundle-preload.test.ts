import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bundlePreload, DEFAULT_ENTRY_POINT, DEFAULT_OUTFILE, DEFAULT_EXTERNAL } from '../../scripts/bundle-preload.js';

let tmpDirs: string[] = [];
function mkTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-bundle-preload-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

describe('bundlePreload', () => {
  it('inlines a local require so the output has no require() of a project-relative path', () => {
    // Electron's sandboxed preload can only require() a fixed allowlist
    // (electron, events, timers, url) - not arbitrary local files. This
    // mirrors the real dist/ shape: preload.js requiring a sibling module.
    const dir = mkTmpDir();
    fs.writeFileSync(
      path.join(dir, 'dep.js'),
      "module.exports.CHANNELS = { stateChange: 'state-change' };\n",
    );
    fs.writeFileSync(
      path.join(dir, 'entry.js'),
      "const { CHANNELS } = require('./dep');\nmodule.exports = CHANNELS.stateChange;\n",
    );
    const outfile = path.join(dir, 'out.js');

    bundlePreload({ entryPoint: path.join(dir, 'entry.js'), outfile, external: [], log: () => {} });

    const output = fs.readFileSync(outfile, 'utf8');
    expect(output).not.toContain("require('./dep')");
    expect(output).not.toContain('require("./dep")');
    expect(output).toContain('state-change');
  });

  it('leaves an external module require untouched instead of trying to resolve it', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(
      path.join(dir, 'entry.js'),
      "const { contextBridge } = require('electron');\nmodule.exports = contextBridge;\n",
    );
    const outfile = path.join(dir, 'out.js');

    bundlePreload({ entryPoint: path.join(dir, 'entry.js'), outfile, external: ['electron'], log: () => {} });

    const output = fs.readFileSync(outfile, 'utf8');
    expect(output).toMatch(/require\(["']electron["']\)/);
  });

  it('defaults to bundling dist/preload.js in place, external to electron', () => {
    expect(DEFAULT_ENTRY_POINT.endsWith(path.join('dist', 'preload.js'))).toBe(true);
    expect(DEFAULT_OUTFILE).toBe(DEFAULT_ENTRY_POINT);
    expect(DEFAULT_EXTERNAL).toEqual(['electron']);
  });

  it('calls the injected log with the entry and output paths', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'entry.js'), 'module.exports = 1;\n');
    const outfile = path.join(dir, 'out.js');
    const messages: string[] = [];

    bundlePreload({ entryPoint: path.join(dir, 'entry.js'), outfile, external: [], log: (msg: string) => messages.push(msg) });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(outfile);
  });
});
