import * as fs from 'fs';
import * as path from 'path';

interface OnboardingState {
  onboarded?: boolean;
  hookBackfillOffered?: boolean;
  codexHookBackfillOffered?: boolean;
}

function filePath(userDataDir: string): string {
  return path.join(userDataDir, 'onboarding.json');
}

function readState(userDataDir: string): OnboardingState {
  try {
    return JSON.parse(fs.readFileSync(filePath(userDataDir), 'utf8')) as OnboardingState;
  } catch {
    return {};
  }
}

function writeState(userDataDir: string, patch: OnboardingState): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(filePath(userDataDir), JSON.stringify({ ...readState(userDataDir), ...patch }, null, 2));
}

export function hasOnboarded(userDataDir: string): boolean {
  return readState(userDataDir).onboarded === true;
}

export function markOnboarded(userDataDir: string): void {
  writeState(userDataDir, { onboarded: true });
}

// Tracks whether we've already asked the user once about backfilling a
// newly managed hook event into an existing install. Persisted regardless
// of their answer so we never nag on every subsequent launch.
export function hasOfferedHookBackfill(userDataDir: string): boolean {
  return readState(userDataDir).hookBackfillOffered === true;
}

export function markHookBackfillOffered(userDataDir: string): void {
  writeState(userDataDir, { hookBackfillOffered: true });
}

// Tracked separately from hookBackfillOffered: users who already went through
// the Claude-only backfill before Codex support existed must still be asked
// about Codex once, rather than being silently skipped by a flag that was
// set for an unrelated reason.
export function hasOfferedCodexHookBackfill(userDataDir: string): boolean {
  return readState(userDataDir).codexHookBackfillOffered === true;
}

export function markCodexHookBackfillOffered(userDataDir: string): void {
  writeState(userDataDir, { codexHookBackfillOffered: true });
}
