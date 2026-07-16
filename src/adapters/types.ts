export type AgentEventType =
  | 'needs_user'
  | 'task_finished'
  | 'prompt_submitted';

export interface AgentEvent {
  type: AgentEventType;
  sessionId?: string;
  // Human-readable label for whichever adapter emitted this event (e.g.
  // "Claude", "Codex") - purely for display, never used for branching logic
  // outside the adapter itself, so the state machine/UI stay agent-agnostic.
  agentName?: string;
  timestamp: number;
}

export type AgentEventHandler = (event: AgentEvent) => void;

export interface AgentAdapter {
  name: string;
  onEvent(handler: AgentEventHandler): void;
  parseHookPayload(body: unknown): AgentEvent | null;
}
