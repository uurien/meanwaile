// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHub } from '../../src/popover/carousel.js';

const GAMES = [
  {
    id: 'circle-tap',
    name: 'CircleTap',
    tagline: 'Toca los círculos',
    entry: 'circle-tap/index.html',
    preview: 'circle-tap/preview.png',
    implemented: true,
    removable: false,
  },
  {
    id: 'game-2',
    name: 'Juego 2',
    tagline: 'Próximamente',
    entry: null,
    preview: null,
    implemented: false,
    removable: true,
  },
];

let container: HTMLElement;
let onOpenGame: ReturnType<typeof vi.fn>;
let onOpenMarketplace: ReturnType<typeof vi.fn>;
let onUninstallGame: ReturnType<typeof vi.fn>;

function build(games = GAMES) {
  document.body.innerHTML = '<div id="hub-screen"></div>';
  container = document.getElementById('hub-screen')!;
  onOpenGame = vi.fn();
  onOpenMarketplace = vi.fn();
  onUninstallGame = vi.fn();
  createHub({ container, games, onOpenGame, onOpenMarketplace, onUninstallGame });
}

function track(): HTMLElement {
  return container.querySelector('#carousel-track')!;
}

function prevBtn(): HTMLButtonElement {
  return container.querySelector('#prev-btn')!;
}

function nextBtn(): HTMLButtonElement {
  return container.querySelector('#next-btn')!;
}

function dots(): HTMLElement[] {
  return Array.from(container.querySelectorAll('#dots .dot'));
}

function carouselCards(): HTMLElement[] {
  return Array.from(track().querySelectorAll('.game-card'));
}

function marketplaceCard(): HTMLElement {
  return track().querySelector('.marketplace-card')!;
}

function fireDrag(deltaX: number) {
  const viewport = container.querySelector('#carousel-viewport')!;
  viewport.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
  viewport.dispatchEvent(new PointerEvent('pointermove', { clientX: deltaX, bubbles: true }));
  viewport.dispatchEvent(new PointerEvent('pointerup', { clientX: deltaX, bubbles: true }));
}

beforeEach(() => {
  localStorage.clear();
  build();
});

describe('carousel cards', () => {
  it('renders one card per game with eyebrow, title, tagline, and its own preview image', () => {
    const cards = carouselCards();
    expect(cards).toHaveLength(2);

    expect(cards[0].querySelector('.game-card__eyebrow')!.textContent).toBe('Game 1 of 2');
    expect(cards[0].querySelector('.game-card__title')!.textContent).toBe('CircleTap');
    expect(cards[0].querySelector('.game-card__tagline')!.textContent).toBe('Toca los círculos');
    const preview = cards[0].querySelector('.game-card__preview') as HTMLImageElement;
    expect(preview.tagName).toBe('IMG');
    expect(preview.getAttribute('src')).toBe('circle-tap/preview.png');

    expect(cards[1].querySelector('.game-card__eyebrow')!.textContent).toBe('Game 2 of 2');
    expect(cards[1].querySelector('.game-card__title')!.textContent).toBe('Juego 2');
  });

  it('renders a placeholder box instead of an image for a game with no preview yet', () => {
    const cards = carouselCards();
    const preview = cards[1].querySelector('.game-card__preview')!;
    expect(preview.tagName).toBe('DIV');
    expect(preview.classList.contains('game-card__preview--empty')).toBe(true);
  });

  it('calls onOpenGame with the matching game when a card Start button is clicked', () => {
    const cards = carouselCards();
    (cards[1].querySelector('.game-card__start') as HTMLButtonElement).click();
    expect(onOpenGame).toHaveBeenCalledWith(GAMES[1]);
  });
});

describe('uninstall button on removable cards', () => {
  it('is not rendered for a card whose game is not removable', () => {
    const cards = carouselCards();
    expect(cards[0].querySelector('.game-card__uninstall')).toBeNull();
  });

  it('is rendered for a card whose game is removable, as a trash icon (not text)', () => {
    const cards = carouselCards();
    const btn = cards[1].querySelector('.game-card__uninstall')!;
    expect(btn).toBeTruthy();
    expect(btn.querySelector('svg')).toBeTruthy();
    expect(btn.textContent).toBe('');
  });

  it('calls onUninstallGame with the game, not onOpenGame, when clicked', () => {
    const cards = carouselCards();
    (cards[1].querySelector('.game-card__uninstall') as HTMLButtonElement).click();
    expect(onUninstallGame).toHaveBeenCalledWith(GAMES[1]);
    expect(onOpenGame).not.toHaveBeenCalled();
  });
});

