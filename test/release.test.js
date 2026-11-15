'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('release manifest preserves Firefox identity and storage-only permission', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Serein');
  assert.equal(manifest.version, '3.0.4');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'ytkb@karansingh-in');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].js, ['matcher.js', 'content.js']);
});

test('distraction mode keeps the bottom-left launcher and Serein brand', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /class="launcher"/);
  assert.match(source, /host\.style\.left = '16px'/);
  assert.match(source, /host\.style\.bottom = '20px'/);
  assert.match(source, /installSereinBrand/);
  assert.match(source, /Serein home/);
  assert.match(source, /s e r e i n/);
  assert.match(source, /M18 75 C25 47 43 27 69 21/);
});

test('distraction mode hides requested YouTube chrome and preserves You/search/mic', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /data-serein-distractions/);
  assert.match(source, /ytd-feed-filter-chip-bar-renderer/);
  assert.match(source, /\/feed\/subscriptions/);
  assert.match(source, /ytd-masthead #end/);
  assert.match(source, /#voice-search-button/);
  assert.match(source, /#search/);
  assert.match(source, /\/feed\/you/);
  assert.match(source, /Gemini/);
  assert.match(source, /\/join/);
  assert.match(source, /data-serein-ui-hidden/);
});

test('requested controls and branding remain available', () => {
  const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  assert.match(source, /Disable distractions/);
  assert.match(source, /data-distraction-checklist/);
  assert.match(source, /Recreation time/);
  assert.match(source, /Built by karansingh-in/);
  assert.match(source, /https:\/\/github\.com\/karansingh-in\/Serein/);
  assert.match(source, /--accent: #2563eb/);
  assert.match(source, /--bg: #ffffff/);
});
