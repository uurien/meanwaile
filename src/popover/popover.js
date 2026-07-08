const iframe = document.getElementById('game');
const overlay = document.getElementById('overlay');
const continueBtn = document.getElementById('continue-btn');

let currentState = 'idle';

function showOverlay() {
  overlay.style.display = 'flex';
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

continueBtn.addEventListener('click', () => {
  hideOverlay();
  iframe.contentWindow.postMessage({ type: 'game:resume' }, '*');
});

window.meanwaile.onStateChange((snapshot) => {
  currentState = snapshot.state;

  if (snapshot.state === 'agent_working') {
    hideOverlay();
    if (!document.hidden) {
      iframe.contentWindow.postMessage({ type: 'game:resume' }, '*');
    }
  } else {
    iframe.contentWindow.postMessage({ type: 'game:pause' }, '*');
    showOverlay();
  }
});
