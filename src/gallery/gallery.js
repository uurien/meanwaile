const grid = document.getElementById('grid');
const status = document.getElementById('status');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showStatus(message, isError) {
  status.hidden = false;
  status.textContent = message;
  status.className = isError ? 'status--error' : '';
}

function hideStatus() {
  status.hidden = true;
  status.textContent = '';
  status.className = '';
}

async function handleAction(game, button, kind) {
  const busyLabel = kind === 'uninstall' ? 'Removing…' : game.updateAvailable ? 'Updating…' : 'Installing…';
  button.disabled = true;
  button.textContent = busyLabel;

  const result =
    kind === 'uninstall'
      ? await window.meanwaile.uninstallGame(game.id, game.name)
      : await window.meanwaile.installGame(game.id, game.version);

  // Cancelling the native confirmation dialog isn't a failure - just put
  // the button back the way it was, with no error banner.
  if (result.cancelled) {
    button.disabled = false;
    button.textContent = kind === 'uninstall' ? 'Remove' : game.updateAvailable ? 'Update' : 'Install';
    return;
  }

  if (!result.ok) {
    showStatus(result.error, true);
    button.disabled = false;
    button.textContent = kind === 'uninstall' ? 'Remove' : game.updateAvailable ? 'Update' : 'Install';
    return;
  }

  await loadCatalog();
}

function buildCard(game) {
  const card = el('div', 'catalog-card');

  const img = el('img', 'catalog-card__preview');
  img.src = game.previewDataUri;
  img.alt = '';
  card.appendChild(img);

  const info = el('div', 'catalog-card__info');
  info.appendChild(el('div', 'catalog-card__title', game.name));
  info.appendChild(el('div', 'catalog-card__tagline', game.tagline));
  info.appendChild(el('div', 'catalog-card__description', game.description));
  card.appendChild(info);

  const actions = el('div', 'catalog-card__actions');

  if (!game.bundled && (!game.installed || game.updateAvailable)) {
    const actionBtn = el('button', 'catalog-card__action', game.installed ? 'Update' : 'Install');
    actionBtn.addEventListener('click', () => handleAction(game, actionBtn, 'install'));
    actions.appendChild(actionBtn);
  } else if (game.installed) {
    actions.appendChild(el('span', 'catalog-card__badge', 'Installed'));
  }

  if (game.installed && !game.bundled) {
    const removeBtn = el('button', 'catalog-card__remove', 'Remove');
    removeBtn.addEventListener('click', () => handleAction(game, removeBtn, 'uninstall'));
    actions.appendChild(removeBtn);
  }

  card.appendChild(actions);
  return card;
}

async function loadCatalog() {
  showStatus('Loading the games catalog…', false);
  grid.innerHTML = '';

  const result = await window.meanwaile.listCatalog();

  if (!result.ok) {
    showStatus(result.error, true);
    const retryBtn = el('button', 'status__retry', 'Retry');
    retryBtn.addEventListener('click', loadCatalog);
    status.appendChild(retryBtn);
    return;
  }

  hideStatus();
  grid.innerHTML = '';
  result.games.forEach((game) => grid.appendChild(buildCard(game)));
}

await loadCatalog();
