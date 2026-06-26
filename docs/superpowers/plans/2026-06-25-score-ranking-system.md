# Score & Ranking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every game in TouchGame a device-local high-score record (localStorage), with an arcade-style 3-letter-initials prompt on new records, a "best record" badge on each game's result screen, and a launcher-level "전체 랭킹" panel.

**Architecture:** One new shared module (`shared/score-store.js`) exposes `reportGameResult(payload)`. Each game calls it once, inside its existing result-render function, passing whatever per-player numbers it already has. Storage is a single `localStorage` key holding a JSON object keyed by game folder name, capped at 10 entries per game. No build step, no dependencies — plain global functions matching the existing `shared/engine.js` style.

**Tech Stack:** Vanilla JS (no modules, no bundler). Tests use Node's built-in `node:test` + `node:assert/strict` (Node 18+, already verified present as v22.18.0 — no npm install needed).

---

## Before you start — ground truth this plan relies on

- `games/registry.json` lists exactly 60 games. Of their `game.js` files:
  - **47 games** compute a `scores` array + a `playerCount` variable, and render results inside `function showResult() {`. Reference: `games/flag-quiz/game.js`.
  - **3 games** (`balloon-pop`, `bomb-dodge`, `chase-tap`) use `playerScores` instead of `scores`, same `function showResult() {` shape.
  - **10 games** (`color-mix`, `color-signal`, `direction-relay`, `jamo-merge`, `memory-relay`, `nim-game`, `number-tap`, `secret-code`, `sum-relay`, `word-chain`) don't match either convention and need individual handling.
- `sw.js` cache-first-serves everything under `/games/*` and `/shared/*`. Editing any already-deployed file in those folders requires bumping `CACHE_NAME` (currently `'touchgame-v16'`).
- `scripts/verify-game.js` runs exactly 20 numbered checks per game folder (confirmed by counting `check(...)` calls in the file). The daily auto-add automation (`docs/AUTO_MODE.md`) gates on this script passing.
- The launcher (`index.html`) loads each game's metadata via `fetch('games/' + folder + '/game.json')` inside `async function loadGames()` (around line 1002), stores the result in a local `validGames` array, then calls `renderCards(validGames)`. There is currently no module-level variable holding that list after `loadGames()` returns — Task 9 adds one.

---

### Task 1: Core storage module (`shared/score-store.js`)

**Files:**
- Create: `shared/score-store.js`
- Create: `scripts/score-store-test-helpers.js`
- Create: `scripts/score-store.test.js`

- [ ] **Step 1: Write the test helpers (no test logic yet)**

`shared/score-store.js` will be a plain script with top-level `function` declarations (same style as `shared/engine.js` — no `module.exports`, no `window.` prefixing). To unit-test it under Node, load it into a `vm` context with a fake `localStorage`.

