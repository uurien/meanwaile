export type AgentEventType =
  | 'needs_user'
  | 'task_finished'
  | 'prompt_submitted';

export interface AgentEvent {
  type: AgentEventType;
  sessionId?: string;
  timestamp: number;
}

export type AgentEventHandler = (event: AgentEvent) => void;

export interface AgentAdapter {
  name: string;
  onEvent(handler: AgentEventHandler): void;
  parseHookPayload(body: unknown): AgentEvent | null;
}
