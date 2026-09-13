import {
  AgentAdapter,
  AgentEvent,
  AgentEventHandler,
  agentEventKey,
  optionalNonEmptyString,
  projectNameFromCwd,
} from './types';
import { isSyntheticTaskNotification } from './synthetic-prompt';

const NEEDS_USER_CONFIRMATION_MS = 5_000;

export class CodexAdapter implements AgentAdapter {
  name = 'codex';
  private handler: AgentEventHandler | null = null;
  private readonly pendingNeedsUser = new Map<string, ReturnType<typeof setTimeout>>();

  onEvent(handler: AgentEventHandler): void {
    this.handler = handler;
  }

  parseHookPayload(body: unknown): AgentEvent | null {
    if (!body || typeof body !== 'object') return null;
    const payload = body as Record<string, unknown>;
    const hookName = payload['hook_event_name'] as string | undefined;
    const sessionId = optionalNonEmptyString(payload['session_id']);
    const ts = Date.now();

    const agentName = 'Codex';
    const eventContext = {
      adapterId: this.name,
      sessionId,
      agentName,
      projectName: projectNameFromCwd(payload['cwd']),
      timestamp: ts,
    };

    switch (hookName) {
      case 'PermissionRequest':
        return { type: 'needs_user', ...eventContext };
      case 'Stop':
        return { type: 'task_finished', ...eventContext };
      case 'UserPromptSubmit':
        if (isSyntheticTaskNotification(payload)) return null;
        return { type: 'prompt_submitted', ...eventContext };
      case 'PreToolUse':
      case 'PostToolUse':
        // Either side of a tool lifecycle confirms that the agent is active.
        // PostToolUse is especially useful after an auto-approved request,
        // while this remains distinct from a fresh user prompt so it cannot
        // override a manual popover dismissal for the current turn.
        return { type: 'work_resumed', ...eventContext };
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
    if (!event) return;

    const key = agentEventKey(event);
    const pending = this.pendingNeedsUser.get(key);
    if (pending) {
      clearTimeout(pending);
      this.pendingNeedsUser.delete(key);
    }

    if (event.type !== 'needs_user') {
      this.handler(event);
      return;
    }

    // PermissionRequest runs before Codex chooses between user review and
    // auto-review. Give automatic approvals a short window to resume work;
    // only surface needs_user if no later lifecycle event clears the request.
    const timer = setTimeout(() => {
      this.pendingNeedsUser.delete(key);
      this.handler?.(event);
    }, NEEDS_USER_CONFIRMATION_MS);
    this.pendingNeedsUser.set(key, timer);
  }
}
