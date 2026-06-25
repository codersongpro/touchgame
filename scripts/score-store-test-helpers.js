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
