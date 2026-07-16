import { AgentEvent } from './adapters/types';

export type AppState = 'idle' | 'agent_working' | 'needs_user';

export interface StateSnapshot {
  state: AppState;
  sessionId: string | null;
  agentName: string | null;
}

export type StateChangeHandler = (snapshot: StateSnapshot) => void;

export class StateMachine {
  private state: AppState = 'idle';
  private sessionId: string | null = null;
  private agentName: string | null = null;
  private onChange: StateChangeHandler | null = null;

  onStateChange(handler: StateChangeHandler): void {
    this.onChange = handler;
  }

  handle(event: AgentEvent): void {
    if (event.sessionId) this.sessionId = event.sessionId;
    if (event.agentName) this.agentName = event.agentName;

    switch (event.type) {
      case 'prompt_submitted':
        this.transition('agent_working');
        break;
      case 'needs_user':
        // Forced: with several agents running concurrently, one agent's
        // needs_user can arrive while the aggregate state is already
        // needs_user/idle from a different agent. Suppressing it as a same-
        // state no-op would silently drop the sessionId change and leave the
        // popover pointed at the wrong (or a now-finished) agent.
        this.transition('needs_user', true);
        break;
      case 'task_finished':
        // Forced for the same reason: agent A finishing pauses the game; if
        // the player resumes and agent B later finishes too, that second
        // task_finished must still notify even though the aggregate state
        // string ("idle") didn't change - otherwise the popover never learns
        // B is done and the game keeps running.
        this.transition('idle', true);
        break;
    }
  }

  private transition(next: AppState, force = false): void {
    if (!force && this.state === next) return;
    this.state = next;
    this.onChange?.(this.snapshot());
  }

  snapshot(): StateSnapshot {
    return { state: this.state, sessionId: this.sessionId, agentName: this.agentName };
  }
}
