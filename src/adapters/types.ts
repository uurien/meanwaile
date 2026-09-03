export type AgentEventType =
  | 'needs_user'
  | 'task_finished'
  | 'prompt_submitted'
  | 'work_resumed';

export interface AgentEvent {
  type: AgentEventType;
  // Stable adapter identifier used as part of the execution identity. It is
  // data, not a signal for agent-specific branching outside adapters.
  adapterId: string;
  sessionId?: string;
  // Human-readable label for whichever adapter emitted this event (e.g.
  // "Claude", "Codex") - purely for display, never used for branching logic
  // outside the adapter itself, so the state machine/UI stay agent-agnostic.
  agentName?: string;
  // Display-safe project label derived only from the final cwd component.
  projectName?: string;
  timestamp: number;
}

export function optionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function projectNameFromCwd(value: unknown): string | undefined {
  const cwd = optionalNonEmptyString(value);
  if (!cwd) return undefined;

  // Hook payloads come from the current platform, but accepting both path
  // separators keeps parsing deterministic in tests and imported payloads.
  const withoutTrailingSeparators = cwd.replace(/[\\/]+$/u, '');
  const basename = withoutTrailingSeparators.split(/[\\/]/u).at(-1);
  if (!basename) return undefined;

  const safeName = basename.replace(/[\u0000-\u001f\u007f]/gu, '').trim();
  if (!safeName || safeName === '.' || safeName === '..' || /^[a-z]:$/iu.test(safeName)) {
    return undefined;
  }
  return safeName;
}

export type AgentEventHandler = (event: AgentEvent) => void;

export interface AgentAdapter {
  name: string;
  onEvent(handler: AgentEventHandler): void;
  parseHookPayload(body: unknown): AgentEvent | null;
}
