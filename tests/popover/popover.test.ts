// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Hub-mechanics tests shouldn't depend on which games are currently
// implemented in the real catalog - stub window.meanwaile.listGames() with
// one implemented and one not-yet-built game so both code paths stay
// covered regardless of roster.
const STUB_GAMES = [
  {
    id: 'circle-tap',
    name: 'CircleTap',
    tagline: 'Toca los círculos',
    entry: '../../games/circle-tap/index.html',
    preview: '../../games/circle-tap/preview.png',
    implemented: true,
    removable: false,
  },
  {
    id: 'placeholder-game',
    name: 'Placeholder',
    tagline: 'Próximamente',
    entry: null,
    preview: null,
    implemented: false,
    removable: true,
  },
];

let iframePostMessage: ReturnType<typeof vi.fn>;
let iframeFocus: ReturnType<typeof vi.fn>;
let meanwaileClose: ReturnType<typeof vi.fn>;
let triggerStateChange: (snapshot: { state: string; sessionId?: string | null; agentName?: string | null }) => void;
let overlay: HTMLElement;
let overlayMsg: HTMLElement;
let continueBtn: HTMLElement;
let settingsBtn: HTMLElement;
let galleryBtn: HTMLElement;
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
let meanwaileOpenGallery: ReturnType<typeof vi.fn>;
let meanwaileUninstallGame: ReturnType<typeof vi.fn>;
let meanwaileListGames: ReturnType<typeof vi.fn>;
let triggerGamesChanged: () => void;
let triggerActivityChange: (snapshot: unknown) => void;
let triggerAgentInterruption: (payload: unknown) => void;
let triggerPopoverView: (view: string) => void;
let activitySnapshot: {
  active: unknown[];
  recent: unknown[];
  counts: { active: number; working: number; needsUser: number; finished: number };
};
let menuBtn: HTMLElement;
let headerMenu: HTMLElement;
let tabsEl: HTMLElement;
let tabGames: HTMLElement;
let tabAgents: HTMLElement;
let agentsScreen: HTMLElement;

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
  meanwaileOpenGallery = vi.fn();
  meanwaileUninstallGame = vi.fn();
  meanwaileListGames = vi.fn(() => Promise.resolve(STUB_GAMES));
  activitySnapshot = { active: [], recent: [], counts: { active: 0, working: 0, needsUser: 0, finished: 0 } };
  Object.defineProperty(window, 'meanwaile', {
    value: {
      close: meanwaileClose,
      openSettings: meanwaileOpenSettings,
      openGallery: meanwaileOpenGallery,
      uninstallGame: meanwaileUninstallGame,
      listGames: meanwaileListGames,
      getActivity: () => Promise.resolve(activitySnapshot),
      getPopoverView: () => Promise.resolve('games'),
      onStateChange(cb: (snapshot: unknown) => void) {
        triggerStateChange = cb as (snapshot: { state: string }) => void;
      },
      onGamesChanged(cb: () => void) {
        triggerGamesChanged = cb;
      },
      onActivityChange(cb: (snapshot: unknown) => void) {
        triggerActivityChange = cb;
      },
      onAgentInterruption(cb: (payload: unknown) => void) {
        triggerAgentInterruption = cb;
      },
      onPopoverView(cb: (view: string) => void) {
        triggerPopoverView = cb;
      },
    },
    configurable: true,
  });

  await import('../../src/popover/popover.js');

  overlay = document.getElementById('overlay')!;
  overlayMsg = document.getElementById('overlay-msg')!;
  continueBtn = document.getElementById('continue-btn')!;
  settingsBtn = document.getElementById('settings-btn')!;
  galleryBtn = document.getElementById('gallery-btn')!;
  backBtn = document.getElementById('back-btn')!;
  brand = document.getElementById('brand')!;
  gameName = document.getElementById('game-name')!;
  hubScreen = document.getElementById('hub-screen')!;
  gameScreen = document.getElementById('game-screen')!;
  gameArea = document.getElementById('game-area')!;
  placeholder = document.getElementById('placeholder')!;
  placeholderText = document.getElementById('placeholder-text')!;
  menuBtn = document.getElementById('menu-btn')!;
  headerMenu = document.getElementById('header-menu')!;
  tabsEl = document.getElementById('tabs')!;
  tabGames = document.getElementById('tab-games')!;
  tabAgents = document.getElementById('tab-agents')!;
  agentsScreen = document.getElementById('agents-screen')!;
});

