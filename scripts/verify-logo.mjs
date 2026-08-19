#!/usr/bin/env node
// Verifies the shipped logo artwork against the real files, not against a summary.
//
//   node scripts/verify-logo.mjs            static checks only
//   node scripts/verify-logo.mjs --render   also re-renders every SVG and compares
//                                           the result to the committed PNG
//
// Exits non-zero on the first failed check.

import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RENDER = process.argv.includes("--render");

let failures = 0;
let skipped = 0;

function pass(name, detail) {
  console.log(`  ok    ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name, detail) {
  failures += 1;
  console.log(`  FAIL  ${name}: ${detail}`);
}

function skip(name, detail) {
  skipped += 1;
  console.log(`  skip  ${name} (${detail})`);
}

function check(name, fn) {
  try {
    const detail = fn();
    pass(name, detail);
  } catch (error) {
    fail(name, error.message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// --- minimal PNG reader -----------------------------------------------------

function readPng(file) {
  const data = fs.readFileSync(file);
  assert(data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")), "not a PNG");

  let pos = 8;
  let header = null;
  const idat = [];

  while (pos < data.length) {
    const length = data.readUInt32BE(pos);
    const type = data.subarray(pos + 4, pos + 8).toString("latin1");
    const body = data.subarray(pos + 8, pos + 8 + length);

    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      idat.push(body);
    }

    pos += 12 + length;
  }

  assert(header, "missing IHDR");
  assert(header.bitDepth === 8, `unsupported bit depth ${header.bitDepth}`);
  assert(header.interlace === 0, "interlaced PNGs are not supported");

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
  assert(channels, `unsupported colour type ${header.colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const out = Buffer.alloc(header.height * stride);
  let prev = Buffer.alloc(stride);
  let offset = 0;

  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const line = Buffer.from(raw.subarray(offset, offset + stride));
    offset += stride;

    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;

      if (filter === 1) line[x] = (line[x] + a) & 0xff;
      else if (filter === 2) line[x] = (line[x] + b) & 0xff;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[x] = (line[x] + pr) & 0xff;
      }
    }

    line.copy(out, y * stride);
    prev = line;
  }

  return { ...header, channels, pixels: out };
}

function alphaAt(png, x, y) {
  if (png.channels === 4) return png.pixels[(y * png.width + x) * 4 + 3];
  if (png.channels === 2) return png.pixels[(y * png.width + x) * 2 + 1];
  return 255;
}

function opaqueFraction(png) {
  let opaque = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (alphaAt(png, x, y) > 250) opaque += 1;
    }
  }
  return opaque / (png.width * png.height);
}

// --- rasteriser -------------------------------------------------------------

