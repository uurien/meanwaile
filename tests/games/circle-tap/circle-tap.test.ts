// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const RECORD_KEY = 'circle-tap-record';

let requestAnimationFrame: ReturnType<typeof vi.fn>;
let cancelAnimationFrame: ReturnType<typeof vi.fn>;
let rafCallback: ((now: number) => void) | null;
let rafIdCounter: number;
let cells: HTMLElement[];
let scoreEl: HTMLElement;
let gameOverEl: HTMLElement;
let finalScoreEl: HTMLElement;
let recordEl: HTMLElement;

function runFrame(now: number) {
  const cb = rafCallback;
  rafCallback = null;
  cb!(now);
}

beforeAll(async () => {
  const html = readFileSync(join(__dirname, '../../../src/games/circle-tap/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  vi.spyOn(Math, 'random').mockReturnValue(0);

  rafIdCounter = 0;
  requestAnimationFrame = vi.fn((cb: (now: number) => void) => {
    rafCallback = cb;
    return ++rafIdCounter;
  });
  cancelAnimationFrame = vi.fn();
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: requestAnimationFrame,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    value: cancelAnimationFrame,
    configurable: true,
    writable: true,
  });

  await import('../../../src/games/circle-tap/circle-tap.js');

  cells = Array.from(document.querySelectorAll('.cell'));
  scoreEl = document.getElementById('score')!;
  gameOverEl = document.getElementById('game-over')!;
  finalScoreEl = document.getElementById('final-score')!;
  recordEl = document.getElementById('record-score')!;
});

describe('board setup', () => {
  it('creates 9 cells indexed 0-8, all inactive', () => {
    expect(cells).toHaveLength(9);
    cells.forEach((cell, i) => {
      expect(cell.dataset.index).toBe(String(i));
      expect(cell.classList.contains('active')).toBe(false);
    });
  });

  it('starts the score at 0 and the game-over overlay hidden', () => {
    expect(scoreEl.textContent).toBe('0');
    expect((gameOverEl as HTMLElement).hidden).toBe(true);
  });

  it('starts the render loop on load', () => {
    expect(requestAnimationFrame).toHaveBeenCalled();
  });
});

describe('game loop', () => {
  it('spawns a circle on the first frame', () => {
    runFrame(1000);
    expect(cells[0].classList.contains('active')).toBe(true);
    expect(cells[0].style.getPropertyValue('--progress')).not.toBe('');
  });
});

describe('clicking', () => {
  it('scores a point when clicking the active circle', () => {
    cells[0].click();
    expect(scoreEl.textContent).toBe('1');
    expect(cells[0].classList.contains('active')).toBe(false);
  });

  it('ends the game and shows score + record when clicking an inactive circle', () => {
    cells[1].click();
    expect((gameOverEl as HTMLElement).hidden).toBe(false);
    expect(finalScoreEl.textContent).toBe('1');
    expect(recordEl.textContent).toBe('1');
    expect(localStorage.getItem(RECORD_KEY)).toBe('1');
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('ignores clicks on cells once the game is over', () => {
    cancelAnimationFrame.mockClear();
    cells[2].click();
    expect(scoreEl.textContent).toBe('1');
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });
});

describe('pause/resume while game over', () => {
  it('resume() is a no-op while the game is over', () => {
    requestAnimationFrame.mockClear();
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

describe('restart', () => {
  it('resets the board and score when clicking the game-over overlay', () => {
    requestAnimationFrame.mockClear();
    gameOverEl.click();
    expect((gameOverEl as HTMLElement).hidden).toBe(true);
    expect(scoreEl.textContent).toBe('0');
    cells.forEach((cell) => expect(cell.classList.contains('active')).toBe(false));
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('keeps the previous record when the new run scores lower', () => {
    cells[3].click(); // no circle active yet -> immediate game over, score 0
    expect(finalScoreEl.textContent).toBe('0');
    expect(recordEl.textContent).toBe('1');
    expect(localStorage.getItem(RECORD_KEY)).toBe('1');
  });
});

describe('pause/resume via postMessage', () => {
  it('restarts after the low-score game over', () => {
    gameOverEl.click();
    expect((gameOverEl as HTMLElement).hidden).toBe(true);
  });

  it('pause cancels the running frame', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:pause' } }));
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('ignores clicks while paused, without ending the game', () => {
    cells[0].click();
    expect((gameOverEl as HTMLElement).hidden).toBe(true);
    expect(scoreEl.textContent).toBe('0');
  });

  it('resume restarts the render loop', () => {
    requestAnimationFrame.mockClear();
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('resume is a no-op if already running', () => {
    requestAnimationFrame.mockClear();
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('ignores unrelated message types', () => {
    expect(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'something:else' } }));
    }).not.toThrow();
  });

  it('ignores messages without data', () => {
    expect(() => {
      window.dispatchEvent(new MessageEvent('message', { data: null }));
    }).not.toThrow();
  });
});

describe('game over from an unclicked, expiring circle', () => {
  it('ends the game inside the loop, without needing a click', () => {
    runFrame(10000); // spawns a circle
    expect(cells.some((cell) => cell.classList.contains('active'))).toBe(true);
    runFrame(10000 + 5000); // well past its green duration
    expect((gameOverEl as HTMLElement).hidden).toBe(false);
  });
});
