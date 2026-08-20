#!/usr/bin/env node
// Loads a real search page for every supported platform and reports what the
// extractor actually finds. This is the only check that catches a platform
// changing its markup, which the unit tests cannot see: they assert against
// selector strings and a stubbed DOM.
//
//   node scripts/sweep-platforms.mjs --list           show the URLs, hit nothing
//   node scripts/sweep-platforms.mjs --engines        the 7 built-in engines
//   node scripts/sweep-platforms.mjs --family social  one adapter family
//   node scripts/sweep-platforms.mjs                  everything
//   node scripts/sweep-platforms.mjs --browser brave  drive Brave instead of Chrome
//
// It visits third-party sites in a throwaway profile, logged out, and only reads
// links already rendered on the page. Nothing is submitted and no login is used,
// so platforms that gate results behind a session will report as gated. That is
// a finding, not a failure.
//
// Add --query to change the search term. Output lands in
// .verify-evidence/sweep-<stamp>/report.json plus a markdown table.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = argv.indexOf(`--${name}`);
  return at > -1 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

// One query cannot suit every platform. Asking an infrastructure scanner for
// "open directory index" returns nothing, which looks exactly like a broken
// adapter and produced two false alarms the first time this ran. Each family
// gets a term that platform can actually answer, unless --query overrides.
const QUERY_BY_FAMILY = [
  [/threat-intel-infrastructure/, "apache"],
  [/threat-intel-ioc/, "example.com"],
  [/threat-intel-abuse|threat-intel-phish/, "example.com"],
  [/threat-intel-sandbox|threat-intel-malware/, "emotet"],
  [/streaming-audio|streaming-video|streaming-catalog/, "drake"],
  [/social/, "news"],
  [/search-engine/, "open directory index"],
];
// A few platforms search by domain or asset rather than by keyword, so a family
// default of "apache" returns an honest zero and reads as a broken adapter.
const QUERY_BY_ID = {
  fullhunt: "tesla.com",
  securitytrails: "tesla.com",
  publicwww: "tesla.com",
  threatminer: "tesla.com",
  pulsedive: "tesla.com",
  virustotal: "tesla.com",
};
const QUERY_OVERRIDE = flag("query");
const queryFor = (family, id) => {
  if (QUERY_OVERRIDE) return QUERY_OVERRIDE;
  if (id && QUERY_BY_ID[id]) return QUERY_BY_ID[id];
  const hit = QUERY_BY_FAMILY.find(([pattern]) => pattern.test(family));
  return hit ? hit[1] : "example.com";
};
const QUERY = QUERY_OVERRIDE || "per-family";
const ONLY_FAMILY = flag("family");
const ENGINES_ONLY = has("engines");
const LIST_ONLY = has("list");
const BROWSER = flag("browser", "chrome");
const LIMIT = Number(flag("limit", "0")) || 0;
const PER_PAGE_MS = Number(flag("timeout", "20000"));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- what to visit ----------------------------------------------------------

// The seven engines detectSearchEngine knows about, with a real query URL each.
const ENGINES = [
  { id: "google", label: "Google", url: (q) => `https://www.google.com/search?q=${q}` },
  { id: "bing", label: "Bing", url: (q) => `https://www.bing.com/search?q=${q}` },
  { id: "duckduckgo", label: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${q}` },
  { id: "brave", label: "Brave Search", url: (q) => `https://search.brave.com/search?q=${q}` },
  { id: "startpage", label: "Startpage", url: (q) => `https://www.startpage.com/sp/search?query=${q}` },
  // MetaSearch and SearXNG are self-hosted instances, per the host checks in
  // src/lib/collection.js. Generic public searx mirrors are not what the engine
  // rules match, so testing one would prove nothing.
  { id: "syncpundit-search", label: "MetaSearch", url: (q) => `https://search.syncpundit.io/search?q=${q}` },
  { id: "searxng", label: "SearXNG", url: (q) => `https://searx.syncpundit.io/search?q=${q}` },
];

// Turns a searchRule pathPattern into a concrete path. The patterns in
// search-adapters.js are simple: anchors, an optional trailing slash, and the
// occasional non-capturing alternation. Anything with a wildcard segment cannot
// be synthesised, and those adapters are reported as unsynthesisable.
function pathFromPattern(pattern) {
  let body = pattern.replace(/^\^/, "").replace(/\$$/, "").replace(/\/\?$/, "");
  body = body.replace(/\(\?:([^)]+)\)/g, (_, alternatives) => alternatives.split("|")[0]);
  if (/[[\]+*\\]/.test(body)) return null;
  return body.startsWith("/") ? body : `/${body}`;
}

function adapterUrl(adapter, query) {
  for (const rule of adapter.searchRules || []) {
    const routePath = pathFromPattern(rule.pathPattern);
    if (!routePath) continue;
    const host = adapter.hosts[0];
    const url = new URL(`https://${host}${routePath}`);
    for (const param of rule.requiredParams || []) {
      // qbase64 style params expect encoded input; give them something valid.
      url.searchParams.set(param, param === "qbase64" ? Buffer.from(query).toString("base64") : query);
    }
    return url.href;
  }
  return null;
}

