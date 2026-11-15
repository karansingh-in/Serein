'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('release manifest preserves Firefox identity and storage-only permission', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Serein');
  assert.equal(manifest.version, '3.0.6');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'ytkb@karansingh-in');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].js, ['matcher.js', 'content.js']);
});

test('Serein launcher is mounted in the YouTube masthead beside the relocated You link', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /id = 'serein-header-actions'/);
  assert.match(source, /id = 'serein-you-link'/);
  assert.match(source, /actions\.append\(you\)/);
  assert.match(source, /actions\.append\(host\)/);
  assert.match(source, /href = '\/feed\/you'/);
  assert.match(source, /host\.style\.position = 'static'/);
  assert.doesNotMatch(source, /host\.style\.bottom = '20px'/);
});

test('distraction mode hides guide and topbar clutter while preserving search and mic', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /ytd-guide-renderer, ytd-mini-guide-renderer/);
  assert.match(source, /ytd-masthead #end #buttons/);
  assert.match(source, /ytd-notification-topbar-button-renderer/);
  assert.match(source, /ytd-masthead #avatar-btn/);
  assert.match(source, /ytd-feed-filter-chip-bar-renderer/);
  assert.match(source, /#voice-search-button/);
  assert.match(source, /#search/);
  assert.match(source, /data-serein-ui-hidden/);
});

test('homepage content reclaims the guide width without forcing thumbnail heights', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /#contentContainer/);
  assert.match(source, /#page-manager/);
  assert.match(source, /#primary/);
  assert.match(source, /Do not set fixed thumbnail heights/);
  assert.doesNotMatch(source, /ytd-thumbnail[^`]*height:\\s*\d+px/);
});

test('requested settings and branding remain available', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /Disable distractions/);
  assert.match(source, /data-distraction-checklist/);
  assert.match(source, /Recreation time/);
  assert.match(source, /Built by karansingh-in/);
  assert.ok(source.includes('https://github.com/karansingh-in/Serein'));
  assert.match(source, /--accent: #2563eb/);
  assert.match(source, /--bg: #ffffff/);
});
