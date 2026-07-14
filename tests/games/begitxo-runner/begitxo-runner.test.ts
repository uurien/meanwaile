// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// begitxo-runner.js only touches a small, fixed slice of the Phaser API
// (arcade sprites/colliders, tileSprites, keyboard, pointer, anims, and
// game pause/resume/destroy). Real Phaser needs a canvas/WebGL context
// happy-dom doesn't provide, so this fake reproduces just that slice
// synchronously - it drives the real preload/create/update closures from
// the source file, so what gets exercised is the actual game logic, not a
// re-test of logic.js (already covered on its own in logic.test.ts).

const GAME_WIDTH = 440;
const GAME_HEIGHT = 470;
const PLATFORM_WIDTH = 180;
const OFFSCREEN_BUFFER = 400;

let sprites: FakeSprite[] = [];
let colliders: Array<{ a: unknown; b: FakeSprite | FakeTileSprite; cb: (...args: unknown[]) => void }> = [];
let pointerHandlers: Array<() => void> = [];
let spaceKey: { isDown: boolean };
let lastGame: FakeGame;

class FakeBody {
  allowGravity = true;
  touching = { down: false, right: false, up: false, left: false };
  velocity = { x: 0, y: 0 };
  setFriction() {
    return this;
  }
}

class FakeSprite {
  body = new FakeBody();
  displayWidth = 0;
  displayHeight = 0;
  visible = true;
  destroyed = false;
  key: string;
  anims = { play: vi.fn() };
  x: number;
  y: number;

  constructor(x: number, y: number, key: string) {
    this.x = x;
    this.y = y;
    this.key = key;
    sprites.push(this);
  }
  setImmovable() {
    return this;
  }
  setVelocityX(v: number) {
    this.body.velocity.x = v;
    return this;
  }
  setVelocityY(v: number) {
    this.body.velocity.y = v;
    return this;
  }
  setBodySize() {
    return this;
  }
  setBounce() {
    return this;
  }
  destroy() {
    this.destroyed = true;
  }
}

class FakeTileSprite {
  tilePositionX = 0;
  key: string;
  x: number;
  y: number;

  constructor(x: number, y: number, _w: number, _h: number, key: string) {
    this.x = x;
    this.y = y;
    this.key = key;
  }
  setOrigin() {
    return this;
  }
  setScrollFactor() {
    return this;
  }
}

class FakeGame {
  isPaused = false;
  destroyed = false;
  config: Record<string, unknown>;
  private sceneCtx: Record<string, unknown>;
  private runUpdate: () => void;

  constructor(config: Record<string, unknown>) {
    this.config = config;
    sprites = [];
    colliders = [];
    pointerHandlers = [];
    spaceKey = { isDown: false };

    this.sceneCtx = {
      load: { image: vi.fn(), spritesheet: vi.fn() },
      physics: {
        world: {},
        add: {
          sprite: (x: number, y: number, key: string) => new FakeSprite(x, y, key),
          existing: (obj: unknown) => obj,
          collider: (a: unknown, b: FakeSprite | FakeTileSprite, cb?: (...args: unknown[]) => void) => {
            colliders.push({ a, b, cb: cb ?? (() => {}) });
          },
        },
      },
      add: {
        tileSprite: (x: number, y: number, w: number, h: number, key: string) => new FakeTileSprite(x, y, w, h, key),
      },
      input: {
        keyboard: { addKey: () => spaceKey },
        on: (event: string, cb: () => void) => {
          if (event === 'pointerdown') pointerHandlers.push(cb);
        },
      },
      anims: {
        create: vi.fn(),
        generateFrameNumbers: () => [],
      },
      sys: { canvas: { width: config.width, height: config.height } },
      game: this,
    };

    const scene = config.scene as { preload: () => void; create: () => void; update: () => void };
    scene.preload.call(this.sceneCtx);
    scene.create.call(this.sceneCtx);
    this.runUpdate = () => scene.update.call(this.sceneCtx);
    lastGame = this;
  }
  update() {
    this.runUpdate();
  }
  pause() {
    this.isPaused = true;
  }
  resume() {
    this.isPaused = false;
  }
  destroy() {
    this.destroyed = true;
  }
}

