import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL, createState, beginPlayback, completePlayback, cancelPlayback,
  isLit, countLit, isComplete, resetState,
} from '../js/state.js';

test('initial state is idle and empty', () => {
  const state = createState();
  assert.deepEqual(state, {
    status: 'idle',
    playingName: null,
    lit: [],
    missingAudio: [],
  });
  assert.equal(countLit(state), 0);
  assert.equal(isComplete(state), false);
});

test('beginPlayback enters playing and lights immediately', () => {
  const state = beginPlayback(createState(), '宋书涵');
  assert.equal(state.status, 'playing');
  assert.equal(state.playingName, '宋书涵');
  assert.equal(isLit(state, '宋书涵'), true);
  assert.equal(countLit(state), 1);
});

test('beginPlayback is ignored while another person is playing', () => {
  const playing = beginPlayback(createState(), '宋书涵');
  assert.equal(beginPlayback(playing, '卢冲'), null);
});

test('completePlayback lights the person once', () => {
  let state = beginPlayback(createState(), '宋书涵');
  state = completePlayback(state, '宋书涵');
  assert.equal(state.status, 'idle');
  assert.equal(state.playingName, null);
  assert.equal(isLit(state, '宋书涵'), true);
  assert.equal(countLit(state), 1);

  state = completePlayback(state, '宋书涵');
  assert.equal(countLit(state), 1);
});

test('completePlayback ignores a stale name', () => {
  const state = beginPlayback(createState(), '宋书涵');
  const next = completePlayback(state, '卢冲');
  assert.equal(next, state);
});

test('cancelPlayback stops playback but keeps the person lit', () => {
  let state = beginPlayback(createState(), '宋书涵');
  state = cancelPlayback(state);
  assert.equal(state.status, 'idle');
  assert.equal(state.playingName, null);
  assert.equal(isLit(state, '宋书涵'), true);
});

test('missing audio still lights the person and records the flag', () => {
  let state = beginPlayback(createState(), '宋书涵');
  state = completePlayback(state, '宋书涵', { missingAudio: true });
  assert.equal(isLit(state, '宋书涵'), true);
  assert.deepEqual(state.missingAudio, ['宋书涵']);
});

test('successful playback clears a previous missing-audio flag', () => {
  let state = createState({ missingAudio: ['宋书涵'] });
  state = beginPlayback(state, '宋书涵');
  state = completePlayback(state, '宋书涵');
  assert.deepEqual(state.missingAudio, []);
  assert.equal(isLit(state, '宋书涵'), true);
});

test('replaying a lit person does not duplicate or unlight', () => {
  let state = completePlayback(beginPlayback(createState(), '宋书涵'), '宋书涵');
  state = beginPlayback(state, '宋书涵');
  state = completePlayback(state, '宋书涵');
  assert.equal(countLit(state), 1);
  assert.equal(state.missingAudio.length, 0);
});

test('completing all 28 marks the state complete', () => {
  let state = createState();
  for (let i = 1; i <= TOTAL; i += 1) {
    const name = `P${i}`;
    state = beginPlayback(state, name);
    state = completePlayback(state, name);
  }
  assert.equal(countLit(state), TOTAL);
  assert.equal(isComplete(state), true);
});

test('resetState clears everything', () => {
  let state = completePlayback(beginPlayback(createState(), '宋书涵'), '宋书涵');
  state = resetState();
  assert.equal(countLit(state), 0);
  assert.equal(state.status, 'idle');
});
