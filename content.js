(() => {   'use strict';    const KEY = 'ytkb_settings';   const ATTR = 'data-ytkb-hidden';   const COOLDOWN_MS = 60 * 1000;          const BRAND = 'karansingh-in';   const BRAND_URL = 'https://github.com/karansingh-in';   const SHORTS_LINK = 'a[href^="/shorts"]';    const DEFAULTS = {     keywords: [],     wholeWord: true,     recreation: { enabled: false, start: '18:00', end: '20:00' },     focus: { shorts: true, rabbit: true },     distractionMode: false,     distractions: { ...YTKBDistractions.DEFAULTS },     playback: { disableAutoplay: false, defaultSpeed: 1 },     timeAwareness: { ...YTKBTime.DEFAULTS },     theme: 'auto'   };        const CARD_SELECTORS = [     'ytd-rich-item-renderer',                'ytd-video-renderer',                    'ytd-compact-video-renderer',            'ytd-grid-video-renderer',               'ytd-playlist-renderer',                 'ytd-channel-renderer',                  'ytd-reel-item-renderer',                'ytm-shorts-lockup-view-model',          'yt-lockup-view-model'                 ].join(',');    const ext = (typeof chrome !== 'undefined' && chrome.storage) ? chrome     : (typeof browser !== 'undefined' && browser.storage) ? browser : null;        let settings = normalize(null);   let matcher = buildMatcher([], true);
   const playbackState = { lastApplied: null };   const sessionStore = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();   const timeState = YTKBTime.createState(sessionStore);   let timeReadout = null;   let timeToast = null;   let timeToastTimer = null;   let timeTimer = null;   let statusKind = 'idle';   let statusText = null;   let statusDot = null;   let toggleDot = null;   let applyThemeFn = null;        function normalize(s) {     const kws = s && Array.isArray(s.keywords)       ? s.keywords.filter((k) => typeof k === 'string').map((k) => k.trim()).filter(Boolean)       : [];     const okTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);     const r = s && s.recreation;     const f = s && s.focus;     return {       keywords: kws,       wholeWord: !(s && s.wholeWord === false),       recreation: {         enabled: !!(r && r.enabled),         start: r && okTime(r.start) ? r.start : DEFAULTS.recreation.start,         end: r && okTime(r.end) ? r.end : DEFAULTS.recreation.end       },       focus: {         shorts: !(f && f.shorts === false),         rabbit: !(f && f.rabbit === false)       },       distractionMode: !!(s && s.distractionMode),       distractions: YTKBDistractions.normalize(s && s.distractions),       playback: YTKBPlayback.normalize(s && s.playback),       timeAwareness: YTKBTime.normalize(s && s.timeAwareness),       theme: s && (s.theme === 'light' || s.theme === 'dark') ? s.theme : 'auto'     };   }    function readLS() {     try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }   }    function load() {     return new Promise((resolve) => {       let done = false;       const finish = (v) => { if (!done) { done = true; resolve(normalize(v)); } };       setTimeout(() => finish(readLS()), 2000);         try {         if (ext && ext.storage && ext.storage.local) {           ext.storage.local.get(KEY, (res) => {             const err = ext.runtime && ext.runtime.lastError;             finish(err ? readLS() : (res && res[KEY]));           });           return;         }       } catch (e) { /* fall through */ }       finish(readLS());     });   }    function save(s) {     try {       if (ext && ext.storage && ext.storage.local) {         ext.storage.local.set({ [KEY]: s }, () => {           const err = ext.runtime && ext.runtime.lastError;           if (err) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }         });         return;       }     } catch (e) { /* fall through */ }     try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}   }        function applySettings(s) {     settings = normalize(s);     matcher = buildMatcher(settings.keywords, settings.wholeWord);     scan();     if (applyThemeFn) applyThemeFn();   }    function syncTimeTimer() {
    if (settings.timeAwareness.enabled && !document.hidden) {
      if (timeTimer === null) {
        if (timeReadout) tickTimeAwareness();
        timeTimer = setInterval(tickTimeAwareness, 1000);
      }
    } else if (timeTimer !== null) {
      clearInterval(timeTimer);
      timeTimer = null;
      YTKBTime.pause(timeState, Date.now());
      YTKBTime.saveState(sessionStore, timeState);
    }
  }

  function tickTimeAwareness() {
    const result = YTKBTime.tick(settings.timeAwareness, document, timeState, Date.now());
    if (timeReadout) {
      timeReadout.textContent = settings.timeAwareness.enabled
        ? (result.active ? 'Watching · ' : 'Active watch time · ') + YTKBTime.format(result.activeMs)
        : 'Tracking off';
    }
    if (result.reminder && timeToast) {
      timeToast.textContent = 'You have been watching for ' + settings.timeAwareness.reminderMinutes + ' minutes. Take a short break?';
      timeToast.style.display = 'block';
      clearTimeout(timeToastTimer);
      timeToastTimer = setTimeout(() => { if (timeToast) timeToast.style.display = 'none'; }, 8000);
    }
    if (settings.timeAwareness.enabled && Date.now() - timeState.lastSavedAt >= 10000) {
      YTKBTime.saveState(sessionStore, timeState);
      timeState.lastSavedAt = Date.now();
    }
  }

  function hideEl(el) {     el.__ytkbPrev = [el.style.getPropertyValue('display'), el.style.getPropertyPriority('display')];     el.setAttribute(ATTR, '');     el.style.setProperty('display', 'none', 'important');   }    function showEl(el) {     el.removeAttribute(ATTR);     const prev = el.__ytkbPrev;     if (prev && prev[0]) el.style.setProperty('display', prev[0], prev[1]);     else el.style.removeProperty('display');     el.__ytkbPrev = null;   }    function collectShorts(desired) {
    for (const el of document.querySelectorAll('ytd-reel-shelf-renderer')) desired.add(el);
    for (const el of document.querySelectorAll('ytd-rich-section-renderer')) {
      if (el.querySelector('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ' + SHORTS_LINK)) desired.add(el);
    }
    for (const el of document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer')) {
      if (el.querySelector(SHORTS_LINK)) desired.add(el);
    }
    for (const el of document.querySelectorAll('yt-tab-shape')) {
      const title = (el.getAttribute('tab-title') || '').trim().toLowerCase();
      if (title === 'shorts' || el.querySelector(SHORTS_LINK)) desired.add(el);
    }
  }

  function collectRabbit(desired) {           const sel = 'ytd-watch-next-secondary-results-renderer';     for (const el of document.querySelectorAll(sel)) desired.add(el);   }    function scan() {     const recreation = isRecreationTime(settings.recreation, new Date());     YTKBPlayback.apply(settings.playback, document, playbackState, location.pathname);     const desired = new Set();     const countable = [];      if (!recreation) {       const shortsOn = settings.focus.shorts;        if (shortsOn) {         const target = shortsRedirectTarget(location.pathname, location.origin);         if (target) location.replace(target);       }        const kwActive = settings.keywords.length > 0;       if (kwActive || shortsOn) {         for (const el of document.querySelectorAll(CARD_SELECTORS)) {           let block = false;           if (kwActive) {             const text = el.textContent;             block = !!(text && text.trim() && matcher(text));           }           if (!block && shortsOn && el.querySelector(SHORTS_LINK)) block = true;           if (block) { desired.add(el); countable.push(el); }         }       }              if (settings.focus.rabbit) collectRabbit(desired);
      if (shortsOn && !settings.distractionMode) collectShorts(desired);
      if (settings.distractionMode) YTKBDistractions.collect(settings.distractions, document, desired);     }      for (const el of document.querySelectorAll('[' + ATTR + ']')) {       if (!desired.has(el)) showEl(el);     }     for (const el of desired) {       if (!el.hasAttribute(ATTR)) hideEl(el);     }            let hiddenCount = 0;     for (const el of countable) {       const p = el.parentElement;       if (!(p && p.closest('[' + ATTR + ']'))) hiddenCount++;     }     renderStatus(hiddenCount, recreation);   }    let timer = null;   function schedule() {     if (timer !== null) return;     timer = setTimeout(() => { timer = null; scan(); }, 300);   }        const PALETTES = {     dark: {       scheme: 'dark', bg: '#0b0b0c', surface: '#141416',       border: 'rgba(255,255,255,0.10)', borderStrong: 'rgba(255,255,255,0.32)',       text: '#f4f4f5', muted: 'rgba(244,244,245,0.58)',       accentBg: '#f4f4f5', accentFg: '#0b0b0c',       ok: '#34d399', warn: '#f5b942', idle: 'rgba(244,244,245,0.35)'     },     light: {       scheme: 'light', bg: '#fafaf9', surface: '#ffffff',       border: 'rgba(0,0,0,0.10)', borderStrong: 'rgba(0,0,0,0.34)',       text: '#0d0d0e', muted: 'rgba(13,13,14,0.58)',       accentBg: '#0d0d0e', accentFg: '#fafaf9',       ok: '#059669', warn: '#d97706', idle: 'rgba(13,13,14,0.35)'     }   };   const FONT = "Inter,Roboto,'Segoe UI','Noto Sans','DejaVu Sans',Arial,sans-serif";   const BASE = {     fontFamily: FONT, boxSizing: 'border-box', lineHeight: '1.4', letterSpacing: '-0.005em',     color: (p) => p.text   };   const hairline = (p) => '1px solid ' + p.border;    let P = PALETTES.dark;   const themed = [];         const paintHooks = [];      function resolveTheme() {     if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;     return document.documentElement.hasAttribute('dark') ? 'dark' : 'light';     }    function repaint() {     for (const [el, k, fn] of themed) el.style[k] = fn(P);     for (const f of paintHooks) f();   }    function h(tag, style, props, ...kids) {     const el = document.createElement(tag);     if (style) {       for (const k of Object.keys(style)) {         const v = style[k];         if (typeof v === 'function') { themed.push([el, k, v]); el.style[k] = v(P); }         else el.style[k] = v;       }     }     if (props) Object.assign(el, props);     for (const k of kids) el.append(k);     return el;   }    function paintStatus() {     const c = P[statusKind] || P.idle;     if (statusDot) statusDot.style.background = c;     if (toggleDot) toggleDot.style.background = c;   }   paintHooks.push(paintStatus);    function renderStatus(hiddenCount, recreation) {     let text;     if (recreation) {       statusKind = 'warn';       text = 'Recreation time \u00b7 resumes at ' + settings.recreation.end;     } else if (!settings.keywords.length && !settings.focus.shorts && !settings.focus.rabbit && !settings.distractionMode) {       statusKind = 'idle';       text = 'Idle \u00b7 nothing to block';     } else {       statusKind = 'ok';       text = 'Blocking \u00b7 ' + hiddenCount + ' hidden on this page';     }     if (statusText) statusText.textContent = text;     paintStatus();   }    function focusRing(el) {     el.addEventListener('focus', () => { el.style.borderColor = P.text; });     el.addEventListener('blur', () => { el.style.borderColor = P.border; });   }    function dim(btn) {     btn.addEventListener('pointerdown', () => { btn.style.opacity = '0.8'; });     ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>       btn.addEventListener(ev, () => { btn.style.opacity = btn.disabled ? '0.5' : '1'; }));   }    function version() {     try { return ext.runtime.getManifest().version; } catch (e) { return ''; }   }    function blockIcon() {     const NS = 'http://www.w3.org/2000/svg';     const mk = (tag, attrs) => {       const n = document.createElementNS(NS, tag);       for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);       return n;     };     const svg = mk('svg', { viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none',       stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round' });     svg.append(mk('circle', { cx: '12', cy: '12', r: '8.5' }),       mk('line', { x1: '6', y1: '18', x2: '18', y2: '6' }));     return svg;   }        function check(role, title, sub) {     const input = h('input', { position: 'absolute', opacity: '0', width: '1px', height: '1px', margin: '0' },       { type: 'checkbox' });     input.dataset.role = role;     const mark = h('span', {       width: '18px', height: '18px', flex: '0 0 18px', marginTop: '1px', borderRadius: '4px',       display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',       fontWeight: '700', border: '1px solid transparent'     });     const sync = () => {       mark.textContent = input.checked ? '\u2713' : '';       mark.style.background = input.checked ? P.text : 'transparent';       mark.style.color = P.bg;       mark.style.borderColor = input.checked ? P.text : P.borderStrong;     };     paintHooks.push(sync);     input.addEventListener('change', sync);     input.addEventListener('focus', () => { mark.style.boxShadow = '0 0 0 2px ' + P.borderStrong; });     input.addEventListener('blur', () => { mark.style.boxShadow = 'none'; });     const text = h('span', { ...BASE, fontSize: '14px', fontWeight: '500' }, null, title,       sub ? h('span', { ...BASE, display: 'block', fontSize: '12px', fontWeight: '400', color: (p) => p.muted }, null, sub) : '');     const row = h('label', {       ...BASE, position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '12px',       padding: '8px 0', minHeight: '40px', cursor: 'pointer'     }, null, input, mark, text);     return { row, input, sync };   }    function buildUI() {     if (document.getElementById('ytkb-host')) return;     P = PALETTES[resolveTheme()];      const host = document.createElement('div');     host.id = 'ytkb-host';           const root = host.attachShadow({ mode: 'open' });      const label = (txt) => h('div', { ...BASE, fontSize: '12px', fontWeight: '500',       color: (p) => p.muted, margin: '0 0 8px' }, null, txt);            const seg = h('div', { display: 'flex', border: hairline, borderRadius: '4px', overflow: 'hidden' });     const segBtns = {};     for (const [val, name] of [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]) {       const b = h('button', {         ...BASE, fontSize: '12px', fontWeight: '500', minHeight: '30px', padding: '0 10px',         border: 'none', borderRadius: '0', cursor: 'pointer', background: 'transparent'       }, { type: 'button' }, name);       b.dataset.role = 'theme-' + val;       b.addEventListener('click', () => {         settings = { ...settings, theme: val };         save(settings);         applyThemeFn();       });       segBtns[val] = b;       seg.append(b);     }     paintHooks.push(() => {       for (const v of Object.keys(segBtns)) {         const on = settings.theme === v;         segBtns[v].style.background = on ? P.accentBg : 'transparent';         segBtns[v].style.color = on ? P.accentFg : P.muted;       }     });      statusDot = h('span', { width: '8px', height: '8px', borderRadius: '50%', flex: '0 0 8px' });     statusText = h('span', { ...BASE, fontSize: '13px', color: (p) => p.muted }, null, '');      const header = h('div', { padding: '14px 16px 12px', borderBottom: hairline }, null,       h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }, null,         h('span', { ...BASE, fontSize: '15px', fontWeight: '600', letterSpacing: '-0.015em' }, null, 'Keyword blocker'),         seg),       h('div', { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }, null, statusDot, statusText));            const textarea = h('textarea', {       ...BASE, display: 'block', width: '100%', height: '112px', fontSize: '16px', padding: '10px 12px',       margin: '0 0 6px', background: (p) => p.surface, border: hairline, borderRadius: '4px',       resize: 'vertical', outline: 'none', caretColor: 'currentColor'     }, { placeholder: 'One per line', spellcheck: false, autocapitalize: 'off' });     textarea.dataset.role = 'keywords';     focusRing(textarea);     const hint = h('div', { ...BASE, fontSize: '12px', color: (p) => p.muted, margin: '0 0 22px' }, null,       'Matches video title and channel name. Commas also work.');            const shorts = check('shorts', 'Hide Shorts', 'Filter Shorts videos and redirect direct Shorts links. The checklist controls shelves/navigation when enabled.');     const rabbit = check('rabbit', 'Hide recommendations', 'Hide the watch-page recommendation sidebar.');     const whole = check('whole', 'Whole words only', 'So \u201cai\u201d won\u2019t match \u201cmaintain\u201d.');

    const focusModeSelect = h('select', {
      ...BASE, width: '100%', minHeight: '38px', padding: '6px 10px', fontSize: '14px',
      background: (p) => p.surface, border: hairline, borderRadius: '4px',
      color: (p) => p.text, colorScheme: (p) => p.scheme, outline: 'none'
    }, { 'aria-label': 'Focus mode' },
      ...[['custom', 'Custom'], ['minimal', 'Minimal'], ['study', 'Study'], ['deep', 'Deep Focus']]
        .map(([value, title]) => h('option', {}, { value }, title)));
    focusModeSelect.dataset.role = 'focus-mode';
    focusRing(focusModeSelect);
    const focusModeHint = h('div', { ...BASE, fontSize: '12px', color: (p) => p.muted, margin: '5px 0 16px' },
      null, 'Presets adjust existing focus, distraction and autoplay settings.');

    const distractionMaster = check('distraction-master', 'Hide distracting elements', 'Hide selected YouTube interface distractions.');
    const distractionLabels = [
      ['trendingExplore', 'Trending / Explore'],
      ['communityPosts', 'Community posts'],
      ['endScreenRecommendations', 'End-screen recommendations'],
      ['shortsShelf', 'Shorts shelves'],
      ['shortsNavigation', 'Shorts navigation'],
      ['notificationBell', 'Notification bell'],
      ['createButton', 'Create button'],
      ['merchandise', 'Merchandise sections'],
      ['memberships', 'Membership promotions'],
      ['promotions', 'Promotional sections'],
      ['comments', 'Comments'],
      ['liveChat', 'Live chat']
    ];
    const distractionChecks = distractionLabels.map(([key, title]) => [key, check('distraction-' + key, title, '')]);
    const distractionList = h('div', { display: 'none', padding: '4px 0 0 30px' }, null,
      ...distractionChecks.map(([, item]) => item.row));
    const distractionDetails = h('details', { ...BASE, margin: '0 0 8px' }, null,
      h('summary', { ...BASE, fontSize: '12px', color: (p) => p.muted, cursor: 'pointer', padding: '4px 0 8px' }, null, 'Choose elements'),
      distractionList);
    distractionDetails.addEventListener('toggle', () => {
      distractionList.style.display = distractionDetails.open ? 'block' : 'none';
    });
    distractionMaster.input.addEventListener('change', () => {
      distractionDetails.open = distractionMaster.input.checked;
      distractionList.style.display = distractionDetails.open ? 'block' : 'none';
    });

    const autoplay = check('disable-autoplay', 'Disable autoplay', 'Stop YouTube from automatically playing the next video.');
    const speedSelect = h('select', {
      ...BASE, width: '100%', minHeight: '38px', padding: '6px 10px', fontSize: '14px',
      background: (p) => p.surface, border: hairline, borderRadius: '4px',
      color: (p) => p.text, colorScheme: (p) => p.scheme, outline: 'none'
    }, { 'aria-label': 'Default playback speed' },
      ...YTKBPlayback.SPEEDS.map((speed) => h('option', {}, { value: String(speed) }, speed === 1 ? 'Normal (1x)' : speed + 'x')));
    speedSelect.dataset.role = 'default-speed';
    focusRing(speedSelect);
    const speedRow = h('div', { ...BASE, margin: '4px 0 12px 30px' }, null,
      h('div', { ...BASE, fontSize: '12px', color: (p) => p.muted, margin: '0 0 6px' }, null, 'Default playback speed'), speedSelect);

    const timeTracking = check('time-tracking', 'Track active viewing time', 'Counts only while a video is playing in the active tab.');
    const reminderSelect = h('select', {
      ...BASE, width: '100%', minHeight: '36px', padding: '6px 10px', fontSize: '13px',
      background: (p) => p.surface, border: hairline, borderRadius: '4px',
      color: (p) => p.text, colorScheme: (p) => p.scheme, outline: 'none'
    }, { 'aria-label': 'Viewing time reminder' },
      ...YTKBTime.REMINDERS.map((minutes) => h('option', {}, { value: String(minutes) }, minutes === 0 ? 'No reminder' : 'Remind after ' + minutes + ' minutes')));
    reminderSelect.dataset.role = 'time-reminder';
    focusRing(reminderSelect);
    const reminderRow = h('div', { ...BASE, margin: '4px 0 8px 30px' }, null,
      h('div', { ...BASE, fontSize: '12px', color: (p) => p.muted, margin: '0 0 6px' }, null, 'Break reminder'), reminderSelect);
    timeReadout = h('div', { ...BASE, fontSize: '12px', color: (p) => p.muted, margin: '4px 0 0 30px', fontVariantNumeric: 'tabular-nums' }, null, 'Tracking off');

    const rec = check('rec', 'Recreation time', 'Pause all blocking during this window.');     const timeStyle = {       ...BASE, fontSize: '16px', padding: '6px 10px', minHeight: '40px', background: (p) => p.surface,       border: hairline, borderRadius: '4px', colorScheme: (p) => p.scheme, outline: 'none'     };     const startInput = h('input', timeStyle, { type: 'time' });     const endInput = h('input', timeStyle, { type: 'time' });     startInput.dataset.role = 'rec-start';     endInput.dataset.role = 'rec-end';     focusRing(startInput); focusRing(endInput);     const recRow = h('div', {       ...BASE, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '4px 0 0 30px',       fontSize: '13px', color: (p) => p.muted     }, null, 'from', startInput, 'to', endInput);            const saveBtn = h('button', {       ...BASE, display: 'block', width: '100%', minHeight: '44px', fontSize: '14px', fontWeight: '600',       background: (p) => p.accentBg, color: (p) => p.accentFg, border: 'none', borderRadius: '4px',       cursor: 'pointer', margin: '22px 0 0'     }, { type: 'button' }, 'Save');     saveBtn.dataset.role = 'save';     dim(saveBtn);     const cancelBtn = h('button', {       ...BASE, display: 'none', width: '100%', minHeight: '40px', fontSize: '13px', fontWeight: '500',       background: 'transparent', color: (p) => p.muted, border: hairline, borderRadius: '4px',       cursor: 'pointer', margin: '8px 0 0'     }, { type: 'button' }, 'Cancel change');     cancelBtn.dataset.role = 'cancel';     const note = h('div', { ...BASE, fontSize: '12px', color: (p) => p.muted, margin: '10px 0 0', minHeight: '16px' });     note.dataset.role = 'note';            const ver = version();     const footer = h('div', {       ...BASE, display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 16px',       borderTop: hairline, fontSize: '12px', color: (p) => p.muted     }, null,       h('span', { ...BASE, color: (p) => p.muted }, null, 'Made by ',         h('a', { ...BASE, fontWeight: '500', textDecoration: 'none', borderBottom: (p) => '1px solid ' + p.borderStrong },           { href: BRAND_URL, target: '_blank', rel: 'noopener noreferrer' }, BRAND)),       h('span', { ...BASE, color: (p) => p.muted }, null, ver ? 'v' + ver : ''));      const settingsGroup = (title, ...children) => h('details', {
      ...BASE, borderTop: hairline, padding: '10px 0 2px', margin: '0'
    }, null,
      h('summary', {
        ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: '28px', fontSize: '13px', fontWeight: '600', color: (p) => p.text,
        cursor: 'pointer', listStyle: 'revert'
      }, { tabIndex: 0 }, title),
      h('div', { padding: '8px 0 4px' }, null, ...children));

    const body = h('div', { padding: '12px 16px 16px' }, null,
      label('Focus mode'), focusModeSelect, focusModeHint,
      label('Keywords'), textarea, hint,
      settingsGroup('Focus', shorts.row, rabbit.row, whole.row),
      settingsGroup('Distractions', distractionMaster.row, distractionDetails),
      settingsGroup('Playback', autoplay.row, speedRow),
      settingsGroup('Time awareness', timeTracking.row, reminderRow, timeReadout),
      settingsGroup('Schedule', rec.row, recRow),
      saveBtn, cancelBtn, note);

      const panel = h('div', {       ...BASE, position: 'fixed', left: '16px', bottom: '76px', width: 'min(340px, 92vw)',       maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', background: (p) => p.bg, border: hairline,       borderRadius: '6px', zIndex: '2147483647', display: 'none'     }, null, header, body, footer);            toggleDot = h('span', { position: 'absolute', top: '7px', right: '7px', width: '8px', height: '8px', borderRadius: '50%' });     const toggle = h('button', {       ...BASE, position: 'fixed', left: '16px', bottom: '20px', width: '44px', height: '44px', padding: '0',       display: 'flex', alignItems: 'center', justifyContent: 'center', background: (p) => p.surface,       border: hairline, borderRadius: '4px', cursor: 'pointer', zIndex: '2147483647'     }, { type: 'button', title: 'Keyword blocker' }, blockIcon(), toggleDot);     toggle.dataset.role = 'toggle';     dim(toggle);      function applyFocusPreset(id) {
      if (id === 'custom') {
        focusModeSelect.value = YTKBPresets.identify(collect());
        return;
      }
      const next = YTKBPresets.apply(id, collect());
      shorts.input.checked = next.focus.shorts;
      rabbit.input.checked = next.focus.rabbit;
      distractionMaster.input.checked = next.distractionMode;
      for (const [key, item] of distractionChecks) item.input.checked = next.distractions[key];
      autoplay.input.checked = next.playback.disableAutoplay;
      distractionDetails.open = next.distractionMode;
      distractionList.style.display = distractionDetails.open ? 'block' : 'none';
      [shorts, rabbit, distractionMaster, autoplay, ...distractionChecks.map(([, item]) => item)]
        .forEach((item) => item.sync());
    }
    focusModeSelect.addEventListener('change', () => applyFocusPreset(focusModeSelect.value));

    const inputs = [shorts, rabbit, whole, rec, distractionMaster, autoplay, timeTracking, ...distractionChecks.map(([, item]) => item)];     function fill() {       textarea.value = settings.keywords.join('\n');
      focusModeSelect.value = YTKBPresets.identify(settings);       shorts.input.checked = settings.focus.shorts;       rabbit.input.checked = settings.focus.rabbit;       whole.input.checked = settings.wholeWord;       rec.input.checked = settings.recreation.enabled;       distractionMaster.input.checked = settings.distractionMode;       for (const [key, item] of distractionChecks) item.input.checked = settings.distractions[key];       autoplay.input.checked = settings.playback.disableAutoplay;       speedSelect.value = String(settings.playback.defaultSpeed);       timeTracking.input.checked = settings.timeAwareness.enabled;       reminderSelect.value = String(settings.timeAwareness.reminderMinutes);       timeReadout.textContent = settings.timeAwareness.enabled ? 'Active watch time · ' + YTKBTime.format(timeState.activeMs) : 'Tracking off';       distractionDetails.open = settings.distractionMode;       distractionList.style.display = distractionDetails.open ? 'block' : 'none';       startInput.value = settings.recreation.start;       endInput.value = settings.recreation.end;       inputs.forEach((c) => c.sync());     }      function collect() {       const seen = new Set();       const kws = [];       for (const part of textarea.value.split(/[\n,]/)) {         const k = part.trim();         const norm = k.toLowerCase();         if (k && !seen.has(norm)) { seen.add(norm); kws.push(k); }       }       return normalize({         keywords: kws,         wholeWord: whole.input.checked,         recreation: {           enabled: rec.input.checked,           start: startInput.value || DEFAULTS.recreation.start,           end: endInput.value || DEFAULTS.recreation.end         },         focus: { shorts: shorts.input.checked, rabbit: rabbit.input.checked },         distractionMode: distractionMaster.input.checked,         distractions: Object.fromEntries(distractionChecks.map(([key, item]) => [key, item.input.checked])),         playback: { disableAutoplay: autoplay.input.checked, defaultSpeed: Number(speedSelect.value) },         timeAwareness: { enabled: timeTracking.input.checked, reminderMinutes: Number(reminderSelect.value) },         theme: settings.theme       });     }      let noteTimer = null;     function flash(msg) {       note.textContent = msg;       clearTimeout(noteTimer);       if (msg) noteTimer = setTimeout(() => { note.textContent = ''; }, 2500);     }      function commit(next) {       const final = normalize({ ...next, theme: settings.theme });       save(final);       applySettings(final);       fill();       flash('Saved');     }            let pending = null;     function endPending() {       clearInterval(pending.timer);       pending = null;       saveBtn.disabled = false;       saveBtn.style.opacity = '1';       saveBtn.textContent = 'Save';       cancelBtn.style.display = 'none';     }     function startCooldown(next) {       pending = { next, endsAt: Date.now() + COOLDOWN_MS, timer: null };       saveBtn.disabled = true;       saveBtn.style.opacity = '0.5';       cancelBtn.style.display = 'block';       flash('');       note.textContent = 'This change lets more through, so it applies after a short wait. Cancel any time.';       const tick = () => {         if (!pending) return;         const left = Math.max(0, Math.ceil((pending.endsAt - Date.now()) / 1000));         saveBtn.textContent = left > 0 ? 'Applying in ' + left + 's' : 'Applying\u2026';         if (left <= 0) {           const n = pending.next;           endPending();           commit(n);         }       };       pending.timer = setInterval(tick, 250);       tick();     }      saveBtn.addEventListener('click', () => {       if (pending) return;       const next = collect();       if (isLoosening(settings, next)) startCooldown(next);       else commit(next);     });     cancelBtn.addEventListener('click', () => {       if (!pending) return;       endPending();       fill();       flash('Change cancelled');     });      toggle.addEventListener('click', () => {       const open = panel.style.display === 'none';       panel.style.display = open ? 'block' : 'none';       if (open && !pending) { fill(); flash(''); }       scan();     });      panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'YT Keyword Blocker settings');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(panel.style.display !== 'none')));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && panel.style.display !== 'none') {
        panel.style.display = 'none';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });

    applyThemeFn = () => { P = PALETTES[resolveTheme()]; repaint(); };      timeToast = h('div', { ...BASE, position: 'fixed', right: '18px', bottom: '20px', maxWidth: 'min(340px, 90vw)', padding: '12px 14px', background: (p) => p.surface, border: hairline, borderRadius: '6px', boxShadow: '0 8px 28px rgba(0,0,0,0.24)', fontSize: '13px', color: (p) => p.text, zIndex: '2147483647', display: 'none' }, null, '');
    root.append(panel, toggle, timeToast);     (document.body || document.documentElement).append(host);     fill();     applyThemeFn();     scan();   }        async function init() {     applySettings(await load());     buildUI();     scan();           setInterval(scan, 30000);     document.addEventListener('visibilitychange', () => {       if (document.hidden) {
        YTKBTime.pause(timeState, Date.now());
        YTKBTime.saveState(sessionStore, timeState);
        if (timeTimer !== null) { clearInterval(timeTimer); timeTimer = null; }
      } else { scan(); syncTimeTimer(); }
    });
    window.addEventListener('beforeunload', () => YTKBTime.saveState(sessionStore, timeState));      new MutationObserver(schedule).observe(document.documentElement, {       childList: true, subtree: true, characterData: true     });           new MutationObserver(() => {       if (settings.theme === 'auto' && applyThemeFn) applyThemeFn();     }).observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });      document.addEventListener('yt-navigate-finish', schedule);     document.addEventListener('yt-page-data-updated', schedule);            try {       if (ext && ext.storage && ext.storage.onChanged) {         ext.storage.onChanged.addListener((changes, area) => {           if (area === 'local' && changes[KEY]) applySettings(changes[KEY].newValue);         });       }     } catch (e) {}   }    init(); })();