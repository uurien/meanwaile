import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MANAGED_HOOK_EVENTS = ['UserPromptSubmit', 'Stop', 'SubagentStop', 'PreToolUse', 'PermissionRequest'] as const;

interface CommandHook {
  type: string;
  command: string;
  timeout?: number;
}

interface HookEntry {
  matcher?: string;
  hooks: CommandHook[];
}

interface CodexHooksFile {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

// Codex only executes `type: "command"` hooks (no `http` type like Claude
// Code), so the installed hook shells out to curl and forwards its stdin
// (the hook's JSON payload) straight to the daemon.
export function codexCommandFor(hookUrl: string): string {
  return `curl -s -X POST -H "Content-Type: application/json" -d @- ${hookUrl}`;
}

// PermissionRequest is the only managed event that supports (and needs) a
// matcher — UserPromptSubmit/Stop/SubagentStop/PreToolUse have none. "*"
// matches every tool, mirroring the "all tool calls" scope of the others.
function entryFor(hookUrl: string, event: string): HookEntry {
  const hooks: CommandHook[] = [{ type: 'command', command: codexCommandFor(hookUrl), timeout: 30 }];
  return event === 'PermissionRequest' ? { matcher: '*', hooks } : { hooks };
}

// Exact match only — this must never mistake another process's command hook
// for ours.
function isOurEntry(entry: HookEntry, hookUrl: string): boolean {
  return entry.hooks?.some((h) => h.type === 'command' && h.command === codexCommandFor(hookUrl)) ?? false;
}

function readHooksFile(hooksPath: string): CodexHooksFile | null {
  if (!fs.existsSync(hooksPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as CodexHooksFile;
  } catch {
    return null;
  }
}

export function installCodexHooks(hooksPath: string, hookUrl: string): void {
  const hooksFile = readHooksFile(hooksPath);
  if (hooksFile === null) {
    console.warn(`[meanwaile] could not parse ${hooksPath} — leaving it untouched`);
    return;
  }

  hooksFile.hooks = hooksFile.hooks ?? {};

  for (const event of MANAGED_HOOK_EVENTS) {
    const existing = hooksFile.hooks[event] ?? [];
    hooksFile.hooks[event] = existing.some((entry) => isOurEntry(entry, hookUrl))
      ? existing
      : [...existing, entryFor(hookUrl, event)];
  }

  fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
  fs.writeFileSync(hooksPath, JSON.stringify(hooksFile, null, 2));
}

// Renames our own hook URL in place (used when the configured port changes).
// Matches oldUrl exactly, so it only ever touches the entry we previously
// installed ourselves.
export function renameCodexHookUrl(hooksPath: string, oldUrl: string, newUrl: string): void {
  const hooksFile = readHooksFile(hooksPath);
  if (hooksFile === null) {
    console.warn(`[meanwaile] could not parse ${hooksPath} — leaving it untouched`);
    return;
  }
  if (!hooksFile.hooks) return;

  for (const event of MANAGED_HOOK_EVENTS) {
    const existing = hooksFile.hooks[event];
    if (!existing) continue;

    hooksFile.hooks[event] = existing.map((entry) => {
      if (!isOurEntry(entry, oldUrl)) return entry;
      return {
        ...entry,
        hooks: entry.hooks.map((h) =>
          h.type === 'command' && h.command === codexCommandFor(oldUrl)
            ? { ...h, command: codexCommandFor(newUrl) }
            : h,
        ),
      };
    });
  }

  fs.writeFileSync(hooksPath, JSON.stringify(hooksFile, null, 2));
}

// Whether our hook is already configured for this exact URL — used to decide
// whether a port change should offer to rewrite it.
export function hasManagedHooks(hooksPath: string, hookUrl: string): boolean {
  const hooksFile = readHooksFile(hooksPath);
  if (!hooksFile) return false;

  return MANAGED_HOOK_EVENTS.some((event) =>
    (hooksFile.hooks?.[event] ?? []).some((entry) => isOurEntry(entry, hookUrl)),
  );
}

// Gates the onboarding offer: only ask about Codex hooks if Codex actually
// appears to be installed on this machine (a `.codex` home directory exists).
// Accepts an explicit home dir so it stays testable without mocking os/fs.
export function hasCodexInstalled(homeDir: string = os.homedir()): boolean {
  return fs.existsSync(path.join(homeDir, '.codex'));
}
