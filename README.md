# Link Extractor 9000

<img src="assets/logo-lockup.png" alt="Link Extractor 9000" width="600">

A browser extension that harvests the links off a page into one list you can copy
or export. Runs on Firefox and Chrome.

Click the toolbar button, hit collect, and every http and https link loaded on
that page is saved. Move to the next page and collect again. The list keeps
growing until you clear it, and closing the popup does not lose it.

## What it does

- Collects every loaded link on any page.
- On a search results page, asks whether you want just the results or everything
  on the page. Knows Google, Bing, DuckDuckGo, Brave Search, Startpage,
  MetaSearch, and SearXNG, plus native search on 61 social, video, audio,
  streaming, and threat-intelligence sites. The routes and result shapes for
  those are in `src/lib/search-adapters.js`.
- Ignores duplicates and keeps the order things were captured in.
- Filters by URL or hostname, reorders by time or hostname, removes single
  entries, and collapses down to one URL per hostname.
- Copies the whole list or only what the filter shows, and exports TXT, CSV, or
  JSON.
- Counts what you have saved on the toolbar badge.

Everything stays on your device. No API calls, no telemetry, nothing sent
anywhere.

## Install

Neither store listing is live yet, so build it and load the unpacked result:

```bash
npm run package
```

**Firefox.** Open `about:debugging#/runtime/this-firefox`, choose Load Temporary
Add-on, and pick `dist/firefox/manifest.json`. Firefox drops temporary add-ons
when it restarts.

**Chrome.** Open `chrome://extensions`, turn on Developer mode, choose Load
unpacked, and pick `dist/chromium`. Full steps, including how to update without
losing your collection, are in
[`chromium/INSTALLATION.md`](chromium/INSTALLATION.md).

## Development

Plain HTML, CSS, and JavaScript with no runtime dependencies. Everything both
browsers share lives in the root. The only per-platform file is the manifest, in
`firefox/` and `chromium/`.

```bash
npm test             # unit tests
npm run check        # syntax, manifests, icons, popup contrast and type scale
npm run package      # build dist/firefox and dist/chromium, plus a zip each
npm run verify:firefox # drive the Firefox build in a real headless Firefox
npm run verify:chrome  # drive the Chrome build in a real headless Chrome
```

GPL-3.0-only.
