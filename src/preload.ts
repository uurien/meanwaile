import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('meanwaile', {
  onStateChange(cb: (snapshot: unknown) => void): void {
    ipcRenderer.on('state-change', (_event, snapshot) => cb(snapshot));
  },
  close(): void {
    ipcRenderer.send('popover-close');
  },
});
