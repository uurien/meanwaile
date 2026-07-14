// Single source of truth for which games the hub can show. Adding a real
// game later is just a new entry here (see AGENTS.md's "game bundles" idea) -
// nothing else in the hub needs to change.
export const GAMES = [
  {
    id: 'circle-tap',
    name: 'CircleTap',
    tagline: 'Tap the circles',
    entry: '../games/circle-tap/index.html',
    preview: '../games/circle-tap/preview.png',
    implemented: true,
  },
  {
    id: 'meanwaile-runner',
    name: 'Meanwaile Runner',
    tagline: 'Run and jump',
    entry: '../games/meanwaile-runner/index.html',
    preview: '../games/meanwaile-runner/preview.png',
    implemented: true,
  },
];
