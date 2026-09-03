// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentLabel, renderAgents } from '../../src/popover/agents-view.js';

interface Execution {
  id: string;
  adapterId?: string;
  sessionId?: string;
  agentName?: string;
  projectName?: string;
  status?: string;
  startedAt?: number;
  updatedAt?: number;
  finishedAt?: number;
}

function active(overrides: Execution): Execution {
  return {
    id: overrides.id,
    adapterId: 'claude-code',
    agentName: 'Claude',
    status: 'working',
    startedAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function snapshot(over: Partial<{ active: Execution[]; recent: Execution[]; counts: Record<string, number> }> = {}) {
  return {
    active: over.active ?? [],
    recent: over.recent ?? [],
    counts: over.counts ?? { active: 0, working: 0, needsUser: 0, finished: 0 },
  };
}

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.replaceChildren(container);
});

describe('agentLabel', () => {
  it('joins agent and project with a middot when both are present', () => {
    expect(agentLabel({ id: 'x', agentName: 'Claude', projectName: 'website' })).toBe('Claude · website');
  });

  it('shows the agent name alone, with no trailing punctuation, when the project is missing', () => {
    expect(agentLabel({ id: 'x', agentName: 'Codex' })).toBe('Codex');
  });

  it('falls back to "Agent" when the agent name is missing', () => {
    expect(agentLabel({ id: 'x' })).toBe('Agent');
  });
});

describe('renderAgents — counters', () => {
  it('renders the working, needs-you and finished counters from the snapshot', () => {
    renderAgents(container, snapshot({ counts: { active: 3, working: 2, needsUser: 1, finished: 4 } }));

    const chips = container.querySelectorAll('.agents-counts .agents-count');
    const byKind = Object.fromEntries(
      Array.from(chips).map((c) => [c.getAttribute('data-kind'), c.textContent?.replace(/\s+/g, ' ').trim()]),
    );
    expect(byKind.working).toBe('2 working');
    expect(byKind.needs).toBe('1 needs you');
    expect(byKind.finished).toBe('4 finished');
  });

  it('tolerates a snapshot with no counts object', () => {
    renderAgents(container, { active: [], recent: [] } as never);
    const chips = container.querySelectorAll('.agents-count');
    expect(chips).toHaveLength(3);
    expect(chips[0].textContent).toContain('0');
  });

  it('renders zeroed counters and both empty states for a bare {} snapshot', () => {
    renderAgents(container, {} as never);
    const chips = container.querySelectorAll('.agents-count');
    expect(Array.from(chips).map((c) => c.textContent?.trim())).toEqual(['0 working', '0 needs you', '0 finished']);
    expect(container.querySelector('.agents-empty')).not.toBeNull();
    expect(container.querySelector('.agents-recent-empty')).not.toBeNull();
  });
});

