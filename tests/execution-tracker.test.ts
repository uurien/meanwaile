import { describe, expect, it } from 'vitest';
import { AgentEvent } from '../src/adapters/types';
import { ExecutionTracker } from '../src/execution-tracker';

function event(
  type: AgentEvent['type'],
  timestamp: number,
  extra: Partial<AgentEvent> = {},
): AgentEvent {
  return {
    type,
    adapterId: 'claude-code',
    sessionId: 'session-1',
    agentName: 'Claude',
    projectName: 'meanwaile',
    timestamp,
    ...extra,
  };
}

function createTracker(): ExecutionTracker {
  return new ExecutionTracker({ now: () => 1_000 });
}

describe('ExecutionTracker', () => {
  it('uses the system clock by default', () => {
    const tracker = new ExecutionTracker();
    const timestamp = Date.now();

    expect(tracker.handle(event('prompt_submitted', timestamp)).snapshot.counts.active).toBe(1);
  });

  it.each(['prompt_submitted', 'work_resumed'] as const)(
    'creates a working execution from %s',
    (type) => {
      const tracker = createTracker();

      const result = tracker.handle(event(type, 100));

      expect(result.isSignificant).toBe(true);
      expect(result.transition).toBe('started');
      expect(result.execution).toMatchObject({
        adapterId: 'claude-code',
        sessionId: 'session-1',
        agentName: 'Claude',
        projectName: 'meanwaile',
        status: 'working',
        startedAt: 100,
        updatedAt: 100,
      });
      expect(result.snapshot.counts).toEqual({
        active: 1,
        working: 1,
        needsUser: 0,
        finished: 0,
      });
    },
  );

  it('updates timestamps and labels for repeated work without duplicating or signaling a transition', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100));

    const result = tracker.handle(event('work_resumed', 250, { projectName: 'renamed' }));

    expect(result.isSignificant).toBe(false);
    expect(result.transition).toBeNull();
    expect(result.snapshot.active).toHaveLength(1);
    expect(result.snapshot.active[0]).toMatchObject({
      projectName: 'renamed',
      startedAt: 100,
      updatedAt: 250,
    });
  });

  it('preserves known display labels when a later event omits them', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100));

    const result = tracker.handle(event('work_resumed', 200, {
      agentName: undefined,
      projectName: undefined,
    }));

    expect(result.snapshot.active[0]).toMatchObject({
      agentName: 'Claude',
      projectName: 'meanwaile',
    });
  });

  it('moves only the matching execution to needs_user', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100, { sessionId: 'one' }));
    tracker.handle(event('prompt_submitted', 110, { sessionId: 'two' }));

    const result = tracker.handle(event('needs_user', 200, { sessionId: 'two' }));

    expect(result.isSignificant).toBe(true);
    expect(result.transition).toBe('needs_user');
    expect(result.snapshot.active.map(({ sessionId, status }) => ({ sessionId, status }))).toEqual([
      { sessionId: 'two', status: 'needs_user' },
      { sessionId: 'one', status: 'working' },
    ]);
    expect(result.snapshot.counts).toEqual({ active: 2, working: 1, needsUser: 1, finished: 0 });
  });

  it('resumes only the matching blocked execution', () => {
    const tracker = createTracker();
    tracker.handle(event('needs_user', 100, { sessionId: 'one' }));
    tracker.handle(event('prompt_submitted', 110, { sessionId: 'two' }));

    const result = tracker.handle(event('work_resumed', 200, { sessionId: 'one' }));

    expect(result.isSignificant).toBe(true);
    expect(result.transition).toBe('resumed');
    expect(result.snapshot.counts).toEqual({ active: 2, working: 2, needsUser: 0, finished: 0 });
  });

  it('moves only the matching execution to recent history', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100, { sessionId: 'one' }));
    tracker.handle(event('prompt_submitted', 110, { sessionId: 'two' }));

    const result = tracker.handle(event('task_finished', 300, { sessionId: 'one' }));

    expect(result.isSignificant).toBe(true);
    expect(result.transition).toBe('finished');
    expect(result.execution).toMatchObject({
      sessionId: 'one',
      status: 'finished',
      startedAt: 100,
      updatedAt: 300,
      finishedAt: 300,
    });
    expect(result.snapshot.active.map((execution) => execution.sessionId)).toEqual(['two']);
    expect(result.snapshot.recent.map((execution) => execution.sessionId)).toEqual(['one']);
  });

  it('records a finish seen after launch even when the active start was not observed', () => {
    const tracker = createTracker();

    const result = tracker.handle(event('task_finished', 300));

    expect(result.isSignificant).toBe(true);
    expect(result.transition).toBe('finished');
    expect(result.snapshot.recent[0]).toMatchObject({ startedAt: 300, finishedAt: 300 });
  });

  it('does not duplicate history or signal repeated finish notifications', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100));
    tracker.handle(event('task_finished', 200));

    const duplicate = tracker.handle(event('task_finished', 300));

    expect(duplicate.isSignificant).toBe(false);
    expect(duplicate.transition).toBeNull();
    expect(duplicate.execution).toBeUndefined();
    expect(duplicate.snapshot.recent).toHaveLength(1);
    expect(duplicate.snapshot.recent[0].finishedAt).toBe(200);
  });

  it('keeps identical session ids isolated between adapters', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100, { adapterId: 'claude-code' }));
    tracker.handle(event('prompt_submitted', 110, { adapterId: 'codex', agentName: 'Codex' }));

    const result = tracker.handle(event('task_finished', 200, { adapterId: 'claude-code' }));

    expect(result.snapshot.active).toHaveLength(1);
    expect(result.snapshot.active[0]).toMatchObject({ adapterId: 'codex', status: 'working' });
    expect(result.snapshot.recent[0]).toMatchObject({ adapterId: 'claude-code', status: 'finished' });
  });

  it('keeps two sessions in the same project isolated', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100, { sessionId: 'one' }));
    tracker.handle(event('prompt_submitted', 110, { sessionId: 'two' }));

    expect(tracker.snapshot().active.map((execution) => execution.sessionId)).toEqual(['two', 'one']);
  });

  it('scopes missing session ids to their adapter', () => {
    const tracker = createTracker();
    tracker.handle(event('prompt_submitted', 100, { adapterId: 'claude-code', sessionId: undefined }));
    tracker.handle(event('prompt_submitted', 110, {
      adapterId: 'codex',
      sessionId: undefined,
      agentName: 'Codex',
    }));

    const result = tracker.handle(event('task_finished', 200, {
      adapterId: 'claude-code',
      sessionId: undefined,
    }));

    expect(result.snapshot.active).toHaveLength(1);
    expect(result.snapshot.active[0].adapterId).toBe('codex');
  });

  it('starts a fresh active execution when a completed session reports new work', () => {
    const tracker = createTracker();
    tracker.handle(event('task_finished', 100));

    const result = tracker.handle(event('prompt_submitted', 200));

    expect(result.transition).toBe('started');
    expect(result.snapshot.recent).toHaveLength(0);
    expect(result.snapshot.active[0]).toMatchObject({ startedAt: 200, status: 'working' });
  });

  it('sorts recent finishes newest first and caps the list at 20', () => {
    const tracker = createTracker();
    for (let index = 0; index < 21; index += 1) {
      tracker.handle(event('task_finished', index, { sessionId: `session-${index}` }));
    }

    const snapshot = tracker.snapshot();
    expect(snapshot.recent).toHaveLength(20);
    expect(snapshot.recent[0].sessionId).toBe('session-20');
    expect(snapshot.recent.at(-1)?.sessionId).toBe('session-1');
    expect(snapshot.counts.finished).toBe(20);
  });

  it('silently expires active and recent records after 24 hours', () => {
    let now = 0;
    const tracker = new ExecutionTracker({ now: () => now });
    tracker.handle(event('prompt_submitted', 0, { sessionId: 'active' }));
    tracker.handle(event('task_finished', 0, { sessionId: 'finished' }));

    now = 24 * 60 * 60 * 1000;
    expect(tracker.snapshot().counts).toEqual({ active: 1, working: 1, needsUser: 0, finished: 1 });

    now += 1;
    expect(tracker.snapshot()).toEqual({
      active: [],
      recent: [],
      counts: { active: 0, working: 0, needsUser: 0, finished: 0 },
    });
  });

  it('does not signal repeated needs_user events but refreshes their timestamp', () => {
    const tracker = createTracker();
    tracker.handle(event('needs_user', 100));

    const result = tracker.handle(event('needs_user', 200));

    expect(result.isSignificant).toBe(false);
    expect(result.transition).toBeNull();
    expect(result.snapshot.active[0].updatedAt).toBe(200);
  });
});
