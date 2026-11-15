'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMatcher,
  matchesIncluded,
  isRecreationTime,
  isLoosening,
  shortsRedirectTarget
} = require('../matcher.js');

const base = () => ({
  keywords: ['mr beast', 'minecraft'],
  wholeWord: true,
  recreation: { enabled: false, start: '18:00', end: '20:00' },
  focus: { shorts: true, rabbit: true }
});
const withSettings = (patch) => ({ ...base(), ...patch });

test('matcher handles case, whitespace, whole words and literal regex characters', () => {
  const match = buildMatcher(['Mr   Beast', 'minecraft', 'C++', '[test]']);
  assert.equal(match('MR BEAST reacts'), true);
  assert.equal(match('learn mr\tbeast now'), true);
  assert.equal(match('Minecraft guide'), true);
  assert.equal(match('maintain a bike'), false);
  assert.equal(match('C++ tutorial'), true);
  assert.equal(match('[test] video'), true);
  assert.equal(match(''), false);
  assert.equal(buildMatcher([])('anything'), false);
});

test('include matching checks title or channel with the shared matcher rules', () => {
  const match = buildMatcher(['PW', 'machine learning'], true);
  assert.equal(matchesIncluded('Physics Wallah lecture', 'Some Channel', match), false);
  assert.equal(matchesIncluded('PW course overview', 'Some Channel', match), true);
  assert.equal(matchesIncluded('A tutorial', 'PW', match), true);
  assert.equal(matchesIncluded('A tutorial', 'PWNation', match), false);
  assert.equal(matchesIncluded('A MACHINE   LEARNING guide', 'Other', match), true);
  assert.equal(matchesIncluded('PW', 'channel', buildMatcher(['PW channel'], true)), false);
});

test('matcher can disable whole-word matching', () => {
  assert.equal(buildMatcher(['ai'], false)('maintain'), true);
});

test('recreation windows support normal, overnight and invalid ranges', () => {
  const at = (hour, minute) => new Date(2026, 0, 1, hour, minute);
  assert.equal(isRecreationTime({ enabled: true, start: '18:00', end: '20:00' }, at(18, 0)), true);
  assert.equal(isRecreationTime({ enabled: true, start: '18:00', end: '20:00' }, at(20, 0)), false);
  assert.equal(isRecreationTime({ enabled: true, start: '22:00', end: '01:00' }, at(23, 0)), true);
  assert.equal(isRecreationTime({ enabled: true, start: '22:00', end: '01:00' }, at(0, 30)), true);
  assert.equal(isRecreationTime({ enabled: true, start: '22:00', end: '01:00' }, at(12, 0)), false);
  assert.equal(isRecreationTime({ enabled: true, start: '10:00', end: '10:00' }, at(10, 0)), false);
  assert.equal(isRecreationTime({ enabled: true, start: '99:99', end: '10:00' }, at(10, 0)), false);
});

test('adding, reordering and recasing keywords does not count as loosening', () => {
  assert.equal(isLoosening(base(), withSettings({ keywords: ['mr beast', 'minecraft', 'cats'] })), false);
  assert.equal(isLoosening(base(), withSettings({ keywords: ['minecraft', 'mr beast'] })), false);
  assert.equal(isLoosening(base(), withSettings({ keywords: ['MR   Beast', 'MINECRAFT'] })), false);
});

test('removing keywords counts as loosening', () => {
  assert.equal(isLoosening(base(), withSettings({ keywords: ['minecraft'] })), true);
  assert.equal(isLoosening(base(), withSettings({ keywords: [] })), true);
});

