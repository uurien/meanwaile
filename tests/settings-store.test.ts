import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSettings, writeSettings, validateSettings, DEFAULT_SETTINGS } from '../src/settings-store';

describe('settings-store', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('readSettings', () => {
    it('returns defaults when no settings file exists', () => {
      expect(readSettings(dir)).toEqual(DEFAULT_SETTINGS);
    });

    it('returns defaults when the file contains malformed JSON', () => {
      fs.writeFileSync(path.join(dir, 'settings.json'), 'not-json');
      expect(readSettings(dir)).toEqual(DEFAULT_SETTINGS);
    });

    it('returns persisted values when present', () => {
      fs.writeFileSync(
        path.join(dir, 'settings.json'),
        JSON.stringify({ httpPort: 4000, autoOpenDelaySeconds: 30 }),
      );
      expect(readSettings(dir)).toEqual({ httpPort: 4000, autoOpenDelaySeconds: 30 });
    });

    it('fills in missing fields with defaults', () => {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ httpPort: 4000 }));
      expect(readSettings(dir)).toEqual({
        httpPort: 4000,
        autoOpenDelaySeconds: DEFAULT_SETTINGS.autoOpenDelaySeconds,
      });
    });
  });

  describe('writeSettings', () => {
    it('persists settings that readSettings can read back', () => {
      writeSettings(dir, { httpPort: 5000, autoOpenDelaySeconds: 10 });
      expect(readSettings(dir)).toEqual({ httpPort: 5000, autoOpenDelaySeconds: 10 });
    });

    it('creates the directory if it does not exist yet', () => {
      const nested = path.join(dir, 'nested', 'userData');
      writeSettings(nested, { httpPort: 5000, autoOpenDelaySeconds: 10 });
      expect(readSettings(nested)).toEqual({ httpPort: 5000, autoOpenDelaySeconds: 10 });
    });
  });

  describe('validateSettings', () => {
    it('accepts a valid port and delay', () => {
      expect(validateSettings({ httpPort: 3821, autoOpenDelaySeconds: 15 })).toEqual({
        ok: true,
        settings: { httpPort: 3821, autoOpenDelaySeconds: 15 },
      });
    });

    it('rejects a non-integer port', () => {
      const result = validateSettings({ httpPort: 3821.5, autoOpenDelaySeconds: 15 });
      expect(result.ok).toBe(false);
    });

    it('rejects a port out of range', () => {
      expect(validateSettings({ httpPort: 0, autoOpenDelaySeconds: 15 }).ok).toBe(false);
      expect(validateSettings({ httpPort: 70000, autoOpenDelaySeconds: 15 }).ok).toBe(false);
    });

    it('rejects a non-numeric port', () => {
      expect(validateSettings({ httpPort: 'abc', autoOpenDelaySeconds: 15 }).ok).toBe(false);
    });

    it('rejects a zero or negative delay', () => {
      expect(validateSettings({ httpPort: 3821, autoOpenDelaySeconds: 0 }).ok).toBe(false);
      expect(validateSettings({ httpPort: 3821, autoOpenDelaySeconds: -5 }).ok).toBe(false);
    });

    it('rejects a non-numeric delay', () => {
      expect(validateSettings({ httpPort: 3821, autoOpenDelaySeconds: 'abc' }).ok).toBe(false);
    });
  });
});
