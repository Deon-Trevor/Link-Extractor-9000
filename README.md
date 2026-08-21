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

Neither store listing is live yet, so this is a manual load. Download a build
from [Releases](https://github.com/Deon-Trevor/Link-Extractor-9000/releases) or
build one yourself with `npm run package`.

Each release carries a zip per browser plus a source archive, built on the tag by
CI rather than uploaded from a laptop. The browser zips hold `manifest.json` at
the top level with no wrapping folder, so unpack each one into a directory of its
own and keep that directory around. Neither browser can load the zip itself.

```bash
unzip -d link-extractor-9000 link-extractor-9000-firefox-1.0.3.zip
```

**Firefox.** Open `about:debugging#/runtime/this-firefox`, choose Load Temporary
Add-on, and pick the `manifest.json` inside that directory, or
`dist/firefox/manifest.json` if you built it. Firefox drops temporary add-ons
when it restarts. Full steps, updating, and what to send AMO as source are in
[`firefox/INSTALLATION.md`](firefox/INSTALLATION.md).

**Chrome.** Open `chrome://extensions`, turn on Developer mode, choose Load
unpacked, and pick that directory, or `dist/chromium` if you built it. Chrome
derives the extension's identity from the folder's path, so moving it later costs
you the saved collection. Full steps, including how to update without losing your
collection, are in [`chromium/INSTALLATION.md`](chromium/INSTALLATION.md).

## Development

Plain HTML, CSS, and JavaScript with no runtime dependencies. Everything both
browsers share lives in the root. The only per-platform file is the manifest, kept
as `firefox/manifest.template.json` and `chromium/manifest.template.json`.

Load `dist/firefox` or `dist/chromium`, never `firefox/` or `chromium/`. Those
hold a manifest and nothing else, so an extension loaded from one installs and
then shows an empty popup. The template naming is what stops that happening by
accident.

```bash
npm test             # unit tests
npm run check        # syntax, manifests, icons, popup contrast and type scale
npm run package      # build dist/firefox and dist/chromium, plus a zip each
npm run source       # zip the tracked source for an AMO submission
npm run verify:firefox # drive the Firefox build in a real headless Firefox
npm run verify:chrome  # drive the Chrome build in a real headless Chrome
npm run bump <version> # move the version everywhere it appears
```

Releases come from tags. Run `npm run bump <version>`, which rewrites
`package.json`, both manifest templates, and every version reference in the docs,
including the download commands in the install guides. Add `--dry-run` to list
the edits without writing. Then write the section in
[`CHANGELOG.md`](CHANGELOG.md), which the bump leaves alone on purpose, and push
a `v*` tag.

`npm run check` runs `scripts/verify-versions.mjs`, which fails while anything
still says the old number, the changelog included. The version a doc mentions in
passing is as much a reference as the one in a manifest, since the install guides
name archives people actually download. Versions belonging to other tools, like
the Firefox build a guide was tested against, are left alone.

The workflow in [`.github/workflows/release.yml`](.github/workflows/release.yml)
refuses a tag that disagrees with the manifests or has no changelog section, and
otherwise builds the three archives and opens a draft release with the changelog
section as its notes.

GPL-3.0-only.
