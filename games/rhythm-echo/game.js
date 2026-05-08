/* rhythm-echo — 박자 따라하기 (cooperative memory rhythm game) */
'use strict';

const TOTAL_ROUNDS = 10;
const ROUND_TIME = 25;
const REVEAL_STEP = 700; // ms between sequence beats during reveal

// 4색 박자 패드. 각 색은 고유 음 주파수를 가짐.
const PADS = [
  { key: 'R', bg: '#EF5350', name: '빨강', emoji: '🔴', freq: 392 }, // G4
  { key: 'B', bg: '#42A5F5', name: '파랑', emoji: '🔵', freq: 523 }, // C5
  { key: 'Y', bg: '#FFEE58', name: '노랑', emoji: '🟡', freq: 659 }, // E5
  { key: 'G', bg: '#66BB6A', name: '초록', emoji: '🟢', freq: 784 }  // G5
];

// 30+ 미리 정의된 박자 시퀀스 (라운드별 길이는 점점 증가)
// 라운드 1-2: 길이 3, 3-4: 길이 4, 5-6: 길이 5, 7-8: 길이 6, 9-10: 길이 7
const SEQUENCES = {
  3: [
    ['R','B','Y'], ['B','G','R'], ['Y','R','G'], ['G','Y','B'],
    ['R','Y','B'], ['B','R','G'], ['Y','G','R'], ['G','B','Y'],
    ['R','G','B'], ['B','Y','R'], ['Y','B','G'], ['G','R','Y']
  ],
  4: [
    ['R','B','Y','G'], ['G','Y','B','R'], ['B','R','G','Y'], ['Y','G','R','B'],
    ['R','Y','G','B'], ['B','G','Y','R'], ['Y','R','B','G'], ['G','B','R','Y'],
    ['R','B','G','Y'], ['B','Y','R','G']
  ],
  5: [
    ['R','B','Y','G','R'], ['B','G','R','Y','B'], ['Y','R','B','G','Y'], ['G','Y','B','R','G'],
    ['R','Y','B','G','B'], ['B','R','G','Y','R'], ['Y','G','R','B','Y'], ['G','B','Y','R','G']
  ],
  6: [
    ['R','B','Y','G','R','B'], ['B','G','R','Y','B','G'], ['Y','R','B','G','Y','R'],
    ['G','Y','B','R','G','Y'], ['R','Y','B','G','R','B'], ['B','R','G','Y','R','Y'],
    ['Y','G','R','B','Y','B'], ['G','B','Y','R','G','R']
  ],
  7: [
    ['R','B','Y','G','R','B','Y'], ['B','G','R','Y','B','G','R'], ['Y','R','B','G','Y','R','B'],
    ['G','Y','B','R','G','Y','B'], ['R','Y','G','B','R','Y','G'], ['B','R','Y','G','B','R','Y']
  ]
};

const ROUND_LENGTHS = [3,3,4,4,5,5,6,6,7,7];

let round = 0, score = 0, perfect = 0;
let seq = [], inputIdx = 0, currentTurn = 0; // 0=P1, 1=P2
let roundActive = false, revealing = false;
let roundTimer = null, allTimeouts = [];

const sfx = createSoundManager({
  beepR(ctx){ playTone(ctx, 392, 0.18); },
  beepB(ctx){ playTone(ctx, 523, 0.18); },
  beepY(ctx){ playTone(ctx, 659, 0.18); },
  beepG(ctx){ playTone(ctx, 784, 0.18); },
  tap(ctx){ const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.12,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.06);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.06); },
  correct(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.07;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.35);});},
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

