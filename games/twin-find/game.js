/* games/twin-find/game.js — 패턴 C (협력) */
'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS = 8;
const TARGET_REVEAL_MS = 2000;   // 목표 그림 표시 시간
const RESULT_PAUSE_MS = 1800;
const PLAYER_COUNT = 2;          // 2P 전용 협력 게임
const GRID_CELLS = 9;            // 3x3

// 9개 이상의 이모지 풀 (라운드별 9개 선택)
const ICON_POOL = [
  '🦊','🐱','🐶','🐰','🐼','🦁','🐯','🐮','🐷',
  '🐸','🐵','🐔','🐧','🐢','🐝','🦄','🐙','🦋',
  '🍎','🍌','🍇','🍓','🍉','🍊','🍑','🍒','🥝',
  '🚗','🚌','🚲','✈️','🚀','⛵','🚂','🚁','🛸'
];

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1' },
  { label: 'P2', dot: '#E53935' },
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
  tap(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'triangle';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
  },
  wrong(ctx) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.35);
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
let roundIdx = 0;
let teamScore = 0;
let perfectCount = 0;
let currentTarget = '';
let currentIcons = [];        // 9 icons for this round
let playerGrids = [[], []];   // each player's 9-icon arrangement (shuffled)
let playerPicked = [null, null]; // {iconIdx, correct} or null
let phase = 'idle';
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

const questionCounter = document.getElementById('questionCounter');
const scorePill = document.getElementById('scorePill');
const targetArea = document.getElementById('targetArea');
const targetIcon = document.getElementById('targetIcon');
const problemStatus = document.getElementById('problemStatus');

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
  if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Build grids ──────────────────────────────────────────────
function renderGrid(playerIdx) {
  const grid = document.getElementById(`grid-${playerIdx}`);
  if (!grid) return;
  grid.innerHTML = '';
  playerGrids[playerIdx].forEach((icon, posIdx) => {
    const cell = document.createElement('button');
    cell.className = 'card-cell';
    cell.textContent = icon;
    cell.dataset.player = playerIdx;
    cell.dataset.pos = posIdx;
    onTap(cell, () => handleCellTap(playerIdx, posIdx));
    grid.appendChild(cell);
  });
}

function setBoardStatus(playerIdx, text, cls) {
  const el = document.getElementById(`status-${playerIdx}`);
  if (!el) return;
  el.textContent = text;
  el.className = 'board-status' + (cls ? ' ' + cls : '');
}

function getBoard(playerIdx) {
  return document.querySelector(`.board[data-player="${playerIdx}"]`);
}

function disableBoard(playerIdx, disabled) {
  const grid = document.getElementById(`grid-${playerIdx}`);
  if (!grid) return;
  grid.querySelectorAll('.card-cell').forEach(c => c.classList.toggle('disabled', disabled));
}

// ── Cell tap handler ─────────────────────────────────────────
function handleCellTap(playerIdx, posIdx) {
  if (phase !== 'pick') return;
  if (playerPicked[playerIdx]) return; // 이미 골랐음

  const icon = playerGrids[playerIdx][posIdx];
  const correct = icon === currentTarget;
  playerPicked[playerIdx] = { posIdx, icon, correct };

  sound.play(correct ? 'tap' : 'wrong');

  const cell = document.querySelector(`#grid-${playerIdx} .card-cell[data-pos="${posIdx}"]`);
  if (cell) cell.classList.add(correct ? 'picked-ok' : 'picked-ng');

  disableBoard(playerIdx, true);
  setBoardStatus(playerIdx, correct ? '✓ 골랐어요' : '✗ 다른 그림', correct ? 'ok' : 'ng');

  // 둘 다 골랐으면 평가
  if (playerPicked[0] && playerPicked[1]) {
    evaluateRound();
  }
}

function evaluateRound() {
  phase = 'done';

  const bothCorrect = playerPicked[0].correct && playerPicked[1].correct;
  const board0 = getBoard(0);
  const board1 = getBoard(1);

  if (bothCorrect) {
    teamScore++;
    perfectCount++;
    board0.classList.add('done-ok');
    board1.classList.add('done-ok');
    problemStatus.textContent = `🎉 둘 다 정답! +1점 (총 ${teamScore}점)`;
    sound.play('ding');
  } else {
    if (!playerPicked[0].correct) board0.classList.add('done-ng');
    else board0.classList.add('done-ok');
    if (!playerPicked[1].correct) board1.classList.add('done-ng');
    else board1.classList.add('done-ok');
    problemStatus.textContent = `아쉬워요! 정답은 ${currentTarget}`;
  }
  updateScorePill();

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function updateScorePill() {
  scorePill.textContent = `★ ${teamScore}`;
}

// ── Round flow ───────────────────────────────────────────────
function loadRound() {
  // 9개 이모지 선택, P1 P2 각각 셔플
  currentIcons = shuffle(ICON_POOL).slice(0, GRID_CELLS);
  currentTarget = currentIcons[Math.floor(Math.random() * GRID_CELLS)];

  playerGrids[0] = shuffle(currentIcons);
  playerGrids[1] = shuffle(currentIcons);
  playerPicked = [null, null];

  for (let i = 0; i < PLAYER_COUNT; i++) {
    const board = getBoard(i);
    board.classList.remove('done-ok', 'done-ng');
    setBoardStatus(i, '대기 중', '');
    renderGrid(i);
    disableBoard(i, true);
  }

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  targetIcon.textContent = currentTarget;
  targetArea.classList.remove('hidden');
  problemStatus.textContent = '목표 그림을 잘 보세요!';
  phase = 'reveal';

  // 일정 시간 후 목표 가리고 선택 단계 시작
  nextHandle = setTimeout(() => {
    targetArea.classList.add('hidden');
    problemStatus.textContent = '각자 자기 격자에서 같은 그림을 찾아 터치!';
    for (let i = 0; i < PLAYER_COUNT; i++) disableBoard(i, false);
    phase = 'pick';
  }, TARGET_REVEAL_MS);
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
  teamScore = 0;
  perfectCount = 0;
  phase = 'idle';

  clearTimers();
  updateScorePill();
  showScreen(gameScreen);
  loadRound();
}

// ── Result ───────────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const ratio = teamScore / TOTAL_ROUNDS;
  let title, sub;
  if (ratio >= 0.85) {
    title = '🏆 완벽한 호흡!';
    sub = `둘이 ${teamScore}/${TOTAL_ROUNDS} 라운드 성공!`;
  } else if (ratio >= 0.5) {
    title = '👏 협력 성공!';
    sub = `둘이 ${teamScore}/${TOTAL_ROUNDS} 라운드 성공!`;
  } else {
    title = '🙂 다시 도전!';
    sub = `둘이 ${teamScore}/${TOTAL_ROUNDS} 라운드 성공`;
  }

  resultTitle.textContent = title;
  resultWinner.textContent = sub;

  totalRow.innerHTML = '';
  const chip = document.createElement('div');
  chip.className = 'total-chip';
  chip.innerHTML = `
    <span>👯 팀 점수</span>
    <span style="font-size:1.2rem; color:#2E7D32;">${teamScore} / ${TOTAL_ROUNDS}</span>
  `;
  totalRow.appendChild(chip);

  showScreen(resultScreen);
}

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
