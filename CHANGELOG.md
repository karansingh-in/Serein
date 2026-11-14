# Changelog

## 1.5.0

- Added the **Hide distracting elements** master switch and 12 independently configurable options.
- Added targeted hiding for Explore/Trending, Community posts, end-screen suggestions, Shorts shelves/navigation, notification and Create controls, merchandise, memberships, promotions, comments, and live chat.
- Kept existing Shorts and recommendation controls working independently.
- Added cooldown protection when disabling the distraction mode or loosening its active checklist.
- Split element discovery into `distractions.js` to keep the content script focused and selectors maintainable.

## 1.6.0

- Added optional autoplay disabling, including the video element and YouTube's autoplay toggle when its enabled state can be identified safely.
- Added default playback speed choices: 1x, 1.25x, 1.5x, 1.75x, and 2x.
- Applies the selected speed to each newly navigated video without repeatedly overriding manual speed changes during the same video.
- Kept playback controls independent from the distraction master switch.
- Added a small `playback.js` module and focused automated tests; no new dependencies or permissions.