describe('renderAgents — active executions', () => {
  it('orders needs-attention executions before working ones, then newest first', () => {
    renderAgents(
      container,
      snapshot({
        active: [
          active({ id: 'w-old', status: 'working', updatedAt: 10 }),
          active({ id: 'w-new', status: 'working', updatedAt: 30 }),
          active({ id: 'n1', status: 'needs_user', updatedAt: 20 }),
        ],
      }),
    );

    const ids = Array.from(container.querySelectorAll('.agents-list .agent-row')).map(
      (r) => (r as HTMLElement).dataset.executionId,
    );
    expect(ids).toEqual(['n1', 'w-new', 'w-old']);
  });

  it('does not blow up sorting active rows that carry no updatedAt timestamp', () => {
    renderAgents(
      container,
      snapshot({
        active: [
          { id: 'a', agentName: 'Claude', status: 'working' },
          { id: 'b', agentName: 'Claude', status: 'working' },
          { id: 'c', agentName: 'Claude', status: 'working' },
        ],
      }),
    );
    expect(container.querySelectorAll('.agent-row')).toHaveLength(3);
  });

  it('labels each row and exposes its status and a focusable target', () => {
    renderAgents(
      container,
      snapshot({ active: [active({ id: 'a', status: 'needs_user', projectName: 'website' })] }),
    );

    const row = container.querySelector('.agent-row') as HTMLElement;
    expect(row.querySelector('.agent-row__label')?.textContent).toBe('Claude · website');
    expect(row.querySelector('.agent-row__status')?.textContent).toBe('needs you');
    expect(row.dataset.status).toBe('needs_user');
    expect(row.tabIndex).toBe(0);
  });

  it('shows "working" wording for a working row and passes unknown statuses through', () => {
    renderAgents(
      container,
      snapshot({
        active: [
          active({ id: 'a', status: 'working' }),
          active({ id: 'b', status: 'mystery' }),
        ],
      }),
    );
    const statuses = Array.from(container.querySelectorAll('.agent-row__status')).map((s) => s.textContent);
    expect(statuses).toEqual(['working', 'mystery']);
  });

  it('renders an empty state and no list when nothing is active', () => {
    renderAgents(container, snapshot());
    expect(container.querySelector('.agents-list')).toBeNull();
    expect(container.querySelector('.agents-empty')?.textContent).toBe('No agents are working right now.');
  });

  it('calls onSelectRow with the execution id when a row is clicked', () => {
    const onSelectRow = vi.fn();
    renderAgents(container, snapshot({ active: [active({ id: 'pick-me' })] }), { onSelectRow });

    (container.querySelector('.agent-row') as HTMLElement).click();
    expect(onSelectRow).toHaveBeenCalledWith('pick-me');
  });

  it('does not throw on a row click when no onSelectRow handler is given', () => {
    renderAgents(container, snapshot({ active: [active({ id: 'a' })] }));
    expect(() => (container.querySelector('.agent-row') as HTMLElement).click()).not.toThrow();
  });

  it('marks the highlighted row and leaves the others plain', () => {
    renderAgents(
      container,
      snapshot({ active: [active({ id: 'a' }), active({ id: 'b' })] }),
      { highlightId: 'b' },
    );
    const rows = container.querySelectorAll('.agent-row');
    expect(rows[0].classList.contains('agent-row--highlight')).toBe(false);
    expect(rows[1].classList.contains('agent-row--highlight')).toBe(true);
  });
});

describe('renderAgents — recent executions', () => {
  it('orders finished executions newest first', () => {
    renderAgents(
      container,
      snapshot({
        recent: [
          { id: 'r-old', agentName: 'Claude', status: 'finished', finishedAt: 100 },
          { id: 'r-new', agentName: 'Codex', status: 'finished', finishedAt: 300 },
          { id: 'r-mid', agentName: 'Claude', status: 'finished', finishedAt: 200 },
        ],
      }),
    );
    const ids = Array.from(container.querySelectorAll('.agents-recent .agent-recent-row')).map(
      (r) => (r as HTMLElement).dataset.executionId,
    );
    expect(ids).toEqual(['r-new', 'r-mid', 'r-old']);
  });

  it('does not blow up sorting finished rows that carry no finishedAt timestamp', () => {
    renderAgents(
      container,
      snapshot({
        recent: [
          { id: 'r1', agentName: 'Claude', status: 'finished' },
          { id: 'r2', agentName: 'Claude', status: 'finished' },
          { id: 'r3', agentName: 'Claude', status: 'finished' },
        ],
      }),
    );
    expect(container.querySelectorAll('.agent-recent-row')).toHaveLength(3);
  });

  it('always shows the "Finished recently" heading, with an empty state when there is nothing', () => {
    renderAgents(container, snapshot());
    expect(container.querySelector('.agents-recent-title')?.textContent).toBe('Finished recently');
    expect(container.querySelector('.agents-recent')).toBeNull();
    expect(container.querySelector('.agents-recent-empty')?.textContent).toBe('Nothing finished yet.');
  });
});

describe('renderAgents — re-render', () => {
  it('clears the previous content on each call', () => {
    renderAgents(container, snapshot({ active: [active({ id: 'a' })] }));
    expect(container.querySelectorAll('.agent-row')).toHaveLength(1);

    renderAgents(container, snapshot());
    expect(container.querySelectorAll('.agent-row')).toHaveLength(0);
    expect(container.querySelectorAll('.agents-counts')).toHaveLength(1);
  });

  it('tags both lists with role="list" for assistive technology', () => {
    renderAgents(
      container,
      snapshot({
        active: [active({ id: 'a' })],
        recent: [{ id: 'r', agentName: 'Claude', status: 'finished', finishedAt: 1 }],
      }),
    );
    expect(container.querySelector('.agents-list')?.getAttribute('role')).toBe('list');
    expect(container.querySelector('.agents-recent')?.getAttribute('role')).toBe('list');
  });
});
