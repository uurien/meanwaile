import {
  ActiveExecution,
  ExecutionCounts,
  FinishedExecution,
} from './execution-tracker';

export type NotifiableTransition = 'needs_user' | 'finished';

export interface NotificationCopy {
  title: string;
  body: string;
}

function executionLabel(execution: ActiveExecution | FinishedExecution): string {
  const agent = execution.agentName ?? 'Agent';
  return execution.projectName ? `${agent} · ${execution.projectName}` : agent;
}

function finishedBody(counts: ExecutionCounts): string {
  if (counts.active === 0) return 'No other agents are active.';

  if (counts.needsUser === 0) {
    return counts.working === 1
      ? '1 other agent is still working.'
      : `${counts.working} other agents are still working.`;
  }

  if (counts.working === 0) {
    return counts.needsUser === 1
      ? '1 other agent needs your attention.'
      : `${counts.needsUser} other agents need your attention.`;
  }

  const attentionVerb = counts.needsUser === 1 ? 'needs' : 'need';
  return `${counts.active} agents remain active; ${counts.needsUser} ${attentionVerb} your attention.`;
}

export function buildNotificationCopy(
  transition: NotifiableTransition,
  execution: ActiveExecution | FinishedExecution,
  counts: ExecutionCounts,
): NotificationCopy {
  const label = executionLabel(execution);
  if (transition === 'needs_user') {
    return {
      title: `${label} needs your attention`,
      body: 'Waiting for confirmation or a response.',
    };
  }

  return {
    title: `${label} finished`,
    body: finishedBody(counts),
  };
}
