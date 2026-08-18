const test = require("node:test");
const assert = require("node:assert/strict");

const extractLinksFromPage = require("../src/content/extract-links.js");
const {
  adapters,
  detectNativeSearchEngine,
  getSearchAdapter,
} = require("../src/lib/search-adapters.js");

const cases = [
  {
    id: "youtube",
    search: "https://www.youtube.com/results?search_query=security",
    result: "https://www.youtube.com/watch?v=abc123&si=tracking",
    expected: "https://www.youtube.com/watch?v=abc123",
    noise: "https://www.youtube.com/feed/trending",
  },
  {
    id: "reddit",
    search: "https://www.reddit.com/search/?q=security",
    result: "https://www.reddit.com/r/netsec/comments/abc123/finding/?utm_source=test",
    expected: "https://www.reddit.com/r/netsec/comments/abc123/finding/",
    noise: "https://www.reddit.com/settings/",
  },
  {
    id: "x",
    search: "https://x.com/search?q=security",
    result: "https://x.com/researcher/status/123456789?s=20",
    expected: "https://x.com/researcher/status/123456789",
    noise: "https://x.com/home",
  },
  {
    id: "tiktok",
    search: "https://www.tiktok.com/search?q=security",
    result: "https://www.tiktok.com/@researcher/video/123456789?is_from_webapp=1",
    expected: "https://www.tiktok.com/@researcher/video/123456789",
    noise: "https://www.tiktok.com/foryou",
  },
  {
    id: "instagram",
    search: "https://www.instagram.com/explore/search/keyword/?q=security",
    result: "https://www.instagram.com/p/ABC123/?igsh=tracking",
    expected: "https://www.instagram.com/p/ABC123/",
    noise: "https://www.instagram.com/explore/",
  },
  {
    id: "facebook",
    search: "https://www.facebook.com/search/posts/?q=security",
    result: "https://www.facebook.com/researcher/posts/123456?ref=search",
    expected: "https://www.facebook.com/researcher/posts/123456",
    noise: "https://www.facebook.com/settings",
  },
  {
    id: "linkedin",
    search: "https://www.linkedin.com/search/results/content/?keywords=security",
    result: "https://www.linkedin.com/posts/researcher_finding-activity-123?trackingId=x",
    expected: "https://www.linkedin.com/posts/researcher_finding-activity-123",
    noise: "https://www.linkedin.com/feed/",
  },
  {
    id: "threads",
    search: "https://www.threads.net/search?q=security",
    result: "https://www.threads.net/@researcher/post/ABC123?xmt=AQG",
    expected: "https://www.threads.net/@researcher/post/ABC123",
    noise: "https://www.threads.net/settings",
  },
  {
    id: "bluesky",
    search: "https://bsky.app/search?q=security",
    result: "https://bsky.app/profile/researcher.example/post/abc123?ref=search",
    expected: "https://bsky.app/profile/researcher.example/post/abc123",
    noise: "https://bsky.app/settings",
  },
  {
    id: "pinterest",
    search: "https://www.pinterest.com/search/pins/?q=security",
    result: "https://www.pinterest.com/pin/123456789/?utm_source=test",
    expected: "https://www.pinterest.com/pin/123456789/",
    noise: "https://www.pinterest.com/settings/",
  },
  {
    id: "tumblr",
    search: "https://www.tumblr.com/search/security",
    result: "https://www.tumblr.com/researcher/123456789/finding?source=share",
    expected: "https://www.tumblr.com/researcher/123456789/finding",
    noise: "https://www.tumblr.com/dashboard",
  },
  {
    id: "twitch",
    search: "https://www.twitch.tv/search?term=security",
    result: "https://www.twitch.tv/researcher/video/123456789?t=1h2m&utm_source=test",
    expected: "https://www.twitch.tv/researcher/video/123456789?t=1h2m",
    noise: "https://www.twitch.tv/directory",
  },
  {
    id: "vimeo",
    search: "https://vimeo.com/search?q=security",
    result: "https://vimeo.com/123456789?share=copy",
    expected: "https://vimeo.com/123456789",
    noise: "https://vimeo.com/features",
  },
  {
    id: "dailymotion",
    search: "https://www.dailymotion.com/search/security/videos",
    result: "https://www.dailymotion.com/video/x9abc12?playlist=x1",
    expected: "https://www.dailymotion.com/video/x9abc12",
    noise: "https://www.dailymotion.com/settings",
  },
  {
    id: "rumble",
    search: "https://rumble.com/search/video?q=security",
    result: "https://rumble.com/v6abc12-security-news.html?e9s=src_v1_ucp",
    expected: "https://rumble.com/v6abc12-security-news.html",
    noise: "https://rumble.com/account/",
  },
  {
    id: "odysee",
    search: "https://odysee.com/$/search?q=security",
    result: "https://odysee.com/@researcher:1/finding:2?src=embed",
    expected: "https://odysee.com/@researcher:1/finding:2",
    noise: "https://odysee.com/$/settings",
  },
  {
    id: "kick",
    search: "https://kick.com/search?query=security",
    result: "https://kick.com/researcher?ref=search",
    expected: "https://kick.com/researcher",
    noise: "https://kick.com/settings",
  },
  {
    id: "soundcloud",
    search: "https://soundcloud.com/search?q=security",
    result: "https://soundcloud.com/researcher/security-track?utm_source=clipboard",
    expected: "https://soundcloud.com/researcher/security-track",
    noise: "https://soundcloud.com/discover/",
  },
  {
    id: "spotify",
    search: "https://open.spotify.com/search/security",
    result: "https://open.spotify.com/track/abc123?si=tracking",
    expected: "https://open.spotify.com/track/abc123",
    noise: "https://open.spotify.com/collection/tracks",
  },
  {
    id: "apple-music",
    search: "https://music.apple.com/us/search?term=security",
    result: "https://music.apple.com/us/album/security-song/123456?i=987654&uo=4",
    expected: "https://music.apple.com/us/album/security-song/123456?i=987654",
    noise: "https://music.apple.com/us/browse",
  },
  {
    id: "bandcamp",
    search: "https://bandcamp.com/search?q=security",
    result: "https://researcher.bandcamp.com/track/security-song?from=search",
    expected: "https://researcher.bandcamp.com/track/security-song",
    noise: "https://bandcamp.com/about",
  },
  {
    id: "mixcloud",
    search: "https://www.mixcloud.com/search/?q=security",
    result: "https://www.mixcloud.com/researcher/security-show/?utm_source=test",
    expected: "https://www.mixcloud.com/researcher/security-show/",
    noise: "https://www.mixcloud.com/settings/",
  },
  {
    id: "audiomack",
    search: "https://audiomack.com/search?query=security",
    result: "https://audiomack.com/researcher/song/security-track?share-user-id=1",
    expected: "https://audiomack.com/researcher/song/security-track",
    noise: "https://audiomack.com/settings",
  },
  {
    id: "bilibili",
    search: "https://search.bilibili.com/all?keyword=security",
    result: "https://www.bilibili.com/video/BV1abc123/?spm_id_from=333",
    expected: "https://www.bilibili.com/video/BV1abc123/",
    noise: "https://www.bilibili.com/account/",
  },
  {
    id: "crunchyroll",
    search: "https://www.crunchyroll.com/search?q=security",
    result: "https://www.crunchyroll.com/series/ABC123/security-show?utm_source=test",
    expected: "https://www.crunchyroll.com/series/ABC123/security-show",
    noise: "https://www.crunchyroll.com/account",
  },
  {
    id: "netflix",
    search: "https://www.netflix.com/search?q=security",
    result: "https://www.netflix.com/title/12345678?trackId=abc",
    expected: "https://www.netflix.com/title/12345678",
    noise: "https://www.netflix.com/browse",
  },
  {
    id: "prime-video",
    search: "https://www.primevideo.com/search?phrase=security",
    result: "https://www.primevideo.com/detail/ABC123/security-show?ref_=atv_sr_fle_c_Tn74RA_1_1_1",
    expected: "https://www.primevideo.com/detail/ABC123/security-show",
    noise: "https://www.primevideo.com/storefront/",
  },
  {
    id: "disney-plus",
    search: "https://www.disneyplus.com/search",
    result: "https://www.disneyplus.com/browse/entity-abc123?distributionPartner=google",
    expected: "https://www.disneyplus.com/browse/entity-abc123",
    noise: "https://www.disneyplus.com/home",
  },
  {
    id: "max",
    search: "https://www.max.com/search",
    result: "https://www.max.com/shows/security-show/abc123?utm_source=test",
    expected: "https://www.max.com/shows/security-show/abc123",
    noise: "https://www.max.com/home",
  },
  {
    id: "hulu",
    search: "https://www.hulu.com/search?q=security",
    result: "https://www.hulu.com/series/security-show-abc123?entity_id=x",
    expected: "https://www.hulu.com/series/security-show-abc123",
    noise: "https://www.hulu.com/hub/home",
  },
  {
    id: "tubi",
    search: "https://tubitv.com/search/security",
    result: "https://tubitv.com/movies/123456/security-film?start=true",
    expected: "https://tubitv.com/movies/123456/security-film",
    noise: "https://tubitv.com/home",
  },
];

