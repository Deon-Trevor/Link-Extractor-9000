#!/usr/bin/env node
// Prints one version's section of CHANGELOG.md, for use as GitHub release notes.
//
//   node scripts/changelog-section.mjs v1.1.0
//   node scripts/changelog-section.mjs 1.1.0
//
// Exits non-zero when the version has no section, so a release cannot be
// published with empty notes because someone forgot to write them.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wanted = (process.argv[2] || "").replace(/^v/, "");

if (!wanted) {
  console.error("usage: node scripts/changelog-section.mjs <version>");
  process.exit(1);
}

const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8").split("\n");

// Sections start at "## <version>" and run until the next "## ".
const start = changelog.findIndex((line) => line.startsWith(`## ${wanted} `) || line.trim() === `## ${wanted}`);
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${wanted}`);
  process.exit(1);
}

const rest = changelog.slice(start + 1);
const end = rest.findIndex((line) => line.startsWith("## "));
const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();

if (!body) {
  console.error(`the ${wanted} section in CHANGELOG.md is empty`);
  process.exit(1);
}

console.log(body);
