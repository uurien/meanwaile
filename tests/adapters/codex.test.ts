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
    const e = parse({
      hook_event_name: 'PermissionRequest',
      tool_name: 'exec',
      session_id: 's1',
      cwd: 'C:\\Users\\alice\\projects\\meanwaile',
    });
    expect(e?.type).toBe('needs_user');
    expect(e?.sessionId).toBe('s1');
    expect(e?.agentName).toBe('Codex');
    expect(e?.adapterId).toBe('codex');
    expect(e?.projectName).toBe('meanwaile');
    expect(e).not.toHaveProperty('cwd');
  });

  it('Stop → task_finished', () => {
    const e = parse({ hook_event_name: 'Stop', session_id: 'x' });
    expect(e?.type).toBe('task_finished');
    expect(e?.agentName).toBe('Codex');
    expect(e?.adapterId).toBe('codex');
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
    expect(parse({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the bug' })?.type).toBe('prompt_submitted');
  });

  it.each(['prompt', 'user_prompt'])('ignores a bare synthetic task notification received in %s', (field) => {
    expect(parse({
      hook_event_name: 'UserPromptSubmit',
      [field]: '  <task-notification>\n<status>failed</status>\n</task-notification>  ',
    })).toBeNull();
  });

  it.each(['prompt', 'user_prompt'])(
    'ignores the system-reminder-wrapped background notification (%s)',
    (field) => {
      const wrapped = [
        '<system-reminder>',
        '[SYSTEM NOTIFICATION - NOT USER INPUT]',
        'This is an automated background-task event, NOT a message from the user.',
        '',
        '<task-notification>',
        '<status>completed</status>',
        '</task-notification>',
        '</system-reminder>',
      ].join('\n');
      expect(parse({ hook_event_name: 'UserPromptSubmit', [field]: wrapped })).toBeNull();
    },
  );

  it('PreToolUse → work_resumed', () => {
    const e = parse({ hook_event_name: 'PreToolUse', tool_name: 'exec', session_id: 's1' });
    expect(e?.type).toBe('work_resumed');
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
