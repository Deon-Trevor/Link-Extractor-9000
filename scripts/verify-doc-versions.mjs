#!/usr/bin/env node
// Checks that the release archives named in the docs match the version being
// shipped.
//
//   node scripts/verify-doc-versions.mjs
//
// The docs hand out copy-pasteable commands, which means they name real files:
//
//   unzip -d link-extractor-9000 link-extractor-9000-firefox-1.0.3.zip
//
// A version bump leaves those pointing at a download that no longer exists, and
// nothing notices, because the release workflow only compares the tag against
// package.json and the two manifests. firefox/INSTALLATION.md sat on
// link-extractor-9000-source-1.0.0.zip for three releases that way.
//
// npm run check runs this, and the release workflow runs npm run check, so a
// stale filename now stops a release rather than shipping in it.
//
// Only archive filenames are checked. Prose versions like "Tested on Firefox
// 154" are nothing to do with this project's version and are left alone.
// CHANGELOG.md is skipped on purpose: naming old versions is its whole job.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DOCS = ["README.md", "firefox/INSTALLATION.md", "chromium/INSTALLATION.md"];

const ARCHIVE = /link-extractor-9000-(?:firefox|chromium|source)-(\d+\.\d+\.\d+)\.zip/g;

const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

console.log("doc versions");

let failures = 0;
let checked = 0;

for (const doc of DOCS) {
  const lines = fs.readFileSync(path.join(ROOT, doc), "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(ARCHIVE)) {
      checked += 1;
      if (match[1] === version) continue;
      failures += 1;
      console.log(
        `  FAIL  ${doc}:${index + 1} names ${match[0]}, but package.json says ${version}`,
      );
    }
  });
}

if (failures) {
  console.log(`\n${failures} stale archive name(s). Update the docs or the version.`);
  process.exit(1);
}

console.log(`  ok    ${checked} archive name(s) across ${DOCS.length} docs all say ${version}`);
