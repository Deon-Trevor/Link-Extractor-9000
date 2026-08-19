#!/usr/bin/env node
// Drives the Firefox build in a real Firefox through geckodriver.
//
//   node scripts/verify-firefox.mjs doctor
//   node scripts/verify-firefox.mjs run [--keep] [--from <path>] [--evidence <dir>]
//
// The sibling of scripts/verify-chrome.mjs. Run scripts/package.mjs first: this
// drives dist/firefox, the build that goes to AMO, not the working tree.
//
// doctor is read-only. run installs the extension into a throwaway Firefox
// profile, drives it, writes evidence, and tears down only what it started.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT_ID = "link-extractor-9000@deon-trevor";

// Pinning the UUID makes moz-extension:// URLs predictable. Without this the
// popup page address changes on every install and cannot be opened by name.
const EXT_UUID = "3f7c1a20-9b64-4d5e-8a11-0c2d7e6b4f90";

const command = process.argv[2] || "run";
const KEEP = process.argv.includes("--keep");
const evidenceFlag = process.argv.indexOf("--evidence");
// --from lets a release candidate be driven instead of the working tree, so the
// artifact that goes to AMO is the thing that got tested.
const fromFlag = process.argv.indexOf("--from");
const INSTALL_PATH = fromFlag > -1 ? path.resolve(process.argv[fromFlag + 1]) : null;
// With no --from, drive the built Firefox package rather than the repo, which no
// longer has a manifest at its root.
const DEFAULT_INSTALL = path.join(ROOT, "dist/firefox");
const EVIDENCE_ROOT =
  evidenceFlag > -1 ? process.argv[evidenceFlag + 1] : path.join(ROOT, ".verify-evidence");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The fixture is served over http because the extension only collects http and
// https links, and because file:// carries different permission rules.
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

// What the extractor is contracted to return for FIXTURE_PAGE: http and https
// only, duplicates dropped, capture order preserved. The anchor link is in the
// fixture on purpose. src/content/extract-links.js keeps any href that resolves
// to http or https, so "#local-anchor" comes back as the page URL plus its
// fragment. mailto: and javascript: are dropped.
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

