const test = require("node:test");
const assert = require("node:assert/strict");
const firefoxLiveSearch = require("./fixtures/firefox-live-search.json");
const firefoxLiveThreatIntel = require("./fixtures/firefox-live-threat-intel.json");

const extractLinksFromPage = require("../src/content/extract-links.js");
const {
  adapters,
  detectNativeSearchEngine,
  getSearchAdapter,
} = require("../src/lib/search-adapters.js");
const serializedExtractor = Function(`return (${extractLinksFromPage.toString()})`)();

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

const threatIntelCases = [
  {
    id: "shodan",
    search: "https://www.shodan.io/search?query=product%3Anginx",
    result: "https://www.shodan.io/host/203.0.113.10?ref=search",
    expected: "https://www.shodan.io/host/203.0.113.10",
    noise: "https://www.shodan.io/dashboard",
  },
  {
    id: "censys",
    search: "https://platform.censys.io/search?q=host.services.port%3D443",
    result: "https://platform.censys.io/hosts/203.0.113.11?source=search",
    expected: "https://platform.censys.io/hosts/203.0.113.11",
    noise: "https://platform.censys.io/account",
  },
  {
    id: "zoomeye",
    search: "https://www.zoomeye.ai/searchResult?q=nginx",
    result: "https://www.zoomeye.ai/host/203.0.113.12?from=search",
    expected: "https://www.zoomeye.ai/host/203.0.113.12",
    noise: "https://www.zoomeye.ai/profile",
  },
  {
    id: "fofa",
    search: "https://fofa.info/result?qbase64=dGl0bGU9Im5naW54Ig%3D%3D",
    result: "https://fofa.info/host/203.0.113.13?from=result",
    expected: "https://fofa.info/host/203.0.113.13",
    noise: "https://fofa.info/userCenter",
  },
  {
    id: "netlas",
    search: "https://app.netlas.io/responses/?q=http.headers.server%3Anginx",
    result: "https://app.netlas.io/host/203.0.113.14?source=responses",
    expected: "https://app.netlas.io/host/203.0.113.14",
    noise: "https://app.netlas.io/profile/",
  },
  {
    id: "leakix",
    search: "https://leakix.net/search?q=nginx",
    result: "https://leakix.net/host/203.0.113.15?ref=search",
    expected: "https://leakix.net/host/203.0.113.15",
    noise: "https://leakix.net/plugins",
  },
  {
    id: "greynoise",
    search: "https://viz.greynoise.io/query?gnql=classification%3Amalicious",
    result: "https://viz.greynoise.io/ip/203.0.113.17?ref=query",
    expected: "https://viz.greynoise.io/ip/203.0.113.17",
    noise: "https://viz.greynoise.io/account",
  },
  {
    id: "criminal-ip",
    search: "https://www.criminalip.io/asset/search?query=nginx",
    result: "https://www.criminalip.io/asset/report/203.0.113.18?from=search",
    expected: "https://www.criminalip.io/asset/report/203.0.113.18",
    noise: "https://www.criminalip.io/mypage",
  },
  {
    id: "hunter-how",
    search: "https://hunter.how/search/list?searchValue=nginx",
    result: "https://hunter.how/host/203.0.113.19?source=search",
    expected: "https://hunter.how/host/203.0.113.19",
    noise: "https://hunter.how/user",
  },
  {
    id: "onyphe",
    search: "https://search.onyphe.io/search/?q=category%3Adatascan",
    result: "https://search.onyphe.io/host/203.0.113.20?ref=search",
    expected: "https://search.onyphe.io/host/203.0.113.20",
    noise: "https://search.onyphe.io/account/",
  },
  {
    id: "quake-360",
    search: "https://quake.360.net/quake/#/searchResult?searchVal=nginx",
    result: "https://quake.360.net/quake/#/host/203.0.113.21",
    expected: "https://quake.360.net/quake/#/host/203.0.113.21",
    noise: "https://quake.360.net/quake/#/user",
  },
  {
    id: "publicwww",
    search: "https://publicwww.com/websites/%22jquery.js%22/",
    result: "https://result.example/path?asset=jquery.js#example",
    expected: "https://result.example/path?asset=jquery.js#example",
    noise: "https://publicwww.com/pricing/",
  },
  {
    id: "fullhunt",
    search: "https://fullhunt.io/search?query=example.com",
    result: "https://fullhunt.io/domain/result.example?ref=search",
    expected: "https://fullhunt.io/domain/result.example",
    noise: "https://fullhunt.io/pricing",
  },
  {
    id: "securitytrails",
    search: "https://securitytrails.com/list/subdomains/example.com",
    result: "https://securitytrails.com/domain/result.example/dns?ref=list",
    expected: "https://securitytrails.com/domain/result.example/dns",
    noise: "https://securitytrails.com/app/account",
  },
  {
    id: "urlscan",
    search: "https://urlscan.io/search/?q=domain%3Aexample.com",
    result: "https://urlscan.io/result/12345678-1234-4abc-8def-123456789abc/?ref=search",
    expected: "https://urlscan.io/result/12345678-1234-4abc-8def-123456789abc/",
    noise: "https://urlscan.io/docs/",
  },
  {
    id: "virustotal",
    search: "https://www.virustotal.com/gui/search/example.com",
    result: "https://www.virustotal.com/gui/domain/example.com/details?utm_source=search",
    expected: "https://www.virustotal.com/gui/domain/example.com/details",
    noise: "https://www.virustotal.com/gui/home/upload",
  },
  {
    id: "otx",
    search: "https://otx.alienvault.com/browse/global/pulses?q=example.com",
    result: "https://otx.alienvault.com/pulse/0123456789abcdef01234567?ref=browse",
    expected: "https://otx.alienvault.com/pulse/0123456789abcdef01234567",
    noise: "https://otx.alienvault.com/dashboard",
  },
  {
    id: "pulsedive",
    search: "https://pulsedive.com/search.php?q=example.com",
    result: "https://pulsedive.com/indicator/?iid=12345&utm_source=search",
    expected: "https://pulsedive.com/indicator/?iid=12345",
    noise: "https://pulsedive.com/account/",
  },
  {
    id: "threatminer",
    search: "https://www.threatminer.org/getData.php?e=search_container&t=0&q=example.com",
    result: "https://www.threatminer.org/domain.php?q=result.example&ref=search",
    expected: "https://www.threatminer.org/domain.php?q=result.example",
    noise: "https://www.threatminer.org/about.php",
  },
  {
    id: "microsoft-dti",
    search: "https://security.microsoft.com/threatanalytics3?search=example.com",
    result: "https://security.microsoft.com/threatanalytics3/intel-explorer/example.com?ref=search",
    expected: "https://security.microsoft.com/threatanalytics3/intel-explorer/example.com",
    noise: "https://security.microsoft.com/settings",
  },
  {
    id: "urlhaus",
    search: "https://urlhaus.abuse.ch/browse/?search=example.com",
    result: "https://urlhaus.abuse.ch/url/123456/?ref=browse",
    expected: "https://urlhaus.abuse.ch/url/123456/",
    noise: "https://urlhaus.abuse.ch/api/",
  },
  {
    id: "threatfox",
    search: "https://threatfox.abuse.ch/browse/?search=example.com",
    result: "https://threatfox.abuse.ch/ioc/123456/?ref=browse",
    expected: "https://threatfox.abuse.ch/ioc/123456/",
    noise: "https://threatfox.abuse.ch/api/",
  },
  {
    id: "sslbl",
    search: "https://sslbl.abuse.ch/ssl-certificates/?search=example.com",
    result: "https://sslbl.abuse.ch/ssl-certificates/sha1/0123456789abcdef/?ref=search",
    expected: "https://sslbl.abuse.ch/ssl-certificates/sha1/0123456789abcdef/",
    noise: "https://sslbl.abuse.ch/blacklist/",
  },
  {
    id: "hybrid-analysis",
    search: "https://www.hybrid-analysis.com/search?query=example.com",
    result: `https://www.hybrid-analysis.com/sample/${"a".repeat(64)}?ref=search`,
    expected: `https://www.hybrid-analysis.com/sample/${"a".repeat(64)}`,
    noise: "https://www.hybrid-analysis.com/account",
  },
  {
    id: "anyrun",
    search: "https://app.any.run/tasks?query=example.com",
    result: "https://app.any.run/tasks/12345678-1234-4abc-8def-123456789abc?ref=search",
    expected: "https://app.any.run/tasks/12345678-1234-4abc-8def-123456789abc",
    noise: "https://app.any.run/profile",
  },
  {
    id: "triage",
    search: "https://tria.ge/reports?q=example.com",
    result: "https://tria.ge/reports/240101-abcd1234ef?ref=search",
    expected: "https://tria.ge/reports/240101-abcd1234ef",
    noise: "https://tria.ge/account",
  },
  {
    id: "joe-sandbox",
    search: "https://www.joesandbox.com/analysissearch?q=example.com",
    result: "https://www.joesandbox.com/analysis/123456/0/html?ref=search",
    expected: "https://www.joesandbox.com/analysis/123456/0/html",
    noise: "https://www.joesandbox.com/account",
  },
  {
    id: "phishtank",
    search: "https://www.phishtank.org/phish_search.php?phish_id=123456",
    result: "https://www.phishtank.org/phish_detail.php?phish_id=654321&ref=search",
    expected: "https://www.phishtank.org/phish_detail.php?phish_id=654321",
    noise: "https://www.phishtank.org/login.php",
  },
  {
    id: "phishstats",
    search: "https://phishstats.info/search/?q=brand",
    result: "https://suspicious.example/login?campaign=brand#verify",
    expected: "https://suspicious.example/login?campaign=brand#verify",
    noise: "https://phishstats.info/about/",
  },
];

