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
    const e = parse({
      hook_event_name: 'Notification',
      notification_type: 'permission_prompt',
      session_id: 's1',
      cwd: '/Users/alice/projects/website/',
    });
    expect(e?.type).toBe('needs_user');
    expect(e?.sessionId).toBe('s1');
    expect(e?.agentName).toBe('Claude');
    expect(e?.adapterId).toBe('claude-code');
    expect(e?.projectName).toBe('website');
    expect(e).not.toHaveProperty('cwd');
  });

  it('Notification idle_prompt → needs_user', () => {
    const e = parse({ hook_event_name: 'Notification', notification_type: 'idle_prompt' });
    expect(e?.type).toBe('needs_user');
  });

  it('Notification with unknown subtype → null', () => {
    expect(parse({ hook_event_name: 'Notification', notification_type: 'other' })).toBeNull();
  });

  it('Stop → task_finished', () => {
    const e = parse({ hook_event_name: 'Stop', session_id: 'x' });
    expect(e?.type).toBe('task_finished');
    expect(e?.agentName).toBe('Claude');
    expect(e?.adapterId).toBe('claude-code');
    expect(e?.projectName).toBeUndefined();
  });

  it.each([undefined, null, 42, {}, '   ', '/'])('does not expose a project name for malformed cwd %j', (cwd) => {
    expect(parse({ hook_event_name: 'Stop', cwd })?.projectName).toBeUndefined();
  });

  it('keeps a missing or malformed session_id undefined', () => {
    expect(parse({ hook_event_name: 'Stop' })?.sessionId).toBeUndefined();
    expect(parse({ hook_event_name: 'Stop', session_id: 42 })?.sessionId).toBeUndefined();
  });

  it('SubagentStop does not finish the parent session', () => {
    expect(parse({ hook_event_name: 'SubagentStop', session_id: 'parent', agent_id: 'child' })).toBeNull();
  });

  it('UserPromptSubmit → prompt_submitted', () => {
    expect(parse({ hook_event_name: 'UserPromptSubmit', user_prompt: 'Fix the bug' })?.type).toBe('prompt_submitted');
  });

  it.each(['user_prompt', 'prompt'])('ignores a bare synthetic task notification received in %s', (field) => {
    expect(parse({
      hook_event_name: 'UserPromptSubmit',
      [field]: '  <task-notification>\n<status>failed</status>\n</task-notification>  ',
    })).toBeNull();
  });

  it.each(['user_prompt', 'prompt'])(
    'ignores the system-reminder-wrapped background notification Claude Code actually sends (%s)',
    (field) => {
      const wrapped = [
        '<system-reminder>',
        '[SYSTEM NOTIFICATION - NOT USER INPUT]',
        'This is an automated background-task event, NOT a message from the user.',
        '',
        '<task-notification>',
        '<task-id>b8hpxeqfy</task-id>',
        '<summary>Monitor event: "CI check results"</summary>',
        '<event>e2e (macos-latest): SUCCESS</event>',
        '</task-notification>',
        '</system-reminder>',
      ].join('\n');
      expect(parse({ hook_event_name: 'UserPromptSubmit', [field]: wrapped })).toBeNull();
    },
  );

  it('still treats a real prompt that quotes a notification alongside the user\'s text as a prompt', () => {
    const e = parse({
      hook_event_name: 'UserPromptSubmit',
      prompt: 'the game keeps opening on <task-notification> ... </task-notification> messages, fix it',
    });
    expect(e?.type).toBe('prompt_submitted');
  });

  it('PreToolUse → work_resumed', () => {
    const e = parse({ hook_event_name: 'PreToolUse', tool_name: 'bash', session_id: 's1' });
    expect(e?.type).toBe('work_resumed');
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
