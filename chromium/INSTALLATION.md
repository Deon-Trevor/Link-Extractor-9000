# Installing Link Extractor 9000 on Chrome

Chrome will not install an extension from a file outside the Chrome Web Store, so
there is no double-click installer here. You point Chrome at a folder and it runs
the extension from that folder. This also works in Edge, Brave, Opera, and Vivaldi,
which use the same extensions page.

Tested on Chrome 151. The manifest sets `minimum_chrome_version` to 105, so
anything older refuses to load it.

## First install

1. Get the folder Chrome needs. Either download
   `link-extractor-9000-chromium-<version>.zip` from
   [Releases](https://github.com/Deon-Trevor/Link-Extractor-9000/releases) and
   unzip it into a directory of its own, since the archive has no wrapping folder
   and Chrome cannot load a zip:

   ```bash
   unzip -d link-extractor-9000 link-extractor-9000-chromium-1.0.3.zip
   ```

   Or build it from a clone, which writes `dist/chromium/`:

   ```bash
   npm run package
   ```

   If you built it, pick `dist/chromium`, not the `chromium/` directory this file
   sits in. That one holds only the manifest template; the files it references
   live in the repo root.

   The rest of this file says `dist/chromium`. Read that as the unzipped
   directory if you downloaded a release.

2. Open `chrome://extensions` and turn on **Developer mode**, the toggle in the
   top right. The buttons in step 3 do not appear until you do.

3. Click **Load unpacked** and select the `dist/chromium` folder. Select the
   folder itself, not `manifest.json` inside it, and not the repository root.

4. Click the puzzle-piece icon in the toolbar, find Link Extractor 9000, and click
   the pin so the button stays visible. The saved count shows on the button as a
   green badge.

Check it works: open any page with links, click the button, then click **Collect
every page URL**. The status line should report how many URLs were added, and the
badge should show the count.

## Where the folder lives matters

Chrome derives the extension's identity from the absolute path of the folder you
selected. Keep that folder where it is.

Move or rename it and Chrome treats it as a different extension, which means an
empty collection and a second entry on the extensions page. If you need to move
it, export your collection first with **TXT**, **CSV**, or **JSON**.

## Updating when a new version lands

Put the new version in the same folder, either by unzipping the new release over
it or by rebuilding from a clone, then reload:

```bash
git pull
npm run package
```

Then open `chrome://extensions` and click the reload icon, the circular arrow, on
the Link Extractor 9000 card. Your saved collection survives this.

**Do not click Remove and load it again.** Remove wipes the extension's storage.
Reloading at the same path keeps the identity and the data; removing and re-adding
gives you the same identity with an empty collection. Verified on Chrome 151: a
collection of 2 URLs came back as 0 after a remove and re-add.

So, in short: reload to update, and only remove when you actually want it gone.

## Things Chrome does that look like problems

**A warning about developer mode extensions.** Chrome may nag on startup about
extensions running in developer mode. That is Chrome's standard warning for
anything loaded from a folder rather than the store. Dismissing it does not
disable the extension.

**The version on the card looks stale.** The card reads the version from the
manifest in the folder. If it disagrees with what you just built, Chrome is still
running the old copy, so click reload.

**A stale icon.** Click reload first. If the old icon persists, remove the
extension and load it again, but export your collection first, because removing
clears it.

## If it will not load

| What Chrome says | What it means |
| --- | --- |
| Manifest file is missing or unreadable | You selected the wrong folder. It must be the one holding `manifest.json`, which is `dist/chromium`, not the repository root. |
| This extension requires a newer version of Chrome | Your Chrome is older than 105. Update Chrome. |
| Nothing happens when you click Load unpacked | Developer mode is off. Turn on the toggle in the top right. |
| The button is missing from the toolbar | It is in the puzzle-piece menu and not pinned yet. |
| Could not read this page | Expected on `chrome://` pages, the Web Store, and other pages Chrome shields from extensions. Try an ordinary web page. |

For anything else, click **Errors** on the extension's card. That panel holds the
real message.
