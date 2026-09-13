import { createHub } from './carousel.js';
import { renderAgents } from './agents-view.js';

const backBtn = document.getElementById('back-btn');
const brandMark = document.getElementById('brand-mark');
const brand = document.getElementById('brand');
const gameName = document.getElementById('game-name');
const hubScreen = document.getElementById('hub-screen');
const agentsScreen = document.getElementById('agents-screen');
const gameScreen = document.getElementById('game-screen');
const gameArea = document.getElementById('game-area');
const placeholder = document.getElementById('placeholder');
const placeholderText = document.getElementById('placeholder-text');
const iframe = document.getElementById('game');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const continueBtn = document.getElementById('continue-btn');
const settingsBtn = document.getElementById('settings-btn');
const galleryBtn = document.getElementById('gallery-btn');
const menuBtn = document.getElementById('menu-btn');
const headerMenu = document.getElementById('header-menu');
const tabs = document.getElementById('tabs');
const tabGames = document.getElementById('tab-games');
const tabAgents = document.getElementById('tab-agents');

let currentState = 'idle';
let currentSessionId = null;
let currentAgentName = null;
let started = false;
let activeGame = null;
let latestSnapshot = { active: [], recent: [], counts: { active: 0, working: 0, needsUser: 0, finished: 0 } };
let pendingInterruption = null;
let highlightExecutionId = null;

function updateOverlayText() {
  if (!started) {
    overlayMsg.textContent = 'Ready to play?';
    continueBtn.textContent = 'Start';
    return;
  }

  continueBtn.textContent = 'Continue';

  // A principal-agent interruption (needs_user / finished, possibly from a
  // different agent than the one that owns the game screen) takes precedence
  // over the plain state-driven wording. It names the agent that triggered it
  // and, on a partial finish, how many agents are still working.
  if (pendingInterruption) {
    const who = interruptionLabel(pendingInterruption.execution);
    if (pendingInterruption.transition === 'needs_user') {
      overlayMsg.textContent = `${who} needs input`;
    } else {
      const stillWorking = (pendingInterruption.counts && pendingInterruption.counts.working) || 0;
      overlayMsg.textContent =
        stillWorking > 0
          ? `${who} finished — ${stillWorking} agent${stillWorking === 1 ? '' : 's'} still working`
          : `${who} finished`;
    }
    return;
  }

  // Only attribute the pause to a specific agent once a real session has
  // reported a state (sessionId set) - otherwise the default 'idle' state
  // would misleadingly claim "<agent> finished" before it has done anything.
  // agentName comes from whichever adapter (Claude, Codex, ...) reported the
  // event, falling back to a generic "Agent" label if it's ever missing.
  const label = currentAgentName || 'Agent';
  if (currentSessionId && currentState === 'needs_user') {
    overlayMsg.textContent = `${label} needs input`;
  } else if (currentSessionId && currentState === 'idle') {
    overlayMsg.textContent = `${label} finished`;
  } else {
    overlayMsg.textContent = 'Paused';
  }
}

function showOverlay() {
  if (!activeGame?.implemented) return;
  updateOverlayText();
  overlay.style.display = 'flex';
  continueBtn.focus();
}

function hideOverlay() {
  overlay.style.display = 'none';
}

function interruptionLabel(execution) {
  if (!execution) return 'Agent';
  const name = execution.agentName || 'Agent';
  return execution.projectName ? `${name} · ${execution.projectName}` : name;
}

// ─── Agents view ─────────────────────────────────────────────────────────

function renderAgentsScreen() {
  renderAgents(agentsScreen, latestSnapshot, {
    highlightId: highlightExecutionId,
    onSelectRow: (id) => {
      highlightExecutionId = id;
      renderAgentsScreen();
    },
  });
}

function focusHighlightedRow() {
  const row = Array.from(agentsScreen.querySelectorAll('[data-execution-id]')).find(
    (node) => node.dataset.executionId === highlightExecutionId,
  );
  if (row) row.focus();
}

// ─── Tabs ────────────────────────────────────────────────────────────────

function selectTab(name) {
  const games = name === 'games';
  tabGames.setAttribute('aria-selected', String(games));
  tabAgents.setAttribute('aria-selected', String(!games));
  tabGames.tabIndex = games ? 0 : -1;
  tabAgents.tabIndex = games ? -1 : 0;
  hubScreen.hidden = !games;
  agentsScreen.hidden = games;
}

// ─── ··· menu ────────────────────────────────────────────────────────────

function setMenuOpen(open) {
  headerMenu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) galleryBtn.focus();
}

// ─── Notification / tray routing ─────────────────────────────────────────

function applyPopoverView(view) {
  // A game already in progress keeps priority over the default routing when
  // the popover is reopened — never yank the player out of a running round.
  if (activeGame && started) return;
  if (activeGame) goHome();

  if (view === 'agents') {
    selectTab('agents');
    renderAgentsScreen();
    focusHighlightedRow();
  } else {
    selectTab('games');
  }
}

function openGame(game) {
  activeGame = game;
  started = false;

  backBtn.hidden = false;
  brandMark.hidden = true;
  brand.hidden = true;
  gameName.hidden = false;
  gameName.textContent = game.name;
  tabs.hidden = true;

  hubScreen.hidden = true;
  agentsScreen.hidden = true;
  gameScreen.hidden = false;

  if (game.implemented) {
    placeholder.hidden = true;
    gameArea.hidden = false;
    iframe.src = game.entry;
    showOverlay();
  } else {
    gameArea.hidden = true;
    hideOverlay();
    placeholder.hidden = false;
    placeholderText.textContent = `${game.name} todavía no tiene mecánica — conecta aquí la lógica cuando esté lista.`;
  }
}

