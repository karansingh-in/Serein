'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('release manifest preserves Firefox identity and storage-only permission', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Serein');
  assert.equal(manifest.version, '3.0.0');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'ytkb@karansingh-in');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].js, ['matcher.js', 'content.js']);
});

test('product UI uses the requested wordmark, Filters topbar label and GitHub credit', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /s e r e i n/);
  assert.match(source, />Filters<\/button>/);
  assert.match(source, /Built by karansingh-in/);
  assert.match(source, /https:\/\/github\.com\/karansingh-in\/Serein/);
  assert.match(source, /theme: 'light'/);
  assert.doesNotMatch(source, /Focus mode|Time awareness|Video duration|Hide watched videos|Hide live streams/);
});
