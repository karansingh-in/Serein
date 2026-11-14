# YT Keyword Blocker

A small, local-only YouTube focus extension. It hides videos matching keywords, can remove Shorts entry points, optionally hides watch-page recommendations, and supports a scheduled recreation window.

## Features

- **Keyword blocking:** case-insensitive matching, literal keyword text (including punctuation), flexible whitespace, and optional whole-word matching.
- **Shorts focus:** hides Shorts shelves/navigation entries and redirects `/shorts/<video-id>` links to the regular watch page.
- **Optional rabbit-hole blocking:** hides the watch-page recommendation sidebar and end-screen suggestion cards. The playlist queue is intentionally left alone.
- **60-second loosening cooldown:** changes that allow more content through wait 60 seconds and can be cancelled. Tightening changes apply immediately.
- **Recreation schedule:** daily local-time window, including overnight ranges. Blocking pauses during that window.
- **Theme:** Auto (follows YouTube's theme), Light, or Dark.
- **Local-only storage:** settings are saved using the browser extension storage API. No analytics, telemetry, remote requests, or external fonts.

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
3. Enable **Hide Shorts** and/or **Hide recommendations** as desired.
4. Set a recreation window if you want blocking to pause at a regular time.
5. Press **Save**.

Removing keywords, disabling either focus feature, changing whole-word matching to a less restrictive mode, or expanding the recreation window starts the 60-second cooldown. The pending change can be cancelled.

## Tests

Requires Node.js 18 or newer:

```sh
node --check matcher.js
node --check content.js
node --test test/matcher.test.js
```

The matcher tests cover keyword matching, schedule boundaries, loosening detection, and Shorts URL conversion. They do not replace testing against YouTube's live DOM; YouTube changes its markup periodically, so Shorts shelves and recommendation selectors should be checked after installation.

## Privacy

The extension requests only the `storage` permission. It does not collect browsing history, send settings anywhere, or load code, fonts, or assets from remote servers.
