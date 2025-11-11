const $ = id => document.getElementById(id);

async function getPinned() {
  const { pinnedExtensionIds } = await chrome.storage.sync.get({ pinnedExtensionIds: [] });
  return Array.isArray(pinnedExtensionIds) ? pinnedExtensionIds : [];
}

async function setPinned(list) {
  await chrome.storage.sync.set({ pinnedExtensionIds: list });
}

function makeItemElement(info) {
  const el = document.createElement('div');
  el.className = 'item';
  if (!info.enabled) el.classList.add('disabled');

  const img = document.createElement('img');
  img.className = 'icon';
  const icon = (info.icons && info.icons.length) ? info.icons[info.icons.length-1].url : '';
  img.src = icon || '';
  img.alt = '';
  img.onerror = () => { img.style.display = 'none'; };
  el.appendChild(img);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = info.name || info.id;
  el.appendChild(name);

  const actions = document.createElement('div');
  actions.className = 'actions';

  // Toggle as icon-only switch (morph-like crossfade)
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'toggleBtn switchBtn iconBtn';
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('role', 'switch');
  toggleBtn.setAttribute('aria-checked', info.enabled ? 'true' : 'false');
  toggleBtn.title = info.enabled ? 'Disable' : 'Enable';
  toggleBtn.setAttribute('aria-label', info.enabled ? 'Disable extension' : 'Enable extension');
  // two stacked images to crossfade between states
  const onImg = document.createElement('img');
  onImg.src = 'icons/switch-on.svg';
  onImg.alt = '';
  onImg.className = 'switch-img img-on';
  const offImg = document.createElement('img');
  offImg.src = 'icons/switch-off.svg';
  offImg.alt = '';
  offImg.className = 'switch-img img-off';
  toggleBtn.appendChild(onImg);
  toggleBtn.appendChild(offImg);
  // initialize visual state
  if (info.enabled) {
    toggleBtn.classList.add('on');
    toggleBtn.classList.remove('off');
  } else {
    toggleBtn.classList.add('off');
    toggleBtn.classList.remove('on');
  }
  toggleBtn.addEventListener('click', async () => {
    try {
      await chrome.management.setEnabled(info.id, !info.enabled);
      // optimistic update: flip state locally then refresh
      info.enabled = !info.enabled;
      el.classList.toggle('disabled', !info.enabled);
      toggleBtn.setAttribute('aria-checked', info.enabled ? 'true' : 'false');
      toggleBtn.title = info.enabled ? 'Disable' : 'Enable';
      toggleBtn.setAttribute('aria-label', info.enabled ? 'Disable extension' : 'Enable extension');
      toggleBtn.classList.toggle('on', info.enabled);
      toggleBtn.classList.toggle('off', !info.enabled);
      // Suppress the immediate event-driven refresh to avoid full-popup flicker
      suppressManagementRefresh(info.id);
    } catch (e) {
      setStatus('Toggle failed: ' + String(e));
    }
  });
  actions.appendChild(toggleBtn);

  // Pin/unpin handled in Options page; no pin control in popup

  el.appendChild(actions);
  return el;
}

function setStatus(msg) {
  const s = $("status");
  s.textContent = msg || '';
}

async function loadPopupSettings() {
  const { popupSettings } = await chrome.storage.sync.get({ popupSettings: { height: 400, sort: 'name_asc', onlyPinnedVisible: false } });
  return popupSettings || { height: 400, sort: 'name_asc', onlyPinnedVisible: false };
}

async function getHidden() {
  const { hiddenExtensionIds } = await chrome.storage.sync.get({ hiddenExtensionIds: [] });
  return Array.isArray(hiddenExtensionIds) ? hiddenExtensionIds : [];
}


function sortItems(items, popupSort, pinnedSet) {
  // popupSort: name_asc, name_desc, enabled_first, pinned_first
  if (popupSort === 'name_asc') return items.sort((a,b) => a.name.localeCompare(b.name));
  if (popupSort === 'name_desc') return items.sort((a,b) => b.name.localeCompare(a.name));
  if (popupSort === 'enabled_first') return items.sort((a,b) => (b.enabled - a.enabled) || a.name.localeCompare(b.name));
  if (popupSort === 'pinned_first') return items.sort((a,b) => {
    const pa = pinnedSet.has(a.id) ? 0 : 1;
    const pb = pinnedSet.has(b.id) ? 0 : 1;
    return pa - pb || a.name.localeCompare(b.name);
  });
  return items;
}

