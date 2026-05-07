#!/usr/bin/env node
/**
 * 자동 게임 추가 - 보조 스크립트 모음
 *
 * Claude가 자동 모드에서 호출하는 헬퍼:
 *   list-existing-folders   현재 등록된 폴더명 출력
 *   stats                   카테고리별 게임 수 출력 (선택 알고리즘 입력)
 *   discard <folder>        실패 게임 폐기 (폴더 삭제 + registry/launcher 등록 해제)
 *   recent-failures         최근 3회 실패 기록 (3연속 실패 차단용)
 *
 * 사용법:
 *   node scripts/auto-add-game-helpers.js <command> [args]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'games', 'registry.json');
const LAUNCHER = path.join(ROOT, 'index.html');
const FAIL_LOG = path.join(ROOT, '.claude', 'auto-failures.json');

const cmd = process.argv[2];
const arg = process.argv[3];

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf-8'));
}

function readFailLog() {
  if (!fs.existsSync(FAIL_LOG)) return [];
  try { return JSON.parse(fs.readFileSync(FAIL_LOG, 'utf-8')); }
  catch { return []; }
}

function writeFailLog(arr) {
  fs.mkdirSync(path.dirname(FAIL_LOG), { recursive: true });
  fs.writeFileSync(FAIL_LOG, JSON.stringify(arr, null, 2));
}

if (cmd === 'list-existing-folders') {
  const reg = readRegistry();
  console.log(reg.join('\n'));
  process.exit(0);
}

if (cmd === 'stats') {
  const launcher = fs.readFileSync(LAUNCHER, 'utf-8');
  const reg = readRegistry();
  const counts = { speed: 0, brain: 0, math: 0, knowledge: 0, coop: 0, puzzle: 0 };
  reg.forEach(folder => {
    const re = new RegExp(`['"]${folder}['"]\\s*:\\s*['"](speed|brain|math|knowledge|coop|puzzle)['"]`);
    const m = launcher.match(re);
    if (m) counts[m[1]]++;
  });
  console.log(JSON.stringify({ total: reg.length, byCategory: counts }, null, 2));
  process.exit(0);
}

if (cmd === 'discard') {
  if (!arg) { console.error('Usage: discard <folder>'); process.exit(1); }
  const folder = arg;

  // 1. Delete game folder
  const gameDir = path.join(ROOT, 'games', folder);
  if (fs.existsSync(gameDir)) {
    fs.rmSync(gameDir, { recursive: true, force: true });
    console.log(`✓ 폴더 삭제: games/${folder}`);
  }

  // 2. Remove from registry.json
  const reg = readRegistry();
  const newReg = reg.filter(f => f !== folder);
  if (newReg.length !== reg.length) {
    fs.writeFileSync(REGISTRY, JSON.stringify(newReg) + '\n');
    console.log(`✓ registry.json에서 제거`);
  }

  // 3. Remove from launcher CATEGORY_MAP
  let launcher = fs.readFileSync(LAUNCHER, 'utf-8');
  const catRe = new RegExp(`,?\\s*['"]${folder}['"]\\s*:\\s*['"](speed|brain|math|knowledge|coop|puzzle)['"]`, 'g');
  launcher = launcher.replace(catRe, '');

  // 4. Remove from launcher GAME_ICONS
  const iconRe = new RegExp(`\\s*['"]${folder}['"]\\s*:\\s*'<svg[^']*'\\s*,?`, 'g');
  launcher = launcher.replace(iconRe, '');

  // 5. Remove from launcher FALLBACK_GAMES
  const fbRe = new RegExp(`,?\\s*\\{\\s*folder\\s*:\\s*['"]${folder}['"][^}]*\\}`, 'g');
  launcher = launcher.replace(fbRe, '');

  fs.writeFileSync(LAUNCHER, launcher);
  console.log(`✓ launcher index.html에서 제거`);

  // 6. Record failure
  const failures = readFailLog();
  failures.push({ folder, timestamp: new Date().toISOString() });
  // Keep only last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = failures.filter(f => new Date(f.timestamp).getTime() > sevenDaysAgo);
  writeFailLog(recent);
  console.log(`✓ 실패 로그 기록`);

  process.exit(0);
}

if (cmd === 'recent-failures') {
  const failures = readFailLog();
  // Today's failures only (KST)
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayKstStart = new Date(kstNow);
  todayKstStart.setUTCHours(0, 0, 0, 0);
  const todayStartUtc = todayKstStart.getTime() - kstOffset;

  const todayFailures = failures.filter(f => new Date(f.timestamp).getTime() >= todayStartUtc);
  console.log(JSON.stringify({
    todayCount: todayFailures.length,
    todayFailures,
    blockedForToday: todayFailures.length >= 3
  }, null, 2));
  process.exit(0);
}

if (cmd === 'reset-failures') {
  writeFailLog([]);
  console.log('✓ 실패 로그 초기화');
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
console.error('Available: list-existing-folders | stats | discard <folder> | recent-failures | reset-failures');
process.exit(1);
