'use strict';

// Downloads the game bundles listed in games.json from the meanwaile-games
// releases (tag `<id>@<version>`, asset `<id>-<version>.zip`) into
// games/<id>/ (a sibling of src/, dist/, and node_modules/ - not part of
// this repo's hand-written source), replacing whatever content games/<id>/
// held before it. Runs as the `postinstall` npm lifecycle script, so
// `npm install`/`npm ci` alone is enough to populate games/.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_MANIFEST_PATH = path.join(ROOT_DIR, 'games.json');
const DEFAULT_GAMES_DIR = path.join(ROOT_DIR, 'games');

function readManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (typeof manifest.repo !== 'string' || !Array.isArray(manifest.games)) {
    throw new Error(`Invalid games manifest at ${manifestPath}: expected { repo, games[] }`);
  }
  return manifest;
}

function assetUrl(repo, id, version) {
  return `https://github.com/${repo}/releases/download/${id}@${version}/${id}-${version}.zip`;
}

function installedVersion(gameDir) {
  const manifestPath = path.join(gameDir, 'game.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

async function downloadZip(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function extractZip(buffer, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  new AdmZip(buffer).extractAllTo(targetDir, true);
}

// Kept in sync with GAME_CSP/injectGameCsp in src/game-installer.ts (see the
// comment there for why - this script can't import compiled src/ code
// during postinstall). Games run in a sandboxed iframe with no
// allow-same-origin, so this CSP is belt-and-braces against a compromised
// or malicious game bundle exfiltrating data or phoning home.
const GAME_CSP =
  "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

function injectGameCsp(gameDir) {
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

async function installGame({ repo, id, version, gamesDir, fetchImpl = fetch, log = console.log }) {
  const gameDir = path.join(gamesDir, id);
  if (installedVersion(gameDir) === version) {
    log(`[games] ${id}@${version} already installed, skipping`);
    return;
  }
  const url = assetUrl(repo, id, version);
  log(`[games] installing ${id}@${version} from ${url}`);
  const buffer = await downloadZip(url, fetchImpl);
  extractZip(buffer, gameDir);
  injectGameCsp(gameDir);
  log(`[games] installed ${id}@${version}`);
}

async function installAll({
  manifestPath = DEFAULT_MANIFEST_PATH,
  gamesDir = DEFAULT_GAMES_DIR,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const manifest = readManifest(manifestPath);
  for (const game of manifest.games) {
    await installGame({ repo: manifest.repo, id: game.id, version: game.version, gamesDir, fetchImpl, log });
  }
}

module.exports = {
  readManifest,
  assetUrl,
  installedVersion,
  downloadZip,
  extractZip,
  GAME_CSP,
  injectGameCsp,
  installGame,
  installAll,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_GAMES_DIR,
};

if (require.main === module) {
  installAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
