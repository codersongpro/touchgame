/* games/laser-reflect/game.js — 패턴 D, 거울 회전으로 빛 반사 */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 60;
const RESULT_PAUSE_MS = 2200;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 그리드 크기 5x5 고정.
// 셀 종류:
// 'empty', 'source' (빛 발생, 방향 고정), 'target' (목표),
// 'mirror_slash' (/ 거울, 회전 시 \ 또는 /로 토글), 'wall'
// dir: 0=N, 1=E, 2=S, 3=W

// 거울 반사 규칙:
// - / 거울: N→E, E→N, S→W, W→S
// - \ 거울: N→W, W→N, S→E, E→S
// 거울에 회전(rot)이 있어 0=/, 1=\

const PUZZLES = [
  // Round 1: 1 mirror flip needed
  // source-E(0,0) → (0,4) mirror flip to \ → (3,4) target
  {
    size: 5,
    cells: [
      'source-E', 0, 0, 0, 'mirror-0',  // mirror starts / (rot=0), needs \ (rot=1)
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 'target',
      0, 0, 0, 0, 0,
    ],
  },
  // Round 2: 2 mirror flips needed
  // source-E(0,0) → (0,4) \ → (4,4) / → (4,0) target
  {
    size: 5,
    cells: [
      'source-E', 0, 0, 0, 'mirror-0',  // (0,4) start /, need \
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      'target', 0, 0, 0, 'mirror-1',    // (4,4) start \, need /
    ],
  },
  // Round 3: 3 mirror flips needed
  // source-E(0,0) → (0,2) \ → (4,2) / → (4,0) \ → (2,0) target
  {
    size: 5,
    cells: [
      'source-E', 0, 'mirror-0', 0, 0,  // (0,2) start /, need \
      0, 0, 0, 0, 0,
      'target', 0, 0, 0, 0,             // (2,0) target
      0, 0, 0, 0, 0,
      'mirror-0', 0, 'mirror-1', 0, 0,  // (4,0) start /, need \; (4,2) start \, need /
    ],
  },
];

const sound = createSoundManager({
  ding(ctx) { [523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; const t = ctx.currentTime + i * 0.09; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.start(t); o.stop(t + 0.32); }); },
  flip(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(700, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  tick(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  timeout(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(160, ctx.currentTime); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5); },
  fanfare(ctx) { [392, 494, 523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; const t = ctx.currentTime + i * 0.12; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.start(t); o.stop(t + 0.38); }); },
});

let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zoneMirrors = []; // each player: { idx -> rotation 0 or 1 }
let zoneSolved = [];
let phase = 'idle';
let timerHandle = null, nextHandle = null;
let timeRemaining = ROUND_TIME;

const $ = id => document.getElementById(id);
const introScreen = $('introScreen'), countdownScreen = $('countdownScreen'), countdownNumber = $('countdownNumber');
const gameScreen = $('gameScreen'), resultScreen = $('resultScreen');
const backBtn = $('backBtn'), playBtn = $('playBtn'), closeBtn = $('closeBtn'), retryBtn = $('retryBtn'), homeBtn = $('homeBtn');
const zonesWrap = $('zonesWrap'), questionCounter = $('questionCounter'), problemTimer = $('problemTimer'), problemStatus = $('problemStatus'), scoreBar = $('scoreBar');
const soundToggleIntro = $('soundToggleIntro');
const resultTitle = $('resultTitle'), resultWinner = $('resultWinner'), totalRow = $('totalRow');

function showScreen(s) { [introScreen, countdownScreen, gameScreen, resultScreen].forEach(x => x.classList.remove('active')); s.classList.add('active'); }
let countdownInterval = null;
function startPreGameCountdown(onDone) {
  showScreen(countdownScreen);
  let count = 3; countdownNumber.textContent = count;
  countdownInterval = setInterval(() => { count--; if (count <= 0) { clearInterval(countdownInterval); countdownInterval = null; onDone(); } else { countdownNumber.textContent = count; countdownNumber.style.animation = 'none'; countdownNumber.offsetHeight; countdownNumber.style.animation = ''; } }, 1000);
}
function clearTimers() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } if (nextHandle) { clearTimeout(nextHandle); nextHandle = null; } }
function updateSoundBtn(btn) { btn.textContent = sound.isMuted() ? '🔇' : '🔊'; }

function getPuzzle() { return PUZZLES[roundIdx % PUZZLES.length]; }

