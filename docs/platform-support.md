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

## Behaviour and limitations

- Result-only mode uses stable URL shapes and removes non-semantic tracking
  parameters while preserving identifiers required to open the result.
- Every-URL mode remains unchanged and collects all loaded HTTP and HTTPS links.
- Only currently loaded links are available. Scroll or load additional results,
  then collect again to append them.
- Exact duplicate URLs are ignored across collection runs.
- A platform redesign can temporarily reduce extraction until its adapter is
  updated. Use every-URL mode as a fallback.
