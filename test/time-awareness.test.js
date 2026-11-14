'use strict';

require('../time-awareness.js');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const time = globalThis.YTKBTime;

function fakeStorage(initial = null) {
  let value = initial;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    read() { return value; }
  };
}

function fakeDoc(video, hidden = false) {
  return {
    hidden,
    querySelector(selector) { return selector === 'video.html5-main-video' ? null : video; }
  };
}

function playingVideo() {
  return { paused: false, ended: false, readyState: 4 };
}

const enabled = { enabled: true, reminderMinutes: 0 };

test('normalizes tracking and supported reminder intervals', () => {
  assert.deepEqual(time.normalize({ enabled: true, reminderMinutes: 45 }), { enabled: true, reminderMinutes: 45 });
  assert.deepEqual(time.normalize({ enabled: 1, reminderMinutes: 20 }), { enabled: false, reminderMinutes: 0 });
  assert.deepEqual(time.normalize(), { enabled: false, reminderMinutes: 0 });
});

test('counts only active playback in the visible tab', () => {
  const state = time.createState(null, 1000);
  const doc = fakeDoc(playingVideo());
  assert.equal(time.tick(enabled, doc, state, 1000).activeMs, 0);
  assert.equal(time.tick(enabled, doc, state, 2000).activeMs, 1000);
  assert.equal(time.tick(enabled, fakeDoc(playingVideo(), true), state, 3000).active, false);
  assert.equal(state.activeMs, 1000);
  assert.equal(time.tick(enabled, fakeDoc({ paused: true, ended: false, readyState: 4 }), state, 4000).active, false);
  assert.equal(state.activeMs, 1000);
});

test('does not count paused, ended, or not-yet-ready videos', () => {
  for (const video of [
    { paused: true, ended: false, readyState: 4 },
    { paused: false, ended: true, readyState: 4 },
    { paused: false, ended: false, readyState: 1 }
  ]) {
    assert.equal(time.isWatching(fakeDoc(video)), false);
  }
});

test('caps long timer gaps so background throttling cannot inflate watch time', () => {
  const state = time.createState(null, 0);
  const doc = fakeDoc(playingVideo());
  time.tick(enabled, doc, state, 1000);
  const result = time.tick(enabled, doc, state, 100000);
  assert.equal(result.activeMs, time.MAX_TICK_MS);
});

test('fires a configured reminder once per session', () => {
  const state = time.createState(null, 0);
  state.activeMs = 30 * 60 * 1000 - 1000;
  const doc = fakeDoc(playingVideo());
  state.lastTickAt = 1000;
  state.lastActiveAt = 1000;
  const config = { enabled: true, reminderMinutes: 30 };
  assert.equal(time.tick(config, doc, state, 2000).reminder, true);
  assert.equal(time.tick(config, doc, state, 3000).reminder, false);
});

test('resets the session after 15 minutes without active playback', () => {
  const state = time.createState(null, 0);
  state.activeMs = 50000;
  state.lastActiveAt = 1000;
  const result = time.tick(enabled, fakeDoc({ paused: true, ended: false, readyState: 4 }), state, 1000 + time.IDLE_RESET_MS);
  assert.equal(result.activeMs, 0);
  assert.equal(state.reminded, false);
});

test('persists session totals in tab-scoped storage and restores them', () => {
  const storage = fakeStorage();
  const state = time.createState(storage, 1000);
  state.activeMs = 123456;
  state.lastActiveAt = 5000;
  state.reminded = true;
  time.saveState(storage, state);
  const restored = time.createState(storage, 6000);
  assert.equal(restored.activeMs, 123456);
  assert.equal(restored.reminded, true);
  assert.equal(restored.lastTickAt, null);
});

test('resets stale saved sessions and formats elapsed time', () => {
  const storage = fakeStorage(JSON.stringify({ activeMs: 60000, lastActiveAt: 1000, reminded: true }));
  const state = time.createState(storage, 1000 + time.IDLE_RESET_MS);
  assert.equal(state.activeMs, 0);
  assert.equal(state.reminded, false);
  assert.equal(time.format(3661000), '01:01:01');
});
