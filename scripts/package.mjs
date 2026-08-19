#!/usr/bin/env node
// Builds the add-on for both browsers.
//
//   node scripts/package.mjs                 both platforms
//   node scripts/package.mjs firefox         one of them
//
// For each platform it writes an unpacked build at dist/<platform>/ and an
// archive at dist/link-extractor-9000-<platform>-<version>.zip. Load the
// unpacked directory during development. Upload the archive to the store.
//
// Everything the two browsers share lives in the repo root. The only per-platform
// file is the manifest, which is why firefox/ and chromium/ hold one file each.
//
// The build fails rather than shipping something broken when a runtime file is
// missing, a popup reference points outside the package, or the version numbers
// disagree.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PLATFORMS = {
  firefox: { manifest: "firefox/manifest.json", store: "addons.mozilla.org" },
  chromium: { manifest: "chromium/manifest.json", store: "Chrome Web Store" },
};

// Explicit list, not a glob. A glob would happily pick up whatever lands in
// these directories next.
const SHARED_FILES = [
  "LICENSE",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-96.png",
  "icons/icon-128.png",
  "assets/logo-mark.svg",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "src/lib/collection.js",
  "src/lib/search-adapters.js",
  "src/content/extract-links.js",
];

// Anything matching these must never reach a build.
const FORBIDDEN = [
  /^\.claude\//,
  /^\.verify-evidence\//,
  /^tests\//,
  /^scripts\//,
  /^docs\//,
  /^node_modules\//,
  /^package\.json$/,
  /^README\.md$/,
  /^assets\/logo-lockup\./,
  /-small\.svg$/,
];

const requested = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));
const targets = requested.length ? requested : Object.keys(PLATFORMS);

let failures = 0;

function ok(message) {
  console.log(`  ok    ${message}`);
}

function bad(message) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
}

for (const target of targets) {
  if (!PLATFORMS[target]) {
    console.log(`unknown platform "${target}", expected one of ${Object.keys(PLATFORMS).join(", ")}`);
    process.exit(1);
  }
}

// --- one version, three files ----------------------------------------------

console.log("versions");

const packageVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const manifests = Object.fromEntries(
  Object.entries(PLATFORMS).map(([name, platform]) => [
    name,
    JSON.parse(fs.readFileSync(path.join(ROOT, platform.manifest), "utf8")),
  ]),
);

const versions = { "package.json": packageVersion };
for (const [name, manifest] of Object.entries(manifests)) {
  versions[PLATFORMS[name].manifest] = manifest.version;
}
const distinct = [...new Set(Object.values(versions))];
if (distinct.length === 1) {
  ok(`all three files say ${distinct[0]}`);
} else {
  bad(
    `version drift: ${Object.entries(versions)
      .map(([file, version]) => `${file} ${version}`)
      .join(", ")}`,
  );
}

const version = packageVersion;

// --- shared checks ---------------------------------------------------------

console.log("\nshared files");

for (const file of SHARED_FILES) {
  if (!fs.existsSync(path.join(ROOT, file))) bad(`${file} is listed but missing from the repo`);
}
const smuggled = SHARED_FILES.filter((file) => FORBIDDEN.some((pattern) => pattern.test(file)));
if (smuggled.length) bad(`these do not belong in a release: ${smuggled.join(", ")}`);
if (!failures) ok(`${SHARED_FILES.length} shared runtime files present, none repo-only`);

// The popup's own references have to resolve inside the package, otherwise a
// release ships a popup with a dead script tag or image.
const popupDir = "src/popup";
const html = fs.readFileSync(path.join(ROOT, popupDir, "popup.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, popupDir, "popup.css"), "utf8");
const references = [
  ...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]),
  ...[...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((match) => match[1]),
].filter((reference) => !/^(https?:|data:|#)/.test(reference));

const missing = references.filter(
  (reference) => !SHARED_FILES.includes(path.posix.normalize(path.posix.join(popupDir, reference))),
);
if (missing.length) bad(`the popup references files no package includes: ${missing.join(", ")}`);
else ok(`${references.length} popup references all resolve inside the package`);

// --- per platform ----------------------------------------------------------

const built = [];

for (const target of targets) {
  const platform = PLATFORMS[target];
  const manifest = manifests[target];
  console.log(`\n${target}`);

  const declaredIcons = [
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
  ];
  const missingIcons = [...new Set(declaredIcons)].filter((icon) => !SHARED_FILES.includes(icon));
  if (missingIcons.length) bad(`${target} declares icons no package includes: ${missingIcons.join(", ")}`);
  else ok("every declared icon is included");

  const popupPath = manifest.action?.default_popup;
  if (!popupPath || !SHARED_FILES.includes(popupPath)) {
    bad(`${target} action.default_popup "${popupPath}" is not in the package`);
  } else {
    ok(`popup entry point ${popupPath} is included`);
  }

  if (target === "firefox" && !manifest.browser_specific_settings?.gecko?.id) {
    bad("firefox build needs browser_specific_settings.gecko.id for a stable add-on id");
  } else if (target === "firefox") {
    ok(`gecko id ${manifest.browser_specific_settings.gecko.id}`);
  }

  if (target === "chromium" && manifest.browser_specific_settings) {
    bad("chromium build must not carry browser_specific_settings");
  } else if (target === "chromium") {
    ok("no Firefox-only keys");
  }

  if (failures) continue;

  const outDir = path.join(ROOT, "dist", target);
  const zipPath = path.join(ROOT, "dist", `link-extractor-9000-${target}-${version}.zip`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of SHARED_FILES) {
    const destination = path.join(outDir, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), destination);
  }
  fs.copyFileSync(path.join(ROOT, platform.manifest), path.join(outDir, "manifest.json"));

  // -X drops extra file attributes so the same input gives the same archive.
  execFileSync("zip", ["-r", "-X", "-q", zipPath, "."], { cwd: outDir });

  const entries = execFileSync("unzip", ["-Z1", zipPath]).toString().trim().split("\n");
  const size = fs.statSync(zipPath).size;
  built.push({ target, zipPath, outDir, size, count: entries.length, store: platform.store });
  ok(`built ${entries.length} entries, ${(size / 1024).toFixed(1)} kB`);
}

if (failures) {
  console.log(`\n${failures} problem(s), nothing written`);
  process.exit(1);
}

console.log("");
for (const item of built) {
  console.log(`${item.target}`);
  console.log(`  unpacked  dist/${item.target}/            load this while developing`);
  console.log(`  archive   ${path.relative(ROOT, item.zipPath)}   upload to ${item.store}`);
}
