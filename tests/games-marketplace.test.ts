import { describe, it, expect } from 'vitest';
import { fetchCatalog } from '../src/games-marketplace';

const REPO = 'uurien/meanwaile-games';
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;

function fakeFetch(routes: Record<string, { ok?: boolean; status?: number; json?: unknown; bytes?: Buffer }>) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const route = routes[url];
    if (!route) {
      return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return {
      ok: route.ok ?? true,
      status: route.status ?? 200,
      statusText: (route.ok ?? true) ? 'OK' : 'Not Found',
      json: async () => route.json,
      arrayBuffer: async () => {
        const buffer = route.bytes ?? Buffer.from('');
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      },
    };
  };
  return { impl, calls };
}

describe('fetchCatalog', () => {
  it('fetches collection.json, each game.json and preview image, and merges them in catalog order', async () => {
    const { impl, calls } = fakeFetch({
      [`${RAW}/collection.json`]: {
        json: {
          games: [
            { id: 'circle-tap', path: 'games/circle-tap', version: '1.0.0' },
            { id: 'meanwaile-maze', path: 'games/meanwaile-maze', version: '0.1.0' },
          ],
        },
      },
      [`${RAW}/games/circle-tap/game.json`]: {
        json: { name: 'CircleTap', tagline: 'Tap the circles', description: 'A tapping game.', preview: 'preview.png' },
      },
      [`${RAW}/games/circle-tap/preview.png`]: { bytes: Buffer.from('circle-tap-preview') },
      [`${RAW}/games/meanwaile-maze/game.json`]: {
        json: { name: 'Meanwaile Maze', tagline: 'Find a way out', description: 'A maze game.', preview: 'preview.png' },
      },
      [`${RAW}/games/meanwaile-maze/preview.png`]: { bytes: Buffer.from('maze-preview') },
    });

    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });

    expect(result).toEqual({
      ok: true,
      games: [
        {
          id: 'circle-tap',
          name: 'CircleTap',
          tagline: 'Tap the circles',
          description: 'A tapping game.',
          version: '1.0.0',
          previewDataUri: `data:image/png;base64,${Buffer.from('circle-tap-preview').toString('base64')}`,
        },
        {
          id: 'meanwaile-maze',
          name: 'Meanwaile Maze',
          tagline: 'Find a way out',
          description: 'A maze game.',
          version: '0.1.0',
          previewDataUri: `data:image/png;base64,${Buffer.from('maze-preview').toString('base64')}`,
        },
      ],
    });
    expect(calls).toContain(`${RAW}/collection.json`);
    expect(calls).toContain(`${RAW}/games/circle-tap/game.json`);
    expect(calls).toContain(`${RAW}/games/circle-tap/preview.png`);
  });

  it('returns ok:false when collection.json cannot be fetched', async () => {
    const { impl } = fakeFetch({});
    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/collection\.json/);
  });

  it('returns ok:false when a game manifest cannot be fetched', async () => {
    const { impl } = fakeFetch({
      [`${RAW}/collection.json`]: {
        json: { games: [{ id: 'circle-tap', path: 'games/circle-tap', version: '1.0.0' }] },
      },
    });
    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });
    expect(result.ok).toBe(false);
  });

  it.each([
    ['preview.jpg', 'image/jpeg'],
    ['preview.jpeg', 'image/jpeg'],
    ['preview.gif', 'image/gif'],
    ['preview.svg', 'image/svg+xml'],
  ])('picks the mime type from the preview file extension: %s -> %s', async (previewFile, mime) => {
    const { impl } = fakeFetch({
      [`${RAW}/collection.json`]: {
        json: { games: [{ id: 'circle-tap', path: 'games/circle-tap', version: '1.0.0' }] },
      },
      [`${RAW}/games/circle-tap/game.json`]: {
        json: { name: 'CircleTap', tagline: '', description: '', preview: previewFile },
      },
      [`${RAW}/games/circle-tap/${previewFile}`]: { bytes: Buffer.from('preview-bytes') },
    });

    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.games[0].previewDataUri).toMatch(new RegExp(`^data:${mime.replace('+', '\\+')};base64,`));
  });

  it('stringifies a non-Error rejection from the underlying fetch, still including the URL', async () => {
    const impl = async () => {
      throw 'boom';
    };
    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('boom');
      expect(result.error).toContain('collection.json');
    }
  });

  it('includes the preview image URL when its request throws at the network level', async () => {
    const previewUrl = `${RAW}/games/circle-tap/preview.png`;
    const impl = async (url: string) => {
      if (url === previewUrl) throw new Error('fetch failed');
      const routes: Record<string, { json?: unknown }> = {
        [`${RAW}/collection.json`]: {
          json: { games: [{ id: 'circle-tap', path: 'games/circle-tap', version: '1.0.0' }] },
        },
        [`${RAW}/games/circle-tap/game.json`]: {
          json: { name: 'CircleTap', tagline: '', description: '', preview: 'preview.png' },
        },
      };
      const route = routes[url];
      return { ok: true, status: 200, statusText: 'OK', json: async () => route?.json };
    };

    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(previewUrl);
  });

  it('returns ok:false when a preview image cannot be fetched', async () => {
    const { impl } = fakeFetch({
      [`${RAW}/collection.json`]: {
        json: { games: [{ id: 'circle-tap', path: 'games/circle-tap', version: '1.0.0' }] },
      },
      [`${RAW}/games/circle-tap/game.json`]: {
        json: { name: 'CircleTap', tagline: 'Tap the circles', description: 'A tapping game.', preview: 'preview.png' },
      },
    });
    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });
    expect(result.ok).toBe(false);
  });

  it('returns ok:false with the request URL when the underlying fetch throws (e.g. offline)', async () => {
    const impl = async () => {
      throw new Error('fetch failed');
    };
    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('collection.json');
      expect(result.error).toContain(`${RAW}/collection.json`);
      expect(result.error).toContain('fetch failed');
    }
  });

  it('includes the underlying cause (e.g. DNS failure) in the error when present', async () => {
    const impl = async () => {
      throw new Error('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND raw.githubusercontent.com') });
    };
    const result = await fetchCatalog({ repo: REPO, fetchImpl: impl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ENOTFOUND');
  });
});
