import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const ipcRenderer = {
    on: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
  };

  const contextBridge = {
    exposeInMainWorld: vi.fn(),
  };

  return { ipcRenderer, contextBridge };
});

vi.mock('electron', () => ({
  contextBridge: mocks.contextBridge,
  ipcRenderer: mocks.ipcRenderer,
}));

import '../src/preload';

function getExposedApi(): Record<string, (...args: unknown[]) => void> {
  const [, api] = vi.mocked(mocks.contextBridge.exposeInMainWorld).mock.calls[0] as [
    string,
    Record<string, (...args: unknown[]) => void>,
  ];
  return api;
}

describe('preload', () => {
  it('exposes meanwaile API with onStateChange, close, and settings methods', () => {
    expect(mocks.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'meanwaile',
      expect.objectContaining({
        onStateChange: expect.any(Function),
        close: expect.any(Function),
        openSettings: expect.any(Function),
        listGames: expect.any(Function),
        getSettings: expect.any(Function),
        saveSettings: expect.any(Function),
        openGallery: expect.any(Function),
        listCatalog: expect.any(Function),
        installGame: expect.any(Function),
        uninstallGame: expect.any(Function),
        onGamesChanged: expect.any(Function),
      }),
    );
  });

  it('onStateChange registers an IPC listener on state-change', () => {
    const cb = vi.fn();
    getExposedApi().onStateChange(cb);
    expect(mocks.ipcRenderer.on).toHaveBeenCalledWith('state-change', expect.any(Function));
  });

  it('onStateChange callback receives the snapshot when IPC fires', () => {
    const cb = vi.fn();
    getExposedApi().onStateChange(cb);
    const calls = vi.mocked(mocks.ipcRenderer.on).mock.calls.filter(
      ([channel]) => channel === 'state-change',
    );
    const ipcHandler = calls[calls.length - 1]![1] as (_event: unknown, snapshot: unknown) => void;
    const snapshot = { state: 'agent_working' };
    ipcHandler({}, snapshot);
    expect(cb).toHaveBeenCalledWith(snapshot);
  });

  it('close sends popover-close via ipcRenderer', () => {
    getExposedApi().close();
    expect(mocks.ipcRenderer.send).toHaveBeenCalledWith('popover-close');
  });

  it('openSettings sends open-settings via ipcRenderer', () => {
    getExposedApi().openSettings();
    expect(mocks.ipcRenderer.send).toHaveBeenCalledWith('open-settings');
  });

  it('listGames invokes games-list via ipcRenderer', () => {
    getExposedApi().listGames();
    expect(mocks.ipcRenderer.invoke).toHaveBeenCalledWith('games-list');
  });

  it('getSettings invokes settings-get via ipcRenderer', () => {
    getExposedApi().getSettings();
    expect(mocks.ipcRenderer.invoke).toHaveBeenCalledWith('settings-get');
  });

  it('saveSettings invokes settings-save with the given payload', () => {
    const payload = { httpPort: 4000, autoOpenDelaySeconds: 20 };
    getExposedApi().saveSettings(payload);
    expect(mocks.ipcRenderer.invoke).toHaveBeenCalledWith('settings-save', payload);
  });

  it('openGallery sends open-gallery via ipcRenderer', () => {
    getExposedApi().openGallery();
    expect(mocks.ipcRenderer.send).toHaveBeenCalledWith('open-gallery');
  });

  it('listCatalog invokes gallery-list via ipcRenderer', () => {
    getExposedApi().listCatalog();
    expect(mocks.ipcRenderer.invoke).toHaveBeenCalledWith('gallery-list');
  });

  it('installGame invokes gallery-install with the given id and version', () => {
    getExposedApi().installGame('meanwaile-maze', '0.1.0');
    expect(mocks.ipcRenderer.invoke).toHaveBeenCalledWith('gallery-install', 'meanwaile-maze', '0.1.0');
  });

  it('uninstallGame invokes gallery-uninstall with the given id and name', () => {
    getExposedApi().uninstallGame('meanwaile-maze', 'Meanwaile Maze');
    expect(mocks.ipcRenderer.invoke).toHaveBeenCalledWith('gallery-uninstall', 'meanwaile-maze', 'Meanwaile Maze');
  });

  it('onGamesChanged registers an IPC listener on games-changed', () => {
    const cb = vi.fn();
    getExposedApi().onGamesChanged(cb);
    expect(mocks.ipcRenderer.on).toHaveBeenCalledWith('games-changed', expect.any(Function));
  });

  it('onGamesChanged callback fires when IPC fires', () => {
    const cb = vi.fn();
    getExposedApi().onGamesChanged(cb);
    const calls = vi.mocked(mocks.ipcRenderer.on).mock.calls.filter(([channel]) => channel === 'games-changed');
    const ipcHandler = calls[calls.length - 1]![1] as (_event: unknown) => void;
    ipcHandler({});
    expect(cb).toHaveBeenCalled();
  });
});
