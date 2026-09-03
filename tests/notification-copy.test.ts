import { describe, expect, it } from 'vitest';
import { FinishedExecution, ActiveExecution, ExecutionCounts } from '../src/execution-tracker';
import { buildNotificationCopy } from '../src/notification-copy';

const BASE_COUNTS: ExecutionCounts = { active: 0, working: 0, needsUser: 0, finished: 1 };

function active(overrides: Partial<ActiveExecution> = {}): ActiveExecution {
  return {
    id: '["claude-code","one"]',
    adapterId: 'claude-code',
    sessionId: 'one',
    agentName: 'Claude',
    projectName: 'website',
    status: 'needs_user',
    startedAt: 10,
    updatedAt: 20,
    ...overrides,
  };
}

function finished(overrides: Partial<FinishedExecution> = {}): FinishedExecution {
  return {
    ...active({ status: 'working' }),
    status: 'finished',
    finishedAt: 30,
    ...overrides,
  };
}

describe('buildNotificationCopy', () => {
  it('names the agent and project when attention is needed', () => {
    expect(buildNotificationCopy('needs_user', active(), BASE_COUNTS)).toEqual({
      title: 'Claude · website needs your attention',
      body: 'Waiting for confirmation or a response.',
    });
  });

  it('falls back to a generic agent label and omits an absent project', () => {
    expect(buildNotificationCopy('needs_user', active({ agentName: undefined, projectName: undefined }), BASE_COUNTS))
      .toEqual({
        title: 'Agent needs your attention',
        body: 'Waiting for confirmation or a response.',
      });
  });

  it('reports when no other agent remains after a finish', () => {
    expect(buildNotificationCopy('finished', finished(), BASE_COUNTS)).toEqual({
      title: 'Claude · website finished',
      body: 'No other agents are active.',
    });
  });

  it.each([
    [1, '1 other agent is still working.'],
    [2, '2 other agents are still working.'],
  ] as const)('pluralizes %i remaining working agents', (working, body) => {
    expect(buildNotificationCopy('finished', finished(), {
      active: working,
      working,
      needsUser: 0,
      finished: 1,
    }).body).toBe(body);
  });

  it.each([
    [1, '1 other agent needs your attention.'],
    [2, '2 other agents need your attention.'],
  ] as const)('pluralizes %i remaining agents needing attention', (needsUser, body) => {
    expect(buildNotificationCopy('finished', finished(), {
      active: needsUser,
      working: 0,
      needsUser,
      finished: 1,
    }).body).toBe(body);
  });

  it('summarizes mixed remaining states using post-finish counts', () => {
    expect(buildNotificationCopy('finished', finished({ agentName: 'Codex', projectName: 'meanwaile' }), {
      active: 3,
      working: 2,
      needsUser: 1,
      finished: 4,
    })).toEqual({
      title: 'Codex · meanwaile finished',
      body: '3 agents remain active; 1 needs your attention.',
    });
  });

  it('pluralizes the attention count in a mixed summary', () => {
    expect(buildNotificationCopy('finished', finished(), {
      active: 4,
      working: 2,
      needsUser: 2,
      finished: 1,
    }).body).toBe('4 agents remain active; 2 need your attention.');
  });
});
