const TASK_NOTIFICATION_OPEN = '<task-notification>';
const TASK_NOTIFICATION_CLOSE = '</task-notification>';
const SYSTEM_REMINDER_OPEN = '<system-reminder>';
// Claude Code opens every background-task envelope with this exact banner.
const NOT_USER_INPUT_BANNER = '[SYSTEM NOTIFICATION - NOT USER INPUT]';

// Claude Code injects background-agent events (task completions, monitor
// events, scheduled-run output) into the conversation as user-role messages,
// so a `UserPromptSubmit` hook fires for them even though the user typed
// nothing. Treating those as real prompts arms the auto-open timer and pops
// the widget open while the user is idle - reading something else - which is
// exactly what auto-open is meant NOT to do.
//
// Two wire shapes are ignored, both only when the message is *entirely* the
// envelope (a real prompt that merely quotes or discusses one alongside the
// user's own text still counts):
//   1. a bare `<task-notification>...</task-notification>` block, and
//   2. Claude Code's current shape: a `<system-reminder>` wrapper that opens
//      with the "NOT USER INPUT" banner and carries a `<task-notification>`.
// Some clients expose the text as `user_prompt`, others as `prompt`.
export function isSyntheticTaskNotification(payload: Record<string, unknown>): boolean {
  return ['user_prompt', 'prompt'].some((field) => {
    const value = payload[field];
    if (typeof value !== 'string') return false;

    const trimmed = value.trim();

    if (trimmed.startsWith(TASK_NOTIFICATION_OPEN) && trimmed.endsWith(TASK_NOTIFICATION_CLOSE)) {
      return true;
    }

    return (
      trimmed.startsWith(SYSTEM_REMINDER_OPEN) &&
      trimmed.includes(NOT_USER_INPUT_BANNER) &&
      trimmed.includes(TASK_NOTIFICATION_OPEN) &&
      trimmed.includes(TASK_NOTIFICATION_CLOSE)
    );
  });
}
