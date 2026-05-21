/* games/turn-count/game.js */

(function () {
  'use strict';

  // ─── 게임 설정 ─────────────────────────────────────────────────────────
  var TOTAL_ROUNDS = 5;
  var MAX_NUMBER   = 10; // 각 라운드 1~10 카운트
  var ODD_NUMS     = [1, 3, 5, 7, 9];
  var EVEN_NUMS    = [2, 4, 6, 8, 10];

  // ─── 타이머 관리 ─────────────────────────────────────────────────────────
  var timers = [];

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAllTimers() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
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
    pick: function (ctx) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    },
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
    clear: function (ctx) {
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
  var currentRound;  // 0..TOTAL_ROUNDS-1
  var score;         // ★ 누적 (라운드별 실수 없으면 +1)
  var nextNumber;    // 다음 눌러야 할 숫자 (1..MAX_NUMBER)
  var roundMistakes; // 이번 라운드 실수 횟수
  var locked;        // 라운드 종료 후 잠금

  // ─── DOM ─────────────────────────────────────────────────────────────────
  var p1Grid       = document.getElementById('p1Cards');
  var p2Grid       = document.getElementById('p2Cards');
  var p1Board      = document.getElementById('p1Board');
  var p2Board      = document.getElementById('p2Board');
  var nextPill     = document.getElementById('nextPill');
  var nextWho      = document.getElementById('nextWho');
  var nextNum      = document.getElementById('nextNum');
  var progressText = document.getElementById('progressText');
  var roundNumEl   = document.getElementById('roundNum');
  var roundScoreEl = document.getElementById('roundScore');
  var bannerEl     = document.getElementById('banner');
  var resultTitle  = document.getElementById('resultTitle');
  var resultSub    = document.getElementById('resultSub');
  var resultIconWrap = document.getElementById('resultIconWrap');

  // ─── 셔플 ────────────────────────────────────────────────────────────────
  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ─── 카드 생성 ───────────────────────────────────────────────────────────
  function buildCards(grid, nums) {
    grid.innerHTML = '';
    nums.forEach(function (n) {
      var btn = document.createElement('button');
      btn.className = 'num-card';
      btn.type = 'button';
      btn.textContent = n;
      btn.setAttribute('data-val', n);
      onTap(btn, function () {
        if (locked) return;
        handleCardPick(n, btn);
      });
      grid.appendChild(btn);
    });
  }

  // ─── 카드 선택 처리 ──────────────────────────────────────────────────────
  function handleCardPick(val, btn) {
    if (btn.classList.contains('done')) return;

    var expectedPlayer = (nextNumber % 2 === 1) ? 1 : 2;
    var pickedPlayer   = (val % 2 === 1) ? 1 : 2;

    // 잘못된 플레이어 영역의 카드는 board.inactive 로 막혀있지만 안전장치
    if (pickedPlayer !== expectedPlayer) return;

    if (val === nextNumber) {
      // 정답
      sounds.play('pick');
      btn.classList.add('done');
      btn.disabled = true;
      nextNumber++;

      if (nextNumber > MAX_NUMBER) {
        // 라운드 클리어
        locked = true;
        sounds.play('clear');
        if (roundMistakes === 0) {
          score++;
          updateScoreUI();
          showBanner('완벽! ★ +1', 'ok');
        } else {
          showBanner('클리어! (실수 ' + roundMistakes + '회)', 'ok');
        }
        updateTurnUI();
        later(function () {
          currentRound++;
          if (currentRound >= TOTAL_ROUNDS) {
            showResult();
          } else {
            nextRound();
          }
        }, 1400);
      } else {
        updateTurnUI();
      }
    } else {
      // 오답 (자기 차례에 잘못된 숫자 누름)
      sounds.play('wrong');
      btn.classList.add('wrong');
      roundMistakes++;
      later(function () { btn.classList.remove('wrong'); }, 380);
      showBanner('순서가 달라요! (다음: ' + nextNumber + ')', 'ng');
      later(hideBanner, 1200);
    }
  }

  // ─── 차례 UI 갱신 ────────────────────────────────────────────────────────
  function updateTurnUI() {
    if (nextNumber > MAX_NUMBER) {
      progressText.textContent = MAX_NUMBER + ' / ' + MAX_NUMBER;
      nextNum.textContent = '✓';
      nextWho.textContent = '완료';
      nextPill.classList.remove('p1-turn', 'p2-turn');
      p1Board.classList.remove('active', 'inactive');
      p2Board.classList.remove('active', 'inactive');
      return;
    }

    progressText.textContent = (nextNumber - 1) + ' / ' + MAX_NUMBER;
    nextNum.textContent = nextNumber;

    var isP1 = (nextNumber % 2 === 1);
    if (isP1) {
      nextWho.textContent = 'P1';
      nextPill.classList.add('p1-turn');
      nextPill.classList.remove('p2-turn');
      p1Board.classList.add('active');
      p1Board.classList.remove('inactive');
      p2Board.classList.add('inactive');
      p2Board.classList.remove('active');
    } else {
      nextWho.textContent = 'P2';
      nextPill.classList.add('p2-turn');
      nextPill.classList.remove('p1-turn');
      p2Board.classList.add('active');
      p2Board.classList.remove('inactive');
      p1Board.classList.add('inactive');
      p1Board.classList.remove('active');
    }
  }

  // ─── 다음 라운드 ─────────────────────────────────────────────────────────
  function nextRound() {
    locked = false;
    nextNumber = 1;
    roundMistakes = 0;
    hideBanner();

    buildCards(p1Grid, shuffleArr(ODD_NUMS));
    buildCards(p2Grid, shuffleArr(EVEN_NUMS));

    updateRoundUI();
    updateTurnUI();
  }

  // ─── UI 업데이트 ─────────────────────────────────────────────────────────
  function updateRoundUI() {
    roundNumEl.textContent = (currentRound + 1) + '/' + TOTAL_ROUNDS;
  }
  function updateScoreUI() {
    roundScoreEl.textContent = '★ ' + score;
  }
  function showBanner(text, cls) {
    bannerEl.textContent = text;
    bannerEl.className = 'banner show ' + cls;
  }
  function hideBanner() {
    bannerEl.classList.remove('show', 'ok', 'ng');
    bannerEl.textContent = '';
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

  var SVG_HAND =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#FFE082" stroke="#2C2C2C" stroke-width="3"/>' +
      '<text x="40" y="52" text-anchor="middle" font-size="32">🤝</text>' +
    '</svg>';

  var SVG_OK =
    '<svg viewBox="0 0 80 80" width="80" height="80">' +
      '<circle cx="40" cy="40" r="32" fill="#C8E6C9" stroke="#2C2C2C" stroke-width="3"/>' +
      '<polyline points="24,42 36,54 58,30" fill="none" stroke="#1B5E20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function showResult() {
    var title, sub, icon;
    if (score === TOTAL_ROUNDS) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '완벽한 호흡! 한 번도 안 틀렸어요 👏';
      icon = SVG_TROPHY;
    } else if (score >= 3) {
      title = score + '/' + TOTAL_ROUNDS;
      sub = '훌륭한 팀워크예요!';
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
