const form = document.getElementById('settings-form');
const portInput = document.getElementById('http-port');
const delayInput = document.getElementById('auto-open-delay');
const errorMsg = document.getElementById('error-msg');
const cancelBtn = document.getElementById('cancel-btn');

async function loadCurrentSettings() {
  const settings = await window.meanwaile.getSettings();
  portInput.value = settings.httpPort;
  delayInput.value = settings.autoOpenDelaySeconds;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const result = await window.meanwaile.saveSettings({
    httpPort: Number(portInput.value),
    autoOpenDelaySeconds: Number(delayInput.value),
  });

  if (!result.ok) {
    errorMsg.textContent = result.error;
  }
});

cancelBtn.addEventListener('click', () => {
  window.close();
});

loadCurrentSettings();
