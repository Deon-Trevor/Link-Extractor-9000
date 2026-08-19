const test = require("node:test");
const assert = require("node:assert/strict");

const extractLinksFromPage = require("../src/content/extract-links.js");

function anchor(href, { heading = false, advertisement = false, braveResult = false } = {}) {
  return {
    href,
    getAttribute(name) {
      return name === "href" ? href : null;
    },
    querySelector(selector) {
      if (selector === "h3") return heading ? {} : null;
      if (selector === ".snippet-title") return braveResult ? {} : null;
      return null;
    },
    closest(selector) {
      if (selector.includes("data-text-ad")) return advertisement ? {} : null;
      if (selector === ".snippet") return braveResult ? {} : null;
      return null;
    },
  };
}

function fakeDocument(selectorMap, singleSelectorMap = {}) {
  return {
    querySelector(selector) {
      return singleSelectorMap[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === "*") return [];
      return selectorMap[selector] || [];
    },
  };
}

function withPage(url, documentValue, callback) {
  const previousDocument = global.document;
  const previousLocation = global.location;
  global.document = documentValue;
  global.location = new URL(url);

  try {
    return callback();
  } finally {
    global.document = previousDocument;
    global.location = previousLocation;
  }
}

test("all mode collects HTTP links, preserves order, and removes exact duplicates", () => {
  const links = [
    anchor("https://one.example/path"),
    anchor("mailto:test@example.com"),
    anchor("https://one.example/path"),
    anchor("/relative"),
  ];
  const page = fakeDocument({ "a[href], area[href]": links });

  const result = withPage("https://source.example/page", page, () =>
    extractLinksFromPage({ scope: "all" }),
  );

  assert.deepEqual(result.urls, [
    "https://one.example/path",
    "https://source.example/relative",
  ]);
  assert.equal(result.candidates, 4);
});

test("Google result mode keeps organic headings, excludes ads, and unwraps redirects", () => {
  const selector = "#search a[href]";
  const page = fakeDocument({
    [selector]: [
      anchor("https://www.google.co.za/url?q=https%3A%2F%2Fresult.example%2Freport", {
        heading: true,
      }),
      anchor("https://www.google.co.za/search?q=another", { heading: true }),
      anchor("https://ad.example/", { heading: true, advertisement: true }),
      anchor("https://decorative.example/"),
    ],
  });

  const result = withPage("https://www.google.co.za/search?q=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "google" }),
  );

  assert.deepEqual(result.urls, ["https://result.example/report"]);
  assert.equal(result.candidates, 2);
});

test("DuckDuckGo result mode unwraps its outbound redirect URLs", () => {
  const selector = 'a[data-testid="result-title-a"][href], a.result__a[href]';
  const page = fakeDocument({
    [selector]: [
      anchor("https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example%2Ffinding"),
    ],
  });

  const result = withPage("https://duckduckgo.com/?q=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "duckduckgo" }),
  );

  assert.deepEqual(result.urls, ["https://target.example/finding"]);
});

test("Bing result mode unwraps encoded result redirect URLs", () => {
  const selector = "#b_results li.b_algo h2 a[href], #b_results .b_algo h2 a[href]";
  const target = "https://target.example/bing-finding";
  const encodedTarget = `a1${Buffer.from(target).toString("base64url")}`;
  const page = fakeDocument({
    [selector]: [anchor(`https://www.bing.com/ck/a?u=${encodedTarget}`)],
  });

  const result = withPage("https://www.bing.com/search?q=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "bing" }),
  );

  assert.deepEqual(result.urls, [target]);
});

test("Brave result mode keeps snippet result links and rejects internal links", () => {
  const selector = "#results a[href]";
  const page = fakeDocument({
    [selector]: [
      anchor("https://target.example/brave-finding", { braveResult: true }),
      anchor("https://search.brave.com/settings", { braveResult: true }),
      anchor("https://decorative.example/"),
    ],
  });

  const result = withPage("https://search.brave.com/search?q=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "brave" }),
  );

  assert.deepEqual(result.urls, ["https://target.example/brave-finding"]);
});

