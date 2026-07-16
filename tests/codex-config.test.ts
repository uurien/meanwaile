import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'smol-toml';
import { ensureCodexHooksFeatureEnabled } from '../src/codex-config';

function read(configPath: string) {
  return fs.readFileSync(configPath, 'utf8');
}

describe('ensureCodexHooksFeatureEnabled', () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
    configPath = path.join(dir, 'config.toml');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates the file with a [features] table when missing entirely', () => {
    ensureCodexHooksFeatureEnabled(configPath);
    const parsed = parse(read(configPath)) as { features?: { hooks?: boolean } };
    expect(parsed.features?.hooks).toBe(true);
  });

  it('creates the parent directory if missing', () => {
    const nestedPath = path.join(dir, 'nested', 'config.toml');
    ensureCodexHooksFeatureEnabled(nestedPath);
    const parsed = parse(read(nestedPath)) as { features?: { hooks?: boolean } };
    expect(parsed.features?.hooks).toBe(true);
  });

  it('appends a new [features] table when the file exists but has none, preserving existing content', () => {
    const original = 'notify = ["some-binary", "turn-ended"]\n\n[projects."/x"]\ntrust_level = "trusted"\n';
    fs.writeFileSync(configPath, original);

    ensureCodexHooksFeatureEnabled(configPath);
    const raw = read(configPath);
    const parsed = parse(raw) as {
      features?: { hooks?: boolean };
      notify?: string[];
      projects?: Record<string, unknown>;
    };

    expect(parsed.features?.hooks).toBe(true);
    expect(parsed.notify).toEqual(['some-binary', 'turn-ended']);
    expect(parsed.projects?.['/x']).toEqual({ trust_level: 'trusted' });
  });

  it('adds a newline before appending [features] when the existing file has no trailing newline', () => {
    fs.writeFileSync(configPath, 'notify = ["a", "turn-ended"]');

    ensureCodexHooksFeatureEnabled(configPath);
    const raw = read(configPath);

    expect(raw.startsWith('notify = ["a", "turn-ended"]\n')).toBe(true);
    const parsed = parse(raw) as { features?: { hooks?: boolean }; notify?: string[] };
    expect(parsed.features?.hooks).toBe(true);
    expect(parsed.notify).toEqual(['a', 'turn-ended']);
  });

  it('inserts hooks = true into an existing [features] table that lacks the key, preserving its other keys', () => {
    fs.writeFileSync(configPath, '[features]\njs_repl = false\n\n[desktop]\nfollowUpQueueMode = "queue"\n');

    ensureCodexHooksFeatureEnabled(configPath);
    const parsed = parse(read(configPath)) as {
      features?: { hooks?: boolean; js_repl?: boolean };
      desktop?: Record<string, unknown>;
    };

    expect(parsed.features?.hooks).toBe(true);
    expect(parsed.features?.js_repl).toBe(false);
    expect(parsed.desktop).toEqual({ followUpQueueMode: 'queue' });
  });

  it('flips an existing hooks = false to true in place', () => {
    fs.writeFileSync(configPath, '[features]\nhooks = false\njs_repl = false\n');

    ensureCodexHooksFeatureEnabled(configPath);
    const parsed = parse(read(configPath)) as { features?: { hooks?: boolean; js_repl?: boolean } };

    expect(parsed.features?.hooks).toBe(true);
    expect(parsed.features?.js_repl).toBe(false);
  });

  it('is a no-op — does not rewrite the file — when hooks is already true', () => {
    const original = '[features]\nhooks = true\njs_repl = false\n';
    fs.writeFileSync(configPath, original);
    const statBefore = fs.statSync(configPath).mtimeMs;

    ensureCodexHooksFeatureEnabled(configPath);

    expect(read(configPath)).toBe(original);
    expect(fs.statSync(configPath).mtimeMs).toBe(statBefore);
  });

  it('does not clobber a malformed config file — logs a warning and leaves it untouched', () => {
    fs.writeFileSync(configPath, 'not = [valid toml');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    ensureCodexHooksFeatureEnabled(configPath);

    expect(read(configPath)).toBe('not = [valid toml');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('preserves a complex real-world-shaped file aside from the intended edit', () => {
    const original = [
      'notify = ["a", "turn-ended"]',
      '',
      '[marketplaces.openai-bundled]',
      'last_updated = "2026-07-14T20:40:11Z"',
      'source_type = "local"',
      '',
      '[features]',
      'js_repl = false',
      '',
      '[projects."/Users/x/repo"]',
      'trust_level = "trusted"',
      '',
      '[hooks.state]',
      '',
      '[hooks.state."/Users/x/.codex/hooks.json:stop:0:0"]',
      'trusted_hash = "sha256:abc"',
      '',
    ].join('\n');
    fs.writeFileSync(configPath, original);

    ensureCodexHooksFeatureEnabled(configPath);
    const raw = read(configPath);
    const parsed = parse(raw) as Record<string, unknown>;

    expect((parsed.features as Record<string, unknown>).hooks).toBe(true);
    expect((parsed.features as Record<string, unknown>).js_repl).toBe(false);
    expect(parsed.notify).toEqual(['a', 'turn-ended']);
    expect((parsed.marketplaces as Record<string, unknown>)['openai-bundled']).toEqual({
      last_updated: '2026-07-14T20:40:11Z',
      source_type: 'local',
    });
    expect((parsed.projects as Record<string, unknown>)['/Users/x/repo']).toEqual({ trust_level: 'trusted' });
    const hooksState = parsed.hooks as Record<string, unknown>;
    expect((hooksState.state as Record<string, unknown>)['/Users/x/.codex/hooks.json:stop:0:0']).toEqual({
      trusted_hash: 'sha256:abc',
    });
  });
});
