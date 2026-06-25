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
  'memory-relay', 'number-tap', 'secret-code', 'sum-relay', 'word-chain', // handled separately
  'dots-and-boxes' // showResult(winnerIdx) takes a param, different convention — handle separately
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
    // Fallback: balloon-pop-style result screens use a "resultScores" div instead.
    html = html.replace(
      /(<div class="result-scores" id="resultScores">[\s\S]*?<\/div>)/,
      '$1\n      <div class="best-record-badge" id="bestRecordBadge" style="display:none;"></div>'
    );
  }
  if (!html.includes('id="bestRecordBadge"')) {
    failures.push(folder + ': could not find an insertion point for the badge element (no result-winner or resultScores div)');
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
