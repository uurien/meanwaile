import { describe, it, expect, vi } from 'vitest';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code';

function parse(body: object) {
  return new ClaudeCodeAdapter().parseHookPayload(body);
}

describe('ClaudeCodeAdapter.parseHookPayload', () => {
  it('returns null for unknown hook', () => {
    expect(parse({ hook_event_name: 'Unknown' })).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(new ClaudeCodeAdapter().parseHookPayload('bad')).toBeNull();
  });

  it('Notification permission_prompt → needs_user', () => {
    const e = parse({ hook_event_name: 'Notification', notification_type: 'permission_prompt', session_id: 's1' });
    expect(e?.type).toBe('needs_user');
    expect(e?.sessionId).toBe('s1');
  });

  it('Notification idle_prompt → needs_user', () => {
    const e = parse({ hook_event_name: 'Notification', notification_type: 'idle_prompt' });
    expect(e?.type).toBe('needs_user');
  });

  it('Notification with unknown subtype → null', () => {
    expect(parse({ hook_event_name: 'Notification', notification_type: 'other' })).toBeNull();
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
    const e = parse({ hook_event_name: 'PreToolUse', tool_name: 'bash', session_id: 's1' });
    expect(e?.type).toBe('prompt_submitted');
    expect(e?.sessionId).toBe('s1');
  });

  it('PostToolUse → null', () => {
    expect(parse({ hook_event_name: 'PostToolUse', tool_name: 'read' })).toBeNull();
  });

  describe('onEvent / emit', () => {
    it('emit calls registered handler with parsed event', () => {
      const adapter = new ClaudeCodeAdapter();
      const handler = vi.fn();
      adapter.onEvent(handler);
      adapter.emit({ hook_event_name: 'Stop' });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].type).toBe('task_finished');
    });

    it('emit does nothing when no handler registered', () => {
      const adapter = new ClaudeCodeAdapter();
      expect(() => adapter.emit({ hook_event_name: 'Stop' })).not.toThrow();
    });

    it('emit does nothing when event parses to null', () => {
      const adapter = new ClaudeCodeAdapter();
      const handler = vi.fn();
      adapter.onEvent(handler);
      adapter.emit({ hook_event_name: 'Unknown' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