describe('marketplace card', () => {
  it('renders a trailing card after the games, not counted among .game-card elements', () => {
    expect(carouselCards()).toHaveLength(2);
    expect(marketplaceCard()).toBeTruthy();
  });

  it('calls onOpenMarketplace, not onOpenGame, when its button is clicked', () => {
    marketplaceCard().querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onOpenMarketplace).toHaveBeenCalledTimes(1);
    expect(onOpenGame).not.toHaveBeenCalled();
  });

  it('does not persist a last-played game id when opened', () => {
    marketplaceCard().querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }));
    expect(localStorage.getItem('hub-last-game')).toBeNull();
  });

  it('gets its own trailing dot, reachable by clicking it', () => {
    const d = dots();
    expect(d).toHaveLength(3);
    d[2].click();
    expect(d[2].classList.contains('dot--active')).toBe(true);
    expect(track().style.transform).toBe('translateX(-512px)');
  });
});

describe('arrow navigation', () => {
  it('starts with prev disabled and next enabled at the first card', () => {
    expect(prevBtn().disabled).toBe(true);
    expect(nextBtn().disabled).toBe(false);
  });

  it('advances to the next card and updates the track position', () => {
    nextBtn().click();
    expect(track().style.transform).toBe('translateX(-216px)');
    expect(prevBtn().disabled).toBe(false);
    expect(nextBtn().disabled).toBe(false);
  });

  it('does not advance past the trailing marketplace card', () => {
    nextBtn().click();
    nextBtn().click();
    nextBtn().click();
    expect(track().style.transform).toBe('translateX(-512px)');
    expect(nextBtn().disabled).toBe(true);
  });

  it('goes back to the first card with prev', () => {
    nextBtn().click();
    prevBtn().click();
    expect(track().style.transform).toBe('translateX(80px)');
    expect(prevBtn().disabled).toBe(true);
  });
});

describe('dot pagination', () => {
  it('renders one dot per game plus one for the trailing marketplace card, with the first marked active', () => {
    const d = dots();
    expect(d).toHaveLength(3);
    expect(d[0].classList.contains('dot--active')).toBe(true);
    expect(d[1].classList.contains('dot--active')).toBe(false);
    expect(d[2].classList.contains('dot--active')).toBe(false);
  });

  it('clicking a dot jumps directly to that game', () => {
    dots()[1].click();
    expect(track().style.transform).toBe('translateX(-216px)');
    expect(dots()[1].classList.contains('dot--active')).toBe(true);
    expect(dots()[0].classList.contains('dot--active')).toBe(false);
  });
});

describe('drag to swipe', () => {
  it('advances to the next card when dragged past the 60px threshold to the left', () => {
    fireDrag(-61);
    expect(track().style.transform).toBe('translateX(-216px)');
  });

  it('goes to the previous card when dragged past the 60px threshold to the right', () => {
    nextBtn().click();
    fireDrag(61);
    expect(track().style.transform).toBe('translateX(80px)');
  });

  it('snaps back without changing card when the drag stays under the threshold', () => {
    fireDrag(59);
    expect(track().style.transform).toBe('translateX(80px)');
  });

  it('ignores pointermove when there is no active drag (no prior pointerdown)', () => {
    const viewport = container.querySelector('#carousel-viewport')!;
    const before = track().style.transform;
    viewport.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, bubbles: true }));
    expect(track().style.transform).toBe(before);
  });

  it('ignores pointerup/pointerleave when there is no active drag (no prior pointerdown)', () => {
    const viewport = container.querySelector('#carousel-viewport')!;
    const before = track().style.transform;
    viewport.dispatchEvent(new PointerEvent('pointerup', { clientX: 50, bubbles: true }));
    viewport.dispatchEvent(new PointerEvent('pointerleave', { clientX: 50, bubbles: true }));
    expect(track().style.transform).toBe(before);
  });
});

describe('remembering the last played game', () => {
  it('stores the game id when its Start button is clicked', () => {
    const cards = carouselCards();
    (cards[1].querySelector('.game-card__start') as HTMLButtonElement).click();
    expect(localStorage.getItem('hub-last-game')).toBe('game-2');
  });

  it('reopens on the last played game instead of resetting to the first card', () => {
    localStorage.setItem('hub-last-game', 'game-2');
    build();

    expect(track().style.transform).toBe('translateX(-216px)');
    expect(dots()[1].classList.contains('dot--active')).toBe(true);
    expect(prevBtn().disabled).toBe(false);
    expect(nextBtn().disabled).toBe(false);
  });

  it('does not animate the jump to the restored card on mount', () => {
    localStorage.setItem('hub-last-game', 'game-2');
    build();

    expect(track().style.transition).toBe('none');
  });

  it('still animates normal navigation after mounting on a restored card', () => {
    localStorage.setItem('hub-last-game', 'game-2');
    build();

    prevBtn().click();
    expect(track().style.transition).toBe('transform 0.35s cubic-bezier(0.2,0.8,0.2,1)');
  });

  it('falls back to the first card when the stored id no longer matches a game', () => {
    localStorage.setItem('hub-last-game', 'no-longer-in-registry');
    build();

    expect(track().style.transform).toBe('translateX(80px)');
    expect(dots()[0].classList.contains('dot--active')).toBe(true);
  });
});
