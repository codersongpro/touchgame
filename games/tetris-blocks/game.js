/* games/tetris-blocks/game.js — 패턴 D (퍼즐 병렬 경쟁): 테트리스 블록 쌓기 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const GAME_DURATION = 75;      // seconds
const BOARD_COLS = 6;
const BOARD_ROWS = 12;
const BASE_FALL_MS = 750;
const MIN_FALL_MS = 320;
const RESULT_PAUSE_MS = getAutoplayPauseMs(1400);

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 테트로미노 정의: 4개 회전 상태(0~3) × 칸 오프셋 [row, col] (3x3 또는 4x4 박스 기준)
const PIECES = {
  I: {
    color: '#4FC3F7',
    states: [
      [[1, 0], [1, 1], [1, 2], [1, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 1], [1, 1], [2, 1], [3, 1]],
    ],
  },
  O: {
    color: '#FFD54F',
    states: [
      [[0, 0], [0, 1], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]],
    ],
  },
  T: {
    color: '#BA68C8',
    states: [
      [[0, 1], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 1]],
      [[0, 1], [1, 0], [1, 1], [2, 1]],
    ],
  },
  S: {
    color: '#81C784',
    states: [
      [[0, 1], [0, 2], [1, 0], [1, 1]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 1], [1, 2], [2, 0], [2, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]],
    ],
  },
  Z: {
    color: '#E57373',
    states: [
      [[0, 0], [0, 1], [1, 1], [1, 2]],
      [[0, 2], [1, 1], [1, 2], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[0, 1], [1, 0], [1, 1], [2, 0]],
    ],
  },
  J: {
    color: '#64B5F6',
    states: [
      [[0, 0], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [0, 2], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 0], [2, 1]],
    ],
  },
  L: {
    color: '#FFB74D',
    states: [
      [[0, 2], [1, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [1, 2], [2, 0]],
      [[0, 0], [0, 1], [1, 1], [2, 1]],
    ],
  },
};
const PIECE_KEYS = Object.keys(PIECES);

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  move(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(300, ctx.currentTime);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06);
  },
  rotate(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
  drop(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.18);
  },
  clear(ctx) {
    [659, 784, 988].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.08;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    });
  },
  toppedOut(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.45);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t); o.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount = 2;
let scores = [];
let boards = [];         // per player: 2D array [row][col] = color string | null
let current = [];         // per player: { key, rot, row, col } | null
let linesCleared = [];    // per player: total lines cleared
let toppedOut = [];       // per player: boolean
let fallHandles = [];     // per player: setTimeout handle
let cellEls = [];         // per player: 2D array of DOM cell elements
let phase = 'idle';       // 'idle' | 'active' | 'done'
let gameTimer = null;
let countdownInterval = null;
let nextHandle = null;

// ── DOM refs ─────────────────────────────────────────────────
const introScreen = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen = document.getElementById('gameScreen');
const resultScreen = document.getElementById('resultScreen');

const backBtn = document.getElementById('backBtn');
const playBtn = document.getElementById('playBtn');
const closeBtn = document.getElementById('closeBtn');
const retryBtn = document.getElementById('retryBtn');
const homeBtn = document.getElementById('homeBtn');

const zonesWrap = document.getElementById('zonesWrap');
const problemTimer = document.getElementById('problemTimer');
const scoreBar = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle = document.getElementById('resultTitle');
const resultWinner = document.getElementById('resultWinner');
const totalRow = document.getElementById('totalRow');

// ── Helpers ──────────────────────────────────────────────────
function showScreen(s) {
  [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active'));
  s.classList.add('active');
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  var count = 3;
  countdownNumber.textContent = count;
  countdownInterval = setInterval(function () {
    count--;
    if (count <= 0) {
      clearInterval(countdownInterval); countdownInterval = null;
      onDone();
    } else {
      countdownNumber.textContent = count;
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight;
      countdownNumber.style.animation = '';
    }
  }, 1000);
}

function clearAllTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (gameTimer) { gameTimer.stop(); gameTimer = null; }
  if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; }
  fallHandles.forEach(h => { if (h) clearTimeout(h); });
  fallHandles = [];
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Piece helpers ────────────────────────────────────────────
function spawnPiece(playerIdx) {
  const key = PIECE_KEYS[rand(0, PIECE_KEYS.length - 1)];
  const col = Math.floor(BOARD_COLS / 2) - 2;
  current[playerIdx] = { key, rot: 0, row: 0, col };
  if (!isValidPosition(playerIdx, current[playerIdx])) {
    handleToppedOut(playerIdx);
  }
}

function pieceCells(piece) {
  return PIECES[piece.key].states[piece.rot];
}

function isValidPosition(playerIdx, piece) {
  const board = boards[playerIdx];
  const cells = PIECES[piece.key].states[piece.rot];
  for (let i = 0; i < cells.length; i++) {
    const r = piece.row + cells[i][0];
    const c = piece.col + cells[i][1];
    if (c < 0 || c >= BOARD_COLS || r >= BOARD_ROWS) return false;
    if (r < 0) continue;
    if (board[r][c]) return false;
  }
  return true;
}

function tryMove(playerIdx, dRow, dCol) {
  const piece = current[playerIdx];
  if (!piece) return false;
  const moved = { key: piece.key, rot: piece.rot, row: piece.row + dRow, col: piece.col + dCol };
  if (isValidPosition(playerIdx, moved)) {
    current[playerIdx] = moved;
    return true;
  }
  return false;
}

function tryRotate(playerIdx) {
  const piece = current[playerIdx];
  if (!piece) return false;
  const rotated = { key: piece.key, rot: (piece.rot + 1) % 4, row: piece.row, col: piece.col };
  if (isValidPosition(playerIdx, rotated)) {
    current[playerIdx] = rotated;
    return true;
  }
  return false;
}

function lockPiece(playerIdx) {
  const piece = current[playerIdx];
  if (!piece) return;
  const board = boards[playerIdx];
  const color = PIECES[piece.key].color;
  const cells = pieceCells(piece);
  cells.forEach(([dr, dc]) => {
    const r = piece.row + dr;
    const c = piece.col + dc;
    if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
      board[r][c] = color;
    }
  });
  current[playerIdx] = null;

  const cleared = clearFullRows(playerIdx);
  if (cleared > 0) {
    linesCleared[playerIdx] += cleared;
    const points = [0, 10, 30, 50, 100][cleared] || 100;
    addScore(playerIdx, points);
    sound.play('clear');
  }

  renderBoard(playerIdx);

  if (phase !== 'active' || toppedOut[playerIdx]) return;
  spawnPiece(playerIdx);
  renderBoard(playerIdx);
  if (!toppedOut[playerIdx]) scheduleFall(playerIdx);
}

function clearFullRows(playerIdx) {
  const board = boards[playerIdx];
  let cleared = 0;
  for (let r = BOARD_ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell)) {
      board.splice(r, 1);
      board.unshift(new Array(BOARD_COLS).fill(null));
      cleared++;
      r++; // re-check same index after shift
    }
  }
  return cleared;
}

function fallInterval(playerIdx) {
  return Math.max(MIN_FALL_MS, BASE_FALL_MS - linesCleared[playerIdx] * 15);
}

function scheduleFall(playerIdx) {
  if (fallHandles[playerIdx]) clearTimeout(fallHandles[playerIdx]);
  fallHandles[playerIdx] = setTimeout(() => tickFall(playerIdx), fallInterval(playerIdx));
}

function tickFall(playerIdx) {
  if (phase !== 'active' || toppedOut[playerIdx]) return;
  if (!tryMove(playerIdx, 1, 0)) {
    lockPiece(playerIdx);
  } else {
    renderBoard(playerIdx);
    scheduleFall(playerIdx);
  }
}

function handleToppedOut(playerIdx) {
  toppedOut[playerIdx] = true;
  current[playerIdx] = null;
  if (fallHandles[playerIdx]) { clearTimeout(fallHandles[playerIdx]); fallHandles[playerIdx] = null; }
  sound.play('toppedOut');
  const zone = getZone(playerIdx);
  if (zone) zone.classList.add('topped-out');

  if (playerCount > 1 && toppedOut.every(t => t)) {
    endGame();
  }
}

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  cellEls = [];

  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="zone-score-${i}">0점</span>
    `;
    zone.appendChild(header);

    const board = document.createElement('div');
    board.className = 'tetris-board';
    board.id = `tetris-board-${i}`;
    board.style.gridTemplateColumns = `repeat(${BOARD_COLS}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${BOARD_ROWS}, 1fr)`;

    const rows = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      const rowEls = [];
      for (let c = 0; c < BOARD_COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'tetris-cell';
        board.appendChild(cell);
        rowEls.push(cell);
      }
      rows.push(rowEls);
    }
    cellEls.push(rows);
    zone.appendChild(board);

    const controls = document.createElement('div');
    controls.className = 'tetris-controls';
    controls.innerHTML = `
      <button class="tetris-btn" data-action="left" aria-label="왼쪽">◀</button>
      <button class="tetris-btn" data-action="rotate" aria-label="회전">⟳</button>
      <button class="tetris-btn" data-action="right" aria-label="오른쪽">▶</button>
      <button class="tetris-btn tetris-btn-drop" data-action="drop" aria-label="빠르게 내리기">▼</button>
    `;
    controls.querySelectorAll('.tetris-btn').forEach(btn => {
      onTap(btn, () => handleControl(i, btn.dataset.action));
    });
    zone.appendChild(controls);

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function handleControl(playerIdx, action) {
  if (phase !== 'active' || toppedOut[playerIdx] || !current[playerIdx]) return;

  if (action === 'left') {
    if (tryMove(playerIdx, 0, -1)) { sound.play('move'); renderBoard(playerIdx); }
  } else if (action === 'right') {
    if (tryMove(playerIdx, 0, 1)) { sound.play('move'); renderBoard(playerIdx); }
  } else if (action === 'rotate') {
    if (tryRotate(playerIdx)) { sound.play('rotate'); renderBoard(playerIdx); }
  } else if (action === 'drop') {
    sound.play('drop');
    while (tryMove(playerIdx, 1, 0)) { /* fall to bottom */ }
    lockPiece(playerIdx);
  }
}

