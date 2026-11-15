'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('release manifest is versioned and targets Firefox without unnecessary permissions', () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.name, 'Serein');
  assert.equal(manifest.version, '2.2.0');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.browser_specific_settings.gecko.id, 'ytkb@karansingh-in');
});

test('every declared content script and icon exists in the release package', () => {
  for (const file of manifest.content_scripts.flatMap((entry) => entry.js)) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing content script: ${file}`);
  }
  for (const file of Object.values(manifest.icons)) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing icon: ${file}`);
  }
});

test('the project remains dependency-free', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.2.0');
  assert.equal(pkg.name, 'serein-youtube-cleaner');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
