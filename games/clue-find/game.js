/* clue-find — 단서 찾기 (협동 수수께끼) */
'use strict';

const TOTAL_ROUNDS = 10;
const ROUND_TIME   = 20;
const SUCCESS_MIN  = 6;     // 6개 이상 맞히면 협동 성공
const READ_PAUSE   = getAutoplayPauseMs(1200);  // P1이 단서를 읽는 시간
const NEXT_PAUSE   = getAutoplayPauseMs(2000);
const AUTOPLAY     = new URLSearchParams(location.search).get('autoplay') === '1';

// 정답 후보 풀 (보기 = 정답 + 같은 풀에서 뽑은 distractor 8개 → 3x3)
const POOLS = {
  animal: ['🐱','🐶','🐰','🐯','🐻','🐼','🐸','🐵','🦁','🐷','🐔','🐧','🐮','🐘','🦒','🦊','🐨','🐭','🐹','🦓'],
  food:   ['🍎','🍌','🍓','🍉','🍊','🥕','🌽','🧀','🍕','🍔','🍇','🍒','🍞','🍪','🍰','🥚'],
  nature: ['☀️','🌙','🌈','❄️','⭐','☁️','⚡','💧','🔥','🌳','🌷','🍂'],
};
const POOL_KO = { animal: '동물', food: '음식', nature: '자연' };

// 30개 수수께끼 (데이터 다양성). answer 는 반드시 해당 pool 안에 존재.
const RIDDLES = [
  { clue: '야옹 하고 우는 동물은?', answer: '🐱', pool: 'animal' },
  { clue: '멍멍 짖으며 집을 지키는 동물은?', answer: '🐶', pool: 'animal' },
  { clue: '귀가 길고 깡충깡충 뛰는 동물은?', answer: '🐰', pool: 'animal' },
  { clue: '어흥! 숲속의 줄무늬 임금님은?', answer: '🐯', pool: 'animal' },
  { clue: '꿀을 좋아하고 겨울잠을 자는 동물은?', answer: '🐻', pool: 'animal' },
  { clue: '대나무를 즐겨 먹는 흑백 곰은?', answer: '🐼', pool: 'animal' },
  { clue: '개굴개굴 우는 연못의 동물은?', answer: '🐸', pool: 'animal' },
  { clue: '바나나를 좋아하고 나무를 잘 타는 동물은?', answer: '🐵', pool: 'animal' },
  { clue: '갈기가 멋진 동물의 왕은?', answer: '🦁', pool: 'animal' },
  { clue: '꿀꿀 우는 분홍색 동물은?', answer: '🐷', pool: 'animal' },
  { clue: '꼬끼오! 아침을 알리는 새는?', answer: '🐔', pool: 'animal' },
  { clue: '뒤뚱뒤뚱 걷는 남극의 새는?', answer: '🐧', pool: 'animal' },
  { clue: '음매 울고 우유를 주는 동물은?', answer: '🐮', pool: 'animal' },
  { clue: '코가 길고 몸집이 아주 큰 동물은?', answer: '🐘', pool: 'animal' },
  { clue: '목이 아주 길어서 높은 잎을 먹는 동물은?', answer: '🦒', pool: 'animal' },
  { clue: '꾀가 많기로 유명한 빨간 동물은?', answer: '🦊', pool: 'animal' },
  { clue: '빨갛고 아삭한, 의사를 멀리하게 한다는 과일은?', answer: '🍎', pool: 'food' },
  { clue: '원숭이가 좋아하는 길쭉한 노란 과일은?', answer: '🍌', pool: 'food' },
  { clue: '빨갛고 씨가 콕콕 박힌 봄 과일은?', answer: '🍓', pool: 'food' },
  { clue: '초록 껍질에 빨간 속, 시원한 여름 과일은?', answer: '🍉', pool: 'food' },
  { clue: '주황색이고 비타민이 가득한 새콤한 과일은?', answer: '🍊', pool: 'food' },
  { clue: '토끼가 좋아하는 주황색 채소는?', answer: '🥕', pool: 'food' },
  { clue: '노란 알갱이가 줄줄이 달린 채소는?', answer: '🌽', pool: 'food' },
  { clue: '쥐가 좋아하는 노랗고 구멍 뚫린 음식은?', answer: '🧀', pool: 'food' },
  { clue: '둥글고 치즈와 토핑이 올라간 이탈리아 음식은?', answer: '🍕', pool: 'food' },
  { clue: '동그란 빵 사이에 고기를 넣은 음식은?', answer: '🍔', pool: 'food' },
  { clue: '낮에 하늘에서 환하게 빛나는 것은?', answer: '☀️', pool: 'nature' },
  { clue: '밤하늘에 둥실 떠오르는 것은?', answer: '🌙', pool: 'nature' },
  { clue: '비가 그친 뒤 하늘에 뜨는 일곱 빛깔은?', answer: '🌈', pool: 'nature' },
  { clue: '겨울에 하늘에서 내리는 하얀 것은?', answer: '❄️', pool: 'nature' },
];

