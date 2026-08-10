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
  listGames(): Promise<unknown> {
    return ipcRenderer.invoke('games-list');
  },
  getSettings(): Promise<unknown> {
    return ipcRenderer.invoke('settings-get');
  },
  saveSettings(settings: unknown): Promise<unknown> {
    return ipcRenderer.invoke('settings-save', settings);
  },
  openMarketplace(): void {
    ipcRenderer.send('open-marketplace');
  },
  listCatalog(): Promise<unknown> {
    return ipcRenderer.invoke('marketplace-list');
  },
  installGame(id: string, version: string): Promise<unknown> {
    return ipcRenderer.invoke('marketplace-install', id, version);
  },
  uninstallGame(id: string, name: string): Promise<unknown> {
    return ipcRenderer.invoke('marketplace-uninstall', id, name);
  },
  onGamesChanged(cb: () => void): void {
    ipcRenderer.on('games-changed', () => cb());
  },
});
