# Installing Link Extractor 9000 on Firefox

There is no addons.mozilla.org listing yet, so this is a manual load. Firefox
calls it a temporary add-on, and the important consequence is in the name: it is
gone when Firefox restarts.

Tested on Firefox 153.0.4.

## First install

1. Get the folder Firefox needs. Either download
   `link-extractor-9000-firefox-<version>.zip` from
   [Releases](https://github.com/Deon-Trevor/Link-Extractor-9000/releases) and
   unzip it into a directory of its own, since the archive has no wrapping
   folder:

   ```bash
   unzip -d link-extractor-9000 link-extractor-9000-firefox-1.0.3.zip
   ```

   Or build it from a clone, which writes `dist/firefox/`:

   ```bash
   npm run package
   ```

   The rest of this file says `dist/firefox/`. Read that as the unzipped
   directory if you downloaded a release.

2. Open `about:debugging#/runtime/this-firefox`.

3. Click **Load Temporary Add-on** and select `dist/firefox/manifest.json`.

   Select the `manifest.json` file, not its folder. Firefox wants the file here,
   which is the opposite of Chrome's Load unpacked.

   Do not pick the `firefox/` directory this file sits in. It holds only the
   manifest template, and the icons and popup it references live in the repo
   root. Firefox installs it happily and then shows an empty popup, which is why
   the source manifest is named `manifest.template.json` and not `manifest.json`.

4. Open the extensions menu, the puzzle-piece icon, find Link Extractor 9000 and
   pin it to the toolbar. The saved count appears on the button as a green badge.

Check it works: open any page with links, click the button, then click **Collect
every page URL**. The status line should report how many URLs were added, and the
badge should show the count.

## Updating when a new version lands

Replace the contents of the same folder, either by unzipping the new release over
it or by rebuilding from a clone:

```bash
git pull
npm run package
```

Then in `about:debugging#/runtime/this-firefox`, click **Reload** on the Link
Extractor 9000 card. There is no need to remove and load it again.

Export your collection first with **TXT**, **CSV**, or **JSON** if it matters to
you. Reload keeps the add-on's identity, and the identity is what the collection
is stored against: a remove and re-install returned the same add-on id
`link-extractor-9000@deon-trevor` on Firefox 153. What I did not manage to
confirm is whether the saved collection itself survives a **Remove**. On Chrome
it does not, so treat Remove as destructive here too until someone proves
otherwise. Reload is the safe path and it is all an update needs.

## Things Firefox does that look like problems

**It disappears when you restart Firefox.** Temporary add-ons are unloaded on
exit. Load `dist/firefox/manifest.json` again after each restart. A signed
release from AMO will not behave this way.

**A stale toolbar icon after an icon change.** Reload does not always refresh it.
Remove the add-on and load it again, which is the one case where Remove is worth
it. The reason is visible on the `about:debugging` card: each temporary install
gets a new **Internal UUID**, and the icon is cached against the old one.

**The Internal UUID changes every load.** Expected. The **Extension ID** stays
`link-extractor-9000@deon-trevor`, which is the identity that matters.

## If it will not load

| What Firefox says | What it means |
| --- | --- |
| An empty popup, or a broken icon on the card | You loaded `firefox/` instead of `dist/firefox/`. Remove it and load `dist/firefox/manifest.json`. |
| This add-on could not be installed because it appears to be corrupt | The manifest did not parse, or the folder is missing files it declares. Run `npm run package` and try again. |
| The button is missing from the toolbar | It is in the puzzle-piece menu and not pinned yet. |
| Could not read this page | Expected on `about:` pages, `addons.mozilla.org`, and other pages Firefox shields from extensions. Try an ordinary web page. |
| The add-on vanished | Firefox restarted. Load it again. |

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

That writes `dist/link-extractor-9000-source-1.0.0.zip`, 184 kB and 46 files. It
is a `git archive` of the last commit, so it holds exactly the tracked files:
`src/`, `icons/`, `assets/`, `firefox/`, `chromium/`, `scripts/`, `tests/`,
`package.json`, `README.md`, and `LICENSE`.

Do not compress the working directory as it stands. That would hand a reviewer
`.git/` with the entire history, `dist/` with build outputs, `.verify-evidence/`
with screenshots from every verification run, and the agent scratch directories.
None of it is source, and the history alone dwarfs the code.

Reviewers also expect to be told how to rebuild. What is in the README covers it:
Node 22, no dependencies to install, `npm run package`, and the result is
`dist/firefox/`.
