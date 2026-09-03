// Agents view: a read-only projection of the current agent executions. It
// never renders full paths, prompts, transcripts, tool input or assistant
// output — only the safe (agentName, projectName, status) fields the main
// process already sanitised in the execution tracker.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const STATUS_TEXT = {
  needs_user: 'needs you',
  working: 'working',
};

export function agentLabel(execution) {
  const name = execution.agentName || 'Agent';
  return execution.projectName ? `${name} · ${execution.projectName}` : name;
}

// needs_user always outranks working (it wants attention now); within a
// status, most recently updated first.
function byAttentionThenRecency(left, right) {
  if (left.status !== right.status) return left.status === 'needs_user' ? -1 : 1;
  return (right.updatedAt || 0) - (left.updatedAt || 0);
}

function countChip(kind, value, label) {
  const chip = el('span', 'agents-count');
  chip.dataset.kind = kind;
  chip.append(el('b', 'agents-count__value', String(value ?? 0)), document.createTextNode(` ${label}`));
  return chip;
}

export function renderAgents(container, snapshot, options = {}) {
  const { onSelectRow, highlightId } = options;
  const counts = snapshot.counts || {};
  const active = [...(snapshot.active || [])].sort(byAttentionThenRecency);
  const recent = [...(snapshot.recent || [])].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));

  container.replaceChildren();

  const countsRow = el('div', 'agents-counts');
  countsRow.append(
    countChip('working', counts.working, 'working'),
    countChip('needs', counts.needsUser, 'needs you'),
    countChip('finished', counts.finished, 'finished'),
  );
  container.append(countsRow);

  if (active.length === 0) {
    container.append(el('p', 'agents-empty', 'No agents are working right now.'));
  } else {
    const list = el('ul', 'agents-list');
    list.setAttribute('role', 'list');
    for (const execution of active) {
      const row = el('li', 'agent-row');
      row.dataset.executionId = execution.id;
      row.dataset.status = execution.status;
      row.tabIndex = 0;
      if (highlightId && execution.id === highlightId) row.classList.add('agent-row--highlight');
      row.append(
        el('span', 'agent-row__label', agentLabel(execution)),
        el('span', 'agent-row__status', STATUS_TEXT[execution.status] || execution.status),
      );
      row.addEventListener('click', () => onSelectRow && onSelectRow(execution.id));
      list.append(row);
    }
    container.append(list);
  }

  container.append(el('h3', 'agents-recent-title', 'Finished recently'));
  if (recent.length === 0) {
    container.append(el('p', 'agents-recent-empty', 'Nothing finished yet.'));
  } else {
    const list = el('ul', 'agents-recent');
    list.setAttribute('role', 'list');
    for (const execution of recent) {
      const row = el('li', 'agent-recent-row');
      row.dataset.executionId = execution.id;
      row.append(el('span', 'agent-row__label', agentLabel(execution)));
      list.append(row);
    }
    container.append(list);
  }
}