function which(binary) {
  try {
    return execFileSync("command", ["-v", binary], { shell: "/bin/sh" }).toString().trim();
  } catch {
    return null;
  }
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

function portAnswering(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

// --- doctor -----------------------------------------------------------------

function doctor() {
  console.log("doctor");

  const gecko = which("geckodriver");
  record("geckodriver on PATH", Boolean(gecko), gecko || "install geckodriver");

  const firefox = which("firefox");
  record("firefox on PATH", Boolean(firefox), firefox || "install firefox");

  if (gecko) {
    const version = execFileSync("geckodriver", ["--version"]).toString().split("\n")[0];
    record("geckodriver responds", true, version);
  }

  if (firefox) {
    const version = execFileSync("firefox", ["--version"]).toString().trim();
    record("firefox responds", true, version);
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "firefox/manifest.json"), "utf8"));
    record(
      "firefox/manifest.json parses and declares the expected id",
      manifest.browser_specific_settings?.gecko?.id === EXT_ID,
      manifest.browser_specific_settings?.gecko?.id || "no gecko id",
    );
    record(
      "manifest still relies on activeTab only",
      !manifest.host_permissions,
      manifest.host_permissions
        ? `host_permissions present: ${JSON.stringify(manifest.host_permissions)}`
        : "no host_permissions, matching the shipped product",
    );
  } catch (error) {
    record("manifest parses", false, error.message);
  }

  const extractor = path.join(ROOT, "src/content/extract-links.js");
  record("content extractor present", fs.existsSync(extractor), "src/content/extract-links.js");

  const built = fs.existsSync(path.join(ROOT, "dist/firefox/manifest.json"));
  record("dist/firefox is built", built, built ? "dist/firefox" : "run node scripts/package.mjs first");

  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} problem(s) found` : "\nthis machine can drive the extension");
  return failed === 0 ? 0 : 1;
}

// --- run --------------------------------------------------------------------

async function run() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidenceDir = path.join(EVIDENCE_ROOT, stamp);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(FIXTURE_PAGE);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const fixtureUrl = `http://127.0.0.1:${server.address().port}/fixture`;

  const geckoPort = await freePort();
  const gecko = spawn("geckodriver", ["--port", String(geckoPort)], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  const geckoLog = [];
  gecko.stderr.on("data", (chunk) => geckoLog.push(chunk.toString()));

  // Ctrl-C, or the shell dying, used to leave geckodriver and its Firefox running
  // with a 100 MB profile behind them. A SIGKILL still cannot be caught.
  const bail = (signal) => {
    // SIGTERM rather than SIGKILL: geckodriver shuts down the Firefox it started
    // when asked politely, and SIGKILL would orphan the browser and its profile.
    gecko.kill("SIGTERM");
    server.close();
    console.log(`\n${signal}: asked geckodriver to stop, which closes its Firefox`);
    process.exit(130);
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, () => bail(signal));

  const base = `http://127.0.0.1:${geckoPort}`;
  let sessionId = null;

  async function wd(method, route, body) {
    const res = await fetch(`${base}${route}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json();
    if (json.value && json.value.error) {
      throw new Error(`${json.value.error}: ${String(json.value.message).split("\n")[0]}`);
    }
    return json.value;
  }

  const script = (source, args = []) =>
    wd("POST", `/session/${sessionId}/execute/sync`, { script: source, args });

  const setContext = (context) =>
    wd("POST", `/session/${sessionId}/moz/context`, { context });

  try {
    console.log(`run  (evidence in ${path.relative(ROOT, evidenceDir)})`);

    let up = false;
    for (let i = 0; i < 80 && !(up = await portAnswering(geckoPort)); i += 1) await wait(100);
    record("geckodriver accepting connections", up, `port ${geckoPort}`);
    if (!up) throw new Error("geckodriver never opened its port");

    // -remote-allow-system-access is required from Firefox 138 onwards for the
    // chrome context switch below. Without it the moz/context call is refused.
    const session = await wd("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          "moz:firefoxOptions": {
            args: ["-headless", "-remote-allow-system-access"],
            prefs: {
              "extensions.webextensions.uuids": JSON.stringify({ [EXT_ID]: EXT_UUID }),
            },
          },
        },
      },
    });
    sessionId = session.sessionId;
    record("firefox session created", true, session.capabilities?.browserVersion || "");

    // Firefox refuses to install an extension whose manifest is invalid, so a
    // successful install is a real manifest check, not a JSON parse.
    const installSource = INSTALL_PATH || DEFAULT_INSTALL;
    if (!fs.existsSync(path.join(installSource, "manifest.json")) && !installSource.endsWith(".zip")) {
      throw new Error(`${path.relative(ROOT, installSource)} has no manifest.json, run node scripts/package.mjs first`);
    }
    const installed = await wd("POST", `/session/${sessionId}/moz/addon/install`, {
      path: installSource,
      temporary: true,
    });
    record(
      "firefox build installs",
      installed === EXT_ID,
      `${String(installed)} from ${path.relative(ROOT, installSource) || "."}`,
    );

    await wd("POST", `/session/${sessionId}/url`, { url: fixtureUrl });
    const fixtureHandle = await wd("GET", `/session/${sessionId}/window`);
    record("fixture page loaded", true, fixtureUrl);

    // The popup calls this exact function through scripting.executeScript. Here
    // it runs against the same real DOM, so a selector or filter regression
    // shows up as a wrong URL list.
    const extractorSource = fs.readFileSync(path.join(ROOT, "src/content/extract-links.js"), "utf8");
    const extraction = await script(
      `${extractorSource}\nreturn extractLinksFromPage({ scope: "all" });`,
    );
    const collected = extraction?.urls || [];
    const expected = expectedUrls(fixtureUrl);
    const matches =
      collected.length === expected.length &&
      expected.every((url, index) => collected[index] === url);
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

    // WebDriver will not navigate a tab to moz-extension:// directly, so the tab
    // is opened from chrome context with the system principal.
    const popupUrl = `moz-extension://${EXT_UUID}/src/popup/popup.html`;
    await setContext("chrome");
    await script(
      `const principal = Services.scriptSecurityManager.getSystemPrincipal();
       gBrowser.selectedTab = gBrowser.addTab(arguments[0], { triggeringPrincipal: principal });
       return true;`,
      [popupUrl],
    );
    await setContext("content");
    await wait(1500);

    const handles = await wd("GET", `/session/${sessionId}/window/handles`);
    const popupHandle = handles.find((handle) => handle !== fixtureHandle);
    await wd("POST", `/session/${sessionId}/window`, { handle: popupHandle });

    const loadedUrl = await wd("GET", `/session/${sessionId}/url`);
    record("popup page opens inside the extension origin", loadedUrl === popupUrl, loadedUrl);

    let popup = null;
    for (let i = 0; i < 20; i += 1) {
      popup = await script(`
        const logo = document.querySelector("img.brand-mark");
        return {
          title: document.getElementById("app-title")?.textContent,
          status: document.getElementById("status")?.textContent,
          count: document.getElementById("url-count")?.textContent,
          collectLabel: document.getElementById("collect-label")?.textContent,
          logoSrc: logo?.getAttribute("src") || null,
          logoLoaded: Boolean(logo && logo.complete && logo.naturalWidth > 0),
          buttons: Array.from(document.querySelectorAll("button")).length,
        };
      `);
      if (popup.status && popup.status.trim()) break;
      await wait(250);
    }

    record(
      "popup script initialises against the real extension APIs",
      Boolean(popup?.status && !/Install the extension/i.test(popup.status)),
      popup?.status || "no status text",
    );
    record(
      "popup renders the collection UI",
      popup?.title === "Link Extractor 9000" && popup?.count === "0",
      `title "${popup?.title}", saved count ${popup?.count}, ${popup?.buttons} buttons`,
    );
    record(
      "logo resolves inside the extension origin",
      popup?.logoLoaded === true,
      `${popup?.logoSrc} ${popup?.logoLoaded ? "decoded" : "did not decode"}`,
    );

    const shot = await wd("GET", `/session/${sessionId}/screenshot`);
    fs.writeFileSync(path.join(evidenceDir, "popup.png"), Buffer.from(shot, "base64"));
    record("popup screenshot captured", true, "popup.png (empty collection)");

    // --- render cap indicator -----------------------------------------------
    // This block seeds browser.storage.local directly, so it is a render check
    // and not the collect path. It proves what the list does when a collection
    // holds more URLs than the popup will draw, and nothing about how they got
    // there. The collect path gap is in notDriven below.
    const SEED_TOTAL = 250;
    const seeded = await wd("POST", `/session/${sessionId}/execute/async`, {
      script: `
        const done = arguments[arguments.length - 1];
        const urls = Array.from({ length: arguments[0] }, (_, i) =>
          "https://cdn.seed.example/collection/page-" + (i + 1) +
          "/asset-details?ref=verify-harness&utm_campaign=legibility");
        window.browser.storage.local
          .set({ urlCollection: { version: 1, urls, updatedAt: new Date().toISOString() } })
          .then(() => done(urls.length))
          .catch((error) => done("error: " + error));
      `,
      args: [SEED_TOTAL],
    });
    record(
      "collection seeded for the render check",
      seeded === SEED_TOTAL,
      `${seeded} urls written to storage`,
    );

    await wd("POST", `/session/${sessionId}/refresh`, {});
    await wait(1200);

    const readList = () =>
      script(`
        const note = document.getElementById("render-note");
        return {
          count: document.getElementById("url-count")?.textContent,
          filterCount: document.getElementById("filter-count")?.textContent,
          rows: document.querySelectorAll("#url-preview li:not(.hostname-group)").length,
          noteHidden: note?.hidden,
          note: note?.textContent?.trim(),
        };
      `);

    const EXPECTED_NOTE =
      "Showing the first 100 of 250 matching URLs. Copy and export use the full list.";

    const capped = await readList();
    record(
      "list draws at most 100 rows",
      capped.rows === 100 && capped.count === "250",
      `${capped.rows} rows drawn from ${capped.count} saved`,
    );
    record(
      "render cap is explained on screen",
      capped.noteHidden === false && capped.note === EXPECTED_NOTE,
      capped.note || "note is empty",
    );

    // Measure the app box, not the document. This page runs in a tab here, so the
    // document is as wide as the tab. What matters is that nothing escapes the
    // 720 by 600 shell Firefox will actually give the popup.
    const box = await script(`
      const app = document.querySelector(".app").getBoundingClientRect();
      const clear = document.getElementById("clear-button").getBoundingClientRect();
      const list = document.getElementById("url-preview");
      return {
        appWidth: Math.round(app.width),
        appHeight: Math.round(app.height),
        clearFits: Math.round(clear.right) <= Math.round(app.right),
        clearRight: Math.round(clear.right),
        listOverflowsSideways: list.scrollWidth > list.clientWidth,
      };
    `);
    record(
      "long URLs stay inside the 720 by 600 popup shell",
      box.appWidth === 720 &&
        box.appHeight === 600 &&
        box.clearFits &&
        !box.listOverflowsSideways,
      `app ${box.appWidth}x${box.appHeight}, clear button ends at ${box.clearRight}px, ` +
        `list ${box.listOverflowsSideways ? "scrolls sideways" : "clips cleanly"}`,
    );

    const cappedShot = await wd("GET", `/session/${sessionId}/screenshot`);
    fs.writeFileSync(path.join(evidenceDir, "popup-capped.png"), Buffer.from(cappedShot, "base64"));

    // Typing in the filter is the real user path. The seeded URLs end in page-N
    // for N of 1 to 250, so "page-1" matches 111 of them and "page-24" matches 11.
    const filterElement = await wd("POST", `/session/${sessionId}/element`, {
      using: "css selector",
      value: "#collection-filter",
    });
    const filterId = Object.values(filterElement)[0];

    // Click before typing. Send Keys needs the element focusable and the window
    // focused, and relying on ambient focus fails intermittently with
    // "not reachable by keyboard". A click puts focus where we are about to type.
    await wd("POST", `/session/${sessionId}/element/${filterId}/click`, {});
    await wd("POST", `/session/${sessionId}/element/${filterId}/value`, { text: "page-1" });
    await wait(500);
    const wideFilter = await readList();
    record(
      "note follows the filter while matches still exceed the cap",
      wideFilter.noteHidden === false && /first 100 of 111 matching URLs/.test(wideFilter.note || ""),
      `${wideFilter.filterCount} matching, note reads "${wideFilter.note}"`,
    );

    await wd("POST", `/session/${sessionId}/element/${filterId}/clear`, {});
    await wd("POST", `/session/${sessionId}/element/${filterId}/click`, {});
    await wd("POST", `/session/${sessionId}/element/${filterId}/value`, { text: "page-24" });
    await wait(500);
    const narrowFilter = await readList();
    record(
      "note disappears once everything matching fits on screen",
      narrowFilter.noteHidden === true && narrowFilter.rows === 11,
      `${narrowFilter.filterCount} matching, ${narrowFilter.rows} rows, note ${
        narrowFilter.noteHidden ? "hidden" : "still shown"
      }`,
    );

    const report = {
      startedAt: stamp,
      fixtureUrl,
      popupUrl,
      firefox: session.capabilities?.browserVersion || null,
      checks: results,
      caveats: [
        "The render cap checks seed browser.storage.local directly, then reload " +
          "the popup. They prove the list and its indicator, not the collect path.",
      ],
      notDriven: [
        "Clicking the toolbar button. Firefox grants activeTab only on a real " +
          "action click, and the popup panel is browser chrome that WebDriver " +
          "cannot reach. Driving Collect from the popup page in a tab fails with " +
          "'Missing host permission for the tab'. Close this by hand: see the " +
          "manual step in SKILL.md.",
      ],
    };
    fs.writeFileSync(path.join(evidenceDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    if (geckoLog.length) {
      fs.writeFileSync(path.join(evidenceDir, "geckodriver.log"), geckoLog.join(""));
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
      `${error.stack}\n\ngeckodriver:\n${geckoLog.join("")}`,
    );
    return 1;
  } finally {
    // Delete the session first so geckodriver closes the Firefox it spawned,
    // then stop the one geckodriver process this run started. Never kill by
    // name: the user's own Firefox is very likely running.
    if (!KEEP) {
      if (sessionId) {
        await fetch(`${base}/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
      }
      gecko.kill("SIGTERM");
    } else {
      console.log(`\n--keep: session ${sessionId} still live on ${base}`);
    }
    server.close();
  }
}

const exitCode = command === "doctor" ? doctor() : await run();
process.exit(exitCode);
