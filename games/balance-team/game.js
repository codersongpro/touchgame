/* balance-team */
'use strict';

const TOTAL_CHECKPOINTS = 5;     // 체크포인트 5개 (0~5점)
const GAME_TIME = 45;            // 제한 시간(초)
const TICK_MS = 60;              // 물리 업데이트 간격(ms)
const TAP_NUDGE = 0.16;          // 탭 1회당 tilt 변화량
const TILT_DECAY = 0.985;        // 매 틱 tilt 자연 감쇠(평형 복원)
const TILT_DRIFT = 0.003;        // 매 틱 왼쪽으로 쏠리는 자연 기울기(가만히 두면 떨어짐)
const FALL_THRESHOLD = 1.0;      // |tilt| 이 값을 넘으면 추락
const MOVE_FACTOR = 0.55;        // tilt(우측 성향)가 위치 진행 속도에 미치는 영향
const FINISH_POS = 100;          // 목표 지점 위치

let score = 0, perfect = 0;
let timeLeft = GAME_TIME, gameTimer = null, physicsInterval = null, allTimeouts = [];
let pos = 0, tilt = 0, running = false, lastCheckpoint = -1, fallCount = 0;

const sfx = createSoundManager({
  tap(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.08);},
  checkpoint(ctx){[523,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.06;g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.25);});},
  fall(ctx){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(220,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(70,ctx.currentTime+.35);g.gain.setValueAtTime(.25,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.38);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.4);},
  win(ctx){[523,659,784,1047,1319].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.09;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.36);});},
  end(ctx){[523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const t=ctx.currentTime+i*.1;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.28,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.55);});}
});

const $ = id=>document.getElementById(id);
const introScreen=$('introScreen'),countdownScreen=$('countdownScreen'),gameScreen=$('gameScreen'),resultScreen=$('resultScreen');
const countdownNum=$('countdownNumber'),hudRound=$('hudRound'),hudScore=$('hudScore'),hudFill=$('hudTimerFill');
const beamTrack=$('beamTrack'),ball=$('ball'),checkpointMarks=$('checkpointMarks'),targetZone=$('targetZone'),banner=$('banner');
const btnLeft=$('btnLeft'),btnRight=$('btnRight');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}

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

function stopAll(){
  clearAll();
  if(gameTimer){gameTimer.stop();gameTimer=null;}
  if(physicsInterval){clearInterval(physicsInterval);physicsInterval=null;}
  running=false;
}

function startCountdown(){
  stopAll();showScreen(countdownScreen);
  let n=3;countdownNum.textContent=n;
  function tick(){n--;if(n<=0){countdownNum.textContent='GO!';push(setTimeout(startGame,700));}else{countdownNum.textContent=n;push(setTimeout(tick,1000));}}
  push(setTimeout(tick,1000));
}

function startGame(){
  score=0;perfect=0;pos=0;tilt=0;lastCheckpoint=-1;fallCount=0;timeLeft=GAME_TIME;running=true;
  stG.textContent=sfx.isMuted()?'🔇':'🔊';
  showScreen(gameScreen);
  buildCheckpointMarks();
  hudRound.textContent='0/'+TOTAL_CHECKPOINTS;
  hudScore.textContent=score+'점';
  showBanner('⚖️ 둘이 함께 균형을 맞춰요!','info');
  renderBall();

  hudFill.style.width='100%';
  hudFill.className='hud-timer-fill';
  gameTimer=createTimer(GAME_TIME,rem=>{
    timeLeft=rem;
    const pct=(rem/GAME_TIME)*100;
    hudFill.style.width=pct+'%';
    if(rem<=8)hudFill.className='hud-timer-fill danger';
  },()=>{endGame(false);});
  gameTimer.start();

  physicsInterval=setInterval(physicsStep,TICK_MS);
}