const adapterLibrary = require(path.join(ROOT, "src/lib/search-adapters.js"));

const targets = [];
if (!ONLY_FAMILY) {
  for (const engine of ENGINES) {
    targets.push({
      id: engine.id,
      label: engine.label,
      family: "search-engine",
      support: "supported",
      url: engine.url(encodeURIComponent(queryFor("search-engine"))),
      query: queryFor("search-engine"),
    });
  }
}
if (!ENGINES_ONLY) {
  for (const adapter of adapterLibrary.adapters) {
    if (ONLY_FAMILY && !adapter.family.includes(ONLY_FAMILY)) continue;
    const query = queryFor(adapter.family, adapter.id);
    const url = adapterUrl(adapter, query);
    targets.push({
      id: adapter.id,
      label: adapter.label,
      family: adapter.family,
      support: adapter.support,
      url,
      query,
      unsynthesisable: !url,
    });
  }
}

const queue = LIMIT ? targets.slice(0, LIMIT) : targets;

if (LIST_ONLY) {
  console.log(`${queue.length} targets, query "${QUERY}"\n`);
  for (const target of queue) {
    console.log(
      `${target.support.padEnd(9)} ${target.family.padEnd(28)} ${target.id.padEnd(18)} ${
        target.url || "cannot synthesise a URL from its searchRules"
      }`,
    );
  }
  process.exit(0);
}

// --- browser ----------------------------------------------------------------

function which(binary) {
  try {
    return execFileSync("command", ["-v", binary], { shell: "/bin/sh" }).toString().trim();
  } catch {
    return null;
  }
}

function browserBinary(preference) {
  const candidates =
    preference === "brave"
      ? ["brave-browser", "brave-browser-stable", "brave"]
      : ["google-chrome", "chromium", "chromium-browser"];
  for (const candidate of candidates) if (which(candidate)) return candidate;
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

const binary = browserBinary(BROWSER);
if (!binary) {
  console.log(`no ${BROWSER} binary on PATH`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(ROOT, ".verify-evidence", `sweep-${stamp}`);
fs.mkdirSync(evidenceDir, { recursive: true });

const port = await freePort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-profile-"));
const browser = spawn(
  binary,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    // Default headless is fingerprinted aggressively. DuckDuckGo served an empty
    // shell and Startpage a block page until these were added, which made both
    // look like walls when the pages were reachable all along.
    "--disable-blink-features=AutomationControlled",
    "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "--lang=en-US",
    "--window-size=1920,1080",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"], detached: true },
);

const stopBrowser = (signal) => {
  try {
    process.kill(-browser.pid, signal);
  } catch {
    browser.kill(signal);
  }
};

const bail = (signal) => {
  stopBrowser("SIGKILL");
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
  } catch {
    // exiting anyway
  }
  console.log(`\n${signal}: stopped the browser`);
  process.exit(130);
};
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, () => bail(signal));

let endpoint = null;
for (let i = 0; i < 100 && !endpoint; i += 1) {
  await wait(200);
  try {
    endpoint = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json())
      .webSocketDebuggerUrl;
  } catch {
    // still starting
  }
}
if (!endpoint) {
  bail("no devtools endpoint");
}

const socket = new WebSocket(endpoint);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = () => reject(new Error("devtools socket refused"));
});
const pending = new Map();
let nextId = 0;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
};
function send(method, params = {}, sessionId, timeout = PER_PAGE_MS) {
  const id = (nextId += 1);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }
    }, timeout);
  });
}

// The three files the popup loads, injected so the page can run the real
// detection and extraction rather than an approximation of it.
const LIBS = ["src/lib/search-adapters.js", "src/lib/collection.js", "src/content/extract-links.js"]
  .map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"))
  .join("\n;\n");

const results = [];

