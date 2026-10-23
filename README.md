# PearPass for Firefox

Firefox build of the PearPass 2.1.0 browser extension. It talks to the PearPass desktop app over native messaging and fills logins on `https://` pages.

This is a local port of the Chrome package in `vendor/chrome`. It is not signed by Mozilla, so Firefox Release only loads it as a temporary add-on until you sign it or use a Firefox build that allows unsigned extensions.

## Requirements

- Firefox 142 or newer
- [Bun](https://bun.sh) 1.4 or newer
- Python 3 with [Pillow](https://pypi.org/project/pillow/), used to resize the toolbar icons
- The PearPass desktop AppImage running on this machine

## Layout

| Path | What it is |
| --- | --- |
| `vendor/chrome/` | Unmodified PearPass Browser 2.1.0 package |
| `firefox/manifest.json` | Firefox manifest |
| `scripts/build.ts` | Copies the Chrome package into `dist/` and applies the Firefox fixes |
| `native/pearpass-native-host.sh` | Native messaging host that finds the running AppImage mount |
| `dist/` | Built add-on. Created by `bun run build`. Not committed |

## Build

```bash
bun test
bun run build
```

`bun test` rebuilds `dist/` and checks the manifest, popup script paths, and the Firefox clipboard patch.

Pack an `.xpi` of the current `dist/` tree:

```bash
bun run pack
```

That writes `pearpass-firefox-2.1.0.xpi` in this directory. The file is gitignored. Run `bun run pack` again after you clone the repo.

Lint the built add-on:

```bash
bun run lint
```

## Install

The extension id is `pearpass-firefox@anujkp.dev`. Firefox Release, including Firefox 157, will not keep an unsigned add-on after quit. Use the temporary load on that build. A file install from `about:addons` stays only after Mozilla signs the `.xpi`, or on Developer Edition, Nightly, or ESR with signature checks turned off.

### Temporary load

This is the install that works on normal Firefox.

1. Run `bun run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Choose `dist/manifest.json`.

Firefox removes the add-on when it quits. Load `dist/manifest.json` again after the next start.

### Install the .xpi from about:addons

1. Run `bun run pack`.
2. Open `about:addons`.
3. Click the gear next to **Manage Your Extensions**.
4. Choose **Install Add-on From File**.
5. Select `pearpass-firefox-2.1.0.xpi` in this directory.

On Firefox Release that dialog reports that the add-on could not be installed because it is not signed. The file itself is in the right place. The browser is refusing the unsigned package.

### Keep it without a public store listing

Copy `.env.example` to `.env` and set `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` from [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/). `.env` is gitignored.

```bash
bun run sign
```

That submits `dist/` to Mozilla as an unlisted add-on and writes the signed file under `web-ext-artifacts/`. Install that signed `.xpi` from **Install Add-on From File**. After the id change, run `bun run install-host` once so the desktop app allows `pearpass-firefox@anujkp.dev`.

### Keep the unsigned package on another Firefox build

Firefox Developer Edition, Nightly, and ESR honor `xpinstall.signatures.required`. Release and Beta ignore it.

1. Open `about:config` in that Firefox.
2. Set `xpinstall.signatures.required` to `false`.
3. Restart Firefox.
4. Install `pearpass-firefox-2.1.0.xpi` from **Install Add-on From File**.

The add-on then stays across restarts. The desktop app still has to be running, and `bun run install-host` still has to be done once.

## Connect the desktop app

Start the PearPass desktop app first. The extension reaches it through the native host `com.pears.pass`.

Install the host manifest for this checkout:

```bash
bun run install-host
```

That writes `com.pears.pass.json` to:

- `~/.mozilla/native-messaging-hosts/`
- `~/snap/firefox/common/.mozilla/native-messaging-hosts/` when that directory is created for the Snap build

The built extension calls the native host `com.pears.pass.firefox`. Browser Sync rewrites `com.pears.pass.json` and only allows `pass@pears.com` and `pass-nightly@pears.com`, which makes Firefox drop the connection with `Disconnected from native host`. The Firefox host file is separate, so that rewrite does not remove this extension.

`bun run install-host` writes both host manifests. When the desktop app has already written `~/.config/PearPass/native-messaging/pearpass-native-host.sh`, the manifests keep that path. The app rewrites the mount path inside that script on every launch. Otherwise they point at `native/pearpass-native-host.sh`, which finds `/tmp/.mount_Pear*` itself. If the desktop app is not running, the host exits and the extension reports that the app is unavailable.

Check the desktop connection without opening Firefox:

```bash
node scripts/probe-native.mjs
```

The probe uses the host script at `~/.config/PearPass/native-messaging/pearpass-native-host.sh`. A successful run prints `"available": true`.

### Windows

`bun run install-host` is Linux only. On Windows you have to run `scripts/install-native-host-windows.ps1` once. Firefox reads native hosts from the registry, not from `~/.mozilla`. The desktop app registers `com.pears.pass` and only allows `pass@pears.com` and `pass-nightly@pears.com`. This extension calls `com.pears.pass.firefox`, so onboarding fails with `Disconnected from native host` until that script registers the name.

Open the PearPass desktop app once, then in PowerShell from this checkout:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-native-host-windows.ps1
```

Quit Firefox, start PearPass, then load the add-on again. The script points `HKCU\Software\Mozilla\NativeMessagingHosts\com.pears.pass.firefox` at a manifest under `%LOCALAPPDATA%\PearPassFirefox\`. That file is separate from the one PearPass rewrites. The desktop copy is named `com.pears.pass` and only allows the official add-on ids, so a signed install of this add-on disconnects if the registry points at it. A temporary add-on can still connect before that rewrite. Run the script again if you open PearPass before the first registration.

## What the Firefox build changes

- Background is an event page (`background.scripts`), not a service worker.
- The `offscreen` permission is removed. Firefox does not implement that API. Clipboard clearing runs in the background page with `navigator.clipboard` and `document.execCommand("copy")`.
- Passkey interception is a `MAIN` world content script at `document_start`, so page Content-Security-Policy does not block it.
- Popup, onboarding, and autofill pages use relative script and style URLs without `crossorigin`. Firefox fails those module loads when the tags are marked cross-origin.
- Icons are generated at 16, 48, and 128 pixels.

Autofill on plain `http://` pages stays off until **allow HTTP** is enabled in the extension. `https://` pages work without that setting.

## Publishing

`vendor/chrome` is the PearPass browser package. Confirm PearPass's license before you publish those files. This repository does not add a license for that code.

Do not commit `dist/` or an `.xpi`. Build them after clone.