function buildCheckpointMarks(){
  checkpointMarks.innerHTML='';
  for(let i=1;i<=TOTAL_CHECKPOINTS;i++){
    const m=document.createElement('div');
    m.className='checkpoint-mark';
    m.style.left=((i/(TOTAL_CHECKPOINTS+1))*100)+'%';
    m.dataset.idx=i;
    checkpointMarks.appendChild(m);
  }
}

function nudge(dir){
  if(!running)return;
  sfx.play('tap');
  tilt += dir*TAP_NUDGE;
  if(tilt>2)tilt=2;
  if(tilt<-2)tilt=-2;
  flashBtn(dir>0?btnRight:btnLeft);
}

function flashBtn(btn){
  btn.classList.add('pressed');
  push(setTimeout(()=>btn.classList.remove('pressed'),120));
}

onTap(btnLeft,()=>nudge(-1));
onTap(btnRight,()=>nudge(1));

function physicsStep(){
  if(!running)return;

  // 자연 기울기: 가만히 두면 왼쪽으로 쏠려 떨어짐 → 양쪽 모두 계속 탭해야 함
  tilt -= TILT_DRIFT;
  // 평형 복원(감쇠): 탭이 누적되어도 서서히 0으로 수렴
  tilt *= TILT_DECAY;

  // 추락 판정
  if(Math.abs(tilt)>=FALL_THRESHOLD){
    handleFall();
    return;
  }

  // 위치 진행: tilt가 우측(+)일 때 전진, 좌측(-)일 때 후퇴(살짝)
  pos += tilt*MOVE_FACTOR;
  if(pos<0)pos=0;
  if(pos>FINISH_POS)pos=FINISH_POS;

  renderBall();
  checkCheckpoint();

  if(pos>=FINISH_POS){
    endGame(true);
  }
}

function checkCheckpoint(){
  const step=FINISH_POS/(TOTAL_CHECKPOINTS+1);
  const reached=Math.floor(pos/step);
  const capped=Math.min(reached,TOTAL_CHECKPOINTS);
  if(capped>lastCheckpoint){
    for(let i=lastCheckpoint+1;i<=capped;i++){
      score++;
      const mark=checkpointMarks.querySelector('[data-idx="'+i+'"]');
      if(mark)mark.classList.add('passed');
    }
    lastCheckpoint=capped;
    hudRound.textContent=score+'/'+TOTAL_CHECKPOINTS;
    hudScore.textContent=score+'점';
    sfx.play('checkpoint');
    showBanner('✅ 체크포인트 '+score+'! 좋아요!','ok');
  }
}

function handleFall(){
  fallCount++;
  sfx.play('fall');
  showBanner('💦 공이 떨어졌어요! 다시 균형을 잡아요','ng');
  pos=Math.max(0,pos-12); // 살짝 뒤로 밀림, 가혹한 패널티 없음
  tilt=0;
  renderBall();
}

function renderBall(){
  const pct=(pos/FINISH_POS)*100;
  ball.style.left=pct+'%';
  const angle=Math.max(-18,Math.min(18,tilt*16));
  beamTrack.style.transform='rotate('+angle+'deg)';
}

function showBanner(txt,cls){
  banner.textContent=txt;
  banner.className='banner '+cls+' show';
}

function endGame(success){
  stopAll();
  sfx.play(success?'win':'end');
  var scoreResult = reportGameResult({ gameId: 'balance-team', playerCount: 2, scores: [score, score], metric: 'score' });
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
  const reachedTarget = success || pos>=FINISH_POS;
  const goodScore = score>=3;
  const win = reachedTarget || goodScore;
  $('resultEmoji').textContent=win?'🏆':'😔';
  $('resultHeadline').textContent=reachedTarget?'목표 지점 도착!':(win?'균형 잡기 성공!':'아쉬워요...');
  $('resultHeadline').className='result-headline '+(win?'success':'fail');
  $('resultSub').textContent=win?'완벽한 협력이에요!':'3개 체크포인트 이상이 목표!';
  $('statScore').textContent=score+'/'+TOTAL_CHECKPOINTS;
  $('statPerfect').textContent=fallCount+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
