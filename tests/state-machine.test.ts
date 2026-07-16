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
    it('does not pause when one of several agents finishes while another is still working', () => {
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      const onChange = vi.fn();
      m.onStateChange(onChange);

      // Agent B is still working - finishing agent A alone must not pause
      // the game, and must not later force a spurious reopen once agent B
      // makes more progress either.
      m.handle(event('task_finished', { sessionId: 'agent-a' }));

      expect(onChange).not.toHaveBeenCalled();
      expect(m.snapshot().state).toBe('agent_working');
    });

    it('only drops to idle once every tracked agent has finished', () => {
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      const onChange = vi.fn();
      m.onStateChange(onChange);

      m.handle(event('task_finished', { sessionId: 'agent-a' }));
      expect(onChange).not.toHaveBeenCalled();

      m.handle(event('task_finished', { sessionId: 'agent-b' }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(m.snapshot()).toMatchObject({ state: 'idle', sessionId: 'agent-b' });
    });

    it('pauses for needs_user as soon as one agent needs input, even while another agent is still working', () => {
      // needs_user outranks working: a session blocked on the user (e.g. a
      // permission prompt) needs attention now, regardless of whether some
      // other agent is still happily working on its own.
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      const onChange = vi.fn();
      m.onStateChange(onChange);

      m.handle(event('needs_user', { sessionId: 'agent-b' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(m.snapshot()).toMatchObject({ state: 'needs_user', sessionId: 'agent-b' });
    });

    it('stays needs_user even after a different agent starts a brand new prompt', () => {
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('needs_user', { sessionId: 'agent-a' }));
      expect(m.snapshot().state).toBe('needs_user');

      // Agent B starting fresh work doesn't resolve agent A's blocked
      // prompt - the player still needs to go unblock agent A.
      const onChange = vi.fn();
      m.onStateChange(onChange);
      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));

      expect(onChange).not.toHaveBeenCalled();
      expect(m.snapshot().state).toBe('needs_user');
    });

    it('resumes agent_working once the blocked session itself resumes, even with another agent already running', () => {
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      m.handle(event('needs_user', { sessionId: 'agent-a' }));
      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      expect(m.snapshot().state).toBe('needs_user');

      const onChange = vi.fn();
      m.onStateChange(onChange);
      // Agent A's own retry (e.g. after the permission prompt is approved)
      // clears the last needs_user session.
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(m.snapshot().state).toBe('agent_working');
    });

    it('does not notify on a repeated prompt_submitted from a second agent while the first is still working', () => {
      // Avoids flooding the popover with resume/focus side effects on every
      // tool call from a second agent while the first is already working.
      const m = new StateMachine();
      m.handle(event('prompt_submitted', { sessionId: 'agent-a' }));
      const onChange = vi.fn();
      m.onStateChange(onChange);

      m.handle(event('prompt_submitted', { sessionId: 'agent-b' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
