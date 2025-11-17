// options.js — enhanced options UI for popup behavior, pins/hidden, and profiles

const $ = id => document.getElementById(id);

// Status helper for inline feedback
function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || '';
}

const DEFAULT_PROFILE_NAME = 'Default';

// Local filter state for Options page
let optSearchTerm = '';
let optHideDisabled = false;

// Load core settings used by Options controls
async function loadSettings() {
  const def = { popupSettings: { height: 400, sort: 'name_asc', onlyPinnedVisible: false }, pinnedExtensionIds: [], hiddenExtensionIds: [] };
  const res = await chrome.storage.sync.get(['popupSettings', 'pinnedExtensionIds', 'hiddenExtensionIds']);
  return {
    popupSettings: { ...def.popupSettings, ...(res.popupSettings || {}) },
    pinnedExtensionIds: Array.isArray(res.pinnedExtensionIds) ? res.pinnedExtensionIds : def.pinnedExtensionIds,
    hiddenExtensionIds: Array.isArray(res.hiddenExtensionIds) ? res.hiddenExtensionIds : def.hiddenExtensionIds
  };
}

async function getProfiles() {
  const { profiles } = await chrome.storage.sync.get({ profiles: {} });
  return profiles || {};
}

async function setProfiles(profiles) {
  await chrome.storage.sync.set({ profiles });
}

async function saveProfile(name) {
  const items = await chrome.management.getAll();
  const state = {};
  for (const item of items) {
    if (item.id !== chrome.runtime.id && (item.type === 'extension' || item.type === 'theme' || item.type === 'packaged_app' || item.type === 'hosted_app')) {
      state[item.id] = item.enabled;
    }
  }
  const profiles = await getProfiles();
  profiles[name] = state;
  await setProfiles(profiles);
}

async function applyProfile(name) {
  const profiles = await getProfiles();
  const state = profiles[name];
  if (!state) return;
  for (const [id, enabled] of Object.entries(state)) {
    try {
      await chrome.management.setEnabled(id, enabled);
    } catch (e) {
      console.warn('Failed to set', id, e);
    }
  }
}

async function captureCurrentExtensionState() {
  const items = await chrome.management.getAll();
  const state = {};
  for (const item of items) {
    if (item.id !== chrome.runtime.id && (item.type === 'extension' || item.type === 'theme' || item.type === 'packaged_app' || item.type === 'hosted_app')) {
      state[item.id] = !!item.enabled;
    }
  }
  return state;
}

async function ensureDefaultProfileExists() {
  const { profiles } = await chrome.storage.sync.get({ profiles: {} });
  const map = profiles || {};
  if (!map[DEFAULT_PROFILE_NAME]) {
    const snapshot = await captureCurrentExtensionState();
    map[DEFAULT_PROFILE_NAME] = snapshot;
    await chrome.storage.sync.set({ profiles: map });
  }
}

