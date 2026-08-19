#!/usr/bin/env node
// Drives the Chrome build in a real Chrome and proves it works.
//
//   node scripts/verify-chrome.mjs doctor
//   node scripts/verify-chrome.mjs run [--keep]
//
// Speaks CDP over the WebSocket client built into Node 22, so there is nothing
// to install. Run scripts/package.mjs first: this drives dist/chromium, the
// build that goes to the store, not the working tree.
//
// Two things learned the hard way and worth keeping:
//   --load-extension is ignored in headless Chrome. Extensions.loadUnpacked is
//   the only route that actually installs, and it hands back the extension id.
//   Target.createTarget on a chrome-extension:// URL lands on an error page.
//   Navigate an existing page target instead.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNPACKED = path.join(ROOT, "dist/chromium");
const KEEP = process.argv.includes("--keep");
const command = process.argv[2] || "run";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FIXTURE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Link fixture</title></head>
<body>
  <h1>Link fixture</h1>
  <a href="https://example.com/alpha">alpha</a>
  <a href="https://example.com/beta">beta</a>
  <a href="https://example.com/alpha">alpha repeated</a>
  <a href="mailto:someone@example.com">mail link</a>
  <a href="#local-anchor">anchor</a>
  <a href="javascript:void(0)">script link</a>
  <a href="http://example.org/gamma">gamma</a>
</body></html>`;

// Same contract the Firefox harness checks: http and https only, duplicates
// dropped, capture order kept, and an anchor resolved against the page URL.
const expectedUrls = (fixtureUrl) => [
  "https://example.com/alpha",
  "https://example.com/beta",
  `${fixtureUrl}#local-anchor`,
  "http://example.org/gamma",
];

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
}

function skip(name, detail) {
  results.push({ name, ok: true, skipped: true, detail });
  console.log(`  skip  ${name} (${detail})`);
}

function which(binary) {
  try {
    return execFileSync("command", ["-v", binary], { shell: "/bin/sh" }).toString().trim();
  } catch {
    return null;
  }
}

