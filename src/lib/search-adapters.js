(function exposeSearchAdapters(root, factory) {
  const library = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = library;
  } else {
    root.LinkExtractorSearchAdapters = library;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSearchAdapters() {
  "use strict";

  const adapters = [
    {
      id: "youtube",
      label: "YouTube",
      family: "social-video",
      support: "supported",
      hosts: ["youtube.com"],
      searchRules: [{ pathPattern: "^/results/?$", requiredParams: ["search_query"] }],
      resultRules: [
        { pathPattern: "^/watch/?$", requiredParams: ["v"], keepParams: ["v", "list", "index", "t"] },
        { pathPattern: "^/(?:shorts|live)/[^/]+/?$", keepParams: ["t"] },
        { pathPattern: "^/playlist/?$", requiredParams: ["list"], keepParams: ["list"] },
        { pathPattern: "^/(?:channel|c)/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/@[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "reddit",
      label: "Reddit",
      family: "social",
      support: "supported",
      hosts: ["reddit.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/r/[^/]+/comments/[^/]+(?:/[^/]+)?/?$", keepParams: [] },
        { pathPattern: "^/(?:r|user)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "x",
      label: "X / Twitter",
      family: "social",
      support: "supported",
      hosts: ["x.com", "twitter.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/[A-Za-z0-9_]+/status/\\d+/?$", keepParams: [] },
        {
          pathPattern: "^/(?!home/?$|explore/?$|notifications/?$|messages/?$|search/?$|settings/?$|i/)[A-Za-z0-9_]{1,15}/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "tiktok",
      label: "TikTok",
      family: "social-video",
      support: "supported",
      hosts: ["tiktok.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/@[^/]+/video/\\d+/?$", keepParams: [] },
        { pathPattern: "^/@[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "instagram",
      label: "Instagram",
      family: "social",
      support: "supported",
      hosts: ["instagram.com"],
      searchRules: [
        { pathPattern: "^/explore/search(?:/keyword)?/?$", requiredParams: ["q"] },
      ],
      resultRules: [
        { pathPattern: "^/(?:p|reel|tv)/[^/]+/?$", keepParams: [] },
        {
          pathPattern: "^/(?!accounts/?$|direct/?$|explore/?$|reels/?$|stories/?$|about/?$|developer/?$)[A-Za-z0-9._]+/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "facebook",
      label: "Facebook",
      family: "social",
      support: "supported",
      hosts: ["facebook.com"],
      searchRules: [{ pathPattern: "^/search(?:/.*)?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/[^/]+/posts/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/groups/[^/]+/posts/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/(?:reel|videos)/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/watch/?$", requiredParams: ["v"], keepParams: ["v"] },
        { pathPattern: "^/permalink\\.php$", requiredParams: ["story_fbid"], keepParams: ["story_fbid", "id"] },
        { pathPattern: "^/profile\\.php$", requiredParams: ["id"], keepParams: ["id"] },
      ],
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      family: "social",
      support: "supported",
      hosts: ["linkedin.com"],
      searchRules: [
        { pathPattern: "^/search/results/(?:all|people|companies|content|jobs)/?$", requiredParams: ["keywords"] },
      ],
      resultRules: [
        { pathPattern: "^/(?:in|company)/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/(?:posts|pulse)/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/jobs/view/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "threads",
      label: "Threads",
      family: "social",
      support: "supported",
      hosts: ["threads.net"],
      searchRules: [{ pathPattern: "^/search(?:/profiles)?/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/@[^/]+/post/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/@[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "bluesky",
      label: "Bluesky",
      family: "social",
      support: "supported",
      hosts: ["bsky.app"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/profile/[^/]+/post/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/profile/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "pinterest",
      label: "Pinterest",
      family: "social",
      support: "supported",
      hosts: ["pinterest.com"],
      searchRules: [{ pathPattern: "^/search/(?:pins|boards|users)/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/pin/\\d+/?$", keepParams: [] },
        {
          pathPattern: "^/(?!settings/?$|search/?$|ideas/?$|today/?$|business/?$)[^/]+/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "tumblr",
      label: "Tumblr",
      family: "social",
      support: "supported",
      hosts: ["tumblr.com"],
      searchRules: [
        { pathPattern: "^/search/[^/]+/?$" },
        { pathPattern: "^/search/?$", requiredParams: ["query"] },
      ],
      resultRules: [
        { pathPattern: "^/(?:blog/view/)?[^/]+/\\d+(?:/[^/]+)?/?$", keepParams: [] },
        { pathPattern: "^/[^/]+/post/\\d+(?:/[^/]+)?/?$", keepParams: [] },
      ],
    },
    {
      id: "mastodon",
      label: "Mastodon",
      family: "social-federated",
      support: "partial",
      hosts: [],
      searchRules: [],
      resultRules: [
        { sameHost: true, pathPattern: "^/@[^/]+/\\d+/?$", keepParams: [] },
        { sameHost: true, pathPattern: "^/@[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "twitch",
      label: "Twitch",
      family: "streaming-video",
      support: "supported",
      hosts: ["twitch.tv"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["term"] }],
      anchorScopeSelectors: [
        ".search-result-card",
        ".search-result-card__img-wrapper",
        ".search-result-offline_channel--body",
        ".offline_result-featured-videos--body",
      ],
      resultRules: [
        { pathPattern: "^/videos/\\d+/?$", keepParams: ["t"] },
        { pathPattern: "^/[^/]+/(?:video|clip)/[^/]+/?$", keepParams: ["t"] },
        { pathPattern: "^/directory/category/[^/]+/?$", keepParams: [] },
        {
          pathPattern: "^/(?!directory/?$|downloads/?$|jobs/?$|p/?$|search/?$|settings/?$|subscriptions/?$|wallet/?$)[A-Za-z0-9_]+/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "vimeo",
      label: "Vimeo",
      family: "streaming-video",
      support: "supported",
      hosts: ["vimeo.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/\\d+/?$", keepParams: [] },
        { pathPattern: "^/(?:channels|user\\d+|ondemand)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "dailymotion",
      label: "Dailymotion",
      family: "streaming-video",
      support: "supported",
      hosts: ["dailymotion.com"],
      searchRules: [
        { pathPattern: "^/search/[^/]+(?:/videos)?/?$" },
        { pathPattern: "^/search/?$", requiredParams: ["query"] },
      ],
      resultRules: [
        { pathPattern: "^/(?:video|playlist|user)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "rumble",
      label: "Rumble",
      family: "streaming-video",
      support: "supported",
      hosts: ["rumble.com"],
      searchRules: [{ pathPattern: "^/search/video/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/v[a-zA-Z0-9]+-[^/]+\\.html$", keepParams: [] },
        { pathPattern: "^/c/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "odysee",
      label: "Odysee",
      family: "streaming-video",
      support: "supported",
      hosts: ["odysee.com"],
      searchRules: [{ pathPattern: "^/\\$/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/@[^/]+/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/@[^/]+:[^/]+/[^/]+:[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "kick",
      label: "Kick",
      family: "streaming-video",
      support: "supported",
      hosts: ["kick.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["query"] }],
      resultRules: [
        { pathPattern: "^/(?:video|category)/[^/]+/?$", keepParams: [] },
        { pathPattern: "^/(?!search/?$|categories/?$|following/?$|settings/?$)[A-Za-z0-9_-]+/?$", keepParams: [] },
      ],
    },
    {
      id: "soundcloud",
      label: "SoundCloud",
      family: "streaming-audio",
      support: "supported",
      hosts: ["soundcloud.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      anchorScopeSelectors: [".searchList__item", ".searchItem"],
      anchorRejectSelectors: [".sc-ministats-followers", ".sc-ministats-following"],
      resultRules: [
        { pathPattern: "^/(?!search/|discover/|you/|settings/|upload/|popular/|charts/|stream/)[^/]+/(?:sets/)?[^/]+/?$", keepParams: [] },
        { pathPattern: "^/(?!search/?$|discover/?$|you/?$|settings/?$|upload/?$|popular/?$|charts/?$|stream/?$)[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "spotify",
      label: "Spotify",
      family: "streaming-audio",
      support: "supported",
      hosts: ["open.spotify.com"],
      searchRules: [{ pathPattern: "^/search(?:/.*)?$" }],
      resultRules: [
        { pathPattern: "^/(?:track|album|artist|playlist|episode|show|audiobook)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "apple-music",
      label: "Apple Music",
      family: "streaming-audio",
      support: "supported",
      hosts: ["music.apple.com"],
      searchRules: [{ pathPattern: "^/[a-z]{2}/search/?$", requiredParams: ["term"] }],
      resultRules: [
        { pathPattern: "^/[a-z]{2}/(?:album|artist|playlist|song|music-video)/[^/]+/[^/]+/?$", keepParams: ["i"] },
      ],
    },
    {
      id: "bandcamp",
      label: "Bandcamp",
      family: "streaming-audio",
      support: "supported",
      hosts: ["bandcamp.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { hosts: ["bandcamp.com"], pathPattern: "^/(?:track|album)/[^/]+/?$", keepParams: [] },
        { hosts: ["bandcamp.com"], pathPattern: "^/music/?$", keepParams: [] },
      ],
    },
    {
      id: "mixcloud",
      label: "Mixcloud",
      family: "streaming-audio",
      support: "supported",
      hosts: ["mixcloud.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/[^/]+/[^/]+/?$", keepParams: [] },
        {
          pathPattern: "^/(?!settings/?$|search/?$|discover/?$|upload/?$|dashboard/?$)[^/]+/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "audiomack",
      label: "Audiomack",
      family: "streaming-audio",
      support: "supported",
      hosts: ["audiomack.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["query"] }],
      resultRules: [
        { pathPattern: "^/[^/]+/(?:song|album|playlist)/[^/]+/?$", keepParams: [] },
        {
          pathPattern: "^/(?!settings/?$|search/?$|feed/?$|trending/?$|upload/?$)[^/]+/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "bilibili",
      label: "Bilibili",
      family: "streaming-video",
      support: "supported",
      hosts: ["search.bilibili.com"],
      searchRules: [{ pathPattern: "^/all/?$", requiredParams: ["keyword"] }],
      resultRules: [
        { hosts: ["bilibili.com"], pathPattern: "^/(?:video|bangumi/play|opus)/[^/]+/?$", keepParams: [] },
        { hosts: ["space.bilibili.com"], pathPattern: "^/\\d+/?$", keepParams: [] },
      ],
    },
    {
      id: "crunchyroll",
      label: "Crunchyroll",
      family: "streaming-video",
      support: "supported",
      hosts: ["crunchyroll.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/(?:series|watch)/[^/]+(?:/[^/]+)?/?$", keepParams: [] },
      ],
    },
    {
      id: "netflix",
      label: "Netflix",
      family: "streaming-catalog",
      support: "partial",
      hosts: ["netflix.com"],
      searchRules: [{ pathPattern: "^/search/?$" }],
      resultRules: [{ pathPattern: "^/title/\\d+/?$", keepParams: [] }],
    },
    {
      id: "prime-video",
      label: "Prime Video",
      family: "streaming-catalog",
      support: "partial",
      hosts: ["primevideo.com"],
      searchRules: [{ pathPattern: "^/(?:region/[^/]+/)?search/?$" }],
      resultRules: [
        { pathPattern: "^/(?:region/[^/]+/)?detail/[^/]+(?:/[^/]+)?/?$", keepParams: [] },
      ],
    },
    {
      id: "disney-plus",
      label: "Disney+",
      family: "streaming-catalog",
      support: "partial",
      hosts: ["disneyplus.com"],
      searchRules: [{ pathPattern: "^/search/?$" }],
      resultRules: [
        {
          pathPattern: "^/(?:browse/entity-[^/]+|(?:movies|series|video)/[^/]+)/?$",
          keepParams: [],
        },
      ],
    },
    {
      id: "max",
      label: "Max",
      family: "streaming-catalog",
      support: "partial",
      hosts: ["max.com"],
      searchRules: [{ pathPattern: "^/search/?$" }],
      resultRules: [
        { pathPattern: "^/(?:movies|shows)/[^/]+/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "hulu",
      label: "Hulu",
      family: "streaming-catalog",
      support: "partial",
      hosts: ["hulu.com"],
      searchRules: [{ pathPattern: "^/search/?$" }],
      resultRules: [
        { pathPattern: "^/(?:movie|series|watch)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "tubi",
      label: "Tubi",
      family: "streaming-catalog",
      support: "supported",
      hosts: ["tubitv.com"],
      searchRules: [{ pathPattern: "^/search/[^/]+/?$" }],
      resultRules: [
        { pathPattern: "^/(?:movies|tv-shows)/[^/]+/[^/]+/?$", keepParams: [] },
      ],
    },
  ];

  function hostMatches(host, domains) {
    return (domains || []).some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  }

  function ruleMatches(url, rule) {
    if (rule.hosts && !hostMatches(url.hostname.toLowerCase(), rule.hosts)) {
      return false;
    }

    if (!new RegExp(rule.pathPattern).test(url.pathname)) {
      return false;
    }

    return (rule.requiredParams || []).every((parameter) => url.searchParams.has(parameter));
  }

  function detectNativeSearchEngine(rawUrl) {
    let url;

    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase();
    const adapter = adapters.find(
      (candidate) =>
        hostMatches(host, candidate.hosts) &&
        candidate.searchRules.some((rule) => ruleMatches(url, rule)),
    );

    return adapter ? { id: adapter.id, label: adapter.label } : null;
  }

  function getSearchAdapter(id) {
    return adapters.find((adapter) => adapter.id === id) || null;
  }

  return {
    adapters,
    detectNativeSearchEngine,
    getSearchAdapter,
    hostMatches,
    ruleMatches,
  };
});