// Cycles through queued rolls (nextLevel / shouldAddSpikes / shouldAddAlien
// / alien jitter all read Math.random directly), falling back to a low
// default that keeps section generation "eventful" (spikes + alien) once
// the queue drains.
let randomQueue: number[] = [];
function queueRandom(values: number[]) {
  randomQueue.push(...values);
}

function player() {
  return sprites.find((s) => s.key === 'player' && !s.destroyed)!;
}
function findSurvivingCollider(key: string) {
  return [...colliders].reverse().find((c) => c.b.key === key && !c.b.destroyed);
}
function spikeCount() {
  return sprites.filter((s) => s.key === 'spike').length;
}
function alienCount() {
  return sprites.filter((s) => s.key === 'alien').length;
}

let pointsEl: HTMLElement;
let gameOverEl: HTMLElement;
let pointsSummaryEl: HTMLElement;
let retryBtn: HTMLElement;

beforeAll(async () => {
  const html = readFileSync(join(__dirname, '../../../src/games/begitxo-runner/index.html'), 'utf-8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

  vi.spyOn(Math, 'random').mockImplementation(() => (randomQueue.length ? randomQueue.shift()! : 0.1));
  // Fake timers stay on for the whole suite (not toggled per-test): the
  // points/speed setIntervals and the jump-lock setTimeout are scheduled
  // once and must keep ticking on the same mock clock across tests, the
  // same way they'd keep running across postMessage calls in the real app.
  vi.useFakeTimers();

  (globalThis as unknown as { Phaser: unknown }).Phaser = {
    AUTO: 'AUTO',
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Input: { Keyboard: { KeyCodes: { SPACE: 32 } } },
    Game: FakeGame,
  };

  await import('../../../src/games/begitxo-runner/begitxo-runner.js');

  pointsEl = document.getElementById('points')!;
  gameOverEl = document.getElementById('game-over')!;
  pointsSummaryEl = document.getElementById('points_summary')!;
  retryBtn = document.getElementById('retry-btn')!;
});

describe('initial load', () => {
  it('builds the world already paused, with the HUD visible but frozen at 0', () => {
    expect(lastGame.isPaused).toBe(true);
    expect(pointsEl.classList.contains('hidden')).toBe(false);
    expect(pointsEl.textContent).toBe('Score: 0');
    expect(gameOverEl.hidden).toBe(true);
  });

  it('does not run the points/speed timers until resumed', () => {
    vi.advanceTimersByTime(500);
    expect(pointsEl.textContent).toBe('Score: 0');
  });
});

describe('first game:resume from the host', () => {
  it('unpauses and starts the timers', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    expect(lastGame.isPaused).toBe(false);
    vi.advanceTimersByTime(150);
    expect(pointsEl.textContent).toBe('Score: 3');
  });

  it('bumps platform speed once the speed timer fires', () => {
    const platform = sprites.find((s) => s.key === 'platform')!;
    const before = platform.body.velocity.x;
    vi.advanceTimersByTime(5000);
    lastGame.update();
    expect(platform.body.velocity.x).not.toBe(before);
  });

  it('a second game:resume while already running does not double the timer', () => {
    const before = pointsEl.textContent;
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    vi.advanceTimersByTime(50);
    const scoreAfterOneTick = pointsEl.textContent;
    expect(scoreAfterOneTick).not.toBe(before);
    // If startTimers had stacked a second interval, this second tick would
    // jump the score by 2 instead of 1.
    const [, n] = scoreAfterOneTick!.split(': ');
    vi.advanceTimersByTime(50);
    const [, n2] = pointsEl.textContent!.split(': ');
    expect(Number(n2) - Number(n)).toBe(1);
  });
});