function anchor(
  href,
  { inResultScope = true, inNavigation = false, rejected = false } = {},
) {
  return {
    href,
    getAttribute(name) {
      return name === "href" ? href : null;
    },
    closest(selector) {
      if (selector.includes("[role=\"navigation\"]")) {
        return inNavigation ? {} : null;
      }
      if (selector.includes("sc-ministats")) {
        return rejected ? {} : null;
      }
      return inResultScope ? {} : null;
    },
  };
}

function fakeDocument(links) {
  return {
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "a[href], area[href]") return links;
      if (selector === "*") return [];
      return [];
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

test("platform adapter ids are unique and have valid serializable rules", () => {
  assert.equal(new Set(adapters.map((adapter) => adapter.id)).size, adapters.length);

  for (const adapter of adapters) {
    assert.ok(adapter.id);
    assert.ok(adapter.label);
    assert.ok(["supported", "partial"].includes(adapter.support));
    assert.ok(Array.isArray(adapter.searchRules));
    assert.ok(Array.isArray(adapter.resultRules));
    assert.doesNotThrow(() => JSON.stringify(adapter));

    for (const rule of [...adapter.searchRules, ...adapter.resultRules]) {
      assert.doesNotThrow(() => new RegExp(rule.pathPattern));
    }
  }
});

test("detects every declared host-based platform search route", async (context) => {
  for (const scenario of cases) {
    await context.test(scenario.id, () => {
      assert.deepEqual(detectNativeSearchEngine(scenario.search), {
        id: scenario.id,
        label: getSearchAdapter(scenario.id).label,
      });
    });
  }
});

test("does not classify ordinary platform homepages as search results", () => {
  for (const adapter of adapters) {
    for (const host of adapter.hosts) {
      assert.equal(
        detectNativeSearchEngine(`https://${host}/`),
        null,
        `${adapter.id} homepage was misclassified`,
      );
    }
  }
});

test("serialized extraction keeps platform results and rejects navigation", async (context) => {
  const injectedExtractor = Function(`return (${extractLinksFromPage.toString()})`)();

  for (const scenario of cases) {
    await context.test(scenario.id, () => {
      const adapter = JSON.parse(JSON.stringify(getSearchAdapter(scenario.id)));
      const page = fakeDocument([
        anchor(scenario.noise, { inResultScope: false }),
        anchor(scenario.result),
      ]);
      const result = withPage(scenario.search, page, () =>
        injectedExtractor({ scope: "results", engine: scenario.id, adapter }),
      );

      assert.deepEqual(result.urls, [scenario.expected]);
      assert.equal(result.candidates, 1);
    });
  }
});

test("Mastodon adapters can extract same-instance posts after DOM detection", () => {
  const adapter = getSearchAdapter("mastodon");
  const page = fakeDocument([
    anchor("https://mastodon.social/settings/profile"),
    anchor("https://mastodon.social/@researcher/123456?ref=search"),
  ]);

  const result = withPage("https://mastodon.social/search?q=security", page, () =>
    extractLinksFromPage({ scope: "results", engine: "mastodon", adapter }),
  );

  assert.deepEqual(result.urls, ["https://mastodon.social/@researcher/123456"]);
});

test("every-URL mode remains unfiltered on platform search pages", () => {
  const page = fakeDocument([
    anchor("https://www.youtube.com/feed/trending"),
    anchor("https://www.youtube.com/watch?v=abc123&si=tracking"),
  ]);

  const result = withPage(
    "https://www.youtube.com/results?search_query=security",
    page,
    () =>
      extractLinksFromPage({
        scope: "all",
        engine: "youtube",
        adapter: getSearchAdapter("youtube"),
      }),
  );

  assert.deepEqual(result.urls, [
    "https://www.youtube.com/feed/trending",
    "https://www.youtube.com/watch?v=abc123&si=tracking",
  ]);
});

test("result-only mode rejects content-shaped links inside navigation", () => {
  const page = fakeDocument([
    anchor("https://www.youtube.com/@sidebar-channel", { inNavigation: true }),
    anchor("https://www.youtube.com/watch?v=abc123"),
  ]);

  const result = withPage(
    "https://www.youtube.com/results?search_query=security",
    page,
    () =>
      extractLinksFromPage({
        scope: "results",
        engine: "youtube",
        adapter: getSearchAdapter("youtube"),
      }),
  );

  assert.deepEqual(result.urls, ["https://www.youtube.com/watch?v=abc123"]);
});

test("adapter-specific rejected link roles are excluded", () => {
  const page = fakeDocument([
    anchor("https://soundcloud.com/researcher/followers", { rejected: true }),
    anchor("https://soundcloud.com/researcher/security-track"),
  ]);

  const result = withPage("https://soundcloud.com/search?q=security", page, () =>
    extractLinksFromPage({
      scope: "results",
      engine: "soundcloud",
      adapter: getSearchAdapter("soundcloud"),
    }),
  );

  assert.deepEqual(result.urls, ["https://soundcloud.com/researcher/security-track"]);
});
