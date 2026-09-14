'use strict';

// Electron's sandboxed preload environment (the default since Electron 20)
// only exposes a require() polyfill covering electron/events/timers/url - it
// cannot resolve require() of a project-local file like ipc-channels.ts.
// tsc compiles preload.ts to dist/preload.js with a plain require('./ipc-
// channels') like any other module, so this bundles that output in place,
// inlining local requires while leaving `electron` (the one allowlisted
// module preload.ts actually needs) untouched. Runs as part of `npm run
// build`, after tsc.

const esbuild = require('esbuild');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_ENTRY_POINT = path.join(ROOT_DIR, 'dist', 'preload.js');
const DEFAULT_OUTFILE = DEFAULT_ENTRY_POINT;
const DEFAULT_EXTERNAL = ['electron'];

function bundlePreload({
  entryPoint = DEFAULT_ENTRY_POINT,
  outfile = DEFAULT_OUTFILE,
  external = DEFAULT_EXTERNAL,
  log = console.log,
} = {}) {
  esbuild.buildSync({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external,
    allowOverwrite: true,
  });
  log(`[bundle-preload] bundled ${entryPoint} -> ${outfile}`);
}

module.exports = { bundlePreload, DEFAULT_ENTRY_POINT, DEFAULT_OUTFILE, DEFAULT_EXTERNAL };

if (require.main === module) {
  bundlePreload();
}