Create `scripts/score-store-test-helpers.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadScoreStore(fakeStorage) {
  const code = fs.readFileSync(
    path.join(__dirname, '..', 'shared', 'score-store.js'),
    'utf8'
  );
  const sandbox = { localStorage: fakeStorage, Date: Date };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'score-store.js' });
  return sandbox;
}

function makeFakeStorage() {
  const data = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    }
  };
}

module.exports = { loadScoreStore, makeFakeStorage };
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/score-store.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScoreStore, makeFakeStorage } = require('./score-store-test-helpers.js');

test('reportGameResult records the first play as a new best', () => {
  const sandbox = loadScoreStore(makeFakeStorage());
  const result = sandbox.reportGameResult({
    gameId: 'flag-quiz',
    playerCount: 2,
    scores: [3, 5],
    metric: 'score'
  });
  assert.equal(result.isNewBest, true);
  assert.equal(result.rank, 1);
  assert.equal(result.bestEntry.score, 5);
});

test('a lower score afterwards is not a new best, but is still recorded', () => {
  const sandbox = loadScoreStore(makeFakeStorage());
  sandbox.reportGameResult({ gameId: 'flag-quiz', playerCount: 2, scores: [3, 5], metric: 'score' });
  const second = sandbox.reportGameResult({ gameId: 'flag-quiz', playerCount: 2, scores: [1, 2], metric: 'score' });
  assert.equal(second.isNewBest, false);
  assert.equal(second.bestEntry.score, 5);
  assert.equal(sandbox.getLeaderboard('flag-quiz').length, 2);
});

test('"time" metric treats a lower number as better', () => {
  const sandbox = loadScoreStore(makeFakeStorage());
  sandbox.reportGameResult({ gameId: 'slide-puzzle', playerCount: 2, scores: [42, 30], metric: 'time' });
  const second = sandbox.reportGameResult({ gameId: 'slide-puzzle', playerCount: 2, scores: [50, 60], metric: 'time' });
  assert.equal(second.isNewBest, false);
  assert.equal(second.bestEntry.score, 30);
});

test('getLeaderboard caps at 10 entries and keeps the best ones', () => {
  const sandbox = loadScoreStore(makeFakeStorage());
  for (let i = 1; i <= 12; i++) {
    sandbox.reportGameResult({ gameId: 'flag-quiz', playerCount: 2, scores: [i], metric: 'score' });
  }
  const board = sandbox.getLeaderboard('flag-quiz', 10);
  assert.equal(board.length, 10);
  assert.equal(board[0].score, 12);
  assert.equal(board[9].score, 3);
});

test('getAllGameSummaries reports best score and play count per game', () => {
  const sandbox = loadScoreStore(makeFakeStorage());
  sandbox.reportGameResult({ gameId: 'flag-quiz', playerCount: 2, scores: [9] });
  sandbox.reportGameResult({ gameId: 'flag-quiz', playerCount: 2, scores: [4] });
  sandbox.reportGameResult({ gameId: 'nim-game', playerCount: 2, scores: [1, 0], metric: 'win' });
  const summaries = sandbox.getAllGameSummaries();
  const flagQuiz = summaries.find((s) => s.gameId === 'flag-quiz');
  assert.equal(flagQuiz.best, 9);
  assert.equal(flagQuiz.plays, 2);
  const nim = summaries.find((s) => s.gameId === 'nim-game');
  assert.equal(nim.best, 1);
});

test('setLastInitials / getLastInitials persist and truncate to 3 characters', () => {
  const sandbox = loadScoreStore(makeFakeStorage());
  sandbox.setLastInitials('지민abcd');
  assert.equal(sandbox.getLastInitials(), '지민a');
});

test('a corrupted stored value resets to defaults instead of throwing', () => {
  const storage = makeFakeStorage();
  storage.setItem('touchgame-scores', 'not json');
  const sandbox = loadScoreStore(storage);
  assert.doesNotThrow(() => {
    sandbox.reportGameResult({ gameId: 'flag-quiz', playerCount: 2, scores: [5] });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test scripts/score-store.test.js`
Expected: every test fails with `Cannot read properties of undefined (reading 'reportGameResult')` or similar — `shared/score-store.js` doesn't exist yet.

- [ ] **Step 4: Write `shared/score-store.js`**

