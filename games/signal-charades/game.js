/* signal-charades */
'use strict';

const TOTAL_ROUNDS = 10;
const ROUND_TIME = 15;

// 30+ curated (target, [decoys]) entries. Categories: animals, actions, objects.
// Decoys chosen to be visually/conceptually distinct so the multiple-choice grid is fair.
const WORD_BANK = [
  // 동물 (animals)
  { word: '사자', decoys: ['코끼리', '토끼', '거북이', '원숭이'] },
  { word: '코끼리', decoys: ['사자', '기린', '돼지', '늑대'] },
  { word: '토끼', decoys: ['거북이', '여우', '고양이', '곰'] },
  { word: '거북이', decoys: ['토끼', '뱀', '개구리', '물고기'] },
  { word: '원숭이', decoys: ['사자', '판다', '캥거루', '사슴'] },
  { word: '기린', decoys: ['코끼리', '말', '낙타', '얼룩말'] },
  { word: '펭귄', decoys: ['오리', '닭', '백조', '갈매기'] },
  { word: '캥거루', decoys: ['원숭이', '토끼', '코알라', '사슴'] },
  { word: '고양이', decoys: ['강아지', '호랑이', '여우', '쥐'] },
  { word: '강아지', decoys: ['고양이', '늑대', '여우', '돼지'] },
  { word: '호랑이', decoys: ['사자', '치타', '표범', '고양이'] },
  { word: '코알라', decoys: ['판다', '캥거루', '원숭이', '곰'] },
  { word: '개구리', decoys: ['거북이', '뱀', '두꺼비', '물고기'] },
  { word: '뱀', decoys: ['개구리', '지렁이', '도마뱀', '거북이'] },
  { word: '닭', decoys: ['오리', '펭귄', '독수리', '참새'] },

  // 동작 (actions)
  { word: '뛰기', decoys: ['걷기', '점프', '눕기', '앉기'] },
  { word: '점프', decoys: ['뛰기', '구르기', '걷기', '앉기'] },
  { word: '박수', decoys: ['손흔들기', '인사', '악수', '주먹쥐기'] },
  { word: '잠자기', decoys: ['눈감기', '쉬기', '앉기', '하품'] },
  { word: '수영', decoys: ['걷기', '달리기', '점프', '춤추기'] },
  { word: '춤추기', decoys: ['박수', '뛰기', '걷기', '노래하기'] },
  { word: '노래하기', decoys: ['춤추기', '말하기', '박수', '웃기'] },
  { word: '울기', decoys: ['웃기', '화내기', '잠자기', '하품'] },
  { word: '웃기', decoys: ['울기', '화내기', '하품', '놀라기'] },
  { word: '인사', decoys: ['악수', '박수', '손흔들기', '절하기'] },
  { word: '낚시', decoys: ['수영', '요리', '청소', '운동'] },
  { word: '요리', decoys: ['청소', '빨래', '설거지', '낚시'] },
  { word: '청소', decoys: ['요리', '빨래', '운동', '독서'] },
  { word: '독서', decoys: ['그림그리기', '글쓰기', '청소', '노래하기'] },
  { word: '그림그리기', decoys: ['독서', '글쓰기', '공부', '요리'] },

  // 사물 (objects)
  { word: '의자', decoys: ['책상', '침대', '소파', '식탁'] },
  { word: '가방', decoys: ['지갑', '모자', '신발', '우산'] },
  { word: '우산', decoys: ['가방', '모자', '신발', '장갑'] },
  { word: '모자', decoys: ['안경', '신발', '장갑', '가방'] },
  { word: '안경', decoys: ['모자', '시계', '장갑', '목도리'] },
  { word: '시계', decoys: ['안경', '거울', '전화기', '컴퓨터'] },
  { word: '연필', decoys: ['지우개', '가위', '풀', '색종이'] },
  { word: '가위', decoys: ['연필', '풀', '지우개', '자'] },
  { word: '책상', decoys: ['의자', '침대', '소파', '식탁'] },
  { word: '냄비', decoys: ['그릇', '컵', '숟가락', '접시'] },
  { word: '컵', decoys: ['냄비', '그릇', '접시', '숟가락'] },
  { word: '신발', decoys: ['모자', '장갑', '양말', '가방'] },
  { word: '풍선', decoys: ['공', '연', '우산', '비눗방울'] },
  { word: '공', decoys: ['풍선', '연', '바퀴', '비눗방울'] },
  { word: '자전거', decoys: ['자동차', '기차', '버스', '오토바이'] }
];

let round = 0, score = 0, perfect = 0;
let target = null, options = [], roundActive = false;
let roundTimer = null, allTimeouts = [];
let usedIdx = [];

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
const targetWord=$('targetWord'), picGrid=$('picGrid'), scoreVal=$('scoreVal');

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
  round=0;score=0;perfect=0;usedIdx=[];
  showScreen(gameScreen);
  scoreVal.textContent = '0';
  nextRound();
}

function pickEntry(){
  if(usedIdx.length>=WORD_BANK.length) usedIdx=[];
  let idx;
  do{ idx = Math.floor(Math.random()*WORD_BANK.length); }while(usedIdx.includes(idx));
  usedIdx.push(idx);
  return WORD_BANK[idx];
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  const entry = pickEntry();
  target = entry.word;
  const decoyCount = 3 + Math.floor(Math.random()*3); // 3~5 decoys
  const decoys = shuffle([...entry.decoys]).slice(0, Math.min(decoyCount, entry.decoys.length));
  options = shuffle([target, ...decoys]);
  roundActive = false;
  questionCounter.textContent = round + ' / ' + TOTAL_ROUNDS;
  catTag.textContent = '단어 신호';
  renderTarget();
  renderGrid();
  disableInputs(true);
  setStatus('P1: 단어를 확인하세요!');
  push(setTimeout(startInputPhase, 1500));
}

function renderTarget(){
  targetWord.textContent = target;
}

function renderGrid(){
  picGrid.innerHTML = '';
  options.forEach(word => {
    const b = document.createElement('button');
    b.className = 'pic-btn';
    b.dataset.w = word;
    b.textContent = word;
    onTap(b, () => handlePick(word, b));
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
  setStatus('🤫 P1: 동작이나 힌트 한마디로 설명!');
  if(roundTimer)roundTimer.stop();
  problemTimer.textContent = ROUND_TIME;
  problemTimer.classList.remove('urgent');
  roundTimer = createTimer(ROUND_TIME, rem=>{
    problemTimer.textContent = rem;
    if(rem<=5) problemTimer.classList.add('urgent');
  }, ()=>{evaluate(false, null);});
  roundTimer.start();
}

function handlePick(word, btn){
  if(!roundActive)return;
  sfx.play('tap');
  const correct = (word === target);
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
    picGrid.querySelectorAll('.pic-btn').forEach(b=>{
      if(b.dataset.w===target) b.classList.add('state-correct');
    });
  }
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    setStatus('🎉 정답!');
  }else{
    sfx.play('wrong');
    setStatus('❌ 정답: ' + target);
  }
  scoreVal.textContent = score;
  push(setTimeout(nextRound, 2000));
}

function endGame(){
  stopAll();
  sfx.play('end');
  var scoreResult = reportGameResult({ gameId: 'signal-charades', playerCount: 2, scores: [score, score], metric: 'score' });
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
  const success = score>=3;
  $('resultTitle').textContent = success?'🏆 협동 성공!':'😔 아쉬워요...';
  $('resultWinner').textContent = success?'호흡이 잘 맞았어요!':'3라운드 이상 정답이 목표!';
  $('statScore').textContent = score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
