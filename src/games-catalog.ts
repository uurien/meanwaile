import * as fs from 'fs';
import * as path from 'path';

export interface GameManifest {
  id: string;
  name: string;
  tagline: string;
  entry: string;
  preview: string;
  implemented: boolean;
}

interface GamesConfig {
  repo: string;
  games: { id: string; version: string }[];
}

interface GameJson {
  id: string;
  name: string;
  tagline: string;
  entry: string;
  preview: string;
}

// games.json (which games to install, see scripts/install-games.js) and each
// installed game's own games/<id>/game.json are the only sources of truth
// for the hub's roster - nothing here is hand-duplicated per game.
export function listGames(rootDir: string): GameManifest[] {
  const config = JSON.parse(fs.readFileSync(path.join(rootDir, 'games.json'), 'utf8')) as GamesConfig;

  return config.games.map(({ id }) => {
    const gameJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'games', id, 'game.json'), 'utf8'),
    ) as GameJson;

    return {
      id: gameJson.id,
      name: gameJson.name,
      tagline: gameJson.tagline,
      entry: `../../games/${id}/${gameJson.entry}`,
      preview: `../../games/${id}/${gameJson.preview}`,
      implemented: true,
    };
  });
}
