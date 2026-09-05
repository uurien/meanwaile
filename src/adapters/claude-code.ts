import {
  AgentAdapter,
  AgentEvent,
  AgentEventHandler,
  optionalNonEmptyString,
  projectNameFromCwd,
} from './types';
import { isSyntheticTaskNotification } from './synthetic-prompt';

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
    const sessionId = optionalNonEmptyString(payload['session_id']);
    const ts = Date.now();

    const agentName = 'Claude';
    const eventContext = {
      adapterId: this.name,
      sessionId,
      agentName,
      projectName: projectNameFromCwd(payload['cwd']),
      timestamp: ts,
    };

    switch (hookName) {
      case 'Notification': {
        const subtype = payload['notification_type'] as string | undefined;
        if (subtype === 'permission_prompt' || subtype === 'idle_prompt') {
          return { type: 'needs_user', ...eventContext };
        }
        return null;
      }
      case 'Stop':
        return { type: 'task_finished', ...eventContext };
      case 'UserPromptSubmit':
        if (isSyntheticTaskNotification(payload)) return null;
        return { type: 'prompt_submitted', ...eventContext };
      case 'PreToolUse':
        // A tool call retrying after a permission prompt (or any tool call at
        // all) means the agent is actively working again. Keep that distinct
        // from a new user prompt so a resumed tool cannot override a manual
        // popover dismissal for the current turn.
        return { type: 'work_resumed', ...eventContext };
      case 'SubagentStop':
        // A subagent hook carries the parent session_id plus a separate
        // agent_id. Treating it as Stop deletes the still-running parent.
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
