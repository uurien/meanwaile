import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  assetUrl,
  readInstalledGames,
  addInstalledGame,
  removeInstalledGame,
  installGame,
  uninstallGame,
  GAME_CSP,
  injectGameCsp,
} from '../src/game-installer';

function zipBufferFor(id: string, version: string, extraFiles: Record<string, string> = {}) {
  const zip = new AdmZip();
  zip.addFile('game.json', Buffer.from(JSON.stringify({ id, version, entry: 'index.html' })));
  zip.addFile('index.html', Buffer.from(`<html><head></head><body>${id}</body></html>`));
  for (const [name, contents] of Object.entries(extraFiles)) {
    zip.addFile(name, Buffer.from(contents));
  }
  return zip.toBuffer();
}

function fakeFetch(buffer: Buffer, ok = true, status = 200) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Not Found',
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  };
  return { impl, calls };
}

describe('game-installer', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-game-installer-test-'));
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  describe('assetUrl', () => {
    it('builds the release download URL for a game id and version', () => {
      expect(assetUrl('uurien/meanwaile-games', 'meanwaile-maze', '0.1.0')).toBe(
        'https://github.com/uurien/meanwaile-games/releases/download/meanwaile-maze@0.1.0/meanwaile-maze-0.1.0.zip',
      );
    });
  });

  describe('readInstalledGames', () => {
    it('returns an empty list when no manifest exists yet', () => {
      expect(readInstalledGames(userDataDir)).toEqual([]);
    });

    it('returns an empty list when the manifest is malformed', () => {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(path.join(userDataDir, 'installed-games.json'), 'not-json');
      expect(readInstalledGames(userDataDir)).toEqual([]);
    });

    it('returns an empty list when the manifest is valid JSON but games is missing/not an array', () => {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(path.join(userDataDir, 'installed-games.json'), JSON.stringify({}));
      expect(readInstalledGames(userDataDir)).toEqual([]);
    });

    it('returns persisted games', () => {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(
        path.join(userDataDir, 'installed-games.json'),
        JSON.stringify({ games: [{ id: 'meanwaile-maze', version: '0.1.0' }] }),
      );
      expect(readInstalledGames(userDataDir)).toEqual([{ id: 'meanwaile-maze', version: '0.1.0' }]);
    });
  });

  describe('addInstalledGame', () => {
    it('creates the userData directory and manifest if they do not exist yet', () => {
      const nested = path.join(userDataDir, 'nested', 'userData');
      addInstalledGame(nested, { id: 'meanwaile-maze', version: '0.1.0' });
      expect(readInstalledGames(nested)).toEqual([{ id: 'meanwaile-maze', version: '0.1.0' }]);
    });

    it('appends a new game to the existing list', () => {
      addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });
      addInstalledGame(userDataDir, { id: 'other-game', version: '2.0.0' });
      expect(readInstalledGames(userDataDir)).toEqual([
        { id: 'meanwaile-maze', version: '0.1.0' },
        { id: 'other-game', version: '2.0.0' },
      ]);
    });

    it('replaces the entry in place when the game id was already installed', () => {
      addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });
      addInstalledGame(userDataDir, { id: 'other-game', version: '2.0.0' });
      addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.2.0' });
      expect(readInstalledGames(userDataDir)).toEqual([
        { id: 'other-game', version: '2.0.0' },
        { id: 'meanwaile-maze', version: '0.2.0' },
      ]);
    });
  });

  describe('removeInstalledGame', () => {
    it('removes the matching entry', () => {
      addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });
      addInstalledGame(userDataDir, { id: 'other-game', version: '2.0.0' });
      removeInstalledGame(userDataDir, 'meanwaile-maze');
      expect(readInstalledGames(userDataDir)).toEqual([{ id: 'other-game', version: '2.0.0' }]);
    });

    it('is a no-op when the manifest does not exist yet', () => {
      expect(() => removeInstalledGame(userDataDir, 'meanwaile-maze')).not.toThrow();
      expect(readInstalledGames(userDataDir)).toEqual([]);
    });
  });

  describe('installGame', () => {
    it('downloads and extracts the game bundle into userData/games/<id> and records it as installed', async () => {
      const buffer = zipBufferFor('meanwaile-maze', '0.1.0', { 'meanwaile-maze.js': 'console.log(1)' });
      const { impl, calls } = fakeFetch(buffer);

      await installGame({
        repo: 'uurien/meanwaile-games',
        id: 'meanwaile-maze',
        version: '0.1.0',
        userDataDir,
        fetchImpl: impl,
        log: () => {},
      });

      expect(calls).toEqual([
        'https://github.com/uurien/meanwaile-games/releases/download/meanwaile-maze@0.1.0/meanwaile-maze-0.1.0.zip',
      ]);
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
      expect(html).toContain('meanwaile-maze</body>');
      expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}" />`);
      expect(fs.readFileSync(path.join(gameDir, 'meanwaile-maze.js'), 'utf8')).toBe('console.log(1)');
      expect(readInstalledGames(userDataDir)).toEqual([{ id: 'meanwaile-maze', version: '0.1.0' }]);
    });

    it('skips the download when the installed version already matches', async () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze', version: '0.1.0' }));
      addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });

      const { impl, calls } = fakeFetch(zipBufferFor('meanwaile-maze', '0.1.0'));

      await installGame({
        repo: 'uurien/meanwaile-games',
        id: 'meanwaile-maze',
        version: '0.1.0',
        userDataDir,
        fetchImpl: impl,
        log: () => {},
      });

      expect(calls).toEqual([]);
    });

    it('re-downloads and replaces stale files when updating to a newer version', async () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze', version: '0.1.0' }));
      fs.writeFileSync(path.join(gameDir, 'old-file.js'), 'stale');
      addInstalledGame(userDataDir, { id: 'meanwaile-maze', version: '0.1.0' });

      const { impl } = fakeFetch(zipBufferFor('meanwaile-maze', '0.2.0'));

      await installGame({
        repo: 'uurien/meanwaile-games',
        id: 'meanwaile-maze',
        version: '0.2.0',
        userDataDir,
        fetchImpl: impl,
        log: () => {},
      });

      expect(fs.existsSync(path.join(gameDir, 'old-file.js'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8')).version).toBe('0.2.0');
      expect(readInstalledGames(userDataDir)).toEqual([{ id: 'meanwaile-maze', version: '0.2.0' }]);
    });

    it('treats a game.json with no version field as not installed and re-downloads', async () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze' }));

      const { impl, calls } = fakeFetch(zipBufferFor('meanwaile-maze', '0.1.0'));

      await installGame({
        repo: 'uurien/meanwaile-games',
        id: 'meanwaile-maze',
        version: '0.1.0',
        userDataDir,
        fetchImpl: impl,
        log: () => {},
      });

      expect(calls).toHaveLength(1);
    });

    it('treats a malformed on-disk game.json as not installed and re-downloads', async () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), '{not json');

      const { impl, calls } = fakeFetch(zipBufferFor('meanwaile-maze', '0.1.0'));

      await installGame({
        repo: 'uurien/meanwaile-games',
        id: 'meanwaile-maze',
        version: '0.1.0',
        userDataDir,
        fetchImpl: impl,
        log: () => {},
      });

      expect(calls).toHaveLength(1);
      expect(JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8')).version).toBe('0.1.0');
    });

    it('throws when the download response is not ok, and does not record it as installed', async () => {
      const { impl } = fakeFetch(Buffer.from(''), false, 404);

      await expect(
        installGame({
          repo: 'uurien/meanwaile-games',
          id: 'meanwaile-maze',
          version: '0.1.0',
          userDataDir,
          fetchImpl: impl,
          log: () => {},
        }),
      ).rejects.toThrow(/Failed to download/);

      expect(readInstalledGames(userDataDir)).toEqual([]);
    });
  });

  describe('uninstallGame', () => {
    it('removes the installed game directory and its manifest entry', async () => {
      const { impl } = fakeFetch(zipBufferFor('meanwaile-maze', '0.1.0'));
      await installGame({
        repo: 'uurien/meanwaile-games',
        id: 'meanwaile-maze',
        version: '0.1.0',
        userDataDir,
        fetchImpl: impl,
        log: () => {},
      });

      uninstallGame(userDataDir, 'meanwaile-maze');

      expect(fs.existsSync(path.join(userDataDir, 'games', 'meanwaile-maze'))).toBe(false);
      expect(readInstalledGames(userDataDir)).toEqual([]);
    });

    it('is a no-op when the game was never installed', () => {
      expect(() => uninstallGame(userDataDir, 'meanwaile-maze')).not.toThrow();
    });
  });

  describe('injectGameCsp', () => {
    it('inserts the CSP meta tag right after the opening <head> tag', () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze', entry: 'index.html' }));
      fs.writeFileSync(path.join(gameDir, 'index.html'), '<html><head><title>x</title></head><body></body></html>');

      injectGameCsp(gameDir);

      const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
      expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}" />`);
      expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<title>'));
    });

    it('respects a custom entry filename from game.json', () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(
        path.join(gameDir, 'game.json'),
        JSON.stringify({ id: 'meanwaile-maze', entry: 'play.html' }),
      );
      fs.writeFileSync(path.join(gameDir, 'play.html'), '<html><head></head><body></body></html>');
      fs.writeFileSync(path.join(gameDir, 'index.html'), '<html><head></head><body></body></html>');

      injectGameCsp(gameDir);

      expect(fs.readFileSync(path.join(gameDir, 'play.html'), 'utf8')).toContain('Content-Security-Policy');
      expect(fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8')).not.toContain('Content-Security-Policy');
    });

    it('does not duplicate the tag when one is already present', () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze', entry: 'index.html' }));
      const original =
        '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'" /></head><body></body></html>';
      fs.writeFileSync(path.join(gameDir, 'index.html'), original);

      injectGameCsp(gameDir);

      expect(fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8')).toBe(original);
    });

    it('falls back to index.html when game.json has no entry field or is missing/malformed', () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'index.html'), '<html><head></head><body></body></html>');

      expect(() => injectGameCsp(gameDir)).not.toThrow();
      expect(fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8')).toContain('Content-Security-Policy');
    });

    it('is a no-op when the entry file does not exist', () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze', entry: 'index.html' }));

      expect(() => injectGameCsp(gameDir)).not.toThrow();
    });

    it('is a no-op when the entry file has no <head> tag', () => {
      const gameDir = path.join(userDataDir, 'games', 'meanwaile-maze');
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'meanwaile-maze', entry: 'index.html' }));
      const original = '<html><body>no head here</body></html>';
      fs.writeFileSync(path.join(gameDir, 'index.html'), original);

      injectGameCsp(gameDir);

      expect(fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8')).toBe(original);
    });
  });
});
