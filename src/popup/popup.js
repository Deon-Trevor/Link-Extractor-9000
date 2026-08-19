(function initializePopup() {
  "use strict";

  const extensionApi = globalThis.browser || globalThis.chrome;
  const {
    STORAGE_KEY,
    createExportFile,
    dedupeUrlsByHostname,
    detectSearchEngine,
    filterUrls,
    getSearchAdapter,
    isPotentialSearchResultsPage,
    mergeUrls,
    normalizeCollection,
    removeUrl,
    toClipboardText,
  } = globalThis.LinkExtractor9000;

  const MAX_RENDERED_URLS = 100;

  const elements = {
    clearButton: document.getElementById("clear-button"),
    collectButton: document.getElementById("collect-button"),
    collectLabel: document.getElementById("collect-label"),
    copyButton: document.getElementById("copy-button"),
    count: document.getElementById("url-count"),
    dedupeButton: document.getElementById("dedupe-domains-button"),
    emptyState: document.getElementById("empty-state"),
    exportButtons: Array.from(document.querySelectorAll("[data-export-format]")),
    filterCount: document.getElementById("filter-count"),
    filterInput: document.getElementById("collection-filter"),
    managementPanel: document.getElementById("management-panel"),
    noFilterResults: document.getElementById("no-filter-results"),
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
  let dedupeArmed = false;
  let dedupeTimer = null;

  elements.collectButton.addEventListener("click", collectCurrentPage);
  elements.copyButton.addEventListener("click", copyCollection);
  elements.clearButton.addEventListener("click", clearCollection);
  elements.dedupeButton.addEventListener("click", dedupeCollectionByHostname);
  elements.filterInput.addEventListener("input", () => {
    const confirmationWasArmed = clearArmed || dedupeArmed;
    resetClearButton();
    resetDedupeButton();
    renderCollection();
    if (confirmationWasArmed) {
      setStatus("Confirmation cancelled.");
    }
  });
  elements.preview.addEventListener("click", removeCollectedUrl);
  elements.exportButtons.forEach((button) => {
    button.addEventListener("click", downloadCollection);
  });
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
      resetClearButton();
      resetDedupeButton();
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

  function downloadCollection(event) {
    if (!collection.urls.length) {
      return;
    }

    try {
      const format = event.currentTarget.dataset.exportFormat;
      const exportFile = createExportFile(collection.urls, format);
      const blobUrl = URL.createObjectURL(
        new Blob([exportFile.contents], { type: exportFile.mimeType }),
      );
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = exportFile.filename;
      downloadLink.hidden = true;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      setStatus(
        `${collection.urls.length} URLs exported as ${format.toUpperCase()}.`,
        "success",
      );
    } catch (error) {
      setStatus(`Export failed: ${cleanError(error)}`, "error");
    }
  }

  async function clearCollection() {
    if (!collection.urls.length) {
      return;
    }

    if (!clearArmed) {
      resetDedupeButton();
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
    resetDedupeButton();
    elements.filterInput.value = "";
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

  async function removeCollectedUrl(event) {
    const button = event.target.closest("[data-remove-url]");
    if (!button) {
      return;
    }

    const result = removeUrl(collection.urls, button.dataset.removeUrl);
    if (!result.removed) {
      return;
    }

    try {
      collection = {
        version: 1,
        urls: result.urls,
        updatedAt: new Date().toISOString(),
      };
      await extensionApi.storage.local.set({ [STORAGE_KEY]: collection });
      resetClearButton();
      resetDedupeButton();
      if (!collection.urls.length) {
        elements.filterInput.value = "";
      }
      renderCollection();
      await updateBadge();
      setStatus("URL removed from the saved collection.", "success");
    } catch (error) {
      setStatus(`Could not remove URL: ${cleanError(error)}`, "error");
    }
  }

  async function dedupeCollectionByHostname() {
    const result = dedupeUrlsByHostname(collection.urls);
    if (!result.removed) {
      setStatus("Already one saved URL per hostname.");
      return;
    }

    if (!dedupeArmed) {
      resetClearButton();
      dedupeArmed = true;
      elements.dedupeButton.dataset.armed = "true";
      elements.dedupeButton.textContent = `Confirm −${result.removed}`;
      setStatus("Press confirm to keep the first saved URL for each hostname.");
      dedupeTimer = setTimeout(resetDedupeButton, 3500);
      return;
    }

    try {
      collection = {
        version: 1,
        urls: result.urls,
        updatedAt: new Date().toISOString(),
      };
      await extensionApi.storage.local.set({ [STORAGE_KEY]: collection });
      resetClearButton();
      resetDedupeButton();
      renderCollection();
      await updateBadge();
      setStatus(
        `${result.removed} same-host URL${result.removed === 1 ? "" : "s"} removed.`,
        "success",
      );
    } catch (error) {
      setStatus(`Could not dedupe collection: ${cleanError(error)}`, "error");
    }
  }

  function resetDedupeButton() {
    clearTimeout(dedupeTimer);
    dedupeArmed = false;
    elements.dedupeButton.dataset.armed = "false";
    elements.dedupeButton.textContent = "Dedupe domains";
  }

  function renderCollection() {
    const count = collection.urls.length;
    const filteredUrls = filterUrls(collection.urls, elements.filterInput.value);
    const domainDuplicates = dedupeUrlsByHostname(collection.urls).removed;
    elements.count.textContent = count.toLocaleString();
    elements.copyButton.disabled = count === 0;
    elements.clearButton.disabled = count === 0;
    elements.exportButtons.forEach((button) => {
      button.disabled = count === 0;
    });
    elements.dedupeButton.disabled = count === 0 || domainDuplicates === 0;
    elements.filterInput.disabled = count === 0;
    elements.filterCount.textContent = `${filteredUrls.length.toLocaleString()} of ${count.toLocaleString()}`;
    elements.managementPanel.hidden = count === 0;
    elements.emptyState.hidden = count > 0;
    elements.noFilterResults.hidden = count === 0 || filteredUrls.length > 0;
    elements.preview.hidden = count === 0 || filteredUrls.length === 0;
    elements.preview.replaceChildren();

    for (const url of filteredUrls.slice(-MAX_RENDERED_URLS).reverse()) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const removeButton = document.createElement("button");
      label.textContent = url;
      label.title = url;
      removeButton.className = "remove-url-button";
      removeButton.type = "button";
      removeButton.dataset.removeUrl = url;
      removeButton.textContent = "×";
      removeButton.title = `Remove ${url}`;
      removeButton.setAttribute("aria-label", `Remove ${url}`);
      item.append(label, removeButton);
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
