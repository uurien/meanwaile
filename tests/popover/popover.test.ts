// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

let iframePostMessage: ReturnType<typeof vi.fn>;
let meanwaileClose: ReturnType<typeof vi.fn>;
let triggerStateChange: (snapshot: { state: string }) => void;
let overlayMsg: HTMLElement;
let continueBtn: HTMLElement;

beforeAll(async () => {
  const html = readFileSync(join(__dirname, '../../src/popover/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  iframePostMessage = vi.fn();
  const iframe = document.getElementById('game') as HTMLIFrameElement;
  Object.defineProperty(iframe, 'contentWindow', {
    get: () => ({ postMessage: iframePostMessage }),
    configurable: true,
  });

  meanwaileClose = vi.fn();
  Object.defineProperty(window, 'meanwaile', {
    value: {
      close: meanwaileClose,
      onStateChange(cb: (snapshot: unknown) => void) {
        triggerStateChange = cb as (snapshot: { state: string }) => void;
      },
    },
    configurable: true,
  });

  await import('../../src/popover/popover.js');

  overlayMsg = document.getElementById('overlay-msg')!;
  continueBtn = document.getElementById('continue-btn')!;
});

describe('initial load', () => {
  it('shows the "Ready to play?" / Start overlay eagerly, without waiting for visibilitychange', () => {
    // The popover window starts with show:false and this script runs
    // immediately — Chromium doesn't reliably fire visibilitychange for the
    // very first hidden -> visible transition, so the overlay must already
    // be correct by the time main.ts calls win.show() for the first time.
    const overlay = document.getElementById('overlay')!;
    expect(overlay.style.display).toBe('flex');
    expect(overlayMsg.textContent).toBe('Ready to play?');
    expect(continueBtn.textContent).toBe('Start');
  });
});

describe('Escape key', () => {
  it('calls window.meanwaile.close()', () => {
    meanwaileClose.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(meanwaileClose).toHaveBeenCalledOnce();
  });

  it('does not close on other keys', () => {
    meanwaileClose.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(meanwaileClose).not.toHaveBeenCalled();
  });
});

describe('visibilitychange', () => {
  it('pauses game when document becomes hidden', () => {
    iframePostMessage.mockClear();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
  });

  it('shows a "Ready to play?" / Start overlay before the game has ever started', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'none';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay.style.display).toBe('flex');
    expect(overlayMsg.textContent).toBe('Ready to play?');
    expect(continueBtn.textContent).toBe('Start');
  });
});

describe('before the first start', () => {
  it('agent_working does not hide the overlay or resume the game — the player has not started yet', () => {
    iframePostMessage.mockClear();
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'flex';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    triggerStateChange({ state: 'agent_working' });
    expect(overlay.style.display).toBe('flex');
    expect(iframePostMessage).not.toHaveBeenCalledWith({ type: 'game:resume' }, '*');
    triggerStateChange({ state: 'idle' }); // reset currentState for the tests below
  });
});

describe('start button', () => {
  it('hides the overlay and sends game:resume on click, marking the game as started', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'flex';
    iframePostMessage.mockClear();
    continueBtn.click();
    expect(overlay.style.display).toBe('none');
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:resume' }, '*');
  });

  it('shows "Paused" / Continue from now on, even after reopening', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'none';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay.style.display).toBe('flex');
    expect(overlayMsg.textContent).toBe('Paused');
    expect(continueBtn.textContent).toBe('Continue');
  });
});

describe('state changes via onStateChange', () => {
  it('agent_working hides overlay and resumes game when visible', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'flex';
    iframePostMessage.mockClear();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    triggerStateChange({ state: 'agent_working' });
    expect(overlay.style.display).toBe('none');
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:resume' }, '*');
  });

  it('agent_working does not resume game when document is hidden', () => {
    iframePostMessage.mockClear();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    triggerStateChange({ state: 'idle' });
    triggerStateChange({ state: 'agent_working' });
    expect(iframePostMessage).not.toHaveBeenCalledWith({ type: 'game:resume' }, '*');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('needs_user pauses game and shows overlay', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'none';
    iframePostMessage.mockClear();
    triggerStateChange({ state: 'needs_user' });
    expect(overlay.style.display).toBe('flex');
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
  });

  it('idle pauses game and shows overlay', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'none';
    iframePostMessage.mockClear();
    triggerStateChange({ state: 'idle' });
    expect(overlay.style.display).toBe('flex');
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
  });

  it('does nothing when the same state is received twice', () => {
    triggerStateChange({ state: 'needs_user' });
    iframePostMessage.mockClear();
    const overlay = document.getElementById('overlay')!;
    const displayBefore = overlay.style.display;
    triggerStateChange({ state: 'needs_user' });
    expect(iframePostMessage).not.toHaveBeenCalled();
    expect(overlay.style.display).toBe(displayBefore);
  });
});
