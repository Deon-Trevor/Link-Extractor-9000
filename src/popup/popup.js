(function initializePopup() {
  "use strict";

  const extensionApi = globalThis.browser || globalThis.chrome;
  const {
    STORAGE_KEY,
    detectSearchEngine,
    getSearchAdapter,
    isPotentialSearchResultsPage,
    mergeUrls,
    normalizeCollection,
    toClipboardText,
  } = globalThis.LinkExtractor9000;

  const elements = {
    clearButton: document.getElementById("clear-button"),
    collectButton: document.getElementById("collect-button"),
    collectLabel: document.getElementById("collect-label"),
    copyButton: document.getElementById("copy-button"),
    count: document.getElementById("url-count"),
    emptyState: document.getElementById("empty-state"),
    pageHost: document.getElementById("page-host"),
    pageKind: document.getElementById("page-kind"),
    preview: document.getElementById("url-preview"),
    scopePanel: document.getElementById("search-scope"),
    searchEngineLabel: document.getElementById("search-engine-label"),
    status: document.getElementById("status"),
  };

  let activeTab = null;
  let collection = normalizeCollection(null);
  let searchEngine = null;
  let clearArmed = false;
  let clearTimer = null;

  elements.collectButton.addEventListener("click", collectCurrentPage);
  elements.copyButton.addEventListener("click", copyCollection);
  elements.clearButton.addEventListener("click", clearCollection);
  document.querySelectorAll('input[name="scope"]').forEach((input) => {
    input.addEventListener("change", updateCollectLabel);
  });

  start();

  async function start() {
    if (
      !extensionApi?.tabs?.query ||
      !extensionApi?.storage?.local?.get ||
      !extensionApi?.scripting?.executeScript
    ) {
      setStatus("Install the extension to connect to an active tab.", "error");
      elements.pageHost.textContent = "Extension API unavailable";
      document.documentElement.dataset.ready = "true";
      return;
    }

    try {
      const [tabs, stored] = await Promise.all([
        extensionApi.tabs.query({ active: true, currentWindow: true }),
        extensionApi.storage.local.get(STORAGE_KEY),
      ]);

      activeTab = tabs[0] || null;
      collection = normalizeCollection(stored[STORAGE_KEY]);
      renderCollection();
      await renderPageContext();
      elements.collectButton.disabled = !activeTab?.id;
      await updateBadge();
    } catch (error) {
      setStatus(cleanError(error), "error");
    } finally {
      document.documentElement.dataset.ready = "true";
    }
  }

  async function renderPageContext() {
    if (!activeTab?.url) {
      elements.pageHost.textContent = "No active webpage";
      return;
    }

    let url;
    try {
      url = new URL(activeTab.url);
    } catch {
      elements.pageHost.textContent = activeTab.title || "Unsupported page";
      return;
    }

    elements.pageHost.textContent = url.hostname || activeTab.title || "Current page";
    searchEngine = detectSearchEngine(url.href);

    if (!searchEngine && isPotentialSearchResultsPage(url.href)) {
      searchEngine = await detectSearchEngineFromPage();
    }

    if (searchEngine) {
      elements.scopePanel.hidden = false;
      elements.searchEngineLabel.textContent = `${searchEngine.label} results`;
      elements.pageKind.textContent = "Search detected";
    } else {
      elements.scopePanel.hidden = true;
      elements.pageKind.textContent = "Page scan";
    }

    updateCollectLabel();
  }

  async function detectSearchEngineFromPage() {
    try {
      const executions = await extensionApi.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: globalThis.extractLinksFromPage,
        args: [{ scope: "detect" }],
      });
      return executions.find((execution) => execution.result?.searchEngine)?.result
        ?.searchEngine || null;
    } catch {
      return null;
    }
  }

  function selectedScope() {
    if (!searchEngine) {
      return "all";
    }

    return document.querySelector('input[name="scope"]:checked')?.value || "results";
  }

  function updateCollectLabel() {
    const resultOnly = searchEngine && selectedScope() === "results";
    elements.collectLabel.textContent = resultOnly ? "Collect result URLs" : "Collect every page URL";
  }

  async function collectCurrentPage() {
    if (!activeTab?.id) {
      return;
    }

    const scope = selectedScope();
    setBusy(true);
    setStatus(scope === "results" ? "Reading search results…" : "Scanning loaded page links…");

    try {
      const executions = await extensionApi.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: globalThis.extractLinksFromPage,
        args: [
          {
            scope,
            engine: searchEngine?.id || null,
            adapter: getSearchAdapter(searchEngine?.id),
          },
        ],
      });
      const incoming = executions.flatMap((execution) => execution.result?.urls || []);
      const merged = mergeUrls(collection.urls, incoming);

      collection = {
        version: 1,
        urls: merged.urls,
        updatedAt: new Date().toISOString(),
      };
      await extensionApi.storage.local.set({ [STORAGE_KEY]: collection });
      renderCollection();
      await updateBadge();

      if (!incoming.length) {
        setStatus("No matching URLs found in the currently loaded page.", "error");
      } else {
        const duplicateText = `${merged.duplicates} duplicate${merged.duplicates === 1 ? "" : "s"}`;
        setStatus(`${merged.added} added · ${duplicateText} ignored`, "success");
      }
    } catch (error) {
      setStatus(`Could not read this page: ${cleanError(error)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyCollection() {
    if (!collection.urls.length) {
      return;
    }

    try {
      await navigator.clipboard.writeText(toClipboardText(collection.urls));
      setStatus(`${collection.urls.length} URLs copied to clipboard.`, "success");
    } catch (error) {
      setStatus(`Clipboard failed: ${cleanError(error)}`, "error");
    }
  }

  async function clearCollection() {
    if (!collection.urls.length) {
      return;
    }

    if (!clearArmed) {
      clearArmed = true;
      elements.clearButton.dataset.armed = "true";
      elements.clearButton.textContent = "Confirm clear";
      setStatus("Press confirm clear to remove the saved collection.");
      clearTimer = setTimeout(resetClearButton, 3500);
      return;
    }

    collection = normalizeCollection(null);
    await extensionApi.storage.local.set({ [STORAGE_KEY]: collection });
    resetClearButton();
    renderCollection();
    await updateBadge();
    setStatus("Collection cleared.", "success");
  }

  function resetClearButton() {
    clearTimeout(clearTimer);
    clearArmed = false;
    elements.clearButton.dataset.armed = "false";
    elements.clearButton.textContent = "Clear";
  }

  function renderCollection() {
    const count = collection.urls.length;
    elements.count.textContent = count.toLocaleString();
    elements.copyButton.disabled = count === 0;
    elements.clearButton.disabled = count === 0;
    elements.emptyState.hidden = count > 0;
    elements.preview.hidden = count === 0;
    elements.preview.replaceChildren();

    for (const url of collection.urls.slice(-4).reverse()) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = url;
      label.title = url;
      item.appendChild(label);
      elements.preview.appendChild(item);
    }
  }

  async function updateBadge() {
    const count = collection.urls.length;
    const text = count > 999 ? "999+" : count ? String(count) : "";
    await extensionApi.action.setBadgeBackgroundColor({ color: "#659315" });
    await extensionApi.action.setBadgeText({ text });
  }

  function setBusy(busy) {
    elements.collectButton.disabled = busy || !activeTab?.id;
    elements.collectButton.setAttribute("aria-busy", String(busy));
  }

  function setStatus(message, tone) {
    elements.status.textContent = message;
    if (tone) {
      elements.status.dataset.tone = tone;
    } else {
      delete elements.status.dataset.tone;
    }
  }

  function cleanError(error) {
    return error?.message || String(error || "Unknown error");
  }
})();
