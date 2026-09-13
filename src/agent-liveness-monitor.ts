import { AgentEvent, agentEventKey } from './adapters/types';

export const AGENT_SILENCE_TIMEOUT_MS = 10 * 60 * 1000;

export type StaleAgentHandler = (event: AgentEvent) => void;

export class AgentLivenessMonitor {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly onStale: StaleAgentHandler) {}

  observe(event: AgentEvent): void {
    const key = agentEventKey(event);
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    if (event.type === 'task_finished') {
      this.timers.delete(key);
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);
      this.onStale(event);
    }, AGENT_SILENCE_TIMEOUT_MS);
    this.timers.set(key, timer);
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
