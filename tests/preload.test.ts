import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const ipcRenderer = {
    on: vi.fn(),
    send: vi.fn(),
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
  it('exposes meanwaile API with onStateChange and close', () => {
    expect(mocks.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'meanwaile',
      expect.objectContaining({
        onStateChange: expect.any(Function),
        close: expect.any(Function),
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
});
