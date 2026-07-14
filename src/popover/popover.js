import { GAMES } from '../games/registry.js';
import { createHub } from './carousel.js';

const backBtn = document.getElementById('back-btn');
const brand = document.getElementById('brand');
const gameName = document.getElementById('game-name');
const hubScreen = document.getElementById('hub-screen');
const gameScreen = document.getElementById('game-screen');
const gameArea = document.getElementById('game-area');
const placeholder = document.getElementById('placeholder');
const placeholderText = document.getElementById('placeholder-text');
const iframe = document.getElementById('game');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const continueBtn = document.getElementById('continue-btn');
const settingsBtn = document.getElementById('settings-btn');

let currentState = 'idle';
let currentSessionId = null;
let started = false;
let activeGame = null;

function updateOverlayText() {
  if (!started) {
    overlayMsg.textContent = 'Ready to play?';
    continueBtn.textContent = 'Start';
    return;
  }

  continueBtn.textContent = 'Continue';
  // Only attribute the pause to Claude once a real session has reported a
  // state (sessionId set) - otherwise the default 'idle' state would
  // misleadingly claim "Claude finished" before Claude has done anything.
  if (currentSessionId && currentState === 'needs_user') {
    overlayMsg.textContent = 'Claude needs input';
  } else if (currentSessionId && currentState === 'idle') {
    overlayMsg.textContent = 'Claude finished';
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

function openGame(game) {
  activeGame = game;
  started = false;

  backBtn.hidden = false;
  brand.hidden = true;
  gameName.hidden = false;
  gameName.textContent = game.name;

  hubScreen.hidden = true;
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
  brand.hidden = false;
  gameName.hidden = true;

  gameScreen.hidden = true;
  hubScreen.hidden = false;
}

backBtn.addEventListener('click', goHome);

createHub({ container: hubScreen, games: GAMES, onOpenGame: openGame });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.meanwaile.close();
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
  hideOverlay();
  iframe.contentWindow.postMessage({ type: 'game:resume' }, '*');
});

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.meanwaile.openSettings();
});

window.meanwaile.onStateChange((snapshot) => {
  if (snapshot.state === currentState) return;
  currentState = snapshot.state;
  currentSessionId = snapshot.sessionId;

  if (!activeGame?.implemented) return;

  if (snapshot.state === 'agent_working') {
    // Never auto-start: until the player has clicked Start at least once,
    // keep showing the "Ready to play?" prompt regardless of agent state.
    if (started) {
      hideOverlay();
      if (!document.hidden) {
        iframe.contentWindow.postMessage({ type: 'game:resume' }, '*');
      }
    }
  } else {
    iframe.contentWindow?.postMessage({ type: 'game:pause' }, '*');
    showOverlay();
  }
});
