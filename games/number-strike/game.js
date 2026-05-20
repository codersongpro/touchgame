/* games/number-strike/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;
  var NUMBER_INTERVAL_MS = 850;   // 각 zone 숫자가 바뀌는 주기
  var TARGET_ROTATE_MS  = 6000;   // 목표 숫자가 바뀌는 주기
  var POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

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
    hit: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(760, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
    miss: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    },
    fanfare: function (ctx) {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.13);
        osc.stop(ctx.currentTime + i * 0.13 + 0.35);
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
  var countdownEl     = document.getElementById('countdownNumber');
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

  // ===== 게임 상태 =====
  var gameRunning   = false;
  var playerCount   = 2;
  var playerScores  = [];
  var zoneNumberEls = [];
  var zoneCurrent   = [];   // 각 zone 현재 숫자
  var zoneTimers    = [];
  var allTimers     = [];
  var gameTimer     = null;
  var targetRotateTimer = null;
  var currentTarget = 1;

  var timerFill   = document.getElementById('timerFill');
  var timerText   = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');
  var targetNumEl = document.getElementById('targetNum');

  // ===== 헬퍼 =====
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function pickRandomExcept(arr, excludeVal) {
    var pool = arr.filter(function (v) { return v !== excludeVal; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ===== 존 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores  = [];
    zoneNumberEls = [];
    zoneCurrent   = [];
    zoneTimers    = [];

    for (var p = 0; p < count; p++) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = p + 1;

      var header = document.createElement('div');
      header.className = 'zone-header';
      zone.appendChild(header);

      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = PLAYER_NAMES[p];
      header.appendChild(label);

      var scoreEl = document.createElement('div');
      scoreEl.className = 'zone-score';
      scoreEl.id = 'zoneScore' + p;
      scoreEl.textContent = '0';
      header.appendChild(scoreEl);

      var numEl = document.createElement('div');
      numEl.className = 'zone-number';
      numEl.textContent = '?';
      zone.appendChild(numEl);
      zoneNumberEls.push(numEl);
      zoneCurrent.push(null);
      zoneTimers.push(null);

      (function (idx) {
        onTap(zone, function () {
          handleZoneTap(idx);
        });
      })(p);

      zonesEl.appendChild(zone);
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
    var val = playerScores[playerIdx];
    var zs = document.getElementById('zoneScore' + playerIdx);
    if (zs) zs.textContent = val;
    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 숫자 바꾸기 =====
  function setZoneNumber(playerIdx, n) {
    var el = zoneNumberEls[playerIdx];
    if (!el) return;
    zoneCurrent[playerIdx] = n;
    el.textContent = n;
    el.classList.remove('hit', 'miss');
    el.classList.toggle('target', n === currentTarget);
  }

  function scheduleZoneTick(playerIdx) {
    if (!gameRunning) return;
    var t = setTimeout(function () {
      if (!gameRunning) return;
      var next = pickRandomExcept(POOL, zoneCurrent[playerIdx]);
      setZoneNumber(playerIdx, next);
      scheduleZoneTick(playerIdx);
    }, NUMBER_INTERVAL_MS);
    zoneTimers[playerIdx] = t;
    allTimers.push(t);
  }

  function resetZoneTick(playerIdx) {
    var prev = zoneTimers[playerIdx];
    if (prev) clearTimeout(prev);
    scheduleZoneTick(playerIdx);
  }

  // ===== 목표 숫자 회전 =====
  function rotateTarget() {
    var next = pickRandomExcept(POOL, currentTarget);
    currentTarget = next;
    targetNumEl.textContent = next;
    // 모든 zone의 target 강조 갱신
    for (var i = 0; i < zoneNumberEls.length; i++) {
      zoneNumberEls[i].classList.toggle('target', zoneCurrent[i] === currentTarget);
    }
  }
  function scheduleTargetRotate() {
    if (!gameRunning) return;
    targetRotateTimer = setTimeout(function () {
      if (!gameRunning) return;
      rotateTarget();
      scheduleTargetRotate();
    }, TARGET_ROTATE_MS);
    allTimers.push(targetRotateTimer);
  }

  // ===== Zone 탭 처리 =====
  function handleZoneTap(playerIdx) {
    if (!gameRunning) return;
    var el = zoneNumberEls[playerIdx];
    var n = zoneCurrent[playerIdx];
    if (n === null) return;
    if (n === currentTarget) {
      addScore(playerIdx, 1);
      el.classList.remove('target', 'miss');
      void el.offsetHeight;
      el.classList.add('hit');
      sounds.play('hit');
      // 바로 다른 숫자로 교체 + 타이머 리셋
      var next = pickRandomExcept(POOL, currentTarget);
      setTimeout(function () {
        if (!gameRunning) return;
        setZoneNumber(playerIdx, next);
      }, 250);
      resetZoneTick(playerIdx);
    } else {
      addScore(playerIdx, -1);
      el.classList.remove('hit', 'target');
      void el.offsetHeight;
      el.classList.add('miss');
      sounds.play('miss');
      setTimeout(function () {
        if (!gameRunning) return;
        el.classList.remove('miss');
        el.classList.toggle('target', zoneCurrent[playerIdx] === currentTarget);
      }, 320);
    }
  }

  // ===== 게임 시작 =====
  function startGame() {
    playerCount = selectedCount;
    buildZones(playerCount);

    gameRunning = true;
    timerFill.style.width = '100%';
    timerText.textContent = GAME_DURATION;

    // 초기 목표 + 초기 zone 숫자
    currentTarget = pickRandom(POOL);
    targetNumEl.textContent = currentTarget;
    for (var p = 0; p < playerCount; p++) {
      var init = pickRandomExcept(POOL, currentTarget);
      setZoneNumber(p, init);
    }

    showScreen('game');

    gameTimer = createTimer(GAME_DURATION, function (rem) {
      var pct = (rem / GAME_DURATION * 100);
      timerFill.style.width = pct + '%';
      timerText.textContent = rem;
    }, function () {
      endGame();
    });

    gameTimer.start();

    for (var i = 0; i < playerCount; i++) {
      (function (idx) {
        var t = setTimeout(function () {
          if (!gameRunning) return;
          scheduleZoneTick(idx);
        }, idx * 60);
        allTimers.push(t);
      })(i);
    }
    scheduleTargetRotate();
  }

  // ===== 게임 종료 =====
  function endGame() {
    gameRunning = false;

    allTimers.forEach(clearTimeout);
    allTimers = [];
    if (targetRotateTimer) { clearTimeout(targetRotateTimer); targetRotateTimer = null; }

    zoneNumberEls.forEach(function (el) {
      el.classList.remove('target', 'hit', 'miss');
    });

    sounds.play('fanfare');
    showResult();
  }

  function cleanupGame() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    gameRunning = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    if (targetRotateTimer) { clearTimeout(targetRotateTimer); targetRotateTimer = null; }
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

    document.getElementById('resultWinnerLabel').textContent = isTie ? '동점!' : '승자';
    var winnerNameEl = document.getElementById('resultWinnerName');
    winnerNameEl.textContent  = isTie ? '무승부' : PLAYER_NAMES[winnerIdx];
    winnerNameEl.style.color  = isTie ? '#666' : PLAYER_COLORS[winnerIdx];

    var order = playerScores.map(function (s, i) { return { s: s, i: i }; });
    order.sort(function (a, b) { return b.s - a.s; });

    var resultScoresEl = document.getElementById('resultScores');
    resultScoresEl.innerHTML = '';
    order.forEach(function (item) {
      var isWinner = item.i === winnerIdx && !isTie;
      var row = document.createElement('div');
      row.className = 'result-score-row' + (isWinner ? ' winner' : '');
      row.dataset.player = item.i + 1;

      var trophySVG = '';
      if (isWinner) {
        trophySVG = '<svg viewBox="0 0 20 16" width="20" height="16" style="display:inline;vertical-align:middle;margin-right:4px"><polygon points="2,12 5,5 10,8 15,5 18,12" fill="#FFD700" stroke="#FFA000" stroke-width="1" stroke-linejoin="round"/><rect x="1.5" y="12" width="17" height="3" rx="1.5" fill="#FFD700" stroke="#FFA000" stroke-width="1"/></svg>';
      }

      var nameEl = document.createElement('div');
      nameEl.className = 'result-score-name';
      nameEl.innerHTML = trophySVG + PLAYER_NAMES[item.i];

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
