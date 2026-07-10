import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BOARD_SIZE,
  greenDurationForElapsed,
  spawnIntervalForElapsed,
  maxConcurrentForElapsed,
  CircleTapEngine,
} from '../../../src/games/circle-tap/logic.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('greenDurationForElapsed', () => {
  it('starts at 1200ms', () => {
    expect(greenDurationForElapsed(0)).toBe(1200);
  });

  it('interpolates linearly to the midpoint', () => {
    expect(greenDurationForElapsed(22500)).toBe(800);
  });

  it('reaches the 400ms floor at the ramp end', () => {
    expect(greenDurationForElapsed(45000)).toBe(400);
  });

  it('clamps at the floor beyond the ramp', () => {
    expect(greenDurationForElapsed(90000)).toBe(400);
  });
});

describe('spawnIntervalForElapsed', () => {
  it('starts at 900ms', () => {
    expect(spawnIntervalForElapsed(0)).toBe(900);
  });

  it('reaches the 500ms floor at the ramp end', () => {
    expect(spawnIntervalForElapsed(45000)).toBe(500);
  });

  it('clamps at the floor beyond the ramp', () => {
    expect(spawnIntervalForElapsed(90000)).toBe(500);
  });
});

describe('maxConcurrentForElapsed', () => {
  it('is 2 from the start, so several circles can be active at once immediately', () => {
    expect(maxConcurrentForElapsed(0)).toBe(2);
    expect(maxConcurrentForElapsed(19999)).toBe(2);
  });

  it('is 3 from 20s onward', () => {
    expect(maxConcurrentForElapsed(20000)).toBe(3);
    expect(maxConcurrentForElapsed(100000)).toBe(3);
  });
});

describe('CircleTapEngine', () => {
  it('starts with an empty board and no score', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    expect(engine.cells).toHaveLength(BOARD_SIZE);
    expect(engine.cells.every((c) => c === null)).toBe(true);
    expect(engine.score).toBe(0);
    expect(engine.gameOver).toBe(false);
    expect(engine.elapsedMs).toBe(0);
  });

  it('defaults to Math.random when no rng is injected', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const engine = new CircleTapEngine();
    engine.tick(1000);
    expect(engine.activeCount()).toBe(1);
    expect(engine.cells[0]).not.toBeNull();
  });

  it('spawns the first circle on the first eligible tick', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    expect(engine.activeCount()).toBe(1);
    expect(engine.cells[0]).not.toBeNull();
  });

  it('picks the spawn cell among empty indices via rng', () => {
    const engine = new CircleTapEngine({ rng: () => 0.99 });
    engine.tick(16);
    expect(engine.activeCount()).toBe(1);
    expect(engine.cells[BOARD_SIZE - 1]).not.toBeNull();
  });

  it('spawns a second circle on its own over time, without the first being clicked', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16); // spawns cell 0
    expect(engine.activeCount()).toBe(1);
    engine.timeSinceSpawnMs = 1000; // pretend enough time passed since the last spawn
    engine.tick(1); // well before cell 0's ~1200ms duration expires
    expect(engine.activeCount()).toBe(2);
    expect(engine.cells[0]).not.toBeNull(); // still there — never clicked
  });

  it('does not spawn a third circle before maxConcurrent allows it', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16); // spawns cell 0
    engine.timeSinceSpawnMs = 1000;
    engine.tick(1); // spawns cell 1 too, room under maxConcurrent (2)
    expect(engine.activeCount()).toBe(2);
    engine.timeSinceSpawnMs = 1000;
    engine.tick(1); // maxConcurrent (2) already reached, no 3rd spawn
    expect(engine.activeCount()).toBe(2);
  });

  it('does not spawn again before the spawn interval elapses, even with room under maxConcurrent', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16); // spawns one circle, resets timeSinceSpawnMs, room for a 2nd
    expect(engine.activeCount()).toBe(1);
    engine.tick(10); // well under spawnIntervalForElapsed
    expect(engine.activeCount()).toBe(1);
  });

  it('never exceeds maxConcurrent, so the board can never actually fill up', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    for (let i = 0; i < 3; i++) {
      engine.cells[i] = { activatedAt: 0, expiresAt: 999999, durationMs: 999999 };
    }
    engine.elapsedMs = 30000; // maxConcurrent tier is 3 here
    engine.timeSinceSpawnMs = Infinity;
    engine.tick(1);
    expect(engine.gameOver).toBe(false);
    expect(engine.activeCount()).toBe(3);
  });

  it('ends the game when a circle expires unclicked', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16); // spawns with ~1200ms duration
    engine.tick(5000); // well past expiry
    expect(engine.gameOver).toBe(true);
  });

  it('does nothing on tick once the game is over', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    engine.tick(5000);
    expect(engine.gameOver).toBe(true);
    const elapsedAtGameOver = engine.elapsedMs;
    engine.tick(1000);
    expect(engine.elapsedMs).toBe(elapsedAtGameOver);
  });

  it('scores a point and clears the cell when clicking an active circle', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    engine.click(0);
    expect(engine.score).toBe(1);
    expect(engine.cells[0]).toBeNull();
    expect(engine.gameOver).toBe(false);
  });

  it('ends the game when clicking a cell that is not active', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.click(4);
    expect(engine.gameOver).toBe(true);
    expect(engine.score).toBe(0);
  });

  it('does nothing on click once the game is over', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.click(4);
    expect(engine.gameOver).toBe(true);
    engine.tick(16);
    engine.click(0);
    expect(engine.score).toBe(0);
    expect(engine.cells[0]).toBeNull();
  });

  it('resets to a fresh board', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    engine.click(0);
    engine.click(1); // game over
    engine.reset();
    expect(engine.cells.every((c) => c === null)).toBe(true);
    expect(engine.score).toBe(0);
    expect(engine.gameOver).toBe(false);
    expect(engine.elapsedMs).toBe(0);
  });

  it('reports zero progress for an inactive cell', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    expect(engine.progressFor(0)).toBe(0);
  });

  it('reports proportional progress for an active cell', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    const duration = engine.cells[0].durationMs;
    engine.elapsedMs = engine.cells[0].activatedAt + duration / 2;
    expect(engine.progressFor(0)).toBeCloseTo(0.5, 5);
  });

  it('clamps progress to 0 past expiry', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    engine.elapsedMs = engine.cells[0].expiresAt + 1000;
    expect(engine.progressFor(0)).toBe(0);
  });

  it('clamps progress to 1 before activation', () => {
    const engine = new CircleTapEngine({ rng: () => 0 });
    engine.tick(16);
    engine.elapsedMs = engine.cells[0].activatedAt - engine.cells[0].durationMs;
    expect(engine.progressFor(0)).toBe(1);
  });
});
