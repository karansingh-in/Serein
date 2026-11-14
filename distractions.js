/* YouTube distraction element discovery. Kept separate so selectors stay small and testable. */
(() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    trendingExplore: true,
    communityPosts: true,
    endScreenRecommendations: true,
    shortsShelf: true,
    shortsNavigation: true,
    notificationBell: true,
    createButton: true,
    merchandise: true,
    memberships: true,
    promotions: true,
    comments: true,
    liveChat: true
  });

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = {};
    for (const key of Object.keys(DEFAULTS)) {
      result[key] = source[key] !== false;
    }
    return result;
  }

  function query(doc, selector) {
    try { return doc.querySelectorAll(selector); } catch (_) { return []; }
  }

  function add(doc, desired, selector, closestSelector) {
    for (const element of query(doc, selector)) {
      const target = closestSelector && element.closest
        ? element.closest(closestSelector)
        : null;
      desired.add(target || element);
    }
  }

  function addLabeled(doc, desired, selector, terms, closestSelector) {
    const wanted = terms.map((term) => term.toLowerCase());
    for (const element of query(doc, selector)) {
      const label = [
        element.getAttribute && element.getAttribute('aria-label'),
        element.getAttribute && element.getAttribute('title'),
        element.textContent
      ].filter(Boolean).join(' ').trim().toLowerCase();
      if (!label || !wanted.some((term) => label === term || label.includes(term))) continue;
      const target = closestSelector && element.closest
        ? element.closest(closestSelector)
        : null;
      desired.add(target || element);
    }
  }

  function collect(config, doc, desired) {
    const options = normalize(config);
    const found = desired || new Set();
    if (!doc || typeof doc.querySelectorAll !== 'function') return found;

    if (options.trendingExplore) {
      add(doc, found,
        'a[href="/feed/trending"], a[href^="/feed/trending"], a[href="/feed/explore"], a[href^="/feed/explore"]',
        'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
      addLabeled(doc, found, 'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer',
        ['Explore', 'Trending'], null);
    }

    if (options.communityPosts) {
      add(doc, found,
        'ytd-backstage-post-thread-renderer, ytd-backstage-post-renderer',
        'ytd-rich-item-renderer, ytd-item-section-renderer');
    }

    if (options.endScreenRecommendations) {
      add(doc, found, '.ytp-endscreen-content, .ytp-ce-element, .ytp-ce-covering-overlay');
    }

    if (options.shortsShelf) {
      add(doc, found, 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-shorts');
      for (const element of query(doc, 'ytd-rich-section-renderer')) {
        if (element.querySelector && element.querySelector('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], a[href^="/shorts"]')) {
          found.add(element);
        }
      }
    }

    if (options.shortsNavigation) {
      add(doc, found,
        'ytd-guide-entry-renderer a[href^="/shorts"], ytd-mini-guide-entry-renderer a[href^="/shorts"]',
        'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
      addLabeled(doc, found, 'yt-tab-shape', ['Shorts'], null);
    }

    if (options.notificationBell) {
      add(doc, found,
        'ytd-notification-topbar-button-renderer, #notifications-button, button[aria-label*="Notifications"], button[aria-label*="notifications"]',
        'ytd-notification-topbar-button-renderer');
    }

    if (options.createButton) {
      addLabeled(doc, found,
        'ytd-topbar-menu-button-renderer, ytd-button-renderer, button[aria-label], button[title]',
        ['Create'], 'ytd-topbar-menu-button-renderer');
    }

    if (options.merchandise) {
      add(doc, found, 'ytd-merch-shelf-renderer, ytd-merchandise-shelf-renderer, ytd-product-shelf-renderer');
    }

    if (options.memberships) {
      add(doc, found,
        'ytd-membership-offer-renderer, ytd-membership-button-renderer, ytd-channel-membership-button-renderer, ytd-sponsorships-offer-renderer');
    }

    if (options.promotions) {
      add(doc, found,
        'ytd-brand-video-shelf-renderer, ytd-channel-featured-content-renderer, ytd-statement-banner-renderer, ytd-promoted-sparkles-web-renderer');
    }

    if (options.comments) {
      add(doc, found, 'ytd-comments#comments, #comments');
    }

    if (options.liveChat) {
      add(doc, found,
        'ytd-live-chat-frame, #chat-container, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-live-chat"]');
    }

    return found;
  }

  globalThis.YTKBDistractions = { DEFAULTS, normalize, collect };
})();
