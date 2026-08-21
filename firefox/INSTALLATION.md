# Installing Link Extractor 9000 on Firefox

There is no addons.mozilla.org listing yet, so this is a manual load. Firefox
calls it a temporary add-on, and the important consequence is in the name: it is
gone when Firefox restarts.

Tested on Firefox 153.0.4.

Everything here works from a downloaded release. Building from a clone is in
[`DEVELOPMENT.md`](../DEVELOPMENT.md) instead.

## First install

1. Download `link-extractor-9000-firefox-<version>.zip` from
   [Releases](https://github.com/Deon-Trevor/Link-Extractor-9000/releases).

2. Unzip it into an empty directory of its own. The archive holds
   `manifest.json` at the top level with no wrapping folder, so extracting it
   where you stand scatters the files across whatever is already there:

   ```bash
   unzip -d link-extractor-9000 link-extractor-9000-firefox-1.0.3.zip
   ```

   The rest of this page calls that the extension folder. Firefox cannot load the
   zip itself, only the folder you unpacked it into.

3. Open `about:debugging#/runtime/this-firefox`.

4. Click **Load Temporary Add-on** and select the `manifest.json` inside the
   extension folder.

   Select the `manifest.json` file, not the folder holding it. Firefox wants the
   file here, which is the opposite of Chrome's Load unpacked.

5. Open the extensions menu, the puzzle-piece icon, find Link Extractor 9000 and
   pin it to the toolbar. The saved count appears on the button as a green badge.

Check it works: open any page with links, click the button, then click **Collect
every page URL**. The status line should report how many URLs were added, and the
badge should show the count.

## Updating when a new version lands

Download the new zip and unpack it over the extension folder:

```bash
unzip -o -d link-extractor-9000 link-extractor-9000-firefox-1.0.3.zip
```

Then in `about:debugging#/runtime/this-firefox` click **Reload** on the Link
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
exit. Load the extension folder's `manifest.json` again after each restart. A
signed release from AMO will not behave this way.

**A stale toolbar icon after an icon change.** Reload does not always refresh it.
Remove the add-on and load it again, which is the one case where Remove is worth
it. The reason is visible on the `about:debugging` card: each temporary install
gets a new **Internal UUID**, and the icon is cached against the old one.

**The Internal UUID changes every load.** Expected. The **Extension ID** stays
`link-extractor-9000@deon-trevor`, which is the identity that matters.

## If it will not load

| What Firefox says | What it means |
| --- | --- |
| An empty popup, or a broken icon on the card | The `manifest.json` you picked is not the one from the release zip. Unzip the archive again into an empty directory and select the `manifest.json` inside it. |
| This add-on could not be installed because it appears to be corrupt | The manifest did not parse, or the folder is missing files it declares. Check the download finished, then unzip it again into an empty directory. |
| The button is missing from the toolbar | It is in the puzzle-piece menu and not pinned yet. |
| Could not read this page | Expected on `about:` pages, `addons.mozilla.org`, and other pages Firefox shields from extensions. Try an ordinary web page. |
| The add-on vanished | Firefox restarted. Load it again. |
