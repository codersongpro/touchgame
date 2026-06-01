/* games/flash-shape/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 6;     // seconds per round (빠른 판단)
const FLASH_MS        = 800;   // 모양이 보이는 시간 (이후 숨김)
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);
const AUTOPLAY        = new URLSearchParams(location.search).get('autoplay') === '1';

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Shape library ────────────────────────────────────────────
const COLORS = {
  red: '#EF5350', blue: '#42A5F5', green: '#66BB6A', yellow: '#FFEE58',
  purple: '#AB47BC', orange: '#FFA726', pink: '#F06292', teal: '#26A69A',
};
const COLOR_KO = {
  red: '빨강', blue: '파랑', green: '초록', yellow: '노랑',
  purple: '보라', orange: '주황', pink: '분홍', teal: '청록',
};
const FIG_KO = {
  circle: '동그라미', square: '네모', triangle: '세모',
  star: '별', heart: '하트', diamond: '마름모',
};

// 6 figures × 5 colors = 30 distinct shapes (gate: 데이터 30개 이상)
const SHAPE_DEFS = [
  ['circle', 'red'], ['circle', 'blue'], ['circle', 'green'], ['circle', 'yellow'], ['circle', 'purple'],
  ['square', 'red'], ['square', 'blue'], ['square', 'green'], ['square', 'orange'], ['square', 'pink'],
  ['triangle', 'red'], ['triangle', 'blue'], ['triangle', 'green'], ['triangle', 'yellow'], ['triangle', 'teal'],
  ['star', 'red'], ['star', 'blue'], ['star', 'yellow'], ['star', 'purple'], ['star', 'orange'],
  ['heart', 'red'], ['heart', 'pink'], ['heart', 'purple'], ['heart', 'orange'], ['heart', 'blue'],
  ['diamond', 'red'], ['diamond', 'blue'], ['diamond', 'green'], ['diamond', 'yellow'], ['diamond', 'teal'],
];
const ALL_SHAPES = SHAPE_DEFS.map(([fig, col]) => ({
  id: fig + '-' + col,
  fig,
  colorKey: col,
  color: COLORS[col],
  name: COLOR_KO[col] + ' ' + FIG_KO[fig],
}));

// Each returns SVG inner content drawn inside a 0 0 100 100 viewBox.
function drawFigure(fig, color) {
  const sw = 4;
  const common = `fill="${color}" stroke="#2C2C2C" stroke-width="${sw}" stroke-linejoin="round"`;
  switch (fig) {
    case 'circle':
      return `<circle cx="50" cy="50" r="33" ${common}/>`;
    case 'square':
      return `<rect x="20" y="20" width="60" height="60" rx="8" ${common}/>`;
    case 'triangle':
      return `<polygon points="50,16 84,80 16,80" ${common}/>`;
    case 'star':
      return `<polygon points="50,12 59.4,37.1 86.1,38.3 65.2,54.9 72.3,80.7 50,66 27.7,80.7 34.8,54.9 13.9,38.3 40.6,37.1" ${common}/>`;
    case 'heart':
      return `<path d="M50,82 C18,58 22,28 40,28 C48,28 50,36 50,40 C50,36 52,28 60,28 C78,28 82,58 50,82 Z" ${common}/>`;
    case 'diamond':
      return `<polygon points="50,14 86,50 50,86 14,50" ${common}/>`;
  }
  return '';
}

function shapeSvg(shape) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${drawFigure(shape.fig, shape.color)}</svg>`;
}

// Answer button: rounded bg rect (state CSS recolors it) + figure on top
function answerBtnSvg(shape) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="94" height="94" rx="16" ry="16" fill="#fff" stroke="#2C2C2C" stroke-width="3"/>
    ${drawFigure(shape.fig, shape.color)}
  </svg>`;
}

// ── Sound Manager ────────────────────────────────────────────
const sound = createSoundManager({
  ding(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t); osc.stop(t + 0.32);
    });
  },
  buzz(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
  },
  timeout(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },
  tick(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  },
  flash(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.16);
  },
  fanfare(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.38);
    });
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount    = 2;
let roundIdx       = 0;
let scores         = [];
let roundLog       = [];
let currentTarget  = null;   // { id, fig, color, name }
let currentChoices = [];     // 4 shapes (includes correct)
let dqSet          = new Set();
let phase          = 'idle';
let timerHandle    = null;
let nextHandle     = null;
let flashHandle    = null;
let autoHandle     = null;
let timeRemaining  = ROUND_TIME;
let gameRounds     = [];

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen      = document.getElementById('gameScreen');
const resultScreen    = document.getElementById('resultScreen');

const backBtn   = document.getElementById('backBtn');
const playBtn   = document.getElementById('playBtn');
const closeBtn  = document.getElementById('closeBtn');
const retryBtn  = document.getElementById('retryBtn');
const homeBtn   = document.getElementById('homeBtn');

const zonesWrap       = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemTimer    = document.getElementById('problemTimer');
const shapeDisplay    = document.getElementById('shapeDisplay');
const problemStatus   = document.getElementById('problemStatus');
const scoreBar        = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle     = document.getElementById('resultTitle');
const resultWinner    = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow        = document.getElementById('totalRow');

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
      clearInterval(countdownInterval);
      countdownInterval = null;
      onDone();
    } else {
      countdownNumber.textContent = count;
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight;
      countdownNumber.style.animation = '';
    }
  }, 1000);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
  if (flashHandle) { clearTimeout(flashHandle);  flashHandle = null; }
  if (autoHandle)  { clearTimeout(autoHandle);   autoHandle  = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
}

// Pick 4 choices: correct + 3 distractors (prefer same figure or color for challenge)
function makeChoices(correct) {
  const others = ALL_SHAPES.filter(s => s.id !== correct.id);
  const related = shuffle(others.filter(s => s.fig === correct.fig || s.colorKey === correct.colorKey));
  const rest    = shuffle(others.filter(s => s.fig !== correct.fig && s.colorKey !== correct.colorKey));
  const wrong   = [...related, ...rest].slice(0, 3);
  return shuffle([correct, ...wrong]);
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
onTap(backBtn,  () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn,  () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn,  () => startPreGameCountdown(() => startGame()));

// ── Build zone grid ──────────────────────────────────────────
function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;

  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;

    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'answer-grid';
    grid.id = `answer-grid-${i}`;

    zone.appendChild(header);
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getAnswerBtns(playerIdx) {
  const grid = document.getElementById(`answer-grid-${playerIdx}`);
  return grid ? Array.from(grid.querySelectorAll('.answer-btn')) : [];
}

function updateScoreChip(playerIdx) {
  const chip = document.getElementById(`score-chip-${playerIdx}`);
  if (chip) chip.textContent = `${scores[playerIdx]}점`;
}

// ── Score bar ────────────────────────────────────────────────
function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg  = PLAYER_CONFIG[i];
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

// ── Populate answer buttons for a round ─────────────────────
function populateAnswerBtns() {
  for (let i = 0; i < playerCount; i++) {
    const grid = document.getElementById(`answer-grid-${i}`);
    if (!grid) continue;
    grid.innerHTML = '';

    currentChoices.forEach(shape => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.dataset.player = i;
      btn.dataset.choice = shape.id;
      btn.setAttribute('aria-label', `P${i + 1} ${shape.name}`);
      btn.innerHTML = answerBtnSvg(shape);
      onTap(btn, () => handleAnswerTap(i, shape.id, btn));
      grid.appendChild(btn);
    });
  }
}

function resetBtnsForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btns = getAnswerBtns(i);
    const zone = getZone(i);
    btns.forEach(btn => {
      btn.className = 'answer-btn';
      btn.disabled = false;
      if (dqSet.has(i)) {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    if (zone) {
      if (dqSet.has(i)) zone.classList.add('dq-zone');
      else zone.classList.remove('dq-zone');
    }
  }
}

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone) {
  const rect = zone.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left = rect.width / 2 + 'px';
  r.style.top  = rect.height / 2 + 'px';
  r.style.width = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Flash: hide the shape after a moment ─────────────────────
function hideShape() {
  shapeDisplay.classList.add('shape-hidden');
  shapeDisplay.innerHTML = '<span class="shape-q">?</span>';
}

// ── Timer logic ──────────────────────────────────────────────
function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');

  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;
    if (timeRemaining <= 2) {
      problemTimer.classList.add('urgent');
      sound.play('tick');
    }
    if (timeRemaining <= 0) {
      clearTimers();
      handleTimeout();
    }
  }, 1000);
}

// ── Answer tap handler ───────────────────────────────────────
function handleAnswerTap(playerIdx, chosenId, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone);

  const correct = (chosenId === currentTarget.id);

  if (correct) {
    resolveRound(playerIdx);
  } else {
    sound.play('buzz');
    btn.classList.add('state-wrong');
    setTimeout(() => btn.classList.remove('state-wrong'), 400);

    dqSet.add(playerIdx);
    scores[playerIdx] = Math.max(0, scores[playerIdx] - 1);
    updateScoreChip(playerIdx);
    updateBarScore(playerIdx);

    const penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.style.position = 'relative';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', () => penalty.remove());

    getAnswerBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });
    zone.classList.add('dq-zone');

    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!dqSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct answer resolved ──────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('ding');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Reveal the answer (in case it was flashed away)
  shapeDisplay.classList.remove('shape-hidden');
  shapeDisplay.innerHTML = shapeSvg(currentTarget);

  getAnswerBtns(winnerIdx).forEach(btn => {
    if (btn.dataset.choice === currentTarget.id) {
      btn.classList.add('state-correct');
    } else {
      btn.classList.add('state-disabled');
      btn.disabled = true;
    }
  });

  for (let i = 0; i < playerCount; i++) {
    if (i !== winnerIdx) {
      getAnswerBtns(i).forEach(b => { b.classList.add('state-disabled'); b.disabled = true; });
    }
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답!`;

  roundLog.push({ shapeName: currentTarget.name, winnerIdx, dqPlayers: [...dqSet], timedOut: false });
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout ──────────────────────────────────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  shapeDisplay.classList.remove('shape-hidden');
  shapeDisplay.innerHTML = shapeSvg(currentTarget);

  for (let i = 0; i < playerCount; i++) {
    getAnswerBtns(i).forEach(btn => {
      if (btn.dataset.choice === currentTarget.id) {
        btn.classList.add('state-reveal');
      } else {
        btn.classList.add('state-disabled');
        btn.disabled = true;
      }
    });
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = `시간 초과! 정답: ${currentTarget.name}`;
  roundLog.push({ shapeName: currentTarget.name, winnerIdx: -1, dqPlayers: [...dqSet], timedOut: true });
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Autoplay (검증용): 첫 라운드부터 정답을 자동으로 탭 ──────────
function autoTapStep() {
  if (phase !== 'active') return;
  for (let i = 0; i < playerCount; i++) {
    if (dqSet.has(i)) continue;
    const btns = getAnswerBtns(i);
    const correctBtn = btns.find(b => b.dataset.choice === currentTarget.id);
    if (correctBtn) { handleAnswerTap(i, currentTarget.id, correctBtn); return; }
  }
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase = 'active';
  currentTarget = gameRounds[roundIdx];
  currentChoices = makeChoices(currentTarget);
  dqSet = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  shapeDisplay.classList.remove('shape-hidden');
  shapeDisplay.innerHTML = shapeSvg(currentTarget);
  sound.play('flash');
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  populateAnswerBtns();
  resetBtnsForRound();
  startCountdown();

  flashHandle = setTimeout(() => hideShape(), FLASH_MS);
  if (AUTOPLAY) autoHandle = setTimeout(() => autoTapStep(), 150);
}

function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) showResult();
  else loadRound();
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  gameRounds = shuffle(ALL_SHAPES).slice(0, TOTAL_ROUNDS);
  roundIdx = 0;
  scores = new Array(playerCount).fill(0);
  roundLog = [];
  dqSet = new Set();
  phase = 'idle';

  clearTimers();
  buildZones();
  buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}

// ── Show result ──────────────────────────────────────────────
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  const maxScore = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i })).filter(x => x.s === maxScore).map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '동점!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>모양</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}. ${log.shapeName}</td>`;
    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.dqPlayers.includes(i)) {
        cells += `<td class="cell-wrong">-1</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg   = PLAYER_CONFIG[i];
    const isWin = winners.includes(i);
    const chip  = document.createElement('div');
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
