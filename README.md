# Link Extractor 9000

<img src="assets/logo-lockup.png" alt="Link Extractor 9000" width="600">

A Firefox extension that harvests the links off a page into one list you can copy
or export.

Click the toolbar button, hit collect, and every http and https link loaded on
that page is saved. Move to the next page and collect again. The list keeps
growing until you clear it, and closing the popup does not lose it.

## What it does

- Collects every loaded link on any page.
- On a search results page, asks whether you want just the results or everything
  on the page. Knows Google, Bing, DuckDuckGo, Brave Search, Startpage,
  MetaSearch, and SearXNG, plus native search on 61 social, video, audio,
  streaming, and threat-intelligence sites. See
  [`docs/platform-support.md`](docs/platform-support.md) for the full list and
  its limits.
- Ignores duplicates and keeps the order things were captured in.
- Filters by URL or hostname, reorders by time or hostname, removes single
  entries, and collapses down to one URL per hostname.
- Copies the whole list or only what the filter shows, and exports TXT, CSV, or
  JSON.
- Counts what you have saved on the toolbar badge.

Everything stays on your device. No API calls, no telemetry, nothing sent
anywhere.

## Install

Not on addons.mozilla.org yet. To run it from this repo:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and pick `manifest.json`.
3. Pin **Link Extractor 9000** to the toolbar.

Firefox drops temporary add-ons when it restarts.

## Development

Plain HTML, CSS, and JavaScript with no runtime dependencies.

```bash
npm test           # unit tests
npm run check      # syntax, icons, popup contrast and type scale
npm run package    # build dist/link-extractor-9000-<version>.zip
```

GPL-3.0-only.
