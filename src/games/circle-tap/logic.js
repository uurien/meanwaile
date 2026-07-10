export const BOARD_SIZE = 9;

export const START_GREEN_DURATION_MS = 1200;
export const MIN_GREEN_DURATION_MS = 400;
export const DIFFICULTY_RAMP_MS = 45000;

export const START_SPAWN_INTERVAL_MS = 900;
export const MIN_SPAWN_INTERVAL_MS = 500;

const CONCURRENCY_TIERS = [
  { atMs: 20000, max: 3 },
  { atMs: 0, max: 2 },
];

function rampValue(elapsedMs, start, min) {
  const progress = Math.min(1, elapsedMs / DIFFICULTY_RAMP_MS);
  return start - progress * (start - min);
}

export function greenDurationForElapsed(elapsedMs) {
  return rampValue(elapsedMs, START_GREEN_DURATION_MS, MIN_GREEN_DURATION_MS);
}

export function spawnIntervalForElapsed(elapsedMs) {
  return rampValue(elapsedMs, START_SPAWN_INTERVAL_MS, MIN_SPAWN_INTERVAL_MS);
}

export function maxConcurrentForElapsed(elapsedMs) {
  return CONCURRENCY_TIERS.find((tier) => elapsedMs >= tier.atMs).max;
}

// A single "simple" circle: one ring, one required click. Future circle
// kinds (double/triple click) will add ringsCount > 1 to this same shape,
// depleting one ring per click while sharing the countdown.
export class CircleTapEngine {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.cells = new Array(BOARD_SIZE).fill(null);
    this.elapsedMs = 0;
    this.timeSinceSpawnMs = Infinity;
    this.score = 0;
    this.gameOver = false;
  }

  activeCount() {
    return this.cells.filter((cell) => cell !== null).length;
  }

  emptyIndices() {
    const result = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (this.cells[i] === null) result.push(i);
    }
    return result;
  }

  tick(dtMs) {
    if (this.gameOver) return;
    this.elapsedMs += dtMs;
    this.timeSinceSpawnMs += dtMs;

    for (let i = 0; i < BOARD_SIZE; i++) {
      const cell = this.cells[i];
      if (cell !== null && this.elapsedMs >= cell.expiresAt) {
        this.gameOver = true;
        return;
      }
    }

    this.maybeSpawn();
  }

  maybeSpawn() {
    if (this.activeCount() >= maxConcurrentForElapsed(this.elapsedMs)) return;
    if (this.timeSinceSpawnMs < spawnIntervalForElapsed(this.elapsedMs)) return;

    const empty = this.emptyIndices();
    const index = empty[Math.floor(this.rng() * empty.length)];
    const durationMs = greenDurationForElapsed(this.elapsedMs);
    this.cells[index] = {
      activatedAt: this.elapsedMs,
      expiresAt: this.elapsedMs + durationMs,
      durationMs,
    };
    this.timeSinceSpawnMs = 0;
  }

  click(index) {
    if (this.gameOver) return;
    const cell = this.cells[index];
    if (cell === null) {
      this.gameOver = true;
      return;
    }
    this.cells[index] = null;
    this.score += 1;
  }

  progressFor(index) {
    const cell = this.cells[index];
    if (cell === null) return 0;
    const remaining = cell.expiresAt - this.elapsedMs;
    return Math.max(0, Math.min(1, remaining / cell.durationMs));
  }
}