async function buildLists() {
  const allList = $("allList");
  const pinnedListEl = $("pinnedList");
  allList.innerHTML = '';
  pinnedListEl.innerHTML = '';
  allList.classList.remove('empty');
  pinnedListEl.classList.remove('empty');

  const [rawPinnedIds, hiddenIds, popupSettings] = await Promise.all([getPinned(), getHidden(), loadPopupSettings()]);
  const pinnedIds = Array.from(new Set(rawPinnedIds)); // de-dup just in case
  // Height control removed; no dynamic height application

  let items = [];
  try {
    items = await chrome.management.getAll();
  } catch (e) {
    setStatus('Failed to list extensions: ' + String(e));
    return;
  }

  // filter types and exclude the current extension, then remove hidden
  items = items.filter(i => i.id !== chrome.runtime.id && (i.type === 'extension' || i.type === 'theme' || i.type === 'packaged_app' || i.type === 'hosted_app'));
  const hiddenSet = new Set(hiddenIds);
  items = items.filter(i => !hiddenSet.has(i.id));

  const pinnedSet = new Set(pinnedIds);

  // pinned items: preserve pinned order
  const pinnedItems = [];
  for (const id of pinnedIds) {
    const it = items.find(x => x.id === id);
    if (it) pinnedItems.push(it);
  }

  // others
  let otherItems = items.filter(x => !pinnedSet.has(x.id));

  // apply sort to otherItems (and optionally to pinned group by configuration)
  otherItems = sortItems(otherItems, popupSettings.sort, pinnedSet);

  const appended = new Set();

  const pinnedSection = document.getElementById('pinnedSection');
  const pinnedHeading = document.getElementById('pinnedHeading');
  const allHeading = document.getElementById('allHeading');

  if (popupSettings.onlyPinnedVisible) {
    // Only show pinned items and hide headings
    const pinnedSection = document.getElementById('pinnedSection');
    const pinnedHeading = document.getElementById('pinnedHeading');
    const allHeading = document.getElementById('allHeading');
    if (pinnedSection) pinnedSection.style.display = 'none';
    if (pinnedHeading) pinnedHeading.style.display = 'none';
    if (allHeading) allHeading.style.display = 'none';

    const only = pinnedItems;
    if (only.length === 0) {
      allList.classList.add('empty');
      allList.textContent = 'No extensions found';
    } else {
      for (const it of only) {
        if (appended.has(it.id)) continue;
        appended.add(it.id);
        allList.appendChild(makeItemElement(it));
      }
    }
    return;
  }

  if (pinnedItems.length === 0) {
    // Hide pinned section and all heading; render full list in allList
    if (pinnedSection) pinnedSection.style.display = 'none';
    if (allHeading) allHeading.style.display = 'none';

    const full = sortItems([...items], popupSettings.sort, new Set());
    if (full.length === 0) {
      allList.classList.add('empty');
      allList.textContent = 'No extensions found';
    } else {
      for (const it of full) {
        if (appended.has(it.id)) continue;
        appended.add(it.id);
        allList.appendChild(makeItemElement(it));
      }
    }
  } else {
    // Show headings and both lists
    if (pinnedSection) pinnedSection.style.display = '';
    if (pinnedHeading) pinnedHeading.style.display = '';
    if (allHeading) allHeading.style.display = '';

    // Pinned list
    if (pinnedItems.length > 0) {
      for (const it of pinnedItems) {
        if (appended.has(it.id)) continue;
        appended.add(it.id);
        pinnedListEl.appendChild(makeItemElement(it));
      }
    }

    // Others list
    if (otherItems.length === 0) {
      allList.classList.add('empty');
      allList.textContent = 'No extensions found';
    } else {
      for (const it of otherItems) {
        if (appended.has(it.id)) continue;
        appended.add(it.id);
        allList.appendChild(makeItemElement(it));
      }
    }
  }
}

let refreshInProgress = false;
let refreshQueued = false;
let refreshTimer = null;
async function refresh() {
  if (refreshInProgress) {
    refreshQueued = true;
    return;
  }
  refreshInProgress = true;
  do {
    refreshQueued = false;
    await buildLists();
  } while (refreshQueued);
  refreshInProgress = false;
}

function requestRefresh(delay = 200) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refresh();
  }, delay);
}

// Suppress management-driven refresh right after a user-initiated toggle to prevent flicker
const suppressedIds = new Set();
function suppressManagementRefresh(id, timeoutMs = 800) {
  if (!id) return;
  suppressedIds.add(id);
  setTimeout(() => suppressedIds.delete(id), timeoutMs);
}

document.addEventListener('DOMContentLoaded', () => {
  $("refresh").addEventListener('click', refresh);
  $("openOptions").addEventListener('click', () => chrome.runtime.openOptionsPage());
  refresh();


  // react to storage and management events to keep UI in sync
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.pinnedExtensionIds || changes.popupSettings)) requestRefresh();
  });
  const onMgmtChange = (info) => {
    if (info && suppressedIds.has(info.id)) return; // skip flicker-causing immediate refresh
    requestRefresh();
  };
  chrome.management.onEnabled.addListener(onMgmtChange);
  chrome.management.onDisabled.addListener(onMgmtChange);
});
