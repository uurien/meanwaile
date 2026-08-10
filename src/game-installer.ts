import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

// Runtime counterpart to scripts/install-games.js: that script is a
// dependency-light CommonJS file run by npm's postinstall step, before
// dist/ exists, so it can't share compiled src/ code without breaking the
// install. This module implements the same download/extract/manifest
// conventions independently for games the user opts into at runtime via the
// marketplace, storing them under userData (the only location guaranteed
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
    log(`[marketplace] ${id}@${version} already installed, skipping`);
    return;
  }
  const url = assetUrl(repo, id, version);
  log(`[marketplace] installing ${id}@${version} from ${url}`);
  const buffer = await downloadZip(url, fetchImpl);
  extractZip(buffer, gameDir);
  addInstalledGame(userDataDir, { id, version });
  log(`[marketplace] installed ${id}@${version}`);
}

export function uninstallGame(userDataDir: string, id: string): void {
  fs.rmSync(path.join(gamesDir(userDataDir), id), { recursive: true, force: true });
  removeInstalledGame(userDataDir, id);
}
