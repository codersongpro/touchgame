/* games/mirror-maze/game.js — 패턴 D (퍼즐 병렬 경쟁): 거울 미로 탈출 */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;        // seconds
const RESULT_PAUSE_MS = getAutoplayPauseMs(2200);
const MAZE_SIZE = 5;          // 5x5 cells
const DIR_OPPOSITE = { u: 'd', d: 'u', l: 'r', r: 'l' };

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.start(t); o.stop(t + 0.32);
    });
  },
  slide(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sine';
    o.frequency.setValueAtTime(440, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  },
  wallbump(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(120, ctx.currentTime);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.12);
  },
  tick(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
  },
  timeout(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
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
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zonePositions = [];          // each player's current cell index
let zoneMoves = [];
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null;
let nextHandle = null;
let timeRemaining = ROUND_TIME;
let mazePassages = null;         // shared maze layout for this round (array of {u,r,d,l})
const START_CELL = 0;
const GOAL_CELL = MAZE_SIZE * MAZE_SIZE - 1;

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
const questionCounter = document.getElementById('questionCounter');
const problemTimer = document.getElementById('problemTimer');
const problemStatus = document.getElementById('problemStatus');
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

var countdownInterval = null;
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

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// ── Maze generation (recursive-backtracker spanning tree — every cell is
// guaranteed reachable from every other cell, so START → GOAL always has
// exactly one simple path) ────────────────────────────────────
function generateMaze() {
  const cellCount = MAZE_SIZE * MAZE_SIZE;
  const visited = new Array(cellCount).fill(false);
  const passages = [];
  for (let i = 0; i < cellCount; i++) passages.push({ u: false, r: false, d: false, l: false });

  const stack = [0];
  visited[0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const r = Math.floor(cur / MAZE_SIZE), c = cur % MAZE_SIZE;
    const options = [];
    if (r > 0 && !visited[cur - MAZE_SIZE]) options.push({ dir: 'u', next: cur - MAZE_SIZE });
    if (c < MAZE_SIZE - 1 && !visited[cur + 1]) options.push({ dir: 'r', next: cur + 1 });
    if (r < MAZE_SIZE - 1 && !visited[cur + MAZE_SIZE]) options.push({ dir: 'd', next: cur + MAZE_SIZE });
    if (c > 0 && !visited[cur - 1]) options.push({ dir: 'l', next: cur - 1 });

    if (options.length) {
      const choice = options[Math.floor(Math.random() * options.length)];
      passages[cur][choice.dir] = true;
      passages[choice.next][DIR_OPPOSITE[choice.dir]] = true;
      visited[choice.next] = true;
      stack.push(choice.next);
    } else {
      stack.pop();
    }
  }
  return passages;
}

function tryMove(passages, fromIdx, dir) {
  if (!passages[fromIdx][dir]) return fromIdx; // wall blocks the move
  const r = Math.floor(fromIdx / MAZE_SIZE), c = fromIdx % MAZE_SIZE;
  if (dir === 'u') return fromIdx - MAZE_SIZE;
  if (dir === 'd') return fromIdx + MAZE_SIZE;
  if (dir === 'l') return fromIdx - 1;
  if (dir === 'r') return fromIdx + 1;
  return fromIdx;
}

// ── Build zones ──────────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-moves" id="moves-${i}">0회</span>
    `;
    zone.appendChild(header);

    const mazeWrap = document.createElement('div');
    mazeWrap.className = 'maze-mirror-wrap';
    const grid = document.createElement('div');
    grid.className = 'puzzle-grid maze-grid';
    grid.id = `puzzle-grid-${i}`;
    mazeWrap.appendChild(grid);
    zone.appendChild(mazeWrap);

    const dpad = document.createElement('div');
    dpad.className = 'maze-dpad';
    dpad.innerHTML = `
      <button class="maze-dpad-btn maze-up" data-dir="u">▲</button>
      <button class="maze-dpad-btn maze-left" data-dir="l">◀</button>
      <button class="maze-dpad-btn maze-right" data-dir="r">▶</button>
      <button class="maze-dpad-btn maze-down" data-dir="d">▼</button>
    `;
    zone.appendChild(dpad);
    dpad.querySelectorAll('.maze-dpad-btn').forEach((btn) => {
      onTap(btn, () => handleMove(i, btn.dataset.dir));
    });

    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function renderMaze(playerIdx) {
  const grid = document.getElementById(`puzzle-grid-${playerIdx}`);
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${MAZE_SIZE}, 1fr)`;
  const pos = zonePositions[playerIdx];
  for (let idx = 0; idx < MAZE_SIZE * MAZE_SIZE; idx++) {
    const cell = document.createElement('div');
    cell.className = 'maze-cell';
    if (idx === pos) cell.classList.add('maze-player');
    if (idx === GOAL_CELL) cell.classList.add('maze-goal');
    const p = mazePassages[idx];
    if (!p.u) cell.classList.add('wall-u');
    if (!p.r) cell.classList.add('wall-r');
    if (!p.d) cell.classList.add('wall-d');
    if (!p.l) cell.classList.add('wall-l');
    grid.appendChild(cell);
  }
}

