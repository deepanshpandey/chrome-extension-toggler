// options.js — enhanced options UI for popup behavior and pinned extensions

const $ = id => document.getElementById(id);

async function loadSettings() {
  const def = { popupSettings: { height: 400, sort: 'name_asc', onlyPinnedVisible: false }, pinnedExtensionIds: [], hiddenExtensionIds: [] };
  const res = await chrome.storage.sync.get(['popupSettings', 'pinnedExtensionIds', 'hiddenExtensionIds']);
  return {
    popupSettings: { ...def.popupSettings, ...(res.popupSettings || {}) },
    pinnedExtensionIds: Array.isArray(res.pinnedExtensionIds) ? res.pinnedExtensionIds : def.pinnedExtensionIds,
    hiddenExtensionIds: Array.isArray(res.hiddenExtensionIds) ? res.hiddenExtensionIds : def.hiddenExtensionIds
  };
}

async function buildPinList() {
  const container = $("pinList");
  container.innerHTML = '';
  try {
    const items = await chrome.management.getAll();
    const filtered = items.filter(i => i.id !== chrome.runtime.id && (i.type === 'extension' || i.type === 'theme' || i.type === 'packaged_app' || i.type === 'hosted_app'));
    filtered.sort((a,b) => a.name.localeCompare(b.name));

    const { pinnedExtensionIds, hiddenExtensionIds } = await loadSettings();
    for (const it of filtered) {
      const row = document.createElement('div');
      row.className = 'pin-row';
      row.style.padding = '6px 8px';

      const pinCb = document.createElement('input');
      pinCb.type = 'checkbox';
      pinCb.value = it.id;
      pinCb.dataset.role = 'pin';
      pinCb.checked = pinnedExtensionIds.includes(it.id);
      pinCb.addEventListener('change', async () => {
        const curr = await getPinnedIdsSafe();
        let next;
        if (pinCb.checked) {
          next = [it.id, ...curr.filter(x => x !== it.id)];
        } else {
          next = curr.filter(x => x !== it.id);
        }
        suppressKey('pinnedExtensionIds');
        await chrome.storage.sync.set({ pinnedExtensionIds: next });
      });
      row.appendChild(pinCb);

      const img = document.createElement('img');
      img.src = (it.icons && it.icons.length) ? it.icons[it.icons.length-1].url : '';
      img.style.width = '24px';
      img.style.height = '24px';
      img.style.borderRadius = '6px';
      img.onerror = () => img.style.display = 'none';
      row.appendChild(img);

  const span = document.createElement('span');
  span.className = 'title';
  span.textContent = it.name || it.id;
  row.appendChild(span);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const hideLabel = document.createElement('label');
      const hideCb = document.createElement('input');
      hideCb.type = 'checkbox';
      hideCb.value = it.id;
      hideCb.dataset.role = 'hide';
      hideCb.checked = hiddenExtensionIds.includes(it.id);
      hideCb.addEventListener('change', async () => {
        const curr = await getHiddenIdsSafe();
        let next;
        if (hideCb.checked) {
          next = [it.id, ...curr.filter(x => x !== it.id)];
        } else {
          next = curr.filter(x => x !== it.id);
        }
        suppressKey('hiddenExtensionIds');
        await chrome.storage.sync.set({ hiddenExtensionIds: next });
      });
      hideLabel.appendChild(hideCb);
      const hideText = document.createElement('span');
      hideText.textContent = 'Hide';
      hideLabel.appendChild(hideText);
      actions.appendChild(hideLabel);

      row.appendChild(actions);
      container.appendChild(row);
    }
    if (!filtered.length) container.textContent = 'No extensions found';
  } catch (e) {
    container.textContent = 'Failed to list extensions: ' + String(e);
  }
}

async function populateForm() {
  const { popupSettings } = await loadSettings();
  $("popupSort").value = popupSettings.sort || 'name_asc';
  const onlySel = $("onlyPinnedVisibleSelect");
  if (onlySel) onlySel.value = popupSettings.onlyPinnedVisible ? 'yes' : 'no';
  await buildPinList();
}

// Suppression map for storage changes initiated by this page
const suppressMap = new Map();
function suppressKey(key, timeoutMs = 600) {
  suppressMap.set(key, Date.now() + timeoutMs);
  setTimeout(() => suppressMap.delete(key), timeoutMs);
}
function isSuppressed(key) {
  const t = suppressMap.get(key);
  return t && t > Date.now();
}

async function getPinnedIdsSafe() {
  const { pinnedExtensionIds } = await chrome.storage.sync.get({ pinnedExtensionIds: [] });
  return Array.isArray(pinnedExtensionIds) ? pinnedExtensionIds : [];
}
async function getHiddenIdsSafe() {
  const { hiddenExtensionIds } = await chrome.storage.sync.get({ hiddenExtensionIds: [] });
  return Array.isArray(hiddenExtensionIds) ? hiddenExtensionIds : [];
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

async function savePopupSettingsFromUI() {
  // Preserve existing height value; height control removed from UI
  const existing = await chrome.storage.sync.get({ popupSettings: { height: 400, sort: 'name_asc', onlyPinnedVisible: false } });
  const prev = existing.popupSettings || { height: 400, sort: 'name_asc', onlyPinnedVisible: false };
  const sort = $("popupSort").value || prev.sort || 'name_asc';
  const onlyPinnedVisible = $("onlyPinnedVisibleSelect").value === 'yes';
  suppressKey('popupSettings');
  await chrome.storage.sync.set({ popupSettings: { height: prev.height || 400, sort, onlyPinnedVisible } });
}

document.addEventListener('DOMContentLoaded', async () => {
  await populateForm();

  // Auto-save popup settings
  const debouncedSave = debounce(savePopupSettingsFromUI, 300);
  $("popupSort").addEventListener('change', savePopupSettingsFromUI);
  $("onlyPinnedVisibleSelect").addEventListener('change', savePopupSettingsFromUI);

  // React to external storage changes only (ignore ones we initiated briefly)
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync') return;
    if (changes.popupSettings && !isSuppressed('popupSettings')) {
      const { newValue } = changes.popupSettings;
      if (newValue) {
        $("popupSort").value = newValue.sort || 'name_asc';
        const onlySel2 = $("onlyPinnedVisibleSelect");
        if (onlySel2) onlySel2.value = newValue.onlyPinnedVisible ? 'yes' : 'no';
      }
    }
    if (changes.pinnedExtensionIds && !isSuppressed('pinnedExtensionIds')) {
      const ids = await getPinnedIdsSafe();
      const pinContainer = $("pinList");
      pinContainer.querySelectorAll('input[type="checkbox"][data-role="pin"]').forEach(cb => {
        cb.checked = ids.includes(cb.value);
      });
    }
    if (changes.hiddenExtensionIds && !isSuppressed('hiddenExtensionIds')) {
      const ids = await getHiddenIdsSafe();
      const pinContainer = $("pinList");
      pinContainer.querySelectorAll('input[type="checkbox"][data-role="hide"]').forEach(cb => {
        cb.checked = ids.includes(cb.value);
      });
    }
  });
});