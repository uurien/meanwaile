import * as fs from 'fs';
import * as path from 'path';

const MANAGED_HOOK_EVENTS = ['Notification', 'Stop', 'SubagentStop', 'UserPromptSubmit'] as const;

interface HookEntry {
  hooks: { type: string; url: string }[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

function isOurEntry(entry: HookEntry, url: string): boolean {
  return entry.hooks?.some((h) => h.type === 'http' && h.url === url) ?? false;
}

export function installClaudeHooks(settingsPath: string, hookUrl: string): void {
  let settings: ClaudeSettings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
    } catch {
      console.warn(`[meanwaile] could not parse ${settingsPath} — leaving it untouched`);
      return;
    }
  }

  settings.hooks = settings.hooks ?? {};

  for (const event of MANAGED_HOOK_EVENTS) {
    const existing = settings.hooks[event] ?? [];
    settings.hooks[event] = existing.some((entry) => isOurEntry(entry, hookUrl))
      ? existing
      : [...existing, { hooks: [{ type: 'http', url: hookUrl }] }];
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
