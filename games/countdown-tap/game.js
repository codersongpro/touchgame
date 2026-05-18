/* games/countdown-tap/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;             // seconds
  var TICK_MS       = 600;            // each digit shows for this long
  var IDLE_MS       = 700;            // pause between sequences
  var WRONG_LOCK_MS = 800;            // cooldown after wrong tap

  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#0288D1', '#E53935', '#388E3C', '#F57C00'];

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
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    },
    zero: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    },
    hit: function (ctx) {
      [523, 784, 1047].forEach(function (f, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        var t = ctx.currentTime + i * 0.06;
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    },
    miss: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    },
    fanfare: function (ctx) {
      [392, 494, 587, 784, 988].forEach(function (freq, i) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        var t = ctx.currentTime + i * 0.11;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
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

  // ===== 인트로 카운트다운 (3-2-1) =====
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
  var zoneStates    = [];   // per-player: { idx, card, numEl, value, phase, lockedUntil, seqTimer }
  var allTimers     = [];
  var gameTimer     = null;
  var timerRemaining = GAME_DURATION;

  var timerFill   = document.getElementById('timerFill');
  var timerText   = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

  // ===== 존 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores = [];
    zoneStates   = [];

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

      var card = document.createElement('div');
      card.className = 'count-card is-idle';

      var num = document.createElement('div');
      num.className = 'count-card-num';
      num.textContent = '–';
      card.appendChild(num);

      zone.appendChild(card);
      zonesEl.appendChild(zone);
      playerScores.push(0);

      // HUD chip
      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);

      var state = {
        idx: p,
        card: card,
        numEl: num,
        value: null,
        phase: 'idle',          // 'idle' | 'counting' | 'zero' | 'locked'
        seqTimer: null,
        lockedUntil: 0
      };
      zoneStates.push(state);

      bindZoneTap(card, state);
    }
  }

  function bindZoneTap(target, state) {
    onTap(target, function () {
      if (!gameRunning) return;
      handleZoneTap(state);
    });
  }

  function setCardState(state, css, num) {
    state.card.classList.remove('is-idle', 'is-zero', 'is-hit', 'is-wrong');
    state.card.classList.add(css);
    if (num !== undefined) state.numEl.textContent = num;
  }

  function spawnFloater(state, sign) {
    var f = document.createElement('div');
    f.className = 'score-flash ' + (sign > 0 ? 'plus' : 'minus');
    f.textContent = sign > 0 ? '+1' : '-1';
    state.card.appendChild(f);
    var t = setTimeout(function () {
      if (f.parentNode) f.parentNode.removeChild(f);
    }, 750);
    allTimers.push(t);
  }

  function addScore(playerIdx, amount) {
    playerScores[playerIdx] = Math.max(0, playerScores[playerIdx] + amount);
    var val = playerScores[playerIdx];
    var zs = document.getElementById('zoneScore' + playerIdx);
    if (zs) zs.textContent = val;
    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 시퀀스 로직 =====
  // 한 시퀀스: 시작 숫자(3/4/5 무작위) → 1씩 줄이며 TICK_MS 동안 표시 → 0 →
  //          0에서 TICK_MS 안에 탭하면 +1, 놓치면 점수 변동 없음, 카운트 중 탭하면 -1.
  function startSequence(state) {
    if (!gameRunning) return;

    var startVal = 3 + Math.floor(Math.random() * 3); // 3, 4, 5
    state.value = startVal;
    state.phase = 'counting';
    setCardState(state, 'is-idle', startVal);
    state.card.classList.remove('is-idle');

    state.seqTimer = setTimeout(function () { tickSequence(state); }, TICK_MS);
    allTimers.push(state.seqTimer);
    sounds.play('tick');
  }

  function tickSequence(state) {
    if (!gameRunning) return;

    if (state.phase === 'counting' && state.value > 0) {
      state.value -= 1;
      state.numEl.textContent = state.value;

      if (state.value === 0) {
        state.phase = 'zero';
        setCardState(state, 'is-zero', 0);
        sounds.play('zero');
        state.seqTimer = setTimeout(function () { missSequence(state); }, TICK_MS);
        allTimers.push(state.seqTimer);
      } else {
        sounds.play('tick');
        state.seqTimer = setTimeout(function () { tickSequence(state); }, TICK_MS);
        allTimers.push(state.seqTimer);
      }
    }
  }

  function missSequence(state) {
    if (!gameRunning) return;
    state.phase = 'idle';
    setCardState(state, 'is-idle', '–');
    state.seqTimer = setTimeout(function () { startSequence(state); }, IDLE_MS);
    allTimers.push(state.seqTimer);
  }

  function handleZoneTap(state) {
    var now = performance.now();

    if (state.phase === 'locked' && now < state.lockedUntil) return;

    if (state.phase === 'zero') {
      if (state.seqTimer) { clearTimeout(state.seqTimer); state.seqTimer = null; }
      state.phase = 'idle';
      setCardState(state, 'is-hit', 0);
      addScore(state.idx, +1);
      spawnFloater(state, +1);
      sounds.play('hit');
      state.seqTimer = setTimeout(function () { startSequence(state); }, IDLE_MS);
      allTimers.push(state.seqTimer);
      return;
    }

    if (state.phase === 'counting') {
      if (state.seqTimer) { clearTimeout(state.seqTimer); state.seqTimer = null; }
      state.phase = 'locked';
      state.lockedUntil = now + WRONG_LOCK_MS;
      setCardState(state, 'is-wrong', state.value);
      addScore(state.idx, -1);
      spawnFloater(state, -1);
      sounds.play('miss');

      state.seqTimer = setTimeout(function () {
        state.phase = 'idle';
        setCardState(state, 'is-idle', '–');
        var t2 = setTimeout(function () { startSequence(state); }, 250);
        allTimers.push(t2);
        state.seqTimer = t2;
      }, WRONG_LOCK_MS);
      allTimers.push(state.seqTimer);
      return;
    }
    // idle/locked 외 탭은 무시
  }

  // ===== 게임 시작 =====
  function startGame() {
    playerCount = selectedCount;
    buildZones(playerCount);

    gameRunning    = true;
    timerRemaining = GAME_DURATION;
    timerFill.style.width = '100%';
    timerText.textContent  = GAME_DURATION;

    showScreen('game');

    gameTimer = createTimer(GAME_DURATION, function (rem) {
      timerRemaining = rem;
      var pct = (rem / GAME_DURATION * 100);
      timerFill.style.width = pct + '%';
      timerText.textContent  = rem;
    }, function () {
      endGame();
    });

    gameTimer.start();

    // 각 zone마다 시작 딜레이를 다르게 (동기화 회피)
    for (var p = 0; p < playerCount; p++) {
      (function (idx) {
        var delay = idx * 180 + Math.random() * 200;
        var t = setTimeout(function () {
          if (gameRunning) startSequence(zoneStates[idx]);
        }, delay);
        allTimers.push(t);
      })(p);
    }
  }

  // ===== 게임 종료 =====
  function endGame() {
    gameRunning = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    zoneStates.forEach(function (s) {
      if (s.seqTimer) { clearTimeout(s.seqTimer); s.seqTimer = null; }
    });
    sounds.play('fanfare');
    showResult();
  }

  function cleanupGame() {
    if (gameTimer) { gameTimer.stop(); gameTimer = null; }
    gameRunning = false;
    allTimers.forEach(clearTimeout);
    allTimers = [];
    zoneStates.forEach(function (s) {
      if (s.seqTimer) { clearTimeout(s.seqTimer); s.seqTimer = null; }
    });
    clearCountdownTimers();
  }

  // ===== 결과 화면 =====
  function showResult() {
    var maxScore = -1;
    var winnerIdx = 0;
    playerScores.forEach(function (s, i) {
      if (s > maxScore) { maxScore = s; winnerIdx = i; }
    });

    var isTie = playerScores.filter(function (s) { return s === maxScore; }).length > 1;

    document.getElementById('resultWinnerLabel').textContent = isTie ? '동점!' : '승자';
    var winnerNameEl = document.getElementById('resultWinnerName');
    winnerNameEl.textContent  = isTie ? '무승부' : PLAYER_NAMES[winnerIdx];
    winnerNameEl.style.color  = isTie ? '#888' : PLAYER_COLORS[winnerIdx];

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
