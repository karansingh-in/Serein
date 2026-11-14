'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PRESETS, apply, identify } = require('../presets.js');

function settings() {
  return {
    keywords: ['gaming'],
    wholeWord: true,
    focus: { shorts: false, rabbit: false },
    distractionMode: false,
    distractions: Object.fromEntries(Object.keys(PRESETS.minimal.distractions).map((key) => [key, false])),
    playback: { disableAutoplay: false, defaultSpeed: 1.5 },
    timeAwareness: { enabled: true, reminderMinutes: 45 },
    theme: 'dark',
    recreation: { enabled: true, start: '18:00', end: '20:00' }
  };
}

test('exposes exactly the three supported focus presets', () => {
  assert.deepEqual(Object.keys(PRESETS), ['minimal', 'study', 'deep']);
});

test('presets change only focus, distraction and autoplay settings', () => {
  const original = settings();
  const result = apply('study', original);
  assert.deepEqual(result.keywords, original.keywords);
  assert.equal(result.wholeWord, original.wholeWord);
  assert.deepEqual(result.timeAwareness, original.timeAwareness);
  assert.deepEqual(result.recreation, original.recreation);
  assert.equal(result.theme, original.theme);
  assert.equal(result.playback.defaultSpeed, 1.5);
  assert.equal(result.playback.disableAutoplay, true);
  assert.equal(result.distractionMode, true);
  assert.equal(result.focus.shorts, true);
  assert.equal(result.focus.rabbit, true);
});

test('minimal keeps recommendations and engagement while removing Shorts and promotions', () => {
  const result = apply('minimal', settings());
  assert.equal(result.focus.rabbit, false);
  assert.equal(result.distractions.shortsShelf, true);
  assert.equal(result.distractions.shortsNavigation, true);
  assert.equal(result.distractions.promotions, true);
  assert.equal(result.distractions.comments, false);
  assert.equal(result.distractions.liveChat, false);
  assert.equal(result.distractions.trendingExplore, false);
  assert.equal(result.playback.disableAutoplay, false);
});

test('study hides viewing distractions but leaves create and notifications available', () => {
  const result = apply('study', settings());
  assert.equal(result.distractions.comments, true);
  assert.equal(result.distractions.liveChat, true);
  assert.equal(result.distractions.trendingExplore, true);
  assert.equal(result.distractions.notificationBell, false);
  assert.equal(result.distractions.createButton, false);
  assert.equal(result.playback.disableAutoplay, true);
});

test('deep focus hides every configured distraction', () => {
  const result = apply('deep', settings());
  assert.ok(Object.values(result.distractions).every(Boolean));
  assert.equal(result.focus.rabbit, true);
  assert.equal(result.playback.disableAutoplay, true);
});

test('identifies presets and returns custom after an individual adjustment', () => {
  for (const id of Object.keys(PRESETS)) {
    const applied = apply(id, settings());
    assert.equal(identify(applied), id);
    applied.distractions.comments = !applied.distractions.comments;
    assert.equal(identify(applied), 'custom');
  }
});

test('unknown preset leaves settings unchanged', () => {
  const original = settings();
  assert.equal(apply('unknown', original), original);
});
