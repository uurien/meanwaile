import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../src/state-machine';
import { AgentEvent } from '../src/adapters/types';

function event(type: AgentEvent['type'], extra: Partial<AgentEvent> = {}): AgentEvent {
  return { type, timestamp: 0, ...extra };
}

describe('StateMachine', () => {
  it('starts idle', () => {
    const m = new StateMachine();
    expect(m.snapshot().state).toBe('idle');
  });

  it('prompt_submitted → agent_working', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted'));
    expect(m.snapshot().state).toBe('agent_working');
  });

  it('task_finished → idle', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted'));
    m.handle(event('task_finished'));
    expect(m.snapshot().state).toBe('idle');
  });

  it('needs_user → needs_user', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted'));
    m.handle(event('needs_user'));
    expect(m.snapshot().state).toBe('needs_user');
  });

  it('tracks sessionId from events', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted', { sessionId: 'abc123' }));
    expect(m.snapshot().sessionId).toBe('abc123');
  });

  it('tracks agentName from events', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted', { agentName: 'Codex' }));
    expect(m.snapshot().agentName).toBe('Codex');
  });

  it('calls onChange on each transition', () => {
    const m = new StateMachine();
    const onChange = vi.fn();
    m.onStateChange(onChange);
    m.handle(event('prompt_submitted'));
    m.handle(event('task_finished'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('does not call onChange when the event resolves to the same state', () => {
    const m = new StateMachine();
    const onChange = vi.fn();
    m.handle(event('prompt_submitted'));
    m.onStateChange(onChange);
    m.handle(event('prompt_submitted'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still tracks sessionId even when the state does not change', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted', { sessionId: 'first' }));
    m.handle(event('prompt_submitted', { sessionId: 'second' }));
    expect(m.snapshot().sessionId).toBe('second');
  });

  it('still tracks agentName even when the state does not change', () => {
    const m = new StateMachine();
    m.handle(event('prompt_submitted', { agentName: 'Claude' }));
    m.handle(event('prompt_submitted', { agentName: 'Codex' }));
    expect(m.snapshot().agentName).toBe('Codex');
  });
});
