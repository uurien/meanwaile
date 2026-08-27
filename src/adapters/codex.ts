import { AgentAdapter, AgentEvent, AgentEventHandler } from './types';
import { isSyntheticTaskNotification } from './synthetic-prompt';

export class CodexAdapter implements AgentAdapter {
  name = 'codex';
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

    const agentName = 'Codex';

    switch (hookName) {
      case 'PermissionRequest':
        return { type: 'needs_user', sessionId, agentName, timestamp: ts };
      case 'Stop':
        return { type: 'task_finished', sessionId, agentName, timestamp: ts };
      case 'UserPromptSubmit':
        if (isSyntheticTaskNotification(payload)) return null;
        return { type: 'prompt_submitted', sessionId, agentName, timestamp: ts };
      case 'PreToolUse':
        // Same rationale as the Claude Code adapter: a tool call retrying
        // after an approval prompt (or any tool call at all) means the agent
        // is actively working again, but it is not a fresh user prompt and
        // must not override a manual popover dismissal for this turn.
        return { type: 'work_resumed', sessionId, agentName, timestamp: ts };
      case 'SubagentStop':
        // SubagentStop identifies the child separately; session_id still
        // belongs to the parent and must remain active until its own Stop.
        return null;
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
