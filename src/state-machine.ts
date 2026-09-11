import { AgentEvent, agentEventKey } from './adapters/types';

export type AppState = 'idle' | 'agent_working' | 'needs_user';

export interface StateSnapshot {
  state: AppState;
  sessionId: string | null;
  agentName: string | null;
}

export type StateChangeHandler = (snapshot: StateSnapshot) => void;

type SessionStatus = 'working' | 'needs_user';

interface TrackedSession {
  status: SessionStatus;
  sessionId: string | null;
  agentName: string | null;
  updatedAt: number;
}

export class StateMachine {
  private state: AppState = 'idle';
  private sessionId: string | null = null;
  private agentName: string | null = null;
  private onChange: StateChangeHandler | null = null;
  // Every agent session that has reported work and hasn't finished yet.
  // The aggregate state only drops to idle once this is empty - one agent
  // finishing while another is still running must not pause the game out
  // from under the other agent's work.
  private sessions = new Map<string, TrackedSession>();

  onStateChange(handler: StateChangeHandler): void {
    this.onChange = handler;
  }

  handle(event: AgentEvent): void {
    if (event.sessionId) this.sessionId = event.sessionId;
    if (event.agentName) this.agentName = event.agentName;

    const key = agentEventKey(event);
    switch (event.type) {
      case 'prompt_submitted':
      case 'work_resumed':
        this.trackSession(key, 'working', event);
        break;
      case 'needs_user':
        this.trackSession(key, 'needs_user', event);
        break;
      case 'task_finished':
        this.sessions.delete(key);
        break;
    }

    this.transition(this.aggregateState());
  }

  discard(event: AgentEvent): boolean {
    const discarded = this.sessions.delete(agentEventKey(event));
    if (!discarded) return false;

    const latest = [...this.sessions.values()].sort(
      (left, right) => right.updatedAt - left.updatedAt,
    )[0];
    this.sessionId = latest?.sessionId ?? null;
    this.agentName = latest?.agentName ?? null;
    this.transition(this.aggregateState());
    return true;
  }

  private trackSession(key: string, status: SessionStatus, event: AgentEvent): void {
    const current = this.sessions.get(key);
    this.sessions.set(key, {
      status,
      sessionId: event.sessionId ?? current?.sessionId ?? null,
      agentName: event.agentName ?? current?.agentName ?? null,
      updatedAt: event.timestamp,
    });
  }

  private aggregateState(): AppState {
    if (this.sessions.size === 0) return 'idle';
    // needs_user outranks working: a session blocked on the user (e.g. a
    // permission prompt) needs attention right now, regardless of whether
    // another agent is still happily working on its own.
    for (const session of this.sessions.values()) {
      if (session.status === 'needs_user') return 'needs_user';
    }
    return 'agent_working';
  }

  private transition(next: AppState): void {
    if (this.state === next) return;
    this.state = next;
    this.onChange?.(this.snapshot());
  }

  snapshot(): StateSnapshot {
    return { state: this.state, sessionId: this.sessionId, agentName: this.agentName };
  }
}
