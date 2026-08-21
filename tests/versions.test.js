const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

// scripts/ is ESM and the tests are CommonJS, so the module arrives by import().
const versions = () => import("../scripts/verify-versions.mjs");

test("a version belongs to whatever the words before it name", async () => {
  const { versionTokens } = await versions();

  const external = versionTokens("Tested on Firefox 153.0.4.");
  assert.equal(external.length, 1);
  assert.equal(external[0].external, true);

  // The case the check exists for. Nothing vouches for this number, so it has to
  // be the shipped one.
  const archive = versionTokens("unzip -d out link-extractor-9000-firefox-1.0.3.zip");
  assert.equal(archive.length, 1);
  assert.equal(archive[0].external, false);
  assert.equal(archive[0].version, "1.0.3");

  const prose = versionTokens("Since 1.0.2 the popup keeps its list.");
  assert.equal(prose[0].external, false);

  // Ownership is per number, not per line.
  const mixed = versionTokens("Chrome 151.0.1 loads link-extractor-9000-chromium-1.0.3.zip");
  assert.deepEqual(
    mixed.map((token) => [token.version, token.external]),
    [
      ["151.0.1", true],
      ["1.0.3", false],
    ],
  );
});

test("token positions survive more than one version on a line", async () => {
  const { versionTokens } = await versions();

  const line = "1.0.3 then 1.0.3 again";
  const tokens = versionTokens(line);
  assert.equal(tokens.length, 2);

  // scripts/bump-version.mjs rewrites by column, so a wrong column silently
  // corrupts a doc instead of failing.
  for (const token of tokens) {
    const at = line.slice(token.column - 1, token.column - 1 + token.version.length);
    assert.equal(at, token.version);
  }
  assert.deepEqual(
    tokens.map((token) => token.column),
    [1, 12],
  );
});

test("the newest changelog section is the first heading, not the highest number", async () => {
  const { newestChangelogVersion } = await versions();

  const two = "# Changelog\n\n## 1.0.3 (2026-08-21)\n\n## 1.0.2 (2026-08-20)\n";
  assert.equal(newestChangelogVersion(two), "1.0.3");
  assert.equal(newestChangelogVersion("# Changelog\n\nNo releases yet.\n"), null);
});

test("the docs scanned can only grow, never silently empty out", async () => {
  const { CHANGELOG, docs } = await versions();

  const scanned = docs();

  // git ls-files can answer about the wrong tree, or not answer at all, and an
  // empty list would read as a clean check that looked at nothing.
  const carriers = [
    "README.md",
    "DEVELOPMENT.md",
    "firefox/INSTALLATION.md",
    "chromium/INSTALLATION.md",
  ];
  for (const doc of carriers) {
    assert.ok(scanned.includes(doc), `${doc} is not being scanned`);
  }

  // The changelog names old versions for a living and has its own rule.
  assert.ok(!scanned.includes(CHANGELOG));
});

test("everything in the repo that names the shipped version agrees", async () => {
  const { CHANGELOG, MANIFESTS, docs, newestChangelogVersion, projectVersion, versionTokens } =
    await versions();

  const version = projectVersion();

  for (const manifest of MANIFESTS) {
    const declared = JSON.parse(fs.readFileSync(path.join(ROOT, manifest), "utf8")).version;
    assert.equal(declared, version, `${manifest} disagrees with package.json`);
  }

  const changelog = fs.readFileSync(path.join(ROOT, CHANGELOG), "utf8");
  assert.equal(newestChangelogVersion(changelog), version, `${CHANGELOG} has no ${version} section`);

  for (const doc of docs()) {
    const stale = versionTokens(fs.readFileSync(path.join(ROOT, doc), "utf8")).filter(
      (token) => !token.external && token.version !== version,
    );
    assert.deepEqual(
      stale.map((token) => `${doc}:${token.line} says ${token.version}`),
      [],
      `${doc} still names an old version`,
    );
  }
});
