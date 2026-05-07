/* color-signal */
'use strict';

const TOTAL_ROUNDS = 10;
const ROUND_TIME = 15;

// 6 colors with Korean names
const COLORS = [
  { key: 'R', bg: '#EF5350', name: '빨강' },
  { key: 'B', bg: '#42A5F5', name: '파랑' },
  { key: 'Y', bg: '#FFEE58', name: '노랑' },
  { key: 'G', bg: '#66BB6A', name: '초록' },
  { key: 'P', bg: '#AB47BC', name: '보라' },
  { key: 'O', bg: '#FFA726', name: '주황' }
];

// 30 hand-curated 2-stripe flag patterns (data >= 30)
// Each pattern is array of color keys (top to bottom).
// All 2-stripe so 3x3 grid always gets 9 same-length options.
const FLAG_PATTERNS = [
  ['R','B'],['R','Y'],['R','G'],['R','P'],['R','O'],
  ['B','R'],['B','Y'],['B','G'],['B','P'],['B','O'],
  ['Y','R'],['Y','B'],['Y','G'],['Y','P'],['Y','O'],
  ['G','R'],['G','B'],['G','Y'],['G','P'],['G','O'],
  ['P','R'],['P','B'],['P','Y'],['P','G'],['P','O'],
  ['O','R'],['O','B'],['O','Y'],['O','G'],['O','P']
];

let round = 0, score = 0, perfect = 0;
let target = null, options = [], roundActive = false;
let roundTimer = null, allTimeouts = [];

const sfx = createSoundManager({
  beep(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);},
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  correct(ctx){[523,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.08;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.35);});},
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

const $ = id => document.getElementById(id);
const introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
const countdownNum=$('countdownNumber');
const questionCounter=$('questionCounter'), problemTimer=$('problemTimer'), problemStatus=$('problemStatus'), catTag=$('catTag');
const targetFlag=$('targetFlag'), picGrid=$('picGrid'), scoreVal=$('scoreVal');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function patternKey(p){return p.join('');}
function getColor(k){return COLORS.find(c=>c.key===k);}

function goHome(){
  stopAll();
  window.location.href = '../../index.html';
}

$('backBtn').addEventListener('click', goHome);
const stI=$('soundToggleIntro');
stI.addEventListener('click',()=>{stI.textContent=sfx.toggleMute()?'🔇':'🔊';});
stI.textContent=sfx.isMuted()?'🔇':'🔊';

onTap($('playBtn'),startCountdown);
onTap($('retryBtn'),startCountdown);
onTap($('homeBtn'),goHome);
onTap($('closeBtn'),()=>{stopAll();goHome();});

function stopAll(){clearAll();if(roundTimer){roundTimer.stop();roundTimer=null;}roundActive=false;}

function startCountdown(){
  stopAll();showScreen(countdownScreen);
  let n=3;countdownNum.textContent=n;
  function tick(){n--;if(n<=0){countdownNum.textContent='GO!';push(setTimeout(startGame,700));}else{countdownNum.textContent=n;push(setTimeout(tick,1000));}}
  push(setTimeout(tick,1000));
}

function startGame(){
  round=0;score=0;perfect=0;
  showScreen(gameScreen);
  scoreVal.textContent = '0';
  nextRound();
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  // Pick target pattern
  target = FLAG_PATTERNS[Math.floor(Math.random()*FLAG_PATTERNS.length)];
  const targetKey = patternKey(target);
  // Build options: target + 8 distractors with same stripe count
  const sameLength = FLAG_PATTERNS.filter(p => p.length===target.length && patternKey(p)!==targetKey);
  const distractors = shuffle([...sameLength]).slice(0, 8);
  options = shuffle([target, ...distractors]);
  roundActive = false;
  questionCounter.textContent = round + ' / ' + TOTAL_ROUNDS;
  catTag.textContent = '2색 깃발';
  renderTarget();
  renderGrid();
  disableInputs(true);
  setStatus('P1: 깃발을 잘 보세요!');
  push(setTimeout(startInputPhase, 1500));
}

function buildFlagInto(container, pattern){
  container.innerHTML = '';
  pattern.forEach(k => {
    const s = document.createElement('div');
    s.className = 'flag-stripe';
    s.style.background = getColor(k).bg;
    container.appendChild(s);
  });
}

function renderTarget(){
  buildFlagInto(targetFlag, target);
}

function renderGrid(){
  picGrid.innerHTML = '';
  options.forEach(p => {
    const b = document.createElement('button');
    b.className = 'pic-btn';
    b.dataset.k = patternKey(p);
    buildFlagInto(b, p);
    onTap(b, () => handlePick(p, b));
    picGrid.appendChild(b);
  });
}

function disableInputs(dis){
  picGrid.querySelectorAll('.pic-btn').forEach(b=>b.disabled=dis);
}

function setStatus(txt){
  problemStatus.textContent = txt;
}

function startInputPhase(){
  roundActive = true;
  disableInputs(false);
  setStatus('🗣 P1: 색과 순서를 설명해주세요!');
  if(roundTimer)roundTimer.stop();
  problemTimer.textContent = ROUND_TIME;
  problemTimer.classList.remove('urgent');
  roundTimer = createTimer(ROUND_TIME, rem=>{
    problemTimer.textContent = rem;
    if(rem<=5) problemTimer.classList.add('urgent');
  }, ()=>{evaluate(false, null);});
  roundTimer.start();
}

function handlePick(p, btn){
  if(!roundActive)return;
  sfx.play('tap');
  const correct = (patternKey(p) === patternKey(target));
  evaluate(correct, btn);
}

function evaluate(correct, btn){
  if(!roundActive)return;
  roundActive = false;
  if(roundTimer)roundTimer.pause();
  problemTimer.classList.remove('urgent');
  disableInputs(true);
  if(btn){
    btn.classList.add(correct?'state-correct':'state-wrong');
  }
  if(!correct){
    const tk = patternKey(target);
    picGrid.querySelectorAll('.pic-btn').forEach(b=>{
      if(b.dataset.k===tk) b.classList.add('state-correct');
    });
  }
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    setStatus('🎉 정답!');
  }else{
    const names = target.map(k=>getColor(k).name).join('-');
    sfx.play('wrong');
    setStatus('❌ 정답: ' + names);
  }
  scoreVal.textContent = score;
  push(setTimeout(nextRound, 2000));
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success = score>=3;
  $('resultTitle').textContent = success?'🏆 협동 성공!':'😔 아쉬워요...';
  $('resultWinner').textContent = success?'호흡이 잘 맞았어요!':'3라운드 이상 정답이 목표!';
  $('statScore').textContent = score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
