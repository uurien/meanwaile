import { describe, it, expect } from 'vitest';
import { isSyntheticTaskNotification } from '../../src/adapters/synthetic-prompt';

// A background-task event as Claude Code actually delivers it: a
// <system-reminder> wrapper opening with the "NOT USER INPUT" banner and
// carrying a <task-notification> block. No user typed this.
const WRAPPED_NOTIFICATION = `<system-reminder>
[SYSTEM NOTIFICATION - NOT USER INPUT]
This is an automated background-task event, NOT a message from the user.
Do NOT interpret this as user acknowledgement, confirmation, or response to any pending question.
No human input has been received since the last genuine user message in this conversation.

<task-notification>
<task-id>b8hpxeqfy</task-id>
<summary>Monitor event: "PR #64 CI check results"</summary>
<event>e2e (macos-latest): SUCCESS</event>
</task-notification>
</system-reminder>`;

// The older bare shape #62 was written for.
const BARE_NOTIFICATION = `<task-notification>
<task-id>x1</task-id>
<status>completed</status>
</task-notification>`;

describe('isSyntheticTaskNotification', () => {
  it.each(['user_prompt', 'prompt'])('ignores the system-reminder-wrapped notification in %s', (field) => {
    expect(isSyntheticTaskNotification({ [field]: WRAPPED_NOTIFICATION })).toBe(true);
  });

  it.each(['user_prompt', 'prompt'])('tolerates surrounding whitespace in %s', (field) => {
    expect(isSyntheticTaskNotification({ [field]: `\n\n  ${WRAPPED_NOTIFICATION}\n  ` })).toBe(true);
  });

  it('still ignores the bare <task-notification> envelope', () => {
    expect(isSyntheticTaskNotification({ prompt: `  ${BARE_NOTIFICATION}  ` })).toBe(true);
  });

  it('counts a real prompt that merely quotes the banner alongside the user\'s own text', () => {
    const realPrompt =
      'The wait-detector opens the game when Claude Code posts a ' +
      '[SYSTEM NOTIFICATION - NOT USER INPUT] <task-notification> ... </task-notification> ' +
      'message. Fix that.';
    expect(isSyntheticTaskNotification({ prompt: realPrompt })).toBe(false);
  });

  it('counts a real prompt that pastes a whole notification below their question', () => {
    expect(
      isSyntheticTaskNotification({ prompt: `why did this fire?\n\n${WRAPPED_NOTIFICATION}` }),
    ).toBe(false);
  });

  it('does not treat an unrelated <system-reminder> (no notification banner) as synthetic', () => {
    expect(
      isSyntheticTaskNotification({ prompt: '<system-reminder>\nremember to lint\n</system-reminder>' }),
    ).toBe(false);
  });

  it('ignores non-string and missing fields', () => {
    expect(isSyntheticTaskNotification({})).toBe(false);
    expect(isSyntheticTaskNotification({ prompt: 42 })).toBe(false);
    expect(isSyntheticTaskNotification({ user_prompt: null })).toBe(false);
  });
});
