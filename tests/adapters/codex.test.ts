import { describe, it, expect, vi } from 'vitest';
import { CodexAdapter } from '../../src/adapters/codex';

function parse(body: object) {
  return new CodexAdapter().parseHookPayload(body);
}

describe('CodexAdapter.parseHookPayload', () => {
  it('returns null for unknown hook', () => {
    expect(parse({ hook_event_name: 'Unknown' })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(new CodexAdapter().parseHookPayload('bad')).toBeNull();
  });

  it('PermissionRequest → needs_user', () => {
    const e = parse({ hook_event_name: 'PermissionRequest', tool_name: 'exec', session_id: 's1' });
    expect(e?.type).toBe('needs_user');
    expect(e?.sessionId).toBe('s1');
  });

  it('Stop → task_finished', () => {
    expect(parse({ hook_event_name: 'Stop', session_id: 'x' })?.type).toBe('task_finished');
  });

  it('SubagentStop → task_finished', () => {
    expect(parse({ hook_event_name: 'SubagentStop' })?.type).toBe('task_finished');
  });

  it('UserPromptSubmit → prompt_submitted', () => {
    expect(parse({ hook_event_name: 'UserPromptSubmit' })?.type).toBe('prompt_submitted');
  });

  it('PreToolUse → prompt_submitted', () => {
    const e = parse({ hook_event_name: 'PreToolUse', tool_name: 'exec', session_id: 's1' });
    expect(e?.type).toBe('prompt_submitted');
    expect(e?.sessionId).toBe('s1');
  });

  it('PostToolUse → null', () => {
    expect(parse({ hook_event_name: 'PostToolUse', tool_name: 'exec' })).toBeNull();
  });

  it('SessionStart → null', () => {
    expect(parse({ hook_event_name: 'SessionStart', source: 'startup' })).toBeNull();
  });

  describe('onEvent / emit', () => {
    it('emit calls registered handler with parsed event', () => {
      const adapter = new CodexAdapter();
      const handler = vi.fn();
      adapter.onEvent(handler);
      adapter.emit({ hook_event_name: 'Stop' });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].type).toBe('task_finished');
    });

    it('emit does nothing when no handler registered', () => {
      const adapter = new CodexAdapter();
      expect(() => adapter.emit({ hook_event_name: 'Stop' })).not.toThrow();
    });

    it('emit does nothing when event parses to null', () => {
      const adapter = new CodexAdapter();
      const handler = vi.fn();
      adapter.onEvent(handler);
      adapter.emit({ hook_event_name: 'Unknown' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
