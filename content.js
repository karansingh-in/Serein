(() => {
  'use strict';

  const KEY = 'ytkb_settings';
  const ATTR = 'data-ytkb-hidden';
  const DEFAULTS = { keywords: [], wholeWord: true,
    recreation: { enabled: false, start: '18:00', end: '20:00' } };

  // Outer containers of video/short/playlist/channel cards across YouTube surfaces.
  const CARD_SELECTORS = [
    'ytd-rich-item-renderer',          // home grid, channel grid
    'ytd-video-renderer',              // search results
    'ytd-compact-video-renderer',      // watch-page sidebar (older)
    'ytd-grid-video-renderer',         // older grids
    'ytd-playlist-renderer',           // search playlists
    'ytd-channel-renderer',            // search channel results
    'ytd-reel-item-renderer',          // shorts shelf (older)
    'ytm-shorts-lockup-view-model',    // shorts shelf (newer)
    'yt-lockup-view-model'             // newer card model (sidebar etc.)
  ].join(',');

  const ext = (typeof chrome !== 'undefined' && chrome.storage) ? chrome
    : (typeof browser !== 'undefined' && browser.storage) ? browser : null;

  let settings = { ...DEFAULTS };
  let matcher = buildMatcher([], true);

  // ---------- storage (extension storage, with localStorage fallback) ----------
  function normalize(s) {
    const kws = s && Array.isArray(s.keywords)
      ? s.keywords.filter((k) => typeof k === 'string').map((k) => k.trim()).filter(Boolean)
      : [];
    const okTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const r = s && s.recreation;
    return {
      keywords: kws,
      wholeWord: !(s && s.wholeWord === false),
      recreation: {
        enabled: !!(r && r.enabled),
        start: r && okTime(r.start) ? r.start : DEFAULTS.recreation.start,
        end: r && okTime(r.end) ? r.end : DEFAULTS.recreation.end
      }
    };
  }

  function readLS() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  function load() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(normalize(v)); } };
      setTimeout(() => finish(readLS()), 2000); // never hang if the storage API misbehaves
      try {
        if (ext && ext.storage && ext.storage.local) {
          ext.storage.local.get(KEY, (res) => {
            const err = ext.runtime && ext.runtime.lastError;
            finish(err ? readLS() : (res && res[KEY]));
          });
          return;
        }
      } catch (e) { /* fall through */ }
      finish(readLS());
    });
  }

  function save(s) {
    try {
      if (ext && ext.storage && ext.storage.local) {
        ext.storage.local.set({ [KEY]: s }, () => {
          const err = ext.runtime && ext.runtime.lastError;
          if (err) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
        });
        return;
      }
    } catch (e) { /* fall through */ }
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  // ---------- filtering ----------
  function applySettings(s) {
    settings = normalize(s);
    matcher = buildMatcher(settings.keywords, settings.wholeWord);
    scan();
  }

  function scan() {
    let hiddenCount = 0;
    const recreation = isRecreationTime(settings.recreation, new Date());
    const cards = document.querySelectorAll(CARD_SELECTORS);
    for (const el of cards) {
      const text = el.textContent;
      const block = !recreation && !!(text && text.trim() && matcher(text));
      const isHidden = el.hasAttribute(ATTR);
      if (block) {
        if (!isHidden) {
          el.setAttribute(ATTR, '');
          el.style.setProperty('display', 'none', 'important');
        }
        // count only outermost hidden cards (nested cards share one ancestor)
        const parent = el.parentElement;
        if (!(parent && parent.closest('[' + ATTR + ']'))) hiddenCount++;
      } else if (isHidden) {
        el.removeAttribute(ATTR);
        el.style.removeProperty('display');
      }
    }
    renderStatus(hiddenCount, recreation);
  }

  let timer = null;
  function schedule() {
    if (timer !== null) return;
    timer = setTimeout(() => { timer = null; scan(); }, 300);
  }

  // ---------- in-page settings panel (neo-brutalist) ----------
  const BRAND = 'karansingh-in';
  const BRAND_URL = 'https://github.com/karansingh-in';
  const C = {
    paper: '#f3eee2', white: '#ffffff', ink: '#111111',
    orange: '#ff5b2e', yellow: '#ffd93d', grey: '#bdb8aa'
  };
  const FONT = "Roboto,'Segoe UI','Noto Sans','DejaVu Sans',Arial,sans-serif";
  const BASE = { fontFamily: FONT, boxSizing: 'border-box', lineHeight: '1.35', color: C.ink };
  const BORDER = '3px solid ' + C.ink;

  let chipEl = null;
  let detailEl = null;
  let dotEl = null;

  function renderStatus(hiddenCount, recreation) {
    if (!chipEl) return;
    let chip, detail, color;
    if (recreation) {
      chip = 'PAUSED';
      detail = 'Recreation time \u00b7 blocking resumes at ' + settings.recreation.end;
      color = C.yellow;
    } else if (!settings.keywords.length) {
      chip = 'IDLE';
      detail = 'No keywords set';
      color = C.grey;
    } else {
      chip = 'BLOCKING';
      detail = hiddenCount + ' hidden on this page';
      color = C.orange;
    }
    chipEl.textContent = chip;
    chipEl.style.background = color;
    detailEl.textContent = detail;
    if (dotEl) dotEl.style.background = color;
  }

  function h(tag, style, props, ...kids) {
    const el = document.createElement(tag);
    if (style) Object.assign(el.style, style);
    if (props) Object.assign(el, props);
    for (const k of kids) el.append(k);
    return el;
  }

  function ring(el) {
    el.addEventListener('focus', () => { el.style.boxShadow = '4px 4px 0 ' + C.orange; });
    el.addEventListener('blur', () => { el.style.boxShadow = 'none'; });
  }

  // physical "press" feel: button sinks into its hard shadow
  function press(btn, restShadow) {
    const set = (t, s) => { btn.style.transform = t; btn.style.boxShadow = s; };
    btn.addEventListener('pointerdown', () => set('translate(3px,3px)', '1px 1px 0 ' + C.ink));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
      btn.addEventListener(ev, () => set('none', restShadow)));
  }

  function version() {
    try { return ext.runtime.getManifest().version; } catch (e) { return ''; }
  }

  function buildUI() {
    if (document.getElementById('ytkb-host')) return;
    const host = document.createElement('div');
    host.id = 'ytkb-host';
    // Keep typing from triggering YouTube's keyboard shortcuts (k, f, /, space...).
    ['keydown', 'keyup', 'keypress'].forEach((t) =>
      host.addEventListener(t, (e) => e.stopPropagation()));
    const root = host.attachShadow({ mode: 'open' });

    const heading = (txt) => h('div', {
      ...BASE, fontSize: '12px', fontWeight: '800', letterSpacing: '0.08em', margin: '0 0 6px'
    }, null, txt);

    // --- header
    chipEl = h('span', {
      ...BASE, padding: '4px 8px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em',
      background: C.grey, border: '2px solid ' + C.paper
    }, null, 'IDLE');
    const header = h('div', {
      ...BASE, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      padding: '10px 14px', background: C.ink, color: C.paper
    }, null,
      h('span', { ...BASE, color: C.paper, fontSize: '14px', fontWeight: '800', letterSpacing: '0.08em' },
        null, 'KEYWORD BLOCKER'),
      chipEl);

    // --- keywords
    const textarea = h('textarea', {
      ...BASE, width: '100%', height: '140px', fontSize: '16px', padding: '10px', margin: '0 0 6px',
      background: C.white, border: BORDER, borderRadius: '0', resize: 'vertical', outline: 'none',
      display: 'block'
    }, { placeholder: 'minecraft\nmr beast\nelden ring', spellcheck: false, autocapitalize: 'off' });
    ring(textarea);
    const hint = h('div', { ...BASE, fontSize: '12px', margin: '0 0 14px', opacity: '0.75' }, null,
      'One per line or comma-separated. Matches title + channel.');

    // --- options
    const checkStyle = { width: '22px', height: '22px', margin: '0', accentColor: C.ink, flex: '0 0 auto' };
    const whole = h('input', checkStyle, { type: 'checkbox' });
    const recEnabled = h('input', checkStyle, { type: 'checkbox' });
    const optRow = (input, title, sub) => h('label', {
      ...BASE, display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', cursor: 'pointer'
    }, null, input, h('span', { ...BASE, fontSize: '14px', fontWeight: '800' }, null, title,
      h('span', { ...BASE, fontWeight: '400', fontSize: '12px', display: 'block', opacity: '0.75' }, null, sub)));

    const timeStyle = {
      ...BASE, fontSize: '16px', padding: '6px 10px', minHeight: '44px', background: C.white,
      border: BORDER, borderRadius: '0', colorScheme: 'light', outline: 'none'
    };
    const startInput = h('input', timeStyle, { type: 'time' });
    const endInput = h('input', timeStyle, { type: 'time' });
    ring(startInput); ring(endInput);
    const small = (t) => h('span', { ...BASE, fontSize: '12px', fontWeight: '800', letterSpacing: '0.08em' }, null, t);
    const recRow = h('div', {
      ...BASE, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', margin: '2px 0 16px 32px'
    }, null, small('FROM'), startInput, small('TO'), endInput);

    // --- actions
    const saveMsg = h('span', { ...BASE, fontSize: '13px', fontWeight: '800' });
    const SAVE_SHADOW = '4px 4px 0 ' + C.ink;
    const saveBtn = h('button', {
      ...BASE, fontSize: '15px', fontWeight: '800', letterSpacing: '0.08em', minHeight: '48px',
      padding: '0 22px', background: C.orange, border: BORDER, borderRadius: '0',
      boxShadow: SAVE_SHADOW, cursor: 'pointer'
    }, { type: 'button' }, 'SAVE');
    saveBtn.dataset.role = 'save';
    press(saveBtn, SAVE_SHADOW);
    const actions = h('div', { display: 'flex', alignItems: 'center', gap: '14px' }, null, saveBtn, saveMsg);

    detailEl = h('div', {
      ...BASE, fontSize: '13px', fontWeight: '700', marginTop: '16px', paddingTop: '10px',
      borderTop: BORDER
    }, null, '');

    // --- footer (the only place the name appears)
    const ver = version();
    const footer = h('div', {
      ...BASE, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px',
      padding: '10px 14px', background: C.yellow, borderTop: BORDER, fontSize: '12px', fontWeight: '700'
    }, null,
      h('span', { ...BASE }, null, 'MADE BY ',
        h('a', { ...BASE, fontWeight: '800', textDecoration: 'underline' },
          { href: BRAND_URL, target: '_blank', rel: 'noopener noreferrer' }, BRAND)),
      h('span', { ...BASE }, null, (ver ? 'V' + ver + ' \u00b7 ' : '') + 'LOCAL ONLY'));

    const body = h('div', { padding: '14px', background: C.paper }, null,
      heading('BLOCKED KEYWORDS'), textarea, hint,
      heading('OPTIONS'),
      optRow(whole, 'Whole words only', 'no partial matches'),
      optRow(recEnabled, 'Recreation time', 'pause blocking between:'),
      recRow, actions, detailEl);

    const panel = h('div', {
      ...BASE, position: 'fixed', left: '16px', bottom: '84px', width: 'min(360px, 92vw)',
      maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', background: C.paper,
      border: BORDER, borderRadius: '0', boxShadow: '8px 8px 0 ' + C.ink,
      zIndex: '2147483647', display: 'none'
    }, null, header, body, footer);

    // --- floating toggle: square key with a status marker
    dotEl = h('span', {
      position: 'absolute', top: '-9px', right: '-9px', width: '16px', height: '16px',
      border: '3px solid ' + C.ink, background: C.grey, borderRadius: '0'
    });
    const TOGGLE_SHADOW = '4px 4px 0 ' + C.ink;
    const toggle = h('button', {
      ...BASE, position: 'fixed', left: '16px', bottom: '20px', width: '52px', height: '52px',
      background: C.paper, border: BORDER, borderRadius: '0', boxShadow: TOGGLE_SHADOW,
      fontSize: '24px', fontWeight: '900', cursor: 'pointer', padding: '0', zIndex: '2147483647'
    }, { type: 'button', title: 'Keyword blocker' }, '\u2715', dotEl);
    press(toggle, TOGGLE_SHADOW);

    function fill() {
      textarea.value = settings.keywords.join('\n');
      whole.checked = settings.wholeWord;
      recEnabled.checked = settings.recreation.enabled;
      startInput.value = settings.recreation.start;
      endInput.value = settings.recreation.end;
    }

    toggle.addEventListener('click', () => {
      const open = panel.style.display === 'none';
      panel.style.display = open ? 'block' : 'none';
      toggle.style.background = open ? C.yellow : C.paper;
      if (open) { fill(); saveMsg.textContent = ''; scan(); }
    });

    let msgTimer = null;
    saveBtn.addEventListener('click', () => {
      const seen = new Set();
      const kws = [];
      for (const part of textarea.value.split(/[\n,]/)) {
        const k = part.trim();
        const norm = k.toLowerCase();
        if (k && !seen.has(norm)) { seen.add(norm); kws.push(k); }
      }
      const next = {
        keywords: kws,
        wholeWord: whole.checked,
        recreation: {
          enabled: recEnabled.checked,
          start: startInput.value || DEFAULTS.recreation.start,
          end: endInput.value || DEFAULTS.recreation.end
        }
      };
      save(next);
      applySettings(next);
      textarea.value = kws.join('\n');
      saveMsg.textContent = '\u2713 SAVED \u00b7 ' + kws.length + (kws.length === 1 ? ' KEYWORD' : ' KEYWORDS');
      clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { saveMsg.textContent = ''; }, 2500);
    });

    root.append(panel, toggle);
    (document.body || document.documentElement).append(host);
    scan();
  }

  // ---------- boot ----------
  async function init() {
    applySettings(await load());
    buildUI();
    scan();
    // Re-check on a timer so recreation time starts/ends even if the page is idle.
    setInterval(scan, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scan(); });

    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true
    });
    document.addEventListener('yt-navigate-finish', schedule);
    document.addEventListener('yt-page-data-updated', schedule);

    // Keep tabs in sync when keywords change elsewhere.
    try {
      if (ext && ext.storage && ext.storage.onChanged) {
        ext.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes[KEY]) applySettings(changes[KEY].newValue);
        });
      }
    } catch (e) {}
  }

  init();
})();
