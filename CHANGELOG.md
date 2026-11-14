# Changelog

## 1.8.0
- Added compact Minimal, Study, and Deep Focus presets using existing settings; no separate preset state or background service.
- Presets adjust Shorts/recommendation focus, the distraction checklist, and autoplay only; keywords, playback speed, time-awareness settings, theme, and recreation schedule are preserved.
- Manual adjustments are identified as Custom.
- Turning autoplay disabling off now follows the existing 60-second loosening cooldown.
- Added unit tests for preset behaviour and detection.

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

## 1.9.0
- Kept the panel compact with native collapsible groups for Focus, Distractions, Playback, Time awareness and Schedule; Focus mode and Keywords remain immediately accessible.
- Added dialog semantics and Escape-to-close keyboard behaviour.
- No dependencies, permissions, background process or new storage format.

## 1.9.0
- Kept the panel compact with native collapsible groups for Focus, Distractions, Playback, Time awareness and Schedule; Focus mode and Keywords remain immediately accessible.
- Added dialog semantics and Escape-to-close keyboard behaviour.
- No dependencies, permissions, background process or new storage format.
