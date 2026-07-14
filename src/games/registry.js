// Single source of truth for which games the hub can show. Adding a real
// game later is just a new entry here (see AGENTS.md's "game bundles" idea) -
// nothing else in the hub needs to change.
export const GAMES = [
  {
    id: 'circle-tap',
    name: 'CircleTap',
    tagline: 'Toca los círculos',
    entry: '../games/circle-tap/index.html',
    preview: '../games/circle-tap/preview.png',
    implemented: true,
  },
  {
    id: 'game-2',
    name: 'Juego 2',
    tagline: 'Próximamente',
    entry: null,
    preview: null,
    implemented: false,
  },
];
