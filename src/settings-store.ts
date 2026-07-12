import * as fs from 'fs';
import * as path from 'path';

export interface AppSettings {
  httpPort: number;
  autoOpenDelaySeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  httpPort: 3821,
  autoOpenDelaySeconds: 15,
};

function filePath(userDataDir: string): string {
  return path.join(userDataDir, 'settings.json');
}

export function readSettings(userDataDir: string): AppSettings {
  try {
    const raw = fs.readFileSync(filePath(userDataDir), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      httpPort: parsed.httpPort ?? DEFAULT_SETTINGS.httpPort,
      autoOpenDelaySeconds: parsed.autoOpenDelaySeconds ?? DEFAULT_SETTINGS.autoOpenDelaySeconds,
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
  if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
    return { ok: false, error: 'Port must be an integer between 1 and 65535.' };
  }

  const autoOpenDelaySeconds = Number(input.autoOpenDelaySeconds);
  if (!Number.isFinite(autoOpenDelaySeconds) || autoOpenDelaySeconds <= 0) {
    return { ok: false, error: 'Seconds must be a positive number.' };
  }

  return { ok: true, settings: { httpPort, autoOpenDelaySeconds } };
}
