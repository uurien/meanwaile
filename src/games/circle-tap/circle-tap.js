import { BOARD_SIZE, CircleTapEngine } from './logic.js';

const RECORD_KEY = 'circle-tap-record';

const board = document.getElementById('board');
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const recordEl = document.getElementById('record-score');

const engine = new CircleTapEngine();
const cells = [];

for (let i = 0; i < BOARD_SIZE; i++) {
  const cell = document.createElement('button');
  cell.className = 'cell';
  cell.dataset.index = String(i);
  cell.addEventListener('click', () => handleClick(i));
  board.appendChild(cell);
  cells.push(cell);
}

let rafId = null;
let lastFrameAt = null;

function getRecord() {
  const raw = localStorage.getItem(RECORD_KEY);
  return raw ? Number(raw) : 0;
}

function setRecord(value) {
  localStorage.setItem(RECORD_KEY, String(value));
}

function render() {
  scoreEl.textContent = String(engine.score);
  for (let i = 0; i < cells.length; i++) {
    cells[i].classList.toggle('active', engine.cells[i] !== null);
    cells[i].style.setProperty('--progress', String(engine.progressFor(i)));
  }
}

function handleClick(index) {
  if (engine.gameOver || rafId === null) return;
  engine.click(index);
  if (engine.gameOver) {
    endGame();
  } else {
    render();
  }
}

function endGame() {
  cancelLoop();
  const record = Math.max(engine.score, getRecord());
  setRecord(record);
  finalScoreEl.textContent = String(engine.score);
  recordEl.textContent = String(record);
  gameOverEl.hidden = false;
  render();
}

function restart() {
  gameOverEl.hidden = true;
  engine.reset();
  render();
  startLoop();
}

gameOverEl.addEventListener('click', restart);

function loop(now) {
  if (lastFrameAt === null) lastFrameAt = now;
  const dt = now - lastFrameAt;
  lastFrameAt = now;
  engine.tick(dt);
  if (engine.gameOver) {
    endGame();
    return;
  }
  render();
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  lastFrameAt = null;
  rafId = requestAnimationFrame(loop);
}

function cancelLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function resume() {
  if (engine.gameOver || rafId !== null) return;
  startLoop();
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'game:pause') cancelLoop();
  if (e.data?.type === 'game:resume') resume();
});

render();
startLoop();
