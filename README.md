# Link Extractor 9000

<img src="assets/logo-lockup.png" alt="Link Extractor 9000" width="600">

Link Extractor 9000 is a Firefox-first browser extension for collecting URLs across multiple pages without losing your working set when the popup closes.

## Current MVP

- Collect every HTTP or HTTPS link currently loaded on a page.
- Detect Google, Bing, DuckDuckGo, Brave Search, Startpage, SyncPundit Search at
  `search.syncpundit.io`, and SearXNG result pages.
- Recognize other SearXNG instances and conventional `/search` or `/results`
  pages when their rendered result structure confirms that they are search pages.
- Detect native search pages across major social, video, audio, and subscription
  streaming platforms using stable URL shapes, with semantic result scopes where
  a platform mixes search results with navigation or recommendations.
- On detected search pages, choose between result URLs only and every page URL.
- Append new URLs to persistent local extension storage.
- Ignore exact duplicates while preserving capture order.
- Copy the complete collection as one URL per line.
- Clear the collection with a two-step confirmation.
- Show the saved count on the extension toolbar badge.

The extension does not call a SERP service or send collected URLs anywhere.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose this repository's `manifest.json`.
4. Open Firefox's extensions menu and pin **Link Extractor 9000** to the toolbar.

Firefox unloads temporary add-ons when it restarts, so load the manifest again to continue development. A normally installed, signed release will retain its local collection across browser restarts.

## Use the extension

### Collect links from a regular page

1. Open the page whose links you want to collect.
2. Select **Link Extractor 9000** in the Firefox toolbar.
3. Select **Collect every page URL**.
4. Check the result shown below the button. It reports how many URLs were added and how many duplicates were ignored.
5. Close the popup or move to another page. Your collection remains saved locally.
6. Repeat these steps on as many pages as needed. New URLs are appended to the existing collection.

### Collect links from search results

On supported Google, Bing, DuckDuckGo, Brave Search, Startpage, SyncPundit
Search, and SearXNG result pages, the popup asks what to collect. The same prompt
appears on other `/search` and `/results` pages when their rendered markup
contains a recognizable result list:

- **Result URLs only** collects detected search-result destinations while excluding search controls, navigation, and internal search-engine links.
- **Every URL on page** collects every loaded HTTP or HTTPS link, including navigation and other page links.

Choose a mode and select **Collect result URLs** or **Collect every page URL**. Result-only mode is selected by default.

Native platform search coverage includes YouTube, Reddit, X/Twitter, TikTok,
Instagram, Facebook, LinkedIn, Threads, Bluesky, Pinterest, Tumblr, Mastodon,
Twitch, Vimeo, Dailymotion, Rumble, Odysee, Kick, SoundCloud, Spotify, Apple
Music, Bandcamp, Mixcloud, Audiomack, Bilibili, Crunchyroll, Netflix, Prime
Video, Disney+, Max, Hulu, and Tubi. See
[`docs/platform-support.md`](docs/platform-support.md) for support levels and
known limitations.

### Copy or clear the collection

- Select **Copy all** to place the complete collection on the clipboard, with one URL per line. Copying does not clear it.
- Select **Clear**, then **Confirm clear**, to permanently empty the collection.
- The number on the extension's toolbar badge is the current saved URL count.

## Usage notes

- Only links currently loaded in the page are available. Scroll or load more search results before collecting from an infinite-scrolling page.
- Exact duplicate URLs are ignored across every collection run. Capture order is preserved.
- Firefox-protected pages such as `about:` pages cannot be inspected by extensions.
- Search engines can change their result markup. If result-only mode returns nothing, use **Every URL on page** and report the affected search engine.
- The extension stores URLs on the local device and does not send them to a server.

## Development

The extension uses plain HTML, CSS, and JavaScript and has no runtime dependencies.

```bash
npm test
npm run check
```

`src/content/extract-links.js` contains the injected page extractor.
`src/lib/search-adapters.js` defines native platform search routes and stable
result URL shapes. Search-provider selectors remain isolated in the extractor
because providers can change their markup independently of the collection and
popup code.

Sanitized Firefox DOM projections under `tests/fixtures/` provide deterministic
regression coverage for representative live search pages without retaining page
text, cookies, or browser-profile data.

## Logo and brand assets

| File | Use |
| --- | --- |
| `assets/logo-mark.svg` | Master mark. Gradient tube, bevel highlights, and a soft drop shadow. Use at 48px and above. |
| `assets/logo-mark-small.svg` | Simplified mark with heavier strokes and larger link holes for 16px and 32px. |
| `assets/logo-lockup.svg` | Horizontal mark plus wordmark on a console panel. `assets/logo-lockup.png` is the rendered copy used above. |
| `icons/icon-*.png` | Rendered toolbar and installation icons declared in `manifest.json`. |

The mark is a chain link cut by an amber extraction bar. It has no background
plate, so it sits directly on light, dark, and coloured browser toolbars; the dark
green outline keeps the silhouette readable on any of them. Palette: signal lime
`#c7ff4a`, amber `#ffbd59`, outline `#22320a`.

The popup masthead loads `assets/logo-mark.svg` directly, so editing that file
updates the in-extension header. Regenerate the PNGs after editing an SVG, using
any SVG rasterizer at the target pixel size. The 16px and 32px icons come from
`logo-mark-small.svg`; the rest come from `logo-mark.svg`.
