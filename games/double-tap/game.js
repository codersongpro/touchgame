/* games/double-tap/game.js */

'use strict';

// ── Constants ────────────────────────────────────────────────
const TOTAL_ROUNDS    = 10;
const ROUND_TIME      = 5;     // seconds per round
const COMBO_WINDOW_MS = 400;   // max gap between dot1 tap and dot2 tap to count as "동시"
const RESULT_PAUSE_MS = getAutoplayPauseMs(2000);

// Player config
const PLAYER_CONFIG = [
  { label: 'P1', dot: '#0288D1', zoneBg: '#B3E5FC', cls: 'p1' },
  { label: 'P2', dot: '#E53935', zoneBg: '#FFCDD2', cls: 'p2' },
  { label: 'P3', dot: '#388E3C', zoneBg: '#C8E6C9', cls: 'p3' },
  { label: 'P4', dot: '#F57C00', zoneBg: '#FFE0B2', cls: 'p4' },
];

// ── Sound Manager ────────────────────────────────────────────
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
});

// ── State ────────────────────────────────────────────────────
let playerCount     = 2;
let roundIdx         = 0;
let scores           = [];
let roundLog         = [];     // { winnerIdx(-1=timeout), timedOut }
let dqSet            = new Set();   // players who already failed/finished this round
let phase            = 'idle';
let timerHandle      = null;
let nextHandle        = null;
let timeRemaining     = ROUND_TIME;

// per-player dot progress for current round
// { firstTapAt: number|null, firstDotIdx: number|null }
let dotProgress      = [];

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
const problemTimer  = document.getElementById('problemTimer');
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
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (nextHandle)  { clearTimeout(nextHandle);   nextHandle  = null; }
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

    // Dot playfield — absolute positioned dots inside
    const field = document.createElement('div');
    field.className = 'dot-field';
    field.id = `dot-field-${i}`;

    zone.appendChild(header);
    zone.appendChild(field);
    zonesWrap.appendChild(zone);
  }
}

function getZone(idx) {
  return zonesWrap.querySelector(`.zone[data-player="${idx}"]`);
}

function getDotField(playerIdx) {
  return document.getElementById(`dot-field-${playerIdx}`);
}

