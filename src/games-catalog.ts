import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { readInstalledGames } from './game-installer';

export interface GameManifest {
  id: string;
  name: string;
  tagline: string;
  entry: string;
  preview: string;
  implemented: boolean;
  // Marketplace-installed games can be uninstalled straight from the hub;
  // bundled defaults can't (they live inside the read-only app bundle).
  removable: boolean;
}

export interface GamesConfig {
  repo: string;
  games: { id: string; version: string }[];
}

// The build-time default set: which repo to fetch from, and which ids/
// versions are baked into the app bundle (used by main.ts to annotate the
// marketplace catalog with which games are already installed by default).
export function readGamesConfig(rootDir: string): GamesConfig {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'games.json'), 'utf8')) as GamesConfig;
}

interface GameJson {
  id: string;
  name: string;
  tagline: string;
  entry: string;
  preview: string;
}

function readGameManifest(baseDir: string, id: string, removable: boolean): GameManifest {
  const gameJson = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'games', id, 'game.json'), 'utf8'),
  ) as GameJson;

  return {
    id: gameJson.id,
    name: gameJson.name,
    tagline: gameJson.tagline,
    entry: pathToFileURL(path.join(baseDir, 'games', id, gameJson.entry)).toString(),
    preview: pathToFileURL(path.join(baseDir, 'games', id, gameJson.preview)).toString(),
    implemented: true,
    removable,
  };
}

// Two sources of truth, merged for the hub's roster: games.json (the
// default set baked in at build time, see scripts/install-games.js) plus
// userData/installed-games.json (games the user added at runtime via the
// marketplace, see game-installer.ts) - nothing here is hand-duplicated per
// game. Bundled defaults always win on id collision, and are listed first.
export function listGames(rootDir: string, userDataDir: string): GameManifest[] {
  const config = readGamesConfig(rootDir);
  const bundled = config.games.map(({ id }) => readGameManifest(rootDir, id, false));

  const bundledIds = new Set(bundled.map((game) => game.id));
  const installed = readInstalledGames(userDataDir)
    .filter(({ id }) => !bundledIds.has(id))
    .map(({ id }) => readGameManifest(userDataDir, id, true));

  return [...bundled, ...installed];
}
