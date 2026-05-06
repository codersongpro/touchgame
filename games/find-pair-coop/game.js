/* find-pair-coop */
'use strict';

const TOTAL_ROUNDS = 5;
const ROUND_TIME = 25;

// 4 categories × 9 emojis = 36 items
const CATEGORIES = [
  {
    key: 'animal',
    label: '동물',
    items: ['🐶','🐱','🐰','🐻','🐼','🦁','🐯','🐮','🐷']
  },
  {
    key: 'food',
    label: '음식',
    items: ['🍎','🍌','🍇','🍓','🍕','🍔','🍞','🍪','🍩']
  },
  {
    key: 'nature',
    label: '자연',
    items: ['🌳','🌸','🌻','🌙','⭐','☀️','🌈','☁️','🌊']
  },
  {
    key: 'object',
    label: '물건',
    items: ['⚽','🎈','🚗','🚀','✈️','⛄','🎁','🎂','🎮']
  }
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
const countdownNum=$('countdownNumber'),hudRound=$('hudRound'),hudScore=$('hudScore'),hudFill=$('hudTimerFill');
const targetBox=$('targetBox'),catTag=$('catTag'),picGrid=$('picGrid'),banner=$('banner');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function goHome(){
  stopAll();
  window.location.href = '../../index.html';
}

$('backBtn').addEventListener('click', goHome);
const stI=$('soundToggleIntro');
stI.addEventListener('click',()=>{stI.textContent=sfx.toggleMute()?'🔇':'🔊';});
stI.textContent=sfx.isMuted()?'🔇':'🔊';
const stG=$('soundToggleGame');
stG.addEventListener('click',()=>{stG.textContent=sfx.toggleMute()?'🔇':'🔊';});

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
  stG.textContent=sfx.isMuted()?'🔇':'🔊';
  showScreen(gameScreen);
  nextRound();
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  // Pick a random category
  const cat = CATEGORIES[Math.floor(Math.random()*CATEGORIES.length)];
  const pool = shuffle([...cat.items]);
  target = pool[0];
  // 9-tile grid: target + 8 distractors from same category
  options = shuffle(pool.slice(0, 9));
  roundActive = false;
  hudRound.textContent = round + '/' + TOTAL_ROUNDS;
  hudScore.textContent = score + '점';
  catTag.textContent = '카테고리: ' + cat.label;
  renderTarget();
  renderGrid();
  disableInputs(true);
  showBanner('👁 P1: 그림을 잘 보세요!','info');
  push(setTimeout(startInputPhase, 1500));
}

function renderTarget(){
  targetBox.textContent = target;
}

function renderGrid(){
  picGrid.innerHTML = '';
  options.forEach(em => {
    const b = document.createElement('button');
    b.className = 'pic-btn';
    b.textContent = em;
    b.dataset.em = em;
    onTap(b, () => handlePick(em, b));
    picGrid.appendChild(b);
  });
}

function disableInputs(dis){
  picGrid.querySelectorAll('.pic-btn').forEach(b=>b.disabled=dis);
}

function startInputPhase(){
  roundActive = true;
  disableInputs(false);
  showBanner('🗣 P1: 특징을 설명해주세요!','info');
  if(roundTimer)roundTimer.stop();
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  roundTimer = createTimer(ROUND_TIME, rem=>{
    const pct=(rem/ROUND_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=5)hudFill.className='hud-timer-fill danger';
  }, ()=>{evaluate(false, null);});
  roundTimer.start();
}

function handlePick(em, btn){
  if(!roundActive)return;
  sfx.play('tap');
  const correct = (em === target);
  evaluate(correct, btn);
}

function evaluate(correct, btn){
  if(!roundActive)return;
  roundActive = false;
  if(roundTimer)roundTimer.pause();
  disableInputs(true);
  if(btn){
    btn.classList.add(correct?'correct':'wrong');
  }
  if(!correct){
    // Highlight the actual target
    picGrid.querySelectorAll('.pic-btn').forEach(b=>{
      if(b.dataset.em===target) b.classList.add('correct');
    });
  }
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    showBanner('🎉 정답! 잘 찾았어요!','ok');
  }else{
    sfx.play('wrong');
    showBanner('❌ 아쉬워요! 정답: '+target,'ng');
  }
  hudScore.textContent = score + '점';
  push(setTimeout(nextRound, 2000));
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+cls+' show';
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success = score>=3;
  $('resultEmoji').textContent = success?'🏆':'😔';
  $('resultHeadline').textContent = success?'협동 성공!':'아쉬워요...';
  $('resultHeadline').className = 'result-headline ' + (success?'success':'fail');
  $('resultSub').textContent = success?'호흡이 잘 맞았어요!':'3라운드 이상 정답이 목표!';
  $('statScore').textContent = score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
