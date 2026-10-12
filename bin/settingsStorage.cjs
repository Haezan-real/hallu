const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

const SETTINGS_PATH = path.join(__dirname, '..', 'user', 'settings.json');

let saveTimeout = null;
let pendingSaveData = null;

function ensureUserDirectory() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadUserSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('❌ Failed to read user/settings.json:', err);
  }
  return null;
}

function saveUserSettingsNow(data) {
  try {
    ensureUserDirectory();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to write user/settings.json:', err);
  }
}

function scheduleSaveUserSettings(data) {
  pendingSaveData = data;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    if (pendingSaveData) {
      saveUserSettingsNow(pendingSaveData);
      pendingSaveData = null;
    }
  }, 250);
}

function registerSettingsStorageHandlers() {
  ipcMain.handle('load-user-settings', () => {
    return loadUserSettings();
  });

  ipcMain.on('save-user-settings', (_event, data) => {
    if (data && typeof data === 'object') {
      scheduleSaveUserSettings(data);
    }
  });

  ipcMain.on('save-user-settings-sync', (_event, data) => {
    if (data && typeof data === 'object') {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      saveUserSettingsNow(data);
    }
  });
}

module.exports = {
  loadUserSettings,
  saveUserSettingsNow,
  scheduleSaveUserSettings,
  registerSettingsStorageHandlers,
  SETTINGS_PATH,
};
