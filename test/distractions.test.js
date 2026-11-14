'use strict';

require('../distractions.js');
const { DEFAULTS, normalize, collect } = globalThis.YTKBDistractions;
const test = require('node:test');
const assert = require('node:assert/strict');

function element(text = 'Explore Create Shorts') {
  return {
    textContent: text,
    getAttribute(name) {
      if (name === 'aria-label') return text;
      return null;
    },
    closest() { return null; },
    querySelector() { return null; }
  };
}

test('all distraction options default to enabled', () => {
  assert.deepEqual(normalize(), { ...DEFAULTS });
  assert.equal(Object.keys(DEFAULTS).length, 12);
});

test('saved false values are preserved and unknown keys are ignored', () => {
  const result = normalize({ comments: false, liveChat: false, madeUp: true });
  assert.equal(result.comments, false);
  assert.equal(result.liveChat, false);
  assert.equal('madeUp' in result, false);
  assert.equal(result.shortsShelf, true);
});

test('collect is a no-op when all individual options are disabled', () => {
  const doc = { querySelectorAll: () => [element()] };
  const config = Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, false]));
  assert.equal(collect(config, doc).size, 0);
});

test('collect safely discovers selected interface elements', () => {
  const candidate = element();
  const doc = {
    querySelectorAll(selector) {
      if (selector.includes('ytd-comments#comments')) return [candidate];
      if (selector.includes('ytd-live-chat-frame')) return [candidate];
      if (selector.includes('ytd-reel-shelf-renderer')) return [candidate];
      if (selector.includes('.ytp-endscreen-content')) return [candidate];
      if (selector.includes('ytd-notification-topbar-button-renderer')) return [candidate];
      if (selector.includes('ytd-merch-shelf-renderer')) return [candidate];
      if (selector.includes('ytd-membership-offer-renderer')) return [candidate];
      if (selector.includes('ytd-brand-video-shelf-renderer')) return [candidate];
      if (selector.includes('ytd-backstage-post-thread-renderer')) return [candidate];
      if (selector.includes('a[href="/feed/trending"]')) return [candidate];
      if (selector.includes('button[aria-label]')) return [candidate];
      if (selector.includes('ytd-guide-entry-renderer a[href^="/shorts"]')) return [candidate];
      return [];
    }
  };
  const result = collect(DEFAULTS, doc);
  assert.equal(result.has(candidate), true);
});

test('collect tolerates missing or failing DOM selectors', () => {
  const doc = { querySelectorAll() { throw new Error('selector unsupported'); } };
  assert.doesNotThrow(() => collect(DEFAULTS, doc));
  assert.equal(collect(DEFAULTS, doc).size, 0);
});
