const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectSearchEngine,
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
  assert.equal(detectSearchEngine("https://mail.google.com/mail/u/0/"), null);
  assert.equal(detectSearchEngine("https://example.com/search?q=security"), null);
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
