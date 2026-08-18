# Link Extractor 9000

Link Extractor 9000 is a Firefox-first browser extension for collecting URLs across multiple pages without losing your working set when the popup closes.

## Current MVP

- Collect every HTTP or HTTPS link currently loaded on a page.
- Detect Google, Bing, DuckDuckGo, and Brave Search result pages.
- On detected search pages, choose between result URLs only and every page URL.
- Append new URLs to persistent local extension storage.
- Ignore exact duplicates while preserving capture order.
- Copy the complete collection as one URL per line.
- Clear the collection with a two-step confirmation.
- Show the saved count on the extension toolbar badge.

The extension does not call a SERP service or send collected URLs anywhere.

## Run in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose this repository's `manifest.json`.
4. Pin **Link Extractor 9000** to the toolbar.

Firefox unloads temporary add-ons when it restarts, so load the manifest again to continue development. A normally installed, signed release will retain its local collection across browser restarts.

## Development

The extension uses plain HTML, CSS, and JavaScript and has no runtime dependencies.

```bash
npm test
npm run check
```

`src/content/extract-links.js` contains the injected page extractor. Search-result selectors are intentionally isolated there because search engines can change their markup independently of the collection and popup code.
