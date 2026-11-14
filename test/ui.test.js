'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../content.js'), 'utf8');

test('settings panel keeps the primary controls visible and groups secondary controls', () => {
  assert.match(source, /label\('Focus mode'\), focusModeSelect, focusModeHint/);
  assert.match(source, /label\('Keywords'\), textarea, hint/);
  for (const group of ['Focus', 'Distractions', 'Playback', 'Time awareness', 'Schedule']) {
    assert.ok(source.includes(`settingsGroup('${group}'`), `missing ${group} settings group`);
  }
});

test('settings panel exposes dialog semantics and Escape-to-close behaviour', () => {
  assert.match(source, /panel\.setAttribute\('role', 'dialog'\)/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /toggle\.setAttribute\('aria-expanded'/);
});
