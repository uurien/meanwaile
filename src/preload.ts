import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from './ipc-channels';
import type { StateSnapshot } from './state-machine';
import type { AppSettings, ValidationResult } from './settings-store';
import type { GameManifest } from './games-catalog';
import type { CatalogResult, GalleryInstallResult, GalleryUninstallResult } from './games-gallery';
import type { ExecutionSnapshot, AgentInterruptionPayload } from './execution-tracker';
import type { PopoverView, ServerStatus } from './main';

export interface MeanwaileApi {
  onStateChange(cb: (snapshot: StateSnapshot) => void): void;
  close(): void;
  openSettings(): void;
  listGames(): Promise<GameManifest[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<Record<keyof AppSettings, unknown>>): Promise<ValidationResult>;
  openGallery(): void;
  listCatalog(): Promise<CatalogResult>;
  installGame(id: string, version: string): Promise<GalleryInstallResult>;
  uninstallGame(id: string, name: string): Promise<GalleryUninstallResult>;
  onGamesChanged(cb: () => void): void;
  getActivity(): Promise<ExecutionSnapshot>;
  onActivityChange(cb: (snapshot: ExecutionSnapshot) => void): void;
  onAgentInterruption(cb: (payload: AgentInterruptionPayload) => void): void;
  openPopover(view: PopoverView): void;
  onPopoverView(cb: (view: PopoverView) => void): void;
  getPopoverView(): Promise<PopoverView>;
  getNotificationStatus(): Promise<{ supported: boolean }>;
  getServerStatus(): Promise<ServerStatus>;
}

const api: MeanwaileApi = {
  onStateChange(cb) {
    ipcRenderer.on(CHANNELS.stateChange, (_event, snapshot) => cb(snapshot));
  },
  close() {
    ipcRenderer.send(CHANNELS.popoverClose);
  },
  openSettings() {
    ipcRenderer.send(CHANNELS.openSettings);
  },
  listGames() {
    return ipcRenderer.invoke(CHANNELS.gamesList);
  },
  getSettings() {
    return ipcRenderer.invoke(CHANNELS.settingsGet);
  },
  saveSettings(settings) {
    return ipcRenderer.invoke(CHANNELS.settingsSave, settings);
  },
  openGallery() {
    ipcRenderer.send(CHANNELS.openGallery);
  },
  listCatalog() {
    return ipcRenderer.invoke(CHANNELS.galleryList);
  },
  installGame(id, version) {
    return ipcRenderer.invoke(CHANNELS.galleryInstall, id, version);
  },
  uninstallGame(id, name) {
    return ipcRenderer.invoke(CHANNELS.galleryUninstall, id, name);
  },
  onGamesChanged(cb) {
    ipcRenderer.on(CHANNELS.gamesChanged, () => cb());
  },
  getActivity() {
    return ipcRenderer.invoke(CHANNELS.activityGet);
  },
  onActivityChange(cb) {
    ipcRenderer.on(CHANNELS.activityChange, (_event, snapshot) => cb(snapshot));
  },
  onAgentInterruption(cb) {
    ipcRenderer.on(CHANNELS.agentInterruption, (_event, payload) => cb(payload));
  },
  openPopover(view) {
    ipcRenderer.send(CHANNELS.openPopover, view);
  },
  onPopoverView(cb) {
    ipcRenderer.on(CHANNELS.popoverView, (_event, view) => cb(view));
  },
  getPopoverView() {
    return ipcRenderer.invoke(CHANNELS.popoverViewGet);
  },
  getNotificationStatus() {
    return ipcRenderer.invoke(CHANNELS.notificationsStatus);
  },
  getServerStatus() {
    return ipcRenderer.invoke(CHANNELS.serverStatus);
  },
};

contextBridge.exposeInMainWorld('meanwaile', api);
