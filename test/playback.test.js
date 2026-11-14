'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('../playback.js');
const playback = globalThis.YTKBPlayback;

test('normalizes playback preferences and rejects unsupported speeds', () => {
  assert.deepEqual(playback.normalize({ disableAutoplay: true, defaultSpeed: 1.5 }), {
    disableAutoplay: true,
    defaultSpeed: 1.5
  });
  assert.deepEqual(playback.normalize({ disableAutoplay: 'yes', defaultSpeed: 3 }), {
    disableAutoplay: false,
    defaultSpeed: 1
  });
});

test('recognizes autoplay state only when YouTube exposes a clear state', () => {
  const button = (attrs) => ({ getAttribute: (name) => attrs[name] || null });
  assert.equal(playback.autoplayState(button({ 'aria-checked': 'true' })), true);
  assert.equal(playback.autoplayState(button({ 'aria-pressed': 'false' })), false);
  assert.equal(playback.autoplayState(button({ title: 'Autoplay is on' })), true);
  assert.equal(playback.autoplayState(button({ title: 'Autoplay is off' })), false);
  assert.equal(playback.autoplayState(button({ title: 'Autoplay' })), null);
});

test('applies selected speed once per video and speed setting', () => {
  const video = { currentSrc: 'video-a', src: 'video-a', playbackRate: 1, autoplay: true,
    removeAttribute(name) { if (name === 'autoplay') this.removed = true; } };
  const doc = { querySelector: () => video, querySelectorAll: () => [] };
  const state = { lastApplied: null };
  playback.apply({ defaultSpeed: 1.5 }, doc, state, '/watch');
  assert.equal(video.playbackRate, 1.5);
  video.playbackRate = 1.75; // A manual user change should not be overwritten on every scan.
  playback.apply({ defaultSpeed: 1.5 }, doc, state, '/watch');
  assert.equal(video.playbackRate, 1.75);
  playback.apply({ defaultSpeed: 2 }, doc, state, '/watch');
  assert.equal(video.playbackRate, 2);
});

test('applies the selected speed to a newly navigated video', () => {
  const video = { currentSrc: 'video-b', playbackRate: 1 };
  const doc = { querySelector: () => video, querySelectorAll: () => [] };
  const state = { lastApplied: '/watch?v=a|video-a|1.25' };
  playback.apply({ defaultSpeed: 1.25 }, doc, state, '/watch?v=b');
  assert.equal(video.playbackRate, 1.25);
});

test('disables video autoplay and turns off the YouTube autoplay toggle when its state is known', () => {
  let clicks = 0;
  const video = {
    autoplay: true,
    removeAttribute(name) { if (name === 'autoplay') this.removed = true; }
  };
  const button = {
    state: 'true',
    getAttribute(name) { return name === 'aria-checked' ? this.state : null; },
    click() { clicks++; this.state = 'false'; }
  };
  const doc = {
    querySelector: () => video,
    querySelectorAll: (selector) => selector === 'video' ? [video] : [button]
  };
  const state = { lastApplied: null };
  playback.apply({ disableAutoplay: true }, doc, state, '/watch');
  assert.equal(video.autoplay, false);
  assert.equal(video.removed, true);
  assert.equal(clicks, 1);
  playback.apply({ disableAutoplay: true }, doc, state, '/watch');
  assert.equal(clicks, 1);
});

test('does not click an autoplay toggle when its state is ambiguous', () => {
  let clicks = 0;
  const button = { getAttribute: () => null, click: () => clicks++ };
  const doc = { querySelector: () => null, querySelectorAll: () => [button] };
  playback.apply({ disableAutoplay: true }, doc, { lastApplied: null }, '/watch');
  assert.equal(clicks, 0);
});

test('offers only the requested playback speed choices', () => {
  assert.deepEqual(playback.SPEEDS, [1, 1.25, 1.5, 1.75, 2]);
});