```js
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
 * Records one completed game session for this device.
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/score-store.test.js`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add shared/score-store.js scripts/score-store-test-helpers.js scripts/score-store.test.js
git commit -m "Add shared/score-store.js — localStorage-backed score/ranking core"
```

---

### Task 2: New-record initials prompt + CSS

**Files:**
- Modify: `shared/score-store.js`
- Modify: `shared/style.css`

- [ ] **Step 1: Add `createInitialsPrompt` to `shared/score-store.js`**

Append to the end of `shared/score-store.js`:

```js
/**
 * Arcade-style 3-character initials capture. Call only when reportGameResult()
 * returned isNewBest === true.
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
```

- [ ] **Step 2: Add CSS**

Append to the end of `shared/style.css`:

```css
/* === Score / ranking (shared/score-store.js) === */
.score-initials-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.score-initials-card {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card-hover);
  padding: var(--space-lg);
  width: min(280px, 86vw);
  text-align: center;
}
.score-initials-title {
  font-weight: 800;
  margin-bottom: var(--space-md);
}
.score-initials-input {
  width: 100%;
  font-size: 1.4rem;
  text-align: center;
  text-transform: uppercase;
  padding: var(--space-sm);
  border: 1px solid #ccc;
  border-radius: var(--btn-radius);
  margin-bottom: var(--space-md);
}
.score-initials-submit {
  width: 100%;
  min-height: var(--btn-min-touch);
  background: var(--primary);
  color: #fff;
  font-weight: 800;
  border: none;
  border-radius: var(--btn-radius);
  cursor: pointer;
}
.best-record-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--space-sm);
  padding: 6px 14px;
  background: var(--accent-yellow);
  border-radius: 999px;
  font-weight: 800;
  font-size: var(--font-size-small);
}
```

- [ ] **Step 3: Verify in the browser**

Run: `mcp__Claude_Preview__preview_start` with name `dev`, then `mcp__Claude_Preview__preview_eval` on the launcher page:

```js
createInitialsPrompt(function(v){ console.log('submitted', v); }).open();
```

Expected: a centered modal card appears with an input and a "확인" button; typing 3 characters and pressing Enter logs `submitted XXX` to the console (check via `preview_console_logs`) and the modal closes.

- [ ] **Step 4: Commit**

```bash
git add shared/score-store.js shared/style.css
git commit -m "Add initials-entry UI and CSS for new high scores"
```

---

### Task 3: Service worker wiring

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the new file to the pre-cache list and bump the cache version**

In `sw.js`, change:

```js
const CACHE_NAME = 'touchgame-v16';
```
to:
```js
const CACHE_NAME = 'touchgame-v17';
```

And change the `cache.addAll([...])` array (inside the `install` listener) from:
```js
      return cache.addAll([
        './',
        './index.html',
        './shared/style.css',
        './shared/engine.js',
        './games/registry.json',
        './favicon.svg',
        './og-image.svg',
        './manifest.json'
      ]);
```
to:
```js
      return cache.addAll([
        './',
        './index.html',
        './shared/style.css',
        './shared/engine.js',
        './shared/score-store.js',
        './games/registry.json',
        './favicon.svg',
        './og-image.svg',
        './manifest.json'
      ]);
```

- [ ] **Step 2: Sanity-check the file with Node**

Run: `node --check sw.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "sw.js: pre-cache shared/score-store.js, bump CACHE_NAME to v17"
```

---

### Task 4: Reference integration — `flag-quiz` (the "bare `scores`" convention, 47 games)

**Files:**
- Modify: `games/flag-quiz/index.html`
- Modify: `games/flag-quiz/game.js`

- [ ] **Step 1: Add the script tag**

In `games/flag-quiz/index.html`, change:
```html
  <script src="../../shared/engine.js?v=3"></script>
```
to:
```html
  <script src="../../shared/score-store.js?v=1"></script>
  <script src="../../shared/engine.js?v=3"></script>
```

- [ ] **Step 2: Add the best-record badge element**

In `games/flag-quiz/index.html`, change:
```html
    <div class="result-winner" id="resultWinner"></div>
```
to:
```html
    <div class="result-winner" id="resultWinner"></div>
    <div class="best-record-badge" id="bestRecordBadge" style="display:none;"></div>
