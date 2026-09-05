import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  httpPort: number;
  autoOpenDelaySeconds: number;
  autoOpenGames: boolean;
  notificationsEnabled: boolean;
  notifyNeedsUser: boolean;
  notifyFinished: boolean;
  notificationSound: 'none' | 'system';
}

export const DEFAULT_SETTINGS: AppSettings = {
  httpPort: 3821,
  autoOpenDelaySeconds: 15,
  autoOpenGames: true,
  notificationsEnabled: false,
  notifyNeedsUser: true,
  notifyFinished: true,
  notificationSound: 'none',
};

function filePath(userDataDir: string): string {
  return path.join(userDataDir, 'settings.json');
}

export function readSettings(userDataDir: string): AppSettings {
  try {
    const raw = fs.readFileSync(filePath(userDataDir), 'utf8');
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = value as Record<string, unknown>;
    return {
      httpPort: validPort(parsed.httpPort) ? parsed.httpPort : DEFAULT_SETTINGS.httpPort,
      autoOpenDelaySeconds: validDelay(parsed.autoOpenDelaySeconds)
        ? parsed.autoOpenDelaySeconds
        : DEFAULT_SETTINGS.autoOpenDelaySeconds,
      autoOpenGames: storedBoolean(parsed.autoOpenGames, DEFAULT_SETTINGS.autoOpenGames),
      notificationsEnabled: storedBoolean(
        parsed.notificationsEnabled,
        DEFAULT_SETTINGS.notificationsEnabled,
      ),
      notifyNeedsUser: storedBoolean(parsed.notifyNeedsUser, DEFAULT_SETTINGS.notifyNeedsUser),
      notifyFinished: storedBoolean(parsed.notifyFinished, DEFAULT_SETTINGS.notifyFinished),
      notificationSound: validNotificationSound(parsed.notificationSound)
        ? parsed.notificationSound
        : DEFAULT_SETTINGS.notificationSound,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(userDataDir: string, settings: AppSettings): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(filePath(userDataDir), JSON.stringify(settings, null, 2));
}

export type ValidationResult =
  | { ok: true; settings: AppSettings }
  | { ok: false; error: string };

export function validateSettings(input: Partial<Record<keyof AppSettings, unknown>>): ValidationResult {
  const httpPort = Number(input.httpPort);
  if (!validPort(httpPort)) {
    return { ok: false, error: 'Port must be an integer between 1 and 65535.' };
  }

  const autoOpenDelaySeconds = Number(input.autoOpenDelaySeconds);
  if (!validDelay(autoOpenDelaySeconds)) {
    return { ok: false, error: 'Seconds must be a positive number.' };
  }

  const booleanFields = [
    'autoOpenGames',
    'notificationsEnabled',
    'notifyNeedsUser',
    'notifyFinished',
  ] as const;
  const booleans = {} as Pick<
    AppSettings,
    'autoOpenGames' | 'notificationsEnabled' | 'notifyNeedsUser' | 'notifyFinished'
  >;
  for (const field of booleanFields) {
    const value = input[field] === undefined ? DEFAULT_SETTINGS[field] : input[field];
    if (typeof value !== 'boolean') {
      return { ok: false, error: `${field} must be true or false.` };
    }
    booleans[field] = value;
  }

  const notificationSound = input.notificationSound === undefined
    ? DEFAULT_SETTINGS.notificationSound
    : input.notificationSound;
  if (!validNotificationSound(notificationSound)) {
    return { ok: false, error: 'Notification sound must be none or system.' };
  }

  return {
    ok: true,
    settings: {
      httpPort,
      autoOpenDelaySeconds,
      ...booleans,
      notificationSound,
    },
  };
}

function validPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}

function validDelay(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function storedBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validNotificationSound(value: unknown): value is AppSettings['notificationSound'] {
  return value === 'none' || value === 'system';
}
