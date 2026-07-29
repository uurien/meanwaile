import { describe, it, expect } from 'vitest';
import { trayIconFileName, shouldPersistContextMenu } from '../src/tray-platform';

// macOS's setTemplateImage() auto-inverts a black silhouette to white on a
// dark menu bar. Linux desktop environments have no equivalent, so the same
// near-black icon renders invisibly on dark panels (e.g. Ubuntu's default
// Yaru dark top bar) — Linux needs a pre-inverted light asset instead.
describe('trayIconFileName', () => {
  it('returns the light icon on linux', () => {
    expect(trayIconFileName('linux')).toBe('tray-icon-linux.png');
  });

  it('returns the template-image icon on darwin', () => {
    expect(trayIconFileName('darwin')).toBe('tray-icon.png');
  });

  it('returns the template-image icon on win32', () => {
    expect(trayIconFileName('win32')).toBe('tray-icon.png');
  });
});

// GNOME/Ubuntu-style AppIndicator trays are menu-only: the shell never
// forwards click/right-click events to the app at all, so tray.on('click', …)
// is dead code there. The only thing that works is registering a menu via
// tray.setContextMenu(), which the shell then shows on any click. macOS and
// Windows must NOT get this treatment, since setContextMenu() there would
// hijack every click into showing the menu instead of toggling the popover.
describe('shouldPersistContextMenu', () => {
  it('is true on linux', () => {
    expect(shouldPersistContextMenu('linux')).toBe(true);
  });

  it('is false on darwin', () => {
    expect(shouldPersistContextMenu('darwin')).toBe(false);
  });

  it('is false on win32', () => {
    expect(shouldPersistContextMenu('win32')).toBe(false);
  });
});
