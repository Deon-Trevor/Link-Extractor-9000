# Native platform search support

Link Extractor 9000 can recognize native search pages and collect primary result
destinations that are currently represented by links in the rendered page. It
does not submit searches, scroll automatically, bypass login, or call platform
APIs.

## Support levels

- **Supported**: search-route detection and result URL classification have
  automated coverage. Live results can still vary by account, region, and
  platform rollout.
- **Partial**: an adapter exists, but authentication, federation, regional
  routing, or client-side rendering prevents a universal result guarantee.
- **Unavailable**: the service does not expose a stable public native web-search
  surface with result links the extension can safely identify.

## Social platforms

| Platform | Level | Result URL types |
| --- | --- | --- |
| YouTube | Supported | Videos, Shorts, live videos, playlists, channels |
| Reddit | Supported | Posts, communities, users |
| X / Twitter | Supported | Posts and profiles |
| TikTok | Supported | Videos and profiles |
| Instagram | Supported | Posts, reels, legacy video pages, profiles |
| Facebook | Supported | Posts, group posts, videos, reels, profiles |
| LinkedIn | Supported | People, companies, posts, articles, jobs |
| Threads | Supported | Posts and profiles |
| Bluesky | Supported | Posts and profiles |
| Pinterest | Supported | Pins and profiles |
| Tumblr | Supported | Posts |
| Mastodon | Partial | Same-instance posts and profiles after DOM fingerprinting |
| Telegram | Unavailable | No stable public global native web-search result surface |
| Discord | Unavailable | Search is private to authenticated servers and messages |
| WhatsApp | Unavailable | No public native web search |
| Snapchat | Unavailable | No stable public native web-search result surface |

## Video and live-streaming platforms

| Platform | Level | Result URL types |
| --- | --- | --- |
| Twitch | Supported | Channels, videos, categories |
| Vimeo | Supported | Videos, channels, users, on-demand pages |
| Dailymotion | Supported | Videos, playlists, users |
| Rumble | Supported | Videos and channels |
| Odysee | Supported | Claims, videos, channels |
| Kick | Supported | Channels, videos, categories |
| Bilibili | Supported | Videos, bangumi pages, posts, profiles |
| Crunchyroll | Supported | Series and watch pages |
| Tubi | Supported | Movies and TV shows |

## Audio platforms

| Platform | Level | Result URL types |
| --- | --- | --- |
| SoundCloud | Supported | Tracks, playlists, profiles |
| Spotify | Supported | Tracks, albums, artists, playlists, episodes, shows, audiobooks |
| Apple Music | Supported | Songs, albums, artists, playlists, music videos |
| Bandcamp | Supported | Tracks, albums, artist music pages on Bandcamp domains |
| Mixcloud | Supported | Shows and profiles |
| Audiomack | Supported | Songs, albums, playlists, profiles |

## Subscription catalogs

| Platform | Level | Result URL types |
| --- | --- | --- |
| Netflix | Partial | Title pages |
| Prime Video | Partial | Detail pages, including regional routes |
| Disney+ | Partial | Browse entities, movies, series, videos |
| Max | Partial | Movies and shows |
| Hulu | Partial | Movies, series, watch pages |

These catalog adapters are intentionally marked partial because their rendered
search results depend heavily on login state, subscription, region, and active
frontend experiments.

## Threat-intelligence infrastructure search

| Platform | Level | Result URL types |
| --- | --- | --- |
| Shodan | Supported | Host reports |
| Censys | Partial | Host, web-property, and certificate reports |
| ZoomEye | Partial | Host reports |
| FOFA | Partial | Host reports |
| Netlas | Partial | Host reports from response, domain, WHOIS, and certificate searches |
| LeakIX | Supported | Host and domain reports |
| BinaryEdge | Unavailable | The former application redirects to a service-transition notice |
| GreyNoise Visualizer | Partial | IP and RIOT reports |
| Criminal IP | Partial | Asset reports |
| Hunter.how | Partial | Host reports |
| ONYPHE | Partial | Host reports |
| 360 Quake | Partial | Hash-routed host and detail pages |
| PublicWWW | Partial | External websites listed in scoped results |
| FullHunt | Partial | Domain and host reports |
| SecurityTrails | Partial | Domain reports from list pages |

## IOC and threat-graph search

| Platform | Level | Result URL types |
| --- | --- | --- |
| urlscan.io | Supported | Scan results, domains, IPs, and ASNs |
| VirusTotal | Partial | Domain, IP, URL, and file reports |
| LevelBlue AlienVault OTX | Partial | Pulses and indicators |
| Pulsedive | Partial | Indicators and threats |
| ThreatMiner | Partial | Host, domain, sample, and report pages |
| Microsoft Defender Threat Intelligence | Partial | Authenticated intelligence-search pages |

## Malware, botnet, and phishing search

| Platform | Level | Result URL types |
| --- | --- | --- |
| URLhaus | Partial | URL records |
| ThreatFox | Partial | IOC records |
| Feodo Tracker | Partial | Host and botnet records |
| SSLBL | Supported | Certificate records |
| Hybrid Analysis | Partial | Sample reports |
| ANY.RUN | Partial | Analysis tasks |
| Hatching Triage | Partial | Analysis reports |
| Joe Sandbox Cloud | Partial | Analysis reports |
| PhishTank | Supported | Phish records |
| PhishStats | Partial | External phishing URLs in scoped results |

The threat-intelligence matrix was route-checked on 2026-08-19. `Supported`
entries have automated route and extraction coverage plus public result-link
evidence. `Partial` entries have the same declarative matcher coverage, but live
result DOM could not be fully proven because of authentication, anti-bot gates,
client-side rendering, regional routing, or account-tier differences. These
adapters recognize pages the user opens; they do not query platform APIs or
bypass access controls.

Logged-out Firefox 153 captures for Shodan, LeakIX, urlscan.io, SSLBL, and
PhishTank are retained as sanitized DOM projections in
`tests/fixtures/firefox-live-threat-intel.json`. They contain anchor metadata and
expected canonical URLs only, not page text, cookies, complete HTML, or browser
profile data.

## Behaviour and limitations

- Result-only mode uses stable URL shapes and removes non-semantic tracking
  parameters while preserving identifiers required to open the result.
- Hash-routed result identifiers are preserved where the fragment is part of the
  platform route. External result URLs keep their query parameters and fragments.
- Every-URL mode remains unchanged and collects all loaded HTTP and HTTPS links.
- Only currently loaded links are available. Scroll or load additional results,
  then collect again to append them.
- Exact duplicate URLs are ignored across collection runs.
- A platform redesign can temporarily reduce extraction until its adapter is
  updated. Use every-URL mode as a fallback.