function getDotBtns(playerIdx) {
  const field = getDotField(playerIdx);
  return field ? Array.from(field.querySelectorAll('.dot-btn')) : [];
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

// ── Random non-overlapping dot positions (percent-based) ─────
function randomDotPositions() {
  // Keep dots within a safe inset so they never clip zone edges,
  // and far enough apart that two fingers can land on each easily.
  const MARGIN = 16;   // % inset from each edge
  const MIN_DIST = 32; // % minimum distance between the two dot centers

  function rand(min, max) { return min + Math.random() * (max - min); }

  const p1 = { x: rand(MARGIN, 100 - MARGIN), y: rand(MARGIN, 100 - MARGIN) };
  let p2;
  let tries = 0;
  do {
    p2 = { x: rand(MARGIN, 100 - MARGIN), y: rand(MARGIN, 100 - MARGIN) };
    tries++;
  } while (Math.hypot(p2.x - p1.x, p2.y - p1.y) < MIN_DIST && tries < 30);

  return [p1, p2];
}

// ── Populate dot buttons for a round ─────────────────────────
function populateDotBtns() {
  for (let i = 0; i < playerCount; i++) {
    const field = getDotField(i);
    if (!field) continue;
    field.innerHTML = '';

    const positions = randomDotPositions();
    positions.forEach((pos, di) => {
      const btn = document.createElement('button');
      btn.className = 'dot-btn';
      btn.dataset.player = i;
      btn.dataset.dotIndex = di;
      btn.style.left = pos.x + '%';
      btn.style.top  = pos.y + '%';
      btn.setAttribute('aria-label', `P${i + 1} 점 ${di + 1}`);

      btn.innerHTML = `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="26" fill="${PLAYER_CONFIG[i].dot}" opacity="0.85" stroke="#222" stroke-width="3"/>
        <circle cx="30" cy="30" r="10" fill="#fff" opacity="0.9"/>
      </svg>`;

      onTap(btn, () => handleDotTap(i, di, btn));
      field.appendChild(btn);
    });
  }
}

// ── Reset dot field for a new round ──────────────────────────
function resetDotsForRound() {
  dotProgress = [];
  for (let i = 0; i < playerCount; i++) {
    dotProgress.push({ firstTapAt: null, firstDotIdx: null });
    const btns = getDotBtns(i);
    const zone = getZone(i);
    btns.forEach(btn => {
      btn.classList.remove('dot-tapped', 'state-disabled');
      btn.disabled = false;
    });
    if (zone) zone.classList.remove('dq-zone');
  }
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

// ── Disable all dot buttons everywhere ───────────────────────
function setAllBtnsDisabled(disabled) {
  zonesWrap.querySelectorAll('.dot-btn').forEach(btn => {
    btn.disabled = disabled;
    if (disabled) btn.classList.add('state-disabled');
    else btn.classList.remove('state-disabled');
  });
}

// ── Dot tap handler ───────────────────────────────────────────
function handleDotTap(playerIdx, dotIdx, btn) {
  if (phase !== 'active') return;
  if (dqSet.has(playerIdx)) return;
  if (btn.classList.contains('dot-tapped')) return;

  const progress = dotProgress[playerIdx];
  const now = Date.now();

  btn.classList.add('dot-tapped');

  if (progress.firstTapAt === null) {
    // First dot tapped — start the combo window
    progress.firstTapAt = now;
    progress.firstDotIdx = dotIdx;
    return;
  }

  // Second dot tapped (must be the OTHER dot)
  if (dotIdx === progress.firstDotIdx) return; // safety: same dot re-tap, ignore

  const gap = now - progress.firstTapAt;

  if (gap <= COMBO_WINDOW_MS) {
    // Success! Both dots tapped within the window.
    resolveRound(playerIdx);
  } else {
    // Too slow between taps — fail this player's attempt for the round
    sound.play('wrong');
    const zone = getZone(playerIdx);
    if (zone) {
      const penalty = document.createElement('div');
      penalty.className = 'penalty-flash';
      penalty.textContent = '놓침!';
      zone.style.position = 'relative';
      zone.appendChild(penalty);
      penalty.addEventListener('animationend', () => penalty.remove());
      zone.classList.add('dq-zone');
    }

    dqSet.add(playerIdx);
    getDotBtns(playerIdx).forEach(b => {
      b.classList.add('state-disabled');
      b.disabled = true;
    });

    // Check if all players are DQ'd
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

// ── Correct: both dots tapped in time ────────────────────────
function resolveRound(winnerIdx) {
  phase = 'done';
  clearTimers();
  sound.play('correct');

  scores[winnerIdx]++;
  updateScoreChip(winnerIdx);
  updateBarScore(winnerIdx);

  // Highlight winner zone's dots, disable everyone
  getDotBtns(winnerIdx).forEach(btn => btn.classList.add('state-correct'));
  setAllBtnsDisabled(true);

  const winnerLabel = PLAYER_CONFIG[winnerIdx].label;
  problemStatus.textContent = `${winnerLabel} 성공! +1점`;

  roundLog.push({
    winnerIdx,
    timedOut: false,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Timeout: nobody completed their pair in time ─────────────
function handleTimeout() {
  phase = 'done';
  clearTimers();
  sound.play('wrong');

  setAllBtnsDisabled(true);

  problemStatus.textContent = '시간 초과! 아무도 성공하지 못했어요';

  roundLog.push({
    winnerIdx: -1,
    timedOut: true,
  });

  nextHandle = setTimeout(() => nextRound(), RESULT_PAUSE_MS);
}

// ── Load round ───────────────────────────────────────────────
function loadRound() {
  phase   = 'active';
  dqSet   = new Set();

  questionCounter.textContent = `${roundIdx + 1} / ${TOTAL_ROUNDS}`;
  problemStatus.textContent = '';
  problemTimer.classList.remove('urgent');

  populateDotBtns();
  resetDotsForRound();
  startCountdown();
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
  dqSet       = new Set();
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

  var scoreResult = reportGameResult({ gameId: 'double-tap', playerCount: playerCount, scores: scores.slice(), metric: 'score' });
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
        cells += `<td class="cell-timeout">시간초과</td>`;
      } else if (log.winnerIdx === i) {
        cells += `<td class="cell-win">+1</td>`;
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
