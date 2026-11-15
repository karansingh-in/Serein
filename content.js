(() => {
  'use strict';

  if (window.__sereinLoaded) return;
  window.__sereinLoaded = true;

  const STORAGE_KEY = 'ytkb_settings'; // Keep the existing key so upgrades retain user settings.
  const HIDDEN_ATTR = 'data-serein-hidden';
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
    focus: { shorts: true, recommendations: true, endScreens: false, comments: false, autoplay: false },
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
      autoplay: legacyFocus.autoplay === true || legacyPlayback.disableAutoplay === true
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
    applyTheme();
  }

  function matchesCard(card) {
    const titleNode = card.querySelector('#video-title, a#video-title-link, yt-formatted-string#video-title, h3 a[title]');
    const title = titleNode ? (titleNode.getAttribute('title') || titleNode.textContent || '').trim() : '';
    const channelNode = card.querySelector('ytd-channel-name a, #channel-name a, .ytd-channel-name a, a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]');
    const channel = channelNode ? (channelNode.getAttribute('title') || channelNode.textContent || '').trim() : '';
    if (!title && !channel) return false;
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

  function scan() {
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
    // Keep the panel directly above the fixed bottom-left launcher.
    panel.style.left = '16px';
    panel.style.right = 'auto';
    panel.style.top = 'auto';
    panel.style.bottom = '76px';
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
        .launcher { position: fixed; left: 16px; bottom: 20px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; padding: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); cursor: pointer; box-shadow: 0 4px 18px rgba(20,18,35,.14); transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .launcher:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateY(-1px); }
        .launcher svg { width: 21px; height: 21px; display: block; }
        .launcher-dot { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--surface); }
        .launcher:focus-visible, button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .panel { position: fixed; left: 16px; bottom: 76px; z-index: 2147483647; width: min(380px, calc(100vw - 24px)); max-height: min(720px, calc(100vh - 100px)); overflow: auto; border: 1px solid var(--window-border); border-radius: 16px; background: var(--bg); color: var(--text); box-shadow: 0 18px 60px rgba(20, 18, 35, .20); }
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
            <div class="brand-lockup"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff"/><path d="M5.8 18.9C8 9.6 16 4.6 26.3 5c-.3 9.7-5.2 18-15.5 21-4.1 1.2-7-2.8-5-7.1Z" fill="#E62117"/><path d="M8 24.3c4.2-5.5 9.2-10.2 15.9-15.2" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><path d="M8 24.3 4.8 27.5" fill="none" stroke="#E62117" stroke-width="1.6" stroke-linecap="round"/></svg><div class="brand">s e r e i n</div></div>
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
        <footer class="footer"><a href="${BRAND_URL}" target="_blank" rel="noopener noreferrer">Built by karansingh-in</a><span>v3.0.2</span></footer>
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
    (document.body || document.documentElement).append(host);
    installYouTubeCleanup();
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
        autoplay: field('autoplay').checked
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
    for (const key of ['shorts', 'recommendations', 'endScreens', 'comments', 'autoplay']) check(key, settings.focus[key]);
    check('scheduleEnabled', settings.recreation.enabled);
    set('scheduleStart', settings.recreation.start);
    set('scheduleEnd', settings.recreation.end);
    root.querySelector('[data-schedule]').classList.toggle('visible', settings.recreation.enabled);
    root.querySelectorAll('[data-theme]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === settings.theme)));
  }

  function updateStatus() {
    if (!status || !host) return;
    const recreation = isRecreationTime();
    const distractionsOn = settings.distractionMode && Object.values(settings.focus).some(Boolean);
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

  function installYouTubeCleanup() {
    if (document.getElementById('serein-youtube-cleanup')) return;
    const style = document.createElement('style');
    style.id = 'serein-youtube-cleanup';
    style.textContent = `
      /* Remove YouTube's Create action without affecting the notification control. */
      ytd-topbar-menu-button-renderer:has(button[aria-label^="Create"]),
      ytd-topbar-menu-button-renderer:has(a[aria-label^="Create"]),
      ytd-button-renderer:has(button[aria-label^="Create"]),
      yt-button-shape:has(button[aria-label^="Create"]),
      #buttons button[aria-label^="Create"],
      #buttons a[aria-label^="Create"],
      button[aria-label^="Create"],
      a[aria-label^="Create"],
      ytd-topbar-menu-button-renderer:has([title^="Create"]) { display: none !important; }
    `;
    (document.head || document.documentElement).append(style);
  }

  function placeTrigger() {
    if (!host) return;
    // Serein intentionally lives in the bottom-left corner, away from YouTube's search/header controls.
    host.style.position = 'fixed';
    host.style.left = '16px';
    host.style.bottom = '20px';
    host.style.width = '44px';
    host.style.height = '44px';
    host.style.display = 'block';
    host.style.margin = '0';
    host.style.zIndex = '2147483647';
    if (host.parentElement !== document.body && document.body) document.body.append(host);
    positionPanel();
  }

  async function init() {
    applySettings(await loadSettings());
    buildUI();
    scan();
    const observer = new MutationObserver(() => {
      if (!host.isConnected) { host = null; panel = null; trigger = null; buildUI(); }
      installYouTubeCleanup();
      placeTrigger();
      scheduleScan();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    document.addEventListener('yt-navigate-finish', () => { placeTrigger(); scheduleScan(); });
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