// 빛 경로 계산: source부터 시작, 거울에서 반사, 벽/그리드 밖 도달 시 종료
// returns { path: [{x,y,dir}], hitTarget: bool }
function traceLaser(playerIdx) {
  const pz = getPuzzle();
  const size = pz.size;
  let sourcePos = -1, sourceDir = 1;
  for (let i = 0; i < pz.cells.length; i++) {
    const c = pz.cells[i];
    if (typeof c === 'string' && c.startsWith('source-')) {
      sourcePos = i;
      const d = c.split('-')[1];
      sourceDir = { N: 0, E: 1, S: 2, W: 3 }[d];
    }
  }
  if (sourcePos < 0) return { path: [], hitTarget: false };

  const path = [];
  let x = sourcePos % size, y = Math.floor(sourcePos / size);
  let dir = sourceDir;
  path.push({ x, y, dir });

  const maxSteps = size * size * 2;
  for (let step = 0; step < maxSteps; step++) {
    const dx = [0, 1, 0, -1][dir];
    const dy = [-1, 0, 1, 0][dir];
    x += dx; y += dy;
    if (x < 0 || x >= size || y < 0 || y >= size) return { path, hitTarget: false };

    const idx = y * size + x;
    const cell = pz.cells[idx];
    path.push({ x, y, dir });

    if (cell === 'target') return { path, hitTarget: true };
    if (typeof cell === 'string' && cell.startsWith('mirror-')) {
      const rot = zoneMirrors[playerIdx][idx];
      // rot 0: '/' → N→E, E→N, S→W, W→S
      // rot 1: '\' → N→W, W→N, S→E, E→S
      if (rot === 0) {
        dir = [1, 0, 3, 2][dir]; // N→E, E→N, S→W, W→S
      } else {
        dir = [3, 2, 1, 0][dir]; // N→W, E→S, S→E, W→N
      }
    }
    // empty 또는 0이면 직진
  }
  return { path, hitTarget: false };
}

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header"><span class="zone-label">${cfg.label}</span><span class="zone-progress" id="prog-${i}">진행중</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'laser-grid';
    grid.id = `laser-${i}`;
    zone.appendChild(grid);
    zonesWrap.appendChild(zone);
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderLaser(playerIdx) {
  const grid = $(`laser-${playerIdx}`);
  if (!grid) return;
  const pz = getPuzzle();
  const size = pz.size;
  const cellPx = 60; // SVG units
  const w = cellPx * size;
  const { path, hitTarget } = traceLaser(playerIdx);

  let svg = `<svg viewBox="0 0 ${w} ${w}" preserveAspectRatio="xMidYMid meet">`;
  // grid lines
  for (let i = 1; i < size; i++) {
    svg += `<line x1="${i * cellPx}" y1="0" x2="${i * cellPx}" y2="${w}" stroke="#E0DFD7" stroke-width="1"/>`;
    svg += `<line x1="0" y1="${i * cellPx}" x2="${w}" y2="${i * cellPx}" stroke="#E0DFD7" stroke-width="1"/>`;
  }

  // beam path (yellow line through cell centers)
  if (path.length > 1) {
    let d = '';
    for (let i = 0; i < path.length; i++) {
      const cx = path[i].x * cellPx + cellPx / 2;
      const cy = path[i].y * cellPx + cellPx / 2;
      d += (i === 0 ? 'M ' : ' L ') + cx + ' ' + cy;
    }
    svg += `<path d="${d}" stroke="#2C2C2C" stroke-width="10" stroke-linecap="round" fill="none" stroke-linejoin="round"/>`;
    svg += `<path d="${d}" stroke="${hitTarget ? '#4CAF50' : '#FFC107'}" stroke-width="6" stroke-linecap="round" fill="none" stroke-linejoin="round"/>`;
  }

  // cells
  for (let i = 0; i < pz.cells.length; i++) {
    const cell = pz.cells[i];
    const cx = (i % size) * cellPx + cellPx / 2;
    const cy = Math.floor(i / size) * cellPx + cellPx / 2;
    if (typeof cell === 'string' && cell.startsWith('source-')) {
      svg += `<circle cx="${cx}" cy="${cy}" r="18" fill="#FFD54F" stroke="#2C2C2C" stroke-width="3"/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="#FFC107"/>`;
    } else if (cell === 'target') {
      svg += `<rect x="${cx - 18}" y="${cy - 18}" width="36" height="36" rx="6" fill="#E53935" stroke="#2C2C2C" stroke-width="3"/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="10" fill="#fff"/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="5" fill="#E53935"/>`;
    } else if (typeof cell === 'string' && cell.startsWith('mirror-')) {
      const rot = zoneMirrors[playerIdx][i];
      // rot 0: '/'  draw line from bottom-left to top-right
      // rot 1: '\'  draw line from top-left to bottom-right
      if (rot === 0) {
        svg += `<line x1="${cx - 22}" y1="${cy + 22}" x2="${cx + 22}" y2="${cy - 22}" stroke="#2C2C2C" stroke-width="8" stroke-linecap="round"/>`;
        svg += `<line x1="${cx - 22}" y1="${cy + 22}" x2="${cx + 22}" y2="${cy - 22}" stroke="#7C4DFF" stroke-width="4" stroke-linecap="round"/>`;
      } else {
        svg += `<line x1="${cx - 22}" y1="${cy - 22}" x2="${cx + 22}" y2="${cy + 22}" stroke="#2C2C2C" stroke-width="8" stroke-linecap="round"/>`;
        svg += `<line x1="${cx - 22}" y1="${cy - 22}" x2="${cx + 22}" y2="${cy + 22}" stroke="#7C4DFF" stroke-width="4" stroke-linecap="round"/>`;
      }
      svg += `<rect class="laser-cell-clickable" data-idx="${i}" x="${cx - cellPx / 2 + 2}" y="${cy - cellPx / 2 + 2}" width="${cellPx - 4}" height="${cellPx - 4}" fill="transparent"/>`;
    }
  }
  svg += '</svg>';
  grid.innerHTML = svg;

  // 클릭 핸들러 등록 (rect.laser-cell-clickable)
  grid.querySelectorAll('.laser-cell-clickable').forEach(rect => {
    const idx = parseInt(rect.dataset.idx, 10);
    onTap(rect, () => handleMirrorTap(playerIdx, idx));
  });
}

