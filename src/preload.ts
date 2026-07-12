import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('meanwaile', {
  onStateChange(cb: (snapshot: unknown) => void): void {
    ipcRenderer.on('state-change', (_event, snapshot) => cb(snapshot));
  },
  close(): void {
    ipcRenderer.send('popover-close');
  },
  openSettings(): void {
    ipcRenderer.send('open-settings');
  },
  getSettings(): Promise<unknown> {
    return ipcRenderer.invoke('settings-get');
  },
  saveSettings(settings: unknown): Promise<unknown> {
    return ipcRenderer.invoke('settings-save', settings);
  },
});
