(() => {
  'use strict';

  if (window.__sereinLoaded) return;
  window.__sereinLoaded = true;

  const STORAGE_KEY = 'ytkb_settings'; // Keep the existing key so upgrades retain user settings.
  const HIDDEN_ATTR = 'data-serein-hidden';
  const BLOCKING_FOCUS = ['shorts', 'recommendations', 'endScreens', 'comments', 'autoplay']; // layout options are not filters
  const BRAND_URL = 'https://github.com/karansingh-in/Serein';
  const CARD_SELECTORS = [
    'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-compact-video-renderer',
    'ytd-grid-video-renderer', 'yt-lockup-view-model', 'ytm-shorts-lockup-view-model'
  ].join(',');
  const DEFAULTS = {
    keywords: [],
    includeKeywords: [],
    wholeWord: true,
    distractionMode: true,
    focus: { shorts: true, recommendations: true, endScreens: false, comments: false, autoplay: false, theater: true, ambient: true },
    recreation: { enabled: false, start: '18:00', end: '20:00' },
    theme: 'light'
  };

  const extensionApi = typeof browser !== 'undefined' && browser.storage
    ? browser
    : (typeof chrome !== 'undefined' && chrome.storage ? chrome : null);
  let settings = normalize(null);
  let blockMatcher = SereinMatcher.buildMatcher([], true);
  let includeMatcher = SereinMatcher.buildMatcher([], true);
  const originalStyles = new WeakMap();
  const originalUiStyles = new WeakMap();
  let scanTimer = null;
  let scheduleClock = null;
  let host = null;
  let panel = null;
  let trigger = null;
  let status = null;
  let note = null;

  function parseList(value) {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(value) ? value : []) {
      if (typeof raw !== 'string') continue;
      const item = raw.trim();
      const key = item.toLocaleLowerCase();
      if (item && !seen.has(key)) { seen.add(key); out.push(item); }
    }
    return out;
  }

  function normalize(source) {
    const s = source && typeof source === 'object' ? source : {};
    const legacyFocus = s.focus || {};
    const legacyDistractions = s.distractions || {};
    const legacyPlayback = s.playback || {};
    const focus = {
      shorts: legacyFocus.shorts !== false,
      recommendations: legacyFocus.recommendations !== false && legacyFocus.rabbit !== false,
      endScreens: legacyFocus.endScreens === true || (!!s.distractionMode && legacyDistractions.endScreenRecommendations === true),
      comments: legacyFocus.comments === true || (!!s.distractionMode && legacyDistractions.comments === true),
      autoplay: legacyFocus.autoplay === true || legacyPlayback.disableAutoplay === true,
      // Cosmetic layout options, on unless switched off.
      theater: legacyFocus.theater !== false,
      ambient: legacyFocus.ambient !== false
    };
    // Migrate channel lists into the two title/channel keyword lists.
    const blocked = parseList([...(Array.isArray(s.keywords) ? s.keywords : []), ...(Array.isArray(s.blockedChannels) ? s.blockedChannels : [])]);
    const included = parseList([...(Array.isArray(s.includeKeywords) ? s.includeKeywords : []), ...(Array.isArray(s.allowedChannels) ? s.allowedChannels : [])]);
    const okTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    const rec = s.recreation || {};
    return {
      keywords: blocked,
      includeKeywords: included,
      wholeWord: s.wholeWord !== false,
      distractionMode: typeof s.distractionMode === 'boolean' ? s.distractionMode : true,
      focus,
      recreation: {
        enabled: !!rec.enabled,
        start: okTime(rec.start) ? rec.start : DEFAULTS.recreation.start,
        end: okTime(rec.end) ? rec.end : DEFAULTS.recreation.end
      },
      theme: ['light', 'dark', 'auto'].includes(s.theme) ? s.theme : 'light'
    };
  }

  function loadSettings() {
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => { if (!settled) { settled = true; resolve(normalize(value)); } };
      const fallback = () => {
        try { done(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
        catch (_) { done(null); }
      };
      const timeout = setTimeout(fallback, 1800);
      try {
        if (extensionApi && extensionApi.storage && extensionApi.storage.local) {
          extensionApi.storage.local.get(STORAGE_KEY, (result) => {
            clearTimeout(timeout);
            const error = extensionApi.runtime && extensionApi.runtime.lastError;
            if (error) fallback(); else done(result && result[STORAGE_KEY]);
          });
        } else { clearTimeout(timeout); fallback(); }
      } catch (_) { clearTimeout(timeout); fallback(); }
    });
  }

  function saveSettings() {
    try {
      if (extensionApi && extensionApi.storage && extensionApi.storage.local) {
        extensionApi.storage.local.set({ [STORAGE_KEY]: settings });
        return;
      }
    } catch (_) { /* use local fallback */ }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) { /* storage unavailable */ }
  }

  function applySettings(next) {
    settings = normalize(next);
    blockMatcher = SereinMatcher.buildMatcher(settings.keywords, settings.wholeWord);
    includeMatcher = SereinMatcher.buildMatcher(settings.includeKeywords, settings.wholeWord);
    scheduleScan();
    if (settings.recreation.enabled && !scheduleClock) scheduleClock = setInterval(scheduleScan, 60000);
    if (!settings.recreation.enabled && scheduleClock) { clearInterval(scheduleClock); scheduleClock = null; }
    // The cleanup CSS keys off [data-serein-distractions="true"], so the attribute must
    // hold the literal string "true". toggleAttribute() would write an empty value and
    // the whole distraction-mode stylesheet would never match.
    document.documentElement.setAttribute('data-serein-distractions', settings.distractionMode ? 'true' : 'false');
    installYouTubeCleanup();
    installSereinBrand();
    applyTheme();
  }

  function matchesCard(card) {
    const titleNode = card.querySelector('a.ytLockupMetadataViewModelTitle, #video-title, a#video-title-link, yt-formatted-string#video-title, h3 a[title]');
    const title = titleNode ? (titleNode.getAttribute('title') || titleNode.textContent || '').trim() : '';
    const channelNode = card.querySelector('yt-content-metadata-view-model a, ytd-channel-name a, #channel-name a, .ytd-channel-name a, a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]');
    const channel = channelNode ? (channelNode.getAttribute('title') || channelNode.textContent || '').trim() : '';
    // An unreadable card is not a match; keep it visible instead of hiding it.
    if (!title && !channel) return true;
    const searchable = title + '\n' + channel;
    if (blockMatcher(searchable)) return false;
    if (settings.includeKeywords.length && !SereinMatcher.matchesIncluded(title, channel, includeMatcher)) return false;
    return true;
  }

  function hide(element) {
    if (!element || element.hasAttribute(HIDDEN_ATTR)) return;
    originalStyles.set(element, {
      display: element.style.getPropertyValue('display'),
      priority: element.style.getPropertyPriority('display')
    });
    element.setAttribute(HIDDEN_ATTR, '');
    element.style.setProperty('display', 'none', 'important');
  }

  function show(element) {
    if (!element || !element.hasAttribute(HIDDEN_ATTR)) return;
    element.removeAttribute(HIDDEN_ATTR);
    const previous = originalStyles.get(element);
    if (previous && previous.display) element.style.setProperty('display', previous.display, previous.priority);
    else element.style.removeProperty('display');
    originalStyles.delete(element);
  }

  function collectHidden() {
    const desired = new Set();
    const inRecreation = isRecreationTime();
    if (!inRecreation) {
      if (settings.keywords.length || settings.includeKeywords.length) {
        for (const card of document.querySelectorAll(CARD_SELECTORS)) {
          if (settings.distractionMode && settings.focus.shorts && card.querySelector('a[href^="/shorts/"]')) { desired.add(card); continue; }
          if (!matchesCard(card)) desired.add(card);
        }
      }
      if (settings.distractionMode && settings.focus.shorts) {
        for (const element of document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-shorts, ytm-reel-shelf-renderer')) desired.add(element);
        for (const element of document.querySelectorAll('ytd-rich-section-renderer')) {
          if (element.querySelector('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], a[href^="/shorts"]')) desired.add(element);
        }
        for (const link of document.querySelectorAll('ytd-guide-entry-renderer a[href^="/shorts"], ytd-mini-guide-entry-renderer a[href^="/shorts"], a[href^="/shorts/"]')) {
          const target = link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer') || link.closest('ytd-rich-item-renderer');
          if (target) desired.add(target);
        }
      }
      if (settings.distractionMode && settings.focus.recommendations) {
        for (const element of document.querySelectorAll('ytd-watch-next-secondary-results-renderer')) desired.add(element);
        // The right-hand column keeps its width even when its contents are gone,
        // leaving an empty strip. Collapse it so the video column can use the space.
        const secondary = document.querySelector('#secondary');
        if (secondary) desired.add(secondary);
      }
      if (settings.distractionMode && settings.focus.endScreens) {
        for (const element of document.querySelectorAll('.ytp-endscreen-content, .ytp-ce-element, .ytp-ce-covering-overlay')) desired.add(element);
      }
      if (settings.distractionMode && settings.focus.comments) {
        for (const element of document.querySelectorAll('ytd-comments#comments, #comments')) desired.add(element);
      }
    }
    return desired;
  }

  function isRecreationTime() {
    const r = settings.recreation;
    if (!r.enabled || r.start === r.end) return false;
    const [sh, sm] = r.start.split(':').map(Number);
    const [eh, em] = r.end.split(':').map(Number);
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start < end ? current >= start && current < end : current >= start || current < end;
  }

  // Switch a watch page into theater mode once per video. Doing it once (not on every scan) means
  // leaving theater mode by hand is respected instead of being undone a moment later.
  let theaterHandledFor = null;
  function ensureTheaterMode() {
    const id = new URLSearchParams(location.search).get('v');
    if (!id || theaterHandledFor === id) return;
    const flexy = document.querySelector('ytd-watch-flexy');
    if (!flexy || flexy.hasAttribute('fullscreen')) return;
    if (flexy.hasAttribute('theater')) { theaterHandledFor = id; return; }
    const button = document.querySelector('ytd-watch-flexy .ytp-size-button');
    if (!button || button.disabled || getComputedStyle(button).display === 'none') return; // player not ready yet
    theaterHandledFor = id;
    button.click();
  }

  function scan() {
    // The chrome sweep is expensive, so it runs from here (debounced) rather than on
    // every mutation batch.
    installYouTubeCleanup();
    placeTrigger();
    // Everything below pauses during recreation time, when YouTube should look normal.
    const calm = settings.distractionMode && !isRecreationTime();
    // The watch page may reclaim the empty right column only while recommendations are really hidden.
    const wide = calm && settings.focus.recommendations;
    document.documentElement.setAttribute('data-serein-wide', wide ? 'true' : 'false');
    document.documentElement.setAttribute('data-serein-no-ambient', calm && settings.focus.ambient ? 'true' : 'false');
    if (location.pathname !== '/watch') theaterHandledFor = null;
    else if (calm && settings.focus.theater) ensureTheaterMode();
    const redirect = settings.distractionMode && settings.focus.shorts && SereinMatcher.shortsRedirectTarget(location.pathname, location.origin);
    if (redirect) { location.replace(redirect); return; }
    const desired = collectHidden();
    for (const element of document.querySelectorAll('[' + HIDDEN_ATTR + ']')) if (!desired.has(element)) show(element);
    for (const element of desired) hide(element);
    if (settings.distractionMode && settings.focus.autoplay) {
      const autoplay = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
      if (autoplay) autoplay.click();
    }
    updateStatus();
  }

  function scheduleScan() {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 220);
  }

  function isLoosening(oldSettings, nextSettings) {
    return SereinMatcher.isLoosening(oldSettings, nextSettings);
  }

  function openPanel(open) {
    if (!panel || !trigger) return;
    const shouldOpen = typeof open === 'boolean' ? open : panel.hidden;
    panel.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) {
      positionPanel();
      const first = panel.querySelector('[data-field="block"]');
      if (first) first.focus();
    }
  }

  function positionPanel() {
    if (!panel || panel.hidden) return;
    // Anchor the panel beneath the top-right Serein control.
    panel.style.left = 'auto';
    panel.style.right = '18px';
    panel.style.top = '72px';
    panel.style.bottom = 'auto';
  }

  function applyTheme() {
    if (!host) return;
    const resolved = settings.theme === 'auto'
      ? (document.documentElement.hasAttribute('dark') ? 'dark' : 'light')
      : settings.theme;
    host.dataset.theme = resolved;
    const themeButtons = host.shadowRoot.querySelectorAll('[data-theme]');
    themeButtons.forEach((button) => {
      const active = button.dataset.theme === settings.theme;
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function buildUI() {
    if (document.getElementById('serein-host')) return;
    host = document.createElement('div');
    host.id = 'serein-host';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: light; }
        * { box-sizing: border-box; }
        .launcher { position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); cursor: pointer; box-shadow: 0 4px 18px rgba(20,18,35,.14); transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .launcher:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateY(-1px); }
        .launcher svg { width: 21px; height: 21px; display: block; }
        .launcher-dot { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--surface); }
        .launcher:focus-visible, button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .panel { position: fixed; right: 18px; top: 72px; z-index: 2147483647; width: min(380px, calc(100vw - 24px)); max-height: min(720px, calc(100vh - 100px)); overflow: auto; border: 1px solid var(--window-border); border-radius: 16px; background: var(--bg); color: var(--text); box-shadow: 0 18px 60px rgba(20, 18, 35, .20); }
        .panel[hidden] { display: none; }
        .header { padding: 20px 20px 16px; border-bottom: 1px solid var(--border); }
        .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .brand-lockup { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .brand-mark { width: 23px; height: 23px; display: block; flex: 0 0 23px; }
        .brand { font-size: 17px; font-weight: 550; letter-spacing: .04em; text-transform: lowercase; }
        .tagline { margin-top: 6px; font-size: 12px; color: var(--muted); letter-spacing: .01em; }
        .status { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; font-size: 11px; color: var(--muted); white-space: nowrap; }
        .dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,.12); }
        .dot.active { background: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,.13); }
        .launcher-dot { background: #dc2626; }
        .launcher-dot.active { background: #16a34a; }
        .body { padding: 18px 20px 20px; }
        .section-title { margin: 0 0 10px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
        .field-label { display: block; margin: 14px 0 7px; font-size: 13px; font-weight: 600; }
        textarea { display: block; width: 100%; min-height: 68px; resize: vertical; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); padding: 10px 12px; font: inherit; font-size: 13px; line-height: 1.5; outline: none; }
        textarea::placeholder { color: var(--muted); }
        .hint { margin-top: 6px; font-size: 11px; line-height: 1.45; color: var(--muted); }
        .check-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 42px; border-bottom: 1px solid var(--border); }
        .check-row:last-child { border-bottom: 0; }
        .check-label { font-size: 13px; font-weight: 500; }
        .switch { appearance: none; position: relative; width: 36px; height: 21px; flex: 0 0 36px; border: 0; border-radius: 20px; background: var(--switch-off); cursor: pointer; transition: background .18s ease; }
        .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: transform .18s ease; }
        .switch:checked { background: var(--accent); }
        .switch:checked::after { transform: translateX(15px); }
        .section { padding-top: 19px; margin-top: 18px; border-top: 1px solid var(--border); }
        .theme-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .theme-button { min-height: 32px; border: 1px solid var(--border); border-radius: 5px; background: transparent; color: var(--muted); font-size: 12px; cursor: pointer; }
        .theme-button[aria-pressed="true"] { color: var(--accent-text); background: var(--accent-soft); border-color: var(--accent); font-weight: 650; }
        .distraction-checklist { display: none; padding-left: 12px; border-left: 2px solid var(--border); margin: 6px 0 0 2px; }
        .distraction-checklist.visible { display: block; }
        .schedule { display: none; margin-top: 12px; }
        .schedule.visible { display: block; }
        .time-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
        .time-row input { min-width: 0; flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 7px; color: var(--text); background: var(--surface); }
        .actions { display: flex; gap: 8px; margin-top: 18px; }
        .save { flex: 1; min-height: 38px; border: 0; border-radius: 5px; background: var(--accent); color: white; font-size: 13px; font-weight: 650; cursor: pointer; }
        .save:disabled { opacity: .6; cursor: wait; }
        .cancel { min-height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: 5px; background: transparent; color: var(--text); font-size: 12px; cursor: pointer; }
        .note { min-height: 16px; margin-top: 9px; color: var(--muted); font-size: 11px; }
        .footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 13px 20px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }
        .footer a { color: inherit; text-decoration: none; border-bottom: 1px solid var(--border); }
        .footer a:hover { color: var(--text); }
        :host([data-theme="light"]) { --bg: #ffffff; --surface: #f7f7fa; --text: #24232b; --muted: #777582; --border: #e8e7ee; --window-border: #dfe2e8; --accent: #2563eb; --accent-soft: #edf3ff; --accent-text: #1d4ed8; --switch-off: #c9cbd2; color-scheme: light; }
        :host([data-theme="dark"]) { --bg: #14161b; --surface: #1d2028; --text: #f3f5f8; --muted: #a0a5af; --border: #303641; --window-border: #454b56; --accent: #60a5fa; --accent-soft: #1e2c43; --accent-text: #bfdbfe; --switch-off: #4b515c; color-scheme: dark; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
      </style>
      <button class="launcher" type="button" aria-expanded="false" aria-label="Open Serein filters" title="Serein">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M6 18 18 6"></path></svg>
        <span class="launcher-dot" aria-hidden="true"></span>
      </button>
      <section class="panel" role="dialog" aria-label="Serein filters" hidden>
        <header class="header">
          <div class="brand-row">
            <div class="brand-lockup"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff"/><path d="M4.25 19.75 C6.25 14.25 9.5 9 14.5 6.5 C19.25 4 24.25 5.5 27.75 7.75 C26.25 13 23.5 18.25 19.25 22 C15.25 25.5 10.5 26.75 7.25 24.5 C4.75 22.75 3.5 21.5 4.25 19.75Z" fill="#E62117"/><path d="M5 22.75 C8.5 20 11.25 17.25 14 14.5 C17.75 10.75 21.75 8.25 26.25 7" fill="none" stroke="#fff" stroke-width="0.85" stroke-linecap="round"/><path d="M5 22.75 C3.75 25.25 2.75 27.75 1.75 30.5" fill="none" stroke="#E62117" stroke-width="1.05" stroke-linecap="round"/></svg><div class="brand">s e r e i n</div></div>
            <div class="status"><span class="dot" data-status-dot></span><span data-status>Filters active</span></div>
          </div>
          <div class="tagline">Keep what matters. Remove the noise.</div>
        </header>
        <div class="body">
          <p class="section-title">Content filtering</p>
          <label class="field-label" for="serein-block">Block keywords</label>
          <textarea id="serein-block" data-field="block" placeholder="e.g. spoilers, celebrity gossip"></textarea>
          <div class="hint">Hide videos when the title or channel name matches any term.</div>
          <label class="field-label" for="serein-include">Only show matching</label>
          <textarea id="serein-include" data-field="include" placeholder="e.g. PW, Java, machine learning"></textarea>
          <div class="hint">When used, only matching titles or channels remain visible. Blocked terms always take priority.</div>
          <div class="check-row" style="margin-top:10px;border:0"><span class="check-label">Match whole words only</span><input class="switch" type="checkbox" data-field="whole"></div>
          <div class="section">
            <p class="section-title">Distraction controls</p>
            <div class="check-row"><span class="check-label">Disable distractions</span><input class="switch" type="checkbox" data-field="distractionMode"></div>
            <div class="distraction-checklist" data-distraction-checklist>
            <div class="check-row"><span class="check-label">Hide Shorts</span><input class="switch" type="checkbox" data-field="shorts"></div>
            <div class="check-row"><span class="check-label">Hide recommendations</span><input class="switch" type="checkbox" data-field="recommendations"></div>
            <div class="check-row"><span class="check-label">Hide end-screen suggestions</span><input class="switch" type="checkbox" data-field="endScreens"></div>
            <div class="check-row"><span class="check-label">Hide comments</span><input class="switch" type="checkbox" data-field="comments"></div>
            <div class="check-row"><span class="check-label">Disable autoplay</span><input class="switch" type="checkbox" data-field="autoplay"></div>
            <div class="check-row"><span class="check-label">Open videos in theater mode</span><input class="switch" type="checkbox" data-field="theater"></div>
            <div class="check-row"><span class="check-label">Turn off ambient glow</span><input class="switch" type="checkbox" data-field="ambient"></div>
            </div>
          </div>
          <div class="section">
            <p class="section-title">Appearance</p>
            <div class="theme-row"><button class="theme-button" data-theme="light" type="button">Light</button><button class="theme-button" data-theme="dark" type="button">Dark</button><button class="theme-button" data-theme="auto" type="button">Auto</button></div>
          </div>
          <details class="section" data-schedule-details>
            <summary class="section-title" style="cursor:pointer">Recreation time</summary>
            <div class="check-row"><span class="check-label">Pause filters during recreation time</span><input class="switch" type="checkbox" data-field="scheduleEnabled"></div>
            <div class="schedule" data-schedule>
              <div class="time-row"><input type="time" data-field="scheduleStart" aria-label="Schedule start"><span>to</span><input type="time" data-field="scheduleEnd" aria-label="Schedule end"></div>
            </div>
          </details>
          <div class="actions"><button class="save" type="button">Save changes</button><button class="cancel" type="button" hidden>Cancel</button></div>
          <div class="note" aria-live="polite"></div>
        </div>
        <footer class="footer"><a href="${BRAND_URL}" target="_blank" rel="noopener noreferrer">Built by karansingh-in</a><span>v3.0.14</span></footer>
      </section>`;
    shadow.querySelector('.launcher').addEventListener('click', () => openPanel());
    trigger = shadow.querySelector('.launcher');
    panel = shadow.querySelector('.panel');
    status = shadow.querySelector('[data-status]');
    note = shadow.querySelector('.note');
    shadow.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => {
      settings.theme = button.dataset.theme;
      saveSettings();
      applyTheme();
    }));
    const distractionToggle = shadow.querySelector('[data-field="distractionMode"]');
    distractionToggle.addEventListener('change', () => shadow.querySelector('[data-distraction-checklist]').classList.toggle('visible', distractionToggle.checked));
    const scheduleToggle = shadow.querySelector('[data-field="scheduleEnabled"]');
    scheduleToggle.addEventListener('change', () => shadow.querySelector('[data-schedule]').classList.toggle('visible', scheduleToggle.checked));
    shadow.querySelector('.save').addEventListener('click', saveFromUI);
    shadow.querySelector('.cancel').addEventListener('click', () => { clearPending(); fillUI(); setNote('Change cancelled.'); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) openPanel(false); });
    document.addEventListener('pointerdown', (event) => {
      if (panel.hidden || host.contains(event.target) || event.composedPath().includes(host)) return;
      openPanel(false);
    });
    shadow.querySelectorAll('[data-field]').forEach((field) => field.addEventListener('input', () => {
      if (field.dataset.field === 'scheduleEnabled') shadow.querySelector('[data-schedule]').classList.toggle('visible', field.checked);
      if (field.dataset.field === 'distractionMode') shadow.querySelector('[data-distraction-checklist]').classList.toggle('visible', field.checked);
    }));
    host.style.display = 'none';
    (document.body || document.documentElement).append(host);
    installYouTubeCleanup();
    installSereinBrand();
    fillUI();
    applyTheme();
    placeTrigger();
  }

  let pendingChange = null;
  let pendingTimer = null;
  function setNote(message) { if (note) note.textContent = message || ''; }

  function currentFromUI() {
    const root = host.shadowRoot;
    const field = (name) => root.querySelector('[data-field="' + name + '"]');
    const list = (name) => parseList(field(name).value.split(/[\n,]/));
    return normalize({
      keywords: list('block'), includeKeywords: list('include'), wholeWord: field('whole').checked,
      distractionMode: field('distractionMode').checked,
      focus: {
        shorts: field('shorts').checked,
        recommendations: field('recommendations').checked,
        endScreens: field('endScreens').checked,
        comments: field('comments').checked,
        autoplay: field('autoplay').checked,
        theater: field('theater').checked,
        ambient: field('ambient').checked
      },
      recreation: {
        enabled: field('scheduleEnabled').checked,
        start: field('scheduleStart').value || DEFAULTS.recreation.start,
        end: field('scheduleEnd').value || DEFAULTS.recreation.end
      },
      theme: settings.theme
    });
  }

  function fillUI() {
    if (!host) return;
    const root = host.shadowRoot;
    const set = (name, value) => { root.querySelector('[data-field="' + name + '"]').value = value; };
    const check = (name, value) => { root.querySelector('[data-field="' + name + '"]').checked = !!value; };
    set('block', settings.keywords.join('\n'));
    set('include', settings.includeKeywords.join('\n'));
    check('whole', settings.wholeWord);
    check('distractionMode', settings.distractionMode);
    root.querySelector('[data-distraction-checklist]').classList.toggle('visible', settings.distractionMode);
    for (const key of ['shorts', 'recommendations', 'endScreens', 'comments', 'autoplay', 'theater', 'ambient']) check(key, settings.focus[key]);
    check('scheduleEnabled', settings.recreation.enabled);
    set('scheduleStart', settings.recreation.start);
    set('scheduleEnd', settings.recreation.end);
    root.querySelector('[data-schedule]').classList.toggle('visible', settings.recreation.enabled);
    root.querySelectorAll('[data-theme]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === settings.theme)));
  }

  function updateStatus() {
    if (!status || !host) return;
    const recreation = isRecreationTime();
    const distractionsOn = settings.distractionMode && BLOCKING_FOCUS.some((key) => settings.focus[key]);
    const active = !recreation && (settings.keywords.length > 0 || settings.includeKeywords.length > 0 || distractionsOn);
    status.textContent = recreation ? 'Recreation time — filters paused' : (active ? 'Filters active' : 'Filters off');
    const dot = host.shadowRoot.querySelector('[data-status-dot]');
    const launcherDot = host.shadowRoot.querySelector('.launcher-dot');
    if (dot) dot.classList.toggle('active', active);
    if (launcherDot) launcherDot.classList.toggle('active', active);
  }

  function clearPending() {
    if (pendingTimer) clearInterval(pendingTimer);
    pendingTimer = null;
    pendingChange = null;
    const root = host.shadowRoot;
    root.querySelector('.save').textContent = 'Save changes';
    root.querySelector('.save').disabled = false;
    root.querySelector('.cancel').hidden = true;
  }

  function commit(next) {
    settings = normalize(next);
    saveSettings();
    applySettings(settings);
    fillUI();
    setNote('Saved.');
  }

  function saveFromUI() {
    if (pendingChange) return;
    const next = currentFromUI();
    if (!isLoosening(settings, next)) { commit(next); return; }
    pendingChange = { next, endsAt: Date.now() + 60000 };
    const root = host.shadowRoot;
    const saveButton = root.querySelector('.save');
    const cancelButton = root.querySelector('.cancel');
    cancelButton.hidden = false;
    saveButton.disabled = true;
    setNote('This change allows more content through. It will apply in 60 seconds.');
    const tick = () => {
      if (!pendingChange) return;
      const remaining = Math.max(0, Math.ceil((pendingChange.endsAt - Date.now()) / 1000));
      saveButton.textContent = remaining ? 'Applying in ' + remaining + 's' : 'Applying…';
      if (!remaining) {
        const pending = pendingChange.next;
        clearPending();
        commit(pending);
      }
    };
    pendingTimer = setInterval(tick, 250);
    tick();
  }

  function setUiHidden(element, shouldHide) {
    if (!element) return;
    if (shouldHide) {
      if (!element.hasAttribute('data-serein-ui-hidden')) {
        originalUiStyles.set(element, {
          display: element.style.getPropertyValue('display'),
          priority: element.style.getPropertyPriority('display')
        });
      }
      element.setAttribute('data-serein-ui-hidden', '');
      // Inline !important is intentional: YouTube frequently applies display rules
      // after its Polymer components are upgraded, which can beat a stylesheet rule.
      element.style.setProperty('display', 'none', 'important');
      return;
    }
    if (!element.hasAttribute('data-serein-ui-hidden')) return;
    element.removeAttribute('data-serein-ui-hidden');
    const previous = originalUiStyles.get(element);
    if (previous && previous.display) element.style.setProperty('display', previous.display, previous.priority);
    else element.style.removeProperty('display');
    originalUiStyles.delete(element);
  }

  function collectYouTubeChromeToHide() {
    const desired = new Set();
    const add = (selector, scope = document) => {
      try { scope.querySelectorAll(selector).forEach((element) => desired.add(element)); } catch (_) { /* YouTube DOM varies */ }
    };

    // Keep one consistent You shortcut in the masthead; hide the duplicate guide entry.
    for (const entry of document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')) {
      const anchor = entry.querySelector('a[href]');
      const href = anchor ? (anchor.getAttribute('href') || '') : '';
      const label = (anchor?.getAttribute('aria-label') || anchor?.textContent || entry.textContent || '').replace(/\s+/g, ' ').trim();
      if (href === '/feed/you' || href === '/you' || /^you$/i.test(label)) desired.add(entry);
    }

    if (!settings.distractionMode) return desired;

    // Remove the complete desktop guide/drawer, including its reserved layout column.
    add('tp-yt-app-drawer#guide, ytd-guide-renderer, ytd-mini-guide-renderer, #guide-wrapper, #guide-content, ytd-app #guide');
    add('ytd-masthead #guide-button, #masthead #guide-button');

    // Hide the original right-side action cluster. Serein's control is mounted as a
    // sibling of this cluster, so it remains visible.
    add('ytd-masthead #end #buttons, ytd-masthead #avatar-btn, ytd-notification-topbar-button-renderer');
    add('ytd-masthead ytd-topbar-menu-button-renderer[button-renderer="create"], ytd-masthead ytd-topbar-menu-button-renderer[aria-label*="Create" i]');
    for (const control of document.querySelectorAll('ytd-masthead ytd-topbar-menu-button-renderer, ytd-masthead ytd-button-renderer, ytd-masthead yt-button-shape')) {
      const label = [control.getAttribute('aria-label'), control.getAttribute('title'), control.textContent]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (/^(create|notifications?|account|profile)(\b|$)/i.test(label)) desired.add(control);
    }

    // Remove the topic-chip row AND its wrapper; hiding only the chips leaves an empty strip.
    add('ytd-feed-filter-chip-bar-renderer, ytd-browse[page-subtype="home"] #chips-wrapper, ytd-browse[page-subtype="home"] #chips, ytd-rich-grid-renderer #chips, yt-chip-cloud-renderer, ytd-chip-cloud-renderer, ytd-browse[page-subtype="home"] iron-selector#chips, ytd-browse[page-subtype="home"] #chip-bar');

    // Join controls beside Subscribe.
    for (const anchor of document.querySelectorAll('a[href*="/join"]')) {
      const button = anchor.closest('ytd-button-renderer, yt-button-shape, #sponsor-button, tp-yt-paper-button') || anchor;
      desired.add(button);
    }

    // Gemini and the newer AI/sparkle button. The sparkle control has no text, so it is
    // matched by its icon name.
    for (const element of document.querySelectorAll('[aria-label*="Gemini" i], [title*="Gemini" i], button, yt-button-shape, ytd-button-renderer, yt-icon[icon-name*="sparkles" i], yt-icon[id*="sparkles" i]')) {
      const label = [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const isSparkle = element.tagName === 'YT-ICON' && /sparkle/i.test(element.getAttribute('icon-name') || element.id || '');
      if (!isSparkle && !/^(ask\s+)?gemini$/i.test(label)) continue;
      desired.add(element.closest('yt-button-shape, ytd-button-renderer, button') || element);
    }

    // The "Ask" (Gemini) button in the watch-page action row. Newer markup gives its icon no
    // name, so match the accessible label, title or visible text instead. Scoped to the action
    // row so an unrelated control that happens to say "Ask" elsewhere is never touched.
    const ASK_LABEL = /^(ask|ask ai|ask gemini|ask about this video|ask a question|gemini)$/i;
    for (const control of document.querySelectorAll('ytd-watch-metadata button, ytd-watch-metadata a, #actions button, #top-level-buttons-computed button')) {
      const labels = [control.getAttribute('aria-label'), control.getAttribute('title'), control.textContent]
        .map((value) => (value || '').replace(/\s+/g, ' ').trim());
      if (!labels.some((label) => ASK_LABEL.test(label))) continue;
      desired.add(control.closest('yt-button-view-model') || control.closest('ytd-button-renderer') || control.closest('button-view-model') || control);
    }

    // The comment sort control next to the comment count.
    for (const sort of document.querySelectorAll('yt-sort-filter-sub-menu-renderer, #sort-menu yt-sort-filter-sub-menu-renderer')) {
      desired.add(sort);
    }

    // Promotional and paid-content labels ("Featured", "₹0", "try for 0 rupees"). The
    // wording is region- and account-dependent, so match the text rather than the class.
    for (const badge of document.querySelectorAll('ytd-badge-supported-renderer, ytd-metadata-badge-renderer, yt-badge-shape, ytd-thumbnail-overlay-badge-view-model')) {
      const text = (badge.textContent || '').replace(/\s+/g, ' ').trim();
      if (/featured|₹|\brupees?\b|try for\s*0/i.test(text)) desired.add(badge);
    }
    return desired;
  }

  function installYouTubeCleanup() {
    let style = document.getElementById('serein-youtube-cleanup');
    if (!style) {
      style = document.createElement('style');
      style.id = 'serein-youtube-cleanup';
      (document.head || document.documentElement).append(style);
    }
    const cleanupCss = `
      [data-serein-ui-hidden] { display: none !important; }
      /* Centre the search field in the masthead. */
      ytd-masthead #center, #masthead #center { min-width: 0 !important; flex: 0 1 732px !important; justify-content: center !important; margin-left: 0 !important; }
      ytd-masthead yt-searchbox, #masthead yt-searchbox { min-width: 0 !important; max-width: 640px !important; flex: 0 1 640px !important; margin-left: 0 !important; }
      ytd-masthead #voice-search-button, #masthead #voice-search-button { flex: 0 0 auto !important; margin-left: 10px !important; }
      #serein-you-link { display: inline-flex !important; visibility: visible !important; opacity: 1 !important; align-items: center; justify-content: center; gap: 5px; height: 40px; min-width: 58px; margin: 0 8px 0 0; padding: 0 10px; border-radius: 20px; color: #0f0f0f !important; text-decoration: none; font: 500 12px Roboto, Arial, sans-serif; white-space: nowrap; flex: 0 0 auto !important; position: relative; z-index: 2; }
      html[dark] #serein-you-link { color: #f1f1f1 !important; }
      #serein-you-link:hover { background: var(--yt-spec-badge-chip-background, rgba(128,128,128,.18)); }
      #serein-you-link svg { width: 21px; height: 21px; flex: 0 0 21px; }
      #serein-header-actions { display: inline-flex !important; align-items: center; justify-content: center; gap: 2px; flex: 0 0 auto; height: 40px; margin: 0 18px 0 8px; }
      #serein-host { display: block !important; position: static !important; width: 40px !important; height: 40px !important; margin: 0 !important; flex: 0 0 40px !important; }
      #serein-host .launcher { position: relative !important; inset: auto !important; width: 40px !important; height: 40px !important; border-radius: 50% !important; box-shadow: none !important; }
      #serein-host .panel { position: fixed !important; left: auto !important; right: 18px !important; top: 72px !important; bottom: auto !important; }

      /* YouTube draws a frosted-glass backdrop behind the masthead and, on the home page, grows it
         (.with-chipbar) to sit behind the topic chips. Serein removes the chips, so shrink the
         backdrop back to the masthead height or an empty translucent band is left under the search bar. */
      html[data-serein-distractions="true"] #frosted-glass,
      html[data-serein-distractions="true"] #frosted-glass.with-chipbar { height: 56px !important; min-height: 0 !important; }

      /* Remove the guide AND its spacer column. The content container must reclaim the full viewport. */
      html[data-serein-distractions="true"] ytd-app { --ytd-guide-width: 0px !important; --ytd-mini-guide-width: 0px !important; }
      html[data-serein-distractions="true"] ytd-app #guide-spacer,
      html[data-serein-distractions="true"] ytd-app #guide-wrapper,
      html[data-serein-distractions="true"] ytd-app #guide-content,
      html[data-serein-distractions="true"] ytd-app tp-yt-app-drawer#guide,
      html[data-serein-distractions="true"] ytd-app ytd-guide-renderer,
      html[data-serein-distractions="true"] ytd-app ytd-mini-guide-renderer { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; }
      html[data-serein-distractions="true"] ytd-app #contentContainer,
      html[data-serein-distractions="true"] ytd-app #page-manager,
      html[data-serein-distractions="true"] ytd-app #columns,
      html[data-serein-distractions="true"] ytd-app #primary,
      html[data-serein-distractions="true"] ytd-app[guide-persistent-and-visible] #contentContainer,
      html[data-serein-distractions="true"] ytd-app[guide-persistent-and-visible] #page-manager { box-sizing: border-box !important; margin-left: 0 !important; padding-left: 0 !important; left: 0 !important; width: 100% !important; max-width: none !important; }
      /* On the watch page the video column keeps a comfortable gutter instead of
         running into the screen edge. */
      html[data-serein-distractions="true"] ytd-app #primary { padding-left: 16px !important; padding-right: 16px !important; }
      /* Ambient mode: the coloured glow YouTube bleeds around the player. */
      html[data-serein-no-ambient="true"] #cinematics,
      html[data-serein-no-ambient="true"] #cinematics-container { display: none !important; }
      /* Watch page: with recommendations hidden the right column is empty, so let the title row,
         description and comments use the full width instead of stopping where the column began. */
      html[data-serein-wide="true"] ytd-watch-flexy { --ytd-watch-flexy-sidebar-width: 0px !important; --ytd-watch-flexy-sidebar-min-width: 0px !important; }
      html[data-serein-wide="true"] ytd-watch-flexy #secondary,
      html[data-serein-wide="true"] ytd-watch-flexy #secondary-inner { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; margin: 0 !important; padding: 0 !important; }
      html[data-serein-wide="true"] ytd-watch-flexy #columns,
      html[data-serein-wide="true"] ytd-watch-flexy #primary,
      html[data-serein-wide="true"] ytd-watch-flexy #primary-inner,
      html[data-serein-wide="true"] ytd-watch-flexy #below,
      html[data-serein-wide="true"] ytd-watch-flexy ytd-watch-metadata,
      html[data-serein-wide="true"] ytd-watch-flexy ytd-comments { box-sizing: border-box !important; width: 100% !important; min-width: 0 !important; max-width: none !important; }
      /* The home header is only the topic-chip strip on this view; collapse the whole band. */
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] #header,
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] #chips-wrapper,
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer { display: none !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; }
      /* Widen the feed into the reclaimed sidebar space. The grid and its #contents row
         must keep YouTube's flex layout - forcing display:block collapses the row into a
         single column of full-width cards. */
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"],
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] #primary,
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer { box-sizing: border-box !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding-left: 12px !important; padding-right: 12px !important; }
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: 3 !important; --ytd-rich-grid-posts-per-row: 3 !important; }
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-row,
      html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] #contents { width: 100% !important; max-width: none !important; }
      /* Keep YouTube's native thumbnail ratio and height calculations untouched. */
      /* One title line keeps the grid calm; the ellipsis stays. */
      html[data-serein-distractions="true"] a.ytLockupMetadataViewModelTitle,
      html[data-serein-distractions="true"] yt-formatted-string#video-title,
      html[data-serein-distractions="true"] a#video-title { -webkit-line-clamp: 1 !important; }
      @media (max-width: 1500px) { html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: 3 !important; --ytd-rich-grid-posts-per-row: 3 !important; } }
      @media (max-width: 1050px) { html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: 2 !important; --ytd-rich-grid-posts-per-row: 2 !important; } }
      @media (max-width: 720px) { html[data-serein-distractions="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { --ytd-rich-grid-items-per-row: 1 !important; --ytd-rich-grid-posts-per-row: 1 !important; } }
    `;
    if (style.textContent !== cleanupCss) style.textContent = cleanupCss;

    const desired = collectYouTubeChromeToHide();
    document.querySelectorAll('[data-serein-ui-hidden]').forEach((element) => {
      if (!desired.has(element)) setUiHidden(element, false);
    });
    desired.forEach((element) => setUiHidden(element, true));
    ensureHeaderActions();
  }

  function ensureHeaderActions() {
    const end = document.querySelector('ytd-masthead #end, #masthead #end');
    if (!end) return;

    // Put You immediately to the left of the Serein filter control in the right cluster.
    let you = document.getElementById('serein-you-link');
    if (!you) {
      you = document.createElement('a');
      you.id = 'serein-you-link';
      you.href = '/feed/you';
      you.setAttribute('aria-label', 'You');
      you.title = 'You';
      you.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.2 20c.7-3.4 3.1-5.3 6.8-5.3s6.1 1.9 6.8 5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>You</span>';
    }
    let actions = document.getElementById('serein-header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'serein-header-actions';
    }
    if (actions.parentElement !== end) end.append(actions);
    if (you.parentElement !== actions) actions.insertBefore(you, actions.firstChild);
    if (host && host.parentElement !== actions) actions.append(host);
    you.style.setProperty('display', 'inline-flex', 'important');
    you.style.setProperty('visibility', 'visible', 'important');
  }

  function installSereinBrand() {
    // The clickable element is the inner <a href="/">; the wrapper element carries the
    // same id, so it must be selected explicitly or the brand stops being a link.
    const logo = document.querySelector('ytd-masthead #logo a[href="/"], ytd-masthead a#logo');
    if (!logo || logo.querySelector('.serein-masthead-brand')) return;
    logo.setAttribute('aria-label', 'Serein home');
    logo.setAttribute('title', 'Serein — Home');
    logo.innerHTML = `
      <span class="serein-masthead-brand" style="display:inline-flex;align-items:center;gap:9px;white-space:nowrap;height:40px;color:inherit;font-family:Inter,Arial,sans-serif;font-size:19px;font-weight:550;letter-spacing:.12em;text-transform:lowercase">
        <svg width="27" height="27" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
          <path d="M17 79 C25 57 38 36 58 26 C77 16 97 22 111 31 C105 52 94 73 77 88 C61 102 42 107 29 98 C19 91 14 86 17 79Z" fill="#E62117"/>
          <path d="M20 91 C34 80 45 69 56 58 C71 43 87 33 105 28" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
          <path d="M20 91 C15 101 11 111 7 122" fill="none" stroke="#E62117" stroke-width="4.2" stroke-linecap="round"/>
        </svg>
        <span>s e r e i n</span>
      </span>`;
  }

  function placeTrigger() {
    if (!host) return;
    host.style.position = 'static';
    host.style.left = 'auto';
    host.style.right = 'auto';
    host.style.top = 'auto';
    host.style.bottom = 'auto';
    host.style.width = '40px';
    host.style.height = '40px';
    host.style.display = 'none';
    host.style.margin = '0';
    host.style.zIndex = '2147483647';
    ensureHeaderActions();
    const inMasthead = !!host.parentElement?.closest('#serein-header-actions');
    host.style.display = inMasthead ? 'block' : 'none';
    positionPanel();
    installSereinBrand();
  }

  async function init() {
    applySettings(await loadSettings());
    buildUI();
    scan();
    const observer = new MutationObserver(() => {
      if (!host.isConnected) { host = null; panel = null; trigger = null; buildUI(); }
      scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('yt-navigate-finish', () => { installSereinBrand(); placeTrigger(); scheduleScan(); });
    document.addEventListener('yt-page-data-updated', scheduleScan);
    const darkObserver = new MutationObserver(() => { if (settings.theme === 'auto') applyTheme(); });
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
    if (extensionApi && extensionApi.storage && extensionApi.storage.onChanged) {
      extensionApi.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[STORAGE_KEY]) applySettings(changes[STORAGE_KEY].newValue);
      });
    }

  }

  init();
})();
