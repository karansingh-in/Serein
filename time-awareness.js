/* Lightweight active-video timer. State stays in the current tab's sessionStorage. */
(() => {
  'use strict';

  const STORAGE_KEY = 'ytkb_watch_session';
  const IDLE_RESET_MS = 15 * 60 * 1000;
  const MAX_TICK_MS = 1500;
  const REMINDERS = Object.freeze([0, 30, 45, 60, 90]);
  const DEFAULTS = Object.freeze({ enabled: false, reminderMinutes: 0 });

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const reminder = Number(source.reminderMinutes);
    return {
      enabled: source.enabled === true,
      reminderMinutes: REMINDERS.includes(reminder) ? reminder : 0
    };
  }

  function createState(storage, now) {
    const currentTime = Number.isFinite(now) ? now : Date.now();
    let saved = null;
    try { saved = storage && JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    const state = {
      activeMs: Number.isFinite(saved && saved.activeMs) ? Math.max(0, saved.activeMs) : 0,
      lastActiveAt: Number.isFinite(saved && saved.lastActiveAt) ? saved.lastActiveAt : null,
      lastTickAt: null,
      reminded: !!(saved && saved.reminded),
      active: false,
      lastSavedAt: currentTime
    };
    if (state.lastActiveAt !== null && currentTime - state.lastActiveAt >= IDLE_RESET_MS) {
      reset(state);
    }
    return state;
  }

  function reset(state) {
    state.activeMs = 0;
    state.lastActiveAt = null;
    state.lastTickAt = null;
    state.reminded = false;
    state.active = false;
  }

  function saveState(storage, state) {
    try {
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify({
        activeMs: state.activeMs,
        lastActiveAt: state.lastActiveAt,
        reminded: state.reminded
      }));
    } catch (_) { /* Session storage may be unavailable in restricted contexts. */ }
  }

  function isWatching(doc) {
    if (!doc || doc.hidden) return false;
    let video = null;
    try { video = doc.querySelector('video.html5-main-video') || doc.querySelector('video'); } catch (_) {}
    return !!(video && !video.paused && !video.ended && video.readyState >= 2);
  }

  function pause(state, now) {
    state.lastTickAt = null;
    state.active = false;
    state.lastObservedAt = Number.isFinite(now) ? now : Date.now();
  }

  function tick(config, doc, state, now) {
    const options = normalize(config);
    const time = Number.isFinite(now) ? now : Date.now();
    if (!options.enabled) {
      pause(state, time);
      return { active: false, activeMs: state.activeMs, reminder: false };
    }

    const watching = isWatching(doc);
    if (watching) {
      if (state.lastActiveAt !== null && time - state.lastActiveAt >= IDLE_RESET_MS) reset(state);
      if (state.lastTickAt !== null) {
        state.activeMs += Math.max(0, Math.min(MAX_TICK_MS, time - state.lastTickAt));
      }
      state.lastTickAt = time;
      state.lastActiveAt = time;
      state.active = true;
    } else {
      pause(state, time);
      if (state.lastActiveAt !== null && time - state.lastActiveAt >= IDLE_RESET_MS) reset(state);
    }

    let reminder = false;
    const threshold = options.reminderMinutes * 60 * 1000;
    if (watching && threshold > 0 && !state.reminded && state.activeMs >= threshold) {
      state.reminded = true;
      reminder = true;
    }
    return { active: watching, activeMs: state.activeMs, reminder };
  }

  function format(milliseconds) {
    const seconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
  }

  globalThis.YTKBTime = {
    STORAGE_KEY, IDLE_RESET_MS, MAX_TICK_MS, REMINDERS, DEFAULTS,
    normalize, createState, saveState, isWatching, pause, tick, format
  };
})();
