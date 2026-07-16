import { AgentEvent } from './adapters/types';

export type AppState = 'idle' | 'agent_working' | 'needs_user';

export interface StateSnapshot {
  state: AppState;
  sessionId: string | null;
  agentName: string | null;
}

export type StateChangeHandler = (snapshot: StateSnapshot) => void;

type SessionStatus = 'working' | 'needs_user';

// Real hook payloads always carry a session_id; this key only covers
// synthetic/test events that omit one, so they still behave like a single
// implicit session.
const DEFAULT_SESSION_KEY = '__default__';

export class StateMachine {
  private state: AppState = 'idle';
  private sessionId: string | null = null;
  private agentName: string | null = null;
  private onChange: StateChangeHandler | null = null;
  // Every agent session that has reported work and hasn't finished yet.
  // The aggregate state only drops to idle once this is empty - one agent
  // finishing while another is still running must not pause the game out
  // from under the other agent's work.
  private sessions = new Map<string, SessionStatus>();

  onStateChange(handler: StateChangeHandler): void {
    this.onChange = handler;
  }

  handle(event: AgentEvent): void {
    if (event.sessionId) this.sessionId = event.sessionId;
    if (event.agentName) this.agentName = event.agentName;

    const key = event.sessionId ?? DEFAULT_SESSION_KEY;
    switch (event.type) {
      case 'prompt_submitted':
        this.sessions.set(key, 'working');
        break;
      case 'needs_user':
        this.sessions.set(key, 'needs_user');
        break;
      case 'task_finished':
        this.sessions.delete(key);
        break;
    }

    this.transition(this.aggregateState());
  }

  private aggregateState(): AppState {
    if (this.sessions.size === 0) return 'idle';
    // needs_user outranks working: a session blocked on the user (e.g. a
    // permission prompt) needs attention right now, regardless of whether
    // another agent is still happily working on its own.
    for (const status of this.sessions.values()) {
      if (status === 'needs_user') return 'needs_user';
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
