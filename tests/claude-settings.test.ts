import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { installClaudeHooks } from '../src/claude-settings';

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
});
