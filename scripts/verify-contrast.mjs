#!/usr/bin/env node
// Guards the popup's legibility with numbers instead of opinions.
//
//   node scripts/verify-contrast.mjs
//
// Two rules, both born from real feedback that the popup was "barely legible":
//   1. No font-size below MIN_FONT_PX. The old palette had 18 rules at 7px to 9px.
//   2. Every text pair below meets its WCAG contrast floor.
// Exits non-zero when either rule breaks.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "src/popup/popup.css"), "utf8");

const MIN_FONT_PX = 11;
const BODY_MIN = 4.5; // WCAG AA, text under 18px
const LARGE_MIN = 3.0; // WCAG AA, 18px and above or bold 14px and above

let failures = 0;

function pass(name, detail) {
  console.log(`  ok    ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name, detail) {
  failures += 1;
  console.log(`  FAIL  ${name}: ${detail}`);
}

// --- colour maths -----------------------------------------------------------

function readToken(name) {
  const match = CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match) throw new Error(`token --${name} is not defined in popup.css`);
  return match[1];
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

// --- rule 1: no microtype ---------------------------------------------------

console.log("popup type scale");

const sizes = [...CSS.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => Number(m[1]));
const tooSmall = sizes.filter((size) => size < MIN_FONT_PX);
if (tooSmall.length) {
  fail(
    `no font-size below ${MIN_FONT_PX}px`,
    `${tooSmall.length} rule(s) at ${[...new Set(tooSmall)].sort((a, b) => a - b).join("px, ")}px`,
  );
} else {
  pass(
    `no font-size below ${MIN_FONT_PX}px`,
    `${sizes.length} rules, smallest ${Math.min(...sizes)}px, largest ${Math.max(...sizes)}px`,
  );
}

// --- rule 2: contrast -------------------------------------------------------

console.log("\npopup contrast");

// Each pair is a real combination the popup renders. Keep this list in step with
// the stylesheet: a new coloured surface needs a row here.
const PAIRS = [
  ["body text on the surface", "ink", "surface", BODY_MIN],
  ["body text on the sunken pane", "ink", "sunken", BODY_MIN],
  ["secondary text on the sunken pane", "ink-soft", "sunken", BODY_MIN],
  ["small labels on the surface", "ink-faint", "surface", BODY_MIN],
  ["small labels on the sunken pane", "ink-faint", "sunken", BODY_MIN],
  ["primary button label on brand lime", "brand-ink", "brand", BODY_MIN],
  ["brand green text on the surface", "brand-deep", "surface", BODY_MIN],
  ["brand green text on its own tint", "brand-deep", "brand-tint", BODY_MIN],
  ["amber heading on the scope panel", "amber", "amber-tint", BODY_MIN],
  ["danger label on the surface", "danger", "surface", BODY_MIN],
  ["saved count, 30px so large-text rules apply", "brand-deep", "surface", LARGE_MIN],
];

for (const [name, foreground, background, floor] of PAIRS) {
  try {
    const ratio = contrast(readToken(foreground), readToken(background));
    const detail = `${ratio.toFixed(2)}:1 against a ${floor.toFixed(1)}:1 floor`;
    if (ratio >= floor) pass(name, detail);
    else fail(name, detail);
  } catch (error) {
    fail(name, error.message);
  }
}

// The toolbar badge is the icon counter. Its colours live in popup.js.
const POPUP_JS = fs.readFileSync(path.join(ROOT, "src/popup/popup.js"), "utf8");
const badgeBackground = POPUP_JS.match(/setBadgeBackgroundColor\(\{\s*color:\s*"(#[0-9a-fA-F]{3,8})"/);
const badgeText = POPUP_JS.match(/setBadgeTextColor\(\{\s*color:\s*"(#[0-9a-fA-F]{3,8})"/);

if (!badgeBackground || !badgeText) {
  fail("badge sets both colours explicitly", "background or text colour is missing from popup.js");
} else {
  const ratio = contrast(badgeText[1], badgeBackground[1]);
  const detail = `${badgeText[1]} on ${badgeBackground[1]}, ${ratio.toFixed(2)}:1`;
  if (ratio >= BODY_MIN) pass("icon counter is legible on the toolbar", detail);
  else fail("icon counter is legible on the toolbar", detail);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures === 0 ? 0 : 1);
