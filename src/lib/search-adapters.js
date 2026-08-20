(function exposeSearchAdapters(root, factory) {
  const library = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = library;
  } else {
    root.LinkExtractorSearchAdapters = library;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSearchAdapters() {
  "use strict";

  const threatIntelAdapters = [
    {
      id: "shodan",
      label: "Shodan",
      family: "threat-intel-infrastructure",
      support: "supported",
      hosts: ["shodan.io"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["query"] }],
      resultRules: [{ pathPattern: "^/host/[0-9A-Fa-f:.]+/?$", keepParams: [] }],
    },
    {
      id: "censys",
      label: "Censys",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["platform.censys.io", "search.censys.io"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/(?:hosts|web-properties|certificates)/[^/]+(?:/.*)?$", keepParams: [] },
      ],
    },
    {
      id: "zoomeye",
      label: "ZoomEye",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["zoomeye.ai", "zoomeye.org"],
      searchRules: [{ pathPattern: "^/searchResult/?$", requiredParams: ["q"] }],
      resultRules: [{ pathPattern: "^/host/[0-9A-Fa-f:.]+/?$", keepParams: [] }],
    },
    {
      id: "fofa",
      label: "FOFA",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["fofa.info"],
      searchRules: [{ pathPattern: "^/result/?$", requiredParams: ["qbase64"] }],
      resultRules: [{ pathPattern: "^/host/[^/]+/?$", keepParams: [] }],
    },
    {
      id: "netlas",
      label: "Netlas",
      family: "threat-intel-infrastructure",
      support: "supported",
      hosts: ["app.netlas.io"],
      searchRules: [
        { pathPattern: "^/(?:responses|domains|whois_domains|certificates)/?$", requiredParams: ["q"] },
      ],
      resultRules: [{ pathPattern: "^/host/[^/]+/?$", keepParams: [] }],
    },
    {
      id: "leakix",
      label: "LeakIX",
      family: "threat-intel-infrastructure",
      support: "supported",
      hosts: ["leakix.net"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/(?:host|domain)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "greynoise",
      label: "GreyNoise Visualizer",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["viz.greynoise.io"],
      searchRules: [{ pathPattern: "^/query/?$", requiredParams: ["gnql"] }],
      resultRules: [
        { pathPattern: "^/(?:ip|riot)/[0-9A-Fa-f:.]+/?$", keepParams: [] },
      ],
    },
    {
      id: "criminal-ip",
      label: "Criminal IP",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["criminalip.io"],
      searchRules: [
        { pathPattern: "^/asset/search/?$", requiredParams: ["query"] },
      ],
      resultRules: [
        { pathPattern: "^/asset/report/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "hunter-how",
      label: "Hunter.how",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["hunter.how"],
      searchRules: [
        { pathPattern: "^/search/list/?$", requiredParams: ["searchValue"] },
      ],
      resultRules: [{ pathPattern: "^/host/[0-9A-Fa-f:.]+/?$", keepParams: [] }],
    },
    {
      id: "onyphe",
      label: "ONYPHE",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["search.onyphe.io"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [{ pathPattern: "^/host/[0-9A-Fa-f:.]+/?$", keepParams: [] }],
    },
    {
      id: "quake-360",
      label: "360 Quake",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["quake.360.net"],
      searchRules: [
        { pathPattern: "^/quake/?$", hashPattern: "^#/search(?:Result)?(?:[/?]|$)" },
      ],
      resultRules: [
        { pathPattern: "^/quake/?$", hashPattern: "^#/(?:host|detail)/[^/]+", keepHash: true, keepParams: [] },
      ],
    },
    {
      id: "publicwww",
      label: "PublicWWW",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["publicwww.com"],
      searchRules: [{ pathPattern: "^/websites/[^/]+/?$" }],
      anchorScopeSelectors: ["#results", ".search-results", ".result", "main"],
      resultRules: [{ external: true, pathPattern: "^/", keepHash: true }],
    },
    {
      id: "fullhunt",
      label: "FullHunt",
      family: "threat-intel-infrastructure",
      support: "supported",
      hosts: ["fullhunt.io", "app.fullhunt.io"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["query"] }],
      resultRules: [
        { pathPattern: "^/(?:domain|host)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "securitytrails",
      label: "SecurityTrails",
      family: "threat-intel-infrastructure",
      support: "partial",
      hosts: ["securitytrails.com"],
      searchRules: [
        { pathPattern: "^/list/(?:apex_domain|subdomains|ips)/[^/]+/?$" },
      ],
      resultRules: [
        { pathPattern: "^/domain/[^/]+(?:/.*)?$", keepParams: [] },
      ],
    },
    {
      id: "urlscan",
      label: "urlscan.io",
      family: "threat-intel-ioc",
      support: "supported",
      hosts: ["urlscan.io"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/result/[0-9a-f-]+/?$", keepParams: [] },
        { pathPattern: "^/(?:domain|ip|asn)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "virustotal",
      label: "VirusTotal",
      family: "threat-intel-ioc",
      support: "partial",
      hosts: ["virustotal.com"],
      searchRules: [{ pathPattern: "^/gui/search/[^/]+/?$" }],
      resultRules: [
        { pathPattern: "^/gui/(?:domain|ip-address|url|file)/[^/]+(?:/.*)?$", keepParams: [] },
      ],
    },
    {
      id: "otx",
      label: "LevelBlue AlienVault OTX",
      family: "threat-intel-ioc",
      support: "partial",
      hosts: ["otx.alienvault.com"],
      searchRules: [
        { pathPattern: "^/browse/global(?:/pulses)?/?$", requiredParams: ["q"] },
      ],
      resultRules: [
        { pathPattern: "^/pulse/[0-9a-f]+/?$", keepParams: [] },
        { pathPattern: "^/indicator/[^/]+/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "pulsedive",
      label: "Pulsedive",
      family: "threat-intel-ioc",
      support: "partial",
      hosts: ["pulsedive.com"],
      searchRules: [{ pathPattern: "^/search\\.php$", requiredParams: ["q"] }],
      resultRules: [
        { pathPattern: "^/(?:indicator|threat)/?$", requiredParams: ["iid"], keepParams: ["iid"] },
      ],
    },
    {
      id: "threatminer",
      label: "ThreatMiner",
      family: "threat-intel-ioc",
      support: "partial",
      hosts: ["threatminer.org"],
      searchRules: [
        { pathPattern: "^/getData\\.php$", requiredParams: ["e", "q"] },
      ],
      resultRules: [
        { pathPattern: "^/(?:host|domain|sample|report)\\.php$", requiredParams: ["q"], keepParams: ["q"] },
      ],
    },
    {
      id: "microsoft-dti",
      label: "Microsoft Defender Threat Intelligence",
      family: "threat-intel-ioc",
      support: "partial",
      hosts: ["security.microsoft.com"],
      searchRules: [
        { pathPattern: "^/threatanalytics3/?$", requiredParams: ["search"] },
      ],
      resultRules: [
        { pathPattern: "^/threatanalytics3/(?:search|intel-explorer)/[^/]+/?$", keepParams: [] },
      ],
    },
    {
      id: "urlhaus",
      label: "URLhaus",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["urlhaus.abuse.ch"],
      searchRules: [{ pathPattern: "^/browse/?$", requiredParams: ["search"] }],
      resultRules: [{ pathPattern: "^/url/\\d+/?$", keepParams: [] }],
    },
    {
      id: "threatfox",
      label: "ThreatFox",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["threatfox.abuse.ch"],
      searchRules: [{ pathPattern: "^/browse/?$", requiredParams: ["search"] }],
      resultRules: [{ pathPattern: "^/ioc/\\d+/?$", keepParams: [] }],
    },
    {
      id: "sslbl",
      label: "SSLBL",
      family: "threat-intel-abuse",
      support: "supported",
      hosts: ["sslbl.abuse.ch"],
      searchRules: [
        { pathPattern: "^/ssl-certificates/?$", requiredParams: ["search"] },
      ],
      resultRules: [
        { pathPattern: "^/ssl-certificates/sha1/[0-9a-f]+/?$", keepParams: [] },
      ],
    },
    {
      id: "hybrid-analysis",
      label: "Hybrid Analysis",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["hybrid-analysis.com"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["query"] }],
      resultRules: [{ pathPattern: "^/sample/[0-9a-f]+/?$", keepParams: [] }],
    },
    {
      id: "anyrun",
      label: "ANY.RUN",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["app.any.run", "any.run"],
      searchRules: [
        { pathPattern: "^/(?:tasks|submissions)/?$", requiredParams: ["query"] },
      ],
      resultRules: [
        { pathPattern: "^/tasks/[0-9a-f-]+/?$", keepParams: [] },
      ],
    },
    {
      id: "triage",
      label: "Hatching Triage",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["tria.ge"],
      searchRules: [
        { pathPattern: "^/(?:s|reports)/?$", requiredParams: ["q"] },
      ],
      resultRules: [
        { pathPattern: "^/reports/[A-Za-z0-9_-]+(?:/.*)?$", keepParams: [] },
      ],
    },
    {
      id: "joe-sandbox",
      label: "Joe Sandbox Cloud",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["joesandbox.com"],
      searchRules: [
        { pathPattern: "^/(?:search|analysissearch)/?$", requiredParams: ["q"] },
      ],
      resultRules: [
        { pathPattern: "^/analysis/\\d+(?:/.*)?$", keepParams: [] },
      ],
    },
    {
      id: "phishtank",
      label: "PhishTank",
      family: "threat-intel-abuse",
      support: "supported",
      hosts: ["phishtank.org"],
      searchRules: [
        { pathPattern: "^/phish_search\\.php$", requiredParams: ["phish_id"] },
      ],
      resultRules: [
        { pathPattern: "^/phish_detail\\.php$", requiredParams: ["phish_id"], keepParams: ["phish_id"] },
      ],
    },
    {
      id: "phishstats",
      label: "PhishStats",
      family: "threat-intel-abuse",
      support: "partial",
      hosts: ["phishstats.info"],
      searchRules: [{ pathPattern: "^/search/?$", requiredParams: ["q"] }],
      anchorScopeSelectors: ["#results", ".search-results", ".result", "main"],
      resultRules: [{ external: true, pathPattern: "^/", keepHash: true }],
    },
  ];

  const adapters = [
    ...threatIntelAdapters,
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
        // A Groups tab search returns the groups themselves, not posts inside
        // them, so /groups/<id> has to match on its own. The exclusions are the
        // navigation that also lives under /groups/.
        {
          pathPattern:
            "^/groups/(?!feed/?$|discover/?$|create/?$|joins/?$|your_groups/?$|browse/?$|categories/?$|invites/?$|search/?$)[^/]+/?$",
          keepParams: [],
        },
        // Same shape for the Events and Marketplace tabs.
        {
          pathPattern:
            "^/events/(?!calendar/?$|discover/?$|create/?$|birthdays/?$|going/?$|invites/?$|search/?$)[^/]+/?$",
          keepParams: [],
        },
        { pathPattern: "^/marketplace/item/[^/]+/?$", keepParams: [] },
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
      id: "telegram-web",
      label: "Telegram Web",
      family: "social",
      support: "supported",
      hosts: ["web.telegram.org"],
      // Telegram Web never puts the query in the URL. Both clients live at a
      // bare /a/ or /k/, so the path is the only URL signal there is.
      searchRules: [{ pathPattern: "^/[ak]/?$" }],
      // t.me links if the page ever renders them, which today it does not.
      resultRules: [
        {
          hosts: ["t.me"],
          external: true,
          pathPattern: "^/[A-Za-z][A-Za-z0-9_]{3,31}/?$",
          keepParams: [],
        },
      ],
      // Result rows are anchors whose href is "#<chatId>", useless outside the
      // session. The public handle is in the row text, and @name maps exactly to
      // t.me/name, so the public link is derived rather than guessed.
      derivePublicLinks: {
        anchorSelector: 'a[href^="#"]',
        usernamePattern: "@([A-Za-z][A-Za-z0-9_]{3,31})\\b",
        template: "https://t.me/{username}",
      },
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
      // Audiomack searches with ?q=. Requiring only ?query= meant a real search
      // page was never detected: /search?query=drake renders the empty search
      // landing page, while /search?q=drake renders the results.
      searchRules: [
        { pathPattern: "^/search/?$", requiredParams: ["q"] },
        { pathPattern: "^/search/?$", requiredParams: ["query"] },
      ],
      resultRules: [
        { pathPattern: "^/[^/]+/(?:song|album|playlist)/[^/]+/?$", keepParams: [] },
        {
          // Artist profiles are single-segment paths, and so is most of the site
          // navigation. Without these exclusions /plus, /charts, /playlists,
          // /my-library and /world all came back as results.
          pathPattern:
            "^/(?!(?:settings|search|feed|trending|upload|plus|charts|playlists|my-library|world|about|contact-us|creator-app|browse|discover|originals|login|signup|premium)/?$)[^/]+/?$",
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

    if (rule.hashPattern && !new RegExp(rule.hashPattern).test(url.hash)) {
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
