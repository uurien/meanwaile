import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  installCodexHooks,
  hasManagedHooks,
  renameCodexHookUrl,
  codexCommandFor,
  hasCodexInstalled,
} from '../src/codex-settings';

const URL = 'http://localhost:3821/hook/codex';
const MANAGED_EVENTS = ['UserPromptSubmit', 'Stop', 'SubagentStop', 'PreToolUse', 'PermissionRequest'];

function readHooks(hooksPath: string) {
  return JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
}

function entryFor(url: string) {
  return { hooks: [{ type: 'command', command: codexCommandFor(url), timeout: 30 }] };
}

function permissionEntryFor(url: string) {
  return { matcher: '*', hooks: [{ type: 'command', command: codexCommandFor(url), timeout: 30 }] };
}

describe('installCodexHooks', () => {
  let dir: string;
  let hooksPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    hooksPath = path.join(dir, 'hooks.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the file with exactly the 5 managed events when missing', () => {
    installCodexHooks(hooksPath, URL);
    const hooksFile = readHooks(hooksPath);

    for (const event of MANAGED_EVENTS) {
      if (event === 'PermissionRequest') {
        expect(hooksFile.hooks[event]).toEqual([permissionEntryFor(URL)]);
      } else {
        expect(hooksFile.hooks[event]).toEqual([entryFor(URL)]);
      }
    }
    expect(hooksFile.hooks.PostToolUse).toBeUndefined();
  });

  it('creates the parent directory if missing', () => {
    const nestedPath = path.join(dir, 'nested', 'hooks.json');
    installCodexHooks(nestedPath, URL);
    expect(readHooks(nestedPath).hooks.Stop).toBeDefined();
  });

  it('preserves an existing unrelated hook entry for a managed event', () => {
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'some-other-tool' }] }],
        },
      }),
    );

    installCodexHooks(hooksPath, URL);
    const hooksFile = readHooks(hooksPath);

    expect(hooksFile.hooks.Stop).toEqual([
      { hooks: [{ type: 'command', command: 'some-other-tool' }] },
      entryFor(URL),
    ]);
  });

  it('preserves unrelated top-level keys', () => {
    fs.writeFileSync(hooksPath, JSON.stringify({ otherSetting: true }));
    installCodexHooks(hooksPath, URL);
    expect(readHooks(hooksPath).otherSetting).toBe(true);
  });

  it('is idempotent — calling twice does not duplicate entries', () => {
    installCodexHooks(hooksPath, URL);
    installCodexHooks(hooksPath, URL);
    const hooksFile = readHooks(hooksPath);

    for (const event of MANAGED_EVENTS) {
      expect(hooksFile.hooks[event]).toHaveLength(1);
    }
  });

  it('tolerates a malformed existing entry without a hooks array', () => {
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({ hooks: { Stop: [{ notHooks: true }] } }),
    );

    installCodexHooks(hooksPath, URL);
    const hooksFile = readHooks(hooksPath);

    expect(hooksFile.hooks.Stop).toEqual([{ notHooks: true }, entryFor(URL)]);
  });

  it('leaves pre-existing PostToolUse untouched — it is not a managed event', () => {
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({
        hooks: {
          PostToolUse: [{ hooks: [{ type: 'command', command: 'legacy' }] }],
        },
      }),
    );

    installCodexHooks(hooksPath, URL);
    const hooksFile = readHooks(hooksPath);

    expect(hooksFile.hooks.PostToolUse).toEqual([{ hooks: [{ type: 'command', command: 'legacy' }] }]);
  });

  it('does not clobber a malformed hooks file — logs a warning and leaves it untouched', () => {
    fs.writeFileSync(hooksPath, 'not-json');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    installCodexHooks(hooksPath, URL);

    expect(fs.readFileSync(hooksPath, 'utf8')).toBe('not-json');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not touch an existing hook for a different URL — leaves both in place', () => {
    const otherUrl = 'http://localhost:4000/hook/codex';
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({ hooks: { Stop: [entryFor(otherUrl)] } }),
    );

    installCodexHooks(hooksPath, URL);
    const hooksFile = readHooks(hooksPath);

    expect(hooksFile.hooks.Stop).toEqual([entryFor(otherUrl), entryFor(URL)]);
  });
});

