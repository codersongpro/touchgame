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
