# Serein

**Keep what matters. Remove the noise.**

Serein is a lightweight, local-only Firefox extension that helps make YouTube quieter and more intentional. It can hide videos by keyword, show only videos matching selected terms, remove distracting interface elements, and apply a few practical viewing preferences.

## Features

- **Block keywords:** Hide videos whose card text matches one or more terms.
- **Only show matching videos:** When this list is not empty, keep video cards whose title or channel name matches at least one term. For example, entering `PW` keeps videos with `PW` in the title or channel name. Multiple terms use OR matching.
- **Filter interaction:** Block keywords always take priority over the include list. If the include list is empty, it does not filter anything.
- **Page-specific filtering:** Choose All YouTube, Home, Search results, Subscriptions, or Watch recommendations. Keyword and channel filters run only on the selected surface; Shorts and interface-distraction controls remain independent.
- **Channel filters:** Block videos from matching channel names/handles, or optionally show videos only from channels on an allowlist. Channel filters apply to video cards, not channel directory cards. Blocked channels take priority over allowed channels.
- **Matching options:** Case-insensitive matching, literal keyword text, flexible whitespace, and optional whole-word matching apply to both keyword fields.
- **60-second loosening cooldown:** Changes that can let more content through wait 60 seconds and can be cancelled. More restrictive changes apply immediately.
- **Shorts focus:** Hides Shorts shelves/navigation and redirects `/shorts/<video-id>` links to regular watch pages.
- **Recommendation blocking:** Optionally hides the watch-page recommendation sidebar.
- **Hide distracting elements:** One master switch with individual controls for Trending / Explore, community posts, end-screen recommendations, Shorts shelves/navigation, notification bell, Create button, merchandise, memberships, promotions, comments, and live chat.
- **Focus presets:** Minimal, Study, and Deep Focus configure existing focus, distraction-checklist, and autoplay settings. Study and Deep Focus enable active viewing-time tracking; Minimal disables it. Keywords, playback speed, theme, reminder interval, and recreation schedule are preserved.
- **Playback controls:** Optionally disable autoplay and set a default speed of 1x, 1.25x, 1.5x, 1.75x, or 2x.
- **Time awareness:** Tracks active video playback in the visible tab and can show a break reminder after a selected interval. Paused videos and inactive tabs are not counted.
- **Recreation schedule:** A daily local-time window, including overnight ranges, during which blocking pauses.
- **Theme:** Auto (follows YouTube), Light, or Dark.
- **Local-only storage:** Settings stay in browser storage. No analytics, telemetry, remote requests, external fonts, or third-party dependencies.

## Install (Firefox)

1. Extract the project folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on…**.
4. Choose the project's `manifest.json`.
5. Open YouTube. The Serein button appears near the lower-left corner.

A temporary add-on is removed when Firefox restarts. For permanent use, the extension needs to be packaged and signed through Mozilla Add-ons.

## Configure

1. Open YouTube and click the Serein button.
2. Add terms under **Block keywords** to hide matching content.
3. Add terms under **Only show videos matching** to keep videos whose title or channel matches at least one term.
4. Choose where keyword and channel filters should run under **Filter videos on**.
5. Expand **Channel filters** to block specific channels or allow only selected channels.
6. Choose **Minimal**, **Study**, or **Deep Focus**, or adjust settings manually.
7. Configure Focus, Distractions, Playback, Time awareness, and Schedule as needed.
8. Press **Save**.

Switching from a restricted page scope to another scope or to All YouTube triggers the 60-second cooldown. Removing a block keyword or blocked channel, expanding or clearing a non-empty video/channel allowlist, broadening whole-word matching on an allowlist, or disabling an active blocking feature may trigger the 60-second cooldown. Adding block terms or narrowing an allowlist applies immediately. Tightening filters applies immediately.

## Tests

Requires Node.js 18 or newer:

```sh
npm run check
npm test
```

Tests cover matching, page-scope selection, include/block interaction rules, cooldown detection, schedules, Shorts URL conversion, distraction controls, focus presets, playback preferences, and active viewing-time tracking using lightweight DOM stubs. They do not replace testing against YouTube's live DOM. YouTube changes its markup periodically, so selectors should be checked in Firefox after installation.

## Privacy

Serein requests only the `storage` permission. It does not collect browsing history, send settings anywhere, or load code, fonts, or assets from remote servers. Viewing-time totals are kept in tab-scoped session storage and are not synced.
