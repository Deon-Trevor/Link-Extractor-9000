(function exposeCollectionLibrary(root, factory) {
  const library = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = library;
  } else {
    root.LinkExtractor9000 = library;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCollectionLibrary() {
  "use strict";

  const STORAGE_KEY = "urlCollection";

  function detectSearchEngine(rawUrl) {
    let url;

    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (/^google\.[a-z.]+$/.test(host) && path === "/search" && url.searchParams.has("q")) {
      return { id: "google", label: "Google" };
    }

    if ((host === "bing.com" || host.endsWith(".bing.com")) && path === "/search" && url.searchParams.has("q")) {
      return { id: "bing", label: "Bing" };
    }

    if ((host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) && url.searchParams.has("q")) {
      return { id: "duckduckgo", label: "DuckDuckGo" };
    }

    if (host === "search.brave.com" && path === "/search" && url.searchParams.has("q")) {
      return { id: "brave", label: "Brave Search" };
    }

    return null;
  }

  function normalizeCollection(value) {
    if (Array.isArray(value)) {
      return { version: 1, urls: value.filter(isHttpUrl), updatedAt: null };
    }

    if (!value || !Array.isArray(value.urls)) {
      return { version: 1, urls: [], updatedAt: null };
    }

    return {
      version: 1,
      urls: value.urls.filter(isHttpUrl),
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    };
  }

  function mergeUrls(existingUrls, incomingUrls) {
    const urls = [];
    const seen = new Set();
    let added = 0;
    let duplicates = 0;
    let rejected = 0;

    for (const url of existingUrls || []) {
      if (!isHttpUrl(url) || seen.has(url)) {
        continue;
      }
      seen.add(url);
      urls.push(url);
    }

    for (const url of incomingUrls || []) {
      if (!isHttpUrl(url)) {
        rejected += 1;
      } else if (seen.has(url)) {
        duplicates += 1;
      } else {
        seen.add(url);
        urls.push(url);
        added += 1;
      }
    }

    return { urls, added, duplicates, rejected };
  }

  function isHttpUrl(value) {
    if (typeof value !== "string") {
      return false;
    }

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function toClipboardText(urls) {
    return (urls || []).join("\n");
  }

  return {
    STORAGE_KEY,
    detectSearchEngine,
    isHttpUrl,
    mergeUrls,
    normalizeCollection,
    toClipboardText,
  };
});
