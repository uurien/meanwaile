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

// Exact match only — this must never mistake another product's hook (which
// could easily share the generic /hook path on some other port) for ours.
function isOurEntry(entry: HookEntry, url: string): boolean {
  return entry.hooks?.some((h) => h.type === 'http' && h.url === url) ?? false;
}

function readSettingsFile(settingsPath: string): ClaudeSettings | null {
  if (!fs.existsSync(settingsPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
  } catch {
    return null;
  }
}

export function installClaudeHooks(settingsPath: string, hookUrl: string): void {
  const settings = readSettingsFile(settingsPath);
  if (settings === null) {
    console.warn(`[meanwaile] could not parse ${settingsPath} — leaving it untouched`);
    return;
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

// Renames our own hook URL in place (used when the configured port changes).
// Matches oldUrl exactly, so it only ever touches the entry we previously
// installed ourselves — never another tool's hook, even one that happens to
// use the same /hook path on a different port.
export function renameClaudeHookUrl(settingsPath: string, oldUrl: string, newUrl: string): void {
  const settings = readSettingsFile(settingsPath);
  if (settings === null) {
    console.warn(`[meanwaile] could not parse ${settingsPath} — leaving it untouched`);
    return;
  }
  if (!settings.hooks) return;

  for (const event of MANAGED_HOOK_EVENTS) {
    const existing = settings.hooks[event];
    if (!existing) continue;

    settings.hooks[event] = existing.map((entry) => {
      if (!isOurEntry(entry, oldUrl)) return entry;
      return {
        ...entry,
        hooks: entry.hooks.map((h) => (h.type === 'http' && h.url === oldUrl ? { ...h, url: newUrl } : h)),
      };
    });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// Whether our hook is already configured for this exact URL — used to decide
// whether a port change should offer to rewrite it. If the user declined
// hooks during onboarding (or the port is already out of sync), we must not
// silently install or touch anything.
export function hasManagedHooks(settingsPath: string, hookUrl: string): boolean {
  const settings = readSettingsFile(settingsPath);
  if (!settings) return false;

  return MANAGED_HOOK_EVENTS.some((event) =>
    (settings.hooks?.[event] ?? []).some((entry) => isOurEntry(entry, hookUrl)),
  );
}
