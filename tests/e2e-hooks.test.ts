import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BrowserWindow, Tray } from 'electron';
import { installE2ETestHooks, type PopoverPlacement } from '../src/e2e-hooks';

// installE2ETestHooks wires a handful of test-only globals used by the
// Playwright E2E suite (it can't click a real OS tray icon). These exercise
// the wiring without Electron: a fake tray/window is enough.

function fakeTray(bounds = { x: 10, y: 20, width: 22, height: 22 }) {
  const handlers: Record<string, () => void> = {};
  return {
    emit: vi.fn((event: string) => handlers[event]?.()),
    on: (event: string, handler: () => void) => {
      handlers[event] = handler;
    },
    getBounds: vi.fn(() => bounds),
  } as unknown as Tray & { emit: ReturnType<typeof vi.fn> };
}

const placement: PopoverPlacement = {
  trayBounds: { x: 10, y: 20, width: 22, height: 22 },
  workArea: { x: 0, y: 0, width: 1440, height: 900 },
};

afterEach(() => {
  delete (global as { __meanwaile_e2e__?: unknown }).__meanwaile_e2e__;
  delete process.env.MEANWAILE_E2E;
});

describe('installE2ETestHooks', () => {
  it('installs nothing unless MEANWAILE_E2E is set', () => {
    installE2ETestHooks(fakeTray(), () => null, () => null);
    expect(global.__meanwaile_e2e__).toBeUndefined();
  });

  it('clickTray emits the tray "click" event', () => {
    process.env.MEANWAILE_E2E = '1';
    const tray = fakeTray();
    installE2ETestHooks(tray, () => null, () => null);

    global.__meanwaile_e2e__!.clickTray();

    expect(tray.emit).toHaveBeenCalledWith('click');
  });

  it('getTrayBounds proxies tray.getBounds()', () => {
    process.env.MEANWAILE_E2E = '1';
    installE2ETestHooks(fakeTray({ x: 1, y: 2, width: 3, height: 4 }), () => null, () => null);

    expect(global.__meanwaile_e2e__!.getTrayBounds()).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('getPopoverBounds returns null when there is no popover or it is destroyed', () => {
    process.env.MEANWAILE_E2E = '1';
    const destroyed = { isDestroyed: () => true, getBounds: () => ({ x: 0, y: 0, width: 1, height: 1 }) } as unknown as BrowserWindow;

    installE2ETestHooks(fakeTray(), () => null, () => null);
    expect(global.__meanwaile_e2e__!.getPopoverBounds()).toBeNull();

    installE2ETestHooks(fakeTray(), () => destroyed, () => null);
    expect(global.__meanwaile_e2e__!.getPopoverBounds()).toBeNull();
  });

  it('getPopoverBounds returns a live window\'s bounds', () => {
    process.env.MEANWAILE_E2E = '1';
    const win = {
      isDestroyed: () => false,
      getBounds: () => ({ x: 5, y: 6, width: 440, height: 540 }),
    } as unknown as BrowserWindow;

    installE2ETestHooks(fakeTray(), () => win, () => null);

    expect(global.__meanwaile_e2e__!.getPopoverBounds()).toEqual({ x: 5, y: 6, width: 440, height: 540 });
  });

  it('getPopoverPlacement passes through the placement recorded by showPopover()', () => {
    process.env.MEANWAILE_E2E = '1';
    installE2ETestHooks(fakeTray(), () => null, () => placement);

    expect(global.__meanwaile_e2e__!.getPopoverPlacement()).toBe(placement);
  });
});
