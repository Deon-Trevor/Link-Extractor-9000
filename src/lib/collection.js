(function exposeCollectionLibrary(root, factory) {
  const searchAdapters =
    typeof module === "object" && module.exports
      ? require("./search-adapters.js")
      : root.LinkExtractorSearchAdapters;
  const library = factory(searchAdapters);

  if (typeof module === "object" && module.exports) {
    module.exports = library;
  } else {
    root.LinkExtractor9000 = library;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCollectionLibrary(
  searchAdapters,
) {
  "use strict";

  const STORAGE_KEY = "urlCollection";
  const UTF8_PERCENT_SEQUENCE =
    /%(?:C[2-9A-F]|D[0-9A-F])%[89AB][0-9A-F]|%E[0-9A-F](?:%[89AB][0-9A-F]){2}|%F[0-4](?:%[89AB][0-9A-F]){3}/gi;

  function normalizeHttpUrl(value) {
    if (!isHttpUrl(value)) {
      return null;
    }

    return value.replace(UTF8_PERCENT_SEQUENCE, (sequence) => {
      try {
        return decodeURIComponent(sequence);
      } catch {
        return sequence;
      }
    });
  }

  function isPotentialSearchResultsPage(rawUrl) {
    let url;

    try {
      url = new URL(rawUrl);
    } catch {
      return false;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const path = url.pathname.replace(/\/+$/, "") || "/";
    const endpoint = path.split("/").pop();
    return (
      endpoint === "search" ||
      endpoint === "results" ||
      (path === "/" && (url.searchParams.has("q") || url.searchParams.has("query")))
    );
  }

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

    if (
      (host === "startpage.com" || host.endsWith(".startpage.com")) &&
      (path === "/sp/search" || path === "/do/search") &&
      url.searchParams.has("query")
    ) {
      return { id: "startpage", label: "Startpage" };
    }

    if (host === "search.syncpundit.io" && path === "/search" && url.searchParams.has("q")) {
      return { id: "syncpundit-search", label: "MetaSearch" };
    }

    if (
      host === "searx.syncpundit.io" &&
      (path === "/search" || path === "/") &&
      url.searchParams.has("q")
    ) {
      return { id: "searxng", label: "SearXNG" };
    }

    return searchAdapters?.detectNativeSearchEngine(url.href) || null;
  }

  function getSearchAdapter(id) {
    return searchAdapters?.getSearchAdapter(id) || null;
  }

  function normalizeCollection(value) {
    if (Array.isArray(value)) {
      return {
        version: 1,
        urls: value.map(normalizeHttpUrl).filter(Boolean),
        updatedAt: null,
      };
    }

    if (!value || !Array.isArray(value.urls)) {
      return { version: 1, urls: [], updatedAt: null };
    }

    return {
      version: 1,
      urls: value.urls.map(normalizeHttpUrl).filter(Boolean),
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    };
  }

  function mergeUrls(existingUrls, incomingUrls) {
    const urls = [];
    const seen = new Set();
    let added = 0;
    let duplicates = 0;
    let rejected = 0;

    for (const value of existingUrls || []) {
      const url = normalizeHttpUrl(value);
      if (!url || seen.has(url)) {
        continue;
      }
      seen.add(url);
      urls.push(url);
    }

    for (const value of incomingUrls || []) {
      const url = normalizeHttpUrl(value);
      if (!url) {
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

  function filterUrls(urls, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();

    return (urls || []).filter((value) => {
      if (!isHttpUrl(value)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const url = new URL(value);
      return (
        value.toLowerCase().includes(normalizedQuery) ||
        url.hostname.toLowerCase().includes(normalizedQuery)
      );
    });
  }

  function orderUrlsForView(urls, order = "recent") {
    const entries = (urls || []).filter(isHttpUrl).map((url, index) => ({
      url,
      index,
      hostname: new URL(url).hostname.toLowerCase().replace(/^www\./, ""),
    }));

    if (order === "oldest") {
      return entries.map((entry) => entry.url);
    }

    if (order === "hostname-asc" || order === "hostname-desc") {
      const direction = order === "hostname-desc" ? -1 : 1;
      entries.sort((left, right) => {
        const hostnameOrder = left.hostname.localeCompare(right.hostname);
        return hostnameOrder ? hostnameOrder * direction : left.index - right.index;
      });
      return entries.map((entry) => entry.url);
    }

    return entries.reverse().map((entry) => entry.url);
  }

  function removeUrl(urls, targetUrl) {
    const retained = [];
    let removed = 0;

    for (const url of urls || []) {
      if (url === targetUrl) {
        removed += 1;
      } else if (isHttpUrl(url)) {
        retained.push(url);
      }
    }

    return { urls: retained, removed };
  }

  function dedupeUrlsByHostname(urls) {
    const retained = [];
    const seen = new Set();
    let removed = 0;
    let rejected = 0;

    for (const value of urls || []) {
      if (!isHttpUrl(value)) {
        rejected += 1;
        continue;
      }

      const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
      if (seen.has(hostname)) {
        removed += 1;
        continue;
      }

      seen.add(hostname);
      retained.push(value);
    }

    return { urls: retained, removed, rejected };
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

  function createExportFile(urls, format, exportedAt = new Date()) {
    const normalizedFormat = String(format || "").toLowerCase();
    const validUrls = (urls || []).filter(isHttpUrl);
    const timestamp = normalizeExportTimestamp(exportedAt);
    const filename = `link-extractor-9000-${timestamp}.${normalizedFormat}`;

    if (normalizedFormat === "txt") {
      return {
        filename,
        mimeType: "text/plain;charset=utf-8",
        contents: validUrls.length ? `${validUrls.join("\n")}\n` : "",
      };
    }

    if (normalizedFormat === "csv") {
      const rows = validUrls.map((url) => `"${url.replaceAll('"', '""')}"`);
      return {
        filename,
        mimeType: "text/csv;charset=utf-8",
        contents: ["url", ...rows].join("\r\n") + "\r\n",
      };
    }

    if (normalizedFormat === "json") {
      return {
        filename,
        mimeType: "application/json;charset=utf-8",
        contents: `${JSON.stringify(validUrls, null, 2)}\n`,
      };
    }

    throw new TypeError(`Unsupported export format: ${format}`);
  }

  function normalizeExportTimestamp(value) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new TypeError("Export timestamp must be a valid date");
    }

    return date
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z")
      .replaceAll(":", "-");
  }

  return {
    STORAGE_KEY,
    createExportFile,
    dedupeUrlsByHostname,
    detectSearchEngine,
    filterUrls,
    getSearchAdapter,
    isHttpUrl,
    isPotentialSearchResultsPage,
    mergeUrls,
    normalizeCollection,
    orderUrlsForView,
    removeUrl,
    toClipboardText,
  };
});
