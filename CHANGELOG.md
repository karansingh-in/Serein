# Changelog

## 3.0.14
- Added **Open videos in theater mode**. Each watch page is switched to theater mode once; leaving it by hand is respected for that video.
- Added **Turn off ambient glow**, which hides the coloured glow around the player.
- Both are layout options: they do not count as filters in the status line, turning them off does not trigger the 60-second wait, and both pause during recreation time.

## 3.0.13
- Watch page: when recommendations are hidden, the title row, action buttons, description and comments now use the full width instead of stopping where the empty right column used to be. Recreation time restores the normal layout.
- Hid the "Ask" (Gemini) button in the watch action row. It is matched by its accessible label, title or text, because the newer markup gives its icon no name.

## 3.0.12
- Fixed the empty translucent band left under the search bar on the homepage. YouTube grows its frosted-glass header backdrop (`#frosted-glass.with-chipbar`) to sit behind the topic chips; with the chips removed, that backdrop is now kept at the masthead height.

## 3.0.11
- Fixed the distraction-mode stylesheet never matching: the `data-serein-distractions` flag was written as an empty attribute value, so every `[data-serein-distractions="true"]` rule was inert. The guide width, homepage feed width and grid columns now apply as intended.
- Reclaimed the empty left sidebar for the homepage feed and dropped the home grid from five narrow columns to four larger cards.
- Kept video titles to a single line with the ellipsis intact, so cards are shorter and the feed reads calmer.
- Hid YouTube's promotional and paid-content labels ("Featured", rupee and "try for 0 rupees" badges).
- Made the Serein wordmark and leaf a working link to the YouTube homepage by rendering them inside the real anchor.
- Fixed the wordmark and the "You" shortcut being invisible or black-on-black: they now follow the YouTube light/dark theme.
- Restored the original v3.0.8 leaf in the YouTube masthead, matching the extension icon and the settings panel.
- Fixed keyword filtering: current video cards are read from the new lockup markup, and a card whose title cannot be read is left visible instead of being hidden.
- Fixed search sizing, which targeted a `#search` element YouTube no longer renders.
- Reduced the DOM sweep frequency so the extension no longer re-scans on every page mutation.

## 3.0.10
- Restored the original v3.0.8 leaf mark in the extension icon, settings brand mark, and YouTube masthead branding.
