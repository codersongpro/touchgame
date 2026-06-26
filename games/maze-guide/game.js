/* maze-guide */
'use strict';

const TOTAL_ROUNDS = 5;
const GRID_SIZE = 5;
const GAME_TIME = 90; // 전체 게임 시간(초), 5라운드 공유
const BUMP_FLASH_MS = 350;
const RESULT_PAUSE_MS = 1600;

// 미로 데이터 — 0=path(통로), 1=wall(벽). 5x5, start=top-left(0), end=bottom-right(24).
// 모두 BFS로 start→end 경로 존재를 보장 (아래 verifyMazes()에서 기동 시 검증).
const MAZES = [
  // Round 1: 단순 S자
  {
    grid: [
      0,0,0,1,0,
      1,1,0,1,0,
      0,0,0,1,0,
      0,1,1,1,0,
      0,0,0,0,0,
    ],
  },
  // Round 2: 갈림길
  {
    grid: [
      0,1,0,0,0,
      0,1,0,1,0,
      0,0,0,1,0,
      1,1,0,0,0,
      0,0,0,1,0,
    ],
  },
  // Round 3: 지그재그
  {
    grid: [
      0,0,1,0,0,
      1,0,1,0,1,
      1,0,0,0,1,
      1,0,1,1,1,
      0,0,0,0,0,
    ],
  },
  // Round 4: 나선형
  {
    grid: [
      0,0,0,0,0,
      1,1,1,1,0,
      0,0,0,1,0,
      0,1,0,1,0,
      0,1,0,0,0,
    ],
  },
  // Round 5: 복잡한 미로
  {
    grid: [
      0,1,0,0,0,
      0,1,0,1,0,
      0,0,0,1,0,
      1,1,0,0,0,
      0,0,0,1,0,
    ],
  },
];
const START_IDX = 0;
const END_IDX = GRID_SIZE * GRID_SIZE - 1;

// BFS 도달 가능성 검증 — 기동 시 모든 미로가 풀이 가능한지 확인.
function isSolvable(grid, size, startIdx, endIdx) {
  if (grid[startIdx] === 1 || grid[endIdx] === 1) return false;
  const visited = new Array(grid.length).fill(false);
  const queue = [startIdx];
  visited[startIdx] = true;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === endIdx) return true;
    const r = Math.floor(cur / size), c = cur % size;
    const neighbors = [
      r > 0 ? cur - size : -1,
      r < size - 1 ? cur + size : -1,
      c > 0 ? cur - 1 : -1,
      c < size - 1 ? cur + 1 : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !visited[n] && grid[n] === 0) {
        visited[n] = true;
        queue.push(n);
      }
    }
  }
  return false;
}

function verifyMazes() {
  MAZES.forEach((m, i) => {
    if (!isSolvable(m.grid, GRID_SIZE, START_IDX, END_IDX)) {
      console.error('[maze-guide] Round ' + (i + 1) + ' 미로가 풀 수 없습니다!');
    }
  });
}
verifyMazes();

let round = 0, score = 0, perfect = 0;
let curGrid = [], pos = 0, roundActive = false, gameTimer = null, allTimeouts = [];

const sfx = createSoundManager({
  move(ctx) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 440; g.gain.setValueAtTime(.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .08); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .08); },
  bump(ctx) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + .15); g.gain.setValueAtTime(.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .16); },
  correct(ctx) { [523, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; const t = ctx.currentTime + i * .08; g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .35); }); },
  wrong(ctx) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + .3); g.gain.setValueAtTime(.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .32); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .35); },
  end(ctx) { [523, 659, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; const t = ctx.currentTime + i * .1; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.28, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + .5); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .55); }); }
});

const $ = id => document.getElementById(id);
const introScreen = $('introScreen'), countdownScreen = $('countdownScreen'), gameScreen = $('gameScreen'), resultScreen = $('resultScreen');
const countdownNum = $('countdownNumber'), hudRound = $('hudRound'), hudScore = $('hudScore'), hudFill = $('hudTimerFill');
const guideGrid = $('guideGrid'), exploreGrid = $('exploreGrid'), banner = $('banner'), dpad = $('dpad');

function showScreen(el) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); void el.offsetWidth; el.classList.add('active'); }
function push(t) { allTimeouts.push(t); return t; }
function clearAll() { allTimeouts.forEach(clearTimeout); allTimeouts = []; }

$('backBtn').addEventListener('click', goHome);
const stI = $('soundToggleIntro');
stI.addEventListener('click', () => { stI.textContent = sfx.toggleMute() ? '🔇' : '🔊'; });
stI.textContent = sfx.isMuted() ? '🔇' : '🔊';
const stG = $('soundToggleGame');
stG.addEventListener('click', () => { stG.textContent = sfx.toggleMute() ? '🔇' : '🔊'; });

onTap($('playBtn'), startCountdown);
onTap($('retryBtn'), startCountdown);
onTap($('homeBtn'), goHome);
onTap($('closeBtn'), () => { stopAll(); goHome(); });

function stopAll() { clearAll(); if (gameTimer) { gameTimer.stop(); gameTimer = null; } roundActive = false; }

function startCountdown() {
  stopAll(); showScreen(countdownScreen);
  let n = 3; countdownNum.textContent = n;
  function tick() { n--; if (n <= 0) { countdownNum.textContent = 'GO!'; push(setTimeout(startGame, 700)); } else { countdownNum.textContent = n; push(setTimeout(tick, 1000)); } }
  push(setTimeout(tick, 1000));
}

