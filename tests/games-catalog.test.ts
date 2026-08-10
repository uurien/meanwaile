import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { listGames, readGamesConfig } from '../src/games-catalog';
import { addInstalledGame } from '../src/game-installer';

function writeGame(baseDir: string, id: string, overrides: Partial<Record<string, unknown>> = {}) {
  const gameDir = path.join(baseDir, 'games', id);
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

function fileUrl(baseDir: string, id: string, fileName: string): string {
  return pathToFileURL(path.join(baseDir, 'games', id, fileName)).toString();
}

describe('games-catalog', () => {
  let rootDir: string;
  let userDataDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-games-catalog-root-'));
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-games-catalog-userdata-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  it('reads games.json and merges in each installed game.json, in manifest order, as file:// URLs', () => {
    fs.writeFileSync(
      path.join(rootDir, 'games.json'),
      JSON.stringify({
        repo: 'uurien/meanwaile-games',
        games: [
          { id: 'circle-tap', version: '1.0.0' },
          { id: 'meanwaile-runner', version: '1.0.0' },
        ],
      }),
    );
    writeGame(rootDir, 'circle-tap', { name: 'CircleTap', tagline: 'Tap the circles' });
    writeGame(rootDir, 'meanwaile-runner', { name: 'Meanwaile Runner', tagline: 'Run and jump' });

    expect(listGames(rootDir, userDataDir)).toEqual([
      {
        id: 'circle-tap',
        name: 'CircleTap',
        tagline: 'Tap the circles',
        entry: fileUrl(rootDir, 'circle-tap', 'index.html'),
        preview: fileUrl(rootDir, 'circle-tap', 'preview.png'),
        implemented: true,
        removable: false,
      },
      {
        id: 'meanwaile-runner',
        name: 'Meanwaile Runner',
        tagline: 'Run and jump',
        entry: fileUrl(rootDir, 'meanwaile-runner', 'index.html'),
        preview: fileUrl(rootDir, 'meanwaile-runner', 'preview.png'),
        implemented: true,
        removable: false,
      },
    ]);
  });

  it("resolves entry/preview relative to each game's own game.json fields", () => {
    fs.writeFileSync(
      path.join(rootDir, 'games.json'),
      JSON.stringify({ repo: 'uurien/meanwaile-games', games: [{ id: 'circle-tap', version: '1.0.0' }] }),
    );
    writeGame(rootDir, 'circle-tap', { entry: 'game.html', preview: 'thumb.jpg' });

    const [game] = listGames(rootDir, userDataDir);
    expect(game.entry).toBe(fileUrl(rootDir, 'circle-tap', 'game.html'));
    expect(game.preview).toBe(fileUrl(rootDir, 'circle-tap', 'thumb.jpg'));
  });

  it('returns an empty list when games.json lists no games and nothing is installed via the marketplace', () => {
    fs.writeFileSync(path.join(rootDir, 'games.json'), JSON.stringify({ repo: 'uurien/meanwaile-games', games: [] }));
    expect(listGames(rootDir, userDataDir)).toEqual([]);
  });

  it('appends marketplace-installed games after the bundled defaults', () => {
    fs.writeFileSync(
      path.join(rootDir, 'games.json'),
      JSON.stringify({ repo: 'uurien/meanwaile-games', games: [{ id: 'circle-tap', version: '1.0.0' }] }),
    );
    writeGame(rootDir, 'circle-tap', { name: 'CircleTap', tagline: 'Tap the circles' });

    writeGame(userDataDir, 'meanwaile-maze', { name: 'Meanwaile Maze', tagline: 'Find a way out' });
    addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });

    expect(listGames(rootDir, userDataDir)).toEqual([
      {
        id: 'circle-tap',
        name: 'CircleTap',
        tagline: 'Tap the circles',
        entry: fileUrl(rootDir, 'circle-tap', 'index.html'),
        preview: fileUrl(rootDir, 'circle-tap', 'preview.png'),
        implemented: true,
        removable: false,
      },
      {
        id: 'meanwaile-maze',
        name: 'Meanwaile Maze',
        tagline: 'Find a way out',
        entry: fileUrl(userDataDir, 'meanwaile-maze', 'index.html'),
        preview: fileUrl(userDataDir, 'meanwaile-maze', 'preview.png'),
        implemented: true,
        removable: true,
      },
    ]);
  });

  it('marks bundled defaults as not removable and marketplace-installed games as removable', () => {
    fs.writeFileSync(
      path.join(rootDir, 'games.json'),
      JSON.stringify({ repo: 'uurien/meanwaile-games', games: [{ id: 'circle-tap', version: '1.0.0' }] }),
    );
    writeGame(rootDir, 'circle-tap');
    writeGame(userDataDir, 'meanwaile-maze');
    addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });

    const games = listGames(rootDir, userDataDir);
    expect(games.find((g) => g.id === 'circle-tap')?.removable).toBe(false);
    expect(games.find((g) => g.id === 'meanwaile-maze')?.removable).toBe(true);
  });

  it('ignores a marketplace-installed entry whose id collides with a bundled default', () => {
    fs.writeFileSync(
      path.join(rootDir, 'games.json'),
      JSON.stringify({ repo: 'uurien/meanwaile-games', games: [{ id: 'circle-tap', version: '1.0.0' }] }),
    );
    writeGame(rootDir, 'circle-tap', { name: 'CircleTap (bundled)' });
    writeGame(userDataDir, 'circle-tap', { name: 'CircleTap (marketplace)' });
    addInstalledGame(userDataDir, { id: 'circle-tap', version: '1.0.0' });

    const games = listGames(rootDir, userDataDir);
    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('CircleTap (bundled)');
  });

  it('does not error when no game has been installed via the marketplace yet (no installed-games.json)', () => {
    fs.writeFileSync(path.join(rootDir, 'games.json'), JSON.stringify({ repo: 'uurien/meanwaile-games', games: [] }));
    expect(listGames(rootDir, userDataDir)).toEqual([]);
  });

  describe('readGamesConfig', () => {
    it('returns the parsed repo and games list', () => {
      fs.writeFileSync(
        path.join(rootDir, 'games.json'),
        JSON.stringify({
          repo: 'uurien/meanwaile-games',
          games: [{ id: 'circle-tap', version: '1.0.0' }],
        }),
      );
      expect(readGamesConfig(rootDir)).toEqual({
        repo: 'uurien/meanwaile-games',
        games: [{ id: 'circle-tap', version: '1.0.0' }],
      });
    });
  });
});
