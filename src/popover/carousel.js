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

function preview(game) {
  if (!game.preview) return el('div', 'game-card__preview game-card__preview--empty');
  const img = el('img', 'game-card__preview');
  img.src = game.preview;
  img.alt = '';
  return img;
}

function buildCard(game, index, total, onOpenGame) {
  const card = el('div', 'game-card');

  card.appendChild(el('div', 'game-card__eyebrow', `Game ${index + 1} of ${total}`));
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

export function createHub({ container, games, onOpenGame }) {
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

  games.forEach((game, i) => {
    track.appendChild(buildCard(game, i, games.length, handleOpenGame));

    const dot = el('div', i === activeIndex ? 'dot dot--active' : 'dot');
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
  });

  function atStart() {
    return activeIndex === 0;
  }

  function atEnd() {
    return activeIndex === games.length - 1;
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
    activeIndex = Math.min(games.length - 1, Math.max(0, index));
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
