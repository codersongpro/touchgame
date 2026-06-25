/* shared/score-store.js */

var SCORE_STORE_KEY = 'touchgame-scores';
var SCORE_STORE_VERSION = 1;
var MAX_ENTRIES_PER_GAME = 10;

function _scoreStoreDefault() {
  return { version: SCORE_STORE_VERSION, deviceLastInitials: '', games: {} };
}

function _scoreStoreRead() {
  try {
    var raw = localStorage.getItem(SCORE_STORE_KEY);
    if (!raw) return _scoreStoreDefault();
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCORE_STORE_VERSION || typeof parsed.games !== 'object') {
      return _scoreStoreDefault();
    }
    return parsed;
  } catch (e) {
    return _scoreStoreDefault();
  }
}

function _scoreStoreWrite(store) {
  localStorage.setItem(SCORE_STORE_KEY, JSON.stringify(store));
}

function _isBetter(metric, a, b) {
  if (metric === 'time') return a < b;
  return a > b; // 'score' and 'win'
}

/**
 * 게임 결과 1회를 기기 로컬에 기록.
 * @param {Object} payload
 * @param {string} payload.gameId
 * @param {number} payload.playerCount
 * @param {number[]} payload.scores
 * @param {'score'|'time'|'win'} [payload.metric='score']
 * @returns {{ isNewBest: boolean, bestEntry: object|null, rank: number|null }}
 */
function reportGameResult(payload) {
  var gameId = payload.gameId;
  var playerCount = payload.playerCount;
  var scores = payload.scores;
  var metric = payload.metric || 'score';

  var bestScore = scores[0];
  for (var i = 1; i < scores.length; i++) {
    if (_isBetter(metric, scores[i], bestScore)) bestScore = scores[i];
  }

  var store = _scoreStoreRead();
  if (!store.games[gameId]) {
    store.games[gameId] = { metric: metric, totalPlays: 0, lastPlayedTs: 0, entries: [] };
  }
  var game = store.games[gameId];
  game.metric = metric;
  game.totalPlays += 1;
  game.lastPlayedTs = Date.now();

  var entry = {
    initials: store.deviceLastInitials || '',
    score: bestScore,
    playerCount: playerCount,
    ts: Date.now()
  };

  var prevBest = game.entries.length ? game.entries[0].score : null;
  game.entries.push(entry);
  game.entries.sort(function (a, b) {
    if (_isBetter(metric, a.score, b.score)) return -1;
    if (_isBetter(metric, b.score, a.score)) return 1;
    return 0;
  });
  game.entries = game.entries.slice(0, MAX_ENTRIES_PER_GAME);

  var rank = game.entries.indexOf(entry);
  var isNewBest = prevBest === null || _isBetter(metric, bestScore, prevBest);

  _scoreStoreWrite(store);

  return {
    isNewBest: isNewBest,
    bestEntry: game.entries[0] || null,
    rank: rank === -1 ? null : rank + 1
  };
}

function setLastInitials(initials) {
  var store = _scoreStoreRead();
  store.deviceLastInitials = String(initials || '').slice(0, 3);
  _scoreStoreWrite(store);
}

function getLastInitials() {
  return _scoreStoreRead().deviceLastInitials || '';
}

function getLeaderboard(gameId, limit) {
  limit = limit || 5;
  var store = _scoreStoreRead();
  var game = store.games[gameId];
  if (!game) return [];
  return game.entries.slice(0, limit);
}

function getAllGameSummaries() {
  var store = _scoreStoreRead();
  return Object.keys(store.games).map(function (gameId) {
    var game = store.games[gameId];
    return {
      gameId: gameId,
      best: game.entries.length ? game.entries[0].score : null,
      plays: game.totalPlays,
      lastPlayedTs: game.lastPlayedTs
    };
  });
}

/**
 * 아케이드 스타일 3글자 이니셜 입력. reportGameResult()가 isNewBest === true를
 * 반환했을 때만 호출한다.
 * @param {function(string): void} onSubmit
 * @returns {{ open(prefillInitials?: string), close() }}
 */
function createInitialsPrompt(onSubmit) {
  var overlay = null;

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function open(prefillInitials) {
    close();
    overlay = document.createElement('div');
    overlay.className = 'score-initials-overlay';
    overlay.innerHTML =
      '<div class="score-initials-card">' +
      '<p class="score-initials-title">신기록! 이니셜 3자를 입력하세요</p>' +
      '<input class="score-initials-input" maxlength="3" autocomplete="off" />' +
      '<button class="score-initials-submit">확인</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var input = overlay.querySelector('.score-initials-input');
    var submitBtn = overlay.querySelector('.score-initials-submit');
    input.value = prefillInitials || getLastInitials() || '';

    function submit() {
      var value = input.value.trim().slice(0, 3);
      if (!value) return;
      setLastInitials(value);
      close();
      onSubmit(value);
    }

    submitBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    input.focus();
  }

  return { open: open, close: close };
}
