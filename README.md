# Extension Toggle Switch

A small Chrome extension that lets you toggle other extensions on and off quickly from a popup and manage a pinned list from the Options page.

## At a glance

- Name: Extension Toggle Switch
- Version: 1.0.0
- Purpose: Quickly enable/disable installed extensions and maintain a pinned list for easy access.
- Key permissions: management (to list/enable/disable extensions), storage (to persist preferences)

## Features

- One-click enable/disable per extension from the popup UI.
- Pin extensions (from Options) so they appear separately in the popup.
- Hide extensions from the popup list if desired.
- Options page to choose default sorting and visibility settings.

### Quick Install & load (Developer / local install)

1. Open Chrome and go to chrome://extensions.
2. Turn on **Developer mode** (top-right toggle).
3. Get the latest release from the Releases page for this repository.
4. Drag the downloaded release (CRX or unzipped folder) onto the chrome://extensions page to install.
Note: Developer mode is only required for loading unpacked extensions in our case.

## How to use

1. Click the extension action (toolbar icon) to open the popup.
2. The popup displays two sections: Pinned and All extensions. Use the toggle next to any extension to enable or disable it.
3. To manage pins/hidden items and default popup behaviour, open the Options page (via the popup's Options button or from chrome://extensions → Details → Extension options).

---

## Pro Tip

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
