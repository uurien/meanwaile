import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listGames } from '../src/games-catalog';

function writeGame(rootDir: string, id: string, overrides: Partial<Record<string, unknown>> = {}) {
  const gameDir = path.join(rootDir, 'games', id);
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(
    path.join(gameDir, 'game.json'),
    JSON.stringify({
      id,
      name: id,
      tagline: `${id} tagline`,
      version: '1.0.0',
      entry: 'index.html',
      preview: 'preview.png',
      ...overrides,
    }),
  );
}

describe('games-catalog', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-games-catalog-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads games.json and merges in each installed game.json, in manifest order', () => {
    fs.writeFileSync(
      path.join(dir, 'games.json'),
      JSON.stringify({
        repo: 'uurien/meanwaile-games',
        games: [
          { id: 'circle-tap', version: '1.0.0' },
          { id: 'meanwaile-runner', version: '1.0.0' },
        ],
      }),
    );
    writeGame(dir, 'circle-tap', { name: 'CircleTap', tagline: 'Tap the circles' });
    writeGame(dir, 'meanwaile-runner', { name: 'Meanwaile Runner', tagline: 'Run and jump' });

    expect(listGames(dir)).toEqual([
      {
        id: 'circle-tap',
        name: 'CircleTap',
        tagline: 'Tap the circles',
        entry: '../../games/circle-tap/index.html',
        preview: '../../games/circle-tap/preview.png',
        implemented: true,
      },
      {
        id: 'meanwaile-runner',
        name: 'Meanwaile Runner',
        tagline: 'Run and jump',
        entry: '../../games/meanwaile-runner/index.html',
        preview: '../../games/meanwaile-runner/preview.png',
        implemented: true,
      },
    ]);
  });

  it('resolves entry/preview relative to each game\'s own game.json fields', () => {
    fs.writeFileSync(
      path.join(dir, 'games.json'),
      JSON.stringify({ repo: 'uurien/meanwaile-games', games: [{ id: 'circle-tap', version: '1.0.0' }] }),
    );
    writeGame(dir, 'circle-tap', { entry: 'game.html', preview: 'thumb.jpg' });

    const [game] = listGames(dir);
    expect(game.entry).toBe('../../games/circle-tap/game.html');
    expect(game.preview).toBe('../../games/circle-tap/thumb.jpg');
  });

  it('returns an empty list when games.json lists no games', () => {
    fs.writeFileSync(path.join(dir, 'games.json'), JSON.stringify({ repo: 'uurien/meanwaile-games', games: [] }));
    expect(listGames(dir)).toEqual([]);
  });
});