let round = 0, score = 0, perfect = 0;
let current = null, options = [], roundActive = false;
let roundTimer = null, allTimeouts = [], gameRiddles = [];

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
const clueText=$('clueText'), picGrid=$('picGrid'), scoreVal=$('scoreVal');

function showScreen(el){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));void el.offsetWidth;el.classList.add('active');}
function push(t){allTimeouts.push(t);return t;}
function clearAll(){allTimeouts.forEach(clearTimeout);allTimeouts=[];}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function goHome(){ stopAll(); window.location.href = '../../index.html'; }

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
  gameRiddles = shuffle([...RIDDLES]).slice(0, TOTAL_ROUNDS);
  showScreen(gameScreen);
  scoreVal.textContent = '0';
  nextRound();
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  current = gameRiddles[round];
  round++;
  const pool = POOLS[current.pool];
  const distractors = shuffle(pool.filter(e => e !== current.answer)).slice(0, 8);
  options = shuffle([current.answer, ...distractors]);
  roundActive = false;
  questionCounter.textContent = round + ' / ' + TOTAL_ROUNDS;
  catTag.textContent = POOL_KO[current.pool];
  renderClue();
  renderGrid();
  disableInputs(true);
  setStatus('👁 P1: 단서를 읽어주세요!');
  push(setTimeout(startInputPhase, READ_PAUSE));
}

function renderClue(){
  clueText.textContent = current.clue;
}

function renderGrid(){
  picGrid.innerHTML = '';
  options.forEach(emoji => {
    const b = document.createElement('button');
    b.className = 'pic-btn';
    b.dataset.e = emoji;
    b.innerHTML = '<span class="pic-emoji">' + emoji + '</span>';
    onTap(b, () => handlePick(emoji, b));
    picGrid.appendChild(b);
  });
}

function disableInputs(dis){
  picGrid.querySelectorAll('.pic-btn').forEach(b=>b.disabled=dis);
}

function setStatus(txt){ problemStatus.textContent = txt; }

function startInputPhase(){
  roundActive = true;
  disableInputs(false);
  setStatus('🔎 P2: 정답 그림을 찾아 눌러요!');
  if(roundTimer)roundTimer.stop();
  problemTimer.textContent = ROUND_TIME;
  problemTimer.classList.remove('urgent');
  roundTimer = createTimer(ROUND_TIME, rem=>{
    problemTimer.textContent = rem;
    if(rem<=5) problemTimer.classList.add('urgent');
  }, ()=>{evaluate(false, null);});
  roundTimer.start();
  if(AUTOPLAY) push(setTimeout(autoPick, 150));
}

function autoPick(){
  if(!roundActive) return;
  const btn = picGrid.querySelector('.pic-btn[data-e="'+current.answer+'"]');
  if(btn) handlePick(current.answer, btn);
}

function handlePick(emoji, btn){
  if(!roundActive)return;
  sfx.play('tap');
  const correct = (emoji === current.answer);
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
      if(b.dataset.e===current.answer) b.classList.add('state-correct');
    });
  }
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    setStatus('🎉 정답! ' + current.answer);
  }else{
    sfx.play('wrong');
    setStatus('❌ 정답은 ' + current.answer);
  }
  scoreVal.textContent = score;
  push(setTimeout(nextRound, NEXT_PAUSE));
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success = score>=SUCCESS_MIN;
  $('resultTitle').textContent = success?'🏆 협동 성공!':'😊 잘했어요!';
  $('resultWinner').textContent = success?'호흡이 척척 맞았어요!':(SUCCESS_MIN+'개 이상 맞히면 성공! 다시 도전해요!');
  $('statScore').textContent = score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