describe('game:pause / game:resume via postMessage', () => {
  it('pauses the game and stops the timers', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:pause' } }));
    expect(lastGame.isPaused).toBe(true);
    const before = pointsEl.textContent;
    vi.advanceTimersByTime(500);
    expect(pointsEl.textContent).toBe(before);
  });

  it('pausing again while already paused is a no-op', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:pause' } }));
    expect(lastGame.isPaused).toBe(true);
  });

  it('resumes again for the jump/collision tests below', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    expect(lastGame.isPaused).toBe(false);
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

describe('jumping', () => {
  it('jumps on Space while grounded', () => {
    player().body.touching.down = true;
    spaceKey.isDown = true;
    lastGame.update();
    expect(player().body.velocity.y).toBe(-800);
    expect(player().anims.play).toHaveBeenCalledWith('rotate');
  });

  it('ignores further Space frames while the jump is lock-debounced', () => {
    const calls = (player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length;
    lastGame.update();
    expect((player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });

  it('double-jumps mid-air, then blocks a third attempt', () => {
    vi.advanceTimersByTime(300); // clear the jump lock from the grounded jump
    spaceKey.isDown = false;
    lastGame.update();

    player().body.touching.down = false; // airborne
    spaceKey.isDown = true;
    lastGame.update();
    expect(player().anims.play).toHaveBeenLastCalledWith('rotate');
    const calls = (player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length;

    vi.advanceTimersByTime(300); // jump lock clears, but inSecondJump still blocks
    lastGame.update();
    expect((player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });

  it('landing resets the double-jump, and the ground collider is what does it', () => {
    const groundCollider = findSurvivingCollider('ground');
    groundCollider!.cb();
    player().body.touching.down = true;
    spaceKey.isDown = false;
    lastGame.update();

    spaceKey.isDown = true;
    const calls = (player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length;
    lastGame.update();
    expect((player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls + 1);
    spaceKey.isDown = false;
  });

  it('jumps from a pointerdown tap too', () => {
    vi.advanceTimersByTime(300);
    lastGame.update();
    player().body.touching.down = true;
    const calls = (player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length;
    pointerHandlers[0]();
    lastGame.update();
    expect((player().anims.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls + 1);
  });
});

describe('smoke trail', () => {
  it('follows the player and is visible while grounded', () => {
    player().body.touching.down = true;
    lastGame.update();
    const smoke = sprites.find((s) => s.key === 'smoke')!;
    expect(smoke.visible).toBe(true);
    expect(smoke.x).toBe(player().x - 24 + 2);
  });

  it('hides while airborne', () => {
    player().body.touching.down = false;
    lastGame.update();
    const smoke = sprites.find((s) => s.key === 'smoke')!;
    expect(smoke.visible).toBe(false);
    player().body.touching.down = true;
  });
});

describe('section generation', () => {
  it('spawns a new section once the last platform crosses the refill threshold', () => {
    const before = sprites.filter((s) => s.key === 'platform').length;
    const last = [...sprites].reverse().find((s) => s.key === 'platform' && !s.destroyed)!;
    last.x = GAME_WIDTH + OFFSCREEN_BUFFER - PLATFORM_WIDTH - 1;
    lastGame.update();
    expect(sprites.filter((s) => s.key === 'platform').length).toBeGreaterThan(before);
  });

  it('can generate a section with no spikes and no alien', () => {
    const spikesBefore = spikeCount();
    const aliensBefore = alienCount();
    queueRandom([0.5, 0.9, 0.9]); // nextLevel roll, shouldAddSpikes -> false, shouldAddAlien -> false
    const last = [...sprites].reverse().find((s) => s.key === 'platform' && !s.destroyed)!;
    last.x = GAME_WIDTH + OFFSCREEN_BUFFER - PLATFORM_WIDTH - 1;
    lastGame.update();
    expect(spikeCount()).toBe(spikesBefore);
    expect(alienCount()).toBe(aliensBefore);
  });

  it('despawns the oldest section once it fully leaves the screen on the left', () => {
    const oldest = sprites.find((s) => s.key === 'platform' && !s.destroyed)!;
    oldest.x = -(PLATFORM_WIDTH + 1);
    lastGame.update();
    expect(oldest.destroyed).toBe(true);
  });
});

describe('collisions end the run', () => {
  it('landing on a platform (touching down) does not end the run', () => {
    const platformCollider = findSurvivingCollider('platform')!;
    player().body.touching.right = false;
    player().body.touching.down = true;
    platformCollider.cb();
    expect(lastGame.isPaused).toBe(false);
  });

  it('touching a platform from the side ends the run', () => {
    const platformCollider = findSurvivingCollider('platform')!;
    player().body.touching.right = true;
    platformCollider.cb();
    expect(lastGame.isPaused).toBe(true);
    expect(pointsSummaryEl.textContent).toContain('Score:');
    vi.advanceTimersByTime(300);
    expect(gameOverEl.hidden).toBe(false);
    expect(pointsEl.classList.contains('hidden')).toBe(true);
  });

  it('a second collision after game-over is a no-op', () => {
    const platformCollider = findSurvivingCollider('platform')!;
    expect(() => platformCollider.cb()).not.toThrow();
    expect(lastGame.isPaused).toBe(true);
  });

  it('ignores game:pause and game:resume once the run is over', () => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:resume' } }));
    expect(lastGame.isPaused).toBe(true);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'game:pause' } }));
    expect(lastGame.isPaused).toBe(true);
  });
});

describe('retry', () => {
  it('destroys the previous run and starts a fresh, already-playing one', () => {
    const previousGame = lastGame;
    retryBtn.click();
    expect(previousGame.destroyed).toBe(true);
    expect(lastGame).not.toBe(previousGame);
    expect(lastGame.isPaused).toBe(false);
    expect(gameOverEl.hidden).toBe(true);
  });

  it('ticks the score without needing a game:resume, since retry starts unpaused', () => {
    vi.advanceTimersByTime(150);
    expect(pointsEl.textContent).toBe('Score: 3');
  });

  it('spikes end the run too', () => {
    const spikeCollider = findSurvivingCollider('spike')!;
    spikeCollider.cb();
    expect(lastGame.isPaused).toBe(true);
    vi.advanceTimersByTime(300);
    expect(gameOverEl.hidden).toBe(false);
  });

  it('aliens end the run too', () => {
    retryBtn.click();
    const last = [...sprites].reverse().find((s) => s.key === 'platform' && !s.destroyed)!;
    last.x = GAME_WIDTH + OFFSCREEN_BUFFER - PLATFORM_WIDTH - 1;
    lastGame.update(); // default random queue keeps shouldAddAlien() true

    const alienCollider = findSurvivingCollider('alien')!;
    alienCollider.cb();
    expect(lastGame.isPaused).toBe(true);
    vi.advanceTimersByTime(300);
    expect(gameOverEl.hidden).toBe(false);
  });

  it('despawning a section that had an alien also destroys the alien', () => {
    retryBtn.click(); // clean slate: sections = [first section, no alien]

    // Spawn one alien-bearing section (default random keeps shouldAddAlien()
    // true), then one more buffer section behind it, so the queue never
    // drains to empty while we despawn the front two off the left edge.
    let last = [...sprites].reverse().find((s) => s.key === 'platform' && !s.destroyed)!;
    last.x = GAME_WIDTH + OFFSCREEN_BUFFER - PLATFORM_WIDTH - 1;
    lastGame.update();
    const alien = [...sprites].reverse().find((s) => s.key === 'alien' && !s.destroyed)!;

    last = [...sprites].reverse().find((s) => s.key === 'platform' && !s.destroyed)!;
    last.x = GAME_WIDTH + OFFSCREEN_BUFFER - PLATFORM_WIDTH - 1;
    lastGame.update();

    let oldest = sprites.find((s) => s.key === 'platform' && !s.destroyed)!;
    oldest.x = -(PLATFORM_WIDTH + 1);
    lastGame.update();
    expect(alien.destroyed).toBe(false); // that was the first, alien-less section

    oldest = sprites.find((s) => s.key === 'platform' && !s.destroyed)!;
    oldest.x = -(PLATFORM_WIDTH + 1);
    lastGame.update();
    expect(alien.destroyed).toBe(true);
  });
});

afterAll(() => {
  vi.useRealTimers();
});
