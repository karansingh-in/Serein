'use strict';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
}

/**
 * buildMatcher(keywords, wholeWord = true) -> (text) => boolean
 * - case-insensitive
 * - blank keywords ignored; empty list matches nothing
 * - regex special chars are literal
 * - whitespace inside a keyword matches any run of whitespace
 * - wholeWord: keyword must not touch a letter/digit/underscore on either side
 */
function buildMatcher(keywords, wholeWord = true) {
  const seen = new Set();
  const parts = [];
  for (const raw of Array.isArray(keywords) ? keywords : []) {
    if (typeof raw !== 'string') continue;
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const norm = words.join(' ').toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    parts.push(words.map(escapeRegex).join('\\s+'));
  }
  if (!parts.length) return () => false;
  const body = '(?:' + parts.join('|') + ')';
  const src = wholeWord
    ? '(?<![\\p{L}\\p{N}_])' + body + '(?![\\p{L}\\p{N}_])'
    : body;
  const re = new RegExp(src, 'iu'); // not global, so .test() is stateless
  return (text) => typeof text === 'string' && re.test(text);
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(t) {
  const m = typeof t === 'string' ? TIME_RE.exec(t) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * isRecreationTime(rec, date) -> boolean
 * rec = { enabled, start: "HH:MM", end: "HH:MM" } (24h, local time)
 * - start < end  : active from start (inclusive) to end (exclusive)
 * - start > end  : overnight window, e.g. 22:00 -> 01:00
 * - start == end or invalid times: never active
 */
function isRecreationTime(rec, date = new Date()) {
  if (!rec || !rec.enabled) return false;
  const s = toMinutes(rec.start);
  const e = toMinutes(rec.end);
  if (s === null || e === null || s === e) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return s < e ? (now >= s && now < e) : (now >= s || now < e);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildMatcher, isRecreationTime };
}
