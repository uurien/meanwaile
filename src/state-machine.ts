import { AgentEvent } from './adapters/types';

export type AppState = 'idle' | 'agent_working' | 'needs_user';

export interface StateSnapshot {
  state: AppState;
  sessionId: string | null;
}

export type StateChangeHandler = (snapshot: StateSnapshot) => void;

export class StateMachine {
  private state: AppState = 'idle';
  private sessionId: string | null = null;
  private onChange: StateChangeHandler | null = null;

  onStateChange(handler: StateChangeHandler): void {
    this.onChange = handler;
  }

  handle(event: AgentEvent): void {
    if (event.sessionId) this.sessionId = event.sessionId;

    switch (event.type) {
      case 'prompt_submitted':
        this.transition('agent_working');
        break;
      case 'needs_user':
        this.transition('needs_user');
        break;
      case 'task_finished':
        this.transition('idle');
        break;
    }
  }

  private transition(next: AppState): void {
    this.state = next;
    this.onChange?.(this.snapshot());
  }

  snapshot(): StateSnapshot {
    return { state: this.state, sessionId: this.sessionId };
  }
}
