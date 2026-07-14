import { describe, it, expect } from 'vitest';
import { MAX_LEVEL, nextLevel, shouldAddSpikes, shouldAddAlien, nextSpeed } from '../../../src/games/meanwaile-runner/logic.js';

describe('nextLevel', () => {
  it('from level 1 (or lower), stays put below the 0.5 roll', () => {
    expect(nextLevel(1, () => 0.4)).toBe(1);
    expect(nextLevel(0, () => 0.4)).toBe(0);
  });

  it('from level 1 (or lower), climbs one step at/above the 0.5 roll', () => {
    expect(nextLevel(1, () => 0.6)).toBe(2);
    expect(nextLevel(0, () => 0.6)).toBe(1);
  });

  it('above level 1, splits into descend / stay / climb across three equal thirds', () => {
    expect(nextLevel(2, () => 0)).toBe(1);
    expect(nextLevel(2, () => 0.3)).toBe(1);
    expect(nextLevel(2, () => 0.34)).toBe(2);
    expect(nextLevel(2, () => 0.6)).toBe(2);
    expect(nextLevel(2, () => 0.67)).toBe(3);
    expect(nextLevel(2, () => 0.99)).toBe(3);
  });

  it('never climbs past MAX_LEVEL', () => {
    expect(nextLevel(MAX_LEVEL, () => 0.99)).toBe(MAX_LEVEL);
  });

  it('defaults to Math.random when no rng is supplied', () => {
    expect(() => nextLevel(1)).not.toThrow();
  });
});

describe('shouldAddSpikes', () => {
  it('adds spikes when the previous section had platforms and the roll is under 0.7', () => {
    expect(shouldAddSpikes(true, () => 0.5)).toBe(true);
  });

  it('skips spikes when the previous section had platforms but the roll is 0.7 or above', () => {
    expect(shouldAddSpikes(true, () => 0.8)).toBe(false);
  });

  it('still adds spikes without a previous platform when the roll is under 0.4', () => {
    expect(shouldAddSpikes(false, () => 0.3)).toBe(true);
  });

  it('skips spikes without a previous platform when the roll is 0.4 or above', () => {
    expect(shouldAddSpikes(false, () => 0.5)).toBe(false);
  });
});

describe('shouldAddAlien', () => {
  it('spawns an alien under the 0.4 roll', () => {
    expect(shouldAddAlien(() => 0.39)).toBe(true);
  });

  it('skips the alien at/above the 0.4 roll', () => {
    expect(shouldAddAlien(() => 0.4)).toBe(false);
  });
});

describe('nextSpeed', () => {
  it('grows speed by 10% by default', () => {
    expect(nextSpeed(10)).toBeCloseTo(11);
  });

  it('accepts a custom growth factor', () => {
    expect(nextSpeed(20, 1.2)).toBeCloseTo(24);
  });
});