// ── Rendering ────────────────────────────────────────────────
function renderBoard(playerIdx) {
  const board = boards[playerIdx];
  const rows = cellEls[playerIdx];
  const piece = current[playerIdx];
  const overlay = new Set();
  let overlayColor = null;

  if (piece) {
    overlayColor = PIECES[piece.key].color;
    pieceCells(piece).forEach(([dr, dc]) => {
      const r = piece.row + dr;
      const c = piece.col + dc;
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) overlay.add(r + ',' + c);
    });
  }

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cellEl = rows[r][c];
      const isOverlay = overlay.has(r + ',' + c);
      const color = isOverlay ? overlayColor : board[r][c];
      if (color) {
        cellEl.style.background = color;
        cellEl.classList.add('filled');
      } else {
        cellEl.style.background = '';
        cellEl.classList.remove('filled');
      }
    }
  }
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `
      <span class="score-chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="score-chip-val" id="bar-score-${i}">0</span>
    `;
    scoreBar.appendChild(chip);
  }
}

function addScore(playerIdx, amount) {
  scores[playerIdx] += amount;
  const zoneChip = document.getElementById(`zone-score-${playerIdx}`);
  if (zoneChip) zoneChip.textContent = `${scores[playerIdx]}점`;
  const barChip = document.getElementById(`bar-score-${playerIdx}`);
  if (barChip) barChip.textContent = scores[playerIdx];
}

