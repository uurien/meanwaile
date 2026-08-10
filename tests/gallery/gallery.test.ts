// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const BUNDLED_GAME = {
  id: 'circle-tap',
  name: 'CircleTap',
  tagline: 'Tap the circles',
  description: 'A tapping game.',
  version: '1.0.0',
  previewDataUri: 'data:image/png;base64,AAA=',
  bundled: true,
  installed: true,
  installedVersion: '1.0.0',
  updateAvailable: false,
};

const NOT_INSTALLED_GAME = {
  id: 'meanwaile-maze',
  name: 'Meanwaile Maze',
  tagline: 'Find a way out',
  description: 'A maze game.',
  version: '0.1.0',
  previewDataUri: 'data:image/png;base64,BBB=',
  bundled: false,
  installed: false,
  installedVersion: null,
  updateAvailable: false,
};

const INSTALLED_UP_TO_DATE_GAME = {
  ...NOT_INSTALLED_GAME,
  id: 'installed-game',
  installed: true,
  installedVersion: '0.1.0',
};

const UPDATE_AVAILABLE_GAME = {
  ...NOT_INSTALLED_GAME,
  id: 'update-game',
  version: '0.2.0',
  installed: true,
  installedVersion: '0.1.0',
  updateAvailable: true,
};

let listCatalog: ReturnType<typeof vi.fn>;
let installGame: ReturnType<typeof vi.fn>;
let uninstallGame: ReturnType<typeof vi.fn>;

async function mount() {
  vi.resetModules();
  const html = readFileSync(join(__dirname, '../../src/gallery/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  Object.defineProperty(window, 'meanwaile', {
    value: { listCatalog, installGame, uninstallGame },
    configurable: true,
  });

  await import('../../src/gallery/gallery.js');
  await Promise.resolve();
  await Promise.resolve();
}

function grid(): HTMLElement {
  return document.getElementById('grid')!;
}

function status(): HTMLElement {
  return document.getElementById('status')!;
}

function cards(): HTMLElement[] {
  return Array.from(grid().querySelectorAll('.catalog-card'));
}

beforeEach(() => {
  listCatalog = vi.fn();
  installGame = vi.fn();
  uninstallGame = vi.fn();
});

describe('loading and error states', () => {
  it('shows a loading message before the catalog resolves, then hides it', async () => {
    let resolveCatalog!: (v: unknown) => void;
    listCatalog.mockReturnValue(new Promise((resolve) => { resolveCatalog = resolve; }));

    vi.resetModules();
    const html = readFileSync(join(__dirname, '../../src/gallery/index.html'), 'utf-8');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';
    Object.defineProperty(window, 'meanwaile', { value: { listCatalog, installGame, uninstallGame }, configurable: true });
    const importPromise = import('../../src/gallery/gallery.js');

    await vi.waitFor(() => expect(status().hidden).toBe(false));
    expect(status().textContent).toMatch(/loading/i);

    resolveCatalog({ ok: true, games: [] });
    await importPromise;

    expect(status().hidden).toBe(true);
  });

  it('shows an error message with a retry button when the catalog fails to load', async () => {
    listCatalog.mockResolvedValue({ ok: false, error: 'network unreachable' });
    await mount();

    expect(status().hidden).toBe(false);
    expect(status().textContent).toContain('network unreachable');
    expect(status().querySelector('button')).toBeTruthy();
  });

  it('retries loading the catalog when the retry button is clicked', async () => {
    listCatalog.mockResolvedValueOnce({ ok: false, error: 'network unreachable' });
    await mount();

    listCatalog.mockResolvedValueOnce({ ok: true, games: [BUNDLED_GAME] });
    status().querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(status().hidden).toBe(true);
    expect(cards()).toHaveLength(1);
  });
});

describe('rendering catalog cards', () => {
  it('renders a card per game with preview, title, tagline, and description', async () => {
    listCatalog.mockResolvedValue({ ok: true, games: [BUNDLED_GAME] });
    await mount();

    const card = cards()[0];
    expect(card.querySelector('.catalog-card__title')!.textContent).toBe('CircleTap');
    expect(card.querySelector('.catalog-card__tagline')!.textContent).toBe('Tap the circles');
    expect(card.querySelector('.catalog-card__description')!.textContent).toBe('A tapping game.');
    const img = card.querySelector('.catalog-card__preview') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(BUNDLED_GAME.previewDataUri);
  });

  it('shows an "Installed" badge with no action or remove button for a bundled default game', async () => {
    listCatalog.mockResolvedValue({ ok: true, games: [BUNDLED_GAME] });
    await mount();

    const card = cards()[0];
    expect(card.querySelector('.catalog-card__badge')!.textContent).toBe('Installed');
    expect(card.querySelector('.catalog-card__action')).toBeNull();
    expect(card.querySelector('.catalog-card__remove')).toBeNull();
  });

  it('shows an Install button with no badge or remove button for a game not yet installed', async () => {
    listCatalog.mockResolvedValue({ ok: true, games: [NOT_INSTALLED_GAME] });
    await mount();

    const card = cards()[0];
    expect(card.querySelector('.catalog-card__action')!.textContent).toBe('Install');
    expect(card.querySelector('.catalog-card__badge')).toBeNull();
    expect(card.querySelector('.catalog-card__remove')).toBeNull();
  });

  it('shows an "Installed" badge plus a Remove button for a gallery-installed, up-to-date game', async () => {
    listCatalog.mockResolvedValue({ ok: true, games: [INSTALLED_UP_TO_DATE_GAME] });
    await mount();

    const card = cards()[0];
    expect(card.querySelector('.catalog-card__badge')!.textContent).toBe('Installed');
    expect(card.querySelector('.catalog-card__action')).toBeNull();
    expect(card.querySelector('.catalog-card__remove')!.textContent).toBe('Remove');
  });

  it('shows an Update button plus a Remove button for a gallery-installed game with a newer catalog version', async () => {
    listCatalog.mockResolvedValue({ ok: true, games: [UPDATE_AVAILABLE_GAME] });
    await mount();

    const card = cards()[0];
    expect(card.querySelector('.catalog-card__action')!.textContent).toBe('Update');
    expect(card.querySelector('.catalog-card__remove')!.textContent).toBe('Remove');
  });
});

