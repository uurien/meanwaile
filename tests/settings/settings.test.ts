// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

interface FullSettings {
  httpPort: number;
  autoOpenDelaySeconds: number;
  autoOpenGames: boolean;
  notificationsEnabled: boolean;
  notifyNeedsUser: boolean;
  notifyFinished: boolean;
  notificationSound: 'none' | 'system';
}

const BASE: FullSettings = {
  httpPort: 3821,
  autoOpenDelaySeconds: 15,
  autoOpenGames: true,
  notificationsEnabled: false,
  notifyNeedsUser: true,
  notifyFinished: true,
  notificationSound: 'none',
};

let getSettings: ReturnType<typeof vi.fn>;
let saveSettings: ReturnType<typeof vi.fn>;
let getServerStatus: ReturnType<typeof vi.fn>;
let closeSpy: ReturnType<typeof vi.fn>;

let form: HTMLFormElement;
let portInput: HTMLInputElement;
let delayInput: HTMLInputElement;
let autoOpenGames: HTMLInputElement;
let notificationsEnabled: HTMLInputElement;
let notifyNeedsUser: HTMLInputElement;
let notifyFinished: HTMLInputElement;
let notificationSound: HTMLSelectElement;
let serverStatus: HTMLElement;
let errorMsg: HTMLElement;
let cancelBtn: HTMLElement;
let saveBtn: HTMLElement;

