'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const source = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const leaf = fs.readFileSync(path.join(root, 'assets', 'serein-leaf.svg'), 'utf8');

test('release manifest preserves Firefox identity and storage-only permission', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Serein');
  assert.equal(manifest.version, '3.0.14');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'ytkb@karansingh-in');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].js, ['matcher.js', 'content.js']);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, manifest.version);
});

test('distraction flag uses the literal string the CSS selectors require', () => {
  // toggleAttribute() writes an empty value, so [data-serein-distractions="true"]
  // would never match and the whole distraction stylesheet would be dead code.
  assert.match(source, /setAttribute\('data-serein-distractions', settings\.distractionMode \? 'true' : 'false'\)/);
  assert.doesNotMatch(source, /toggleAttribute\('data-serein-distractions'/);
  assert.match(source, /html\[data-serein-distractions="true"\]/);
});

test('You shortcut sits immediately left of the filter launcher in the right header cluster', () => {
  assert.match(source, /id = 'serein-header-actions'/);
  assert.match(source, /id = 'serein-you-link'/);
  assert.match(source, /actions\.insertBefore\(you, actions\.firstChild\)/);
  assert.match(source, /you\.style\.setProperty\('display', 'inline-flex', 'important'\)/);
  assert.match(source, /actions\.append\(host\)/);
  assert.match(source, /href = '\/feed\/you'/);
  assert.match(source, /host\.style\.display = inMasthead \? 'block' : 'none'/);
  assert.doesNotMatch(source, /host\.style\.bottom = '20px'/);
});

test('You shortcut contrasts against the YouTube theme', () => {
  assert.match(source, /#serein-you-link \{[^}]*color: #0f0f0f !important/);
  assert.match(source, /html\[dark\] #serein-you-link \{ color: #f1f1f1 !important; \}/);
});

test('Serein brand renders inside the real YouTube home link', () => {
  // The wrapper element shares the id, so the inner <a href="/"> must be targeted or
  // the wordmark stops being clickable.
  assert.match(source, /ytd-masthead #logo a\[href="\/"\], ytd-masthead a#logo/);
  assert.match(source, /\.serein-masthead-brand/);
  assert.match(source, /color:inherit;/);
  assert.doesNotMatch(source, /--yt-spec-text-primary/);
});

test('every placement uses the canonical v3.0.8 leaf', () => {
  const paths = (leaf.match(/d="([^"]+)"/g) || []).map((d) => d.slice(3, -1));
  assert.ok(paths.length >= 3, 'leaf asset should carry three paths');
  for (const p of paths) {
    assert.ok(source.includes(p), `masthead brand must use the canonical leaf path ${p.slice(0, 24)}...`);
  }
});

test('distraction mode hides the guide, original topbar actions and topic-chip row', () => {
  assert.match(source, /tp-yt-app-drawer#guide, ytd-guide-renderer/);
  assert.match(source, /#guide-spacer/);
  assert.match(source, /ytd-masthead #end #buttons/);
  assert.match(source, /ytd-notification-topbar-button-renderer/);
  assert.match(source, /button-renderer="create"/);
  assert.match(source, /#chips-wrapper/);
  assert.match(source, /iron-selector#chips/);
  assert.match(source, /#voice-search-button/);
  assert.doesNotMatch(source, /add\('#search/);
  assert.match(source, /data-serein-ui-hidden/);
});

test('promotional and paid-content labels are hidden by their text', () => {
  assert.match(source, /featured\|₹\|\\brupees\?\\b\|try for\\s\*0/i);
  assert.match(source, /ytd-badge-supported-renderer, ytd-metadata-badge-renderer, yt-badge-shape/);
});

test('the AI button and comment sort control are removed', () => {
  assert.match(source, /yt-icon\[icon-name\*="sparkles" i\]/);
  assert.match(source, /yt-sort-filter-sub-menu-renderer/);
});

test('the search field is centred and the watch page keeps a gutter', () => {
  assert.match(source, /#center, #masthead #center \{[^}]*justify-content: center !important/);
  assert.match(source, /#primary \{ padding-left: 16px !important/);
  // The empty right-hand column collapses only when recommendations are hidden.
  assert.match(source, /const secondary = document\.querySelector\('#secondary'\);/);
  assert.match(source, /if \(secondary\) desired\.add\(secondary\);/);
});

test('homepage reclaims guide width and keeps native thumbnail aspect ratios', () => {
  assert.match(source, /--ytd-guide-width: 0px/);
  assert.match(source, /#contentContainer/);
  assert.match(source, /#page-manager/);
  assert.match(source, /#header,/);
  assert.match(source, /Keep YouTube's native thumbnail ratio and height calculations untouched/);
  assert.doesNotMatch(source, /ytd-thumbnail[^`]*height:\s*\d+px/);
});

test('homepage grid uses three columns with single-line titles', () => {
  assert.match(source, /--ytd-rich-grid-items-per-row: 3 !important/);
  assert.doesNotMatch(source, /--ytd-rich-grid-items-per-row: [45] !important/);
  assert.match(source, /-webkit-line-clamp: 1 !important/);
  assert.match(source, /a\.ytLockupMetadataViewModelTitle/);
});

test('homepage grid keeps YouTube flex layout so cards stay side by side', () => {
  // display:block on the grid or its #contents row collapses the feed into one
  // full-width column instead of a row of cards.
  assert.doesNotMatch(source, /#contents\.ytd-rich-grid-renderer \{ display: block;/);
  assert.doesNotMatch(source, /ytd-rich-grid-renderer,\s*\n\s*html\[data-serein-distractions="true"\] ytd-browse\[page-subtype="home"\] #contents\.ytd-rich-grid-renderer \{ display: block;/);
  assert.doesNotMatch(source, /\{ display: block; box-sizing: border-box !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding-left: 12px/);
});

test('search sizing targets the element YouTube actually renders', () => {
  assert.match(source, /ytd-masthead yt-searchbox/);
  assert.doesNotMatch(source, /#search-form/);
});

test('keyword matching understands current card markup', () => {
  assert.match(source, /a\.ytLockupMetadataViewModelTitle/);
  assert.match(source, /yt-content-metadata-view-model a/);
  // An unreadable card must stay visible rather than count as a non-match.
  assert.match(source, /if \(!title && !channel\) return true;/);
});

test('the chrome sweep runs from the debounced scan, not on every mutation', () => {
  assert.match(source, /observer\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(source, /characterData: true/);
  assert.match(source, /function scan\(\) \{\s*\n\s*\/\/ The chrome sweep is expensive/);
});

test('requested settings and branding remain available', () => {
  assert.match(source, /Disable distractions/);
  assert.match(source, /data-distraction-checklist/);
  assert.match(source, /Recreation time/);
  assert.match(source, /Built by karansingh-in/);
  assert.ok(source.includes('https://github.com/karansingh-in/Serein'));
  assert.match(source, /--accent: #2563eb/);
  assert.match(source, /--bg: #ffffff/);
});

test('the header backdrop shrinks back to the masthead once the chip row is removed', () => {
  // YouTube grows #frosted-glass (.with-chipbar) behind the topic chips. Hiding the chips alone
  // leaves that backdrop as an empty translucent band under the search bar.
  assert.match(source, /html\[data-serein-distractions="true"\] #frosted-glass,\s*\n\s*html\[data-serein-distractions="true"\] #frosted-glass\.with-chipbar \{ height: 56px !important;/);
});

test('watch page reclaims the empty right column only while recommendations are hidden', () => {
  assert.match(source, /setAttribute\('data-serein-wide', wide \? 'true' : 'false'\)/);
  assert.match(source, /const calm = settings\.distractionMode && !isRecreationTime\(\);/);
  assert.match(source, /const wide = calm && settings\.focus\.recommendations;/);
  assert.match(source, /html\[data-serein-wide="true"\] ytd-watch-flexy #below,/);
  assert.match(source, /html\[data-serein-wide="true"\] ytd-watch-flexy ytd-comments \{[^}]*max-width: none !important/);
  assert.match(source, /--ytd-watch-flexy-sidebar-width: 0px !important/);
});

test('the Ask (Gemini) button is matched by label inside the action row', () => {
  assert.match(source, /const ASK_LABEL = \/\^\(ask\|ask ai\|ask gemini\|ask about this video\|ask a question\|gemini\)\$\/i;/);
  assert.match(source, /ytd-watch-metadata button, ytd-watch-metadata a, #actions button, #top-level-buttons-computed button/);
  assert.match(source, /control\.closest\('yt-button-view-model'\)/);
});

test('theater mode is applied once per video and ambient glow is hidden by flag', () => {
  assert.match(source, /function ensureTheaterMode\(\)/);
  assert.match(source, /theaterHandledFor = id;\s*\n\s*button\.click\(\);/);
  assert.match(source, /ytd-watch-flexy \.ytp-size-button/);
  assert.match(source, /html\[data-serein-no-ambient="true"\] #cinematics,/);
  assert.match(source, /theater: legacyFocus\.theater !== false,/);
  assert.match(source, /data-field="theater"/);
  assert.match(source, /data-field="ambient"/);
  assert.match(source, /const BLOCKING_FOCUS = \['shorts', 'recommendations', 'endScreens', 'comments', 'autoplay'\]/);
});
