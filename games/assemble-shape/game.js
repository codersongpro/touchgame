/* games/assemble-shape/game.js */
(function () {
  'use strict';

  var TOTAL_ROUNDS = 5;
  var ROUND_TIME = 25;

  // 30+개의 라운드 데이터: 부품 묘사 → 4개 보기 중 정답
  // 각 항목: { parts: [부품 설명 1~4개], answer: 정답 이모지, distractors: 오답 3개 }
  var ROUNDS = [
    // 동물
    { parts: ['둥근 몸통', '다리 4개', '긴 꼬리', '뾰족한 귀'], answer: '🐱', distractors: ['🐶', '🐰', '🐭'] },
    { parts: ['통통한 몸통', '큰 귀', '깡총 뛰는 다리', '짧은 꼬리'], answer: '🐰', distractors: ['🐭', '🐱', '🐹'] },
    { parts: ['두 발', '날개 2개', '부리', '깃털'], answer: '🐦', distractors: ['🐔', '🦉', '🦅'] },
    { parts: ['긴 코', '커다란 귀', '굵은 다리 4개', '회색 몸통'], answer: '🐘', distractors: ['🦏', '🦛', '🐂'] },
    { parts: ['줄무늬', '큰 몸통', '꼬리', '날카로운 이빨'], answer: '🐯', distractors: ['🦁', '🐆', '🐅'] },
    { parts: ['갈기', '4개 다리', '꼬리', '큰 입'], answer: '🦁', distractors: ['🐯', '🐺', '🐴'] },
    { parts: ['지느러미', '꼬리', '눈 2개', '비늘'], answer: '🐟', distractors: ['🐬', '🦈', '🐳'] },
    { parts: ['8개 다리', '둥근 몸통', '큰 머리', '먹물'], answer: '🐙', distractors: ['🦑', '🦀', '🦐'] },
    // 탈것
    { parts: ['두 바퀴', '안장', '핸들', '페달'], answer: '🚲', distractors: ['🛵', '🏍️', '🛴'] },
    { parts: ['네 바퀴', '문 4개', '핸들', '창문'], answer: '🚗', distractors: ['🚕', '🚙', '🚌'] },
    { parts: ['많은 좌석', '큰 창문', '바퀴 6개', '문 앞뒤'], answer: '🚌', distractors: ['🚎', '🚐', '🚍'] },
    { parts: ['날개 2개', '엔진', '꼬리 날개', '바퀴'], answer: '✈️', distractors: ['🚁', '🚀', '🛩️'] },
    { parts: ['프로펠러', '꼬리 회전날개', '조종석', '착륙 스키드'], answer: '🚁', distractors: ['✈️', '🛩️', '🪂'] },
    { parts: ['긴 몸통', '바퀴 여러 개', '레일 위', '굴뚝'], answer: '🚂', distractors: ['🚃', '🚄', '🚇'] },
    { parts: ['긴 사다리', '빨간 색', '호스', '사이렌'], answer: '🚒', distractors: ['🚓', '🚑', '🚐'] },
    // 음식
    { parts: ['둥근 빵', '고기 패티', '치즈', '양상추'], answer: '🍔', distractors: ['🌭', '🥪', '🌮'] },
    { parts: ['둥근 도우', '치즈', '토마토 소스', '토핑 여러 개'], answer: '🍕', distractors: ['🥧', '🥯', '🫓'] },
    { parts: ['긴 면', '국물', '계란', '파'], answer: '🍜', distractors: ['🍝', '🍲', '🍛'] },
    { parts: ['삼각형', '검은 김', '흰 밥', '속재료'], answer: '🍙', distractors: ['🍘', '🍡', '🍢'] },
    { parts: ['빨간 껍질', '꼭지', '동그란 모양', '아삭'], answer: '🍎', distractors: ['🍅', '🍒', '🍓'] },
    { parts: ['노란 껍질', '긴 모양', '굽은 형태', '꼭지'], answer: '🍌', distractors: ['🌽', '🥒', '🥑'] },
    { parts: ['초록 껍질', '검은 줄무늬', '둥근 모양', '빨간 속'], answer: '🍉', distractors: ['🍈', '🥝', '🍏'] },
    { parts: ['오렌지색', '둥글둥글', '꼭지', '시큼한 맛'], answer: '🍊', distractors: ['🍋', '🍑', '🥭'] },
    // 사물·자연
    { parts: ['빛나는 5각 모양', '뾰족한 끝', '밤하늘'], answer: '⭐', distractors: ['✨', '🌟', '💫'] },
    { parts: ['둥근 모양', '낮에 보임', '뜨거움', '햇빛'], answer: '☀️', distractors: ['🌝', '🌞', '🌕'] },
    { parts: ['둥근 모양', '밤에 보임', '은빛', '크레이터'], answer: '🌙', distractors: ['🌚', '🌛', '🌜'] },
    { parts: ['7색', '곡선', '비 그친 뒤', '하늘에'], answer: '🌈', distractors: ['☁️', '⛅', '🌤️'] },
    { parts: ['솜뭉치 같음', '하늘에', '흰색', '비'], answer: '☁️', distractors: ['🌫️', '💨', '⛅'] },
    { parts: ['초록 잎', '갈색 줄기', '뿌리', '키 큼'], answer: '🌳', distractors: ['🌲', '🌴', '🌵'] },
    { parts: ['꽃잎', '꽃받침', '줄기', '향기'], answer: '🌷', distractors: ['🌹', '🌺', '🌻'] },
    { parts: ['뿌리', '빨간 동그라미', '잎', '땅속'], answer: '🍅', distractors: ['🍎', '🍓', '🌶️'] },
    // 도구·악기
    { parts: ['긴 손잡이', '바늘', '시간 표시', '12 숫자'], answer: '🕐', distractors: ['⏰', '⌚', '⏱️'] },
    { parts: ['끈 6개', '나무 통', '구멍', '튕기는 손'], answer: '🎸', distractors: ['🪕', '🎻', '🎹'] },
    { parts: ['흑백 건반', '많은 키', '음표', '발판'], answer: '🎹', distractors: ['🎷', '🎺', '🪗'] }
  ];

  // ===== 화면 =====
  var screens = {
    intro:     document.getElementById('introScreen'),
    countdown: document.getElementById('countdownScreen'),
    game:      document.getElementById('gameScreen'),
    result:    document.getElementById('resultScreen')
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('active', key === name);
    });
  }

  // ===== 사운드 =====
  var sounds = createSoundManager({
    tap: function (ctx) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 520;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.1);
    },
    correct: function (ctx) {
      [523, 659, 784].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        var t = ctx.currentTime + i * 0.08;
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.32);
      });
    },
    wrong: function (ctx) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.22, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.35);
    },
    end: function (ctx) {
      [523, 659, 784, 1047].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        var t = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.42);
      });
    }
  });

  var soundBtnIntro = document.getElementById('soundToggleIntro');
  function updateSoundBtn() {
    soundBtnIntro.textContent = sounds.isMuted() ? '🔇' : '🔊';
  }
  soundBtnIntro.addEventListener('click', function () {
    sounds.toggleMute();
    updateSoundBtn();
  });
  updateSoundBtn();

  // ===== 카운트다운 =====
  var countdownEl = document.getElementById('countdownNumber');
  var countdownTimers = [];

  function clearCountdownTimers() {
    countdownTimers.forEach(clearTimeout);
    countdownTimers = [];
  }

  function startCountdown(onDone) {
    showScreen('countdown');
    var count = 3;
    countdownEl.textContent = count;
    countdownEl.style.animation = 'none';
    void countdownEl.offsetHeight;
    countdownEl.style.animation = '';

    function tick() {
      count--;
      if (count <= 0) {
        onDone();
        return;
      }
      countdownEl.textContent = count;
      countdownEl.style.animation = 'none';
      void countdownEl.offsetHeight;
      countdownEl.style.animation = '';
      countdownTimers.push(setTimeout(tick, 1000));
    }

    countdownTimers.push(setTimeout(tick, 1000));
  }

  // ===== 유틸 =====
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ===== 게임 상태 =====
  var round = 0, score = 0;
  var currentChoices = []; // 현재 라운드 4개 보기
  var currentAnswer = '';
  var roundActive = false;
  var roundTimer = null;
  var allTimers = [];

  var partsList = document.getElementById('partsList');
  var optionsGrid = document.getElementById('optionsGrid');
  var hudRound = document.getElementById('hudRound');
  var hudScore = document.getElementById('hudScore');
  var hudFill = document.getElementById('hudTimerFill');
  var banner = document.getElementById('banner');

  function showBanner(text, cls) {
    banner.textContent = text;
    banner.className = 'banner ' + cls + ' show';
  }
  function hideBanner() {
    banner.className = 'banner';
  }

  function pushTimer(t) { allTimers.push(t); return t; }

  function startGame() {
    round = 0;
    score = 0;
    // 5라운드 무작위 선택
    var pool = shuffle(ROUNDS).slice(0, TOTAL_ROUNDS);
    showScreen('game');
    nextRound(pool);
  }

  function nextRound(pool) {
    if (round >= TOTAL_ROUNDS) {
      endGame();
      return;
    }
    hideBanner();
    var r = pool[round];
    round++;
    hudRound.textContent = round + '/' + TOTAL_ROUNDS;
    hudScore.textContent = score + '점';

    // P1 부품 리스트 렌더
    partsList.innerHTML = '';
    r.parts.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'part-item';
      div.textContent = p;
      partsList.appendChild(div);
    });

    // P2 4개 보기 (정답 + 오답 3개 → 셔플)
    currentAnswer = r.answer;
    var choices = shuffle([r.answer].concat(r.distractors));
    // 보기에 정답 중복 없음 보장
    var seen = {};
    var unique = [];
    choices.forEach(function (c) {
      if (!seen[c]) { seen[c] = true; unique.push(c); }
    });
    while (unique.length < 4) unique.push('❓');
    currentChoices = unique.slice(0, 4);

    optionsGrid.innerHTML = '';
    currentChoices.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.textContent = emoji;
      btn.dataset.val = emoji;
      onTap(btn, function () { handlePick(btn, emoji, pool); });
      optionsGrid.appendChild(btn);
    });

    roundActive = true;
    showBanner('🗣 P1: 부품을 P2에게 말로 설명하세요!', 'info');

    // 타이머
    if (roundTimer) roundTimer.stop();
    hudFill.style.width = '100%';
    hudFill.className = 'hud-timer-fill';
    roundTimer = createTimer(ROUND_TIME, function (rem) {
      var pct = (rem / ROUND_TIME) * 100;
      hudFill.style.width = pct + '%';
      if (rem <= 5) hudFill.className = 'hud-timer-fill danger';
    }, function () {
      if (!roundActive) return;
      roundActive = false;
      sounds.play('wrong');
      showBanner('⏰ 시간 초과! 정답: ' + currentAnswer, 'ng');
      disableOptions();
      pushTimer(setTimeout(function () { nextRound(pool); }, 1800));
    });
    roundTimer.start();
  }

  function disableOptions() {
    optionsGrid.querySelectorAll('.option-btn').forEach(function (b) { b.disabled = true; });
  }

  function handlePick(btn, emoji, pool) {
    if (!roundActive) return;
    roundActive = false;
    if (roundTimer) roundTimer.pause();
    sounds.play('tap');

    if (emoji === currentAnswer) {
      score++;
      btn.classList.add('is-correct');
      sounds.play('correct');
      showBanner('🎉 정답!', 'ok');
    } else {
      btn.classList.add('is-wrong');
      sounds.play('wrong');
      showBanner('❌ 정답: ' + currentAnswer, 'ng');
      // 정답 버튼 강조
      optionsGrid.querySelectorAll('.option-btn').forEach(function (b) {
        if (b.dataset.val === currentAnswer) b.classList.add('is-correct');
      });
    }
    hudScore.textContent = score + '점';
    disableOptions();
    pushTimer(setTimeout(function () { nextRound(pool); }, 1800));
  }

  function endGame() {
    roundActive = false;
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
    sounds.play('end');
    showResult();
  }

  function cleanupGame() {
    if (roundTimer) { roundTimer.stop(); roundTimer = null; }
    roundActive = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    clearCountdownTimers();
  }

  function showResult() {
    var success = score >= 3;
    document.getElementById('resultWinnerLabel').textContent = success ? '협력 성공!' : '아쉬워요...';
    var nameEl = document.getElementById('resultWinnerName');
    nameEl.textContent = success ? '🎉 호흡이 잘 맞아요!' : '다시 도전!';
    nameEl.style.color = success ? '#00897B' : '#888';

    var resultScoresEl = document.getElementById('resultScores');
    resultScoresEl.innerHTML = '';
    var row1 = document.createElement('div');
    row1.className = 'result-score-row' + (success ? ' winner' : '');
    row1.innerHTML = '<div class="result-score-name">점수</div><div class="result-score-val">' + score + '/' + TOTAL_ROUNDS + '</div>';
    resultScoresEl.appendChild(row1);

    var row2 = document.createElement('div');
    row2.className = 'result-score-row';
    var msg = score === TOTAL_ROUNDS ? '완벽!' : (success ? '잘했어요!' : '3점 이상이 목표!');
    row2.innerHTML = '<div class="result-score-name">평가</div><div class="result-score-val">' + msg + '</div>';
    resultScoresEl.appendChild(row2);

    showScreen('result');
  }

  // ===== 버튼 이벤트 =====
  document.getElementById('playBtn').addEventListener('click', function () {
    startCountdown(startGame);
  });
  document.getElementById('retryBtn').addEventListener('click', function () {
    cleanupGame();
    startCountdown(startGame);
  });
  document.getElementById('homeBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });
  document.getElementById('backBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });
  document.getElementById('closeBtn').addEventListener('click', function () {
    cleanupGame();
    goHome();
  });

  window.addEventListener('beforeunload', cleanupGame);
  window.addEventListener('pagehide', cleanupGame);

})();