async function buildExtList() {
  const container = $("extList");
  container.innerHTML = '';
  try {
    const items = await chrome.management.getAll();
    let filtered = items.filter(i => i.id !== chrome.runtime.id && (i.type === 'extension' || i.type === 'theme' || i.type === 'packaged_app' || i.type === 'hosted_app'));
    if (optHideDisabled) filtered = filtered.filter(i => i.enabled);
    if (optSearchTerm) {
      const term = optSearchTerm.toLowerCase();
      filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(term) || i.id.toLowerCase().includes(term));
    }
    filtered.sort((a,b) => a.name.localeCompare(b.name));

    const { pinnedExtensionIds, hiddenExtensionIds } = await loadSettings();
    for (const it of filtered) {
      const row = document.createElement('div');
      row.className = 'pin-row';

      const img = document.createElement('img');
      img.src = (it.icons && it.icons.length) ? it.icons[it.icons.length-1].url : '';
      img.onerror = () => img.style.display = 'none';
      row.appendChild(img);

      const span = document.createElement('span');
      span.className = 'title';
      span.textContent = it.name || it.id;
      row.appendChild(span);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      // Pin button
      const pinBtn = document.createElement('button');
      pinBtn.className = 'rowIconBtn';
      pinBtn.dataset.role = 'pin';
      pinBtn.dataset.id = it.id;
      const pinImg = document.createElement('img');
      pinImg.alt = '';
      const isPinned = pinnedExtensionIds.includes(it.id);
      pinImg.src = isPinned ? 'icons/pin-filled.svg' : 'icons/pin.svg';
      if (!isPinned) pinBtn.classList.add('is-off');
      pinBtn.appendChild(pinImg);
      pinBtn.title = isPinned ? 'Unpin' : 'Pin';
      pinBtn.addEventListener('click', async () => {
        const curr = await getPinnedIdsSafe();
        const already = curr.includes(it.id);
        const next = already ? curr.filter(x => x !== it.id) : [it.id, ...curr.filter(x => x !== it.id)];
        suppressKey('pinnedExtensionIds');
        await chrome.storage.sync.set({ pinnedExtensionIds: next });
      });
      actions.appendChild(pinBtn);

      // Hide button
      const hideBtn = document.createElement('button');
      hideBtn.className = 'rowIconBtn';
      hideBtn.dataset.role = 'hide';
      hideBtn.dataset.id = it.id;
      const hideImg = document.createElement('img');
      hideImg.alt = '';
      const isHidden = hiddenExtensionIds.includes(it.id);
      hideImg.src = isHidden ? 'icons/eye-off.svg' : 'icons/eye.svg';
      if (!isHidden) hideBtn.classList.add('is-off');
      hideBtn.appendChild(hideImg);
      hideBtn.title = isHidden ? 'Unhide' : 'Hide';
      hideBtn.addEventListener('click', async () => {
        const curr = await getHiddenIdsSafe();
        const already = curr.includes(it.id);
        const next = already ? curr.filter(x => x !== it.id) : [it.id, ...curr.filter(x => x !== it.id)];
        suppressKey('hiddenExtensionIds');
        await chrome.storage.sync.set({ hiddenExtensionIds: next });
      });
      actions.appendChild(hideBtn);

      row.appendChild(actions);
      container.appendChild(row);
    }
    if (!filtered.length) container.textContent = 'No extensions found';
  } catch (e) {
    container.textContent = 'Failed to list extensions: ' + String(e);
  }
}

