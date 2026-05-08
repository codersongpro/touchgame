/* games/quick-sort/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;

  var PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

  // ===== 데이터: 40개 (동물 20 + 식물 20) =====
  var ITEMS = [
    { e: '🐯', n: '호랑이', t: 'animal' },
    { e: '🦁', n: '사자', t: 'animal' },
    { e: '🐘', n: '코끼리', t: 'animal' },
    { e: '🐰', n: '토끼', t: 'animal' },
    { e: '🐶', n: '강아지', t: 'animal' },
    { e: '🐱', n: '고양이', t: 'animal' },
    { e: '🐴', n: '말', t: 'animal' },
    { e: '🐮', n: '소', t: 'animal' },
    { e: '🐷', n: '돼지', t: 'animal' },
    { e: '🐔', n: '닭', t: 'animal' },
    { e: '🦆', n: '오리', t: 'animal' },
    { e: '🐧', n: '펭귄', t: 'animal' },
    { e: '🐻', n: '곰', t: 'animal' },
    { e: '🐺', n: '늑대', t: 'animal' },
    { e: '🦊', n: '여우', t: 'animal' },
    { e: '🐨', n: '코알라', t: 'animal' },
    { e: '🐼', n: '판다', t: 'animal' },
    { e: '🦒', n: '기린', t: 'animal' },
    { e: '🐢', n: '거북이', t: 'animal' },
    { e: '🐸', n: '개구리', t: 'animal' },
    { e: '🍎', n: '사과', t: 'plant' },
    { e: '🍐', n: '배', t: 'plant' },
    { e: '🍇', n: '포도', t: 'plant' },
    { e: '🍉', n: '수박', t: 'plant' },
    { e: '🍓', n: '딸기', t: 'plant' },
    { e: '🍌', n: '바나나', t: 'plant' },
    { e: '🥕', n: '당근', t: 'plant' },
    { e: '🥒', n: '오이', t: 'plant' },
    { e: '🍆', n: '가지', t: 'plant' },
    { e: '🌽', n: '옥수수', t: 'plant' },
    { e: '🍅', n: '토마토', t: 'plant' },
    { e: '🥦', n: '브로콜리', t: 'plant' },
    { e: '🍑', n: '복숭아', t: 'plant' },
    { e: '🍊', n: '오렌지', t: 'plant' },
    { e: '🍋', n: '레몬', t: 'plant' },
    { e: '🥝', n: '키위', t: 'plant' },
    { e: '🌶️', n: '고추', t: 'plant' },
    { e: '🥬', n: '배추', t: 'plant' },
    { e: '🍒', n: '체리', t: 'plant' },
    { e: '🥔', n: '감자', t: 'plant' }
  ];

  // ===== 화면 =====
  var screens = {
    intro: document.getElementById('introScreen'),
    countdown: document.getElementById('countdownScreen'),
    game: document.getElementById('gameScreen'),
    result: document.getElementById('resultScreen')
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('active', key === name);
    });
  }

  // ===== 사운드 =====
  var sounds = createSoundManager({
    correct: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    },
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    },
    fanfare: function (ctx) {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    }
  });

  // 사운드 버튼
  var soundBtnIntro = document.getElementById('soundToggleIntro');

  function updateSoundBtn() {
    soundBtnIntro.textContent = sounds.isMuted() ? '🔇' : '🔊';
  }

  soundBtnIntro.addEventListener('click', function () {
    sounds.toggleMute();
    updateSoundBtn();
  });
  updateSoundBtn();

  // ===== 인원 고정 (2인) =====
  var selectedCount = 2;

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
      var t = setTimeout(tick, 1000);
      countdownTimers.push(t);
    }

    var t = setTimeout(tick, 1000);
    countdownTimers.push(t);
  }

  // ===== 게임 상태 =====
  var gameRunning = false;
  var playerCount = 2;
  var playerScores = [];
  var playerCurrentItem = [];
  var playerQueues = [];
  var playerQueueIdx = [];
  var playerCardEls = [];
  var allTimers = [];
  var gameTimer = null;
  var timerRemaining = GAME_DURATION;

  // HUD refs
  var timerFill = document.getElementById('timerFill');
  var timerText = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

  // ===== 유틸 =====
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function nextItem(playerIdx) {
    var q = playerQueues[playerIdx];
    var idx = playerQueueIdx[playerIdx];
    if (idx >= q.length) {
      playerQueues[playerIdx] = shuffle(ITEMS);
      playerQueueIdx[playerIdx] = 0;
      idx = 0;
    }
    var item = playerQueues[playerIdx][idx];
    playerQueueIdx[playerIdx] = idx + 1;
    return item;
  }

  function renderItem(playerIdx) {
    var item = nextItem(playerIdx);
    playerCurrentItem[playerIdx] = item;
    var card = playerCardEls[playerIdx];
    if (!card) return;
    card.classList.remove('flash-correct', 'flash-wrong');
    card.innerHTML =
      '<div class="item-emoji">' + item.e + '</div>' +
      '<div class="item-name">' + item.n + '</div>';
  }

  // ===== 구역 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores = [];
    playerCurrentItem = [];
    playerQueues = [];
    playerQueueIdx = [];
    playerCardEls = [];

    for (var p = 0; p < count; p++) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = p + 1;

      var header = document.createElement('div');
      header.className = 'zone-header';

      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = PLAYER_NAMES[p];
      header.appendChild(label);

      var scoreEl = document.createElement('div');
      scoreEl.className = 'zone-score';
      scoreEl.id = 'zoneScore' + p;
      scoreEl.textContent = '0';
      header.appendChild(scoreEl);

      zone.appendChild(header);

      var card = document.createElement('div');
      card.className = 'item-card';
      card.id = 'itemCard' + p;
      zone.appendChild(card);

      var btnWrap = document.createElement('div');
      btnWrap.className = 'sort-buttons';

      var animalBtn = document.createElement('button');
      animalBtn.className = 'sort-btn btn-animal';
      animalBtn.dataset.player = p;
      animalBtn.dataset.choice = 'animal';
      animalBtn.innerHTML = '<span class="sort-btn-emoji">🐶</span><span class="sort-btn-label">동물</span>';
      btnWrap.appendChild(animalBtn);

      var plantBtn = document.createElement('button');
      plantBtn.className = 'sort-btn btn-plant';
      plantBtn.dataset.player = p;
      plantBtn.dataset.choice = 'plant';
      plantBtn.innerHTML = '<span class="sort-btn-emoji">🌱</span><span class="sort-btn-label">식물</span>';
      btnWrap.appendChild(plantBtn);

      zone.appendChild(btnWrap);
      zonesEl.appendChild(zone);

      playerScores.push(0);
      playerQueues.push(shuffle(ITEMS));
      playerQueueIdx.push(0);
      playerCardEls.push(card);
      playerCurrentItem.push(null);

      (function (idx, aBtn, pBtn) {
        onTap(aBtn, function () { handleChoice(idx, 'animal'); });
        onTap(pBtn, function () { handleChoice(idx, 'plant'); });
      })(p, animalBtn, plantBtn);

      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);
    }

    for (var i = 0; i < count; i++) {
      renderItem(i);
    }
  }

  function handleChoice(playerIdx, choice) {
    if (!gameRunning) return;
    var item = playerCurrentItem[playerIdx];
    if (!item) return;

    var card = playerCardEls[playerIdx];
    var correct = (item.t === choice);

    if (correct) {
      addScore(playerIdx, 1);
      sounds.play('correct');
      card.classList.add('flash-correct');
    } else {
      addScore(playerIdx, -1);
      sounds.play('wrong');
      card.classList.add('flash-wrong');
    }

    var t = setTimeout(function () {
      if (gameRunning) renderItem(playerIdx);
    }, 200);
    allTimers.push(t);
  }

  function addScore(playerIdx, amount) {
    playerScores[playerIdx] += amount;
    var val = playerScores[playerIdx];

    var zoneScoreEl = document.getElementById('zoneScore' + playerIdx);
    if (zoneScoreEl) zoneScoreEl.textContent = val;

    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 게임 시작/종료 =====
  function startGame() {
    playerCount = selectedCount;
    buildZones(playerCount);

    gameRunning = true;
    timerRemaining = GAME_DURATION;
    timerFill.style.width = '100%';
    timerText.textContent = GAME_DURATION;

    showScreen('game');

    gameTimer = createTimer(GAME_DURATION, function (rem) {
      timerRemaining = rem;
      var pct = (rem / GAME_DURATION * 100);
      timerFill.style.width = pct + '%';
      timerText.textContent = rem;
    }, function () {
      endGame();
    });

    gameTimer.start();
  }

  function endGame() {
    gameRunning = false;

    allTimers.forEach(clearTimeout);
    allTimers = [];

    sounds.play('fanfare');
    showResult();
  }

  function cleanupGame() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    gameRunning = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    clearCountdownTimers();
  }

  // ===== 결과 화면 =====
  function showResult() {
    var maxScore = -Infinity;
    var winnerIdx = 0;
    playerScores.forEach(function (s, i) {
      if (s > maxScore) { maxScore = s; winnerIdx = i; }
    });

    var isTie = playerScores.filter(function (s) { return s === maxScore; }).length > 1;

    var winnerLabel = document.getElementById('resultWinnerLabel');
    var winnerName = document.getElementById('resultWinnerName');
    var resultScoresEl = document.getElementById('resultScores');

    winnerLabel.textContent = isTie ? '동점!' : '승자';
    winnerName.textContent = isTie ? '무승부' : PLAYER_NAMES[winnerIdx];
    winnerName.style.color = isTie ? '#888' : PLAYER_COLORS[winnerIdx];

    var order = playerScores.map(function (s, i) { return { s: s, i: i }; });
    order.sort(function (a, b) { return b.s - a.s; });

    resultScoresEl.innerHTML = '';
    order.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'result-score-row' + (item.i === winnerIdx && !isTie ? ' winner' : '');
      row.dataset.player = item.i + 1;

      var nameEl = document.createElement('div');
      nameEl.className = 'result-score-name';
      nameEl.textContent = (item.i === winnerIdx && !isTie ? '🏆 ' : '') + PLAYER_NAMES[item.i];

      var valEl = document.createElement('div');
      valEl.className = 'result-score-val';
      valEl.textContent = item.s + '점';

      row.appendChild(nameEl);
      row.appendChild(valEl);
      resultScoresEl.appendChild(row);
    });

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
