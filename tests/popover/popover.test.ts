// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Hub-mechanics tests shouldn't depend on which games are currently
// implemented in the real registry - stub it with one implemented and one
// not-yet-built game so both code paths stay covered regardless of roster.
vi.mock('../../src/games/registry.js', () => ({
  GAMES: [
    {
      id: 'circle-tap',
      name: 'CircleTap',
      tagline: 'Toca los círculos',
      entry: '../games/circle-tap/index.html',
      preview: '../games/circle-tap/preview.png',
      implemented: true,
    },
    {
      id: 'placeholder-game',
      name: 'Placeholder',
      tagline: 'Próximamente',
      entry: null,
      preview: null,
      implemented: false,
    },
  ],
}));

let iframePostMessage: ReturnType<typeof vi.fn>;
let iframeFocus: ReturnType<typeof vi.fn>;
let meanwaileClose: ReturnType<typeof vi.fn>;
let triggerStateChange: (snapshot: { state: string; sessionId?: string | null; agentName?: string | null }) => void;
let overlay: HTMLElement;
let overlayMsg: HTMLElement;
let continueBtn: HTMLElement;
let settingsBtn: HTMLElement;
let backBtn: HTMLElement;
let brand: HTMLElement;
let gameName: HTMLElement;
let hubScreen: HTMLElement;
let gameScreen: HTMLElement;
let gameArea: HTMLElement;
let placeholder: HTMLElement;
let placeholderText: HTMLElement;
let iframe: HTMLIFrameElement;
let meanwaileOpenSettings: ReturnType<typeof vi.fn>;

function hubStartButtons(): HTMLButtonElement[] {
  return Array.from(hubScreen.querySelectorAll('.game-card__start'));
}

// The carousel renders one card per game, in registry order.
function openGameViaCarousel(gameIndex: number) {
  const buttons = hubStartButtons();
  buttons[gameIndex].click();
}

