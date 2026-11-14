# Changelog

## 2.0.0
- Final release hardening and regression pass.
- Study and Deep Focus now enable active viewing-time tracking by default; Minimal disables it.
- Presets preserve the user's selected break-reminder interval, keywords, playback speed, theme, and recreation schedule.
- Selecting a preset updates the visible time-tracking control immediately.
- Fixed timer lifecycle synchronization: tracking now starts/stops when settings load or change, rather than relying on a tab visibility event.
- Added regression tests for preset timer defaults, Custom detection, UI synchronization, and release manifest integrity.
- Kept the extension dependency-free and limited to the existing `storage` permission.

## 1.9.0
- Kept the panel compact with native collapsible groups for Focus, Distractions, Playback, Time awareness, and Schedule; Focus mode and Keywords remain immediately accessible.
- Added dialog semantics and Escape-to-close keyboard behaviour.

## 1.8.0
- Added compact Minimal, Study, and Deep Focus presets using existing settings; no separate preset state or background service.
- Presets adjust Shorts/recommendation focus, the distraction checklist, and autoplay; manual adjustments are identified as Custom.
- Turning autoplay disabling off follows the existing 60-second loosening cooldown.

## 1.7.0
- Added optional active-video viewing-time awareness.
- Counts time only while a video is actively playing in the visible YouTube tab.
- Paused videos, ended videos, unloaded media, and background tabs are not counted.
- Added optional 30, 45, 60, or 90 minute break reminders.
- Session totals persist across page reloads in tab-scoped `sessionStorage` and reset after 15 minutes without active playback.

## 1.6.0
- Added optional autoplay disabling and default playback-speed selection.

## 1.5.0
- Added the Hide distracting elements master switch and individual controls.
