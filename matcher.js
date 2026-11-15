'use strict';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function normalizeKeyword(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).join(' ').toLowerCase();
}

function buildMatcher(keywords, wholeWord = true) {
  const terms = [...new Set((Array.isArray(keywords) ? keywords : [])
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().split(/\s+/).filter(Boolean).join(' '))
    .filter(Boolean))];
  if (!terms.length) return () => false;
  const body = '(?:' + terms.map((term) => term.split(' ').map(escapeRegex).join('\\s+')).join('|') + ')';
  const source = wholeWord ? '(?<![\\p{L}\\p{N}_])' + body + '(?![\\p{L}\\p{N}_])' : body;
  const regex = new RegExp(source, 'iu');
  return (text) => typeof text === 'string' && regex.test(text);
}

function matchesIncluded(title, channel, matcher) {
  return typeof matcher === 'function' &&
    ((typeof title === 'string' && matcher(title)) || (typeof channel === 'string' && matcher(channel)));
}

function shortsRedirectTarget(pathname, origin) {
  if (typeof pathname !== 'string' || typeof origin !== 'string') return null;
  const match = /^\/shorts(?:\/([A-Za-z0-9_-]+))?\/?$/.exec(pathname);
  return match ? (match[1] ? origin + '/watch?v=' + match[1] : origin + '/') : null;
}

function isLoosening(oldSettings, nextSettings) {
  const oldValue = oldSettings || {};
  const next = nextSettings || {};
  const oldBlock = new Set((oldValue.keywords || []).map(normalizeKeyword).filter(Boolean));
  const newBlock = new Set((next.keywords || []).map(normalizeKeyword).filter(Boolean));
  for (const term of oldBlock) if (!newBlock.has(term)) return true;

  const oldAllow = new Set((oldValue.includeKeywords || []).map(normalizeKeyword).filter(Boolean));
  const newAllow = new Set((next.includeKeywords || []).map(normalizeKeyword).filter(Boolean));
  if (oldAllow.size && !newAllow.size) return true;
  if (oldAllow.size) for (const term of newAllow) if (!oldAllow.has(term)) return true;
  if (oldValue.wholeWord !== false && next.wholeWord === false && oldAllow.size) return true;

  const oldFocus = oldValue.focus || {};
  const newFocus = next.focus || {};
  for (const key of ['shorts', 'recommendations', 'endScreens', 'comments', 'autoplay']) {
    if (oldFocus[key] === true && newFocus[key] !== true) return true;
  }
  return false;
}

const api = { buildMatcher, matchesIncluded, shortsRedirectTarget, isLoosening };
globalThis.SereinMatcher = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
