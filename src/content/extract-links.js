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
    const scope =
      settings.scope === "results" || settings.scope === "detect" ? settings.scope : "all";
    const engine = settings.engine || null;
    const adapter = settings.adapter || null;
    const pageUrl = new URL(location.href);
    const genericResultSelector = [
      "#results article h2 a[href]",
      "#results article h3 a[href]",
      "#search-results article h2 a[href]",
      "#search-results article h3 a[href]",
      ".search-results .result h2 a[href]",
      ".search-results .result h3 a[href]",
      "main .search-result h2 a[href]",
      "main .search-result h3 a[href]",
      "main a.search-result-anchor[href]",
    ].join(", ");
    const searxngResultSelector = "#results article.result h3 a[href]";

    function detectSearchEngineFromDom() {
      const generator = document.querySelector('meta[name="generator"]');
      const generatorName = generator?.getAttribute("content")?.toLowerCase() || "";
      const applicationName =
        document
          .querySelector('meta[name="application-name"]')
          ?.getAttribute("content")
          ?.toLowerCase() || "";
      const searxngSearchLink = document.querySelector(
        'link[rel="search"][title="SearXNG"]',
      );

      if (generatorName.startsWith("searxng/") || searxngSearchLink) {
        return { id: "searxng", label: "SearXNG" };
      }

      if (generatorName.includes("mastodon") || applicationName.includes("mastodon")) {
        return { id: "mastodon", label: "Mastodon" };
      }

      if (document.querySelectorAll(genericResultSelector).length) {
        return { id: "generic-search", label: "Search page" };
      }

      return null;
    }

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
      if (adapter) {
        return collectAllAnchors(document).filter((anchor) => {
          if (!anchorIsInAdapterScope(anchor)) {
            return false;
          }

          const rawUrl = anchor.href || anchor.getAttribute("href");
          if (!rawUrl) {
            return false;
          }

          try {
            return Boolean(findAdapterResultRule(new URL(rawUrl, pageUrl)));
          } catch {
            return false;
          }
        });
      }

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
        // Brave Search moved to Svelte with hashed class names: #results became
        // #mixed-main and .snippet-title became .search-snippet-title. The
        // .snippet block and its data-pos attribute survived the rewrite, so
        // scope to those. #results stays as a fallback for older markup.
        return Array.from(
          document.querySelectorAll(
            "#mixed-main .snippet a[href], .snippet[data-pos] a[href], #results a[href]",
          ),
        ).filter(
          (anchor) =>
            Boolean(anchor.querySelector(".snippet-title")) ||
            Boolean(anchor.querySelector(".search-snippet-title")) ||
            Boolean(anchor.closest(".snippet")),
        );
      }

      if (engine === "startpage") {
        return Array.from(
          document.querySelectorAll("a.result-title.result-link[href]"),
        );
      }

      if (engine === "syncpundit-search") {
        return Array.from(
          document.querySelectorAll(".search-result > a.search-result-anchor[href]"),
        );
      }

      if (engine === "searxng") {
        return Array.from(document.querySelectorAll(searxngResultSelector));
      }

      if (engine === "generic-search") {
        return Array.from(document.querySelectorAll(genericResultSelector));
      }

      return [];
    }

    function anchorIsInAdapterScope(anchor) {
      if (typeof anchor.closest !== "function") {
        return !(adapter.anchorScopeSelectors || []).length;
      }

      if (anchor.closest('nav, header, footer, aside, [role="navigation"]')) {
        return false;
      }

      if (
        (adapter.anchorRejectSelectors || []).some((selector) =>
          anchor.closest(selector),
        )
      ) {
        return false;
      }

      const scopes = adapter.anchorScopeSelectors || [];
      return !scopes.length || scopes.some((selector) => anchor.closest(selector));
    }

    function hostMatches(host, domains) {
      return (domains || []).some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      );
    }

    function findAdapterResultRule(url) {
      if (!adapter) {
        return null;
      }

      const host = url.hostname.toLowerCase();
      return (
        adapter.resultRules.find((rule) => {
          let validHost = hostMatches(host, rule.hosts || adapter.hosts);
          if (rule.external) {
            validHost = !hostMatches(host, adapter.hosts);
          } else if (rule.sameHost) {
            validHost = host === pageUrl.hostname.toLowerCase();
          }

          return (
            validHost &&
            new RegExp(rule.pathPattern).test(url.pathname) &&
            (!rule.hashPattern || new RegExp(rule.hashPattern).test(url.hash)) &&
            (rule.requiredParams || []).every((parameter) =>
              url.searchParams.has(parameter),
            )
          );
        }) || null
      );
    }

    function canonicalizeAdapterUrl(url, rule) {
      const canonical = new URL(url.href);
      if (!rule.keepHash) {
        canonical.hash = "";
      }

      if (Array.isArray(rule.keepParams)) {
        for (const parameter of Array.from(canonical.searchParams.keys())) {
          if (!rule.keepParams.includes(parameter)) {
            canonical.searchParams.delete(parameter);
          }
        }
      }

      return canonical;
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
      if (engine === "startpage") {
        return host === "startpage.com" || host.endsWith(".startpage.com");
      }
      if (engine === "syncpundit-search" || engine === "searxng") {
        const pageHost = pageUrl.hostname.toLowerCase().replace(/^www\./, "");
        return host === pageHost;
      }
      return false;
    }

    function resolveAnchor(anchor) {
      const rawUrl = anchor.href || anchor.getAttribute("href");
      if (!rawUrl) {
        return null;
      }

      try {
        let url = unwrapKnownRedirect(new URL(rawUrl, pageUrl));
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return null;
        }

        if (scope === "results" && adapter) {
          const rule = findAdapterResultRule(url);
          if (!rule) {
            return null;
          }
          url = canonicalizeAdapterUrl(url, rule);
        } else if (scope === "results" && isSearchEngineInternal(url)) {
          return null;
        }
        return url.href;
      } catch {
        return null;
      }
    }

    if (scope === "detect") {
      const detectedEngine = detectSearchEngineFromDom();
      return {
        engine: detectedEngine?.id || null,
        searchEngine: detectedEngine,
        scope,
        candidates: 0,
        urls: [],
      };
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

    // Some apps render every result as an internal link. Telegram Web's rows are
    // anchors pointing at "#<chatId>", which means nothing outside the signed-in
    // session, while the public identity sits in the row text as an @username.
    // Where an adapter declares derivePublicLinks, build the public URL from that
    // text instead. Driven entirely by adapter config so it cannot fire on a
    // platform that did not ask for it, and scoped to the row rather than the
    // document, because an unscoped text scan also matches CSS @layer rules.
    const derivation = scope === "results" ? adapter && adapter.derivePublicLinks : null;
    if (derivation) {
      const username = new RegExp(derivation.usernamePattern);

      const deriveFrom = (selector) => {
        const derived = [];
        if (!selector) {
          return derived;
        }

        for (const row of document.querySelectorAll(selector)) {
          const found = username.exec((row.textContent || "").trim());
          if (found) {
            derived.push(derivation.template.replace("{username}", found[1]));
          }
        }

        return derived;
      };

      // Prefer search rows by what they yield, not by whether they match. The
      // app keeps inactive slides mounted, so the preferred selector can match a
      // hollow search island and find nothing. Preferring on match alone turned
      // a page showing six results into zero collected, with no fallback.
      const derived = deriveFrom(derivation.preferredSelector);
      const rows = derived.length ? derived : deriveFrom(derivation.anchorSelector);

      for (const url of rows) {
        if (!seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
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