async function loadSettingsPage(
  current: Partial<FullSettings> = {},
  serverState: string = 'active',
) {
  vi.resetModules();
  document.body.innerHTML = '';

  const html = readFileSync(join(__dirname, '../../src/settings/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  getSettings = vi.fn(async () => ({ ...BASE, ...current }));
  saveSettings = vi.fn(async () => ({ ok: true }));
  getServerStatus = vi.fn(async () => serverState);
  closeSpy = vi.fn();

  Object.defineProperty(window, 'meanwaile', {
    value: { getSettings, saveSettings, getServerStatus },
    configurable: true,
  });
  Object.defineProperty(window, 'close', { value: closeSpy, configurable: true });

  await import('../../src/settings/settings.js');
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();

  form = document.getElementById('settings-form') as HTMLFormElement;
  portInput = document.getElementById('http-port') as HTMLInputElement;
  delayInput = document.getElementById('auto-open-delay') as HTMLInputElement;
  autoOpenGames = document.getElementById('auto-open-games') as HTMLInputElement;
  notificationsEnabled = document.getElementById('notifications-enabled') as HTMLInputElement;
  notifyNeedsUser = document.getElementById('notify-needs-user') as HTMLInputElement;
  notifyFinished = document.getElementById('notify-finished') as HTMLInputElement;
  notificationSound = document.getElementById('notification-sound') as HTMLSelectElement;
  serverStatus = document.getElementById('server-status')!;
  errorMsg = document.getElementById('error-msg')!;
  cancelBtn = document.getElementById('cancel-btn')!;
  saveBtn = document.getElementById('save-btn')!;
}

function submit() {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return Promise.resolve().then(() => Promise.resolve());
}

beforeEach(() => {
  vi.resetModules();
});

describe('settings page — layout', () => {
  it('groups controls under Automation, Notifications and Detection, with no intro card', async () => {
    await loadSettingsPage();
    const titles = Array.from(document.querySelectorAll('.group__title')).map((h) => h.textContent);
    expect(titles).toEqual(['Automation', 'Notifications', 'Detection']);
    expect(document.querySelector('.intro-card')).toBeNull();
  });

  it('labels the submit button "Save settings"', async () => {
    await loadSettingsPage();
    expect(saveBtn.textContent).toBe('Save settings');
  });
});

describe('settings page — loading values', () => {
  it('populates every field from the current settings', async () => {
    await loadSettingsPage({
      httpPort: 4000,
      autoOpenDelaySeconds: 25,
      autoOpenGames: false,
      notificationsEnabled: true,
      notifyNeedsUser: false,
      notifyFinished: true,
      notificationSound: 'system',
    });

    expect(portInput.value).toBe('4000');
    expect(delayInput.value).toBe('25');
    expect(autoOpenGames.checked).toBe(false);
    expect(notificationsEnabled.checked).toBe(true);
    expect(notifyNeedsUser.checked).toBe(false);
    expect(notifyFinished.checked).toBe(true);
    expect(notificationSound.value).toBe('system');
  });

  it('offers "No sound" and a system sound option', async () => {
    await loadSettingsPage();
    const options = Array.from(notificationSound.options).map((o) => [o.value, o.textContent]);
    expect(options).toContainEqual(['none', 'No sound']);
    expect(options.some(([value]) => value === 'system')).toBe(true);
  });
});

describe('settings page — independent switches', () => {
  it('shows Open games automatically and Notifications as independent switches', async () => {
    await loadSettingsPage({ autoOpenGames: true, notificationsEnabled: false });
    expect(autoOpenGames.getAttribute('role')).toBe('switch');
    expect(notificationsEnabled.getAttribute('role')).toBe('switch');
  });

  it('disables but preserves the idle time when auto-open games is off', async () => {
    await loadSettingsPage({ autoOpenGames: true, autoOpenDelaySeconds: 22 });
    expect(delayInput.disabled).toBe(false);

    autoOpenGames.checked = false;
    autoOpenGames.dispatchEvent(new Event('change', { bubbles: true }));

    expect(delayInput.disabled).toBe(true);
    expect(delayInput.value).toBe('22');

    autoOpenGames.checked = true;
    autoOpenGames.dispatchEvent(new Event('change', { bubbles: true }));
    expect(delayInput.disabled).toBe(false);
    expect(delayInput.value).toBe('22');
  });

  it('disables but preserves the notification detail fields when notifications are off', async () => {
    await loadSettingsPage({
      notificationsEnabled: true,
      notifyNeedsUser: false,
      notifyFinished: true,
      notificationSound: 'system',
    });
    expect(notifyNeedsUser.disabled).toBe(false);

    notificationsEnabled.checked = false;
    notificationsEnabled.dispatchEvent(new Event('change', { bubbles: true }));

    expect(notifyNeedsUser.disabled).toBe(true);
    expect(notifyFinished.disabled).toBe(true);
    expect(notificationSound.disabled).toBe(true);
    expect(notifyNeedsUser.checked).toBe(false);
    expect(notifyFinished.checked).toBe(true);
    expect(notificationSound.value).toBe('system');

    notificationsEnabled.checked = true;
    notificationsEnabled.dispatchEvent(new Event('change', { bubbles: true }));
    expect(notifyNeedsUser.disabled).toBe(false);
    expect(notificationSound.value).toBe('system');
  });
});

describe('settings page — server status', () => {
  it('shows "Active" next to the port when the local server is running', async () => {
    await loadSettingsPage({}, 'active');
    expect(serverStatus.textContent).toBe('Active');
  });

  it('reflects a non-running server without claiming Active', async () => {
    await loadSettingsPage({}, 'error');
    expect(serverStatus.textContent).not.toBe('Active');
  });

  it('shows a "starting" placeholder while the server is still coming up or unknown', async () => {
    await loadSettingsPage({}, 'starting');
    expect(serverStatus.textContent).toBe('Starting…');

    await loadSettingsPage({}, 'something-unexpected');
    expect(serverStatus.textContent).toBe('Starting…');
  });
});

describe('settings page — help tooltips', () => {
  it('wires the exact Idle time tooltip text via aria-describedby', async () => {
    await loadSettingsPage();
    const help = document.getElementById('help-idle') as HTMLElement;
    const tip = document.getElementById(help.getAttribute('aria-describedby')!)!;
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.textContent).toBe(
      'Meanwaile checks whether you have been away from your keyboard and mouse for this long before opening a game.',
    );
  });

  it('wires the exact Port tooltip text via aria-describedby', async () => {
    await loadSettingsPage();
    const help = document.getElementById('help-port') as HTMLElement;
    const tip = document.getElementById(help.getAttribute('aria-describedby')!)!;
    expect(tip.textContent).toBe(
      'The local port Meanwaile uses to receive events from your agents. Change it only if there is a conflict.',
    );
  });

  it('opens on hover and keyboard focus and closes on blur or Escape', async () => {
    await loadSettingsPage();
    const help = document.getElementById('help-idle') as HTMLElement;
    const tip = document.getElementById('tip-idle')!;
    expect(tip.hidden).toBe(true);

    help.dispatchEvent(new Event('mouseenter'));
    expect(tip.hidden).toBe(false);
    help.dispatchEvent(new Event('mouseleave'));
    expect(tip.hidden).toBe(true);

    help.dispatchEvent(new Event('focus'));
    expect(tip.hidden).toBe(false);
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tip.hidden).toBe(true);

    help.dispatchEvent(new Event('focus'));
    expect(tip.hidden).toBe(false);
    help.dispatchEvent(new Event('blur'));
    expect(tip.hidden).toBe(true);
  });
});

describe('settings page — save & cancel', () => {
  it('sends the complete settings object on submit', async () => {
    await loadSettingsPage({
      httpPort: 3821,
      autoOpenDelaySeconds: 15,
      autoOpenGames: true,
      notificationsEnabled: true,
      notifyNeedsUser: true,
      notifyFinished: false,
      notificationSound: 'none',
    });
    portInput.value = '5000';
    delayInput.value = '30';
    notifyFinished.checked = true;
    notificationSound.value = 'system';

    await submit();

    expect(saveSettings).toHaveBeenCalledWith({
      httpPort: 5000,
      autoOpenDelaySeconds: 30,
      autoOpenGames: true,
      notificationsEnabled: true,
      notifyNeedsUser: true,
      notifyFinished: true,
      notificationSound: 'system',
    });
  });

  it('shows a validation error returned by the main process', async () => {
    await loadSettingsPage();
    saveSettings.mockResolvedValueOnce({ ok: false, error: 'Port must be an integer between 1 and 65535.' });

    await submit();

    expect(errorMsg.textContent).toBe('Port must be an integer between 1 and 65535.');
  });

  it('closes the window when Cancel is clicked', async () => {
    await loadSettingsPage();
    cancelBtn.click();
    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