function startGame() {
  round = 0; score = 0; perfect = 0;
  stG.textContent = sfx.isMuted() ? '🔇' : '🔊';
  showScreen(gameScreen);
  buildDpad();
  hudFill.style.width = '100%';
  hudFill.className = 'hud-timer-fill';
  if (gameTimer) gameTimer.stop();
  gameTimer = createTimer(GAME_TIME, rem => {
    const pct = (rem / GAME_TIME) * 100;
    hudFill.style.width = pct + '%';
    if (rem <= 15) hudFill.className = 'hud-timer-fill danger';
  }, () => { endGame(); });
  gameTimer.start();
  nextRound();
}

function buildDpad() {
  dpad.innerHTML = '';
  const layout = [
    { key: 'up', label: '⬆️', cell: '2 / 1' },
    { key: 'left', label: '⬅️', cell: '3 / 1' },
    { key: 'down', label: '⬇️', cell: '3 / 2' },
    { key: 'right', label: '➡️', cell: '3 / 3' },
  ];
  layout.forEach(d => {
    const b = document.createElement('button');
    b.className = 'dpad-btn dpad-' + d.key;
    b.textContent = d.label;
    b.dataset.key = d.key;
    onTap(b, () => handleMove(d.key));
    dpad.appendChild(b);
  });
}

function nextRound() {
  if (round >= TOTAL_ROUNDS) { endGame(); return; }
  round++;
  curGrid = MAZES[round - 1].grid;
  pos = START_IDX;
  roundActive = true;
  hudRound.textContent = round + '/' + TOTAL_ROUNDS;
  hudScore.textContent = score + '점';
  renderGuideGrid();
  renderExploreGrid();
  showBanner('🧭 P1: 길을 말로 안내해주세요!', 'info');
}

function renderGuideGrid() {
  guideGrid.innerHTML = '';
  curGrid.forEach((cell, i) => {
    const c = document.createElement('div');
    c.className = 'maze-cell ' + (cell === 1 ? 'wall' : 'path');
    if (i === START_IDX) c.classList.add('start');
    if (i === END_IDX) c.classList.add('goal');
    if (i === pos) c.classList.add('token');
    if (i === START_IDX) c.textContent = cell === 1 ? '' : (i === pos ? '🧑' : '🚩');
    if (i === END_IDX) c.textContent = '🏁';
    if (i === pos && i !== END_IDX) c.textContent = '🧑';
    guideGrid.appendChild(c);
  });
}

function renderExploreGrid() {
  exploreGrid.innerHTML = '';
  for (let i = 0; i < curGrid.length; i++) {
    const c = document.createElement('div');
    c.className = 'maze-cell explore-cell';
    if (i === END_IDX) c.classList.add('goal-hint');
    if (i === pos) { c.classList.add('token'); c.textContent = '🧑'; }
    exploreGrid.appendChild(c);
  }
}

function handleMove(dir) {
  if (!roundActive) return;
  const r = Math.floor(pos / GRID_SIZE), c = pos % GRID_SIZE;
  let nr = r, nc = c;
  if (dir === 'up') nr--;
  else if (dir === 'down') nr++;
  else if (dir === 'left') nc--;
  else if (dir === 'right') nc++;
  if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) { bumpFlash(); return; }
  const ni = nr * GRID_SIZE + nc;
  if (curGrid[ni] === 1) { bumpFlash(); return; }
  pos = ni;
  sfx.play('move');
  renderGuideGrid();
  renderExploreGrid();
  if (pos === END_IDX) {
    roundSuccess();
  }
}

function bumpFlash() {
  sfx.play('bump');
  showBanner('🚧 통과 불가!', 'ng');
  exploreGrid.classList.add('shake');
  push(setTimeout(() => exploreGrid.classList.remove('shake'), BUMP_FLASH_MS));
  push(setTimeout(() => { if (roundActive) showBanner('🧭 P1: 길을 말로 안내해주세요!', 'info'); }, BUMP_FLASH_MS + 400));
}

function roundSuccess() {
  if (!roundActive) return;
  roundActive = false;
  score++; perfect++;
  sfx.play('correct');
  showBanner('🎉 도착! 미로 탈출 성공!', 'ok');
  hudScore.textContent = score + '점';
  push(setTimeout(nextRound, getAutoplayPauseMs(1400)));
}

function showBanner(txt, cls) {
  banner.textContent = txt;
  banner.className = 'banner ' + cls + ' show';
}

function endGame() {
  stopAll();
  sfx.play('end');
  var scoreResult = reportGameResult({ gameId: 'maze-guide', playerCount: 2, scores: [score, score], metric: 'score' });
  var scoreBadge = document.getElementById('bestRecordBadge');
  if (scoreBadge) {
    if (scoreResult.isNewBest) {
      scoreBadge.style.display = '';
      scoreBadge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
      createInitialsPrompt(function () {}).open();
    } else if (scoreResult.bestEntry) {
      scoreBadge.style.display = '';
      scoreBadge.textContent = '이 기기 최고 기록: ' + scoreResult.bestEntry.score + '점';
    }
  }
  const success = score >= 3;
  $('resultEmoji').textContent = success ? '🏆' : '😔';
  $('resultHeadline').textContent = success ? '미로 탈출 성공!' : '아쉬워요...';
  $('resultHeadline').className = 'result-headline ' + (success ? 'success' : 'fail');
  $('resultSub').textContent = success ? '환상의 협동이었어요!' : '3개 이상 탈출이 목표!';
  $('statScore').textContent = score + '/' + TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect + '회';
  push(setTimeout(() => showScreen(resultScreen), 400));
}
