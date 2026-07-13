const iframe = document.getElementById('game');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const continueBtn = document.getElementById('continue-btn');
const settingsBtn = document.getElementById('settings-btn');

let currentState = 'idle';
let currentSessionId = null;
let started = false;

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
  updateOverlayText();
  overlay.style.display = 'flex';
  continueBtn.focus();
}

function hideOverlay() {
  overlay.style.display = 'none';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.meanwaile.close();
});

// Pause on close, show overlay on reopen
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    iframe.contentWindow?.postMessage({ type: 'game:pause' }, '*');
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
    iframe.contentWindow.postMessage({ type: 'game:pause' }, '*');
    showOverlay();
  }
});

// The popover BrowserWindow is created with show:false and loads this page
// long before it's ever shown. Chromium doesn't reliably fire the first
// hidden -> visible `visibilitychange` for a window that starts hidden, so
// waiting for that event to show the overlay left the very first open with
// no overlay and no way to start the game. Showing it eagerly here means
// it's already correct by the time main.ts actually calls win.show().
showOverlay();
