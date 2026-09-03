import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readSettings, writeSettings, validateSettings, DEFAULT_SETTINGS } from '../src/settings-store';

function settings(overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

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

    it.each(['null', '[]', '"text"'])('returns defaults when parsed JSON is not an object: %s', (raw) => {
      fs.writeFileSync(path.join(dir, 'settings.json'), raw);
      expect(readSettings(dir)).toEqual(DEFAULT_SETTINGS);
    });

    it('migrates the legacy two-field file to the complete settings model', () => {
      fs.writeFileSync(
        path.join(dir, 'settings.json'),
        JSON.stringify({ httpPort: 4000, autoOpenDelaySeconds: 30 }),
      );
      expect(readSettings(dir)).toEqual(settings({ httpPort: 4000, autoOpenDelaySeconds: 30 }));
    });

    it('fills in a missing autoOpenDelaySeconds with the default', () => {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ httpPort: 4000 }));
      expect(readSettings(dir)).toEqual(settings({ httpPort: 4000 }));
    });

    it('fills in a missing httpPort with the default', () => {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ autoOpenDelaySeconds: 30 }));
      expect(readSettings(dir)).toEqual(settings({ autoOpenDelaySeconds: 30 }));
    });

    it('preserves every persisted setting and ignores unknown fields', () => {
      const persisted = settings({
        httpPort: 4100,
        autoOpenDelaySeconds: 45,
        autoOpenGames: false,
        notificationsEnabled: true,
        notifyNeedsUser: false,
        notifyFinished: true,
        notificationSound: 'system',
      });
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ ...persisted, unknown: 'ignored' }));

      expect(readSettings(dir)).toEqual(persisted);
    });

    it('falls back per field when persisted values are invalid', () => {
      fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
        httpPort: 70000,
        autoOpenDelaySeconds: -1,
        autoOpenGames: 'yes',
        notificationsEnabled: 1,
        notifyNeedsUser: null,
        notifyFinished: {},
        notificationSound: 'loud',
      }));

      expect(readSettings(dir)).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('writeSettings', () => {
    it('persists settings that readSettings can read back', () => {
      const value = settings({
        httpPort: 5000,
        autoOpenDelaySeconds: 10,
        autoOpenGames: false,
        notificationsEnabled: true,
        notifyNeedsUser: false,
        notificationSound: 'system',
      });
      writeSettings(dir, value);
      expect(readSettings(dir)).toEqual(value);
    });

    it('creates the directory if it does not exist yet', () => {
      const nested = path.join(dir, 'nested', 'userData');
      const value = settings({ httpPort: 5000, autoOpenDelaySeconds: 10 });
      writeSettings(nested, value);
      expect(readSettings(nested)).toEqual(value);
    });
  });

  describe('validateSettings', () => {
    it('accepts legacy input and supplies safe defaults for new settings', () => {
      expect(validateSettings({ httpPort: 3821, autoOpenDelaySeconds: 15 })).toEqual({
        ok: true,
        settings: DEFAULT_SETTINGS,
      });
    });

    it.each([
      { autoOpenGames: true, notificationsEnabled: false },
      { autoOpenGames: false, notificationsEnabled: true },
      { autoOpenGames: true, notificationsEnabled: true },
      { autoOpenGames: false, notificationsEnabled: false },
    ])('accepts the automation combination %j', (combination) => {
      const result = validateSettings(settings(combination));
      expect(result).toEqual({ ok: true, settings: settings(combination) });
    });

    it.each(['autoOpenGames', 'notificationsEnabled', 'notifyNeedsUser', 'notifyFinished'] as const)(
      'rejects a non-boolean %s',
      (field) => {
        expect(validateSettings({ ...settings(), [field]: 'yes' }).ok).toBe(false);
      },
    );

    it('accepts only none or system as the notification sound', () => {
      expect(validateSettings(settings({ notificationSound: 'none' }))).toEqual({
        ok: true,
        settings: settings({ notificationSound: 'none' }),
      });
      expect(validateSettings(settings({ notificationSound: 'system' }))).toEqual({
        ok: true,
        settings: settings({ notificationSound: 'system' }),
      });
      expect(validateSettings({ ...settings(), notificationSound: 'loud' }).ok).toBe(false);
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
