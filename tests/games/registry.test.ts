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

  it('lists Begitxo Runner second, implemented, with its entry and preview paths', () => {
    const begitxoRunner = GAMES[1];
    expect(begitxoRunner).toMatchObject({
      id: 'begitxo-runner',
      implemented: true,
    });
    expect(begitxoRunner.entry).toBe('../games/begitxo-runner/index.html');
    expect(begitxoRunner.preview).toBe('../games/begitxo-runner/preview.png');
  });

  it('every game has a non-empty id, name, and tagline', () => {
    for (const game of GAMES) {
      expect(game.id).toBeTruthy();
      expect(game.name).toBeTruthy();
      expect(game.tagline).toBeTruthy();
    }
  });
});
