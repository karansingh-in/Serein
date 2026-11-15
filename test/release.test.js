'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('release manifest preserves Firefox identity and storage-only permission', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Serein');
  assert.equal(manifest.version, '3.0.3');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'ytkb@karansingh-in');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].js, ['matcher.js', 'content.js']);
});

test('UI keeps the bottom-left launcher, leaf brand, status lights, and requested controls', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /s e r e i n/);
  assert.match(source, /class="launcher"/);
  assert.match(source, /circle cx="12" cy="12" r="8\.5"/);
  assert.match(source, /host\.style\.left = '16px'/);
  assert.match(source, /host\.style\.bottom = '20px'/);
  assert.doesNotMatch(source, /class=\"close\"/);
  assert.match(source, /data-status-dot/);
  assert.match(source, /brand-lockup/);
  assert.match(source, /installYouTubeCleanup/);
  assert.match(source, /aria-label\^=\"Create\"/);
  assert.match(source, /M8 24\.3 4\.8 27\.5/);
  assert.match(source, /\.dot\.active/);
  assert.match(source, /Disable distractions/);
  assert.match(source, /data-distraction-checklist/);
  assert.match(source, /Recreation time/);
  assert.match(source, /--accent: #2563eb/);
  assert.match(source, /--bg: #ffffff/);
  assert.match(source, /--window-border:/);
  assert.match(source, /fill="#E62117"/);
  assert.match(source, /Built by karansingh-in/);
  assert.match(source, /https:\/\/github\.com\/karansingh-in\/Serein/);
  assert.doesNotMatch(source, /Filters paused by schedule|Optional schedule|Focus mode|Time awareness|Video duration|Hide watched videos|Hide live streams/);
});
