/* Small presets that map to existing settings; no separate runtime state. */
(() => {
  'use strict';

  const PRESETS = Object.freeze({
    minimal: Object.freeze({
      focus: Object.freeze({ shorts: true, rabbit: false }),
      distractionMode: true,
      distractions: Object.freeze({
        trendingExplore: false,
        communityPosts: false,
        endScreenRecommendations: true,
        shortsShelf: true,
        shortsNavigation: true,
        notificationBell: false,
        createButton: false,
        merchandise: true,
        memberships: true,
        promotions: true,
        comments: false,
        liveChat: false
      }),
      disableAutoplay: false,
      timeAwareness: Object.freeze({ enabled: false })
    }),
    study: Object.freeze({
      focus: Object.freeze({ shorts: true, rabbit: true }),
      distractionMode: true,
      distractions: Object.freeze({
        trendingExplore: true,
        communityPosts: true,
        endScreenRecommendations: true,
        shortsShelf: true,
        shortsNavigation: true,
        notificationBell: false,
        createButton: false,
        merchandise: true,
        memberships: true,
        promotions: true,
        comments: true,
        liveChat: true
      }),
      disableAutoplay: true,
      timeAwareness: Object.freeze({ enabled: true })
    }),
    deep: Object.freeze({
      focus: Object.freeze({ shorts: true, rabbit: true }),
      distractionMode: true,
      distractions: Object.freeze({
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
      }),
      disableAutoplay: true,
      timeAwareness: Object.freeze({ enabled: true })
    })
  });

  function apply(id, settings) {
    const preset = PRESETS[id];
    if (!preset) return settings;
    return {
      ...settings,
      focus: { ...settings.focus, ...preset.focus },
      distractionMode: preset.distractionMode,
      distractions: { ...settings.distractions, ...preset.distractions },
      playback: { ...settings.playback, disableAutoplay: preset.disableAutoplay },
      timeAwareness: { ...settings.timeAwareness, enabled: preset.timeAwareness.enabled }
    };
  }

  function identify(settings) {
    for (const [id, preset] of Object.entries(PRESETS)) {
      if (settings.distractionMode !== preset.distractionMode) continue;
      if (settings.focus.shorts !== preset.focus.shorts || settings.focus.rabbit !== preset.focus.rabbit) continue;
      if (settings.playback.disableAutoplay !== preset.disableAutoplay) continue;
      if (settings.timeAwareness.enabled !== preset.timeAwareness.enabled) continue;
      const matches = Object.keys(preset.distractions).every((key) =>
        settings.distractions[key] === preset.distractions[key]);
      if (matches) return id;
    }
    return 'custom';
  }

  globalThis.YTKBPresets = { PRESETS, apply, identify };
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.YTKBPresets;
})();
