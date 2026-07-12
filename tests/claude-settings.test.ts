import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { installClaudeHooks, hasManagedHooks, renameClaudeHookUrl } from '../src/claude-settings';

const URL = 'http://localhost:3821/hook';
const MANAGED_EVENTS = ['Notification', 'Stop', 'SubagentStop', 'UserPromptSubmit'];

function readSettings(settingsPath: string) {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

describe('installClaudeHooks', () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    settingsPath = path.join(dir, 'settings.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the file with exactly the 4 managed events when missing', () => {
    installClaudeHooks(settingsPath, URL);
    const settings = readSettings(settingsPath);

    for (const event of MANAGED_EVENTS) {
      expect(settings.hooks[event]).toEqual([{ hooks: [{ type: 'http', url: URL }] }]);
    }
    expect(settings.hooks.PreToolUse).toBeUndefined();
    expect(settings.hooks.PostToolUse).toBeUndefined();
  });

  it('creates the parent directory if missing', () => {
    const nestedPath = path.join(dir, 'nested', 'settings.json');
    installClaudeHooks(nestedPath, URL);
    expect(readSettings(nestedPath).hooks.Stop).toBeDefined();
  });

  it('preserves an existing unrelated hook entry for a managed event', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'some-other-tool' }] }],
        },
      }),
    );

    installClaudeHooks(settingsPath, URL);
    const settings = readSettings(settingsPath);

    expect(settings.hooks.Stop).toEqual([
      { hooks: [{ type: 'command', command: 'some-other-tool' }] },
      { hooks: [{ type: 'http', url: URL }] },
    ]);
  });

  it('preserves unrelated top-level keys', () => {
    fs.writeFileSync(settingsPath, JSON.stringify({ otherSetting: true }));
    installClaudeHooks(settingsPath, URL);
    expect(readSettings(settingsPath).otherSetting).toBe(true);
  });

  it('is idempotent — calling twice does not duplicate entries', () => {
    installClaudeHooks(settingsPath, URL);
    installClaudeHooks(settingsPath, URL);
    const settings = readSettings(settingsPath);

    for (const event of MANAGED_EVENTS) {
      expect(settings.hooks[event]).toEqual([{ hooks: [{ type: 'http', url: URL }] }]);
    }
  });

  it('tolerates a malformed existing entry without a hooks array', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { Stop: [{ notHooks: true }] } }),
    );

    installClaudeHooks(settingsPath, URL);
    const settings = readSettings(settingsPath);

    expect(settings.hooks.Stop).toEqual([
      { notHooks: true },
      { hooks: [{ type: 'http', url: URL }] },
    ]);
  });

  it('leaves pre-existing PreToolUse/PostToolUse untouched', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [{ hooks: [{ type: 'command', command: 'legacy' }] }],
          PostToolUse: [{ hooks: [{ type: 'command', command: 'legacy' }] }],
        },
      }),
    );

    installClaudeHooks(settingsPath, URL);
    const settings = readSettings(settingsPath);

    expect(settings.hooks.PreToolUse).toEqual([{ hooks: [{ type: 'command', command: 'legacy' }] }]);
    expect(settings.hooks.PostToolUse).toEqual([{ hooks: [{ type: 'command', command: 'legacy' }] }]);
  });

  it('does not clobber a malformed settings file — logs a warning and leaves it untouched', () => {
    fs.writeFileSync(settingsPath, 'not-json');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    installClaudeHooks(settingsPath, URL);

    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('not-json');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not touch an existing hook on a different port — leaves both in place', () => {
    // Simulates another tool (or a previous, out-of-sync Meanwaile install)
    // already registered on a different port under the same generic /hook path.
    const otherToolUrl = 'http://localhost:4000/hook';
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'http', url: otherToolUrl }] }] } }),
    );

    installClaudeHooks(settingsPath, URL);
    const settings = readSettings(settingsPath);

    expect(settings.hooks.Stop).toEqual([
      { hooks: [{ type: 'http', url: otherToolUrl }] },
      { hooks: [{ type: 'http', url: URL }] },
    ]);
  });
});

describe('renameClaudeHookUrl', () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    settingsPath = path.join(dir, 'settings.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('replaces the exact previous URL with the new one, in place', () => {
    installClaudeHooks(settingsPath, URL);

    const newUrl = 'http://localhost:4000/hook';
    renameClaudeHookUrl(settingsPath, URL, newUrl);
    const settings = readSettings(settingsPath);

    for (const event of MANAGED_EVENTS) {
      expect(settings.hooks[event]).toEqual([{ hooks: [{ type: 'http', url: newUrl }] }]);
    }
  });

  it('does not touch another tool\'s hook that happens to share the /hook path on a different port', () => {
    const otherToolUrl = 'http://localhost:5000/hook';
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: 'http', url: otherToolUrl }] }] },
      }),
    );

    renameClaudeHookUrl(settingsPath, URL, 'http://localhost:4000/hook');
    const settings = readSettings(settingsPath);

    expect(settings.hooks.Stop).toEqual([{ hooks: [{ type: 'http', url: otherToolUrl }] }]);
  });

  it('is a no-op when the settings file does not exist', () => {
    renameClaudeHookUrl(settingsPath, URL, 'http://localhost:4000/hook');
    expect(fs.existsSync(settingsPath)).toBe(false);
  });

  it('is a no-op when the old URL is not present', () => {
    installClaudeHooks(settingsPath, URL);
    renameClaudeHookUrl(settingsPath, 'http://localhost:9999/hook', 'http://localhost:4000/hook');
    const settings = readSettings(settingsPath);

    for (const event of MANAGED_EVENTS) {
      expect(settings.hooks[event]).toEqual([{ hooks: [{ type: 'http', url: URL }] }]);
    }
  });

  it('does not clobber a malformed settings file — logs a warning and leaves it untouched', () => {
    fs.writeFileSync(settingsPath, 'not-json');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renameClaudeHookUrl(settingsPath, URL, 'http://localhost:4000/hook');

    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('not-json');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('hasManagedHooks', () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    settingsPath = path.join(dir, 'settings.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns false when the settings file does not exist', () => {
    expect(hasManagedHooks(settingsPath, URL)).toBe(false);
  });

  it('returns false when the settings file has no managed hooks', () => {
    fs.writeFileSync(settingsPath, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x' }] }] } }));
    expect(hasManagedHooks(settingsPath, URL)).toBe(false);
  });

  it('returns true once installClaudeHooks has run for that exact URL', () => {
    installClaudeHooks(settingsPath, URL);
    expect(hasManagedHooks(settingsPath, URL)).toBe(true);
  });

  it('returns false for a hook configured on a different port', () => {
    installClaudeHooks(settingsPath, 'http://localhost:4000/hook');
    expect(hasManagedHooks(settingsPath, URL)).toBe(false);
  });

  it('returns false for malformed JSON', () => {
    fs.writeFileSync(settingsPath, 'not-json');
    expect(hasManagedHooks(settingsPath, URL)).toBe(false);
  });
});