function playTone(ctx, freq, dur){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.22, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

function playPadSound(key){
  const map = { R:'beepR', B:'beepB', Y:'beepY', G:'beepG' };
  sfx.play(map[key]);
}

const $ = id => document.getElementById(id);
const introScreen = $('introScreen'), countdownScreen = $('countdownScreen');
const gameScreen = $('gameScreen'), resultScreen = $('resultScreen');
const countdownNum = $('countdownNumber');
const questionCounter = $('questionCounter'), problemTimer = $('problemTimer');
const problemStatus = $('problemStatus'), catTag = $('catTag');
const scoreVal = $('scoreVal');

function showScreen(el){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  void el.offsetWidth;
  el.classList.add('active');
}
function push(t){ allTimeouts.push(t); return t; }
function clearAll(){ allTimeouts.forEach(clearTimeout); allTimeouts = []; }
function shuffle(a){
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getPad(key){ return PADS.find(p => p.key === key); }

$('backBtn').addEventListener('click', goHome);
const stI = $('soundToggleIntro');
stI.addEventListener('click', () => { stI.textContent = sfx.toggleMute() ? '🔇' : '🔊'; });
stI.textContent = sfx.isMuted() ? '🔇' : '🔊';

onTap($('playBtn'), startCountdown);
onTap($('retryBtn'), startCountdown);
onTap($('homeBtn'), goHome);
onTap($('closeBtn'), () => { stopAll(); goHome(); });

function stopAll(){
  clearAll();
  if (roundTimer){ roundTimer.stop(); roundTimer = null; }
  roundActive = false;
  revealing = false;
}

function startCountdown(){
  stopAll();
  showScreen(countdownScreen);
  let n = 3;
  countdownNum.textContent = n;
  function tick(){
    n--;
    if (n <= 0){
      countdownNum.textContent = 'GO!';
      push(setTimeout(startGame, 700));
    } else {
      countdownNum.textContent = n;
      push(setTimeout(tick, 1000));
    }
  }
  push(setTimeout(tick, 1000));
}

function startGame(){
  round = 0;
  score = 0;
  perfect = 0;
  showScreen(gameScreen);
  scoreVal.textContent = '0';
  buildPads();
  nextRound();
}

function buildPads(){
  ['P1','P2'].forEach(side => {
    const grid = $('padGrid' + side);
    grid.innerHTML = '';
    PADS.forEach(p => {
      const b = document.createElement('button');
      b.className = 'pad-btn';
      b.dataset.color = p.key;
      b.dataset.side = side;
      b.textContent = p.emoji;
      b.setAttribute('aria-label', side + ' ' + p.name);
      onTap(b, () => handlePadTap(side, p.key, b));
      grid.appendChild(b);
    });
  });
}

function nextRound(){
  if (round >= TOTAL_ROUNDS){ endGame(); return; }
  round++;
  const len = ROUND_LENGTHS[round - 1];
  const pool = SEQUENCES[len];
  seq = [...shuffle(pool)[0]];
  inputIdx = 0;
  currentTurn = 0; // 항상 P1부터
  roundActive = false;
  questionCounter.textContent = round + ' / ' + TOTAL_ROUNDS;
  catTag.textContent = '박자 ' + len + '개';
  setStatus('🎵 박자를 잘 들으세요!');
  resetProgressDots(len);
  setActiveZone(null);
  setTurnIndicators(null);
  disablePads(true, true);
  push(setTimeout(revealSequence, 600));
}

function resetProgressDots(len){
  ['P1','P2'].forEach(side => {
    const row = $('progress' + side);
    row.innerHTML = '';
    for (let i = 0; i < len; i++){
      const d = document.createElement('div');
      d.className = 'progress-dot';
      // 어느 zone이 어느 박자를 칠지 미리 표시: 짝수 인덱스=P1, 홀수=P2
      const owner = (i % 2 === 0) ? 'P1' : 'P2';
      if (owner === side){
        d.dataset.idx = i;
      } else {
        d.style.opacity = '0.3';
      }
      row.appendChild(d);
    }
  });
}

function highlightCurrentDot(idx){
  ['P1','P2'].forEach(side => {
    const row = $('progress' + side);
    const dots = row.querySelectorAll('.progress-dot');
    dots.forEach((d, i) => {
      d.classList.remove('current');
      if (i < idx && d.dataset.idx !== undefined && parseInt(d.dataset.idx,10) < idx){
        // already filled — keep filled
      }
      if (i === idx && d.dataset.idx !== undefined){
        d.classList.add('current');
      }
    });
  });
}

function fillDot(idx){
  const owner = (idx % 2 === 0) ? 'P1' : 'P2';
  const row = $('progress' + owner);
  const dots = row.querySelectorAll('.progress-dot');
  dots.forEach((d, i) => {
    if (i === idx) d.classList.add('filled');
  });
}

function failDot(idx){
  const owner = (idx % 2 === 0) ? 'P1' : 'P2';
  const row = $('progress' + owner);
  const dots = row.querySelectorAll('.progress-dot');
  dots.forEach((d, i) => {
    if (i === idx){ d.classList.remove('filled','current'); d.classList.add('fail'); }
  });
}

function setActiveZone(side){
  ['P1','P2'].forEach(s => {
    const zone = document.querySelector('.zone.p' + (s === 'P1' ? '1' : '2'));
    if (!zone) return;
    if (s === side) zone.classList.add('active-turn');
    else zone.classList.remove('active-turn');
  });
}

function setTurnIndicators(activeSide){
  ['P1','P2'].forEach(side => {
    const ind = $('turn' + side);
    ind.classList.remove('is-active','is-done');
    if (activeSide === null){ ind.textContent = '대기'; }
    else if (side === activeSide){ ind.textContent = '내 차례!'; ind.classList.add('is-active'); }
    else { ind.textContent = '대기'; }
  });
}

function disablePads(p1Disabled, p2Disabled){
  document.querySelectorAll('#padGridP1 .pad-btn').forEach(b => b.disabled = p1Disabled);
  document.querySelectorAll('#padGridP2 .pad-btn').forEach(b => b.disabled = p2Disabled);
}

function flashPad(side, key){
  const b = document.querySelector('#padGrid' + side + ' .pad-btn[data-color="' + key + '"]');
  if (!b) return;
  b.classList.remove('flash');
  void b.offsetWidth;
  b.classList.add('flash');
  push(setTimeout(() => b.classList.remove('flash'), 500));
}

function revealSequence(){
  revealing = true;
  setStatus('🎵 박자: 잘 보고 들으세요!');
  let i = 0;
  function step(){
    if (i >= seq.length){
      revealing = false;
      push(setTimeout(startInputPhase, 600));
      return;
    }
    const owner = (i % 2 === 0) ? 'P1' : 'P2';
    flashPad(owner, seq[i]);
    flashPad(owner === 'P1' ? 'P2' : 'P1', seq[i]); // 양쪽 모두 보여줌
    playPadSound(seq[i]);
    i++;
    push(setTimeout(step, REVEAL_STEP));
  }
  push(setTimeout(step, 200));
}

function startInputPhase(){
  roundActive = true;
  inputIdx = 0;
  currentTurn = 0;
  setStatus('🥁 P1 → P2 → P1... 번갈아 따라치기!');
  updateTurn();
  if (roundTimer) roundTimer.stop();
  problemTimer.textContent = ROUND_TIME;
  problemTimer.classList.remove('urgent');
  roundTimer = createTimer(ROUND_TIME, rem => {
    problemTimer.textContent = rem;
    if (rem <= 5) problemTimer.classList.add('urgent');
  }, () => { evaluate(false); });
  roundTimer.start();
}

function updateTurn(){
  if (!roundActive) return;
  const side = (inputIdx % 2 === 0) ? 'P1' : 'P2';
  setActiveZone(side);
  setTurnIndicators(side);
  highlightCurrentDot(inputIdx);
  // 차례인 zone만 활성화
  disablePads(side !== 'P1', side !== 'P2');
}

function handlePadTap(side, key, btn){
  if (!roundActive || revealing) return;
  const expectedSide = (inputIdx % 2 === 0) ? 'P1' : 'P2';
  if (side !== expectedSide){
    // 차례가 아닌 사람이 누름 → 무시 (UI상으로도 disabled지만 안전장치)
    return;
  }
  sfx.play('tap');
  const expectedKey = seq[inputIdx];
  if (key !== expectedKey){
    btn.classList.remove('tap-wrong');
    void btn.offsetWidth;
    btn.classList.add('tap-wrong');
    failDot(inputIdx);
    evaluate(false);
    return;
  }
  // 정답
  playPadSound(key);
  btn.classList.remove('tap-correct');
  void btn.offsetWidth;
  btn.classList.add('tap-correct');
  fillDot(inputIdx);
  inputIdx++;
  if (inputIdx >= seq.length){
    evaluate(true);
  } else {
    updateTurn();
  }
}

function setStatus(txt){ problemStatus.textContent = txt; }

function evaluate(correct){
  if (!roundActive && !revealing) {
    // already evaluated
  }
  roundActive = false;
  revealing = false;
  if (roundTimer) roundTimer.pause();
  problemTimer.classList.remove('urgent');
  disablePads(true, true);
  setActiveZone(null);
  setTurnIndicators(null);
  if (correct){
    score++;
    perfect++;
    sfx.play('correct');
    setStatus('🎉 완벽! 호흡이 잘 맞았어요!');
  } else {
    sfx.play('wrong');
    const correctSeq = seq.map(k => getPad(k).emoji).join(' ');
    setStatus('❌ 실패! 정답: ' + correctSeq);
  }
  scoreVal.textContent = score;
  push(setTimeout(nextRound, 2200));
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success = score >= 3;
  $('resultTitle').textContent = success ? '🏆 협동 성공!' : '😔 아쉬워요...';
  $('resultWinner').textContent = success ? '박자가 척척 맞았어요!' : '3라운드 이상 성공이 목표!';
  $('statScore').textContent = score + '/' + TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect + '회';
  push(setTimeout(() => showScreen(resultScreen), 400));
}
