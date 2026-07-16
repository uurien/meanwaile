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

  describe('multiple concurrent agents', () => {
    it('notifies again when a second agent finishes, even though the aggregate state was already idle', () => {
      const m = new StateMachine();
      const onChange = vi.fn();

      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      m.onStateChange(onChange);

      m.handle(event('task_finished', { sessionId: 'agent-a' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(m.snapshot()).toMatchObject({ state: 'idle', sessionId: 'agent-a' });

      // Agent B is still working; the player resumes and keeps playing.
      // Agent B finishing later must still surface, not get swallowed
      // because the machine's state string is already 'idle'.
      m.handle(event('task_finished', { sessionId: 'agent-b' }));
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(m.snapshot()).toMatchObject({ state: 'idle', sessionId: 'agent-b' });
    });

    it('notifies again when a second agent needs input, even though the aggregate state was already needs_user', () => {
      const m = new StateMachine();
      const onChange = vi.fn();

      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('needs_user', { sessionId: 'agent-a' }));
      m.onStateChange(onChange);

      m.handle(event('needs_user', { sessionId: 'agent-b' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(m.snapshot()).toMatchObject({ state: 'needs_user', sessionId: 'agent-b' });
    });

    it('does not force a duplicate notification for a repeated prompt_submitted', () => {
      // Sanity check that the fix is scoped to the pause-side transitions -
      // prompt_submitted from a second agent while the first is still
      // working should stay a real no-op (avoids flooding the popover with
      // resume/focus side effects on every tool call).
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      const onChange = vi.fn();
      m.onStateChange(onChange);

      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
