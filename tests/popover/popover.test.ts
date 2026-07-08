// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';

let iframePostMessage: ReturnType<typeof vi.fn>;
let meanwaileClose: ReturnType<typeof vi.fn>;
let triggerStateChange: (snapshot: { state: string }) => void;

beforeAll(async () => {
  document.body.innerHTML = `
    <div id="root">
      <iframe id="game"></iframe>
      <div id="overlay"></div>
      <button id="continue-btn"></button>
    </div>
  `;

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

  it('shows overlay when document becomes visible', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'none';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay.style.display).toBe('flex');
  });
});

describe('continue button', () => {
  it('hides overlay and resumes game on click', () => {
    const overlay = document.getElementById('overlay')!;
    overlay.style.display = 'flex';
    iframePostMessage.mockClear();
    document.getElementById('continue-btn')!.click();
    expect(overlay.style.display).toBe('none');
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:resume' }, '*');
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
});
