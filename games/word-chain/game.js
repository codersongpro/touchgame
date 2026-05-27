/* word-chain — 끝말잇기 협동 */
'use strict';

const TOTAL_ROUNDS = 10;
const ROUND_TIME = 20;

// 30개 시작 단어 + 정답 (끝말잇기 페어)
const CHAIN_PAIRS = [
  { start: '사과',   ans: '과자'   },
  { start: '학교',   ans: '교실'   },
  { start: '거북이', ans: '이불'   },
  { start: '우유',   ans: '유리'   },
  { start: '나비',   ans: '비누'   },
  { start: '사자',   ans: '자전거' },
  { start: '코끼리', ans: '리본'   },
  { start: '바나나', ans: '나무'   },
  { start: '포도',   ans: '도시'   },
  { start: '수박',   ans: '박수'   },
  { start: '운동',   ans: '동물'   },
  { start: '학생',   ans: '생일'   },
  { start: '책상',   ans: '상자'   },
  { start: '연필',   ans: '필통'   },
  { start: '가위',   ans: '위인'   },
  { start: '거울',   ans: '울보'   },
  { start: '모자',   ans: '자석'   },
  { start: '신발',   ans: '발자국' },
  { start: '시계',   ans: '계단'   },
  { start: '안경',   ans: '경찰'   },
  { start: '토끼',   ans: '끼니'   },
  { start: '강아지', ans: '지도'   },
  { start: '고양이', ans: '이슬'   },
  { start: '비행기', ans: '기차'   },
  { start: '자석',   ans: '석유'   },
  { start: '풍선',   ans: '선물'   },
  { start: '동물원', ans: '원숭이' },
  { start: '우산',   ans: '산토끼' },
  { start: '의자',   ans: '자판기' },
  { start: '호랑이', ans: '이름'   }
];

// 방해 단어 풀 (다양한 첫 글자)
const DISTRACTOR_POOL = [
  '가방','강아지','거울','고양이','공원','과일','교실','구두','기차','꽃밭',
  '나무','나비','노래','누나','다리','달님','도서관','동물','두부','라면',
  '마차','모자','물고기','바나나','바람','발자국','별빛','비누','빵집','사과',
  '사자','산책','색종이','선물','손목','수박','시계','신발','쌀밥','아기',
  '안경','야구','어머니','연필','오리','우산','우유','의자','자석','자전거',
  '잠자리','책상','친구','카메라','코끼리','토끼','파도','피아노','학교','해님',
  '호랑이','화분','휴지','이불','지도','끼니','계단','석유','이름','자판기',
  '산토끼','원숭이','경찰','상자','필통','과자','동전','리본','유리','생일'
];

let round = 0, score = 0, perfect = 0;
let currentPair = null, options = [], roundActive = false;
let roundTimer = null, allTimeouts = [];
let usedPairs = [];

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
function endCharOf(word){return word.charAt(word.length-1);}
function startCharOf(word){return word.charAt(0);}

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
  usedPairs=[];
  showScreen(gameScreen);
  scoreVal.textContent = '0';
  nextRound();
}

function pickPair(){
  let available = CHAIN_PAIRS.filter(p => !usedPairs.includes(p.start));
  if(available.length===0){usedPairs=[];available=CHAIN_PAIRS;}
  const p = available[Math.floor(Math.random()*available.length)];
  usedPairs.push(p.start);
  return p;
}

function buildOptions(pair){
  const ec = endCharOf(pair.start);
  const candidates = DISTRACTOR_POOL.filter(w => startCharOf(w) !== ec && w !== pair.ans);
  const uniq = [...new Set(candidates)];
  const distractors = shuffle([...uniq]).slice(0, 8);
  return shuffle([pair.ans, ...distractors]);
}

function nextRound(){
  if(round>=TOTAL_ROUNDS){endGame();return;}
  round++;
  currentPair = pickPair();
  options = buildOptions(currentPair);
  roundActive = false;
  questionCounter.textContent = round + ' / ' + TOTAL_ROUNDS;
  catTag.textContent = '끝말잇기';
  renderTarget();
  renderGrid();
  disableInputs(true);
  setStatus('👁 단어를 보세요!');
  push(setTimeout(startInputPhase, 1500));
}

function renderTarget(){
  const w = currentPair.start;
  targetWord.innerHTML = '';
  for(let i=0;i<w.length;i++){
    const span = document.createElement('span');
    span.textContent = w.charAt(i);
    if(i===w.length-1) span.className = 'end-char';
    targetWord.appendChild(span);
  }
}

function renderGrid(){
  picGrid.innerHTML = '';
  options.forEach(w => {
    const b = document.createElement('button');
    b.className = 'word-btn';
    b.textContent = w;
    b.dataset.word = w;
    onTap(b, () => handlePick(w, b));
    picGrid.appendChild(b);
  });
}

function disableInputs(dis){
  picGrid.querySelectorAll('.word-btn').forEach(b=>b.disabled=dis);
}

function setStatus(txt){
  problemStatus.textContent = txt;
}

function startInputPhase(){
  roundActive = true;
  disableInputs(false);
  const ec = endCharOf(currentPair.start);
  setStatus('🗣 "' + ec + '"으로 시작하는 단어를 찾으세요!');
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
  const correct = (word === currentPair.ans);
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
    picGrid.querySelectorAll('.word-btn').forEach(b=>{
      if(b.dataset.word===currentPair.ans) b.classList.add('state-correct');
    });
  }
  if(correct){
    score++;perfect++;
    sfx.play('correct');
    setStatus('🎉 정답! ' + currentPair.start + ' → ' + currentPair.ans);
  }else{
    sfx.play('wrong');
    setStatus('❌ 정답: ' + currentPair.ans);
  }
  scoreVal.textContent = score;
  push(setTimeout(nextRound, 2000));
}

function endGame(){
  stopAll();
  sfx.play('end');
  const success = score>=5;
  $('resultTitle').textContent = success?'🏆 협동 성공!':'😔 아쉬워요...';
  $('resultWinner').textContent = success?'호흡이 잘 맞았어요!':'5라운드 이상 정답이 목표!';
  $('statScore').textContent = score+'/'+TOTAL_ROUNDS;
  $('statPerfect').textContent = perfect+'회';
  push(setTimeout(()=>showScreen(resultScreen),400));
}
