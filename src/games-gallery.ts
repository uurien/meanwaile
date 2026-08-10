import * as path from 'path';

// Fetches the live game catalog from meanwaile-games, entirely in the main
// process — the gallery renderer never talks to the network directly,
// it only receives the resolved result over IPC. collection.json is the
// source of truth that repo's own README documents for this purpose; each
// game's own game.json/preview.png (not duplicated into collection.json)
// fill in the card details.

export interface CatalogGame {
  id: string;
  name: string;
  tagline: string;
  description: string;
  version: string;
  previewDataUri: string;
}

export type CatalogResult = { ok: true; games: CatalogGame[] } | { ok: false; error: string };

interface CollectionEntry {
  id: string;
  path: string;
  version: string;
}

interface GameManifestJson {
  name: string;
  tagline: string;
  description: string;
  preview: string;
}

function rawBaseUrl(repo: string): string {
  return `https://raw.githubusercontent.com/${repo}/main`;
}

// fetchImpl(url) itself can reject before any HTTP response exists (DNS
// failure, no connectivity, TLS error, ...) - undici's error for that case
// is just the generic "fetch failed", which is useless without the URL it
// was trying to reach and, if present, the underlying cause (e.g. "getaddrinfo
// ENOTFOUND ..."). Wrap it here so every caller's error carries both.
async function request(url: string, fetchImpl: typeof fetch, whatFor: string): Promise<Response> {
  try {
    return await fetchImpl(url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? ` (${String(err.cause)})` : '';
    throw new Error(`Network error fetching ${whatFor} (${url}): ${reason}${cause}`);
  }
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch, whatFor: string): Promise<T> {
  const response = await request(url, fetchImpl, whatFor);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${whatFor} (${url}): ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function mimeTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

async function fetchPreviewDataUri(url: string, fileName: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await request(url, fetchImpl, 'preview image');
  if (!response.ok) {
    throw new Error(`Failed to fetch preview image (${url}): ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${mimeTypeFor(fileName)};base64,${buffer.toString('base64')}`;
}

export async function fetchCatalog({
  repo,
  fetchImpl = fetch,
}: {
  repo: string;
  fetchImpl?: typeof fetch;
}): Promise<CatalogResult> {
  try {
    const base = rawBaseUrl(repo);
    const collection = await fetchJson<{ games: CollectionEntry[] }>(`${base}/collection.json`, fetchImpl, 'collection.json');

    const games = await Promise.all(
      collection.games.map(async (entry): Promise<CatalogGame> => {
        const manifest = await fetchJson<GameManifestJson>(
          `${base}/${entry.path}/game.json`,
          fetchImpl,
          `${entry.id}/game.json`,
        );
        const previewDataUri = await fetchPreviewDataUri(
          `${base}/${entry.path}/${manifest.preview}`,
          manifest.preview,
          fetchImpl,
        );
        return {
          id: entry.id,
          name: manifest.name,
          tagline: manifest.tagline,
          description: manifest.description,
          version: entry.version,
          previewDataUri,
        };
      }),
    );

    return { ok: true, games };
  } catch (err) {
    // request() always normalizes fetch-level failures into Error instances
    // (see above), and JSON parsing/property-access errors are Error
    // instances too - the non-Error fallback below defends against an
    // unexpected non-Error throw, which isn't reachable through this
    // function's own code paths.
    /* v8 ignore next */
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
