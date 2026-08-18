(function exposeExtractor(root, factory) {
  const extractor = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = extractor;
  } else {
    root.extractLinksFromPage = extractor;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createExtractor() {
  "use strict";

  function extractLinksFromPage(options) {
    const settings = options || {};
    const scope = settings.scope === "results" ? "results" : "all";
    const engine = settings.engine || null;
    const pageUrl = new URL(location.href);

    function collectAllAnchors(root) {
      const anchors = Array.from(root.querySelectorAll("a[href], area[href]"));
      const shadowHosts = Array.from(root.querySelectorAll("*")).filter(
        (element) => element.shadowRoot,
      );

      for (const host of shadowHosts) {
        anchors.push(...collectAllAnchors(host.shadowRoot));
      }

      return anchors;
    }

    function collectResultAnchors() {
      if (engine === "google") {
        return Array.from(document.querySelectorAll("#search a[href]")).filter(
          (anchor) =>
            Boolean(anchor.querySelector("h3")) &&
            !anchor.closest("#tads, #bottomads, [data-text-ad]"),
        );
      }

      if (engine === "bing") {
        return Array.from(
          document.querySelectorAll("#b_results li.b_algo h2 a[href], #b_results .b_algo h2 a[href]"),
        );
      }

      if (engine === "duckduckgo") {
        return Array.from(
          document.querySelectorAll(
            'a[data-testid="result-title-a"][href], a.result__a[href]',
          ),
        );
      }

      if (engine === "brave") {
        return Array.from(document.querySelectorAll("#results a[href]")).filter(
          (anchor) =>
            Boolean(anchor.querySelector(".snippet-title")) ||
            Boolean(anchor.closest(".snippet")),
        );
      }

      return [];
    }

    function unwrapKnownRedirect(url) {
      const host = url.hostname.toLowerCase().replace(/^www\./, "");

      if (/^google\.[a-z.]+$/.test(host) && url.pathname === "/url") {
        const target = url.searchParams.get("q") || url.searchParams.get("url");
        if (target) {
          return new URL(target, pageUrl);
        }
      }

      if (host.endsWith("duckduckgo.com") && url.pathname.startsWith("/l/")) {
        const target = url.searchParams.get("uddg");
        if (target) {
          return new URL(target, pageUrl);
        }
      }

      if ((host === "bing.com" || host.endsWith(".bing.com")) && url.pathname === "/ck/a") {
        const target = url.searchParams.get("u");
        if (target?.startsWith("a1")) {
          const encoded = target.slice(2).replace(/-/g, "+").replace(/_/g, "/");
          const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
          return new URL(atob(padded), pageUrl);
        }
      }

      return url;
    }

    function isSearchEngineInternal(url) {
      const host = url.hostname.toLowerCase().replace(/^www\./, "");

      if (engine === "google") {
        return /^google\.[a-z.]+$/.test(host) || host.endsWith(".google.com");
      }
      if (engine === "bing") {
        return host === "bing.com" || host.endsWith(".bing.com");
      }
      if (engine === "duckduckgo") {
        return host === "duckduckgo.com" || host.endsWith(".duckduckgo.com");
      }
      if (engine === "brave") {
        return host === "brave.com" || host.endsWith(".brave.com");
      }
      return false;
    }

    function resolveAnchor(anchor) {
      const rawUrl = anchor.href || anchor.getAttribute("href");
      if (!rawUrl) {
        return null;
      }

      try {
        const url = unwrapKnownRedirect(new URL(rawUrl, pageUrl));
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return null;
        }
        if (scope === "results" && isSearchEngineInternal(url)) {
          return null;
        }
        return url.href;
      } catch {
        return null;
      }
    }

    const anchors = scope === "results" ? collectResultAnchors() : collectAllAnchors(document);
    const urls = [];
    const seen = new Set();

    for (const anchor of anchors) {
      const url = resolveAnchor(anchor);
      if (url && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }

    return {
      engine,
      scope,
      candidates: anchors.length,
      urls,
    };
  }

  return extractLinksFromPage;
});
