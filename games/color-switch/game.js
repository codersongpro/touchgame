/* games/color-switch/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;
  var ITEM_DISPLAY_MIN = 1200;  // ms item stays visible
  var ITEM_DISPLAY_MAX = 1800;
  var SPAWN_INTERVAL_MIN = 550; // ms between spawns per zone
  var SPAWN_INTERVAL_MAX = 950;
  var MAX_ITEMS_PER_ZONE = 3;
  var TARGET_MATCH_RATIO = 0.55; // ~55% of spawns match current target
  var ITEM_SIZE = 60;    // px
  var TARGET_SWITCH_MIN = 3000; // ms between target color switches
  var TARGET_SWITCH_MAX = 4500;

  var PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

  // 4 후보 색 (Level 3 파스텔 계열, 검정 테두리)
  var COLORS = [
    { key: 'red',    name: '빨강', fill: '#EF5350' },
    { key: 'blue',   name: '파랑', fill: '#42A5F5' },
    { key: 'green',  name: '초록', fill: '#66BB6A' },
    { key: 'yellow', name: '노랑', fill: '#FFEE58' }
  ];

  function colorByKey(k) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].key === k) return COLORS[i];
    return COLORS[0];
  }

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
    'match': function (ctx) {
      [880, 1320].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.07);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.2);
      });
    },
    'miss': function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    },
    'switch': function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(784, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
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

  // ===== 인원 선택 =====
  var selectedCount = 2;
  var playerBtns = document.querySelectorAll('.player-btn');
  playerBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCount = parseInt(btn.dataset.count, 10);
      playerBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

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
  var zoneCanvases = [];
  var allTimers = [];
  var gameTimer = null;
  var timerRemaining = GAME_DURATION;
  var targetKey = 'blue';
  var targetSwitchTimer = null;

  var timerFill = document.getElementById('timerFill');
  var timerText = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');
  var targetSwatchEl = document.getElementById('targetSwatch');
  var targetNameEl = document.getElementById('targetName');
  var targetBarEl = document.getElementById('targetBar');

  function randInt(min, max) { return min + Math.random() * (max - min); }
  function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ===== 목표 색 =====
  function renderTarget() {
    var c = colorByKey(targetKey);
    targetSwatchEl.style.background = c.fill;
    targetNameEl.textContent = c.name;
    targetBarEl.style.animation = 'none';
    void targetBarEl.offsetHeight;
    targetBarEl.style.animation = '';
  }

  function switchTarget() {
    if (!gameRunning) return;
    // 새 목표는 이전과 다른 색
    var next = targetKey;
    while (next === targetKey) next = randItem(COLORS).key;
    targetKey = next;
    renderTarget();
    sounds.play('switch');
    var delay = randInt(TARGET_SWITCH_MIN, TARGET_SWITCH_MAX);
    targetSwitchTimer = setTimeout(switchTarget, delay);
    allTimers.push(targetSwitchTimer);
  }

  // ===== 구역 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores = [];
    zoneCanvases = [];

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

      var canvas = document.createElement('div');
      canvas.className = 'zone-canvas';
      canvas.id = 'zoneCanvas' + p;
      zone.appendChild(canvas);

      zonesEl.appendChild(zone);
      zoneCanvases.push(canvas);
      playerScores.push(0);

      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);
    }
  }

  function addScore(playerIdx, amount) {
    playerScores[playerIdx] += amount;
    if (playerScores[playerIdx] < 0) playerScores[playerIdx] = 0;
    var val = playerScores[playerIdx];

    var zoneScoreEl = document.getElementById('zoneScore' + playerIdx);
    if (zoneScoreEl) zoneScoreEl.textContent = val;

    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 아이템 배치 로직 =====
  function countActiveItems(canvas) {
    return canvas.querySelectorAll('.dot:not(.disappearing)').length;
  }

  function spawnItem(playerIdx) {
    if (!gameRunning) return;

    var canvas = zoneCanvases[playerIdx];
    if (!canvas) return;

    if (countActiveItems(canvas) < MAX_ITEMS_PER_ZONE) {
      // 목표색 비율로 색 결정
      var color;
      if (Math.random() < TARGET_MATCH_RATIO) {
        color = colorByKey(targetKey);
      } else {
        color = randItem(COLORS);
      }

      var canvasW = canvas.offsetWidth || 120;
      var canvasH = canvas.offsetHeight || 120;
      var margin = 10;
      var maxX = Math.max(margin, canvasW - ITEM_SIZE - margin);
      var maxY = Math.max(margin, canvasH - ITEM_SIZE - margin);
      var x = margin + Math.random() * maxX;
      var y = margin + Math.random() * maxY;

      var item = document.createElement('div');
      item.className = 'dot';
      item.style.left = x + 'px';
      item.style.top = y + 'px';
      item.style.background = color.fill;
      item.dataset.colorKey = color.key;

      canvas.appendChild(item);

      (function (itemEl, pIdx, key) {
        onTap(itemEl, function () {
          if (!gameRunning) return;
          if (itemEl.classList.contains('disappearing')) return;

          itemEl.dataset.tapped = '1';
          removeItem(itemEl, canvas);

          if (key === targetKey) {
            sounds.play('match');
            addScore(pIdx, 1);
            showBurst(itemEl, canvas, true);
          } else {
            sounds.play('miss');
            addScore(pIdx, -1);
            showBurst(itemEl, canvas, false);
            showZoneFlash(canvas);
          }
        });
      })(item, playerIdx, color.key);

      var displayTime = ITEM_DISPLAY_MIN + Math.random() * (ITEM_DISPLAY_MAX - ITEM_DISPLAY_MIN);
      var disappearTimer = setTimeout(function () {
        if (!item.dataset.tapped) {
          removeItem(item, canvas);
        }
      }, displayTime);
      allTimers.push(disappearTimer);
    }

    var delay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    var nextTimer = setTimeout(function () { spawnItem(playerIdx); }, delay);
    allTimers.push(nextTimer);
  }

  function removeItem(itemEl, canvas) {
    if (!itemEl.parentNode) return;
    itemEl.classList.add('disappearing');
    var t = setTimeout(function () {
      if (itemEl.parentNode) itemEl.parentNode.removeChild(itemEl);
    }, 240);
    allTimers.push(t);
  }

  function showBurst(itemEl, canvas, good) {
    var burst = document.createElement('div');
    burst.className = 'burst ' + (good ? 'burst-good' : 'burst-bad');
    burst.textContent = good ? '+1' : '-1';
    var x = parseFloat(itemEl.style.left) + ITEM_SIZE / 2;
    var y = parseFloat(itemEl.style.top) + ITEM_SIZE / 2;
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    canvas.appendChild(burst);
    var t = setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 600);
    allTimers.push(t);
  }

  function showZoneFlash(canvas) {
    var flash = document.createElement('div');
    flash.className = 'zone-flash';
    canvas.appendChild(flash);
    var t = setTimeout(function () {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 420);
    allTimers.push(t);
  }

  // ===== 게임 시작/종료 =====
  function startGame() {
    playerCount = selectedCount;
    buildZones(playerCount);

    gameRunning = true;
    timerRemaining = GAME_DURATION;
    timerFill.style.width = '100%';
    timerText.textContent = GAME_DURATION;

    targetKey = randItem(COLORS).key;
    renderTarget();

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

    // 목표 색 전환 스케줄
    var switchDelay = randInt(TARGET_SWITCH_MIN, TARGET_SWITCH_MAX);
    targetSwitchTimer = setTimeout(switchTarget, switchDelay);
    allTimers.push(targetSwitchTimer);

    for (var p = 0; p < playerCount; p++) {
      (function (idx) {
        var initialDelay = idx * 120 + Math.random() * 200;
        var t = setTimeout(function () { spawnItem(idx); }, initialDelay);
        allTimers.push(t);
      })(p);
    }
  }

  function endGame() {
    gameRunning = false;

    allTimers.forEach(clearTimeout);
    allTimers = [];

    zoneCanvases.forEach(function (canvas) {
      if (canvas) canvas.innerHTML = '';
    });

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
