# Serein

**Keep what matters. Remove the noise.**

Serein is a lightweight, local-only Firefox extension that cleans up YouTube. It supports title/channel keyword blocking and inclusion, Shorts controls, and optional distraction controls.

## Current interface

When **Disable distractions** is enabled, Serein simplifies YouTube's interface: it replaces the YouTube logo with a Serein home link, hides the hamburger, Home and Subscriptions navigation entries, topic chips, Create/notifications/account controls, and leaves the You page entry, search field, and microphone available. The search area expands into the freed space. On video pages, Join and Gemini controls are hidden as well. Turning Disable distractions off restores these YouTube controls.

## Privacy

- Settings are stored locally using Firefox storage.
- No accounts, cloud services, analytics, or telemetry.
- Only the `storage` permission is requested.

## Install (temporary)

1. Download and extract the release ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select `manifest.json`.

## Development

Requires Node.js 18 or newer for tests.

```sh
npm test
npm run check
```

## Project

Built by [karansingh-in](https://github.com/karansingh-in).
