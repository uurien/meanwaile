import { AgentEvent, agentEventKey } from './adapters/types';

export type ActiveExecutionStatus = 'working' | 'needs_user';
export type ExecutionTransition = 'started' | 'resumed' | 'needs_user' | 'finished';

interface ExecutionIdentity {
  id: string;
  adapterId: string;
  sessionId?: string;
  agentName?: string;
  projectName?: string;
  startedAt: number;
  updatedAt: number;
}

export interface ActiveExecution extends ExecutionIdentity {
  status: ActiveExecutionStatus;
}

export interface FinishedExecution extends ExecutionIdentity {
  status: 'finished';
  finishedAt: number;
}

export interface ExecutionCounts {
  active: number;
  working: number;
  needsUser: number;
  finished: number;
}

export interface ExecutionSnapshot {
  active: ActiveExecution[];
  recent: FinishedExecution[];
  counts: ExecutionCounts;
}

export interface ExecutionTrackerResult {
  isSignificant: boolean;
  transition: ExecutionTransition | null;
  execution?: ActiveExecution | FinishedExecution;
  snapshot: ExecutionSnapshot;
}

// Sent to the popover over the 'agent-interruption' IPC channel when a
// significant needs_user/finished transition occurs for any principal agent.
export interface AgentInterruptionPayload {
  transition: ExecutionTransition;
  execution?: ActiveExecution | FinishedExecution;
  counts: ExecutionCounts;
}

export interface ExecutionDiscardResult {
  discarded: boolean;
  snapshot: ExecutionSnapshot;
}

export interface ExecutionTrackerOptions {
  now?: () => number;
}

const MAX_RECENT_EXECUTIONS = 20;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function executionId(event: AgentEvent): string {
  return agentEventKey(event);
}

function updatedIdentity(
  event: AgentEvent,
  current?: ActiveExecution | FinishedExecution,
): ExecutionIdentity {
  return {
    id: executionId(event),
    adapterId: event.adapterId,
    sessionId: event.sessionId ?? current?.sessionId,
    agentName: event.agentName ?? current?.agentName,
    projectName: event.projectName ?? current?.projectName,
    startedAt: current?.startedAt ?? event.timestamp,
    updatedAt: event.timestamp,
  };
}

export class ExecutionTracker {
  private readonly now: () => number;
  private readonly active = new Map<string, ActiveExecution>();
  private readonly recent = new Map<string, FinishedExecution>();

  constructor(options: ExecutionTrackerOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  handle(event: AgentEvent): ExecutionTrackerResult {
    this.expireStale(this.now());
    const id = executionId(event);

    switch (event.type) {
      case 'prompt_submitted':
      case 'work_resumed':
        return this.handleWorking(event, id);
      case 'needs_user':
        return this.handleNeedsUser(event, id);
      case 'task_finished':
        return this.handleFinished(event, id);
    }
  }

  snapshot(): ExecutionSnapshot {
    this.expireStale(this.now());
    const active = [...this.active.values()]
      .sort((left, right) => {
        if (left.status !== right.status) return left.status === 'needs_user' ? -1 : 1;
        return right.updatedAt - left.updatedAt;
      })
      .map((execution) => ({ ...execution }));
    const recent = [...this.recent.values()]
      .sort((left, right) => right.finishedAt - left.finishedAt)
      .map((execution) => ({ ...execution }));
    const working = active.filter((execution) => execution.status === 'working').length;
    const needsUser = active.length - working;

    return {
      active,
      recent,
      counts: {
        active: active.length,
        working,
        needsUser,
        finished: recent.length,
      },
    };
  }

  discard(event: AgentEvent): ExecutionDiscardResult {
    const discarded = this.active.delete(executionId(event));
    return { discarded, snapshot: this.snapshot() };
  }

  private handleWorking(event: AgentEvent, id: string): ExecutionTrackerResult {
    const current = this.active.get(id);
    this.recent.delete(id);
    const execution: ActiveExecution = {
      ...updatedIdentity(event, current),
      status: 'working',
    };
    this.active.set(id, execution);

    if (!current) return this.transitionResult('started', execution);
    if (current.status === 'needs_user') return this.transitionResult('resumed', execution);
    return this.unchangedResult();
  }

  private handleNeedsUser(event: AgentEvent, id: string): ExecutionTrackerResult {
    const current = this.active.get(id);
    this.recent.delete(id);
    const execution: ActiveExecution = {
      ...updatedIdentity(event, current),
      status: 'needs_user',
    };
    this.active.set(id, execution);

    if (current?.status === 'needs_user') return this.unchangedResult();
    return this.transitionResult('needs_user', execution);
  }

  private handleFinished(event: AgentEvent, id: string): ExecutionTrackerResult {
    if (this.recent.has(id)) return this.unchangedResult();

    const current = this.active.get(id);
    this.active.delete(id);
    const execution: FinishedExecution = {
      ...updatedIdentity(event, current),
      status: 'finished',
      finishedAt: event.timestamp,
    };
    this.recent.set(id, execution);
    this.trimRecent();
    return this.transitionResult('finished', execution);
  }

  private transitionResult(
    transition: ExecutionTransition,
    execution: ActiveExecution | FinishedExecution,
  ): ExecutionTrackerResult {
    return {
      isSignificant: true,
      transition,
      execution: { ...execution },
      snapshot: this.snapshot(),
    };
  }

  private unchangedResult(): ExecutionTrackerResult {
    return {
      isSignificant: false,
      transition: null,
      snapshot: this.snapshot(),
    };
  }

  private trimRecent(): void {
    if (this.recent.size <= MAX_RECENT_EXECUTIONS) return;
    const oldest = [...this.recent.values()].sort(
      (left, right) => left.finishedAt - right.finishedAt,
    )[0];
    this.recent.delete(oldest.id);
  }

  private expireStale(now: number): void {
    const cutoff = now - STALE_AFTER_MS;
    for (const [id, execution] of this.active) {
      if (execution.updatedAt < cutoff) this.active.delete(id);
    }
    for (const [id, execution] of this.recent) {
      if (execution.updatedAt < cutoff) this.recent.delete(id);
    }
  }
}