try {
  const target = await send("Target.createTarget", { url: "about:blank" });
  const session = (await send("Target.attachToTarget", { targetId: target.targetId, flatten: true }))
    .sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);

  console.log(`sweeping ${queue.length} platforms in ${binary}, query "${QUERY}"\n`);

  for (const [index, item] of queue.entries()) {
    const label = `${String(index + 1).padStart(2)}/${queue.length} ${item.id}`;

    if (item.unsynthesisable) {
      results.push({ ...item, verdict: "no-url", detail: "searchRules have no synthesisable path" });
      console.log(`  ${label}: no URL could be built from its searchRules`);
      continue;
    }

    try {
      await send("Page.navigate", { url: item.url }, session);
      await wait(3000);

      // Several of these are client-rendered, so a fixed wait turns a slow render
      // into a false zero. netlas gave 36 results on one run and 0 on the next
      // with the same query. Poll instead, and keep the best answer.
      let outcome = null;
      let data = null;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        outcome = await send(
          "Runtime.evaluate",
          {
            expression: `(() => {
              ${LIBS}
              const engine = globalThis.LinkExtractor9000.detectSearchEngine(location.href);
              const adapter = engine
                ? globalThis.LinkExtractor9000.getSearchAdapter(engine.id)
                : null;
              const results = globalThis.extractLinksFromPage({
                scope: "results", engine: engine && engine.id, adapter,
              });
              const all = globalThis.extractLinksFromPage({ scope: "all" });
              return JSON.stringify({
                href: location.href,
                title: document.title,
                detected: engine ? engine.id : null,
                detectedLabel: engine ? engine.label : null,
                resultCount: (results.urls || []).length,
                allCount: (all.urls || []).length,
                samples: (results.urls || []).slice(0, 3),
                bodyText: (document.body ? document.body.innerText || "" : "").slice(0, 400),
              });
            })()`,
            returnByValue: true,
            awaitPromise: true,
          },
            session,
          );
        data = JSON.parse(outcome.result.value);
        if (data.resultCount > 0) break;
        if (attempt < 4) await wait(2500);
      }

      // "Just a moment..." is Cloudflare's interstitial and was landing in the
      // no-results bucket, which reads as a broken selector when it is a wall.
      const wall =
        /captcha|verifying you|verify you are|are you a robot|not a bot|unusual traffic|checking your browser|automated verification|connection has been suspended|access denied|enable javascript|just a moment/i;
      // A search URL that ends up on a login or onboarding route is gated, even
      // though the host never changed.
      const loginRoute = /\/(?:login|signin|sign-in|onboarding|i\/flow|account\/login)/i;
      const requestedHost = new URL(item.url).hostname;
      const landedHost = data.href.startsWith("http") ? new URL(data.href).hostname : null;

      // Only consider blocking when nothing was extracted. A page that yields
      // results is working even if it also mentions signing in somewhere.
      const blocked =
        data.resultCount === 0 &&
        (wall.test(data.title) ||
          wall.test(data.bodyText) ||
          loginRoute.test(data.href) ||
          landedHost !== requestedHost ||
          data.href.startsWith("chrome-error"));

      // Free tiers on the threat-intel platforms count anonymous searches, and
      // repeated sweeps burn through them. fullhunt redirects to /pricing/ after
      // 10, netlas prints a remaining-request countdown and stops rendering.
      // Both look identical to a broken adapter unless it is named.
      const rateLimited =
        data.resultCount === 0 &&
        /search limit|request limit|rate limit|quota exceeded|too many requests|upgrade to continue/i.test(
          `${data.title} ${data.bodyText}`,
        );

      let verdict;
      if (data.resultCount > 0) verdict = "working";
      else if (rateLimited) verdict = "rate-limited";
      else if (data.href.startsWith("chrome-error")) verdict = "unreachable";
      else if (blocked) verdict = "blocked";
      else if (!data.detected) verdict = "not-detected";
      else if (data.allCount === 0) verdict = "empty-page";
      else verdict = "no-results";

      data.blockedBy = blocked
        ? landedHost !== requestedHost
          ? `redirected to ${landedHost}`
          : `wall on page: ${data.title}`
        : null;

      results.push({ ...item, ...data, blocked, verdict });
      console.log(
        `  ${label}: ${verdict}  detected=${data.detected || "none"} ` +
          `results=${data.resultCount} all=${data.allCount}`,
      );
    } catch (error) {
      results.push({ ...item, verdict: "error", detail: error.message });
      console.log(`  ${label}: error  ${error.message}`);
    }
  }
} finally {
  socket.close();
  stopBrowser("SIGTERM");
  await new Promise((resolve) => {
    if (browser.exitCode !== null) return resolve();
    browser.once("exit", resolve);
    setTimeout(resolve, 5000);
  });
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
  } catch {
    // a stray temp profile is not worth failing the sweep over
  }
}

// --- report -----------------------------------------------------------------

const byVerdict = {};
for (const item of results) byVerdict[item.verdict] = (byVerdict[item.verdict] || 0) + 1;

const rows = results
  .map(
    (item) =>
      `| ${item.id} | ${item.label} | ${item.family} | ${item.support} | ${item.verdict} | ${
        item.resultCount ?? ""
      } | ${item.allCount ?? ""} | ${item.detected || ""} |`,
  )
  .join("\n");

const markdown = `# Platform sweep ${stamp}

Browser: ${binary}. Query: "${QUERY}". Logged out, throwaway profile.

${Object.entries(byVerdict)
  .sort((a, b) => b[1] - a[1])
  .map(([verdict, count]) => `- ${verdict}: ${count}`)
  .join("\n")}

| id | label | family | declared | verdict | results | all links | detected as |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`;

fs.writeFileSync(path.join(evidenceDir, "report.json"), `${JSON.stringify({ stamp, binary, query: QUERY, results }, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceDir, "sweep.md"), markdown);

console.log("\nverdicts:");
for (const [verdict, count] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${verdict.padEnd(14)} ${count}`);
}
console.log(`\nreport in ${path.relative(ROOT, evidenceDir)}`);
