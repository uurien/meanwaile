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
  },
  { id: 'game-2', name: 'Juego 2', tagline: 'Próximamente', entry: null, preview: null, implemented: false },
];

let container: HTMLElement;
let onOpenGame: ReturnType<typeof vi.fn>;

function build(games = GAMES) {
  document.body.innerHTML = '<div id="hub-screen"></div>';
  container = document.getElementById('hub-screen')!;
  onOpenGame = vi.fn();
  createHub({ container, games, onOpenGame });
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

function fireDrag(deltaX: number) {
  const viewport = container.querySelector('#carousel-viewport')!;
  viewport.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, bubbles: true }));
  viewport.dispatchEvent(new PointerEvent('pointermove', { clientX: deltaX, bubbles: true }));
  viewport.dispatchEvent(new PointerEvent('pointerup', { clientX: deltaX, bubbles: true }));
}

beforeEach(() => {
  build();
});

describe('carousel cards', () => {
  it('renders one card per game with eyebrow, title, tagline, and its own preview image', () => {
    const cards = carouselCards();
    expect(cards).toHaveLength(2);

    expect(cards[0].querySelector('.game-card__eyebrow')!.textContent).toBe('Juego 1 de 2');
    expect(cards[0].querySelector('.game-card__title')!.textContent).toBe('CircleTap');
    expect(cards[0].querySelector('.game-card__tagline')!.textContent).toBe('Toca los círculos');
    const preview = cards[0].querySelector('.game-card__preview') as HTMLImageElement;
    expect(preview.tagName).toBe('IMG');
    expect(preview.getAttribute('src')).toBe('circle-tap/preview.png');

    expect(cards[1].querySelector('.game-card__eyebrow')!.textContent).toBe('Juego 2 de 2');
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

describe('arrow navigation', () => {
  it('starts with prev disabled and next enabled at the first card', () => {
    expect(prevBtn().disabled).toBe(true);
    expect(nextBtn().disabled).toBe(false);
  });

  it('advances to the next card and updates the track position', () => {
    nextBtn().click();
    expect(track().style.transform).toBe('translateX(-246px)');
    expect(prevBtn().disabled).toBe(false);
    expect(nextBtn().disabled).toBe(true);
  });

  it('does not advance past the last card', () => {
    nextBtn().click();
    nextBtn().click();
    expect(track().style.transform).toBe('translateX(-246px)');
  });

  it('goes back to the first card with prev', () => {
    nextBtn().click();
    prevBtn().click();
    expect(track().style.transform).toBe('translateX(50px)');
    expect(prevBtn().disabled).toBe(true);
  });
});

describe('dot pagination', () => {
  it('renders one dot per game with the first marked active', () => {
    const d = dots();
    expect(d).toHaveLength(2);
    expect(d[0].classList.contains('dot--active')).toBe(true);
    expect(d[1].classList.contains('dot--active')).toBe(false);
  });

  it('clicking a dot jumps directly to that game', () => {
    dots()[1].click();
    expect(track().style.transform).toBe('translateX(-246px)');
    expect(dots()[1].classList.contains('dot--active')).toBe(true);
    expect(dots()[0].classList.contains('dot--active')).toBe(false);
  });
});

describe('drag to swipe', () => {
  it('advances to the next card when dragged past the 60px threshold to the left', () => {
    fireDrag(-61);
    expect(track().style.transform).toBe('translateX(-246px)');
  });

  it('goes to the previous card when dragged past the 60px threshold to the right', () => {
    nextBtn().click();
    fireDrag(61);
    expect(track().style.transform).toBe('translateX(50px)');
  });

  it('snaps back without changing card when the drag stays under the threshold', () => {
    fireDrag(59);
    expect(track().style.transform).toBe('translateX(50px)');
  });
});
