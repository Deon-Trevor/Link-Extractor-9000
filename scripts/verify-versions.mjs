#!/usr/bin/env node
// Checks that everything claiming to be this project's version says the same
// number.
//
//   node scripts/verify-versions.mjs
//
// package.json is the source of truth. Both manifest templates, the newest
// CHANGELOG.md section, and every version reference in the docs have to agree
// with it, examples included, because the docs hand out commands that name real
// files:
//
//   unzip -d link-extractor-9000 link-extractor-9000-firefox-1.0.4.zip
//
// A bump that misses one of those leaves a command pointing at a download that
// does not exist, and nothing used to notice: the release workflow only compared
// the tag against package.json and the two manifests. firefox/INSTALLATION.md
// sat on link-extractor-9000-source-1.0.0.zip for three releases that way.
//
// npm run check runs this and the release workflow runs npm run check, so a
// stale reference stops a release rather than shipping in one. npm run bump
// moves all of it at once, which is the intended way to satisfy this check.
//
// Versions that belong to something else are left alone. A three-part number is
// treated as external when the words before it name the thing it belongs to, so
// "Tested on Firefox 153.0.4" needs no permission from this script and does not
// have to be revisited every release. A bare "1.0.2" in prose has nothing
// vouching for it and fails.
//
// Only the files that carry the shipped version are scanned. Comments in
// scripts/ and .github/ refer to past releases on purpose, and a check that
// dragged those forward would turn accurate history into a lie.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const MANIFESTS = ["firefox/manifest.template.json", "chromium/manifest.template.json"];

export const CHANGELOG = "CHANGELOG.md";

// Every tracked markdown file except the changelog, rather than a list to
// remember to add to. A doc written next year is covered the day it lands, which
// is the whole point: the last stale reference survived because nothing was
// looking at the file it lived in. git ls-files is the same definition of
// "tracked" that npm run source ships to AMO.
// The docs that carry the version by design. git decides the rest, but these are
// never dropped, so the list can only grow. Asking git can come back
// empty for reasons that have nothing to do with the docs: npm run source ships
// a git archive, so a reviewer's unzipped copy has no .git, and unpacking it
// inside somebody else's repo answers about that repo instead. Either way an
// empty answer must not read as nothing to check.
const KNOWN_DOCS = [
  "README.md",
  "DEVELOPMENT.md",
  "firefox/INSTALLATION.md",
  "chromium/INSTALLATION.md",
];

export function docs() {
  let tracked = [];
  try {
    tracked = execFileSync("git", ["ls-files", "*.md", "**/*.md"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .split("\n")
      .filter(Boolean);
  } catch {
    tracked = [];
  }
  return [...new Set([...KNOWN_DOCS, ...tracked])]
    .filter((file) => file !== CHANGELOG)
    .filter((file) => fs.existsSync(path.join(ROOT, file)))
    .sort();
}

export const DOCS = docs();

const VERSION = /\d+\.\d+\.\d+/g;

// The names of things that carry their own version numbers in these docs. The
// list is here to be added to when a doc starts talking about another tool.
const EXTERNAL =
  /(?:firefox|chrome|chromium|edge|opera|vivaldi|safari|node|npm|geckodriver|chromedriver|webdriver)\s+v?$/i;

export function projectVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
}

// Every three-part number in one file, each tagged with whether something else
// owns it. The check and npm run bump both read this, so they cannot disagree
// about what counts as a reference to this project.
export function versionTokens(text) {
  const tokens = [];
  text.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(VERSION)) {
      tokens.push({
        version: match[0],
        line: index + 1,
        column: match.index + 1,
        context: line.trim(),
        external: EXTERNAL.test(line.slice(0, match.index)),
      });
    }
  });
  return tokens;
}

export const UNRELEASED = "## Unreleased";

// Promotes the Unreleased heading to a released one and leaves a fresh Unreleased
// above it for the next cycle. Returns null when there is nothing to promote, so
// the caller can say why instead of stamping a version on an empty section: the
// release refuses empty notes, and finding that out at tag time is too late.
//
// Nothing but entries may live in that section, because this moves the body
// wholesale and scripts/changelog-section.mjs hands it to gh release create.
export function promoteUnreleased(text, version, date) {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => /^##\s+unreleased\s*$/i.test(line));
  if (at === -1) return null;

  const rest = lines.slice(at + 1);
  const until = rest.findIndex((line) => line.startsWith("## "));
  const body = until === -1 ? rest : rest.slice(0, until);
  if (!body.some((line) => line.trim())) return null;

  lines.splice(at, 1, UNRELEASED, "", `## ${version} (${date})`);
  return lines.join("\n");
}

// The version the newest CHANGELOG.md section is written for, which is the one a
// release publishes as its notes.
export function newestChangelogVersion(text) {
  for (const line of text.split("\n")) {
    const match = /^## (\d+\.\d+\.\d+)/.exec(line);
    if (match) return match[1];
  }
  return null;
}

function main() {
  console.log("versions");

  const version = projectVersion();
  const results = [];
  const record = (ok, name, detail) => {
    results.push(ok);
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  };

  for (const manifest of MANIFESTS) {
    const declared = JSON.parse(fs.readFileSync(path.join(ROOT, manifest), "utf8")).version;
    record(
      declared === version,
      manifest,
      declared === version ? declared : `says ${declared}, package.json says ${version}`,
    );
  }

  const changelog = fs.readFileSync(path.join(ROOT, CHANGELOG), "utf8");
  const newest = newestChangelogVersion(changelog);
  record(
    newest === version,
    `${CHANGELOG} leads with the shipped version`,
    newest === version
      ? `## ${newest}`
      : `newest section is ${newest || "missing"}, package.json says ${version}. ` +
        `Put the entries under ${UNRELEASED}, then npm run bump ${version} promotes them.`,
  );

  const scanned = docs();
  let references = 0;
  let external = 0;
  for (const doc of scanned) {
    const tokens = versionTokens(fs.readFileSync(path.join(ROOT, doc), "utf8"));
    for (const token of tokens) {
      if (token.external) {
        external += 1;
        continue;
      }
      references += 1;
      if (token.version === version) continue;
      record(
        false,
        `${doc}:${token.line}`,
        `says ${token.version}, package.json says ${version}: ${token.context}`,
      );
    }
  }
  if (results.every(Boolean)) {
    record(
      true,
      `${references} version reference(s) across ${scanned.length} tracked docs`,
      `all say ${version}, ${external} left to other tools`,
    );
  }

  const failed = results.filter((ok) => !ok).length;
  if (failed) {
    console.log(`\n${failed} disagreement(s). Run npm run bump <version> to move everything at once.`);
    return 1;
  }
  console.log(`\neverything says ${version}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
