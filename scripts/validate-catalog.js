#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'games', 'registry.json');
const CATEGORIES = new Set(['speed', 'brain', 'math', 'knowledge', 'coop', 'puzzle']);
const PATTERNS = new Set(['A', 'B', 'C', 'D']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function validateGame(folder) {
  const dir = path.join(ROOT, 'games', folder);
  const metaFile = path.join(dir, 'game.json');
  const requiredFiles = ['index.html', 'style.css', 'game.js', 'game.json'];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(dir, file))) fail(`games/${folder}/${file} is missing`);
  }
  if (!fs.existsSync(metaFile)) return;

  const meta = readJson(metaFile);
  const required = ['name', 'description', 'icon', 'color', 'grades', 'playTime', 'category', 'players', 'pattern', 'tags'];
  for (const key of required) {
    if (!(key in meta)) fail(`games/${folder}/game.json missing ${key}`);
  }
  if (!CATEGORIES.has(meta.category)) fail(`games/${folder}/game.json has invalid category ${meta.category}`);
  if (!PATTERNS.has(meta.pattern)) fail(`games/${folder}/game.json has invalid pattern ${meta.pattern}`);
  if (!Array.isArray(meta.players) || !meta.players.length) fail(`games/${folder}/game.json players must be a non-empty array`);
  if (!Array.isArray(meta.tags) || !meta.tags.length) fail(`games/${folder}/game.json tags must be a non-empty array`);
  if (!/^#[0-9a-f]{6}$/i.test(meta.color || '')) fail(`games/${folder}/game.json color must be #RRGGBB`);
}

function main() {
  const registry = readJson(REGISTRY);
  const seen = new Set();

  for (const folder of registry) {
    if (seen.has(folder)) fail(`Duplicate registry entry: ${folder}`);
    seen.add(folder);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) fail(`Registry folder is not kebab-case: ${folder}`);
    validateGame(folder);
  }

  if (process.exitCode) return;
  console.log(`Catalog OK: ${registry.length} games`);
}

main();
