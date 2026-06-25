/* games/bomb-dodge/game.js */
(function () {
  'use strict';

  var GAME_DURATION = 30;
  var ITEM_DISPLAY_MIN = 1500;  // ms item stays visible
  var ITEM_DISPLAY_MAX = 2000;
  var SPAWN_INTERVAL_MIN = 600; // ms between spawns per zone
  var SPAWN_INTERVAL_MAX = 1000;
  var MAX_ITEMS_PER_ZONE = 3;
  var STAR_RATIO = 0.70; // 70% stars, 30% bombs
  var ITEM_SIZE = 60;    // px

  var PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];
  var PLAYER_COLORS = ['#1565C0', '#C62828', '#2E7D32', '#E65100'];

  var STAR_SVG = '<svg viewBox="0 0 50 50" width="50" height="50">'
    + '<polygon points="25,4 31,18 46,20 35,30 38,45 25,38 12,45 15,30 4,20 19,18"'
    + ' fill="#FFD54F" stroke="#FFA000" stroke-width="2" stroke-linejoin="round"/>'
    + '<polygon points="25,10 28,19 38,20 31,27 33,37 25,32 17,37 19,27 12,20 22,19"'
    + ' fill="#FFECB3" opacity="0.5"/>'
    + '</svg>';

  var BOMB_SVG = '<svg viewBox="0 0 50 55" width="50" height="55">'
    + '<circle cx="25" cy="30" r="18" fill="#424242" stroke="#212121" stroke-width="2"/>'
    + '<circle cx="18" cy="24" r="5" fill="rgba(255,255,255,0.15)"/>'
    + '<path d="M25 12 Q30 6 35 8" fill="none" stroke="#795548" stroke-width="3" stroke-linecap="round"/>'
    + '<circle cx="36" cy="7" r="4" fill="#FF6F00"/>'
    + '<circle cx="36" cy="7" r="2" fill="#FFEB3B"/>'
    + '</svg>';

  // Star burst SVG for tap effect
  var STAR_BURST_SVG = '<svg viewBox="0 0 80 80" width="80" height="80">'
    + '<polygon points="40,5 47,30 72,30 52,47 60,72 40,56 20,72 28,47 8,30 33,30"'
    + ' fill="#FFD54F" opacity="0.85"/>'
    + '</svg>';

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
    'star-collect': function (ctx) {
      // bright chime: ascending two tones
      [880, 1320].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    },
    'bomb-hit': function (ctx) {
      // explosion thud: low rumble + noise-like
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);

      // high crack layer
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(300, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.12);
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
  var zoneCanvases = [];   // HTMLElement per player (the free-layout canvas)
  var allTimers = [];
  var gameTimer = null;
  var timerRemaining = GAME_DURATION;

  var timerFill = document.getElementById('timerFill');
  var timerText = document.getElementById('timerText');
  var hudScoresEl = document.getElementById('hudScores');

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

      // header: label + score
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

      // free canvas for item placement
      var canvas = document.createElement('div');
      canvas.className = 'zone-canvas';
      canvas.id = 'zoneCanvas' + p;
      zone.appendChild(canvas);

      zonesEl.appendChild(zone);
      zoneCanvases.push(canvas);
      playerScores.push(0);

      // HUD chip
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

    var zoneScoreEl = document.getElementById('zoneScore' + playerIdx);
    if (zoneScoreEl) zoneScoreEl.textContent = val;

    var chip = document.getElementById('hudChip' + playerIdx);
    if (chip) chip.textContent = PLAYER_NAMES[playerIdx] + ' ' + val;
  }

  // ===== 아이템 배치 로직 =====
  function countActiveItems(canvas) {
    return canvas.querySelectorAll('.item:not(.disappearing)').length;
  }

  function spawnItem(playerIdx) {
    if (!gameRunning) return;

    var canvas = zoneCanvases[playerIdx];
    if (!canvas) return;

    if (countActiveItems(canvas) < MAX_ITEMS_PER_ZONE) {
      var isStar = Math.random() < STAR_RATIO;

      // random position (keep within bounds, accounting for item size)
      var canvasW = canvas.offsetWidth || 120;
      var canvasH = canvas.offsetHeight || 120;
      var margin = 10;
      var maxX = Math.max(margin, canvasW - ITEM_SIZE - margin);
      var maxY = Math.max(margin, canvasH - ITEM_SIZE - margin);
      var x = margin + Math.random() * maxX;
      var y = margin + Math.random() * maxY;

      var item = document.createElement('div');
      item.className = 'item ' + (isStar ? 'item-star' : 'item-bomb');
      item.style.left = x + 'px';
      item.style.top = y + 'px';
      item.innerHTML = isStar ? STAR_SVG : BOMB_SVG;
      item.dataset.type = isStar ? 'star' : 'bomb';

      canvas.appendChild(item);

      // tap handler
      (function (itemEl, pIdx, type) {
        onTap(itemEl, function (e) {
          if (!gameRunning) return;
          if (itemEl.classList.contains('disappearing')) return;

          // remove the auto-disappear timer by marking tapped
          itemEl.dataset.tapped = '1';
          removeItem(itemEl, canvas);

          if (type === 'star') {
            sounds.play('star-collect');
            addScore(pIdx, 1);
            showStarBurst(itemEl, canvas);
          } else {
            sounds.play('bomb-hit');
            addScore(pIdx, -1);
            showZoneFlash(canvas);
          }
        });
      })(item, playerIdx, isStar ? 'star' : 'bomb');

      // auto-disappear after display time
      var displayTime = ITEM_DISPLAY_MIN + Math.random() * (ITEM_DISPLAY_MAX - ITEM_DISPLAY_MIN);
      var disappearTimer = setTimeout(function () {
        if (!item.dataset.tapped) {
          removeItem(item, canvas);
        }
      }, displayTime);
      allTimers.push(disappearTimer);
    }

    // schedule next spawn
    var delay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    var nextTimer = setTimeout(function () { spawnItem(playerIdx); }, delay);
    allTimers.push(nextTimer);
  }

  function removeItem(itemEl, canvas) {
    if (!itemEl.parentNode) return;
    itemEl.classList.add('disappearing');
    var t = setTimeout(function () {
      if (itemEl.parentNode) itemEl.parentNode.removeChild(itemEl);
    }, 260);
    allTimers.push(t);
  }

  function showStarBurst(itemEl, canvas) {
    var burst = document.createElement('div');
    burst.className = 'star-burst';
    burst.innerHTML = STAR_BURST_SVG;
    // position at item center
    var x = parseFloat(itemEl.style.left) + ITEM_SIZE / 2;
    var y = parseFloat(itemEl.style.top) + ITEM_SIZE / 2;
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    canvas.appendChild(burst);
    var t = setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 420);
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

    // stagger zone spawn starts slightly
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

    // clear all items from canvases
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
  var scoreResult = reportGameResult({ gameId: 'bomb-dodge', playerCount: playerCount, scores: playerScores.slice(), metric: 'score' });
  (function () {
    var badge = document.getElementById('bestRecordBadge');
    if (!badge) return;
    if (scoreResult.isNewBest) {
      badge.style.display = '';
      badge.textContent = '\uD83C\uDFC6 \uC774 \uAE30\uAE30 \uC2E0\uAE30\uB85D! ' + scoreResult.bestEntry.score + '\uC810';
      createInitialsPrompt(function () {}).open();
    } else if (scoreResult.bestEntry) {
      badge.style.display = '';
      badge.textContent = '\uC774 \uAE30\uAE30 \uCD5C\uACE0 \uAE30\uB85D: ' + scoreResult.bestEntry.score + '\uC810';
    }
  })();

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
