/* Small, local-only playback controls for YouTube. */
(() => {
  'use strict';

  const SPEEDS = Object.freeze([1, 1.25, 1.5, 1.75, 2]);

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const speed = Number(source.defaultSpeed);
    return {
      disableAutoplay: source.disableAutoplay === true,
      defaultSpeed: SPEEDS.includes(speed) ? speed : 1
    };
  }

  function queryAll(doc, selector) {
    try { return Array.from(doc.querySelectorAll(selector)); } catch (_) { return []; }
  }

  function autoplayState(button) {
    if (!button) return null;
    for (const name of ['aria-checked', 'aria-pressed']) {
      const value = button.getAttribute && button.getAttribute(name);
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    const label = [
      button.getAttribute && button.getAttribute('aria-label'),
      button.getAttribute && button.getAttribute('title'),
      button.title,
      button.textContent
    ].filter(Boolean).join(' ').toLowerCase();
    if (/autoplay.{0,20}(on|enabled)|turn off autoplay|disable autoplay/.test(label)) return true;
    if (/autoplay.{0,20}(off|disabled)|turn on autoplay|enable autoplay/.test(label)) return false;
    return null;
  }

  function disableAutoplay(doc, state) {
    for (const video of queryAll(doc, 'video')) {
      try {
        video.autoplay = false;
        video.removeAttribute('autoplay');
      } catch (_) { /* Player may be replacing the media element. */ }
    }

    const buttons = queryAll(doc,
      '#movie_player .ytp-autonav-toggle-button, #autoplay-button, button[aria-label*="Autoplay"], button[aria-label*="autoplay"]');
    const recentlyClicked = state && state.autoplayClickedAt && Date.now() - state.autoplayClickedAt < 2000;
    if (recentlyClicked) return;
    for (const button of buttons) {
      if (autoplayState(button) === true && typeof button.click === 'function') {
        button.click();
        if (state) state.autoplayClickedAt = Date.now();
        break;
      }
    }
  }

  function apply(config, doc, state, pageKey) {
    const options = normalize(config);
    if (!doc) return;

    if (options.disableAutoplay) disableAutoplay(doc, state);

    const video = doc.querySelector('video.html5-main-video') || doc.querySelector('video');
    if (!video) return;

    const mediaKey = String(pageKey || '') + '|' + String(video.currentSrc || video.src || '');
    const applyKey = mediaKey + '|' + options.defaultSpeed;
    if (state && state.lastApplied === applyKey) return;

    try {
      video.playbackRate = options.defaultSpeed;
      if (state) state.lastApplied = applyKey;
    } catch (_) {
      // A new media element may not accept a rate until metadata is loaded.
    }
  }

  globalThis.YTKBPlayback = { SPEEDS, normalize, autoplayState, disableAutoplay, apply };
})();
