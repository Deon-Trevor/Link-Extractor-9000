#!/usr/bin/env node
// Builds the add-on archive for AMO submission or self-hosting.
//
//   node scripts/package.mjs
//
// Writes dist/link-extractor-9000-<version>.zip holding only what the extension
// needs at runtime. Everything else in the repo stays out: tests, scripts, docs,
// the README banner artwork, and the agent skill directory.
//
// The build fails rather than shipping a broken archive when a file the popup
// references is missing from the runtime list.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

// Explicit list, not a glob. A glob would happily pick up whatever lands in
// these directories next.
const RUNTIME_FILES = [
  "manifest.json",
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

// Anything matching these must never reach the archive.
const FORBIDDEN = [/^\.claude\//, /^\.verify-evidence\//, /^tests\//, /^scripts\//, /^docs\//,
  /^node_modules\//, /^package\.json$/, /^README\.md$/, /^assets\/logo-lockup\./, /-small\.svg$/];

let failures = 0;

function ok(message) {
  console.log(`  ok    ${message}`);
}

function bad(message) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
}

console.log(`packaging ${manifest.name} ${manifest.version}`);

// --- 1. every runtime file exists ------------------------------------------

for (const file of RUNTIME_FILES) {
  if (!fs.existsSync(path.join(ROOT, file))) bad(`${file} is listed but missing from the repo`);
}
if (!failures) ok(`${RUNTIME_FILES.length} runtime files present`);

// --- 2. nothing forbidden slipped into the list ----------------------------

const smuggled = RUNTIME_FILES.filter((file) => FORBIDDEN.some((pattern) => pattern.test(file)));
if (smuggled.length) bad(`these do not belong in a release: ${smuggled.join(", ")}`);
else ok("no repo-only files in the list");

// --- 3. the popup's own references resolve inside the package --------------

const popupDir = "src/popup";
const html = fs.readFileSync(path.join(ROOT, popupDir, "popup.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, popupDir, "popup.css"), "utf8");

const references = [
  ...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
  ...[...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
].filter((reference) => !/^(https?:|data:|#)/.test(reference));

const missing = references.filter((reference) => {
  const resolved = path.posix.normalize(path.posix.join(popupDir, reference));
  return !RUNTIME_FILES.includes(resolved);
});

if (missing.length) bad(`the popup references files the package leaves out: ${missing.join(", ")}`);
else ok(`${references.length} popup references all resolve inside the package`);

// --- 4. manifest icon paths are included ----------------------------------

const declaredIcons = [
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
];
const missingIcons = [...new Set(declaredIcons)].filter((icon) => !RUNTIME_FILES.includes(icon));
if (missingIcons.length) bad(`manifest declares icons the package leaves out: ${missingIcons.join(", ")}`);
else ok("every manifest icon is included");

// --- 5. the popup entry point matches the manifest ------------------------

const popupPath = manifest.action?.default_popup;
if (!popupPath || !RUNTIME_FILES.includes(popupPath)) {
  bad(`action.default_popup "${popupPath}" is not in the package`);
} else {
  ok(`popup entry point ${popupPath} is included`);
}

if (failures) {
  console.log(`\n${failures} problem(s), nothing written`);
  process.exit(1);
}

// --- build ----------------------------------------------------------------

const distDir = path.join(ROOT, "dist");
const stageDir = path.join(distDir, "stage");
const zipName = `link-extractor-9000-${manifest.version}.zip`;
const zipPath = path.join(distDir, zipName);

fs.rmSync(stageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const file of RUNTIME_FILES) {
  const target = path.join(stageDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, file), target);
}

// -X drops extra file attributes so the same input gives the same archive.
execFileSync("zip", ["-r", "-X", "-q", zipPath, "."], { cwd: stageDir });
fs.rmSync(stageDir, { recursive: true, force: true });

const listing = execFileSync("unzip", ["-Z1", zipPath]).toString().trim().split("\n").sort();
const size = fs.statSync(zipPath).size;

console.log(`\nwrote dist/${zipName}  (${(size / 1024).toFixed(1)} kB, ${listing.length} entries)`);
for (const entry of listing) console.log(`  ${entry}`);
