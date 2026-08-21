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
  streaming, and threat-intelligence sites.
- Ignores duplicates and keeps the order things were captured in.
- Filters by URL or hostname, reorders by time or hostname, removes single
  entries, and collapses down to one URL per hostname.
- Copies the whole list or only what the filter shows, and exports TXT, CSV, or
  JSON.
- Counts what you have saved on the toolbar badge.

Everything stays on your device. No API calls, no telemetry, nothing sent
anywhere.

## Install

Neither store listing is live yet, so this is a manual load. Grab the zip for
your browser from
[Releases](https://github.com/Deon-Trevor/Link-Extractor-9000/releases) and
unzip it into an empty directory of its own. The archive holds `manifest.json` at
the top level with no wrapping folder, and neither browser can load the zip
itself.

```bash
unzip -d link-extractor-9000 link-extractor-9000-firefox-1.0.3.zip
```

**Firefox.** Open `about:debugging#/runtime/this-firefox`, choose Load Temporary
Add-on, and pick the `manifest.json` inside that directory. Firefox drops
temporary add-ons when it restarts. Full steps, updating, and the things Firefox
does that look like problems are in
[`firefox/INSTALLATION.md`](firefox/INSTALLATION.md).

**Chrome.** Open `chrome://extensions`, turn on Developer mode, choose Load
unpacked, and pick that directory. Chrome derives the extension's identity from
the folder's path, so moving it later costs you the saved collection. Full steps,
including how to update without losing it, are in
[`chromium/INSTALLATION.md`](chromium/INSTALLATION.md).

Each release also carries a source archive, built on the tag by CI rather than
uploaded from a laptop.

## Development

Plain HTML, CSS, and JavaScript, Node 22 to build, no dependencies at either end.
Building, testing, driving a real browser, and cutting a release are in
[`DEVELOPMENT.md`](DEVELOPMENT.md).

GPL-3.0-only.
