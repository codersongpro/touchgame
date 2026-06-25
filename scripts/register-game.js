#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'games', 'registry.json');
const LAUNCHER = path.join(ROOT, 'index.html');
const ENGINE = path.join(ROOT, 'shared', 'engine.js');

const CATEGORIES = new Set(['speed', 'brain', 'math', 'knowledge', 'coop', 'puzzle']);
const PATTERNS = new Set(['A', 'B', 'C', 'D']);

const CATEGORY_RULES = [
  ['coop', ['p1', 'p2', 'relay', 'signal', 'merge', 'chain', 'coop', 'team']],
  ['puzzle', ['puzzle', 'maze', 'pipe', 'stroke', 'connect', 'rotate', 'fold', 'hanoi']],
  ['math', ['math', 'number', 'sum', 'count', 'coin', 'clock', 'ten-frame', 'bond']],
  ['speed', ['reaction', 'race', 'tap', 'pop', 'dodge', 'chase', 'rps']],
  ['knowledge', ['quiz', 'word', 'capital', 'flag', 'proverb', 'jamo', 'idiom', 'noun', 'job']],
  ['brain', ['memory', 'match', 'pattern', 'relation', 'odd', 'shadow']]
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function upsertMapEntry(file, mapName, folder, category) {
  let source = fs.readFileSync(file, 'utf8');
  const mapRe = new RegExp('((?:var|const)\\s+' + mapName + '\\s*=\\s*\\{)([\\s\\S]*?)(\\n\\s*\\};)');
  const match = source.match(mapRe);
  if (!match) throw new Error(`Cannot find ${mapName} in ${path.relative(ROOT, file)}`);

  let body = match[2];
  const entryRe = new RegExp(`(['"]${folder}['"]\\s*:\\s*['"])([^'"]+)(['"])`);
  if (entryRe.test(body)) {
    body = body.replace(entryRe, `$1${category}$3`);
  } else {
    const indent = file === LAUNCHER ? '      ' : '  ';
    body = body.replace(/\s*$/, '') + `\n${indent}'${folder}': '${category}',`;
  }
  source = source.replace(mapRe, `$1${body}$3`);
  fs.writeFileSync(file, source, 'utf8');
}

function normalizeFolder(input) {
  return String(input || '')
    .replace(/^games[\\/]/, '')
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)[0];
}

function inferCategory(folder, meta) {
  const haystack = [folder, meta.name, meta.description, meta.tags && meta.tags.join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [category, words] of CATEGORY_RULES) {
    if (words.some(word => haystack.includes(word))) return category;
  }
  return '';
}

function inferPattern(category, players) {
  if (category === 'puzzle') return 'D';
  if (category === 'coop' || (Array.isArray(players) && players.length === 1 && players[0] === 2)) return 'C';
  if (category === 'speed') return 'B';
  return 'A';
}

function inferPlayers(meta) {
  const text = [meta.name, meta.description, meta.playTime].filter(Boolean).join(' ').toLowerCase();
  if (text.includes('p1') || text.includes('p2') || text.includes('2p')) return [2];
  return [2, 3, 4];
}

function inferTags(folder, meta) {
  const tags = new Set(Array.isArray(meta.tags) ? meta.tags : []);
  tags.add(meta.category);
  tags.add('pattern-' + String(meta.pattern).toLowerCase());
  if (Array.isArray(meta.players) && meta.players.length === 1 && meta.players[0] === 2) tags.add('two-player');
  if (meta.category === 'coop') tags.add('co-op');
  if (meta.category === 'puzzle') tags.add('puzzle');
  if (meta.category === 'math') tags.add('math');
  if (meta.category === 'speed') tags.add('reaction');
  if (String(meta.playTime || '').includes('30')) tags.add('quick');
  if (folder.includes('quiz')) tags.add('quiz');
  return Array.from(tags).filter(Boolean).sort();
}

function validate(folder, meta) {
  const missing = ['name', 'description', 'icon', 'color', 'grades', 'playTime']
    .filter(key => !(key in meta));
  if (missing.length) throw new Error('Missing required fields: ' + missing.join(', '));
  if (!CATEGORIES.has(meta.category)) throw new Error('Invalid category: ' + meta.category);
  if (!PATTERNS.has(meta.pattern)) throw new Error('Invalid pattern: ' + meta.pattern);
  if (!Array.isArray(meta.players) || !meta.players.length) throw new Error('players must be a non-empty array');
  if (!Array.isArray(meta.tags) || !meta.tags.length) throw new Error('tags must be a non-empty array');
  if (!/^#[0-9a-f]{6}$/i.test(meta.color)) throw new Error('color must be #RRGGBB');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) throw new Error('folder must be kebab-case');
}

function main() {
  const folder = normalizeFolder(process.argv[2]);
  if (!folder) {
    console.error('Usage: node scripts/register-game.js games/{folder}');
    process.exit(1);
  }

  const gameDir = path.join(ROOT, 'games', folder);
  const metaFile = path.join(gameDir, 'game.json');
  if (!fs.existsSync(metaFile)) throw new Error('Missing game.json: games/' + folder);

  const meta = readJson(metaFile);
  meta.category = meta.category || inferCategory(folder, meta);
  meta.players = Array.isArray(meta.players) ? meta.players : inferPlayers(meta);
  meta.pattern = meta.pattern || inferPattern(meta.category, meta.players);
  meta.tags = inferTags(folder, meta);
  validate(folder, meta);
  writeJson(metaFile, meta);

  const registry = readJson(REGISTRY);
  if (!registry.includes(folder)) {
    registry.push(folder);
    writeJson(REGISTRY, registry);
  }
  upsertMapEntry(LAUNCHER, 'CATEGORY_MAP', folder, meta.category);
  upsertMapEntry(ENGINE, '_GAME_CATEGORY_MAP', folder, meta.category);

  console.log(JSON.stringify({
    registered: folder,
    category: meta.category,
    pattern: meta.pattern,
    players: meta.players,
    tags: meta.tags
  }, null, 2));
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
