const TASK_NOTIFICATION_OPEN = '<task-notification>';
const TASK_NOTIFICATION_CLOSE = '</task-notification>';

// Claude Code injects background-agent completions into the conversation as
// user-role messages. Some clients expose the text as `user_prompt`, while
// others use `prompt`, so adapters accept both wire formats. Only an entire
// task-notification envelope is ignored: a real user prompt that merely
// discusses or quotes one alongside other text must still count.
export function isSyntheticTaskNotification(payload: Record<string, unknown>): boolean {
  return ['user_prompt', 'prompt'].some((field) => {
    const value = payload[field];
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();
    return trimmed.startsWith(TASK_NOTIFICATION_OPEN) && trimmed.endsWith(TASK_NOTIFICATION_CLOSE);
  });
}
