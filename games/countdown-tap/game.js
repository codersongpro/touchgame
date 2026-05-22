/* games/countdown-tap/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;

  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

  // 시퀀스: 5→4→3→2→1→0
  var SEQUENCE = [5, 4, 3, 2, 1, 0];
  var STEP_MS = 600;          // 각 숫자 표시 시간
  var TARGET_WINDOW_MS = 700; // "0" 표시 시간 (반응 윈도우)
  var WAIT_MIN_MS = 700;      // 시퀀스 사이 대기 최소
  var WAIT_MAX_MS = 1500;     // 시퀀스 사이 대기 최대

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
    tick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    },
    hit: function (ctx) {
      var notes = [523, 784];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.2);
      });
    },
    miss: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    },
    fanfare: function (ctx) {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
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

  // ===== 카운트다운 (PLAY 전) =====
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

  // ===== 게임 상태 =====
  var gameRunning = false;
  var playerCount = 2;
  var playerScores = [];
  var zoneDisplays = []; // countdown-display element per player
  var zoneStates = [];   // { phase: 'wait'|'showing'|'target', currentNum: number|null, targetEndAt: number|null, sequenceTimers: [] }
  var allTimers = [];
  var gameTimer = null;
  var timerRemaining = GAME_DURATION;

  var timerFill = document.getElementById('timerFill');
  var timerText = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

  // ===== 존 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores = [];
    zoneDisplays = [];
    zoneStates = [];

    for (var p = 0; p < count; p++) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = p + 1;

      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = PLAYER_NAMES[p];
      zone.appendChild(label);

      var scoreEl = document.createElement('div');
      scoreEl.className = 'zone-score';
      scoreEl.id = 'zoneScore' + p;
      scoreEl.textContent = '0';
      zone.appendChild(scoreEl);

      var display = document.createElement('div');
      display.className = 'countdown-display is-wait';
      display.textContent = '...';
      zone.appendChild(display);
      zoneDisplays.push(display);

      zonesEl.appendChild(zone);
      playerScores.push(0);
      zoneStates.push({ phase: 'wait', currentNum: null, sequenceTimers: [], cooldown: false });

      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);

      // Tap handler on zone
      (function (idx) {
        var z = zone;
        onTap(z, function () {
          handleZoneTap(idx);
        });
      })(p);
    }
  }

  function updateScore(playerIdx, delta) {
    playerScores[playerIdx] += delta;
    var val = playerScores[playerIdx];
    var zs = document.getElementById('zoneScore' + playerIdx);
    if (zs) zs.textContent = val;
    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 시퀀스 진행 =====
  function clearZoneTimers(playerIdx) {
    zoneStates[playerIdx].sequenceTimers.forEach(clearTimeout);
    zoneStates[playerIdx].sequenceTimers = [];
  }

  function setDisplay(playerIdx, text, className) {
    var d = zoneDisplays[playerIdx];
    if (!d) return;
    d.textContent = text;
    d.className = 'countdown-display ' + (className || '');
  }

  function scheduleSequence(playerIdx, initialDelay) {
    if (!gameRunning) return;
    var state = zoneStates[playerIdx];
    state.phase = 'wait';
    state.currentNum = null;
    setDisplay(playerIdx, '...', 'is-wait');

    var t = setTimeout(function () {
      runSequence(playerIdx, 0);
    }, initialDelay);
    state.sequenceTimers.push(t);
  }

  function runSequence(playerIdx, stepIdx) {
    if (!gameRunning) return;
    var state = zoneStates[playerIdx];
    if (stepIdx >= SEQUENCE.length) {
      // 0 표시 끝났는데 안 눌렀음 (miss-by-omission, but no penalty — 그냥 다음 시퀀스)
      state.phase = 'wait';
      state.currentNum = null;
      setDisplay(playerIdx, '...', 'is-wait');
      var wait = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
      var t = setTimeout(function () { runSequence(playerIdx, 0); }, wait);
      state.sequenceTimers.push(t);
      return;
    }

    var num = SEQUENCE[stepIdx];
    state.currentNum = num;

    if (num === 0) {
      state.phase = 'target';
      setDisplay(playerIdx, '0', 'is-target');
      // Play target tick
      sounds.play('tick');
      // Hold 0 for TARGET_WINDOW_MS then move on
      var t = setTimeout(function () {
        runSequence(playerIdx, stepIdx + 1);
      }, TARGET_WINDOW_MS);
      state.sequenceTimers.push(t);
    } else {
      state.phase = 'showing';
      setDisplay(playerIdx, String(num), 'is-showing');
      sounds.play('tick');
      var t = setTimeout(function () {
        runSequence(playerIdx, stepIdx + 1);
      }, STEP_MS);
      state.sequenceTimers.push(t);
    }
  }

  // ===== 터치 처리 =====
  function handleZoneTap(playerIdx) {
    if (!gameRunning) return;
    var state = zoneStates[playerIdx];
    if (state.cooldown) return;

    if (state.phase === 'target') {
      // 정답!
      updateScore(playerIdx, 1);
      sounds.play('hit');
      setDisplay(playerIdx, '+1', 'is-hit');
      clearZoneTimers(playerIdx);
      state.cooldown = true;
      var t = setTimeout(function () {
        state.cooldown = false;
        scheduleSequence(playerIdx, WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS));
      }, 500);
      state.sequenceTimers.push(t);
    } else if (state.phase === 'showing' || state.phase === 'wait') {
      // 오답
      updateScore(playerIdx, -1);
      sounds.play('miss');
      setDisplay(playerIdx, '-1', 'is-miss');
      clearZoneTimers(playerIdx);
      state.cooldown = true;
      var t = setTimeout(function () {
        state.cooldown = false;
        scheduleSequence(playerIdx, WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS));
      }, 500);
      state.sequenceTimers.push(t);
    }
  }

  // ===== 게임 시작 =====
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

    // Stagger initial sequences per zone (다른 타이밍에 시작해서 동기화 방지)
    for (var p = 0; p < playerCount; p++) {
      (function (idx) {
        var delay = 400 + idx * 300 + Math.random() * 500;
        scheduleSequence(idx, delay);
      })(p);
    }
  }

  // ===== 게임 종료 =====
  function endGame() {
    gameRunning = false;
    for (var i = 0; i < zoneStates.length; i++) clearZoneTimers(i);
    allTimers.forEach(clearTimeout);
    allTimers = [];
    sounds.play('fanfare');
    showResult();
  }

  function cleanupGame() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    gameRunning = false;
    for (var i = 0; i < zoneStates.length; i++) clearZoneTimers(i);
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

    document.getElementById('resultWinnerLabel').textContent = isTie ? '동점!' : '승자';
    var winnerNameEl = document.getElementById('resultWinnerName');
    winnerNameEl.textContent = isTie ? '무승부' : PLAYER_NAMES[winnerIdx];
    winnerNameEl.style.color = isTie ? '#888' : PLAYER_COLORS[winnerIdx];

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
