import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

// Runtime counterpart to scripts/install-games.js: that script is a
// dependency-light CommonJS file run by npm's postinstall step, before
// dist/ exists, so it can't share compiled src/ code without breaking the
// install. This module implements the same download/extract/manifest
// conventions independently for games the user opts into at runtime via the
// gallery, storing them under userData (the only location guaranteed
// writable across macOS/Windows/Linux installs) instead of the app bundle.

export interface InstalledGame {
  id: string;
  version: string;
}

interface InstalledGamesManifest {
  games: InstalledGame[];
}

function manifestPath(userDataDir: string): string {
  return path.join(userDataDir, 'installed-games.json');
}

function gamesDir(userDataDir: string): string {
  return path.join(userDataDir, 'games');
}

export function readInstalledGames(userDataDir: string): InstalledGame[] {
  try {
    const raw = fs.readFileSync(manifestPath(userDataDir), 'utf8');
    const parsed = JSON.parse(raw) as Partial<InstalledGamesManifest>;
    return Array.isArray(parsed.games) ? parsed.games : [];
  } catch {
    return [];
  }
}

function writeInstalledGames(userDataDir: string, games: InstalledGame[]): void {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(manifestPath(userDataDir), JSON.stringify({ games }, null, 2));
}

export function addInstalledGame(userDataDir: string, game: InstalledGame): void {
  const games = readInstalledGames(userDataDir).filter(({ id }) => id !== game.id);
  games.push(game);
  writeInstalledGames(userDataDir, games);
}

export function removeInstalledGame(userDataDir: string, id: string): void {
  writeInstalledGames(
    userDataDir,
    readInstalledGames(userDataDir).filter((game) => game.id !== id),
  );
}

export function assetUrl(repo: string, id: string, version: string): string {
  return `https://github.com/${repo}/releases/download/${id}@${version}/${id}-${version}.zip`;
}

function installedVersion(gameDir: string): string | null {
  const manifest = path.join(gameDir, 'game.json');
  if (!fs.existsSync(manifest)) return null;
  try {
    return (JSON.parse(fs.readFileSync(manifest, 'utf8')).version as string | undefined) ?? null;
  } catch {
    return null;
  }
}

async function downloadZip(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function extractZip(buffer: Buffer, targetDir: string): void {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  new AdmZip(buffer).extractAllTo(targetDir, true);
}

// Games run in a sandboxed iframe (sandbox="allow-scripts", no
// allow-same-origin - see src/popover/index.html) with no network access of
// its own beyond same-origin, so this CSP is belt-and-braces against a
// compromised or malicious game bundle exfiltrating data or phoning home:
// no cross-origin fetches, no embedding other frames/objects, no forms.
export const GAME_CSP =
  "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

// Stamps the CSP onto the game's entry HTML so it applies even though the
// bundle is loaded from a plain file:// URL (no HTTP server to send a CSP
// response header from). Best-effort: skipped (not thrown) for malformed or
// unconventional bundles so a broken game.json can't crash installation.
export function injectGameCsp(gameDir: string): void {
  let entry = 'index.html';
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8'));
    if (typeof manifest.entry === 'string') entry = manifest.entry;
  } catch {
    // game.json missing/malformed - fall back to the index.html convention
  }

  const entryPath = path.join(gameDir, entry);
  if (!fs.existsSync(entryPath)) return;

  const html = fs.readFileSync(entryPath, 'utf8');
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) return;
  if (!/<head[\s>]/i.test(html)) return;

  const patched = html.replace(
    /<head(\s[^>]*)?>/i,
    (match) => `${match}\n  <meta http-equiv="Content-Security-Policy" content="${GAME_CSP}" />`,
  );
  fs.writeFileSync(entryPath, patched);
}

export interface InstallGameOptions {
  repo: string;
  id: string;
  version: string;
  userDataDir: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

export async function installGame({
  repo,
  id,
  version,
  userDataDir,
  fetchImpl = fetch,
  log = console.log,
}: InstallGameOptions): Promise<void> {
  const gameDir = path.join(gamesDir(userDataDir), id);
  if (installedVersion(gameDir) === version) {
    log(`[gallery] ${id}@${version} already installed, skipping`);
    return;
  }
  const url = assetUrl(repo, id, version);
  log(`[gallery] installing ${id}@${version} from ${url}`);
  const buffer = await downloadZip(url, fetchImpl);
  extractZip(buffer, gameDir);
  injectGameCsp(gameDir);
  addInstalledGame(userDataDir, { id, version });
  log(`[gallery] installed ${id}@${version}`);
}

export function uninstallGame(userDataDir: string, id: string): void {
  fs.rmSync(path.join(gamesDir(userDataDir), id), { recursive: true, force: true });
  removeInstalledGame(userDataDir, id);
}
