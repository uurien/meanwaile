import { describe, it, expect } from 'vitest';
import { GAMES } from '../../src/games/registry.js';

describe('games registry', () => {
  it('has exactly 2 registered games', () => {
    expect(GAMES).toHaveLength(2);
  });

  it('lists CircleTap first, implemented, with its entry and preview paths', () => {
    const circleTap = GAMES[0];
    expect(circleTap).toMatchObject({
      id: 'circle-tap',
      name: 'CircleTap',
      implemented: true,
    });
    expect(circleTap.entry).toBe('../games/circle-tap/index.html');
    expect(circleTap.preview).toBe('../games/circle-tap/preview.png');
  });

  it('lists Meanwaile Runner second, implemented, with its entry and preview paths', () => {
    const meanwaileRunner = GAMES[1];
    expect(meanwaileRunner).toMatchObject({
      id: 'meanwaile-runner',
      implemented: true,
    });
    expect(meanwaileRunner.entry).toBe('../games/meanwaile-runner/index.html');
    expect(meanwaileRunner.preview).toBe('../games/meanwaile-runner/preview.png');
  });

  it('every game has a non-empty id, name, and tagline', () => {
    for (const game of GAMES) {
      expect(game.id).toBeTruthy();
      expect(game.name).toBeTruthy();
      expect(game.tagline).toBeTruthy();
    }
  });
});
