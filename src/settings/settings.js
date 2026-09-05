const form = document.getElementById('settings-form');
const portInput = document.getElementById('http-port');
const delayInput = document.getElementById('auto-open-delay');
const autoOpenGames = document.getElementById('auto-open-games');
const notificationsEnabled = document.getElementById('notifications-enabled');
const notifyNeedsUser = document.getElementById('notify-needs-user');
const notifyFinished = document.getElementById('notify-finished');
const notificationSound = document.getElementById('notification-sound');
const serverStatus = document.getElementById('server-status');
const errorMsg = document.getElementById('error-msg');

const SERVER_STATUS_TEXT = {
  active: 'Active',
  starting: 'Starting…',
  error: 'Unavailable',
};

// Automatic game opening and notifications are independent switches. Their
// dependent controls are only *disabled* when the parent switch is off — the
// values stay in the DOM so toggling back on restores them unchanged.
function applyDependentState() {
  delayInput.disabled = !autoOpenGames.checked;

  const notificationsOff = !notificationsEnabled.checked;
  notifyNeedsUser.disabled = notificationsOff;
  notifyFinished.disabled = notificationsOff;
  notificationSound.disabled = notificationsOff;
}

async function loadCurrentSettings() {
  const settings = await window.meanwaile.getSettings();
  portInput.value = settings.httpPort;
  delayInput.value = settings.autoOpenDelaySeconds;
  autoOpenGames.checked = Boolean(settings.autoOpenGames);
  notificationsEnabled.checked = Boolean(settings.notificationsEnabled);
  notifyNeedsUser.checked = Boolean(settings.notifyNeedsUser);
  notifyFinished.checked = Boolean(settings.notifyFinished);
  notificationSound.value = settings.notificationSound === 'system' ? 'system' : 'none';
  applyDependentState();
}

async function loadServerStatus() {
  const status = await window.meanwaile.getServerStatus();
  serverStatus.textContent = SERVER_STATUS_TEXT[status] || SERVER_STATUS_TEXT.starting;
  serverStatus.dataset.state = status;
}

function wireTooltip(id) {
  const trigger = document.getElementById(id);
  const tip = document.getElementById(trigger.getAttribute('aria-describedby'));
  const show = () => { tip.hidden = false; };
  const hide = () => { tip.hidden = true; };
  trigger.addEventListener('mouseenter', show);
  trigger.addEventListener('focus', show);
  trigger.addEventListener('mouseleave', hide);
  trigger.addEventListener('blur', hide);
  trigger.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Escape dismisses the tooltip first; it must not also close the window.
    hide();
    e.stopPropagation();
  });
}

autoOpenGames.addEventListener('change', applyDependentState);
notificationsEnabled.addEventListener('change', applyDependentState);
wireTooltip('help-idle');
wireTooltip('help-port');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const result = await window.meanwaile.saveSettings({
    httpPort: Number(portInput.value),
    autoOpenDelaySeconds: Number(delayInput.value),
    autoOpenGames: autoOpenGames.checked,
    notificationsEnabled: notificationsEnabled.checked,
    notifyNeedsUser: notifyNeedsUser.checked,
    notifyFinished: notifyFinished.checked,
    notificationSound: notificationSound.value === 'system' ? 'system' : 'none',
  });

  if (!result.ok) {
    errorMsg.textContent = result.error;
  }
});

// This window has no in-content Cancel button (the design puts a single
// full-width primary action); Escape and the native title-bar controls
// dismiss it without saving.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});

loadCurrentSettings();
loadServerStatus();