const adapterCases = [...cases, ...threatIntelCases];

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

function capturedAnchor(record) {
  return {
    href: record.href,
    getAttribute(name) {
      return name === "href" ? record.href : null;
    },
    closest(selector) {
      if (
        record.landmark &&
        selector === 'nav, header, footer, aside, [role="navigation"]'
      ) {
        return record.landmark;
      }
      if (record.scope === selector || record.reject === selector) {
        return record.anchor;
      }
      return null;
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
      if (rule.hashPattern) {
        assert.doesNotThrow(() => new RegExp(rule.hashPattern));
      }
    }
  }
});

test("includes every active High-fit threat-intelligence adapter", () => {
  const expectedIds = [
    "anyrun",
    "censys",
    "criminal-ip",
    "fofa",
    "fullhunt",
    "greynoise",
    "hunter-how",
    "hybrid-analysis",
    "joe-sandbox",
    "leakix",
    "microsoft-dti",
    "netlas",
    "onyphe",
    "otx",
    "phishstats",
    "phishtank",
    "publicwww",
    "pulsedive",
    "quake-360",
    "securitytrails",
    "shodan",
    "sslbl",
    "threatfox",
    "threatminer",
    "triage",
    "urlhaus",
    "urlscan",
    "virustotal",
    "zoomeye",
  ];
  const actualIds = adapters
    .filter((adapter) => adapter.family.startsWith("threat-intel-"))
    .map((adapter) => adapter.id)
    .sort();

  assert.deepEqual(actualIds, expectedIds);
});