async function buildProfileList() {
  const container = $("profileList");
  container.innerHTML = '';
  const profiles = await getProfiles();
  for (const [name, state] of Object.entries(profiles)) {
    const row = document.createElement('div');
    row.className = 'profile-row';

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = name;
    row.appendChild(nameEl);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', async () => {
      try {
        await applyProfile(name);
        setStatus('Profile applied: ' + name);
      } catch (e) {
        setStatus('Failed to apply profile: ' + String(e));
      }
    });
    actions.appendChild(applyBtn);

    if (name !== DEFAULT_PROFILE_NAME) {
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Delete profile "${name}"?`)) {
          const profiles = await getProfiles();
          delete profiles[name];
          await setProfiles(profiles);
          await buildProfileList();
          setStatus('Profile deleted: ' + name);
        }
      });
      actions.appendChild(deleteBtn);
    }

    row.appendChild(actions);
    container.appendChild(row);
  }
  if (!Object.keys(profiles).length) container.textContent = 'No profiles saved';
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

async function populateForm() {
  const { popupSettings } = await loadSettings();
  $("popupSort").value = popupSettings.sort || 'name_asc';
  const onlySel = $("onlyPinnedVisibleSelect");
  if (onlySel) onlySel.value = popupSettings.onlyPinnedVisible ? 'yes' : 'no';
  await buildExtList();
  await loadProfilesIntoSelectOptions();
}

document.addEventListener('DOMContentLoaded', async () => {
  await ensureDefaultProfileExists();
  await populateForm();

  // Auto-save popup settings
  const debouncedSave = debounce(savePopupSettingsFromUI, 300);
  $("popupSort").addEventListener('change', savePopupSettingsFromUI);
  $("onlyPinnedVisibleSelect").addEventListener('change', savePopupSettingsFromUI);

  // Options filters
  const searchEl = $('optionsSearch');
  if (searchEl) {
    const debouncedFilter = debounce(async () => {
      optSearchTerm = (searchEl.value || '').trim();
      await buildExtList();
    }, 200);
    searchEl.addEventListener('input', debouncedFilter);
  }
  const hideEl = $('hideDisabledToggle');
  if (hideEl) {
    hideEl.addEventListener('change', async () => {
      optHideDisabled = !!hideEl.checked;
      await buildExtList();
    });
  }

  // Add profile
  const applyBtn = $('optApplyProfileBtn');
  const saveBtn = $('optSaveProfileBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      const sel = $('optProfileSelect');
      const name = sel && sel.value;
      if (!name) return;
      try {
        await applyProfile(name);
        setStatus('Profile applied: ' + name);
      } catch (e) {
        setStatus('Failed to apply profile: ' + String(e));
      }
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const name = prompt('Enter profile name:');
      if (!name || !name.trim()) return;
      try {
        await saveProfile(name.trim());
        await loadProfilesIntoSelectOptions(name.trim());
        setStatus('Profile saved: ' + name);
      } catch (e) {
        setStatus('Failed to save profile: ' + String(e));
      }
    });
  }

  // Add/Delete explicit buttons
  const addBtn = $('optAddProfileBtn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const name = prompt('Enter profile name:');
      if (!name || !name.trim()) return;
      try {
        await saveProfile(name.trim());
        await loadProfilesIntoSelectOptions(name.trim());
        setStatus('Profile added: ' + name);
      } catch (e) {
        setStatus('Failed to add profile: ' + String(e));
      }
    });
  }

  const delBtn = $('optDeleteProfileBtn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const sel = $('optProfileSelect');
      const name = sel && sel.value;
      if (!name || name === DEFAULT_PROFILE_NAME) return;
      if (!confirm(`Delete profile "${name}"?`)) return;
      try {
        const profiles = await getProfiles();
        delete profiles[name];
        await setProfiles(profiles);
        const next = profiles[DEFAULT_PROFILE_NAME] ? DEFAULT_PROFILE_NAME : '';
        await loadProfilesIntoSelectOptions(next);
        setStatus('Profile deleted: ' + name);
      } catch (e) {
        setStatus('Failed to delete profile: ' + String(e));
      }
    });
  }

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
      const container = $("extList");
      container.querySelectorAll('button.rowIconBtn[data-role="pin"]').forEach(btn => {
        const id = btn.dataset.id;
        const img = btn.querySelector('img');
        const on = ids.includes(id);
        if (img) img.src = on ? 'icons/pin-filled.svg' : 'icons/pin.svg';
        btn.classList.toggle('is-off', !on);
        btn.title = on ? 'Unpin' : 'Pin';
      });
    }
    if (changes.hiddenExtensionIds && !isSuppressed('hiddenExtensionIds')) {
      const ids = await getHiddenIdsSafe();
      const container = $("extList");
      container.querySelectorAll('button.rowIconBtn[data-role="hide"]').forEach(btn => {
        const id = btn.dataset.id;
        const img = btn.querySelector('img');
        const on = ids.includes(id);
        if (img) img.src = on ? 'icons/eye-off.svg' : 'icons/eye.svg';
        btn.classList.toggle('is-off', !on);
        btn.title = on ? 'Unhide' : 'Hide';
      });
    }
    if (changes.profiles) await loadProfilesIntoSelectOptions();
  });

  // React to extension enable/disable to keep filters accurate
  const onMgmt = async () => { await buildExtList(); };
  chrome.management.onEnabled.addListener(onMgmt);
  chrome.management.onDisabled.addListener(onMgmt);
});

// Populate the options page profile select similar to popup
async function loadProfilesIntoSelectOptions(preferName) {
  const select = $('optProfileSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Select Profile</option>';
  const profiles = await getProfiles();
  for (const name of Object.keys(profiles)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  if (preferName && profiles[preferName]) select.value = preferName;
  else if (profiles[DEFAULT_PROFILE_NAME] && !select.value) select.value = DEFAULT_PROFILE_NAME;
  // Update action state (disable delete on Default/blank)
  updateProfileActionStates();
}

function updateProfileActionStates() {
  const select = $('optProfileSelect');
  const delBtn = $('optDeleteProfileBtn');
  const name = select && select.value;
  if (delBtn) delBtn.disabled = !name || name === DEFAULT_PROFILE_NAME;
}

// Keep action state in sync when selection changes
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'optProfileSelect') updateProfileActionStates();
});