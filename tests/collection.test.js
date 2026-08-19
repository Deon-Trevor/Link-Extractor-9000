const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createExportFile,
  dedupeUrlsByHostname,
  detectSearchEngine,
  filterUrls,
  isPotentialSearchResultsPage,
  mergeUrls,
  normalizeCollection,
  removeUrl,
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

test("filters saved URLs by full URL or hostname without changing capture order", () => {
  const urls = [
    "https://one.example/reports/Alpha",
    "https://two.example/profile",
    "https://news.test/reports/beta",
    "not-a-url",
  ];

  assert.deepEqual(filterUrls(urls, "TWO.EXAMPLE"), ["https://two.example/profile"]);
  assert.deepEqual(filterUrls(urls, "reports"), [
    "https://one.example/reports/Alpha",
    "https://news.test/reports/beta",
  ]);
  assert.deepEqual(filterUrls(urls, "  "), urls.slice(0, 3));
});

test("removes an exact saved URL while preserving the remaining order", () => {
  assert.deepEqual(
    removeUrl(
      ["https://one.example/", "https://two.example/", "https://one.example/"],
      "https://one.example/",
    ),
    { urls: ["https://two.example/"], removed: 2 },
  );
});

test("deduplicates by normalized hostname and keeps the first captured URL", () => {
  const result = dedupeUrlsByHostname([
    "https://www.example.com/first",
    "https://example.com/second",
    "https://blog.example.com/post",
    "https://two.example/path",
    "https://two.example/other",
    "mailto:test@example.com",
  ]);

  assert.deepEqual(result.urls, [
    "https://www.example.com/first",
    "https://blog.example.com/post",
    "https://two.example/path",
  ]);
  assert.equal(result.removed, 2);
  assert.equal(result.rejected, 1);
});

test("exports one URL per line", () => {
  assert.equal(
    toClipboardText(["https://one.example/", "https://two.example/"]),
    "https://one.example/\nhttps://two.example/",
  );
});

test("builds timestamped TXT, CSV, and JSON downloads", () => {
  const urls = [
    "https://one.example/path",
    'https://two.example/?q="quoted",value',
  ];
  const exportedAt = new Date("2026-08-19T01:23:45.678Z");

  assert.deepEqual(createExportFile(urls, "txt", exportedAt), {
    filename: "link-extractor-9000-2026-08-19T01-23-45Z.txt",
    mimeType: "text/plain;charset=utf-8",
    contents: `${urls.join("\n")}\n`,
  });
  assert.deepEqual(createExportFile(urls, "csv", exportedAt), {
    filename: "link-extractor-9000-2026-08-19T01-23-45Z.csv",
    mimeType: "text/csv;charset=utf-8",
    contents:
      'url\r\n"https://one.example/path"\r\n"https://two.example/?q=""quoted"",value"\r\n',
  });
  assert.deepEqual(createExportFile(urls, "json", exportedAt), {
    filename: "link-extractor-9000-2026-08-19T01-23-45Z.json",
    mimeType: "application/json;charset=utf-8",
    contents: `${JSON.stringify(urls, null, 2)}\n`,
  });
});

test("export files reject unknown formats and invalid timestamps", () => {
  assert.throws(() => createExportFile([], "xml"), /Unsupported export format/);
  assert.throws(
    () => createExportFile([], "txt", "not-a-date"),
    /valid date/,
  );
});
