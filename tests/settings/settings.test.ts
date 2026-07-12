// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

let getSettings: ReturnType<typeof vi.fn>;
let saveSettings: ReturnType<typeof vi.fn>;
let portInput: HTMLInputElement;
let delayInput: HTMLInputElement;
let errorMsg: HTMLElement;
let form: HTMLFormElement;
let cancelBtn: HTMLElement;
let closeSpy: ReturnType<typeof vi.fn>;

async function loadSettingsPage(currentSettings: { httpPort: number; autoOpenDelaySeconds: number }) {
  vi.resetModules();
  document.body.innerHTML = '';

  const html = readFileSync(join(__dirname, '../../src/settings/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  getSettings = vi.fn(async () => currentSettings);
  saveSettings = vi.fn(async () => ({ ok: true }));
  closeSpy = vi.fn();

  Object.defineProperty(window, 'meanwaile', {
    value: { getSettings, saveSettings },
    configurable: true,
  });
  Object.defineProperty(window, 'close', { value: closeSpy, configurable: true });

  await import('../../src/settings/settings.js');
  // Flush the async loadCurrentSettings() call fired on import.
  await Promise.resolve();
  await Promise.resolve();

  portInput = document.getElementById('http-port') as HTMLInputElement;
  delayInput = document.getElementById('auto-open-delay') as HTMLInputElement;
  errorMsg = document.getElementById('error-msg')!;
  form = document.getElementById('settings-form') as HTMLFormElement;
  cancelBtn = document.getElementById('cancel-btn')!;
}

beforeEach(() => {
  vi.resetModules();
});

describe('settings page', () => {
  it('loads and displays the current settings on open', async () => {
    await loadSettingsPage({ httpPort: 4000, autoOpenDelaySeconds: 25 });
    expect(portInput.value).toBe('4000');
    expect(delayInput.value).toBe('25');
  });

  it('saves the entered values on submit', async () => {
    await loadSettingsPage({ httpPort: 3821, autoOpenDelaySeconds: 15 });
    portInput.value = '5000';
    delayInput.value = '30';

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(saveSettings).toHaveBeenCalledWith({ httpPort: 5000, autoOpenDelaySeconds: 30 });
  });

  it('shows a validation error returned by the main process', async () => {
    await loadSettingsPage({ httpPort: 3821, autoOpenDelaySeconds: 15 });
    saveSettings.mockResolvedValueOnce({ ok: false, error: 'Port must be an integer between 1 and 65535.' });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(errorMsg.textContent).toBe('Port must be an integer between 1 and 65535.');
  });

  it('closes the window when Cancel is clicked', async () => {
    await loadSettingsPage({ httpPort: 3821, autoOpenDelaySeconds: 15 });
    cancelBtn.click();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