beforeAll(async () => {
  const html = readFileSync(join(__dirname, '../../src/popover/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  iframePostMessage = vi.fn();
  iframeFocus = vi.fn();
  iframe = document.getElementById('game') as HTMLIFrameElement;
  Object.defineProperty(iframe, 'contentWindow', {
    get: () => ({ postMessage: iframePostMessage, focus: iframeFocus }),
    configurable: true,
  });

  meanwaileClose = vi.fn();
  meanwaileOpenSettings = vi.fn();
  Object.defineProperty(window, 'meanwaile', {
    value: {
      close: meanwaileClose,
      openSettings: meanwaileOpenSettings,
      onStateChange(cb: (snapshot: unknown) => void) {
        triggerStateChange = cb as (snapshot: { state: string }) => void;
      },
    },
    configurable: true,
  });

  await import('../../src/popover/popover.js');

  overlay = document.getElementById('overlay')!;
  overlayMsg = document.getElementById('overlay-msg')!;
  continueBtn = document.getElementById('continue-btn')!;
  settingsBtn = document.getElementById('settings-btn')!;
  backBtn = document.getElementById('back-btn')!;
  brand = document.getElementById('brand')!;
  gameName = document.getElementById('game-name')!;
  hubScreen = document.getElementById('hub-screen')!;
  gameScreen = document.getElementById('game-screen')!;
  gameArea = document.getElementById('game-area')!;
  placeholder = document.getElementById('placeholder')!;
  placeholderText = document.getElementById('placeholder-text')!;
});

describe('initial hub screen', () => {
  it('shows the hub with the app brand, not a game', () => {
    expect(hubScreen.hidden).toBe(false);
    expect(gameScreen.hidden).toBe(true);
    expect(brand.hidden).toBe(false);
    expect(backBtn.hidden).toBe(true);
    expect(gameName.hidden).toBe(true);
  });

  it('renders a Start button for every registered game', () => {
    expect(hubStartButtons()).toHaveLength(2);
  });
});

describe('opening a game from the hub', () => {
  it('switches to the game screen, mounts the iframe, and shows the header back button + game name', () => {
    openGameViaCarousel(0);

    expect(hubScreen.hidden).toBe(true);
    expect(gameScreen.hidden).toBe(false);
    expect(brand.hidden).toBe(true);
    expect(backBtn.hidden).toBe(false);
    expect(gameName.hidden).toBe(false);
    expect(gameName.textContent).toBe('CircleTap');
    expect(iframe.src).toContain('circle-tap/index.html');
  });

  it('shows the "Ready to play?" / Start overlay eagerly for an implemented game', () => {
    expect(overlay.style.display).toBe('flex');
    expect(overlayMsg.textContent).toBe('Ready to play?');
    expect(continueBtn.textContent).toBe('Start');
  });

  it('hides the placeholder block while an implemented game is open', () => {
    expect(gameArea.hidden).toBe(false);
    expect(placeholder.hidden).toBe(true);
  });
});

describe('going back to the hub', () => {
  it('returns to the hub screen and unmounts the game', () => {
    backBtn.click();

    expect(hubScreen.hidden).toBe(false);
    expect(gameScreen.hidden).toBe(true);
    expect(brand.hidden).toBe(false);
    expect(backBtn.hidden).toBe(true);
    expect(iframe.src).not.toContain('circle-tap');
  });
});

describe('opening the not-yet-built second game', () => {
  it('shows the placeholder screen instead of an iframe', () => {
    openGameViaCarousel(1);

    expect(gameScreen.hidden).toBe(false);
    expect(gameName.textContent).toBe('Placeholder');
    expect(gameArea.hidden).toBe(true);
    expect(placeholder.hidden).toBe(false);
    expect(placeholderText.textContent).toContain('Placeholder');
  });

  it('goes back to the hub from the placeholder too', () => {
    backBtn.click();
    expect(hubScreen.hidden).toBe(false);
    expect(gameScreen.hidden).toBe(true);
  });
});

// Everything below re-enters CircleTap and exercises the agent-driven
// pause/resume overlay exactly as it worked before the hub existed — it's
// the app's core mechanic (see AGENTS.md) and must keep behaving identically
// once a real game is open, regardless of how the user navigated there.
describe('inside a game: agent-driven pause/resume', () => {
  beforeAll(() => {
    openGameViaCarousel(0);
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
      overlay.style.display = 'none';
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(overlay.style.display).toBe('flex');
      expect(overlayMsg.textContent).toBe('Ready to play?');
      expect(continueBtn.textContent).toBe('Start');
    });

    it('focuses the Start button when reopening, not the settings gear icon', () => {
      overlay.style.display = 'none';
      settingsBtn.focus();
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.activeElement).toBe(continueBtn);
    });
  });

  describe('window focus', () => {
    // main.ts calls win.focus() on every showPopover(), and Chromium resets
    // keyboard focus to the first focusable element (the gear icon) whenever
    // the window regains OS focus - even if the overlay already focused Start
    // earlier. This must be re-asserted on the window's native focus event,
    // not just when the overlay is first shown.
    it('re-focuses Start if focus had moved elsewhere before the popover regains OS focus', () => {
      overlay.style.display = 'flex';
      settingsBtn.focus();
      expect(document.activeElement).toBe(settingsBtn);

      window.dispatchEvent(new Event('focus'));
      expect(document.activeElement).toBe(continueBtn);
    });

    it('does not steal focus on window focus when the overlay is hidden', () => {
      overlay.style.display = 'none';
      settingsBtn.focus();

      window.dispatchEvent(new Event('focus'));
      expect(document.activeElement).toBe(settingsBtn);
    });
  });

  describe('before the first start', () => {
    it('agent_working does not hide the overlay or resume the game — the player has not started yet', () => {
      iframePostMessage.mockClear();
      overlay.style.display = 'flex';
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      triggerStateChange({ state: 'agent_working' });
      expect(overlay.style.display).toBe('flex');
      expect(iframePostMessage).not.toHaveBeenCalledWith({ type: 'game:resume' }, '*');
      triggerStateChange({ state: 'idle' }); // reset currentState for the tests below
    });
  });

  describe('settings button', () => {
    it('opens the settings window without closing the popover', () => {
      settingsBtn.click();
      expect(meanwaileOpenSettings).toHaveBeenCalledOnce();
    });
  });

  describe('start button', () => {
    it('hides the overlay and sends game:resume on click, marking the game as started', () => {
      overlay.style.display = 'flex';
      iframePostMessage.mockClear();
      iframeFocus.mockClear();
      continueBtn.click();
      expect(overlay.style.display).toBe('none');
      expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:resume' }, '*');
    });

    it('moves focus into the iframe so keyboard input (e.g. Space) reaches the game', () => {
      overlay.style.display = 'flex';
      iframeFocus.mockClear();
      continueBtn.click();
      expect(iframeFocus).toHaveBeenCalledOnce();
    });

    it('shows "Paused" / Continue from now on, even after reopening', () => {
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
      overlay.style.display = 'flex';
      iframePostMessage.mockClear();
      iframeFocus.mockClear();
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      triggerStateChange({ state: 'agent_working' });
      expect(overlay.style.display).toBe('none');
      expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:resume' }, '*');
      expect(iframeFocus).toHaveBeenCalledOnce();
    });

    it('agent_working does not resume game when document is hidden', () => {
      iframePostMessage.mockClear();
      iframeFocus.mockClear();
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      triggerStateChange({ state: 'idle' });
      triggerStateChange({ state: 'agent_working' });
      expect(iframePostMessage).not.toHaveBeenCalledWith({ type: 'game:resume' }, '*');
      expect(iframeFocus).not.toHaveBeenCalled();
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });

    it('needs_user pauses game and shows overlay', () => {
      overlay.style.display = 'none';
      iframePostMessage.mockClear();
      triggerStateChange({ state: 'needs_user' });
      expect(overlay.style.display).toBe('flex');
      expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
    });

    it('idle pauses game and shows overlay', () => {
      overlay.style.display = 'none';
      iframePostMessage.mockClear();
      triggerStateChange({ state: 'idle' });
      expect(overlay.style.display).toBe('flex');
      expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
    });

    it('does nothing when the same state is received twice', () => {
      triggerStateChange({ state: 'needs_user' });
      iframePostMessage.mockClear();
      const displayBefore = overlay.style.display;
      triggerStateChange({ state: 'needs_user' });
      expect(iframePostMessage).not.toHaveBeenCalled();
      expect(overlay.style.display).toBe(displayBefore);
    });
  });

  describe('pause reason text', () => {
    it('falls back to generic "Paused" when the reported sessionId is null', () => {
      triggerStateChange({ state: 'agent_working', sessionId: null });
      triggerStateChange({ state: 'idle', sessionId: null });
      expect(overlayMsg.textContent).toBe('Paused');
    });

    it('shows "Claude needs input" once a real Claude session reports needs_user', () => {
      triggerStateChange({ state: 'agent_working', sessionId: 'abc', agentName: 'Claude' });
      triggerStateChange({ state: 'needs_user', sessionId: 'abc', agentName: 'Claude' });
      expect(overlayMsg.textContent).toBe('Claude needs input');
    });

    it('shows "Claude finished" once a real Claude session reports idle', () => {
      triggerStateChange({ state: 'agent_working', sessionId: 'abc', agentName: 'Claude' });
      triggerStateChange({ state: 'idle', sessionId: 'abc', agentName: 'Claude' });
      expect(overlayMsg.textContent).toBe('Claude finished');
    });

    it('shows "Codex needs input" once a real Codex session reports needs_user', () => {
      triggerStateChange({ state: 'agent_working', sessionId: 'xyz', agentName: 'Codex' });
      triggerStateChange({ state: 'needs_user', sessionId: 'xyz', agentName: 'Codex' });
      expect(overlayMsg.textContent).toBe('Codex needs input');
    });

    it('shows "Codex finished" once a real Codex session reports idle', () => {
      triggerStateChange({ state: 'agent_working', sessionId: 'xyz', agentName: 'Codex' });
      triggerStateChange({ state: 'idle', sessionId: 'xyz', agentName: 'Codex' });
      expect(overlayMsg.textContent).toBe('Codex finished');
    });

    it('falls back to generic "Agent" wording if a session is reported without an agentName', () => {
      triggerStateChange({ state: 'agent_working', sessionId: 'abc', agentName: null });
      triggerStateChange({ state: 'idle', sessionId: 'abc', agentName: null });
      expect(overlayMsg.textContent).toBe('Agent finished');
    });
  });
});

// Both the visibilitychange listener and the onStateChange callback run
// unconditionally, whether or not a game is open - they guard themselves on
// activeGame?.implemented. These exercise that guard's "nothing is open"
// path, which the tests above (always run with a game open) never hit.
describe('guards when no game is active (hub screen)', () => {
  beforeAll(() => {
    backBtn.click();
  });

  it('visibilitychange does not show the overlay while on the hub', () => {
    overlay.style.display = 'none';
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay.style.display).toBe('none');
  });

  it('onStateChange does nothing while on the hub', () => {
    expect(() => triggerStateChange({ state: 'needs_user', sessionId: 'xyz' })).not.toThrow();
    expect(overlay.style.display).toBe('none');
  });
});