test("detects every declared host-based platform search route", async (context) => {
  for (const scenario of adapterCases) {
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
  for (const scenario of adapterCases) {
    await context.test(scenario.id, () => {
      const adapter = JSON.parse(JSON.stringify(getSearchAdapter(scenario.id)));
      const page = fakeDocument([
        anchor(scenario.noise, { inResultScope: false }),
        anchor(scenario.result),
      ]);
      const result = withPage(scenario.search, page, () =>
        serializedExtractor({ scope: "results", engine: scenario.id, adapter }),
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

test("sanitized Firefox live DOM projections preserve result filtering", async (context) => {
  assert.equal(firefoxLiveSearch.schemaVersion, 1);
  assert.match(firefoxLiveSearch.browser, /^Firefox /);

  for (const fixture of firefoxLiveSearch.cases) {
    await context.test(fixture.platform, () => {
      const adapter = JSON.parse(
        JSON.stringify(getSearchAdapter(fixture.platform)),
      );
      const page = fakeDocument(fixture.anchors.map(capturedAnchor));
      const result = withPage(fixture.pageUrl, page, () =>
        serializedExtractor({
          scope: "results",
          engine: fixture.platform,
          adapter,
        }),
      );

      assert.deepEqual(
        result.urls,
        fixture.anchors.flatMap((anchorRecord) =>
          anchorRecord.expected ? [anchorRecord.expected] : [],
        ),
      );
    });
  }
});

test("sanitized Firefox threat-intel DOM projections preserve result filtering", async (context) => {
  assert.equal(firefoxLiveThreatIntel.schemaVersion, 1);
  assert.equal(firefoxLiveThreatIntel.captureKind, "logged-out-public");
  assert.match(firefoxLiveThreatIntel.browser, /^Firefox /);

  for (const fixture of firefoxLiveThreatIntel.cases) {
    await context.test(fixture.platform, () => {
      const adapter = JSON.parse(
        JSON.stringify(getSearchAdapter(fixture.platform)),
      );
      assert.equal(adapter.support, "supported");

      const page = fakeDocument(fixture.anchors.map(capturedAnchor));
      const result = withPage(fixture.pageUrl, page, () =>
        serializedExtractor({
          scope: "results",
          engine: fixture.platform,
          adapter,
        }),
      );

      assert.deepEqual(
        result.urls,
        fixture.anchors.flatMap((anchorRecord) =>
          anchorRecord.expected ? [anchorRecord.expected] : [],
        ),
      );
    });
  }
});
