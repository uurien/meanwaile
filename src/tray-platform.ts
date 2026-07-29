// macOS's Tray#setTemplateImage() auto-inverts a black silhouette to white
// on a dark menu bar. Linux desktop environments have no equivalent, so the
// same near-black icon renders invisibly on dark panels (e.g. Ubuntu's
// default Yaru dark top bar) — ship a pre-inverted light asset for Linux.
export function trayIconFileName(platform: NodeJS.Platform): string {
  return platform === 'linux' ? 'tray-icon-linux.png' : 'tray-icon.png';
}

// GNOME/Ubuntu-style AppIndicator trays are menu-only: the shell never
// forwards click/right-click events to the app, so tray.on('click', …) is
// dead code there. The only thing that works is registering a menu via
// tray.setContextMenu(), which the shell shows on any click. macOS and
// Windows must not get this treatment — setContextMenu() there would hijack
// every click into showing the menu instead of toggling the popover.
export function shouldPersistContextMenu(platform: NodeJS.Platform): boolean {
  return platform === 'linux';
}
