# Serein

**Keep what matters. Remove the noise.**

Serein is a lightweight, local-only Firefox extension that makes YouTube quieter and more intentional. It filters video cards using title and channel keywords, hides Shorts, and lets you remove a small number of distracting YouTube surfaces.

## Features

- **Block keywords:** Hide videos when the title or channel name matches a blocked term.
- **Only show matching:** When this list is populated, keep videos whose title or channel name matches at least one term.
- **Filter precedence:** Blocked terms always win. An empty inclusion list does not restrict results.
- **Whole-word matching:** Optional whole-word matching, enabled by default. Matching is case-insensitive and supports phrases.
- **Shorts:** Hide Shorts shelves/navigation and redirect direct `/shorts/<id>` links to regular watch pages.
- **Distraction controls:** Independently hide the watch-page recommendation sidebar, end-screen suggestions, and comments; optionally disable autoplay.
- **Appearance:** Light (default), Dark, or Auto.
- **Optional schedule:** A daily local-time window can pause filtering.
- **Local-only:** Settings stay in browser storage. No analytics, telemetry, remote requests, external fonts, or third-party dependencies.

## Interface

A compact circle-slash launcher sits in the bottom-left corner of YouTube, separate from the search bar and native header controls. Clicking it opens the settings panel. The panel uses the lowercase `s e r e i n` wordmark and credits **Built by karansingh-in** in the footer.

## Install (Firefox)

1. Download and extract the release ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on…**.
4. Choose the extracted `manifest.json`.
5. Open or refresh YouTube. Select the Serein circle-slash launcher in the bottom-left corner.

A temporary add-on is removed when Firefox restarts. For permanent use, package and sign the extension through Mozilla Add-ons.

## Configure

1. Enter terms under **Block keywords** to hide matching videos.
2. Optionally enter terms under **Only show matching** to keep only matching videos.
3. Choose whether matching should use whole words.
4. Enable the distraction controls you want.
5. Choose Light, Dark, or Auto appearance and save.

Removing a block term, expanding an existing inclusion list, or disabling an active blocker uses the existing 60-second safety delay. More restrictive changes apply immediately. Pending changes can be cancelled.

## Development

Requires Node.js 18 or newer.

```sh
npm run check
npm test
```

The tests cover matching, inclusion behaviour, Shorts URL conversion, cooldown decisions, and release metadata. Automated tests do not replace live Firefox testing. YouTube changes its DOM regularly; verify the search-bar placement and video-card selectors against current YouTube pages before publishing a stable release.

## Privacy

Serein requests only the `storage` permission. It does not collect browsing history or send settings anywhere. The existing extension ID and storage key are retained for upgrades. Legacy blocked/allowed channel lists are merged into the keyword block/include lists when settings are loaded.