```

- [ ] **Step 3: Call `reportGameResult` and show the badge**

In `games/flag-quiz/game.js`, change:
```js
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');
```
to:
```js
function showResult() {
  clearTimers();
  phase = 'idle';
  sound.play('fanfare');

  var scoreResult = reportGameResult({ gameId: 'flag-quiz', playerCount: playerCount, scores: scores.slice(), metric: 'score' });
  var badge = document.getElementById('bestRecordBadge');
  if (badge) {
    if (scoreResult.isNewBest) {
      badge.style.display = '';
      badge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
      createInitialsPrompt(function () {
        badge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
      }).open();
    } else if (scoreResult.bestEntry) {
      badge.style.display = '';
      badge.textContent = '이 기기 최고 기록: ' + scoreResult.bestEntry.score + '점';
    } else {
      badge.style.display = 'none';
    }
  }
```

- [ ] **Step 4: Verify with the static checker**

Run: `node scripts/verify-game.js flag-quiz`
Expected: `9. game.js 문법 검사 ✓` (and all other existing checks still PASS — Task 8 adds the new score-reporting check, not required to pass yet).

- [ ] **Step 5: Verify in the browser**

Start the dev server (`mcp__Claude_Preview__preview_start` name `dev`), navigate to `games/flag-quiz/index.html`, play one round with `?autoplay=1` in the URL, and take a screenshot of the result screen. Expected: the "🏆 이 기기 신기록!" badge appears under the winner banner, and the initials modal from Task 2 appears on top of it.

- [ ] **Step 6: Commit**

```bash
git add games/flag-quiz/index.html games/flag-quiz/game.js
git commit -m "flag-quiz: wire up score-store reporting (reference for bare-scores games)"
```

---

### Task 5: Reference integration — `balloon-pop` (`playerScores` convention, 3 games) and `nim-game` (binary win/lose, 10 games)

**Files:**
- Modify: `games/balloon-pop/index.html`, `games/balloon-pop/game.js`
- Modify: `games/nim-game/index.html`, `games/nim-game/game.js`

- [ ] **Step 1: `balloon-pop` — script tag and badge element**

In `games/balloon-pop/index.html`, add `<script src="../../shared/score-store.js?v=1"></script>` immediately before the existing `<script src="../../shared/engine.js?v=3"></script>` line, and add `<div class="best-record-badge" id="bestRecordBadge" style="display:none;"></div>` immediately after the `id="resultScores"` element's closing tag.

- [ ] **Step 2: `balloon-pop` — report call**

In `games/balloon-pop/game.js`, change:
```js
  function showResult() {
```
to:
```js
  function showResult() {
    var scoreResult = reportGameResult({ gameId: 'balloon-pop', playerCount: playerCount, scores: playerScores.slice(), metric: 'score' });
    var badge = document.getElementById('bestRecordBadge');
    if (badge) {
      if (scoreResult.isNewBest) {
        badge.style.display = '';
        badge.textContent = '🏆 이 기기 신기록! ' + scoreResult.bestEntry.score + '점';
        createInitialsPrompt(function () {}).open();
      } else if (scoreResult.bestEntry) {
        badge.style.display = '';
        badge.textContent = '이 기기 최고 기록: ' + scoreResult.bestEntry.score + '점';
      }
    }
```

- [ ] **Step 3: `nim-game` — script tag and badge element**

In `games/nim-game/index.html`, add the `score-store.js` script tag before `engine.js` as in Step 1, and add `<div class="best-record-badge" id="bestRecordBadge" style="display:none;"></div>` immediately after the `id="resultSub"` element.

- [ ] **Step 4: `nim-game` — report call (binary win/lose, no scores array)**

`nim-game`'s result function takes the winner/loser index as parameters instead of building a `scores` array. In `games/nim-game/game.js`, change:
```js
  function showResult(winner, loser) {
```
to:
```js
  function showResult(winner, loser) {
    var nimScores = [0, 0];
    nimScores[winner] = 1;
    var scoreResult = reportGameResult({ gameId: 'nim-game', playerCount: 2, scores: nimScores, metric: 'win' });
    if (scoreResult.isNewBest) {
      createInitialsPrompt(function () {}).open();
    }
```

(`nim-game` is always 2-player, so `playerCount: 2` is hardcoded — confirmed by `PLAYER_NAMES`/`PLAYER_COLORS` only ever indexing 0/1 in this file.)

- [ ] **Step 5: Verify both with the static checker**

Run: `node scripts/verify-game.js balloon-pop && node scripts/verify-game.js nim-game`
Expected: no new syntax errors; check `9. game.js 문법 검사` PASS for both.

- [ ] **Step 6: Verify in the browser**

Load `games/balloon-pop/index.html?autoplay=1` and `games/nim-game/index.html?autoplay=1` in the preview, play through to the result screen for each, screenshot both. Expected: badge text visible on both result screens.

- [ ] **Step 7: Commit**

```bash
git add games/balloon-pop/index.html games/balloon-pop/game.js games/nim-game/index.html games/nim-game/game.js
git commit -m "balloon-pop, nim-game: wire up score-store reporting (reference for playerScores/binary-win games)"
```

---

### Task 6: Codemod the remaining 48 games matching a known convention

**Files:**
- Create: `scripts/add-score-reporting.js`
- Modify: `games/{folder}/index.html` and `games/{folder}/game.js` for 46 "bare scores" games (all of `games/registry.json` except `flag-quiz`, `balloon-pop`, `bomb-dodge`, `chase-tap`, and the 10 "neither" games listed in the ground-truth section) and 2 "playerScores" games (`bomb-dodge`, `chase-tap`)

- [ ] **Step 1: Write the codemod**

```js
#!/usr/bin/env node
/**
 * One-time migration: inserts score-store reporting into every game matching
 * the "bare scores" or "playerScores" convention. Skips games already
 * containing reportGameResult (idempotent — safe to re-run).
 *
 * Usage: node scripts/add-score-reporting.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP = new Set([
  'flag-quiz', 'balloon-pop', 'nim-game', // already hand-integrated
  'color-mix', 'color-signal', 'direction-relay', 'jamo-merge',
  'memory-relay', 'number-tap', 'secret-code', 'sum-relay', 'word-chain' // handled in Task 7
]);

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', 'registry.json'), 'utf-8'));

let patched = 0;
let skipped = 0;
const failures = [];

for (const folder of registry) {
  if (SKIP.has(folder)) { skipped++; continue; }

  const gameDir = path.join(ROOT, 'games', folder);
  const htmlPath = path.join(gameDir, 'index.html');
  const jsPath = path.join(gameDir, 'game.js');
  let html = fs.readFileSync(htmlPath, 'utf-8');
  let js = fs.readFileSync(jsPath, 'utf-8');

  if (js.includes('reportGameResult(')) { skipped++; continue; } // idempotent

  const usesPlayerScores = /\bplayerScores\b/.test(js) && !/\bconst scores\b|\blet scores\b|\bvar scores\b/.test(js);
  const scoresVarName = usesPlayerScores ? 'playerScores' : 'scores';

  if (!/function showResult\(\)\s*\{/.test(js)) {
    failures.push(folder + ': no `function showResult() {` found');
    continue;
  }
  if (!html.includes('shared/engine.js')) {
    failures.push(folder + ': no shared/engine.js script tag found');
    continue;
  }

  const reportLine =
    '\n  var scoreResult = reportGameResult({ gameId: \'' + folder + '\', playerCount: playerCount, scores: ' +
    scoresVarName + '.slice(), metric: \'score\' });\n' +
    '  (function () {\n' +
    '    var badge = document.getElementById(\'bestRecordBadge\');\n' +
    '    if (!badge) return;\n' +
    '    if (scoreResult.isNewBest) {\n' +
    '      badge.style.display = \'\';\n' +
    '      badge.textContent = \'\\uD83C\\uDFC6 \\uC774 \\uAE30\\uAE30 \\uC2E0\\uAE30\\uB85D! \' + scoreResult.bestEntry.score + \'\\uC810\';\n' +
    '      createInitialsPrompt(function () {}).open();\n' +
    '    } else if (scoreResult.bestEntry) {\n' +
    '      badge.style.display = \'\';\n' +
    '      badge.textContent = \'\\uC774 \\uAE30\\uAE30 \\uCD5C\\uACE0 \\uAE30\\uB85D: \' + scoreResult.bestEntry.score + \'\\uC810\';\n' +
    '    }\n' +
    '  })();\n';

  js = js.replace(/function showResult\(\)\s*\{/, 'function showResult() {' + reportLine);

  html = html.replace(
    /(\s*)<script src="\.\.\/\.\.\/shared\/engine\.js\?v=\d+"><\/script>/,
    '$1<script src="../../shared/score-store.js?v=1"></script>$1<script src="../../shared/engine.js?v=3"></script>'
  );
  if (!html.includes('id="bestRecordBadge"')) {
    html = html.replace(
      /(<div class="result-winner"[^>]*><\/div>)/,
      '$1\n    <div class="best-record-badge" id="bestRecordBadge" style="display:none;"></div>'
    );
  }
  if (!html.includes('id="bestRecordBadge"')) {
    failures.push(folder + ': could not find an insertion point for the badge element (no <div class="result-winner">)');
    continue;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(jsPath, js);
    fs.writeFileSync(htmlPath, html);
  }
  patched++;
}

console.log(`Patched: ${patched}, skipped (already done / excluded): ${skipped}, failed: ${failures.length}`);
if (failures.length) {
  console.log('\nFailures (handle these individually):');
  failures.forEach((f) => console.log('  - ' + f));
}
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 2: Dry-run and inspect the failure list**

Run: `node scripts/add-score-reporting.js --dry-run`
Expected: `Patched: <N>, skipped: 13, failed: <M>`. The 13 skipped are the 3 hand-done in Tasks 4–5 plus the 10 deferred to Task 7. Any failures are games whose `index.html` doesn't have a `<div class="result-winner">` element (e.g. `balloon-pop`/`nim-game`-style custom markup) — note their folder names; they'll need the same by-hand treatment as Task 5 rather than the codemod, so add them to the `SKIP` set and to Task 7's list before re-running.

- [ ] **Step 3: Apply for real**

Run: `node scripts/add-score-reporting.js`
Expected: same counts as the dry run, `failed: 0` (after adjusting `SKIP` per Step 2), exit code 0.

- [ ] **Step 4: Spot-check 3 patched games for valid JS**

Run:
```bash
node --check games/quick-math/game.js
node --check games/maze-run/game.js
node --check games/bomb-dodge/game.js
```
Expected: no output from any of the three (exit code 0 each).

- [ ] **Step 5: Spot-check one patched game in the browser**

Load `games/quick-math/index.html?autoplay=1` in the preview, play through, screenshot the result screen. Expected: best-record badge visible, no console errors (`preview_console_logs` with `level: 'error'` returns empty).

- [ ] **Step 6: Commit**

```bash
git add scripts/add-score-reporting.js games/
git commit -m "Codemod: wire up score-store reporting in 48 games matching the standard conventions"
```

---

### Task 7: Hand-patch the remaining games

**Files:**
- Modify `games/{folder}/index.html` and `games/{folder}/game.js` for each folder remaining in the `SKIP` set after Task 6 Step 2 (starting list: `color-mix`, `color-signal`, `direction-relay`, `jamo-merge`, `memory-relay`, `number-tap`, `secret-code`, `sum-relay`, `word-chain` — adjust if Task 6's dry run surfaced more)

- [ ] **Step 1: For each remaining folder, inspect its result logic**

```bash
node -e "console.log(require('fs').readFileSync('games/secret-code/game.js','utf8'))" | grep -n "function showResult\|score\|winner" 
```
Repeat for each remaining folder name, substituting it in the path. Identify: the function that renders the result screen, and the per-player numeric or win/lose value it already computes.

- [ ] **Step 2: Apply the same two changes used in Task 4/5 to each**

For each folder: add the `shared/score-store.js` script tag before its `shared/engine.js` tag in `index.html`; add a `<div class="best-record-badge" id="bestRecordBadge" style="display:none;"></div>` near its result banner; add one `reportGameResult({ gameId: '<folder>', playerCount: <its player count>, scores: <its per-player values>, metric: '<score|time|win>' })` call at the top of its result-render function, following exactly the patterns shown in Task 4 (bare array) and Task 5 (binary win/lose). Use `metric: 'win'` only for true single-outcome games like `nim-game`; everything that already accumulates a number where higher is better uses `metric: 'score'`.

- [ ] **Step 3: Verify each one immediately after patching**

Run, for each folder just patched:
```bash
node --check games/<folder>/game.js
node scripts/verify-game.js <folder>
```
Expected: no syntax errors; existing checks (1–9, i.e. all 20 numbered sub-checks) still PASS.

- [ ] **Step 4: Browser-verify all of them**

For each folder, load `games/<folder>/index.html?autoplay=1` in the preview and confirm the result screen shows the badge with no console errors.

- [ ] **Step 5: Commit**

```bash
git add games/
git commit -m "Hand-wire score-store reporting into the remaining games with non-standard result logic"
```

---

### Task 8: `verify-game.js` check + full-repo sweep

**Files:**
- Modify: `scripts/verify-game.js`

- [ ] **Step 1: Add check #10 (21st check overall)**

In `scripts/verify-game.js`, immediately after the existing:
```js
check('9. game.js 문법 검사', () => {
```
block (after its closing `});`), add:

```js

// === 10. 점수 리포팅 연동 ===
check('10. 점수 리포팅: score-store 연동', () => {
  const htmlPath = path.join(gameDir, 'index.html');
  const jsPath = path.join(gameDir, 'game.js');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const js = fs.readFileSync(jsPath, 'utf-8');
  if (!html.includes('shared/score-store.js')) return 'index.html에 shared/score-store.js 링크 없음';
  if (!/reportGameResult\s*\(/.test(js)) return 'game.js에 reportGameResult() 호출 없음';
  return true;
});
```

- [ ] **Step 2: Run it against every game in the registry**

```bash
node -e "
const games = require('./games/registry.json');
const { execSync } = require('child_process');
let failed = 0;
for (const g of games) {
  try {
    execSync('node scripts/verify-game.js ' + g, { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.log('FAIL: ' + g);
    console.log(e.stdout.toString());
  }
}
console.log('Done. ' + failed + ' / ' + games.length + ' failed.');
"
```
Expected: `Done. 0 / 60 failed.` If any fail, the printed output names which of the 21 checks failed for that folder — go back to Task 6 or 7 for that specific game.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-game.js
git commit -m "verify-game.js: add check #10 — every game must call reportGameResult()"
```

---

### Task 9: Launcher "전체 랭킹" panel

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Load `score-store.js` in the launcher**

In `index.html`, change:
```html
  <script src="shared/engine.js?v=4"></script>
```
to:
```html
  <script src="shared/score-store.js?v=1"></script>
  <script src="shared/engine.js?v=4"></script>
```

- [ ] **Step 2: Add the ranking button next to the sound toggle**

Change:
```html
    <button class="sound-toggle" id="soundToggle" aria-label="사운드 토글">🔇</button>
  </header>
```
to:
```html
    <button class="ranking-toggle" id="rankingToggle" aria-label="전체 랭킹">🏆</button>
    <button class="sound-toggle" id="soundToggle" aria-label="사운드 토글">🔇</button>
  </header>

  <div class="ranking-overlay" id="rankingOverlay" style="display:none;">
    <div class="ranking-panel">
      <div class="ranking-panel-head">
        <h2>전체 랭킹</h2>
        <button id="rankingClose" aria-label="닫기">✕</button>
      </div>
      <div class="ranking-list" id="rankingList"></div>
    </div>
  </div>
```

- [ ] **Step 3: Keep the loaded game list around and render the panel**

In `index.html`, change:
```js
        if (validGames.length === 0) {
          // All failed → fall back
          renderCards(FALLBACK_GAMES);
        } else {
          renderCards(validGames);
        }
```
to:
```js
        if (validGames.length === 0) {
          // All failed → fall back
          loadedGames = FALLBACK_GAMES;
          renderCards(FALLBACK_GAMES);
        } else {
          loadedGames = validGames;
          renderCards(validGames);
        }
```

Then, immediately before `async function loadGames() {`, add:
```js
    var loadedGames = [];

    function renderRankingPanel() {
      var list = document.getElementById('rankingList');
      var summaries = getAllGameSummaries().filter(function (s) { return s.best !== null; });
      summaries.sort(function (a, b) { return b.lastPlayedTs - a.lastPlayedTs; });
      if (summaries.length === 0) {
        list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-sub);">아직 플레이한 게임이 없어요.</p>';
        return;
      }
      list.innerHTML = summaries.map(function (s) {
        var meta = loadedGames.find(function (g) { return g.folder === s.gameId; });
        var name = meta ? meta.name : s.gameId;
        var icon = meta ? meta.icon : '🎮';
        return '<div class="ranking-row">' +
          '<span class="ranking-icon">' + icon + '</span>' +
          '<span class="ranking-name">' + name + '</span>' +
          '<span class="ranking-best">' + s.best + '점</span>' +
          '<span class="ranking-plays">' + s.plays + '회 플레이</span>' +
          '</div>';
      }).join('');
    }

    document.getElementById('rankingToggle').addEventListener('click', function () {
      renderRankingPanel();
      document.getElementById('rankingOverlay').style.display = 'flex';
    });
    document.getElementById('rankingClose').addEventListener('click', function () {
      document.getElementById('rankingOverlay').style.display = 'none';
    });

```

- [ ] **Step 4: Add CSS**

Append to `shared/style.css` (after the block added in Task 2):

```css
.ranking-toggle {
  width: var(--btn-min-touch);
  height: var(--btn-min-touch);
  border-radius: 50%;
  border: none;
  background: var(--card-bg);
  box-shadow: var(--shadow-card);
  font-size: 1.2rem;
  cursor: pointer;
}
.ranking-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  align-items: center;
  justify-content: center;
  z-index: 1900;
}
.ranking-panel {
  background: var(--card-bg);
  border-radius: var(--card-radius);
  width: min(420px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  padding: var(--space-lg);
}
.ranking-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}
.ranking-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid #eee;
}
.ranking-name { flex: 1; font-weight: 700; }
.ranking-best { font-weight: 800; color: var(--primary); }
.ranking-plays { font-size: var(--font-size-small); color: var(--text-sub); }
```

- [ ] **Step 5: Verify in the browser**

Start the dev server, open the launcher, play `games/flag-quiz/index.html?autoplay=1` once to generate a score entry, return to the launcher (`goHome()` or back button), click the 🏆 button. Expected: panel opens showing "국기 맞히기" with the score just recorded; clicking ✕ closes it.

- [ ] **Step 6: Commit**

```bash
git add index.html shared/style.css
git commit -m "Add launcher-level 전체 랭킹 panel"
```

---

### Task 10: Docs + final sweep

**Files:**
- Modify: `docs/AUTO_MODE.md`
- Modify: `docs/AI_ROUTINE.md`

- [ ] **Step 1: Update the hardcoded check count**

In `docs/AUTO_MODE.md` and `docs/AI_ROUTINE.md`, find every occurrence of "정적 20/20" (or similar "정적 N/N" check-count text) and replace with "정적 21/21" — these refer to the now-21 checks counted in Task 8 Step 2's sweep (20 existing `check(...)` calls + the new check #10, which itself is implemented as a single `check(...)` call, so 20 + 1 = 21).

```bash
grep -rn "정적 20/20" docs/AUTO_MODE.md docs/AI_ROUTINE.md
```
Edit each match found to say `정적 21/21`.

- [ ] **Step 2: Note the golden-template requirement for future auto-added games**

In `docs/AI_ROUTINE.md`, find the section listing the 4 golden templates (`flag-quiz`, the pattern-B exemplar, `nim-game`/`secret-code`, `slide-puzzle`) and add one line noting that as of this change, all golden templates already include `reportGameResult()` wiring (true after Tasks 4–7), so games copied from them inherit it automatically — no further action needed by the daily automation.

- [ ] **Step 3: Final full-repo verification**

```bash
node scripts/validate-catalog.js
node -e "
const games = require('./games/registry.json');
const { execSync } = require('child_process');
let failed = 0;
for (const g of games) {
  try { execSync('node scripts/verify-game.js ' + g, { stdio: 'pipe' }); }
  catch (e) { failed++; console.log('FAIL: ' + g); }
}
console.log(failed + ' / ' + games.length + ' failed.');
"
node --test scripts/score-store.test.js
```
Expected: `Catalog OK: 60 games`, `0 / 60 failed.`, `# fail 0` from the test run.

- [ ] **Step 4: Commit**

```bash
git add docs/AUTO_MODE.md docs/AI_ROUTINE.md
git commit -m "docs: update check count to 21/21, note score-store wiring in golden templates"
```