function updateMovesChip(playerIdx) {
  const el = document.getElementById(`moves-${playerIdx}`);
  if (el) el.textContent = `${zoneMoves[playerIdx]}회`;
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

function updateBarScore(playerIdx) {
  const el = document.getElementById(`bar-score-${playerIdx}`);
  if (el) el.textContent = scores[playerIdx];
}

// ── Movement handler ─────────────────────────────────────────
function handleMove(playerIdx, dir) {
  if (phase !== 'active') return;
  if (zoneSolved[playerIdx]) return;

  const from = zonePositions[playerIdx];
  const to = tryMove(mazePassages, from, dir);
  if (to === from) {
    sound.play('wallbump');
    return;
  }
  zonePositions[playerIdx] = to;
  zoneMoves[playerIdx]++;
  sound.play('slide');

  renderMaze(playerIdx);
  updateMovesChip(playerIdx);

  if (to === GOAL_CELL) {
    handleSolve(playerIdx);
  }
}

function handleSolve(winnerIdx) {
  if (zoneSolved[winnerIdx]) return;
  zoneSolved[winnerIdx] = true;

  const zone = getZone(winnerIdx);
  zone.classList.add('solved');

  if (roundResults.length === roundIdx) {
    roundResults.push({ winnerIdx, timedOut: false });
    scores[winnerIdx]++;
    updateBarScore(winnerIdx);

    sound.play('ding');
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 승리!`;

    for (let i = 0; i < playerCount; i++) {
      if (i !== winnerIdx && !zoneSolved[i]) {
        getZone(i).classList.add('locked');
      }
    }

    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

// ── Timer ────────────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;

    if (timeRemaining <= 5) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }

    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');

  for (let i = 0; i < playerCount; i++) {
    if (!zoneSolved[i]) {
      getZone(i).classList.add('locked');
    }
  }

  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 도착하지 못했어요`;

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';

  mazePassages = generateMaze();
  zonePositions = [];
  zoneMoves = [];
  zoneSolved = [];

  for (let i = 0; i < playerCount; i++) {
    zonePositions.push(START_CELL);
    zoneMoves.push(0);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) {
      zone.classList.remove('solved', 'locked');
    }
    renderMaze(i);
    updateMovesChip(i);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '거꾸로 보이는 미로! 방향에 유의하세요!';

  startCountdown();
}

function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

function startGame() {
  roundIdx = 0;
  scores = new Array(playerCount).fill(0);
  roundResults = [];
  phase = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Result ───────────────────────────────────────────────────
function showResult() {
  var scoreResult = reportGameResult({ gameId: 'mirror-maze', playerCount: playerCount, scores: scores.slice(), metric: 'score' });
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

  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent = '무승부!';
    resultWinner.textContent = '아무도 라운드를 이기지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 우승! (${maxScore}승)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}승)`;
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
      <span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>
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
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
