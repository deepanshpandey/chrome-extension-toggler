// background.js (service worker, MV3)

// Read configured target extension ID
async function getTargetId() {
  const { targetExtensionId } = await chrome.storage.sync.get("targetExtensionId");
  return (targetExtensionId || "").trim() || null;
}

// Return true/false if installed, null if not installed / unknown
async function isEnabled(extId) {
  try {
    const info = await chrome.management.get(extId);
    return info && !!info.enabled;
  } catch (e) {
    return null;
  }
}

// Try to fetch an icon URL and convert to ImageData (best-effort)
async function fetchIconImageData(url, size) {
  // Defensive: fetch and image APIs may be unavailable or blocked (CORS / chrome-extension://)
  if (!url) return null;
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.debug('fetchIconImageData: fetch not ok', url, res.status);
      return null;
    }
    const blob = await res.blob();

    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
      // environment doesn't support image bitmap/canvas in service worker—can't convert
      console.debug('fetchIconImageData: createImageBitmap or OffscreenCanvas not available');
      return null;
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch (err) {
      console.debug('fetchIconImageData: createImageBitmap failed', err);
      return null;
    }

    try {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(bitmap, 0, 0, size, size);
      return ctx.getImageData(0, 0, size, size);
    } catch (err) {
      console.debug('fetchIconImageData: OffscreenCanvas draw/getImageData failed', err);
      return null;
    }
  } catch (e) {
    console.debug('fetchIconImageData: fetch error', e, url);
    return null;
  }
}

// Best-effort: try to set action icon from target extension's icons
async function trySetActionIconFromExtension(extId) {
  try {
    const info = await chrome.management.get(extId);
    const icons = info?.icons || [];
    if (!icons.length) return false;
    // prefer larger sizes
    icons.sort((a, b) => (b.size || 0) - (a.size || 0));
    const preferred = [128, 48, 32, 16];
    for (const pref of preferred) {
      const icon = icons.find(i => i.size === pref) || icons[0];
      if (!icon?.url) continue;
      // Only attempt network fetch for http(s) resources — chrome-extension:// URLs are usually blocked
      try {
        const isHttp = /^https?:\/\//i.test(icon.url);
        if (!isHttp) {
          console.debug('trySetActionIconFromExtension: skipping non-http icon url', icon.url);
          continue;
        }
      } catch (e) {
        // fallback: skip this icon
        continue;
      }

      const img = await fetchIconImageData(icon.url, pref);
      if (img) {
        await chrome.action.setIcon({ imageData: { [String(pref)]: img } });
        return true;
      }
    }
  } catch (e) {
    // ignore
  }
  return false;
}

// Generate a simple circular letter icon (always works)
function generateLetterIcon(name = "?", size = 128, bgColor = "#2f6fed", fgColor = "#fff") {
  const letter = (name && String(name).trim()[0]) ? String(name).trim()[0].toUpperCase() : "?";
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  // background circle
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  // letter
  ctx.fillStyle = fgColor;
  const fontSize = Math.floor(size * 0.55);
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, size / 2, size / 2 + Math.floor(size * 0.03));
  return ctx.getImageData(0, 0, size, size);
}

// Set action icon preferring target extension icon then generated fallback
async function setActionIconPreferTarget(extId, extName, enabled) {
  const ok = await trySetActionIconFromExtension(extId);
  if (ok) return;
  const sizes = [128, 48, 32, 16];
  const imageData = {};
  const bgColor = enabled ? "#2ea44f" : "#8b949e";
  for (const s of sizes) {
    imageData[String(s)] = generateLetterIcon(extName || extId || "?", s, bgColor);
  }
  await chrome.action.setIcon({ imageData });
}

// Update toolbar icon
async function updateActionUI() {
  // Always show the "on" icon regardless of state
  await chrome.action.setIcon({
    path: {
      16: "icons/icon_16.png",
      48: "icons/icon_48.png",
      128: "icons/icon_128.png"
    }
  });
}

// Toggle the selected extension
async function toggleTarget() {
  const extId = await getTargetId();
  if (!extId) {
    chrome.runtime.openOptionsPage();
    return { ok: false, reason: "no_id" };
  }
  const state = await isEnabled(extId);
  if (state === null) {
    chrome.runtime.openOptionsPage();
    return { ok: false, reason: "not_installed" };
  }
  try {
    await chrome.management.setEnabled(extId, !state);
    await updateActionUI();
    return { ok: true, enabled: !state };
  } catch (e) {
    return { ok: false, reason: "toggle_failed", error: String(e) };
  }
}

// Click handler
chrome.action.onClicked.addListener(async () => {
  await toggleTarget();
});

// Badges removed — no badge color needed

// Lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.sync.set({ targetExtensionId: "" });
    chrome.runtime.openOptionsPage();
  }
  await updateActionUI();
});
chrome.runtime.onStartup.addListener(updateActionUI);

// React to storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.targetExtensionId) updateActionUI();
});

// React to management changes for the selected extension
chrome.management.onEnabled.addListener(async (info) => {
  const extId = await getTargetId();
  if (info.id === extId) updateActionUI();
});
chrome.management.onDisabled.addListener(async (info) => {
  const extId = await getTargetId();
  if (info.id === extId) updateActionUI();
});

// Message API for options page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_STATUS") {
      const id = await getTargetId();
      let installed = false, enabled = false, name = null;
      if (id) {
        try {
          const info = await chrome.management.get(id);
          installed = !!info;
          enabled = !!info?.enabled;
          name = info?.name || null;
        } catch (e) {
          installed = false;
          enabled = false;
        }
      }
      sendResponse({ status: { hasId: !!id, installed, enabled, id, name } });
    } else if (msg?.type === "SET_TARGET_ID") {
      await chrome.storage.sync.set({ targetExtensionId: (msg.value || "").trim() });
      await updateActionUI();
      sendResponse({ ok: true });
    } else if (msg?.type === "REFRESH") {
      await updateActionUI();
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
  })();
  return true; // async
});