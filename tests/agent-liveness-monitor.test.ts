import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentEvent } from '../src/adapters/types';
import { AGENT_SILENCE_TIMEOUT_MS, AgentLivenessMonitor } from '../src/agent-liveness-monitor';

function event(
  type: AgentEvent['type'],
  sessionId: string,
  adapterId = 'claude-code',
): AgentEvent {
  return { type, adapterId, sessionId, timestamp: Date.now() };
}

describe('AgentLivenessMonitor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('discards an agent after one minute without another hook', () => {
    vi.useFakeTimers();
    const onStale = vi.fn();
    const monitor = new AgentLivenessMonitor(onStale);
    const started = event('prompt_submitted', 'stale');

    monitor.observe(started);
    vi.advanceTimersByTime(AGENT_SILENCE_TIMEOUT_MS - 1);
    expect(onStale).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onStale).toHaveBeenCalledOnce();
    expect(onStale).toHaveBeenCalledWith(started);
  });

  it('restarts the minute when another hook arrives for the same agent', () => {
    vi.useFakeTimers();
    const onStale = vi.fn();
    const monitor = new AgentLivenessMonitor(onStale);

    monitor.observe(event('prompt_submitted', 'active'));
    vi.advanceTimersByTime(45_000);
    const latest = event('work_resumed', 'active');
    monitor.observe(latest);
    vi.advanceTimersByTime(15_000);
    expect(onStale).not.toHaveBeenCalled();

    vi.advanceTimersByTime(45_000);
    expect(onStale).toHaveBeenCalledWith(latest);
  });

  it('tracks identical session ids independently across adapters', () => {
    vi.useFakeTimers();
    const onStale = vi.fn();
    const monitor = new AgentLivenessMonitor(onStale);

    monitor.observe(event('prompt_submitted', 'shared', 'claude-code'));
    vi.advanceTimersByTime(30_000);
    monitor.observe(event('work_resumed', 'shared', 'codex'));
    vi.advanceTimersByTime(30_000);

    expect(onStale).toHaveBeenCalledOnce();
    expect(onStale.mock.calls[0][0].adapterId).toBe('claude-code');
  });

  it('cancels the pending discard when the agent finishes normally', () => {
    vi.useFakeTimers();
    const onStale = vi.fn();
    const monitor = new AgentLivenessMonitor(onStale);

    monitor.observe(event('prompt_submitted', 'finished'));
    monitor.observe(event('task_finished', 'finished'));
    vi.advanceTimersByTime(AGENT_SILENCE_TIMEOUT_MS);

    expect(onStale).not.toHaveBeenCalled();
  });

  it('cancels every pending discard when stopped', () => {
    vi.useFakeTimers();
    const onStale = vi.fn();
    const monitor = new AgentLivenessMonitor(onStale);

    monitor.observe(event('prompt_submitted', 'one'));
    monitor.observe(event('prompt_submitted', 'two'));
    monitor.stop();
    vi.advanceTimersByTime(AGENT_SILENCE_TIMEOUT_MS);

    expect(onStale).not.toHaveBeenCalled();
  });
});
