/* games/one-stroke/game.js — 패턴 D, 한붓그리기 (탭으로 인접 노드 따라가기) */
'use strict';

const TOTAL_ROUNDS = 3;
const ROUND_TIME = 45;
const RESULT_PAUSE_MS = 2200;

const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', cls: 'p1' },
  { label: 'P2', dot: '#E53935', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', cls: 'p4' },
];

// 그래프: nodes는 [x, y] 좌표 (0-100 스케일), edges는 [a, b]
// 모든 그래프는 Eulerian path (한붓그리기 가능)
const GRAPHS = [
  // Round 1: 삼각형 (3개 노드, 3개 엣지) - 모든 노드가 짝수 차수
  {
    nodes: [[20, 30], [80, 30], [50, 80]],
    edges: [[0, 1], [1, 2], [2, 0]],
  },
  // Round 2: 사각형 + 대각선 1 (4개 노드, 5개 엣지) - 두 노드가 홀수 차수
  {
    nodes: [[20, 20], [80, 20], [80, 80], [20, 80]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
  },
  // Round 3: 5개 노드 - Eulerian path (홀수 차수 노드 정확히 2개)
  {
    nodes: [[50, 15], [15, 45], [85, 45], [30, 85], [70, 85]],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
];

const sound = createSoundManager({
  ding(ctx) { [523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; const t = ctx.currentTime + i * 0.09; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.start(t); o.stop(t + 0.32); }); },
  draw(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(550, ctx.currentTime); g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  buzz(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, ctx.currentTime); g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15); },
  tick(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08); },
  timeout(ctx) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.setValueAtTime(160, ctx.currentTime); g.gain.setValueAtTime(0.4, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5); },
  fanfare(ctx) { [392, 494, 523, 659, 784].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; const t = ctx.currentTime + i * 0.12; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.start(t); o.stop(t + 0.38); }); },
});

let playerCount = 2;
let roundIdx = 0;
let scores = [];
let roundResults = [];
let zonePaths = [];     // each player: [nodeIdx, nodeIdx, ...] visited in order
let zoneUsedEdges = []; // each player: Set of edge keys "a-b" sorted
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

function getGraph() { return GRAPHS[roundIdx % GRAPHS.length]; }
function edgeKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

function buildZones() {
  zonesWrap.innerHTML = '';
  zonesWrap.className = `zones-wrap p${playerCount}`;
  for (let i = 0; i < playerCount; i++) {
    const cfg = PLAYER_CONFIG[i];
    const zone = document.createElement('div');
    zone.className = `zone ${cfg.cls}`;
    zone.dataset.player = i;
    zone.innerHTML = `<div class="zone-header"><span class="zone-label">${cfg.label}</span><span class="zone-progress" id="prog-${i}">0/0</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'stroke-grid';
    grid.id = `stroke-${i}`;
    zone.appendChild(grid);
    const reset = document.createElement('div');
    reset.className = 'zone-reset';
    reset.innerHTML = `<button class="reset-btn" data-player="${i}">↺ 다시 그리기</button>`;
    zone.appendChild(reset);
    zonesWrap.appendChild(zone);
    onTap(reset.querySelector('.reset-btn'), () => resetPath(i));
  }
}
function getZone(idx) { return zonesWrap.querySelector(`.zone[data-player="${idx}"]`); }

function renderStroke(playerIdx) {
  const grid = $(`stroke-${playerIdx}`);
  if (!grid) return;
  const g = getGraph();
  const path = zonePaths[playerIdx];
  const used = zoneUsedEdges[playerIdx];

  let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">';

  // 모든 엣지 (회색 또는 used)
  g.edges.forEach(([a, b]) => {
    const isUsed = used.has(edgeKey(a, b));
    const x1 = g.nodes[a][0], y1 = g.nodes[a][1];
    const x2 = g.nodes[b][0], y2 = g.nodes[b][1];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isUsed ? '#7C4DFF' : '#999'}" stroke-width="${isUsed ? 4 : 2.5}" stroke-linecap="round" ${isUsed ? '' : 'stroke-dasharray="3,2"'}/>`;
  });

  // 노드
  const currentNode = path.length ? path[path.length - 1] : -1;
  g.nodes.forEach((pos, idx) => {
    const isCurrent = idx === currentNode;
    const isVisited = path.includes(idx);
    svg += `<circle cx="${pos[0]}" cy="${pos[1]}" r="5" fill="${isCurrent ? '#FFD54F' : (isVisited ? '#4CAF50' : '#fff')}" stroke="#2C2C2C" stroke-width="2.5"/>`;
    // 클릭 영역 (큰 circle, 투명)
    svg += `<circle class="node-clickable" data-idx="${idx}" cx="${pos[0]}" cy="${pos[1]}" r="10" fill="transparent"/>`;
  });

  svg += '</svg>';
  grid.innerHTML = svg;

  grid.querySelectorAll('.node-clickable').forEach(node => {
    const idx = parseInt(node.dataset.idx, 10);
    onTap(node, () => handleNodeTap(playerIdx, idx));
  });

  const used_n = used.size;
  const total_e = g.edges.length;
  const el = $(`prog-${playerIdx}`);
  if (el) el.textContent = `${used_n}/${total_e}`;
}

function handleNodeTap(playerIdx, nodeIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  const g = getGraph();
  const path = zonePaths[playerIdx];
  const used = zoneUsedEdges[playerIdx];

  if (path.length === 0) {
    path.push(nodeIdx);
    sound.play('draw');
  } else {
    const last = path[path.length - 1];
    if (nodeIdx === last) return;
    // 인접한지 확인
    const isAdjacent = g.edges.some(([a, b]) => (a === last && b === nodeIdx) || (b === last && a === nodeIdx));
    if (!isAdjacent) { sound.play('buzz'); return; }
    // 이미 사용한 엣지인지
    const ek = edgeKey(last, nodeIdx);
    if (used.has(ek)) { sound.play('buzz'); return; }
    used.add(ek);
    path.push(nodeIdx);
    sound.play('draw');
  }
  renderStroke(playerIdx);

  // 모든 엣지 다 사용했나?
  if (used.size === g.edges.length) handleSolve(playerIdx);
}

function resetPath(playerIdx) {
  if (phase !== 'active' || zoneSolved[playerIdx]) return;
  zonePaths[playerIdx] = [];
  zoneUsedEdges[playerIdx] = new Set();
  renderStroke(playerIdx);
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
    problemStatus.textContent = `${PLAYER_CONFIG[winnerIdx].label} 완성!`;
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
  problemStatus.textContent = `시간 초과! 아무도 완성하지 못했어요`;
  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

function loadRound() {
  phase = 'active';
  zonePaths = []; zoneUsedEdges = []; zoneSolved = [];
  for (let i = 0; i < playerCount; i++) {
    zonePaths.push([]);
    zoneUsedEdges.push(new Set());
    zoneSolved.push(false);
    const zone = getZone(i);
    if (zone) zone.classList.remove('solved', 'locked');
    renderStroke(i);
  }
  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '점을 탭해 모든 선을 한 번씩!';
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
