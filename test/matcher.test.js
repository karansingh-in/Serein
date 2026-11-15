'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMatcher, matchesIncluded, shortsRedirectTarget, isLoosening } = require('../matcher');

test('matches keywords case-insensitively and as whole words', () => {
  const match = buildMatcher(['PW', 'machine learning'], true);
  assert.equal(match('PW tutorial'), true);
  assert.equal(match('machine   learning basics'), true);
  assert.equal(match('powerful tutorial'), false);
});

test('supports partial matching when whole-word mode is disabled', () => {
  assert.equal(buildMatcher(['ai'], false)('maintain'), true);
});

test('include matcher checks title and channel', () => {
  const match = buildMatcher(['PW'], true);
  assert.equal(matchesIncluded('A tutorial', 'PW Skills', match), true);
  assert.equal(matchesIncluded('PW course', 'Other channel', match), true);
  assert.equal(matchesIncluded('Unrelated', 'Other channel', match), false);
});

test('converts Shorts links to regular watch links', () => {
  assert.equal(shortsRedirectTarget('/shorts/abc_123', 'https://www.youtube.com'), 'https://www.youtube.com/watch?v=abc_123');
  assert.equal(shortsRedirectTarget('/watch', 'https://www.youtube.com'), null);
});

test('loosening changes wait, restrictive changes apply immediately', () => {
  assert.equal(isLoosening({ keywords: ['spoilers'] }, { keywords: [] }), true);
  assert.equal(isLoosening({ includeKeywords: ['java'] }, { includeKeywords: ['java', 'python'] }), true);
  assert.equal(isLoosening({ includeKeywords: ['java', 'python'] }, { includeKeywords: ['java'] }), false);
  assert.equal(isLoosening({ focus: { shorts: true } }, { focus: { shorts: false } }), true);
});
