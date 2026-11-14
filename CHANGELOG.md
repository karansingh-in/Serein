# Changelog

## 1.7.0
- Added optional active-video viewing-time awareness.
- Counts time only while a video is actively playing in the visible YouTube tab.
- Paused videos, ended videos, unloaded media and background tabs are not counted.
- Added optional 30, 45, 60 or 90 minute break reminders.
- Session totals persist across page reloads in tab-scoped `sessionStorage` and reset after 15 minutes without active playback.
- Timer interval runs only while tracking is enabled and the tab is visible.
- Added focused unit tests for tracking, idle reset, reminders and session persistence.

## 1.6.0
- Added optional autoplay disabling and default playback-speed selection.

## 1.5.0
- Added the Hide distracting elements master switch and individual controls.
