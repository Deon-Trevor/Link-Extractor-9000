# Developing Link Extractor 9000

For working on the extension. If you only want to use it, the install guides are
[`firefox/INSTALLATION.md`](firefox/INSTALLATION.md) and
[`chromium/INSTALLATION.md`](chromium/INSTALLATION.md), and neither needs
anything on this page.

Node 22. No dependencies to install, and none at runtime: plain HTML, CSS, and
JavaScript.

## Layout

Everything both browsers share lives in the repo root, so `src/`, `icons/`, and
`assets/` are built once and copied into both packages. The only per-platform
file is the manifest, kept as `firefox/manifest.template.json` and
`chromium/manifest.template.json`.

Which sites get result-only mode, and the routes and result shapes each one
needs, live in `src/lib/search-adapters.js`. `src/content/extract-links.js` is
what runs in the page, and `src/lib/collection.js` owns the saved list.

`scripts/package.mjs` assembles a build by copying an explicit file list, not a
glob, and refuses to write anything when a runtime file is missing, a popup
reference points outside the package, or the three version numbers disagree.

## Commands

```bash
npm test               # unit tests
npm run check          # syntax, manifests, icons, popup contrast, type scale, versions
npm run package        # build dist/firefox and dist/chromium, plus a zip each
npm run source         # zip the tracked source for an AMO submission
npm run verify:firefox # drive the Firefox build in a real headless Firefox
npm run verify:chrome  # drive the Chrome build in a real headless Chrome
npm run bump <version> # move the version everywhere it appears
```

## Loading a development build

Run `npm run package`, then load `dist/firefox` or `dist/chromium`. In Firefox
that is Load Temporary Add-on against `dist/firefox/manifest.json`; in Chrome it
is Load unpacked against the `dist/chromium` folder.

Never load `firefox/` or `chromium/`. They hold a manifest template and nothing
else, and every path it references lives in the repo root rather than beside it.
Firefox installs one happily and then shows an empty popup, which is a confusing
way to lose an afternoon. That is why the source manifests are called
`manifest.template.json`: a name neither browser will load is what stops the
mistake, and `npm run package` fails if a `manifest.json` ever appears in either
directory.

## Verifying

`npm test` covers the extractor, the collection, and the search adapters against
fixtures. It does not prove the extension loads, so before calling extension work
done, drive it:

```bash
npm run verify:firefox
npm run verify:chrome
```

Each installs the built extension into a throwaway profile through geckodriver or
the Chrome DevTools Protocol, opens the popup at its real extension origin,
collects from a live fixture page, and writes screenshots and a JSON report to
`.verify-evidence/`. Both take `doctor` to check the machine can drive a browser
at all, and `--from <path>` to drive a release archive you unzipped instead of the
working tree, which is how a release candidate gets tested as the artifact people
actually download.

## Releasing

```bash
npm run bump <version>   # or --dry-run to list the edits without writing
```

That rewrites `package.json`, both manifest templates, and every version
reference in the docs, including the download commands in the install guides.
Then write the section in [`CHANGELOG.md`](CHANGELOG.md), which the bump leaves
alone on purpose, and push a `v*` tag.

`npm run check` runs `scripts/verify-versions.mjs`, which fails while anything
still claims the old version, the changelog included. A version a doc mentions in
passing is as much a reference as the one in a manifest, because the install
guides name archives people download. Versions belonging to other tools, like the
Firefox build a guide was tested against, are left alone.

[`.github/workflows/release.yml`](.github/workflows/release.yml) does the rest.
It refuses a tag that disagrees with the manifests or has no changelog section,
then builds both browser archives and the source archive from the tag, and opens
a draft release with the changelog section as its notes. Assets are built in CI
rather than uploaded from a laptop, so they match the tag they claim to be.

Publish the draft when you have looked at it:

```bash
gh release edit v<version> --draft=false
```

## Source code for an AMO submission

AMO asks for source code when the submitted package is not human-readable:
minified, obfuscated, bundled, or compiled from another language. This extension
is none of those. The files in `dist/firefox/` are byte-identical copies of the
files in this repository, verified with `cmp`, and the longest line in any of
them is 139 characters. `npm run package` only copies files and writes a zip; it
transforms nothing.

So the archive you upload is already the source, and a separate source upload is
usually not required. Confirm that against the current Extension Workshop policy
before you submit, because this is the part most likely to have changed.

If you want to include it anyway, or a reviewer asks:

```bash
npm run source
```

That writes `dist/link-extractor-9000-source-<version>.zip`, a `git archive` of
the last commit, so it holds exactly the tracked files: `src/`, `icons/`,
`assets/`, `firefox/`, `chromium/`, `scripts/`, `tests/`, `.github/`,
`CHANGELOG.md`, `README.md`, `DEVELOPMENT.md`, `package.json`, and `LICENSE`. It
is around 200 kB. Run `unzip -l` on it for the exact size and file count if a
submission form asks, rather than trusting a number written down here, which is
one commit away from being wrong.

Do not compress the working directory as it stands. That would hand a reviewer
`.git/` with the entire history, `dist/` with build outputs, `.verify-evidence/`
with screenshots from every verification run, and the agent scratch directories.
None of it is source, and the history alone dwarfs the code.

Reviewers also expect to be told how to rebuild, and this page covers it: Node
22, no dependencies to install, `npm run package`, and the result is
`dist/firefox/`.
