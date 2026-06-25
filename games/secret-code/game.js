/* secret-code */
'use strict';

const TOTAL_ROUNDS = 5;
const COLORS = [
  {key:'red',bg:'#EF5350',name:'빨강',emoji:'🔴'},
  {key:'blue',bg:'#42A5F5',name:'파랑',emoji:'🔵'},
  {key:'yellow',bg:'#FFEE58',name:'노랑',emoji:'🟡'},
  {key:'green',bg:'#66BB6A',name:'초록',emoji:'🟢'},
  {key:'purple',bg:'#AB47BC',name:'보라',emoji:'🟣'},
  {key:'orange',bg:'#FFA726',name:'주황',emoji:'🟠'}
];
const ROUND_LENS = [3,3,4,4,5];
const REVEAL_STEP = 900;
const ROUND_TIME = 25;

let round=0,score=0,perfect=0;
let seq=[],input=[],roundActive=false,roundTimer=null,allTimeouts=[];

const sfx=createSoundManager({
  beep(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.setValueAtTime(.18,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.1);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.1);},
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  correct(ctx){[523,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.08;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.35);});},
  wrong(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(180,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.3);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.35);},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

const $ = id=>document.getElementById(id);
const introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
const countdownNum=$('countdownNumber'),hudRound=$('hudRound'),hudScore=$('hudScore'),hudFill=$('hudTimerFill');
const seqSlots=$('seqSlots'),inputRow=$('inputRow'),colorGrid=$('colorGrid'),banner=$('banner');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

$('backBtn').addEventListener('click',goHome);
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
  buildColorGrid();
  nextRound();
}

function buildColorGrid(){
  colorGrid.innerHTML='';
  COLORS.forEach(c=>{
    const b=document.createElement('button');
    b.className='color-btn';
    b.style.background=c.bg;
    b.textContent=c.emoji;
    b.dataset.key=c.key;
    onTap(b,()=>handleInput(c.key));
    colorGrid.appendChild(b);
  });
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  const len=ROUND_LENS[round-1];
  // Generate sequence (allow repeats? simpler=unique for small len, allow repeats for len>=4)
  seq=[];
  if(len<=COLORS.length){
    const pool=shuffle([...COLORS]);
    for(let i=0;i<len;i++)seq.push(pool[i].key);
  }else{
    for(let i=0;i<len;i++)seq.push(COLORS[Math.floor(Math.random()*COLORS.length)].key);
  }
  input=[];
  roundActive=false;
  hudRound.textContent=round+'/'+TOTAL_ROUNDS;
  hudScore.textContent=score+'점';
  renderSlots(true);
  renderInputDots();
  disableInputs(true);
  showBanner('👁 P1: 집중해서 보세요!','info');
  revealSequence();
}

function renderSlots(hidden){
  seqSlots.innerHTML='';
  seq.forEach((k,i)=>{
    const s=document.createElement('div');
    s.className='seq-slot';
    if(!hidden){
      const c=COLORS.find(x=>x.key===k);
      s.style.background=c.bg;
      s.style.borderColor=c.bg;
      s.classList.add('filled');
      s.textContent=c.emoji;
    }else{
      s.textContent=(i+1);
    }
    seqSlots.appendChild(s);
  });
}

function renderInputDots(){
  inputRow.innerHTML='';
  seq.forEach((_,i)=>{
    const d=document.createElement('div');
    d.className='input-dot';
    if(input[i]!=null){
      const c=COLORS.find(x=>x.key===input[i]);
      d.style.background=c.bg;
      d.style.borderColor=c.bg;
      d.classList.add('filled');
    }
    inputRow.appendChild(d);
  });
}

function disableInputs(dis){
  colorGrid.querySelectorAll('.color-btn').forEach(b=>b.disabled=dis);
}

function revealSequence(){
  let i=0;
  function step(){
    if(i>=seq.length){
      // Keep visible for a beat, then hide so P1 has to remember/say it
      push(setTimeout(()=>{
        hideSequence();
        startInputPhase();
      },800));
      return;
    }
    const slot=seqSlots.children[i];
    const c=COLORS.find(x=>x.key===seq[i]);
    slot.style.background=c.bg;
    slot.style.borderColor=c.bg;
    slot.classList.add('filled');
    slot.textContent=c.emoji;
    sfx.play('beep');
    i++;
    push(setTimeout(step,REVEAL_STEP));
  }
  push(setTimeout(step,400));
}

function hideSequence(){
  // In true info-asymmetry this would hide, but leaving visible on P1 side is fine.
  // The asymmetry is P1 facing screen while saying aloud; P2 only sees own panel.
  // We'll keep revealed for P1 as reference throughout round.
}

function startInputPhase(){
  roundActive=true;
  disableInputs(false);
  showBanner('🗣 P1: 순서를 말해주세요!','info');
  if(roundTimer)roundTimer.stop();
  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  roundTimer=createTimer(ROUND_TIME,rem=>{
    const pct=(rem/ROUND_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=5)hudFill.className='hud-timer-fill danger';
  },()=>{evaluate(false);});
  roundTimer.start();
}

function handleInput(key){
  if(!roundActive)return;
  sfx.play('tap');
  input.push(key);
  renderInputDots();
  // Wrong immediately?
  const idx=input.length-1;
  if(input[idx]!==seq[idx]){
    evaluate(false);
    return;
  }
  if(input.length===seq.length){
    evaluate(true);
  }
}

function evaluate(correct){
  if(!roundActive)return;
  roundActive=false;
  if(roundTimer)roundTimer.pause();
  disableInputs(true);
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    showBanner('🎉 정답! 완벽한 해독!','ok');
  }else{
    sfx.play('wrong');
    showBanner('❌ 실패! 정답: '+seq.map(k=>COLORS.find(c=>c.key===k).emoji).join(' '),'ng');
  }
  hudScore.textContent=score+'점';
  push(setTimeout(nextRound,getAutoplayPauseMs(2200)));
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+cls+' show';
}

function endGame(){
  stopAll();
  sfx.play('end');
  var scoreResult = reportGameResult({ gameId: 'secret-code', playerCount: 2, scores: [score, score], metric: 'score' });
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
  const success=score>=3;
  $('resultEmoji').textContent=success?'🏆':'😔';
  $('resultHeadline').textContent=success?'암호 해독 성공!':'아쉬워요...';
  $('resultHeadline').className='result-headline '+(success?'success':'fail');
  $('resultSub').textContent=success?'호흡이 잘 맞았어요!':'3라운드 이상 성공이 목표!';
  $('statScore').textContent=score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent=perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