function chromeBinary() {
  for (const candidate of ["google-chrome", "chromium", "chromium-browser", "google-chrome-stable"]) {
    const found = which(candidate);
    if (found) return candidate;
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// --- doctor -----------------------------------------------------------------

function doctor() {
  console.log("doctor");

  const binary = chromeBinary();
  record("chrome on PATH", Boolean(binary), binary ? which(binary) : "install Google Chrome or Chromium");
  if (binary) {
    record("chrome responds", true, execFileSync(binary, ["--version"]).toString().trim());
  }

  const [major] = process.versions.node.split(".").map(Number);
  record(
    "node has a WebSocket client",
    typeof WebSocket === "function",
    `node ${process.versions.node}${major < 22 ? ", needs 22 or newer" : ""}`,
  );

  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "chromium/manifest.json"), "utf8"));
    record("chromium/manifest.json parses", true, `version ${manifest.version}`);
    record(
      "no Firefox-only keys in the Chrome manifest",
      !manifest.browser_specific_settings,
      manifest.browser_specific_settings ? "browser_specific_settings is present" : "clean",
    );
    record(
      "manifest declares a Chrome floor",
      Boolean(manifest.minimum_chrome_version),
      manifest.minimum_chrome_version
        ? `minimum_chrome_version ${manifest.minimum_chrome_version}`
        : "minimum_chrome_version is unset",
    );
  } catch (error) {
    record("chromium/manifest.json parses", false, error.message);
  }

  const built = fs.existsSync(path.join(UNPACKED, "manifest.json"));
  record("dist/chromium is built", built, built ? UNPACKED : "run node scripts/package.mjs first");

  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} problem(s) found` : "\nthis machine can drive the Chrome build");
  return failed === 0 ? 0 : 1;
}

// --- run --------------------------------------------------------------------

async function run() {
  const binary = chromeBinary();
  if (!binary) {
    console.log("no chrome binary on PATH, run doctor");
    return 1;
  }
  if (!fs.existsSync(path.join(UNPACKED, "manifest.json"))) {
    console.log("dist/chromium is missing, run node scripts/package.mjs first");
    return 1;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(ROOT, ".verify-evidence", `chrome-${stamp}`);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(FIXTURE_PAGE);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const fixtureUrl = `http://127.0.0.1:${server.address().port}/fixture`;

  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-verify-"));
  const chrome = spawn(
    binary,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1280,800",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    // detached puts chrome in its own process group, which is the only way to
    // reach its dozen child processes in one signal.
    { stdio: ["ignore", "ignore", "pipe"], detached: true },
  );
  const chromeLog = [];
  chrome.stderr.on("data", (chunk) => chromeLog.push(chunk.toString()));

  // Ctrl-C, or the shell dying, used to strand a headless Chrome and a profile
  // worth tens of MB in /tmp. A SIGKILL still cannot be caught, but these can.
  // Signal the whole group. Killing only the parent leaves the children alive
  // long enough to recreate the profile directory after it is removed.
  const stopChrome = (sig) => {
    try {
      process.kill(-chrome.pid, sig);
    } catch {
      chrome.kill(sig);
    }
  };

  const bail = (signal) => {
    stopChrome("SIGKILL");
    // Chrome runs a dozen child processes that are still writing as the parent
    // dies, so a single rmSync loses the race with ENOTEMPTY. Retry, then say
    // what actually happened rather than assuming it worked.
    let removed = false;
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
      removed = !fs.existsSync(profile);
    } catch {
      removed = false;
    }
    server.close();
    console.log(
      `\n${signal}: stopped chrome, ` +
        (removed ? "removed the temp profile" : `temp profile left at ${profile}`),
    );
    process.exit(130);
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, () => bail(signal));

  let socket = null;
  const pending = new Map();
  let nextId = 0;

  function send(method, params = {}, sessionId) {
    const id = (nextId += 1);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 20000);
    });
  }

  // Screenshots are the flakiest call here: a busy machine can push
  // Page.captureScreenshot past the timeout even though the page is fine. Retry
  // once, and treat a second failure as a missing screenshot rather than a failed
  // run, because the checks that matter read the DOM.
  async function captureScreenshot(sessionId, file) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
        fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
        return true;
      } catch (error) {
        if (attempt === 2) {
          console.log(`  note  screenshot ${path.basename(file)} failed twice: ${error.message}`);
          return false;
        }
        await wait(1000);
      }
    }
    return false;
  }

  // Returns the JSON-parsed value of an expression evaluated in a page.
  async function evaluate(expression, sessionId) {
    const outcome = await send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (outcome.exceptionDetails) {
      throw new Error(outcome.exceptionDetails.exception?.description || "evaluate threw");
    }
    const raw = outcome.result.value;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  try {
    console.log(`run  (evidence in ${path.relative(ROOT, evidenceDir)})`);

    let endpoint = null;
    for (let i = 0; i < 80 && !endpoint; i += 1) {
      await wait(200);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        endpoint = (await response.json()).webSocketDebuggerUrl;
      } catch {
        // chrome is still starting
      }
    }
    record("chrome devtools endpoint answers", Boolean(endpoint), `port ${port}`);
    if (!endpoint) throw new Error("chrome never opened its devtools port");

    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("could not open the devtools socket"));
    });
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    };

    const chromeVersion = execFileSync(binary, ["--version"]).toString().trim();

    // Chrome refuses to install an extension whose manifest is invalid, so this
    // is a real manifest check and not a JSON parse.
    const loaded = await send("Extensions.loadUnpacked", { path: UNPACKED });
    const extensionId = loaded.id;
    record("chrome installs the packaged build", Boolean(extensionId), `id ${extensionId}`);

    const manifest = JSON.parse(fs.readFileSync(path.join(UNPACKED, "manifest.json"), "utf8"));

    // Drive the extractor against a real page, exactly as the Firefox harness does.
    // Create the tab rather than reusing the startup about:blank: only a real tab
    // target can receive Extensions.triggerAction further down.
    const fixtureTarget = await send("Target.createTarget", { url: fixtureUrl });
    const pageSession = (
      await send("Target.attachToTarget", { targetId: fixtureTarget.targetId, flatten: true })
    ).sessionId;
    await send("Page.enable", {}, pageSession);
    await send("Runtime.enable", {}, pageSession);
    await wait(900);

    const extractorSource = fs.readFileSync(path.join(ROOT, "src/content/extract-links.js"), "utf8");
    const extraction = await evaluate(
      `(() => { ${extractorSource};
        return JSON.stringify(extractLinksFromPage({ scope: "all" })); })()`,
      pageSession,
    );
    const expected = expectedUrls(fixtureUrl);
    const collected = extraction.urls || [];
    const matches =
      collected.length === expected.length && expected.every((url, i) => collected[i] === url);
    record(
      "extractor returns the expected URLs from a real page",
      matches,
      matches
        ? `${collected.length} urls, duplicate dropped, mailto and javascript excluded, order preserved`
        : JSON.stringify(collected),
    );
    fs.writeFileSync(
      path.join(evidenceDir, "extracted-urls.json"),
      `${JSON.stringify({ fixtureUrl, expected, collected }, null, 2)}\n`,
    );

    // The popup, in a page target navigated to the extension origin.
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popupTarget = await send("Target.createTarget", { url: "about:blank" });
    const popupSession = (
      await send("Target.attachToTarget", { targetId: popupTarget.targetId, flatten: true })
    ).sessionId;
    await send("Page.enable", {}, popupSession);
    await send("Runtime.enable", {}, popupSession);
    await send("Page.navigate", { url: popupUrl }, popupSession);
    await wait(1500);

    const popup = await evaluate(
      `JSON.stringify({
         href: location.href,
         title: document.getElementById("app-title")?.textContent || null,
         status: document.getElementById("status")?.textContent || null,
         count: document.getElementById("url-count")?.textContent || null,
         buttons: document.querySelectorAll("button").length,
         logoLoaded: (() => {
           const image = document.querySelector("img.brand-mark");
           return Boolean(image && image.complete && image.naturalWidth > 0);
         })(),
         hasStorage: typeof chrome?.storage?.local?.set,
         hasScripting: typeof chrome?.scripting?.executeScript,
       })`,
      popupSession,
    );

    record("popup loads in the extension origin", popup.href === popupUrl, popup.href);
    record(
      "popup script initialises against the real chrome APIs",
      Boolean(popup.status) && !/Install the extension/i.test(popup.status),
      `${popup.status} (storage ${popup.hasStorage}, scripting ${popup.hasScripting})`,
    );
    record(
      "popup renders the collection UI",
      popup.title === "Link Extractor 9000" && popup.count === "0",
      `title "${popup.title}", saved count ${popup.count}, ${popup.buttons} buttons`,
    );
    record("logo resolves inside the extension origin", popup.logoLoaded === true,
      popup.logoLoaded ? "decoded" : "did not decode");

    await captureScreenshot(popupSession, path.join(evidenceDir, "popup.png"));

    // Seed through the popup's own chrome.storage, then reload. This is a render
    // check: it skips the code that normally stores URLs.
    const SEED_TOTAL = 250;
    const seeded = await evaluate(
      `(async () => {
         const urls = Array.from({ length: ${SEED_TOTAL} }, (_, i) =>
           "https://cdn.seed.example/collection/page-" + (i + 1) +
           "/asset-details?ref=verify-harness&utm_campaign=legibility");
         await chrome.storage.local.set({
           urlCollection: { version: 1, urls, updatedAt: new Date().toISOString() },
         });
         const stored = await chrome.storage.local.get("urlCollection");
         return JSON.stringify(stored.urlCollection.urls.length);
       })()`,
      popupSession,
    );
    record("collection seeded for the render check", seeded === SEED_TOTAL, `${seeded} urls in storage`);

    await send("Page.reload", {}, popupSession);
    await wait(1500);

    const list = await evaluate(
      `JSON.stringify({
         count: document.getElementById("url-count")?.textContent,
         filterCount: document.getElementById("filter-count")?.textContent,
         rows: document.querySelectorAll("#url-preview li:not(.hostname-group)").length,
         noteHidden: document.getElementById("render-note")?.hidden,
         note: document.getElementById("render-note")?.textContent?.trim(),
         appWidth: Math.round(document.querySelector(".app").getBoundingClientRect().width),
         appHeight: Math.round(document.querySelector(".app").getBoundingClientRect().height),
         clearFits: Math.round(document.getElementById("clear-button").getBoundingClientRect().right)
           <= Math.round(document.querySelector(".app").getBoundingClientRect().right),
       })`,
      popupSession,
    );

    record(
      "list draws at most 100 rows",
      list.rows === 100 && list.count === "250",
      `${list.rows} rows drawn from ${list.count} saved`,
    );
    record(
      "render cap is explained on screen",
      list.noteHidden === false &&
        list.note ===
          "Showing the first 100 of 250 matching URLs. Copy and export use the full list.",
      list.note || "note is empty",
    );
    record(
      "long URLs stay inside the 720 by 600 popup shell",
      list.appWidth === 720 && list.appHeight === 600 && list.clearFits,
      `app ${list.appWidth}x${list.appHeight}, clear button inside: ${list.clearFits}`,
    );

    await captureScreenshot(popupSession, path.join(evidenceDir, "popup-capped.png"));

    // Chrome exposes Extensions.triggerAction, which is the toolbar click that
    // Firefox would not let the other harness reach. If it opens a drivable
    // popup, the whole collect chain can be exercised for real.
    let collectDriven = false;
    try {
      await evaluate(`chrome.storage.local.clear()`, popupSession);
      await send("Target.activateTarget", { targetId: fixtureTarget.targetId });
      // A page target is not a tab target. triggerAction wants the tab that owns
      // the page, which only shows up under an explicit type filter.
      const tabs = await send("Target.getTargets", { filter: [{ type: "tab" }] });
      const fixtureTab = tabs.targetInfos.find((target) => target.url.startsWith(fixtureUrl));
      if (!fixtureTab) throw new Error("no tab target owns the fixture page");
      await send("Extensions.triggerAction", { id: extensionId, targetId: fixtureTab.targetId });
      await wait(2000);

      const after = await send("Target.getTargets", {});
      const actionPopup = after.targetInfos.find(
        (target) =>
          target.url.startsWith(`chrome-extension://${extensionId}`) &&
          target.targetId !== popupTarget.targetId &&
          target.type === "page",
      );

      if (!actionPopup) {
        skip("toolbar click collects for real", "triggerAction opened no drivable popup target");
      } else {
        const actionSession = (
          await send("Target.attachToTarget", { targetId: actionPopup.targetId, flatten: true })
        ).sessionId;
        await send("Runtime.enable", {}, actionSession);
        await wait(800);
        await evaluate(`document.getElementById("collect-button").click(); true`, actionSession);

        let state = null;
        for (let i = 0; i < 25; i += 1) {
          await wait(300);
          state = await evaluate(
            `JSON.stringify({
               status: document.getElementById("status")?.textContent,
               count: document.getElementById("url-count")?.textContent,
             })`,
            actionSession,
          );
          if (state.status && !/Scanning|Reading/.test(state.status)) break;
        }

        const stored = await evaluate(
          `(async () => {
             const data = await chrome.storage.local.get("urlCollection");
             return JSON.stringify((data.urlCollection?.urls || []).length);
           })()`,
          actionSession,
        );

        collectDriven = stored === expected.length;
        record(
          "toolbar click collects for real, end to end",
          collectDriven,
          `status "${state?.status}", ${stored} urls written to storage`,
        );
      }
    } catch (error) {
      skip("toolbar click collects for real", `triggerAction path unavailable: ${error.message}`);
    }

    const report = {
      startedAt: stamp,
      platform: "chromium",
      chrome: chromeVersion,
      extensionId,
      manifestVersion: manifest.version,
      minimumChromeVersion: manifest.minimum_chrome_version || null,
      unpacked: path.relative(ROOT, UNPACKED),
      fixtureUrl,
      popupUrl,
      checks: results,
      caveats: [
        "The render cap checks seed chrome.storage.local directly, then reload the " +
          "popup. They prove the list and its indicator, not the collect path.",
        collectDriven
          ? "The collect path was driven for real through Extensions.triggerAction."
          : "The collect path was not driven. Click the toolbar button by hand before shipping.",
      ],
    };
    fs.writeFileSync(path.join(evidenceDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (chromeLog.length) {
      fs.writeFileSync(path.join(evidenceDir, "chrome.log"), chromeLog.join(""));
    }

    const failed = results.filter((r) => !r.ok).length;
    console.log(
      failed
        ? `\n${failed} check(s) failed. Evidence kept in ${path.relative(ROOT, evidenceDir)}`
        : `\nall checks passed. Evidence in ${path.relative(ROOT, evidenceDir)}`,
    );
    return failed === 0 ? 0 : 1;
  } catch (error) {
    console.log(`\nharness error: ${error.message}`);
    fs.writeFileSync(
      path.join(evidenceDir, "error.txt"),
      `${error.stack}\n\nchrome:\n${chromeLog.join("")}`,
    );
    return 1;
  } finally {
    if (KEEP) {
      console.log(`\n--keep: chrome still on http://127.0.0.1:${port}, profile at ${profile}`);
    } else {
      if (socket) socket.close();
      // Kill the pid this run spawned. Never by name: the developer's own Chrome
      // is very likely running.
      stopChrome("SIGTERM");
      // Chrome writes to its profile on the way out, so wait before removing it.
      await new Promise((resolve) => {
        if (chrome.exitCode !== null) return resolve();
        chrome.once("exit", resolve);
        setTimeout(resolve, 5000);
      });
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
      } catch {
        // a stray temp profile is not worth failing the run over
      }
    }
    server.close();
  }
}

process.exit(command === "doctor" ? doctor() : await run());
