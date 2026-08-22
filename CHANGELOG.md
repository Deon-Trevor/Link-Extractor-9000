# Changelog

Release pages with downloadable builds live at
[Releases](https://github.com/Deon-Trevor/Link-Extractor-9000/releases).

Entries land under Unreleased as work happens. `npm run bump` promotes that
heading to the version being released, so the notes are never written from memory
at release time. Nothing but entries belongs in that section, since it becomes
the release notes verbatim.

## Unreleased

### Added
- `npm run bump <version>` moves the version through `package.json`, both
  manifest templates and every reference in the docs, including the download
  commands people copy. `npm run check` fails while anything still names the old
  version.
- `DEVELOPMENT.md`, holding the build, verification and release instructions that
  were spread across the README and the install guides.

### Changed
- Both install guides describe installing a downloaded release and nothing else.
  Building from a clone moved to `DEVELOPMENT.md`, so each page has one audience.
- The README leads with the release downloads instead of a clone and a build.

### Fixed
- `npm run verify:firefox` could not start a session on Firefox 154, because
  geckodriver 0.37.1 rejects `-remote-allow-system-access` in capabilities and
  owns the flag itself from 0.36. The verifier now takes whichever route the
  installed geckodriver offers.
- The AMO source archive paragraph described the 1.0.0 zip three releases later.

## 1.0.3 (2026-08-21)

### Fixed
- Google result-only mode collected nothing when the results sat on a
  `google.com` subdomain, which is every result of a
  `site:chromewebstore.google.com` query. Those were being discarded as the
  search engine's own links.

### Note
- Telegram Web support was explored and withdrawn before release. Telegram
  renders no public link for a result, so supporting it means deriving one from
  the handle, and three attempts caught the wrong rows. It will return when it
  can be built against a captured search row.

## 1.0.2 (2026-08-20)

### Fixed
- Facebook searches on the Groups, Events and Marketplace tabs returned nothing
  in result-only mode. Those tabs return groups, events and listings, and only
  posts were being collected.

## 1.0.1 (2026-08-20)

### Added
- Chrome and Chromium support, which covers Brave, Edge, Opera and Vivaldi. Build
  with `npm run package` and load `dist/chromium`. See
  [`chromium/INSTALLATION.md`](chromium/INSTALLATION.md).
- [`firefox/INSTALLATION.md`](firefox/INSTALLATION.md) for loading the add-on by
  hand while the AMO listing is pending.

### Fixed
- Brave Search returned "No matching URLs found" in result-only mode. Brave moved
  to Svelte and dropped the `#results` container the selector relied on.
- Audiomack search pages were never detected, because Audiomack searches with
  `?q=` and the adapter only accepted `?query=`.
- Audiomack result mode collected site navigation. `/plus`, `/charts`,
  `/playlists`, `/my-library` and `/world` came back as if they were results.

## 1.0.0 (2026-08-19)

First release.

- Collect every http and https link loaded on a page, across as many pages as you
  like. Duplicates are ignored and capture order is kept.
- On a search results page, choose between the results only and every link on the
  page. Covers Google, Bing, DuckDuckGo, Brave Search, Startpage, MetaSearch and
  SearXNG, plus native search on 61 social, video, audio, streaming and
  threat-intelligence sites.
- Filter by URL or hostname, reorder by capture time or hostname, remove single
  entries, and collapse to one URL per hostname.
- Copy the whole list or only what the filter shows. Export TXT, CSV or JSON.
- Saved count on the toolbar badge.
- Everything stays on the device. No API calls and no telemetry.
