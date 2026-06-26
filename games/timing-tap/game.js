/* games/timing-tap/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const RESULT_PAUSE_MS = getAutoplayPauseMs(1800);
const ROUND_TIMEOUT   = 9000; // ms — safety net if nobody taps in the zone

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Round variety: sweep period (ms) and green-zone width (%) ──
// Randomized per round for replay variety, keeping it simple/fair
// (all zones share the exact same values within a round).
function makeRoundConfig() {
  const periods = [1400, 1600, 1800, 2000, 2200, 2400];
  const widths  = [15, 16, 17, 18, 19, 20];
  return {
    periodMs:   periods[Math.floor(Math.random() * periods.length)],
    zoneWidth:  widths[Math.floor(Math.random() * widths.length)],
    // Green zone is centered in the middle of the bar, randomized slightly
    zoneCenter: 50 + (Math.random() * 6 - 3), // 47~53%
  };
}

// ── Sound Manager (oscillator code adapted from flag-quiz) ──────
const sound = createSoundManager({
  correct(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  },
  wrong(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  },
  tick(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },
  win(ctx) {
    [392, 494, 523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  },
  timeout(ctx) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  },
});

// ── State ────────────────────────────────────────────────────
let playerCount   = 2;
let roundIdx      = 0;
let scores        = [];
let roundLog      = [];    // { winnerIdx(-1=timeout), wrongPlayers[], timedOut }
let phase         = 'idle'; // idle | active | done
let nextHandle    = null;
let timeoutHandle = null;
let rafHandle     = null;
let roundConfig   = null;
let roundStartTs  = 0;
let wrongSet      = new Set();

// ── DOM refs ─────────────────────────────────────────────────
const introScreen     = document.getElementById('introScreen');
const countdownScreen = document.getElementById('countdownScreen');
const countdownNumber = document.getElementById('countdownNumber');
const gameScreen    = document.getElementById('gameScreen');
const resultScreen  = document.getElementById('resultScreen');

const backBtn       = document.getElementById('backBtn');
const playBtn       = document.getElementById('playBtn');
const closeBtn      = document.getElementById('closeBtn');
const retryBtn      = document.getElementById('retryBtn');
const homeBtn       = document.getElementById('homeBtn');

const zonesWrap     = document.getElementById('zonesWrap');
const questionCounter = document.getElementById('questionCounter');
const problemStatus = document.getElementById('problemStatus');
const scoreBar      = document.getElementById('scoreBar');

const soundToggleIntro = document.getElementById('soundToggleIntro');

const resultTitle   = document.getElementById('resultTitle');
const resultWinner  = document.getElementById('resultWinner');
const resultTableHead = document.getElementById('resultTableHead');
const resultTableBody = document.getElementById('resultTableBody');
const totalRow      = document.getElementById('totalRow');

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
  countdownInterval = setInterval(function() {
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

function clearTimers() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
  if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
  if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
}

function updateSoundBtn(btn) {
  btn.textContent = sound.isMuted() ? '🔇' : '🔊';
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

    // Header
    const header = document.createElement('div');
    header.className = 'zone-header';
    header.innerHTML = `
      <span class="zone-label">${cfg.label}</span>
      <span class="zone-score-chip" id="score-chip-${i}">0점</span>
    `;

    // Gauge bar with green zone + sweeping marker
    const gaugeWrap = document.createElement('div');
    gaugeWrap.className = 'gauge-wrap';
    gaugeWrap.innerHTML = `
      <div class="gauge-track" id="gauge-track-${i}">
        <div class="gauge-zone" id="gauge-zone-${i}"></div>
        <div class="gauge-marker" id="gauge-marker-${i}"></div>
      </div>
    `;

    // Tap button — bottom of zone (accessibility rule)
    const tapBtn = document.createElement('button');
    tapBtn.className = 'tap-btn';
    tapBtn.id = `tap-btn-${i}`;
    tapBtn.innerHTML = `<span class="tap-btn-icon">⚡</span><span class="tap-btn-label">TAP!</span>`;
    onTap(tapBtn, () => handleTap(i, tapBtn));

    zone.appendChild(header);
    zone.appendChild(gaugeWrap);
    zone.appendChild(tapBtn);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
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

// ── Ripple effect ────────────────────────────────────────────
function spawnRipple(zone) {
  const rect  = zone.getBoundingClientRect();
  const x     = rect.width  / 2;
  const y     = rect.height / 2;
  const size  = Math.max(rect.width, rect.height);
  const r     = document.createElement('span');
  r.className = 'zone-ripple';
  r.style.left   = x + 'px';
  r.style.top    = y + 'px';
  r.style.width  = r.style.height = size + 'px';
  r.style.marginLeft = r.style.marginTop = `-${size / 2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ── Gauge setup for a round ──────────────────────────────────
function setupGaugesForRound() {
  for (let i = 0; i < playerCount; i++) {
    const zoneEl = document.getElementById(`gauge-zone-${i}`);
    if (!zoneEl) continue;
    const half = roundConfig.zoneWidth / 2;
    const left = Math.max(0, roundConfig.zoneCenter - half);
    zoneEl.style.left  = `${left}%`;
    zoneEl.style.width = `${roundConfig.zoneWidth}%`;
  }
}

// Marker position: triangle wave 0→100→0 over periodMs, looping forever
function markerPercentAt(elapsedMs) {
  const t = elapsedMs % roundConfig.periodMs;
  const half = roundConfig.periodMs / 2;
  if (t < half) {
    return (t / half) * 100;
  } else {
    return 100 - ((t - half) / half) * 100;
  }
}

function isInGreenZone(pct) {
  const half = roundConfig.zoneWidth / 2;
  const lo = roundConfig.zoneCenter - half;
  const hi = roundConfig.zoneCenter + half;
  return pct >= lo && pct <= hi;
}

function tickGauge(now) {
  if (phase !== 'active') return;
  const elapsed = now - roundStartTs;
  const pct = markerPercentAt(elapsed);
  for (let i = 0; i < playerCount; i++) {
    const marker = document.getElementById(`gauge-marker-${i}`);
    if (marker) marker.style.left = `${pct}%`;
  }
  rafHandle = requestAnimationFrame(tickGauge);
}

// ── Reset buttons / zones for new round ──────────────────────
function resetZonesForRound() {
  for (let i = 0; i < playerCount; i++) {
    const btn = document.getElementById(`tap-btn-${i}`);
    const zone = getZone(i);
    if (btn) {
      btn.classList.remove('state-correct', 'state-wrong', 'state-disabled');
      btn.disabled = false;
    }
    if (zone) zone.classList.remove('dq-zone');
  }
}

// ── Tap handler ───────────────────────────────────────────────
function handleTap(playerIdx, btn) {
  if (phase !== 'active') return;
  if (wrongSet.has(playerIdx)) return;

  const zone = getZone(playerIdx);
  spawnRipple(zone);

  const elapsed = performance.now() - roundStartTs;
  const pct = markerPercentAt(elapsed);

  if (isInGreenZone(pct)) {
    resolveRound(playerIdx);
  } else {
    // Miss — visual feedback only, no score penalty (pattern A convention here)
    sound.play('wrong');
    btn.classList.add('state-wrong');
    setTimeout(() => btn.classList.remove('state-wrong'), 400);
    wrongSet.add(playerIdx);
    btn.classList.add('state-disabled');
    btn.disabled = true;
    zone.classList.add('dq-zone');

    // If everyone has missed, end round as timeout
    let anyActive = false;
    for (let i = 0; i < playerCount; i++) {
      if (!wrongSet.has(i)) { anyActive = true; break; }
    }
    if (!anyActive) {
      clearTimers();
      nextHandle = setTimeout(() => handleTimeout(), 300);
    }
  }
}

// ── Correct tap resolved ──────────────────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('correct');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  const winBtn = document.getElementById(`tap-btn-${winnerIdx}`);
  if (winBtn) winBtn.classList.add('state-correct');

  for (let i = 0; i < playerCount; i++) {
    const btn = document.getElementById(`tap-btn-${i}`);
    if (btn) { btn.disabled = true; if (i !== winnerIdx) btn.classList.add('state-disabled'); }
  }

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 정답!`;

  roundLog.push({
    winnerIdx,
    wrongPlayers: [...wrongSet],
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout (nobody hit the green zone) ───────────────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('timeout');

  for (let i = 0; i < playerCount; i++) {
    const btn = document.getElementById(`tap-btn-${i}`);
    if (btn) { btn.disabled = true; btn.classList.add('state-disabled'); }
    const zone = getZone(i);
    if (zone) zone.classList.remove('dq-zone');
  }

  problemStatus.textContent = '아무도 못 맞췄어요!';

  roundLog.push({
    winnerIdx: -1,
    wrongPlayers: [...wrongSet],
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase        = 'active';
  roundConfig  = makeRoundConfig();
  wrongSet     = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '';

  setupGaugesForRound();
  resetZonesForRound();

  roundStartTs = performance.now();
  rafHandle = requestAnimationFrame(tickGauge);

  timeoutHandle = setTimeout(() => {
    if (phase === 'active') handleTimeout();
  }, ROUND_TIMEOUT);
}

// ── Next round ───────────────────────────────────────────────
function nextRound() {
  roundIdx++;
  if (roundIdx >= TOTAL_ROUNDS) {
    showResult();
  } else {
    loadRound();
  }
}

// ── Start game ───────────────────────────────────────────────
function startGame() {
  roundIdx    = 0;
  scores      = new Array(playerCount).fill(0);
  roundLog    = [];
  wrongSet    = new Set();
  phase       = 'idle';

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
  sound.play('win');

  var scoreResult = reportGameResult({ gameId: 'timing-tap', playerCount: playerCount, scores: scores.slice(), metric: 'score' });
  var badge = document.getElementById('bestRecordBadge');
  if (badge) {
    if (scoreResult.isNewBest) {
      badge.style.display = '';
      badge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
      createInitialsPrompt(function () {
        badge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
      }).open();
    } else if (scoreResult.bestEntry) {
      badge.style.display = '';
      badge.textContent = '이 기기 최고 기록: ' + scoreResult.bestEntry.score + '점';
    } else {
      badge.style.display = 'none';
    }
  }

  const maxScore = Math.max(...scores);
  const winners  = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === maxScore)
    .map(x => x.i);

  if (maxScore === 0) {
    resultTitle.textContent  = '무승부!';
    resultWinner.textContent = '아무도 점수를 얻지 못했어요.';
  } else if (winners.length === 1) {
    const w = winners[0];
    resultTitle.textContent  = '게임 종료!';
    resultWinner.textContent = `${PLAYER_CONFIG[w].label} 승리! (${maxScore}점)`;
  } else {
    const labels = winners.map(w => PLAYER_CONFIG[w].label).join(', ');
    resultTitle.textContent  = '공동 1위!';
    resultWinner.textContent = `${labels} 공동 1위! (${maxScore}점)`;
  }

  // Build table header
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>라운드</th>' +
    Array.from({ length: playerCount }, (_, i) =>
      `<th><span class="player-dot" style="background:${PLAYER_CONFIG[i].dot}"></span>${PLAYER_CONFIG[i].label}</th>`
    ).join('');
  resultTableHead.innerHTML = '';
  resultTableHead.appendChild(headRow);

  // Build table body
  resultTableBody.innerHTML = '';
  roundLog.forEach((log, idx) => {
    const tr = document.createElement('tr');
    let cells = `<td style="text-align:left;font-size:0.82rem;">${idx + 1}라운드</td>`;

    for (let i = 0; i < playerCount; i++) {
      if (log.timedOut) {
        cells += `<td class="cell-timeout">실패</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
      } else if (log.wrongPlayers.includes(i)) {
        cells += `<td class="cell-wrong">놓침</td>`;
      } else {
        cells += `<td class="cell-none">—</td>`;
      }
    }
    tr.innerHTML = cells;
    resultTableBody.appendChild(tr);
  });

  // Total chips
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
