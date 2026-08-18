const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectSearchEngine,
  isPotentialSearchResultsPage,
  mergeUrls,
  normalizeCollection,
  toClipboardText,
} = require("../src/lib/collection.js");

test("detects supported search result pages without matching unrelated pages", () => {
  assert.deepEqual(detectSearchEngine("https://www.google.co.za/search?q=site%3Aexample.com"), {
    id: "google",
    label: "Google",
  });
  assert.deepEqual(detectSearchEngine("https://www.bing.com/search?q=security"), {
    id: "bing",
    label: "Bing",
  });
  assert.deepEqual(detectSearchEngine("https://duckduckgo.com/?q=security"), {
    id: "duckduckgo",
    label: "DuckDuckGo",
  });
  assert.deepEqual(
    detectSearchEngine(
      "https://www.startpage.com/sp/search?query=site%3Aexample.com&cat=web",
    ),
    {
      id: "startpage",
      label: "Startpage",
    },
  );
  assert.deepEqual(detectSearchEngine("https://search.syncpundit.io/search?q=security"), {
    id: "syncpundit-search",
    label: "SyncPundit Search",
  });
  assert.deepEqual(detectSearchEngine("https://searx.syncpundit.io/search?q=security"), {
    id: "searxng",
    label: "SearXNG",
  });
  assert.deepEqual(
    detectSearchEngine("https://www.youtube.com/results?search_query=security"),
    {
      id: "youtube",
      label: "YouTube",
    },
  );
  assert.deepEqual(detectSearchEngine("https://open.spotify.com/search/security"), {
    id: "spotify",
    label: "Spotify",
  });
  assert.equal(detectSearchEngine("https://mail.google.com/mail/u/0/"), null);
  assert.equal(detectSearchEngine("https://example.com/search?q=security"), null);
});

test("flags likely search result URLs for DOM-backed detection", () => {
  assert.equal(isPotentialSearchResultsPage("https://public.example/search?q=security"), true);
  assert.equal(isPotentialSearchResultsPage("https://public.example/results"), true);
  assert.equal(isPotentialSearchResultsPage("https://public.example/?query=security"), true);
  assert.equal(isPotentialSearchResultsPage("https://public.example/articles?q=security"), false);
  assert.equal(isPotentialSearchResultsPage("https://public.example/articles"), false);
  assert.equal(isPotentialSearchResultsPage("about:preferences#search"), false);
});

test("merges URLs in capture order and reports duplicates and rejected values", () => {
  const result = mergeUrls(
    ["https://one.example/", "https://two.example/"],
    ["https://two.example/", "https://three.example/path", "mailto:test@example.com"],
  );

  assert.deepEqual(result.urls, [
    "https://one.example/",
    "https://two.example/",
    "https://three.example/path",
  ]);
  assert.equal(result.added, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.rejected, 1);
});

test("normalizes missing and legacy collection values", () => {
  assert.deepEqual(normalizeCollection(null), { version: 1, urls: [], updatedAt: null });
  assert.deepEqual(normalizeCollection(["https://valid.example", "not-a-url"]), {
    version: 1,
    urls: ["https://valid.example"],
    updatedAt: null,
  });
});

test("exports one URL per line", () => {
  assert.equal(
    toClipboardText(["https://one.example/", "https://two.example/"]),
    "https://one.example/\nhttps://two.example/",
  );
});
