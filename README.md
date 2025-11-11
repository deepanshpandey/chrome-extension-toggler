# Extension Toggle Switch
---
A small Chrome extension that lets you toggle other extensions on and off quickly from a popup and manage a pinned list from the Options page.

#### At a glance

- Name: Extension Toggle Switch
- Version: 1.0.0
- Purpose: Quickly enable/disable installed extensions and maintain a pinned list for easy access.
- Key permissions: management (to list/enable/disable extensions), storage (to persist preferences)

#### Features

- One-click enable/disable per extension from the popup UI.
- Pin extensions (from Options) so they appear separately in the popup.
- Hide extensions from the popup list if desired.
- Options page to choose default sorting and visibility settings.

### Install & load (Developer / local install)

1. Open Chrome and go to chrome://extensions.
2. Turn on **Developer mode** (top-right toggle).
	- On desktop Chrome, you'll see a switch labeled "Developer mode" — flip it on. This enables the "Load unpacked" button and extra diagnostics.
3. Click "Load unpacked" and select the directory for this project (the folder that contains `manifest.json`).
4. The extension should appear in your list. If it is a fresh install, the Options page may open to let you choose a target extension.

Note: Developer mode is only required for loading unpacked extensions during development. It is not required for production installs from the Chrome Web Store.

#### Enable Developer mode (step-by-step)

1. Open Chrome and navigate to chrome://extensions.
2. Locate the **Developer mode** toggle at the top-right of the page and enable it.
3. Once enabled you'll see buttons like "Load unpacked" and "Pack extension".

#### How to load this extension (Load unpacked)

1. With Developer mode enabled on chrome://extensions, click the "Load unpacked" button.
2. In the file picker, choose the extension folder (the root of this repo — the folder that contains `manifest.json`, `popup.html`, `background.js`, etc.).
3. After loading, you should see the extension in the list. If you see errors, open the extension's details to view the error message.

## How to use

1. Click the extension action (toolbar icon) to open the popup.
2. The popup displays two sections: Pinned and All extensions. Use the toggle next to any extension to enable or disable it.
3. To manage pins/hidden items and default popup behaviour, open the Options page (via the popup's Options button or from chrome://extensions → Details → Extension options).


---
## Pro Tip:
**Pin this extension to the toolbar for quicker access (click the puzzle icon in the toolbar and then the pin icon next to this extension).**

---

### Options page

- Set popup sorting (Name, Enabled first, Pinned first).
- Toggle whether the popup shows only pinned extensions.
- Pin/unpin or hide extensions from the listing (stored using chrome.storage.sync).

### Permissions used

- management — required to list installed extensions and enable/disable them.
- storage — used to persist the user's pinned/hidden lists and popup settings.

These permissions are declared in `manifest.json` and are necessary for the extension's core functionality.

### Troubleshooting

- If the extension doesn't appear to work, confirm Developer mode is enabled and that you loaded the correct folder.
- If toggling fails for a target extension, ensure that the target extension is installed and not a system-protected extension (some built-in or policy-managed extensions cannot be toggled programmatically).
- Use the Options page to enter or clear the target extension id; if no target is set, the extension will open Options to help configure it.

### Development notes

- Background/service worker: `background.js` (manifest v3 service worker) — handles toggling and action icon updates.
- Popup UI: `popup.html`, `popup.js`, `popup.css` — lists extensions and provides the toggle UI.
- Options UI: `options.html`, `options.js`, `options.css` — configure pinned/hidden lists and popup behaviour.

### Contributing

Small changes, bug fixes and UX improvements are welcome. If you add features that require more or different permissions, update `manifest.json` accordingly.

---