test('include-list changes only trigger cooldown when they broaden visibility', () => {
  const oldSettings = withSettings({ includeKeywords: ['PW'] });
  assert.equal(isLoosening(oldSettings, withSettings({ includeKeywords: ['PW', 'Java'] })), true);
  assert.equal(isLoosening(oldSettings, withSettings({ includeKeywords: ['Java'] })), true);
  assert.equal(isLoosening(oldSettings, withSettings({ includeKeywords: [] })), true);
  assert.equal(isLoosening(withSettings({ includeKeywords: [] }), oldSettings), false);
  assert.equal(isLoosening(oldSettings, withSettings({ includeKeywords: ['pw'] })), false);
  assert.equal(isLoosening(oldSettings, withSettings({ includeKeywords: ['PW'] })), false);
});

test('loosening detection handles whole-word and focus switches', () => {
  assert.equal(isLoosening(withSettings({ wholeWord: false }), withSettings({ wholeWord: true })), true);
  assert.equal(isLoosening(withSettings({ wholeWord: true }), withSettings({ wholeWord: false })), false);
  assert.equal(isLoosening(base(), withSettings({ focus: { shorts: false, rabbit: true } })), true);
  assert.equal(isLoosening(base(), withSettings({ focus: { shorts: true, rabbit: false } })), true);
  assert.equal(isLoosening(withSettings({ focus: { shorts: false, rabbit: false } }), base()), false);
});

test('loosening detection compares actual recreation-window coverage', () => {
  const on = (start, end) => withSettings({ recreation: { enabled: true, start, end } });
  assert.equal(isLoosening(base(), on('18:00', '20:00')), true);
  assert.equal(isLoosening(on('18:00', '20:00'), base()), false);
  assert.equal(isLoosening(on('18:00', '20:00'), on('17:00', '20:00')), true);
  assert.equal(isLoosening(on('18:00', '20:00'), on('18:00', '21:00')), true);
  assert.equal(isLoosening(on('18:00', '20:00'), on('18:30', '19:30')), false);
  assert.equal(isLoosening(on('18:00', '20:00'), on('19:00', '21:00')), true);
  assert.equal(isLoosening(on('22:00', '01:00'), on('23:00', '00:30')), false);
  assert.equal(isLoosening(on('22:00', '01:00'), on('22:00', '02:00')), true);
});

test('Shorts redirects only valid Shorts paths', () => {
  const origin = 'https://www.youtube.com';
  assert.equal(shortsRedirectTarget('/shorts/aB3_x-9Z', origin), origin + '/watch?v=aB3_x-9Z');
  assert.equal(shortsRedirectTarget('/shorts/aB3_x-9Z/', origin), origin + '/watch?v=aB3_x-9Z');
  assert.equal(shortsRedirectTarget('/shorts', origin), origin + '/');
  assert.equal(shortsRedirectTarget('/shorts/', origin), origin + '/');
  for (const path of ['/watch', '/', '/@shorts/videos', '/shortsfan', '/shorts/abc/extra']) {
    assert.equal(shortsRedirectTarget(path, origin), null);
  }
  assert.equal(shortsRedirectTarget(undefined, origin), null);
});

test('missing settings are handled safely', () => {
  assert.equal(isLoosening(null, base()), false);
  assert.equal(isLoosening(base(), null), true);
});

test('loosening detection protects distraction settings from instant removal', () => {
  const base = {
    keywords: [], wholeWord: true,
    focus: { shorts: true, rabbit: true },
    recreation: { enabled: false },
    distractionMode: true,
    distractions: { comments: true, liveChat: true }
  };
  assert.equal(isLoosening(base, { ...base, distractionMode: false }), true);
  assert.equal(isLoosening(base, { ...base, distractions: { comments: false, liveChat: true } }), true);
  assert.equal(isLoosening(base, { ...base, distractions: { comments: true, liveChat: true } }), false);
});

test('turning autoplay disabling off counts as loosening', () => {
  const oldSettings = { ...base(), playback: { disableAutoplay: true } };
  const newSettings = { ...base(), playback: { disableAutoplay: false } };
  assert.equal(isLoosening(oldSettings, newSettings), true);
  assert.equal(isLoosening(oldSettings, { ...oldSettings, playback: { disableAutoplay: true } }), false);
});