function goHome() {
  activeGame = null;
  iframe.src = 'about:blank';
  hideOverlay();

  backBtn.hidden = true;
  brandMark.hidden = false;
  brand.hidden = false;
  gameName.hidden = true;
  tabs.hidden = false;

  gameScreen.hidden = true;
  // Leaving a game always lands back on Games, never Agents.
  selectTab('games');
}

backBtn.addEventListener('click', goHome);

// Re-run whenever the games list changes too (gallery install/remove),
// not just on the initial load, so the hub reflects it live without the
// user having to reopen the popover.
async function refreshHub() {
  createHub({
    container: hubScreen,
    games: await window.meanwaile.listGames(),
    onOpenGame: openGame,
    onOpenGallery: () => window.meanwaile.openGallery(),
    onUninstallGame: (game) => window.meanwaile.uninstallGame(game.id, game.name),
  });
}

await refreshHub();
window.meanwaile.onGamesChanged(refreshHub);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Escape first dismisses the ··· menu if it is open; only then does it
  // close the whole popover.
  if (!headerMenu.hidden) {
    setMenuOpen(false);
    menuBtn.focus();
    return;
  }
  window.meanwaile.close();
});

// Pause on close, show overlay on reopen
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (activeGame?.implemented) iframe.contentWindow?.postMessage({ type: 'game:pause' }, '*');
  } else {
    showOverlay();
  }
});

// main.ts calls win.focus() every time the popover is shown, and Chromium
// resets keyboard focus to the first focusable element (the gear icon) when
// a window regains OS focus - overriding whatever showOverlay() already
// focused. Re-asserting focus here, right as that reset happens, is what
// actually keeps it pinned on Start regardless of where focus was before
// the popover was last closed.
window.addEventListener('focus', () => {
  if (overlay.style.display === 'flex') continueBtn.focus();
});

continueBtn.addEventListener('click', () => {
  started = true;
  pendingInterruption = null;
  hideOverlay();
  iframe.contentWindow.postMessage({ type: 'game:resume' }, '*');
  // Without this, keyboard focus stays on the Start button and keys like
  // Space trigger it again instead of reaching the game's own listeners.
  iframe.contentWindow.focus();
});

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenuOpen(false);
  window.meanwaile.openSettings();
});

galleryBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenuOpen(false);
  window.meanwaile.openGallery();
});

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenuOpen(headerMenu.hidden);
});

// A click anywhere else dismisses the open ··· menu.
document.addEventListener('click', () => {
  if (!headerMenu.hidden) setMenuOpen(false);
});

tabGames.addEventListener('click', () => selectTab('games'));
tabAgents.addEventListener('click', () => selectTab('agents'));

// Left/Right arrows move between the two tabs, per the WAI-ARIA tabs pattern.
tabs.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const toGames = e.key === 'ArrowLeft';
  selectTab(toGames ? 'games' : 'agents');
  (toGames ? tabGames : tabAgents).focus();
});

window.meanwaile.onStateChange((snapshot) => {
  // Keyed on (state, sessionId), not state alone: with several agents
  // running, a different agent reaching the same aggregate state (e.g. a
  // second agent finishing while the state is already 'idle' from the
  // first) must still re-pause and update the overlay, while a genuine
  // duplicate hook from the *same* session stays a no-op.
  if (snapshot.state === currentState && snapshot.sessionId === currentSessionId) return;
  currentState = snapshot.state;
  currentSessionId = snapshot.sessionId;
  currentAgentName = snapshot.agentName;
  // A stale execution is only a bookkeeping correction. Keep the renderer's
  // aggregate state in sync so later real events are handled correctly, but
  // never pause, resume, or change the current game UI for this transition.
  if (snapshot.silent) return;
  // A plain aggregate state change supersedes any pending interruption text.
  pendingInterruption = null;

  if (!activeGame?.implemented) return;

  if (snapshot.state === 'agent_working') {
    // Never auto-start: until the player has clicked Start at least once,
    // keep showing the "Ready to play?" prompt regardless of agent state.
    if (started) {
      hideOverlay();
      if (!document.hidden) {
        iframe.contentWindow.postMessage({ type: 'game:resume' }, '*');
        iframe.contentWindow.focus();
      }
    }
  } else {
    iframe.contentWindow?.postMessage({ type: 'game:pause' }, '*');
    showOverlay();
  }
});

// ─── Live agent activity ────────────────────────────────────────────────

latestSnapshot = await window.meanwaile.getActivity();
renderAgentsScreen();

window.meanwaile.onActivityChange((snapshot) => {
  latestSnapshot = snapshot;
  renderAgentsScreen();
});

// A significant needs_user / task_finished from any principal agent pauses
// the running game immediately and shows the overlay — continuing is always
// an explicit click, never automatic. SubagentStop never reaches here.
window.meanwaile.onAgentInterruption((payload) => {
  pendingInterruption = payload;
  highlightExecutionId = payload.execution ? payload.execution.id : highlightExecutionId;
  renderAgentsScreen();

  if (!activeGame?.implemented) return;
  iframe.contentWindow?.postMessage({ type: 'game:pause' }, '*');
  showOverlay();
});

// Notification clicks route here as 'agents'; normal tray / auto-open as
// 'games'. A round already in progress overrides both (see applyPopoverView).
window.meanwaile.onPopoverView(applyPopoverView);
applyPopoverView(await window.meanwaile.getPopoverView());