test("Startpage result mode collects organic title links", () => {
  const selector = "a.result-title.result-link[href]";
  const page = fakeDocument({
    [selector]: [
      anchor("https://target.example/startpage-finding"),
      anchor("https://www.startpage.com/sp/search?query=another"),
    ],
  });

  const result = withPage("https://www.startpage.com/sp/search?query=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "startpage" }),
  );

  assert.deepEqual(result.urls, ["https://target.example/startpage-finding"]);
});

test("MetaSearch result mode collects its result anchors", () => {
  const selector = ".search-result > a.search-result-anchor[href]";
  const page = fakeDocument({
    [selector]: [
      anchor("https://target.example/syncpundit-finding"),
      anchor("https://search.syncpundit.io/search?q=another"),
    ],
  });

  const result = withPage("https://search.syncpundit.io/search?q=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "syncpundit-search" }),
  );

  assert.deepEqual(result.urls, ["https://target.example/syncpundit-finding"]);
});

test("SearXNG result mode keeps one heading link per result", () => {
  const selector = "#results article.result h3 a[href]";
  const page = fakeDocument({
    [selector]: [
      anchor("https://target.example/searxng-finding"),
      anchor("https://searx.syncpundit.io/preferences"),
    ],
  });

  const result = withPage("https://searx.syncpundit.io/search?q=test", page, () =>
    extractLinksFromPage({ scope: "results", engine: "searxng" }),
  );

  assert.deepEqual(result.urls, ["https://target.example/searxng-finding"]);
});

test("detect mode recognizes SearXNG from its generator metadata", () => {
  const generator = {
    getAttribute(name) {
      return name === "content" ? "searxng/2026.7.25" : null;
    },
  };
  const page = fakeDocument({}, { 'meta[name="generator"]': generator });

  const result = withPage("https://public-searx.example/search?q=test", page, () =>
    extractLinksFromPage({ scope: "detect" }),
  );

  assert.deepEqual(result.searchEngine, { id: "searxng", label: "SearXNG" });
  assert.deepEqual(result.urls, []);
});

test("detect mode recognizes federated Mastodon search pages", () => {
  const applicationName = {
    getAttribute(name) {
      return name === "content" ? "Mastodon" : null;
    },
  };
  const page = fakeDocument({}, { 'meta[name="application-name"]': applicationName });

  const result = withPage("https://social.example/search?q=test", page, () =>
    extractLinksFromPage({ scope: "detect" }),
  );

  assert.deepEqual(result.searchEngine, { id: "mastodon", label: "Mastodon" });
});

test("detect mode remains self-contained when serialized for script injection", () => {
  const generator = {
    getAttribute(name) {
      return name === "content" ? "searxng/2026.7.25" : null;
    },
  };
  const page = fakeDocument({}, { 'meta[name="generator"]': generator });
  const injectedExtractor = Function(`return (${extractLinksFromPage.toString()})`)();

  const result = withPage("https://public-searx.example/search?q=test", page, () =>
    injectedExtractor({ scope: "detect" }),
  );

  assert.deepEqual(result.searchEngine, { id: "searxng", label: "SearXNG" });
});

test("detect mode recognizes structured generic search result pages", () => {
  const selector = [
    "#results article h2 a[href]",
    "#results article h3 a[href]",
    "#search-results article h2 a[href]",
    "#search-results article h3 a[href]",
    ".search-results .result h2 a[href]",
    ".search-results .result h3 a[href]",
    "main .search-result h2 a[href]",
    "main .search-result h3 a[href]",
    "main a.search-result-anchor[href]",
  ].join(", ");
  const page = fakeDocument({ [selector]: [anchor("https://target.example/finding")] });

  const result = withPage("https://search.example/results?query=test", page, () =>
    extractLinksFromPage({ scope: "detect" }),
  );

  assert.deepEqual(result.searchEngine, { id: "generic-search", label: "Search page" });
});