describe('installing a game', () => {
  it('calls installGame with the id and catalog version, then reloads the catalog on success', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [NOT_INSTALLED_GAME] });
    await mount();

    installGame.mockResolvedValue({ ok: true });
    listCatalog.mockResolvedValueOnce({ ok: true, games: [{ ...NOT_INSTALLED_GAME, installed: true, installedVersion: '0.1.0' }] });

    cards()[0].querySelector('.catalog-card__action')!.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(installGame).toHaveBeenCalledWith('meanwaile-maze', '0.1.0');
    expect(listCatalog).toHaveBeenCalledTimes(2);
    expect(cards()[0].querySelector('.catalog-card__badge')!.textContent).toBe('Installed');
  });

  it('disables the button and shows a busy label while the install is in flight', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [NOT_INSTALLED_GAME] });
    await mount();

    let resolveInstall!: (v: unknown) => void;
    installGame.mockReturnValue(new Promise((resolve) => { resolveInstall = resolve; }));

    const btn = cards()[0].querySelector('.catalog-card__action') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();

    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/installing/i);

    resolveInstall({ ok: true });
    listCatalog.mockResolvedValueOnce({ ok: true, games: [] });
    await Promise.resolve();
    await Promise.resolve();
  });

  it('reverts the button to "Install" with no error banner if that action is ever cancelled', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [NOT_INSTALLED_GAME] });
    await mount();

    installGame.mockResolvedValue({ ok: false, cancelled: true });

    const btn = cards()[0].querySelector('.catalog-card__action') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Install');
    expect(status().hidden).toBe(true);
  });

  it('reverts the button to "Update" (not "Install") if an update is ever cancelled', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [UPDATE_AVAILABLE_GAME] });
    await mount();

    installGame.mockResolvedValue({ ok: false, cancelled: true });

    const btn = cards()[0].querySelector('.catalog-card__action') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.textContent).toBe('Update');
  });

  it('shows "Updating…" (not "Installing…") while updating an already-installed game', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [UPDATE_AVAILABLE_GAME] });
    await mount();

    let resolveInstall!: (v: unknown) => void;
    installGame.mockReturnValue(new Promise((resolve) => { resolveInstall = resolve; }));

    const btn = cards()[0].querySelector('.catalog-card__action') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();

    expect(btn.textContent).toMatch(/updating/i);

    resolveInstall({ ok: false, error: 'network unreachable' });
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.textContent).toBe('Update');
    expect(btn.disabled).toBe(false);
  });

  it('shows the error and re-enables the button when the install fails', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [NOT_INSTALLED_GAME] });
    await mount();

    installGame.mockResolvedValue({ ok: false, error: 'Failed to download' });

    const btn = cards()[0].querySelector('.catalog-card__action') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(status().hidden).toBe(false);
    expect(status().textContent).toContain('Failed to download');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Install');
  });
});

describe('removing a game', () => {
  it('shows the error and re-enables the button (still reading "Remove") when the removal fails', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [INSTALLED_UP_TO_DATE_GAME] });
    await mount();

    uninstallGame.mockResolvedValue({ ok: false, error: 'permission denied' });

    const btn = cards()[0].querySelector('.catalog-card__remove') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(status().textContent).toContain('permission denied');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Remove');
  });

  it('calls uninstallGame with the id and name, then reloads the catalog on success', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [INSTALLED_UP_TO_DATE_GAME] });
    await mount();

    uninstallGame.mockResolvedValue({ ok: true });
    listCatalog.mockResolvedValueOnce({ ok: true, games: [{ ...NOT_INSTALLED_GAME, id: 'installed-game' }] });

    cards()[0].querySelector('.catalog-card__remove')!.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(uninstallGame).toHaveBeenCalledWith('installed-game', INSTALLED_UP_TO_DATE_GAME.name);
    expect(listCatalog).toHaveBeenCalledTimes(2);
    expect(cards()[0].querySelector('.catalog-card__action')!.textContent).toBe('Install');
  });

  it('reverts the button to "Remove" with no error banner when the confirmation is cancelled', async () => {
    listCatalog.mockResolvedValueOnce({ ok: true, games: [INSTALLED_UP_TO_DATE_GAME] });
    await mount();

    uninstallGame.mockResolvedValue({ ok: false, cancelled: true });

    const btn = cards()[0].querySelector('.catalog-card__remove') as HTMLButtonElement;
    btn.dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Remove');
    expect(status().hidden).toBe(true);
  });
});
