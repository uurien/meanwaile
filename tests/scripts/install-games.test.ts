import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  assetUrl,
  readManifest,
  installedVersion,
  GAME_CSP,
  injectGameCsp,
  installGame,
  installAll,
} from '../../scripts/install-games.js';

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

let tmpDirs: string[] = [];
function mkTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meanwaile-games-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs = [];
});

describe('assetUrl', () => {
  it('builds the release download URL for a game id and version', () => {
    expect(assetUrl('uurien/meanwaile-games', 'circle-tap', '1.0.0')).toBe(
      'https://github.com/uurien/meanwaile-games/releases/download/circle-tap@1.0.0/circle-tap-1.0.0.zip',
    );
  });
});

describe('readManifest', () => {
  it('parses a valid manifest', () => {
    const dir = mkTmpDir();
    const manifestPath = path.join(dir, 'games.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ repo: 'uurien/meanwaile-games', games: [{ id: 'circle-tap', version: '1.0.0' }] }),
    );
    expect(readManifest(manifestPath)).toEqual({
      repo: 'uurien/meanwaile-games',
      games: [{ id: 'circle-tap', version: '1.0.0' }],
    });
  });

  it('throws when the manifest is missing repo or games', () => {
    const dir = mkTmpDir();
    const manifestPath = path.join(dir, 'games.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ games: [] }));
    expect(() => readManifest(manifestPath)).toThrow(/Invalid games manifest/);
  });
});

describe('installedVersion', () => {
  it('returns null when the game directory has no game.json', () => {
    const dir = mkTmpDir();
    expect(installedVersion(path.join(dir, 'circle-tap'))).toBeNull();
  });

  it('returns the installed version from game.json', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ id: 'circle-tap', version: '1.0.0' }));
    expect(installedVersion(dir)).toBe('1.0.0');
  });

  it('returns null when game.json is malformed', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'game.json'), '{not json');
    expect(installedVersion(dir)).toBeNull();
  });
});

describe('installGame', () => {
  it('downloads and extracts the game bundle when not yet installed', async () => {
    const gamesDir = mkTmpDir();
    const buffer = zipBufferFor('circle-tap', '1.0.0', { 'circle-tap.js': 'console.log(1)' });
    const { impl, calls } = fakeFetch(buffer);

    await installGame({
      repo: 'uurien/meanwaile-games',
      id: 'circle-tap',
      version: '1.0.0',
      gamesDir,
      fetchImpl: impl,
      log: () => {},
    });

    expect(calls).toEqual(['https://github.com/uurien/meanwaile-games/releases/download/circle-tap@1.0.0/circle-tap-1.0.0.zip']);
    const html = fs.readFileSync(path.join(gamesDir, 'circle-tap', 'index.html'), 'utf8');
    expect(html).toContain('circle-tap</body>');
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}" />`);
    expect(fs.readFileSync(path.join(gamesDir, 'circle-tap', 'circle-tap.js'), 'utf8')).toBe('console.log(1)');
  });

  it('skips the download when the installed version already matches', async () => {
    const gamesDir = mkTmpDir();
    const gameDir = path.join(gamesDir, 'circle-tap');
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'circle-tap', version: '1.0.0' }));

    const { impl, calls } = fakeFetch(zipBufferFor('circle-tap', '1.0.0'));

    await installGame({
      repo: 'uurien/meanwaile-games',
      id: 'circle-tap',
      version: '1.0.0',
      gamesDir,
      fetchImpl: impl,
      log: () => {},
    });

    expect(calls).toEqual([]);
  });

  it('re-downloads and replaces stale files when the installed version differs', async () => {
    const gamesDir = mkTmpDir();
    const gameDir = path.join(gamesDir, 'circle-tap');
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, 'game.json'), JSON.stringify({ id: 'circle-tap', version: '0.9.0' }));
    fs.writeFileSync(path.join(gameDir, 'old-file.js'), 'stale');

    const { impl } = fakeFetch(zipBufferFor('circle-tap', '1.0.0'));

    await installGame({
      repo: 'uurien/meanwaile-games',
      id: 'circle-tap',
      version: '1.0.0',
      gamesDir,
      fetchImpl: impl,
      log: () => {},
    });

    expect(fs.existsSync(path.join(gameDir, 'old-file.js'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8')).version).toBe('1.0.0');
  });

  it('throws when the download response is not ok', async () => {
    const gamesDir = mkTmpDir();
    const { impl } = fakeFetch(Buffer.from(''), false, 404);

    await expect(
      installGame({
        repo: 'uurien/meanwaile-games',
        id: 'circle-tap',
        version: '1.0.0',
        gamesDir,
        fetchImpl: impl,
        log: () => {},
      }),
    ).rejects.toThrow(/Failed to download/);
  });
});

describe('injectGameCsp', () => {
  it('inserts the CSP meta tag right after the opening <head> tag', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ id: 'circle-tap', entry: 'index.html' }));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><head><title>x</title></head><body></body></html>');

    injectGameCsp(dir);

    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}" />`);
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<title>'));
  });

  it('does not duplicate the tag when one is already present', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ id: 'circle-tap', entry: 'index.html' }));
    const original =
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'" /></head><body></body></html>';
    fs.writeFileSync(path.join(dir, 'index.html'), original);

    injectGameCsp(dir);

    expect(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')).toBe(original);
  });

  it('is a no-op when the entry file does not exist', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ id: 'circle-tap', entry: 'index.html' }));

    expect(() => injectGameCsp(dir)).not.toThrow();
  });
});

describe('installAll', () => {
  it('installs every game listed in the manifest', async () => {
    const gamesDir = mkTmpDir();
    const manifestDir = mkTmpDir();
    const manifestPath = path.join(manifestDir, 'games.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        repo: 'uurien/meanwaile-games',
        games: [
          { id: 'circle-tap', version: '1.0.0' },
          { id: 'meanwaile-runner', version: '1.0.0' },
        ],
      }),
    );

    const buffers: Record<string, Buffer> = {
      'https://github.com/uurien/meanwaile-games/releases/download/circle-tap@1.0.0/circle-tap-1.0.0.zip': zipBufferFor(
        'circle-tap',
        '1.0.0',
      ),
      'https://github.com/uurien/meanwaile-games/releases/download/meanwaile-runner@1.0.0/meanwaile-runner-1.0.0.zip':
        zipBufferFor('meanwaile-runner', '1.0.0'),
    };
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      const buffer = buffers[url];
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      };
    };

    await installAll({ manifestPath, gamesDir, fetchImpl, log: () => {} });

    expect(calls).toHaveLength(2);
    expect(fs.existsSync(path.join(gamesDir, 'circle-tap', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(gamesDir, 'meanwaile-runner', 'index.html'))).toBe(true);
  });
});