// ── Game flow ────────────────────────────────────────────────
function startGame() {
  scores = new Array(playerCount).fill(0);
  boards = [];
  current = [];
  linesCleared = new Array(playerCount).fill(0);
  toppedOut = new Array(playerCount).fill(false);
  fallHandles = new Array(playerCount).fill(null);
  phase = 'active';

  clearAllTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);

  for (let i = 0; i < playerCount; i++) {
    boards.push(Array.from({ length: BOARD_ROWS }, () => new Array(BOARD_COLS).fill(null)));
    current.push(null);
    spawnPiece(i);
    renderBoard(i);
    scheduleFall(i);
  }

  problemTimer.textContent = GAME_DURATION;
  problemTimer.classList.remove('urgent');

  gameTimer = createTimer(GAME_DURATION, (remaining) => {
    problemTimer.textContent = remaining;
    if (remaining <= 10) problemTimer.classList.add('urgent');
  }, () => {
    endGame();
  });
  gameTimer.start();
}

function endGame() {
  if (phase !== 'active') return;
  phase = 'done';
  clearAllTimers();
  nextHandle = setTimeout(() => showResult(), RESULT_PAUSE_MS);
}

// ── Result ───────────────────────────────────────────────────
function showResult() {
  var scoreResult = reportGameResult({ gameId: 'tetris-blocks', playerCount: playerCount, scores: scores.slice(), metric: 'score' });
  (function () {
    var badge = document.getElementById('bestRecordBadge');
    if (!badge) return;
    if (scoreResult.isNewBest) {
      badge.style.display = '';
      badge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
      createInitialsPrompt(function () {}).open();
    } else if (scoreResult.bestEntry) {
      badge.style.display = '';
      badge.textContent = '이 기기 최고 기록: ' + scoreResult.bestEntry.score + '점';
    }
  })();

  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent = '🏆 게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 우승! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent = '🤝 동점!';
    resultWinner.textContent = `공동 우승: ${labels} (${maxScore}점)`;
  }

  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip = document.createElement('div');
    chip.className = 'total-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${cfg.dot}"></span>
      <span>${cfg.label}</span>
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}점</span>
      ${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}
    `;
    totalRow.appendChild(chip);
  }

  showScreen(resultScreen);
}

// ── Player count selection ───────────────────────────────────
document.querySelectorAll('.player-btn').forEach(btn => {
  onTap(btn, () => {
    document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    playerCount = parseInt(btn.dataset.count, 10);
  });
});

// ── Sound toggle ─────────────────────────────────────────────
onTap(soundToggleIntro, () => {
  sound.toggleMute();
  updateSoundBtn(soundToggleIntro);
});
updateSoundBtn(soundToggleIntro);

// ── Navigation ───────────────────────────────────────────────
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearAllTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
