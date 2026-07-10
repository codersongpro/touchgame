/* games/sub-balloon/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 40;

  var PLAYER_NAMES  = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

  // Balloon fill colors (random pick per balloon)
  var BALLOON_COLORS = ['#F44336', '#29B6F6', '#4CAF50', '#FFEE58', '#FF9800', '#9C27B0'];

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
    // Short bubbly pop (correct)
    pop: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    },
    // Harsh buzz (wrong pop)
    wrong: function (ctx) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.32);
    },
    // Soft whoosh for miss
    miss: function (ctx) {
      var bufSize = ctx.sampleRate * 0.2;
      var buf  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }
      var src    = ctx.createBufferSource();
      var filter = ctx.createBiquadFilter();
      var gain   = ctx.createGain();
      src.buffer = buf;
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.5;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + 0.2);
    },
    // Victory fanfare
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
  var playerBtns = document.querySelectorAll('#playerSelect .player-btn');
  playerBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCount = parseInt(btn.dataset.count, 10);
      playerBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // ===== 난이도 선택 =====
  var difficulty = 'easy';
  var diffBtns = document.querySelectorAll('#diffSelect .player-btn');
  diffBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      difficulty = btn.dataset.diff;
      diffBtns.forEach(function (b) { b.classList.remove('active'); });
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
  var zoneFields    = [];   // balloon-field elements per player
  var zoneTargets   = [];   // { dan, b, answer } per player
  var targetLabels  = [];   // target label DOM elements per player
  var allTimers     = [];
  var gameTimer     = null;
  var timerRemaining = GAME_DURATION;

  var timerFill  = document.getElementById('timerFill');
  var timerText  = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ===== 목표 뺄셈식 갱신 =====
  function nextTarget(playerIdx) {
    var a, b;
    if (difficulty === 'easy') {
      a = rand(1, 9);
      b = rand(1, 9);
    } else {
      a = rand(10, 99);
      b = rand(10, 99);
    }
    if (b > a) { var t = a; a = b; b = t; } // ensure a >= b (음수 없음)
    zoneTargets[playerIdx] = { a: a, b: b, answer: a - b };
    var label = targetLabels[playerIdx];
    if (label) label.textContent = a + ' − ' + b + ' = ?';
  }

  // ===== 풍선에 표시할 후보 숫자 생성 =====
  function randCandidateValue(target) {
    var offset = rand(-5, 5);
    var value  = target.answer + offset;
    if (value < 0) value = target.answer + Math.abs(offset);
    return value;
  }

  // ===== SVG 풍선 생성 (숫자 포함) =====
  function makeBalloonSVG(color, value) {
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 50 70');
    svg.setAttribute('width', '50');
    svg.setAttribute('height', '70');

    // Body
    var body = document.createElementNS(ns, 'ellipse');
    body.setAttribute('cx', '25');
    body.setAttribute('cy', '28');
    body.setAttribute('rx', '20');
    body.setAttribute('ry', '24');
    body.setAttribute('fill', color);
    svg.appendChild(body);

    // Highlight
    var hl = document.createElementNS(ns, 'ellipse');
    hl.setAttribute('cx', '18');
    hl.setAttribute('cy', '20');
    hl.setAttribute('rx', '6');
    hl.setAttribute('ry', '8');
    hl.setAttribute('fill', 'rgba(255,255,255,0.35)');
    svg.appendChild(hl);

    // Number label
    var text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '25');
    text.setAttribute('y', '34');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '17');
    text.setAttribute('font-weight', '900');
    text.setAttribute('fill', '#fff');
    text.textContent = String(value);
    svg.appendChild(text);

    // Knot
    var knot = document.createElementNS(ns, 'polygon');
    knot.setAttribute('points', '22,52 25,56 28,52');
    knot.setAttribute('fill', color);
    knot.setAttribute('opacity', '0.85');
    svg.appendChild(knot);

    // String
    var str = document.createElementNS(ns, 'path');
    str.setAttribute('d', 'M25 56 Q22 62 25 68');
    str.setAttribute('fill', 'none');
    str.setAttribute('stroke', '#999');
    str.setAttribute('stroke-width', '1.2');
    svg.appendChild(str);

    return svg;
  }

  // ===== Pop burst particles =====
  function spawnPopBurst(field, x, y, color) {
    var burst = document.createElement('div');
    burst.className = 'pop-burst';
    burst.style.left = x + 'px';
    burst.style.top  = y + 'px';
    field.appendChild(burst);

    var angles = [0, 45, 90, 135, 180, 225, 270, 315];
    angles.forEach(function (angle) {
      var rad = angle * Math.PI / 180;
      var dist = 30 + Math.random() * 20;
      var tx = Math.cos(rad) * dist;
      var ty = Math.sin(rad) * dist;

      var p = document.createElement('div');
      p.className = 'pop-particle';
      p.style.background = color;
      p.style.setProperty('--tx', tx + 'px');
      p.style.setProperty('--ty', ty + 'px');
      p.style.animation = 'particleFly 0.35s ease-out forwards';
      burst.appendChild(p);
    });

    var t = setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 400);
    allTimers.push(t);
  }

  // ===== 존 구성 =====
  function buildZones(count) {
    var zonesEl = document.getElementById('gameZones');
    zonesEl.innerHTML = '';
    zonesEl.className = 'game-zones layout-' + count;

    hudScoresEl.innerHTML = '';
    playerScores  = [];
    zoneFields    = [];
    zoneTargets   = [];
    targetLabels  = [];

    for (var p = 0; p < count; p++) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.dataset.player = p + 1;

      // Label
      var label = document.createElement('div');
      label.className = 'zone-label';
      label.textContent = PLAYER_NAMES[p];
      zone.appendChild(label);

      // Target equation display
      var targetEl = document.createElement('div');
      targetEl.className = 'zone-target';
      targetEl.id = 'zoneTarget' + p;
      zone.appendChild(targetEl);
      targetLabels.push(targetEl);

      // Score display
      var scoreEl = document.createElement('div');
      scoreEl.className = 'zone-score';
      scoreEl.id = 'zoneScore' + p;
      scoreEl.textContent = '0';
      zone.appendChild(scoreEl);

      // Balloon field (floating area)
      var field = document.createElement('div');
      field.className = 'balloon-field';
      zone.appendChild(field);
      zoneFields.push(field);

      zonesEl.appendChild(zone);
      playerScores.push(0);
      zoneTargets.push(null);

      // HUD chip
      var chip = document.createElement('div');
      chip.className = 'hud-score-chip';
      chip.dataset.player = p + 1;
      chip.id = 'hudChip' + p;
      chip.textContent = PLAYER_NAMES[p] + ' 0';
      hudScoresEl.appendChild(chip);

      nextTarget(p);
    }
  }

  function addScore(playerIdx, amount) {
    playerScores[playerIdx] = Math.max(0, playerScores[playerIdx] + amount);
    var val = playerScores[playerIdx];
    var zs = document.getElementById('zoneScore' + playerIdx);
    if (zs) zs.textContent = val;
    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  function flashPenalty(zone) {
    var penalty = document.createElement('div');
    penalty.className = 'penalty-flash';
    penalty.textContent = '-1';
    zone.appendChild(penalty);
    penalty.addEventListener('animationend', function () {
      if (penalty.parentNode) penalty.parentNode.removeChild(penalty);
    });
  }

  // ===== 풍선 부유 속도 (remaining 기반) =====
  function getFloatDuration(remaining) {
    // At 40s remaining: 4.2s | At 0s: 2.2s
    var ratio = remaining / GAME_DURATION;
    return 2200 + ratio * 2000; // ms
  }

  // ===== 풍선 스폰 =====
  function spawnBalloon(playerIdx) {
    if (!gameRunning) return;

    var field = zoneFields[playerIdx];
    var fieldW = field.offsetWidth  || 120;
    var fieldH = field.offsetHeight || 200;

    var target = zoneTargets[playerIdx];
    var value  = randCandidateValue(target);

    var color   = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    var balloon = document.createElement('div');
    balloon.className = 'balloon';

    // Random horizontal position (keep within bounds: 50px wide)
    var maxX = Math.max(0, fieldW - 54);
    var xPos = Math.floor(Math.random() * maxX);
    balloon.style.left = xPos + 'px';
    balloon.style.bottom = '-70px';

    var svg = makeBalloonSVG(color, value);
    balloon.appendChild(svg);
    field.appendChild(balloon);

    // Tap to pop
    var popped = false;
    function handlePop(e) {
      if (!gameRunning || popped) return;
      popped = true;

      e.stopPropagation();

      // Burst particles at balloon center
      var bx = xPos + 25;
      var by = fieldH - parseFloat(balloon.style.bottom || '0') - 35;
      spawnPopBurst(field, bx, by, color);

      // Pop animation
      balloon.classList.add('popping');

      var isCorrect = value === zoneTargets[playerIdx].answer;
      if (isCorrect) {
        sounds.play('pop');
        addScore(playerIdx, 1);
        nextTarget(playerIdx);
      } else {
        sounds.play('wrong');
        addScore(playerIdx, -1);
        flashPenalty(field.parentNode);
      }

      var t = setTimeout(function () {
        if (balloon.parentNode) balloon.parentNode.removeChild(balloon);
      }, 300);
      allTimers.push(t);
    }

    onTap(balloon, handlePop);

    // Animate float upward
    var duration = getFloatDuration(timerRemaining);
    // Force reflow so transition applies
    void balloon.offsetHeight;
    balloon.style.transitionDuration = duration + 'ms';
    balloon.style.bottom = (fieldH + 10) + 'px';

    // If balloon reaches top without being popped, remove it (miss)
    var missTimer = setTimeout(function () {
      if (!popped && balloon.parentNode) {
        popped = true;
        balloon.classList.add('missing');
        sounds.play('miss');
        var removeTimer = setTimeout(function () {
          if (balloon.parentNode) balloon.parentNode.removeChild(balloon);
        }, 420);
        allTimers.push(removeTimer);
      }
    }, duration);
    allTimers.push(missTimer);

    // Schedule next balloon spawn for this zone
    var spawnDelay = 900 + Math.random() * 1000;
    // Slightly faster when time is low
    var ratio = timerRemaining / GAME_DURATION;
    spawnDelay = Math.max(500, spawnDelay * (0.5 + ratio * 0.5));

    var nextT = setTimeout(function () {
      spawnBalloon(playerIdx);
    }, spawnDelay);
    allTimers.push(nextT);
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

    // Stagger initial spawns per zone
    for (var p = 0; p < playerCount; p++) {
      (function (idx) {
        var delay = idx * 200 + Math.random() * 300;
        var t = setTimeout(function () {
          spawnBalloon(idx);
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

    // Remove remaining balloons
    zoneFields.forEach(function (field) {
      field.innerHTML = '';
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
    var scoreResult = reportGameResult({ gameId: 'sub-balloon', playerCount: playerCount, scores: playerScores.slice(), metric: 'score' });
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
        // Inline SVG trophy icon (small)
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
