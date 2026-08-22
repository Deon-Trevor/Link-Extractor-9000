#!/usr/bin/env node
// Moves the version everywhere it appears, in one go.
//
//   node scripts/bump-version.mjs 1.0.4
//   node scripts/bump-version.mjs 1.0.4 --dry-run
//
// Rewrites package.json, both manifest templates, and every reference to the old
// version in the docs, including the copy-pasteable download commands. Versions
// belonging to other tools are left alone, decided by the same classifier
// scripts/verify-versions.mjs checks with, so the two cannot disagree.
//
// It also promotes the Unreleased section in CHANGELOG.md to the version being
// released. It never writes the entries: an empty section stays empty and is
// reported, because release notes nobody wrote is exactly what the release
// refuses, and npm run check keeps failing until they exist.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHANGELOG,
  DOCS,
  MANIFESTS,
  UNRELEASED,
  projectVersion,
  promoteUnreleased,
  versionTokens,
} from "./verify-versions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const wanted = process.argv[2];

// npm run bump 1.0.4 --dry-run never reaches argv: npm recognises --dry-run as
// its own flag, keeps it, and runs the script for real. It does set
// npm_config_dry_run, so honour that too. Silently writing files while the
// person watching believes nothing happened is the one outcome worth ruling out.
const DRY = process.argv.includes("--dry-run") || process.env.npm_config_dry_run === "true";

if (!wanted || !/^\d+\.\d+\.\d+$/.test(wanted)) {
  console.error("usage: node scripts/bump-version.mjs <major.minor.patch> [--dry-run]");
  process.exit(1);
}

const current = projectVersion();

const rank = (version) => version.split(".").map(Number);
const higher = (a, b) => {
  const [x, y] = [rank(a), rank(b)];
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
};

// Re-running with the version already in package.json is allowed on purpose: a
// bump that found nothing under Unreleased leaves the changelog behind, and then
// writing the entries and running the same command again has to be able to
// finish the job. Without this the only way out was editing a heading by hand.
const already = wanted === current;

// Catches the transposed digit, which is the realistic mistake here. A genuine
// rollback can edit package.json and run npm run check.
if (!already && !higher(wanted, current)) {
  console.error(`${wanted} is not higher than the current ${current}. Refusing, in case that is a typo.`);
  process.exit(1);
}

const edits = [];

function rewrite(file, next, note) {
  const full = path.join(ROOT, file);
  const before = fs.readFileSync(full, "utf8");
  if (before === next) return;
  if (!DRY) fs.writeFileSync(full, next);
  edits.push(`${file}  ${note}`);
}

// The version field only, so the rest of the formatting survives untouched.
const versionField = (file) => {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  const next = text.replace(/("version":\s*")\d+\.\d+\.\d+(")/, `$1${wanted}$2`);
  if (text === next) {
    console.error(`${file} has no "version" field to rewrite`);
    process.exit(1);
  }
  rewrite(file, next, `version ${current} to ${wanted}`);
};

if (!already) {
  versionField("package.json");
  for (const manifest of MANIFESTS) versionField(manifest);
}

// Only tokens that are this project's current version, and only where nothing
// else owns them. Rebuilt line by line so a replacement cannot shift the
// positions the classifier reported.
// Nothing to rewrite when the version is already in place: that run is only here
// to finish the changelog.
const docsToRewrite = already ? [] : DOCS;

for (const doc of docsToRewrite) {
  const text = fs.readFileSync(path.join(ROOT, doc), "utf8");
  const targets = versionTokens(text).filter(
    (token) => !token.external && token.version === current,
  );
  if (!targets.length) continue;

  const lines = text.split("\n");
  for (const token of targets) {
    const line = lines[token.line - 1];
    lines[token.line - 1] =
      line.slice(0, token.column - 1) + wanted + line.slice(token.column - 1 + current.length);
  }
  rewrite(doc, lines.join("\n"), `${targets.length} reference(s)`);
}

// Today, in the format the existing headings use.
const today = new Date().toISOString().slice(0, 10);
const changelog = fs.readFileSync(path.join(ROOT, CHANGELOG), "utf8");
const promoted = promoteUnreleased(changelog, wanted, today);
if (promoted) rewrite(CHANGELOG, promoted, `${UNRELEASED} promoted to ${wanted} (${today})`);

const heading = already ? `${wanted}, changelog only` : `${current} to ${wanted}`;
console.log(DRY ? `dry run: ${heading}` : heading);
for (const edit of edits) console.log(`  ${edit}`);
if (!edits.length) console.log("  nothing to change");

if (already && !promoted) {
  console.error(
    `\npackage.json already says ${current} and ${CHANGELOG} has nothing under ${UNRELEASED}.` +
      "\nNothing to do.",
  );
  process.exit(1);
}

if (DRY) {
  console.log("\nnothing written.");
} else if (promoted) {
  console.log(`\nNext: read the ${wanted} notes in ${CHANGELOG}, then npm run check. Tag v${wanted} to release.`);
} else {
  console.log(
    `\n${CHANGELOG} has nothing under ${UNRELEASED} to promote, so it was left alone.` +
      `\nWrite the entries there, then npm run bump ${wanted} again to promote them.`,
  );
}