function findChrome() {
  for (const binary of ["google-chrome", "chromium", "chromium-browser", "google-chrome-stable"]) {
    try {
      execFileSync("command", ["-v", binary], { shell: "/bin/sh", stdio: "pipe" });
      return binary;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// Mirrors how the committed PNGs were produced: the SVG is placed in an HTML
// wrapper at the exact target size, so a re-render is comparable byte for byte.
function renderSvg(chrome, svgPath, size, outPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logo-verify-"));
  try {
    fs.copyFileSync(svgPath, path.join(dir, "art.svg"));
    fs.writeFileSync(
      path.join(dir, "page.html"),
      `<!doctype html><meta charset="utf-8">` +
        `<style>html,body{margin:0;padding:0;background:transparent}` +
        `img{display:block;width:${size}px;height:${size}px}</style>` +
        `<img src="art.svg">`,
    );
    execFileSync(
      chrome,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--default-background-color=00000000",
        "--force-device-scale-factor=1",
        `--window-size=${size},${size}`,
        `--screenshot=${outPath}`,
        `file://${path.join(dir, "page.html")}`,
      ],
      { stdio: "pipe" },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- checks -----------------------------------------------------------------

const MANIFESTS = {
  firefox: JSON.parse(fs.readFileSync(path.join(ROOT, "firefox/manifest.template.json"), "utf8")),
  chromium: JSON.parse(fs.readFileSync(path.join(ROOT, "chromium/manifest.template.json"), "utf8")),
};

// Which SVG each rendered size is cut from. The small mark carries heavier
// strokes so the link holes survive at toolbar sizes.
const SOURCE_FOR_SIZE = {
  16: "assets/logo-mark-small.svg",
  32: "assets/logo-mark-small.svg",
  48: "assets/logo-mark.svg",
  96: "assets/logo-mark.svg",
  128: "assets/logo-mark.svg",
};

console.log("manifest icon declarations");

const declared = new Map();
for (const [platform, manifest] of Object.entries(MANIFESTS)) {
  for (const [group, icons] of [
    ["icons", manifest.icons],
    ["action.default_icon", manifest.action?.default_icon],
  ]) {
    check(`${platform} ${group} is declared`, () => {
      assert(icons && Object.keys(icons).length > 0, "missing or empty");
      for (const [size, file] of Object.entries(icons)) declared.set(`${size}:${file}`, Number(size));
      return `${Object.keys(icons).length} sizes`;
    });
  }
}

console.log("\nicon files");

const iconPaths = [...new Set([...declared.keys()].map((key) => key.split(":")[1]))].sort();

for (const key of [...declared.keys()].sort()) {
  const [size, file] = [declared.get(key), key.split(":")[1]];
  check(`${file} declared at ${size}px`, () => {
    const abs = path.join(ROOT, file);
    assert(fs.existsSync(abs), "file does not exist");
    const png = readPng(abs);
    assert(
      png.width === size && png.height === size,
      `declared ${size}px but the file is ${png.width}x${png.height}`,
    );
    return `${png.width}x${png.height}`;
  });
}

for (const file of iconPaths) {
  check(`${file} has no background plate`, () => {
    const png = readPng(path.join(ROOT, file));
    assert(png.channels === 4 || png.channels === 2, `colour type ${png.colorType} carries no alpha`);

    const corners = [
      [0, 0],
      [png.width - 1, 0],
      [0, png.height - 1],
      [png.width - 1, png.height - 1],
    ];
    for (const [x, y] of corners) {
      const alpha = alphaAt(png, x, y);
      assert(alpha === 0, `corner ${x},${y} has alpha ${alpha}, so a plate is baked in`);
    }

    const fraction = opaqueFraction(png);
    assert(fraction > 0.05, `only ${(fraction * 100).toFixed(1)}% opaque, the glyph is missing`);
    assert(fraction < 0.6, `${(fraction * 100).toFixed(1)}% opaque, too full for a standalone glyph`);
    return `${(fraction * 100).toFixed(0)}% opaque, corners clear`;
  });
}

console.log("\nsource artwork");

for (const file of ["assets/logo-mark.svg", "assets/logo-mark-small.svg", "assets/logo-lockup.svg"]) {
  check(`${file} exists and is titled`, () => {
    const abs = path.join(ROOT, file);
    assert(fs.existsSync(abs), "file does not exist");
    const svg = fs.readFileSync(abs, "utf8");
    assert(svg.includes("<svg"), "no svg root element");
    assert(/<title>[^<]+<\/title>/.test(svg), "no <title> for assistive tech");
    assert(!/\sfill="#0b0f0a"[^>]*\/>\s*<g/.test(svg), "looks like it still has a background plate");
    return `${svg.length} bytes`;
  });
}

console.log("\npopup wiring");

const popupHtml = fs.readFileSync(path.join(ROOT, "src/popup/popup.html"), "utf8");
const popupCss = fs.readFileSync(path.join(ROOT, "src/popup/popup.css"), "utf8");

check("popup masthead points at a real file", () => {
  const match = popupHtml.match(/<img[^>]*class="brand-mark"[^>]*src="([^"]+)"/);
  assert(match, "no <img class=\"brand-mark\"> in the masthead");
  const resolved = path.resolve(ROOT, "src/popup", match[1]);
  assert(fs.existsSync(resolved), `src="${match[1]}" resolves to a missing file`);
  return match[1];
});

check("popup masthead image has an accessible name", () => {
  const match = popupHtml.match(/<img[^>]*class="brand-mark"[^>]*>/);
  assert(match, "no brand-mark image");
  assert(/alt="/.test(match[0]), "no alt attribute");
  return /alt=""/.test(match[0]) ? "alt=\"\", decorative beside the h1" : "alt text present";
});

check("no dead CSS from the old brand mark", () => {
  assert(!popupCss.includes(".brand-mark span"), ".brand-mark span rules are still present");
  assert(popupCss.includes(".brand-mark"), ".brand-mark rule was removed entirely");
  return "old span rules gone, sizing rule kept";
});

console.log("\nicons match their source artwork");

if (!RENDER) {
  skip("re-render comparison", "pass --render to enable");
} else {
  const chrome = findChrome();
  if (!chrome) {
    skip("re-render comparison", "no chrome or chromium binary on PATH");
  } else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "logo-rerender-"));
    try {
      for (const file of iconPaths) {
        const size = declared.get([...declared.keys()].find((key) => key.endsWith(`:${file}`)));
        const source = SOURCE_FOR_SIZE[size];
        check(`${file} is in sync with ${source}`, () => {
          assert(source, `no source mapping for ${size}px`);
          const fresh = path.join(dir, `${size}.png`);
          renderSvg(chrome, path.join(ROOT, source), size, fresh);

          const committed = readPng(path.join(ROOT, file));
          const rendered = readPng(fresh);
          assert(
            committed.width === rendered.width && committed.height === rendered.height,
            "re-render came out a different size",
          );

          let differing = 0;
          for (let i = 0; i < committed.pixels.length; i += 1) {
            if (committed.pixels[i] !== rendered.pixels[i]) differing += 1;
          }
          assert(
            differing === 0,
            `${differing} of ${committed.pixels.length} bytes differ, the PNG is stale`,
          );
          return "pixel identical";
        });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

console.log(
  `\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}` +
    `${skipped ? `, ${skipped} skipped` : ""}`,
);
process.exit(failures === 0 ? 0 : 1);