describe('game iframe sandboxing', () => {
  it('is sandboxed with scripts and same-origin only (top navigation, popups, forms, and modals stay blocked; network egress is closed by the per-bundle CSP instead, see injectGameCsp)', () => {
    const sandbox = iframe.getAttribute('sandbox');
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toMatch(/allow-(top-navigation|popups|forms|modals)\b/);
  });
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

  describe('gallery button', () => {
    it('opens the gallery window without closing the popover', () => {
      galleryBtn.click();
      expect(meanwaileOpenGallery).toHaveBeenCalledOnce();
    });

    it('also opens the gallery window from the trailing "Get more games" carousel card', () => {
      meanwaileOpenGallery.mockClear();
      const browseBtn = hubScreen.querySelector('.gallery-card__start') as HTMLButtonElement;
      browseBtn.click();
      expect(meanwaileOpenGallery).toHaveBeenCalledOnce();
    });
  });

  describe('uninstalling a removable game from its hub card', () => {
    it('calls window.meanwaile.uninstallGame with the game id', () => {
      const uninstallBtn = hubScreen.querySelector('.game-card__uninstall') as HTMLButtonElement;
      uninstallBtn.click();
      expect(meanwaileUninstallGame).toHaveBeenCalledWith('placeholder-game', 'Placeholder');
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

    it('re-pauses when a second agent reaches the same state the first one already reported', () => {
      // Reproduces the two-concurrent-agents bug: agent A finishing pauses
      // the game, the player resumes, then agent B finishes too. Both
      // reports look identical at the state-string level ('idle'), but they
      // carry different sessionIds and must not be deduped against each
      // other.
      triggerStateChange({ state: 'agent_working', sessionId: 'agent-a' });
      overlay.style.display = 'none';
      triggerStateChange({ state: 'idle', sessionId: 'agent-a' });
      expect(overlay.style.display).toBe('flex');

      overlay.style.display = 'none'; // player clicks Continue
      iframePostMessage.mockClear();
      triggerStateChange({ state: 'idle', sessionId: 'agent-b' });
      expect(overlay.style.display).toBe('flex');
      expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
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

describe('games-changed refresh (gallery install/remove while the popover is open)', () => {
  it('re-fetches the games list and re-renders the hub when games-changed fires', async () => {
    meanwaileListGames.mockClear();
    meanwaileListGames.mockResolvedValueOnce([
      ...STUB_GAMES,
      {
        id: 'meanwaile-maze',
        name: 'Meanwaile Maze',
        tagline: 'Find a way out',
        entry: 'file:///games/meanwaile-maze/index.html',
        preview: 'file:///games/meanwaile-maze/preview.png',
        implemented: true,
      },
    ]);

    triggerGamesChanged();
    await Promise.resolve();
    await Promise.resolve();

    expect(meanwaileListGames).toHaveBeenCalledTimes(1);
    expect(hubStartButtons()).toHaveLength(3);
  });
});

// ─── T07: Games / Agents popover ───────────────────────────────────────────

const activeExec = (over: Record<string, unknown>) => ({
  id: 'exec',
  adapterId: 'claude-code',
  agentName: 'Claude',
  status: 'working',
  startedAt: 1,
  updatedAt: 1,
  ...over,
});

function pushActivity(over: Partial<{ active: unknown[]; recent: unknown[]; counts: Record<string, number> }>) {
  triggerActivityChange({
    active: over.active ?? [],
    recent: over.recent ?? [],
    counts: over.counts ?? { active: 0, working: 0, needsUser: 0, finished: 0 },
  });
}

describe('header ··· menu', () => {
  beforeAll(() => {
    backBtn.click();
    if (headerMenu.hidden === false) menuBtn.click();
  });

  it('is collapsed by default and marks the trigger as a closed popup menu', () => {
    expect(headerMenu.hidden).toBe(true);
    expect(menuBtn.getAttribute('aria-haspopup')).toBe('true');
    expect(menuBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('contains exactly "Add game" and "Settings" as menu items — no Reply, no other actions', () => {
    const items = Array.from(headerMenu.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent);
    expect(items).toEqual(['Add game', 'Settings']);
  });

  it('opens on click, exposes aria-expanded, and moves focus into the menu', () => {
    menuBtn.click();
    expect(headerMenu.hidden).toBe(false);
    expect(menuBtn.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(galleryBtn);
  });

  it('toggles closed on a second click', () => {
    menuBtn.click();
    expect(headerMenu.hidden).toBe(true);
  });

  it('closes on Escape and returns focus to the trigger, without closing the popover', () => {
    menuBtn.click();
    meanwaileClose.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(headerMenu.hidden).toBe(true);
    expect(meanwaileClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(menuBtn);
  });

  it('closes on an outside click', () => {
    menuBtn.click();
    expect(headerMenu.hidden).toBe(false);
    document.body.click();
    expect(headerMenu.hidden).toBe(true);
  });

  it('still opens Settings and the gallery from the menu items', () => {
    meanwaileOpenSettings.mockClear();
    meanwaileOpenGallery.mockClear();
    menuBtn.click();
    settingsBtn.click();
    expect(meanwaileOpenSettings).toHaveBeenCalledOnce();
    expect(headerMenu.hidden).toBe(true);

    menuBtn.click();
    galleryBtn.click();
    expect(meanwaileOpenGallery).toHaveBeenCalledOnce();
    expect(headerMenu.hidden).toBe(true);
  });
});

describe('Games / Agents tabs', () => {
  beforeAll(() => {
    backBtn.click();
  });

  it('shows Games on the left, selected, with the hub visible on a normal open', () => {
    expect(tabGames.getAttribute('aria-selected')).toBe('true');
    expect(tabAgents.getAttribute('aria-selected')).toBe('false');
    expect(hubScreen.hidden).toBe(false);
    expect(agentsScreen.hidden).toBe(true);
    // Games precedes Agents in the DOM (left, then right).
    expect(tabGames.compareDocumentPosition(tabAgents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switches to the Agents panel on click and moves the roving tabindex', () => {
    tabAgents.click();
    expect(tabAgents.getAttribute('aria-selected')).toBe('true');
    expect(tabGames.getAttribute('aria-selected')).toBe('false');
    expect(agentsScreen.hidden).toBe(false);
    expect(hubScreen.hidden).toBe(true);
    expect(tabAgents.tabIndex).toBe(0);
    expect(tabGames.tabIndex).toBe(-1);
  });

  it('switches back to Games on click', () => {
    tabGames.click();
    expect(tabGames.getAttribute('aria-selected')).toBe('true');
    expect(hubScreen.hidden).toBe(false);
  });

  it('moves between tabs with Left/Right arrow keys and ignores other keys', () => {
    tabsEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabAgents.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabAgents);

    tabsEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabGames.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabGames);

    tabsEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(tabGames.getAttribute('aria-selected')).toBe('true');
  });

  it('hides the tabs while a game is open and restores them, on Games, when returning', () => {
    openGameViaCarousel(0);
    expect(tabsEl.hidden).toBe(true);
    expect(agentsScreen.hidden).toBe(true);

    backBtn.click();
    expect(tabsEl.hidden).toBe(false);
    expect(tabGames.getAttribute('aria-selected')).toBe('true');
  });
});

describe('Agents view rendering', () => {
  beforeAll(() => {
    backBtn.click();
    tabAgents.click();
  });

  it('renders the counters and one row per active execution, needs-you first', () => {
    pushActivity({
      active: [
        activeExec({ id: 'w1', status: 'working', updatedAt: 5 }),
        activeExec({ id: 'n1', status: 'needs_user', updatedAt: 3, projectName: 'website' }),
      ],
      recent: [{ id: 'r1', agentName: 'Codex', status: 'finished', finishedAt: 9 }],
      counts: { active: 2, working: 1, needsUser: 1, finished: 1 },
    });

    const rows = Array.from(agentsScreen.querySelectorAll('.agents-list .agent-row')) as HTMLElement[];
    expect(rows.map((r) => r.dataset.executionId)).toEqual(['n1', 'w1']);
    expect(rows[0].querySelector('.agent-row__label')?.textContent).toBe('Claude · website');
    expect(agentsScreen.querySelector('.agents-count[data-kind="needs"]')?.textContent?.trim()).toBe('1 needs you');
    expect(agentsScreen.querySelector('.agents-recent .agent-recent-row')?.textContent).toBe('Codex');
  });

  it('shows the designed empty state when nothing is active', () => {
    pushActivity({ active: [], recent: [], counts: { active: 0, working: 0, needsUser: 0, finished: 0 } });
    expect(agentsScreen.querySelector('.agents-empty')).not.toBeNull();
    expect(agentsScreen.querySelector('.agents-list')).toBeNull();
  });

  it('highlights a row when it is clicked', () => {
    pushActivity({
      active: [activeExec({ id: 'a' }), activeExec({ id: 'b' })],
      counts: { active: 2, working: 2, needsUser: 0, finished: 0 },
    });
    const rows = Array.from(agentsScreen.querySelectorAll('.agent-row')) as HTMLElement[];
    rows[1].click();
    const after = Array.from(agentsScreen.querySelectorAll('.agent-row')) as HTMLElement[];
    expect(after[1].classList.contains('agent-row--highlight')).toBe(true);
    expect(after[0].classList.contains('agent-row--highlight')).toBe(false);
  });
});

describe('agent interruption overlay', () => {
  beforeAll(() => {
    backBtn.click();
    openGameViaCarousel(0);
    overlay.style.display = 'flex';
    continueBtn.click(); // marks the game as started
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('pauses the running game and names a partial finish with the remaining worker count', () => {
    iframePostMessage.mockClear();
    triggerAgentInterruption({
      transition: 'finished',
      execution: { id: 'e1', agentName: 'Claude', projectName: 'website' },
      counts: { working: 2 },
    });
    expect(overlay.style.display).toBe('flex');
    expect(iframePostMessage).toHaveBeenCalledWith({ type: 'game:pause' }, '*');
    expect(overlayMsg.textContent).toBe('Claude · website finished — 2 agents still working');
  });

  it('uses the singular form when exactly one agent is still working', () => {
    triggerAgentInterruption({
      transition: 'finished',
      execution: { id: 'e1', agentName: 'Claude' },
      counts: { working: 1 },
    });
    expect(overlayMsg.textContent).toBe('Claude finished — 1 agent still working');
  });

  it('drops the suffix when no agent is left working', () => {
    triggerAgentInterruption({
      transition: 'finished',
      execution: { id: 'e2', agentName: 'Codex' },
      counts: { working: 0 },
    });
    expect(overlayMsg.textContent).toBe('Codex finished');
  });

  it('wording for a needs_user interruption', () => {
    triggerAgentInterruption({
      transition: 'needs_user',
      execution: { id: 'e3', agentName: 'Claude', projectName: 'api' },
      counts: { working: 1 },
    });
    expect(overlayMsg.textContent).toBe('Claude · api needs input');
  });

  it('falls back to "Agent" when the interruption carries no execution', () => {
    triggerAgentInterruption({ transition: 'finished', counts: { working: 0 } });
    expect(overlayMsg.textContent).toBe('Agent finished');
  });

  it('falls back to "Agent" when the execution has no agent name', () => {
    triggerAgentInterruption({ transition: 'finished', execution: { id: 'e-noname' }, counts: { working: 0 } });
    expect(overlayMsg.textContent).toBe('Agent finished');
  });

  it('requires an explicit Continue click to dismiss — which clears the interruption wording', () => {
    // Neutralise the carried-over aggregate state so the fallback wording is
    // the generic "Paused", not a stale per-session message.
    triggerStateChange({ state: 'agent_working', sessionId: null });
    triggerStateChange({ state: 'idle', sessionId: null });

    triggerAgentInterruption({
      transition: 'finished',
      execution: { id: 'e2', agentName: 'Codex' },
      counts: { working: 0 },
    });
    expect(overlayMsg.textContent).toBe('Codex finished');

    continueBtn.click();
    expect(overlay.style.display).toBe('none');

    overlay.style.display = 'none';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(overlay.style.display).toBe('flex');
    expect(overlayMsg.textContent).toBe('Paused');
  });

  it('a plain state change supersedes a pending interruption', () => {
    triggerAgentInterruption({
      transition: 'needs_user',
      execution: { id: 'e3', agentName: 'Claude' },
      counts: { working: 0 },
    });
    triggerStateChange({ state: 'agent_working', sessionId: 's-super' });
    triggerStateChange({ state: 'idle', sessionId: 's-super', agentName: 'Claude' });
    expect(overlayMsg.textContent).toBe('Claude finished');
  });

  it('on the hub, an interruption updates the Agents view but shows no overlay', () => {
    backBtn.click();
    overlay.style.display = 'none';
    expect(() =>
      triggerAgentInterruption({
        transition: 'finished',
        execution: { id: 'e9', agentName: 'Claude' },
        counts: { working: 0 },
      }),
    ).not.toThrow();
    expect(overlay.style.display).toBe('none');
  });
});

describe('notification / tray routing', () => {
  beforeAll(() => {
    backBtn.click();
  });

  it('routes "agents" to the Agents tab and "games" back to Games', () => {
    triggerPopoverView('agents');
    expect(tabAgents.getAttribute('aria-selected')).toBe('true');

    triggerPopoverView('games');
    expect(tabGames.getAttribute('aria-selected')).toBe('true');
  });

  it('focuses the highlighted Agents row when routed there after an interruption', () => {
    pushActivity({
      active: [activeExec({ id: 'route-target', status: 'needs_user' })],
      counts: { active: 1, working: 0, needsUser: 1, finished: 0 },
    });
    triggerAgentInterruption({
      transition: 'needs_user',
      execution: { id: 'route-target', agentName: 'Claude' },
      counts: { working: 0 },
    });
    triggerPopoverView('agents');

    const row = agentsScreen.querySelector('[data-execution-id="route-target"]') as HTMLElement;
    expect(document.activeElement).toBe(row);
  });

  it('does not yank the player out of a round already in progress', () => {
    openGameViaCarousel(0);
    continueBtn.click(); // started
    triggerPopoverView('agents');
    expect(gameScreen.hidden).toBe(false);
    expect(tabsEl.hidden).toBe(true);
  });

  it('a game that has not been started yet gives way to notification routing', () => {
    backBtn.click();
    openGameViaCarousel(0); // opened, not started
    triggerPopoverView('agents');
    expect(gameScreen.hidden).toBe(true);
    expect(tabAgents.getAttribute('aria-selected')).toBe('true');
  });
});
