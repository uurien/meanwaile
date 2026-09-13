// Single source of truth for IPC channel names shared between preload.ts and
// main.ts's ipcMain registrations, so a typo on either side is a compile
// error instead of a runtime failure.
export const CHANNELS = {
  stateChange: 'state-change',
  popoverClose: 'popover-close',
  openSettings: 'open-settings',
  gamesList: 'games-list',
  settingsGet: 'settings-get',
  settingsSave: 'settings-save',
  openGallery: 'open-gallery',
  galleryList: 'gallery-list',
  galleryInstall: 'gallery-install',
  galleryUninstall: 'gallery-uninstall',
  gamesChanged: 'games-changed',
  activityGet: 'activity-get',
  activityChange: 'activity-change',
  agentInterruption: 'agent-interruption',
  openPopover: 'open-popover',
  popoverView: 'popover-view',
  popoverViewGet: 'popover-view-get',
  notificationsStatus: 'notifications-status',
  serverStatus: 'server-status',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];
