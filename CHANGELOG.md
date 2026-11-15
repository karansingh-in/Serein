# Changelog

## 2.1.0 — Serein

- Renamed the extension to **Serein**.
- Added an **Only show videos matching** field. Matching video cards are retained when the title or channel name matches at least one configured term.
- Kept block keywords higher priority than include keywords.
- Applied the existing whole-word preference to both keyword fields.
- Added cooldown handling for include-list changes that can broaden what is visible.
- Preserved the existing settings key and Firefox extension ID so an upgrade can retain saved preferences.

## 2.0.0

- Added active viewing-time awareness and break reminders.
- Added focus presets and refreshed the settings interface.

## 2.2.0

- Added channel blocklist and allowlist filters using channel names and handles.
- Channel blocklist takes priority over the channel allowlist.
- Integrated channel filter changes with the 60-second loosening cooldown.
- Kept settings local and added no permissions or dependencies.

## 2.3.0

- Added a **Filter videos on** setting: All YouTube, Home, Search results, Subscriptions, or Watch recommendations.
- Keyword and channel filters now respect the selected page scope.
- Shorts handling and interface-distraction controls remain independent of page scope.
- Added a conservative cooldown when changing an already-restricted scope.