describe('renameCodexHookUrl', () => {
  let dir: string;
  let hooksPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    hooksPath = path.join(dir, 'hooks.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('replaces the exact previous URL with the new one, in place', () => {
    installCodexHooks(hooksPath, URL);

    const newUrl = 'http://localhost:4000/hook/codex';
    renameCodexHookUrl(hooksPath, URL, newUrl);
    const hooksFile = readHooks(hooksPath);

    for (const event of MANAGED_EVENTS) {
      if (event === 'PermissionRequest') {
        expect(hooksFile.hooks[event]).toEqual([permissionEntryFor(newUrl)]);
      } else {
        expect(hooksFile.hooks[event]).toEqual([entryFor(newUrl)]);
      }
    }
  });

  it('only renames the matching hook within an entry that has several, leaving the rest untouched', () => {
    const otherHook = { type: 'command', command: 'some-other-tool' };
    fs.writeFileSync(
      hooksPath,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: 'command', command: codexCommandFor(URL) }, otherHook] }] },
      }),
    );

    const newUrl = 'http://localhost:4000/hook/codex';
    renameCodexHookUrl(hooksPath, URL, newUrl);
    const hooksFile = readHooks(hooksPath);

    expect(hooksFile.hooks.Stop).toEqual([
      { hooks: [{ type: 'command', command: codexCommandFor(newUrl) }, otherHook] },
    ]);
  });

  it("does not touch another tool's hook that happens to share the same command shape", () => {
    const otherUrl = 'http://localhost:5000/hook/codex';
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { Stop: [entryFor(otherUrl)] } }));

    renameCodexHookUrl(hooksPath, URL, 'http://localhost:4000/hook/codex');
    const hooksFile = readHooks(hooksPath);

    expect(hooksFile.hooks.Stop).toEqual([entryFor(otherUrl)]);
  });

  it('is a no-op when the hooks file does not exist', () => {
    renameCodexHookUrl(hooksPath, URL, 'http://localhost:4000/hook/codex');
    expect(fs.existsSync(hooksPath)).toBe(false);
  });

  it('is a no-op when the old URL is not present', () => {
    installCodexHooks(hooksPath, URL);
    renameCodexHookUrl(hooksPath, 'http://localhost:9999/hook/codex', 'http://localhost:4000/hook/codex');
    const hooksFile = readHooks(hooksPath);

    for (const event of MANAGED_EVENTS) {
      if (event === 'PermissionRequest') {
        expect(hooksFile.hooks[event]).toEqual([permissionEntryFor(URL)]);
      } else {
        expect(hooksFile.hooks[event]).toEqual([entryFor(URL)]);
      }
    }
  });

  it('does not clobber a malformed hooks file — logs a warning and leaves it untouched', () => {
    fs.writeFileSync(hooksPath, 'not-json');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renameCodexHookUrl(hooksPath, URL, 'http://localhost:4000/hook/codex');

    expect(fs.readFileSync(hooksPath, 'utf8')).toBe('not-json');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('hasManagedHooks', () => {
  let dir: string;
  let hooksPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    hooksPath = path.join(dir, 'hooks.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns false when the hooks file does not exist', () => {
    expect(hasManagedHooks(hooksPath, URL)).toBe(false);
  });

  it('returns false when the hooks file has no managed hooks', () => {
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x' }] }] } }));
    expect(hasManagedHooks(hooksPath, URL)).toBe(false);
  });

  it('returns true once installCodexHooks has run for that exact URL', () => {
    installCodexHooks(hooksPath, URL);
    expect(hasManagedHooks(hooksPath, URL)).toBe(true);
  });

  it('returns false for a hook configured for a different URL', () => {
    installCodexHooks(hooksPath, 'http://localhost:4000/hook/codex');
    expect(hasManagedHooks(hooksPath, URL)).toBe(false);
  });

  it('returns false for malformed JSON', () => {
    fs.writeFileSync(hooksPath, 'not-json');
    expect(hasManagedHooks(hooksPath, URL)).toBe(false);
  });
});

describe('hasCodexInstalled', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns false when there is no .codex directory under the given home', () => {
    expect(hasCodexInstalled(dir)).toBe(false);
  });

  it('returns true when a .codex directory exists under the given home', () => {
    fs.mkdirSync(path.join(dir, '.codex'));
    expect(hasCodexInstalled(dir)).toBe(true);
  });
});
