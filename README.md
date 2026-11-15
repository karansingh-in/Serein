# Serein

**Keep what matters. Remove the noise.**

Serein is a lightweight, local-only Firefox extension for cleaning up YouTube. It filters video cards by title and channel name, hides Shorts and selected distraction surfaces, and keeps its settings on-device.

## Features

### Content filtering
- Block videos whose title or channel name matches one or more keywords.
- Optionally show only videos matching the include list.
- Case-insensitive matching with optional whole-word matching.
- Blocked terms always take priority over included terms.

### Distraction controls
- A master **Disable distractions** switch reveals the distraction checklist.
- Hide Shorts and redirect Shorts URLs to their regular watch page.
- Hide the watch-page recommendation column.
- Optionally hide end-screen suggestions and comments.
- Optionally disable autoplay.

### Recreation time
Pause Serein's filters during a configurable daily time window. The window supports overnight ranges.

### Appearance
- Light, dark, and automatic themes.
- Light mode is the default for new installations.
- Blue interface accents; green/red status indicator for active/off filtering.

## Privacy and permissions
- Settings are stored locally using Firefox extension storage.
- No accounts, cloud sync, analytics, telemetry, or external services.
- The only declared permission is `storage`.

## Install in Firefox
1. Download and extract the release ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose the extracted `manifest.json`.

For a permanent public installation, the extension must be packaged and distributed through an appropriate Firefox add-on channel.

## Development
Requires Node.js 18 or newer.

```sh
npm test
npm run check
```

Automated tests cover the matcher, settings/release invariants, and static product UI requirements. They do not replace manual testing against live YouTube pages; YouTube's DOM changes over time.

## Branding
**Serein** · `s e r e i n`  
Built by [karansingh-in](https://github.com/karansingh-in)  
Repository: [karansingh-in/Serein](https://github.com/karansingh-in/Serein)
