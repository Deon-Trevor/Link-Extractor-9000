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

function fakeDocument(selectorMap) {
  return {
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
