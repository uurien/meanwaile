import { AgentAdapter, AgentEvent, AgentEventHandler } from './types';

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';
  private handler: AgentEventHandler | null = null;

  onEvent(handler: AgentEventHandler): void {
    this.handler = handler;
  }

  parseHookPayload(body: unknown): AgentEvent | null {
    if (!body || typeof body !== 'object') return null;
    const payload = body as Record<string, unknown>;
    const hookName = payload['hook_event_name'] as string | undefined;
    const sessionId = payload['session_id'] as string | undefined;
    const ts = Date.now();

    switch (hookName) {
      case 'Notification': {
        const subtype = payload['notification_type'] as string | undefined;
        if (subtype === 'permission_prompt' || subtype === 'idle_prompt') {
          return { type: 'needs_user', sessionId, timestamp: ts };
        }
        return null;
      }
      case 'Stop':
      case 'SubagentStop':
        return { type: 'task_finished', sessionId, timestamp: ts };
      case 'UserPromptSubmit':
        return { type: 'prompt_submitted', sessionId, timestamp: ts };
      case 'PreToolUse':
        // A tool call retrying after a permission prompt (or any tool call at
        // all) means the agent is actively working again — same transition
        // as UserPromptSubmit, so it re-arms the auto-open timer and clears
        // a stale needs_user state instead of leaving the popover stuck on
        // "needs attention" for the rest of the turn.
        return { type: 'prompt_submitted', sessionId, timestamp: ts };
      default:
        return null;
    }
  }

  emit(body: unknown): void {
    if (!this.handler) return;
    const event = this.parseHookPayload(body);
    if (event) this.handler(event);
  }
}
