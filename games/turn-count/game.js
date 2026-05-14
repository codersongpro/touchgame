/* games/turn-count/game.js */

(function () {
  'use strict';

  // ─── 라운드 데이터 (목표 숫자 5라운드) ───────────────────────────────────
  var ROUND_GOALS = [10, 15, 20, 25, 30];
  var TOTAL_ROUNDS = ROUND_GOALS.length;
  var ROUND_TIME = 25; // seconds per round

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
  }

  // ─── 화면 전환 ────────────────────────────────────────────────────────────
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

  var countdownInterval = null;
  function startCountdown(onDone) {
    var countdownNumber = document.getElementById('countdownNumber');
    showScreen('countdown');
    var count = 3;
    countdownNumber.textContent = count;
    countdownInterval = setInterval(function() {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        onDone();
      } else {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
        countdownNumber.offsetHeight;
        countdownNumber.style.animation = '';
      }
    }, 1000);
  }

  // ─── 사운드 ──────────────────────────────────────────────────────────────
  var sounds = createSoundManager({
    // P1 탭 (홀수, 높은 톤)
    tapP1: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    },
    // P2 탭 (짝수, 낮은 톤)
    tapP2: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(587, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    },
    // 잘못된 차례에 누름
    wrong: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.34);
    },
    // 라운드 성공
    success: function (ctx) {
      [659, 784, 988, 1175].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    },
    // 라운드 실패 (시간초과)
    timeup: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    },
    // 최종 승리 팡파레
    win: function (ctx) {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.42);
      });
    },
    // 1초 카운트다운 틱 (시간 임박)
    tick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  });

  // ─── 사운드 버튼 ──────────────────────────────────────────────────────────
  var soundIconIds = ['soundIconIntro', 'soundIconGame'];
  var SVG_SOUND_ON  = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  var SVG_SOUND_OFF = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';

  function updateSoundIcons() {
    var muted = sounds.isMuted();
    soundIconIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
    });
  }
  [
    document.getElementById('soundToggleIntro'),
    document.getElementById('soundToggleGame')
  ].forEach(function (btn) {
    if (!btn) return;
    onTap(btn, function () {
      sounds.toggleMute();
      updateSoundIcons();
    });
  });
  updateSoundIcons();

  // ─── 게임 상태 ────────────────────────────────────────────────────────────
  var currentRound;     // 0..4
  var currentCount;     // 현재까지 카운트한 숫자 (0..goal)
  var nextNumber;       // 다음에 누를 숫자 (currentCount + 1)
  var nextPlayer;       // 0 (P1, 홀수) or 1 (P2, 짝수)
  var goal;             // 이번 라운드 목표
  var score;            // 성공한 라운드 수
  var locked;           // 라운드 전환 중 잠금
  var timeLeft;
  var roundTimer = null;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var countNowEl   = document.getElementById('countNow');
  var goalValEl    = document.getElementById('goalVal');
  var timerValEl   = document.getElementById('timerVal');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var board1El     = document.getElementById('board1');
  var board2El     = document.getElementById('board2');
  var tapP1Btn     = document.getElementById('tapP1');
  var tapP2Btn     = document.getElementById('tapP2');
  var tapP1NumEl   = document.getElementById('tapP1Num');
  var tapP2NumEl   = document.getElementById('tapP2Num');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 활성 보드/버튼 갱신 ─────────────────────────────────────────────────
  function updateActiveBoard() {
    // 다음 번호의 홀짝으로 활성 플레이어 결정
    nextPlayer = (nextNumber % 2 === 1) ? 0 : 1;

    board1El.classList.toggle('active', nextPlayer === 0);
    board2El.classList.toggle('active', nextPlayer === 1);

    // P1은 다음 홀수, P2는 다음 짝수 표시
    var nextOdd  = (nextNumber % 2 === 1) ? nextNumber : (nextNumber + 1);
    var nextEven = (nextNumber % 2 === 0) ? nextNumber : (nextNumber + 1);
    if (nextOdd > goal)  nextOdd = '✓';
    if (nextEven > goal) nextEven = '✓';
    tapP1NumEl.textContent = nextOdd;
    tapP2NumEl.textContent = nextEven;

    tapP1Btn.disabled = (nextPlayer !== 0) || locked;
    tapP2Btn.disabled = (nextPlayer !== 1) || locked;
  }

  // ─── 카운트 UI ──────────────────────────────────────────────────────────
  function updateCountUI(bump) {
    countNowEl.textContent = currentCount;
    if (bump) {
      countNowEl.classList.remove('bump');
      void countNowEl.offsetWidth;
      countNowEl.classList.add('bump');
    }
  }

  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
  }
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateTimerUI() {
    timerValEl.textContent = timeLeft;
    timerValEl.classList.toggle('danger', timeLeft <= 5);
  }

  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }
  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng');
    bannerEl.textContent = '';
  }

  // ─── 라운드 타이머 ───────────────────────────────────────────────────────
  function startRoundTimer() {
    timeLeft = ROUND_TIME;
    updateTimerUI();
    if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
    roundTimer = setInterval(function () {
      timeLeft--;
      updateTimerUI();
      if (timeLeft <= 5 && timeLeft > 0) sounds.play('tick');
      if (timeLeft <= 0) {
        clearInterval(roundTimer);
        roundTimer = null;
        onTimeUp();
      }
    }, 1000);
  }

  function stopRoundTimer() {
    if (roundTimer) { clearInterval(roundTimer); roundTimer = null; }
  }

  // ─── 탭 처리 ────────────────────────────────────────────────────────────
  function handleTap(player) {
    if (locked) return;
    if (player !== nextPlayer) {
      sounds.play('wrong');
      var boardEl = player === 0 ? board1El : board2El;
      boardEl.classList.remove('shake');
      void boardEl.offsetWidth;
      boardEl.classList.add('shake');
      return;
    }

    sounds.play(player === 0 ? 'tapP1' : 'tapP2');

    currentCount = nextNumber;
    updateCountUI(true);

    if (currentCount >= goal) {
      locked = true;
      stopRoundTimer();
      tapP1Btn.disabled = true;
      tapP2Btn.disabled = true;
      score++;
      updateScoreUI();
      showBanner('🎉 목표 ' + goal + ' 도달!', 'ok');
      sounds.play('success');
      later(function () {
        currentRound++;
        if (currentRound >= TOTAL_ROUNDS) {
          showResult();
        } else {
          nextRound();
        }
      }, 1400);
      return;
    }

    nextNumber = currentCount + 1;
    updateActiveBoard();
  }

  function onTimeUp() {
    if (locked) return;
    locked = true;
    tapP1Btn.disabled = true;
    tapP2Btn.disabled = true;
    showBanner('시간 초과! ' + currentCount + '/' + goal, 'ng');
    sounds.play('timeup');
    later(function () {
      currentRound++;
      if (currentRound >= TOTAL_ROUNDS) {
        showResult();
      } else {
        nextRound();
      }
    }, 1500);
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    hideBanner();
    goal = ROUND_GOALS[currentRound];
    goalValEl.textContent = goal;
    currentCount = 0;
    nextNumber = 1;
    updateCountUI(false);
    updateRoundUI();
    updateActiveBoard();
    startRoundTimer();
  }

  // ─── 게임 초기화 ─────────────────────────────────────────────────────────
  function initGame() {
    clearAllTimers();
    currentRound = 0;
    score = 0;
    locked = false;
    updateScoreUI();
    nextRound();
    showScreen('game');
  }

  // ─── 결과 화면 ───────────────────────────────────────────────────────────
  var SVG_TROPHY =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<rect x="28" y="62" width="24" height="6" rx="3" fill="#FFA726"/>' +
      '<rect x="22" y="68" width="36" height="6" rx="3" fill="#FFA726"/>' +
      '<path d="M15 18 Q15 50 40 54 Q65 50 65 18 Z" fill="#FFD54F" stroke="#FFA726" stroke-width="2"/>' +
      '<path d="M15 18 Q8 18 8 28 Q8 40 20 42 Q15 35 15 26 Z" fill="#FFA726"/>' +
      '<path d="M65 18 Q72 18 72 28 Q72 40 60 42 Q65 35 65 26 Z" fill="#FFA726"/>' +
      '<ellipse cx="40" cy="20" rx="22" ry="6" fill="#FFE082"/>' +
      '<text x="40" y="42" text-anchor="middle" font-size="16" font-weight="900" fill="#E65100">WIN</text>' +
    '</svg>';

  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var SVG_HAND =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';

  function showResult() {
    stopRoundTimer();
    var title, sub, icon;
    if (score === TOTAL_ROUNDS) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '완벽한 호흡이에요! 👏';
      icon = SVG_TROPHY;
    } else if (score >= 3) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '훌륭한 팀워크! 다시 도전해봐요';
      icon = SVG_OK;
    } else {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '조금 더 호흡을 맞춰봐요!';
      icon = SVG_HAND;
    }
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    resultIconWrap.innerHTML = icon;
    sounds.play('win');
    showScreen('result');
  }

  // ─── 버튼 이벤트 ─────────────────────────────────────────────────────────
  onTap(tapP1Btn, function () {
    if (tapP1Btn.disabled) return;
    handleTap(0);
  });
  onTap(tapP2Btn, function () {
    if (tapP2Btn.disabled) return;
    handleTap(1);
  });

  onTap(document.getElementById('playBtn'), function () {
    startCountdown(function() { initGame(); });
  });
  onTap(document.getElementById('retryBtn'), function () {
    startCountdown(function() { initGame(); });
  });
  onTap(document.getElementById('homeBtn'), function () {
    clearAllTimers();
    goHome();
  });
  onTap(document.getElementById('backBtn'), function () {
    clearAllTimers();
    goHome();
  });
  onTap(document.getElementById('closeBtn'), function () {
    clearAllTimers();
    showScreen('intro');
  });

})();