function handleMirrorTap(playerIdx, idx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  zoneMirrors[playerIdx][idx] = 1 - zoneMirrors[playerIdx][idx];
  sound.play('flip');
  renderLaser(playerIdx);
  const { hitTarget } = traceLaser(playerIdx);
  if (hitTarget) handleSolve(playerIdx);
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
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 적중!`;
    for (let i = 0; i < playerCount; i++) if (i !== winnerIdx && !zoneSolved[i]) getZone(i).classList.add('locked');
    phase = 'done';
    clearTimers();
    nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
  }
}

function buildScoreBar() {
  scoreBar.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const chip = document.createElement('div');
    chip.className = 'score-chip';
    chip.innerHTML = `<span class="score-chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="score-chip-val" id="bar-score-${i}">0</span>`;
    scoreBar.appendChild(chip);
  }
}
function updateBarScore(idx) { const el = $(`bar-score-${idx}`); if (el) el.textContent = scores[idx]; }

function startCountdown() {
  timeRemaining = ROUND_TIME;
  problemTimer.textContent = timeRemaining;
  problemTimer.classList.remove('urgent');
  timerHandle = setInterval(() => {
    timeRemaining--;
    problemTimer.textContent = timeRemaining;
    if (timeRemaining <= 5) { problemTimer.classList.add('urgent'); sound.play('tick'); }
    if (timeRemaining <= 0) { clearTimers(); handleTimeout(); }
  }, 1000);
}
function handleTimeout() {
  if (phase !== 'active') return;
  phase = 'done';
  sound.play('timeout');
  for (let i = 0; i < playerCount; i++) if (!zoneSolved[i]) getZone(i).classList.add('locked');
  roundResults.push({ winnerIdx: -1, timedOut: true });
  problemStatus.textContent = `시간 초과! 아무도 적중하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  const pz = getPuzzle();
  zoneMirrors = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    const mirrors = {};
    pz.cells.forEach((c, idx) => { if (typeof c === 'string' && c.startsWith('mirror-')) mirrors[idx] = parseInt(c.split('-')[1], 10); });
    zoneMirrors.push(mirrors);
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderLaser(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '거울을 탭해 빛을 목표에!';
  startCountdown();
}
function nextRound() { roundIdx++; if (roundIdx >= TOTAL_ROUNDS) showResult(); else loadRound(); }
function startGame() {
  roundIdx = 0; scores = new Array(playerCount).fill(0); roundResults = []; phase = 'idle';
  clearTimers(); buildZones(); buildScoreBar();
  showScreen(gameScreen);
  loadRound();
}
function showResult() {
  clearTimers(); phase = 'idle'; sound.play('fanfare');
  const max = Math.max(...scores);
  const winners = scores.map((s, i) => ({ s, i })).filter(x => x.s === max).map(x => x.i);
  if (max === 0) { resultTitle.textContent = '무승부!'; resultWinner.textContent = '아무도 라운드를 이기지 못했어요.'; }
  else if (winners.length === 1) { resultTitle.textContent = '게임 종료!'; resultWinner.textContent = `${PLAYER_CONFIG[winners[0]].label} 우승! (${max}승)`; }
  else { const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', '); resultTitle.textContent = '동점!'; resultWinner.textContent = `${labels} 공동 1위! (${max}승)`; }
  totalRow.innerHTML = '';
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i]; const isWin = winners.includes(i);
    const chip = document.createElement('div'); chip.className = 'total-chip';
    chip.innerHTML = `<span class="chip-dot" style="background:${cfg.dot}"></span><span>${cfg.label}</span><span class="chip-score" style="color:${isWin ? '#2E7D32' : '#555'}">${scores[i]}승</span>${isWin ? '<span style="font-size:1.1rem;">★</span>' : ''}`;
    totalRow.appendChild(chip);
  }
  showScreen(resultScreen);
}

document.querySelectorAll('.player-btn').forEach(btn => onTap(btn, () => { document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); playerCount = parseInt(btn.dataset.count, 10); }));
onTap(soundToggleIntro, () => { sound.toggleMute(); updateSoundBtn(soundToggleIntro); }); updateSoundBtn(soundToggleIntro);
onTap(backBtn, () => goHome());
onTap(closeBtn, () => { clearTimers(); goHome(); });
onTap(homeBtn, () => goHome());
onTap(retryBtn, () => startPreGameCountdown(() => startGame()));
onTap(playBtn, () => startPreGameCountdown(() => startGame()));
