import test from 'node:test';
import assert from 'node:assert/strict';
import { LIT_KEY, loadLit, saveLit, clearLit } from '../js/storage.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('saveLit and loadLit round-trip', () => {
  const storage = memoryStorage();
  saveLit(storage, ['宋书涵', '卢冲']);
  assert.deepEqual(loadLit(storage), ['宋书涵', '卢冲']);
});

test('loadLit returns an empty array when nothing is stored', () => {
  assert.deepEqual(loadLit(memoryStorage()), []);
});

test('loadLit ignores invalid JSON', () => {
  const storage = memoryStorage();
  storage.setItem(LIT_KEY, '{not json');
  assert.deepEqual(loadLit(storage), []);
});

test('loadLit ignores non-array values', () => {
  const storage = memoryStorage();
  storage.setItem(LIT_KEY, JSON.stringify({ a: 1 }));
  assert.deepEqual(loadLit(storage), []);
});

test('clearLit removes the stored value', () => {
  const storage = memoryStorage();
  saveLit(storage, ['宋书涵']);
  clearLit(storage);
  assert.deepEqual(loadLit(storage), []);
});

test('storage failures degrade silently', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadLit(broken), []);
  assert.doesNotThrow(() => saveLit(broken, ['宋书涵']));
  assert.doesNotThrow(() => clearLit(broken));
  assert.deepEqual(loadLit(null), []);
  assert.doesNotThrow(() => saveLit(null, ['宋书涵']));
});
