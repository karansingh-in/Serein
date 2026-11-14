# YT Keyword Blocker

A small, local-only YouTube focus extension. It filters videos by keyword, handles Shorts, can hide selected YouTube interface distractions, and supports a scheduled recreation window.

## Features

- **Compact settings panel:** Focus mode and keyword entry stay visible; less frequently changed controls live in native collapsible sections. Press Escape to close the panel.

- **Focus presets:** Minimal, Study, and Deep Focus configure existing Shorts, recommendation, distraction-checklist, and autoplay settings. Study and Deep Focus automatically enable active viewing-time tracking; Minimal disables it. Your reminder interval, keywords, playback speed, theme, and recreation schedule are preserved. Manual adjustments are recognized as Custom.

- **Keyword blocking:** case-insensitive matching, literal keyword text (including punctuation), flexible whitespace, and optional whole-word matching.
- **Shorts focus:** hides Shorts shelves/navigation and redirects `/shorts/<video-id>` links to regular watch pages.
- **Recommendation blocking:** optionally hides the watch-page recommendation sidebar.
- **Hide distracting elements:** one master switch with individual controls for:
  - Trending / Explore
  - Community posts
  - End-screen recommendations
  - Shorts shelves and navigation
  - Notification bell and Create button
  - Merchandise, membership and promotional sections
  - Comments and live chat
- **60-second loosening cooldown:** changes that allow more content through wait 60 seconds and can be cancelled. Tightening changes apply immediately.
- **Playback controls:** optionally disable YouTube autoplay and set a default speed of 1x, 1.25x, 1.5x, 1.75x, or 2x. The chosen speed is applied to each newly opened video; manual speed changes are not overwritten during the same video.
- **Time awareness:** tracks active video playback in the visible tab, shows a session timer, and can display a break reminder after 30, 45, 60, or 90 minutes. It is enabled automatically in Study and Deep Focus, but can be changed in Custom. Paused videos and inactive tabs are not counted. Sessions reset after 15 minutes without active playback.
- **Recreation schedule:** daily local-time window, including overnight ranges. Blocking pauses during that window.
- **Theme:** Auto (follows YouTube's theme), Light, or Dark.
- **Local-only storage:** settings are saved using the browser extension storage API. No analytics, telemetry, remote requests, or external fonts.

The distraction master switch is off by default. When enabled, the selected checklist items are hidden. Individual checklist choices are remembered when the master switch is turned off. The existing Shorts and recommendation controls remain available independently; while the distraction master is enabled, its Shorts shelf/navigation and end-screen choices take precedence over the corresponding legacy hiding behaviour.

## Install (Firefox)

This project currently uses a Manifest V2 WebExtension manifest and is intended for Firefox.

1. Extract the project folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on…**.
4. Choose the project's `manifest.json`.
5. Open YouTube. The small floating blocker button appears near the lower-left corner.

A temporary add-on is removed when Firefox restarts. For permanent use, the extension needs to be packaged and signed through Mozilla Add-ons.

## Configure

1. Open YouTube and click the floating blocker button.
2. Add one keyword per line (commas also separate keywords).
3. Choose **Minimal**, **Study**, or **Deep Focus**, or adjust settings manually (shown as **Custom**).
4. Configure **Focus** options and enable **Hide distracting elements** and expand **Choose elements** to customize the checklist.
5. Choose autoplay and default playback-speed preferences in **Playback**.
6. Configure **Time awareness** if desired. Study and Deep Focus enable active viewing-time tracking automatically; choose a reminder interval separately.
7. Set a recreation window if desired.
8. Press **Save**.

Removing filters or disabling an active blocking feature starts the 60-second cooldown. The pending change can be cancelled.

## Tests

Requires Node.js 18 or newer:

```sh
npm run check
npm test
```

Tests cover keyword matching, schedule boundaries, loosening detection, Shorts URL conversion, distraction-option normalization and element discovery, focus preset application and detection, playback preference normalization, speed application, autoplay-state handling, and active viewing-time tracking using lightweight DOM stubs. They do not replace testing against YouTube's live DOM. YouTube changes its markup periodically, so each selector should be checked in Firefox after installation.

## Privacy

The extension requests only the `storage` permission. It does not collect browsing history, send settings anywhere, or load code, fonts, or assets from remote servers. Viewing-time totals are kept in tab-scoped session storage and are not synced.
