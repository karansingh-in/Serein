'use strict';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
}

function buildMatcher(keywords, wholeWord = true) {
  const seen = new Set();
  const parts = [];

  for (const raw of Array.isArray(keywords) ? keywords : []) {
    if (typeof raw !== 'string') continue;
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    const normalized = words.join(' ').toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    parts.push(words.map(escapeRegex).join('\\s+'));
  }

  if (!parts.length) return () => false;

  const body = '(?:' + parts.join('|') + ')';
  const source = wholeWord
    ? '(?<![\\p{L}\\p{N}_])' + body + '(?![\\p{L}\\p{N}_])'
    : body;
  const regex = new RegExp(source, 'iu');
  return (text) => typeof text === 'string' && regex.test(text);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value) {
  const match = typeof value === 'string' ? TIME_RE.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isRecreationTime(recreation, date = new Date()) {
  if (!recreation || !recreation.enabled) return false;

  const start = toMinutes(recreation.start);
  const end = toMinutes(recreation.end);
  if (start === null || end === null || start === end) return false;

  const now = date.getHours() * 60 + date.getMinutes();
  return start < end
    ? now >= start && now < end
    : now >= start || now < end;
}

function recMinutes(recreation) {
  const minutes = new Array(1440).fill(false);
  if (!recreation || !recreation.enabled) return minutes;

  const start = toMinutes(recreation.start);
  const end = toMinutes(recreation.end);
  if (start === null || end === null || start === end) return minutes;

  for (let minute = 0; minute < 1440; minute++) {
    minutes[minute] = start < end
      ? minute >= start && minute < end
      : minute >= start || minute < end;
  }
  return minutes;
}

function matchesIncluded(title, channel, matcher) {
  if (typeof matcher !== 'function') return false;
  return (typeof title === 'string' && matcher(title)) ||
    (typeof channel === 'string' && matcher(channel));
}

function matchesChannel(channel, matcher) {
  return typeof channel === 'string' && typeof matcher === 'function' && matcher(channel);
}


function pageScope(pathname) {
  if (typeof pathname !== 'string') return 'other';
  if (pathname === '/') return 'home';
  if (pathname === '/results') return 'search';
  if (pathname === '/feed/subscriptions') return 'subscriptions';
  if (pathname === '/watch') return 'recommendations';
  return 'other';
}

function shouldFilterCards(pathname, scope = 'all') {
  if (scope === 'all' || !scope) return true;
  return pageScope(pathname) === scope;
}

function normalizeKeyword(keyword) {
  return String(keyword).trim().split(/\s+/).filter(Boolean).join(' ').toLowerCase();
}

function isLoosening(oldSettings, newSettings) {
  const oldValue = oldSettings || {};
  const newValue = newSettings || {};

  const oldKeywords = new Set((oldValue.keywords || []).map(normalizeKeyword).filter(Boolean));
  const newKeywords = new Set((newValue.keywords || []).map(normalizeKeyword).filter(Boolean));

  for (const keyword of oldKeywords) {
    if (!newKeywords.has(keyword)) return true;
  }

  const oldBlockedChannels = new Set((oldValue.blockedChannels || []).map(normalizeKeyword).filter(Boolean));
  const newBlockedChannels = new Set((newValue.blockedChannels || []).map(normalizeKeyword).filter(Boolean));
  for (const channel of oldBlockedChannels) {
    if (!newBlockedChannels.has(channel)) return true;
  }

  if (oldValue.wholeWord === false && newValue.wholeWord !== false &&
    (oldKeywords.size > 0 || oldBlockedChannels.size > 0)) return true;

  const oldIncluded = new Set((oldValue.includeKeywords || []).map(normalizeKeyword).filter(Boolean));
  const newIncluded = new Set((newValue.includeKeywords || []).map(normalizeKeyword).filter(Boolean));
  if (oldIncluded.size > 0 && newIncluded.size === 0) return true;
  if (oldIncluded.size > 0) {
    for (const keyword of newIncluded) {
      if (!oldIncluded.has(keyword)) return true;
    }
  }

  const oldAllowedChannels = new Set((oldValue.allowedChannels || []).map(normalizeKeyword).filter(Boolean));
  const newAllowedChannels = new Set((newValue.allowedChannels || []).map(normalizeKeyword).filter(Boolean));
  if (oldAllowedChannels.size > 0 && newAllowedChannels.size === 0) return true;
  if (oldAllowedChannels.size > 0) {
    for (const channel of newAllowedChannels) {
      if (!oldAllowedChannels.has(channel)) return true;
    }
  }

  if (oldValue.wholeWord !== false && newValue.wholeWord === false &&
    (oldIncluded.size > 0 || oldAllowedChannels.size > 0)) return true;

  const oldFocus = oldValue.focus || {};
  const newFocus = newValue.focus || {};
  for (const key of ['shorts', 'rabbit']) {
    if (oldFocus[key] !== false && newFocus[key] === false) return true;
  }

  if (oldValue.distractionMode && !newValue.distractionMode) return true;

  const oldScope = oldValue.filterScope || 'all';
  const newScope = newValue.filterScope || 'all';
  if (oldScope !== newScope && oldScope !== 'all') return true;

  const oldPlayback = oldValue.playback || {};
  const newPlayback = newValue.playback || {};
  if (oldPlayback.disableAutoplay === true && newPlayback.disableAutoplay !== true) return true;
  if (oldValue.distractionMode && newValue.distractionMode) {
    const oldDistractions = oldValue.distractions || {};
    const newDistractions = newValue.distractions || {};
    for (const key of Object.keys(oldDistractions)) {
      if (oldDistractions[key] !== false && newDistractions[key] === false) return true;
    }
  }

  const oldMinutes = recMinutes(oldValue.recreation);
  const newMinutes = recMinutes(newValue.recreation);
  for (let minute = 0; minute < 1440; minute++) {
    if (newMinutes[minute] && !oldMinutes[minute]) return true;
  }

  return false;
}

function shortsRedirectTarget(pathname, origin) {
  if (typeof pathname !== 'string' || typeof origin !== 'string') return null;
  const match = /^\/shorts(?:\/([A-Za-z0-9_-]+))?\/?$/.exec(pathname);
  if (!match) return null;
  return match[1] ? origin + '/watch?v=' + match[1] : origin + '/';
}

globalThis.YTKBMatcher = { buildMatcher, matchesIncluded, matchesChannel, pageScope, shouldFilterCards, isRecreationTime, isLoosening, shortsRedirectTarget };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildMatcher,
    matchesIncluded,
    matchesChannel,
    pageScope,
    shouldFilterCards,
    isRecreationTime,
    isLoosening,
    shortsRedirectTarget
  };
}
