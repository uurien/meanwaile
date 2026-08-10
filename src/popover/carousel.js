// Hub screen: lets the user browse the game registry and pick one as a
// swipeable carousel — see design_handoff_game_hub/README.md for the layout
// this reproduces.
const CARD_WIDTH = 280;
const CARD_GAP = 16;
// #root is a fixed 440px (see popover.css) — center the card in it rather
// than guessing at a left inset, which used to leave more room on the right.
const VIEWPORT_WIDTH = 440;
const TRACK_LEFT_PADDING = (VIEWPORT_WIDTH - CARD_WIDTH) / 2;
const DRAG_THRESHOLD = 60;
const SLIDE_STEP = CARD_WIDTH + CARD_GAP;
const LAST_GAME_KEY = 'hub-last-game';

function getLastGameId() {
  return localStorage.getItem(LAST_GAME_KEY);
}

function setLastGameId(id) {
  localStorage.setItem(LAST_GAME_KEY, id);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Static, hand-written markup (no user data interpolated) - safe to set via
// innerHTML under the popover's script-src 'self' CSP, which governs
// resource loading, not inline non-script markup like this.
const TRASH_ICON_SVG =
  '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6h11M8.5 6V4.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V6m-6.5 0 .6 9.4a1 1 0 0 0 1 .9h5.8a1 1 0 0 0 1-.9L14.5 6"/></svg>';

function preview(game) {
  if (!game.preview) return el('div', 'game-card__preview game-card__preview--empty');
  const img = el('img', 'game-card__preview');
  img.src = game.preview;
  img.alt = '';
  return img;
}

function buildCard(game, index, total, onOpenGame, onUninstallGame) {
  const card = el('div', 'game-card');

  const topRow = el('div', 'game-card__top-row');
  topRow.appendChild(el('div', 'game-card__eyebrow', `Game ${index + 1} of ${total}`));
  // Only games installed through the marketplace can be uninstalled from
  // here - bundled defaults live inside the read-only app bundle.
  if (game.removable) {
    const uninstallBtn = el('button', 'game-card__uninstall');
    uninstallBtn.title = 'Uninstall';
    uninstallBtn.innerHTML = TRASH_ICON_SVG;
    // Stop the click from also bubbling into the card's own Start action.
    uninstallBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onUninstallGame(game);
    });
    topRow.appendChild(uninstallBtn);
  }
  card.appendChild(topRow);

  card.appendChild(preview(game));

  const info = el('div', 'game-card__info');
  info.appendChild(el('div', 'game-card__title', game.name));
  info.appendChild(el('div', 'game-card__tagline', game.tagline));
  card.appendChild(info);

  const startBtn = el('button', 'game-card__start', 'Start');
  startBtn.addEventListener('click', () => onOpenGame(game));
  card.appendChild(startBtn);

  return card;
}

// Trailing, non-game slide at the end of the carousel that opens the
// marketplace instead of a game - deliberately its own class (not
// game-card), so it's never counted among the game cards/slides that use
// that selector, while still matching their width for the shared
// index-based SLIDE_STEP geometry.
function buildMarketplaceCard(onOpenMarketplace) {
  const card = el('div', 'marketplace-card');

  card.appendChild(el('div', 'game-card__eyebrow', 'More games'));
  card.appendChild(el('div', 'marketplace-card__icon', '+'));

  const info = el('div', 'game-card__info');
  info.appendChild(el('div', 'game-card__title', 'Get more games'));
  info.appendChild(el('div', 'game-card__tagline', 'Browse the full catalog'));
  card.appendChild(info);

  const browseBtn = el('button', 'marketplace-card__start', 'Browse');
  browseBtn.addEventListener('click', () => onOpenMarketplace());
  card.appendChild(browseBtn);

  return card;
}

export function createHub({ container, games, onOpenGame, onOpenMarketplace, onUninstallGame }) {
  container.innerHTML = `
    <div id="carousel">
      <button id="prev-btn" class="arrow-btn" aria-label="Previous game">‹</button>
      <button id="next-btn" class="arrow-btn" aria-label="Next game">›</button>
      <div id="carousel-viewport">
        <div id="carousel-track"></div>
      </div>
      <div id="dots"></div>
    </div>
  `;

  const track = container.querySelector('#carousel-track');
  const viewport = container.querySelector('#carousel-viewport');
  const prevBtn = container.querySelector('#prev-btn');
  const nextBtn = container.querySelector('#next-btn');
  const dotsEl = container.querySelector('#dots');

  const totalSlides = games.length + 1;
  const lastGameIndex = games.findIndex((game) => game.id === getLastGameId());

  let activeIndex = Math.max(0, lastGameIndex);
  let dragging = false;
  let dragStartX = 0;
  let dragDeltaX = 0;
  let mounting = true;

  function handleOpenGame(game) {
    setLastGameId(game.id);
    onOpenGame(game);
  }

  function addDot(index) {
    const dot = el('div', index === activeIndex ? 'dot dot--active' : 'dot');
    dot.addEventListener('click', () => goTo(index));
    dotsEl.appendChild(dot);
  }

  games.forEach((game, i) => {
    track.appendChild(buildCard(game, i, games.length, handleOpenGame, onUninstallGame));
    addDot(i);
  });
  track.appendChild(buildMarketplaceCard(onOpenMarketplace));
  addDot(games.length);

  function atStart() {
    return activeIndex === 0;
  }

  function atEnd() {
    return activeIndex === totalSlides - 1;
  }

  function render() {
    const baseX = TRACK_LEFT_PADDING - activeIndex * SLIDE_STEP;
    track.style.transition = dragging || mounting ? 'none' : 'transform 0.35s cubic-bezier(0.2,0.8,0.2,1)';
    track.style.transform = `translateX(${baseX + dragDeltaX}px)`;

    prevBtn.disabled = atStart();
    nextBtn.disabled = atEnd();

    Array.from(dotsEl.children).forEach((dot, i) => {
      dot.classList.toggle('dot--active', i === activeIndex);
    });
  }

  function goTo(index) {
    activeIndex = Math.min(totalSlides - 1, Math.max(0, index));
    render();
  }

  prevBtn.addEventListener('click', () => goTo(activeIndex - 1));
  nextBtn.addEventListener('click', () => goTo(activeIndex + 1));

  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragDeltaX = 0;
    render();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragDeltaX = e.clientX - dragStartX;
    render();
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (dragDeltaX < -DRAG_THRESHOLD && !atEnd()) activeIndex += 1;
    else if (dragDeltaX > DRAG_THRESHOLD && !atStart()) activeIndex -= 1;
    dragDeltaX = 0;
    render();
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointerleave', endDrag);

  render();
  mounting = false;
}
