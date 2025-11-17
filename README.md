# Extension Toggle Switch

A small Chrome extension that lets you toggle other extensions on and off quickly from a popup and manage a pinned list from the Options page.

## At a glance

- Name: Extension Toggle Switch
- Version: 1.0.0
- Purpose: Quickly enable/disable installed extensions and maintain a pinned list and profiles for easy access.
- Key permissions: management (to list/enable/disable extensions), storage (to persist preferences)

## Features

- One-click enable/disable per extension from the popup UI.
- Pin extensions (from Options) so they appear separately in the popup.
- Hide extensions from the popup list if desired.
- Options page to choose default sorting and visibility settings.
- Profiles: a "Default" profile is created automatically from your current extension states; you can save, apply, delete, export, and import additional profiles.
- Search extensions in the popup by name or ID (real-time filtering, fuzzy/partial match, and keyboard navigation).
- Save and apply extension profiles for different setups (e.g., Work, Personal).

### Quick Install & load (Developer / local install)

1. Open Chrome and go to chrome://extensions.
2. Turn on **Developer mode** (top-right toggle).
3. Get the latest release from the Releases page for this repository.
4. Drag the downloaded release (CRX or unzipped folder) onto the chrome://extensions page to install.
Note: Developer mode is only required for loading unpacked extensions in our case.

## How to use

1. Click the extension action (toolbar icon) to open the popup.
2. The popup displays two sections: Pinned and All extensions. Use the toggle next to any extension to enable or disable it.
3. Use the search bar at the top of the popup to filter extensions by name or ID. Typing performs a real-time, case-insensitive match; partial and fuzzy matches are supported. Use arrow keys and Enter to navigate results.
4. A "Default" profile (captured from your current setup) is available automatically. Select a profile and click Apply to switch extension states.
5. Click Save Profile to save the current setup as a new profile. Use Export to download a profile JSON, or Import to load a profile file from disk.
6. To manage pins/hidden items, profiles, and default popup behaviour, open the Options page (via the popup's Options button or from chrome://extensions → Details → Extension options).

---

## Pro Tip

**Pin this extension to the toolbar for quicker access (click the puzzle icon in the toolbar and then the pin icon next to this extension).**

---

### Search extension (popup)

- Real-time filtering by extension name or ID.
- Fuzzy and partial matches for fast lookup of similarly named items.
- Keyboard navigation: Arrow Up/Down to move through results and Enter to toggle or open details.
- Search can be scoped to Pinned-only or All extensions using the popup controls.
- Searching respects hidden items (they can be included/excluded via a toggle).

### Extension profiles

- Save the current enabled/disabled state of all extensions as a named profile.
- Apply a profile to change all extensions to the saved state in one click.
- The "Default" profile is created automatically from your current system state on first run.
- Export profiles to JSON for backup or sharing.
- Import profiles from JSON to restore or add new configurations.
- Profiles are stored in chrome.storage.sync (subject to sync limits); large sets can be exported/imported.
- Options page allows renaming, deleting, and reordering profiles; it also shows which profile is currently applied.

### Options page

- Set popup sorting (Name, Enabled first, Pinned first).
- Toggle whether the popup shows only pinned extensions.
- Pin/unpin or hide extensions from the listing (stored using chrome.storage.sync).
- Manage extension profiles: save current states, apply, delete, export, or import profiles.

### Permissions used

- management — required to list installed extensions and enable/disable them.
- storage — used to persist the user's pinned/hidden lists, profiles, and popup settings.

These permissions are declared in `manifest.json` and are necessary for the extension's core functionality.

### Troubleshooting

- If the extension doesn't appear to work, confirm Developer mode is enabled and that you loaded the correct folder.
- If toggling fails for a target extension, ensure that the target extension is installed and not a system-protected extension (some built-in or policy-managed extensions cannot be toggled programmatically).
- Profile import/export errors can occur if the JSON is malformed or exceeds storage.sync size limits — export then import using a local file if sync limits are hit.
- Use the Options page to enter or clear the target extension id; if no target is set, the extension will open Options to help configure it.

### Development notes

- Background/service worker: `background.js` (manifest v3 service worker) — handles toggling and action icon updates.
- Popup UI: `popup.html`, `popup.js`, `popup.css` — lists extensions, provides the toggle UI, search input, and profile controls.
- Options UI: `options.html`, `options.js`, `options.css` — configure pinned/hidden lists, profiles, and popup behaviour.
- Profiles and settings are stored in `chrome.storage.sync` as structured objects (profile name → extension state map); exported profiles use a simple JSON schema for portability.

### Contributing

Small changes, bug fixes and UX improvements are welcome. If you add features that require more or different permissions, update `manifest.json` accordingly.
