const STORAGE_PREFIX = 'hallu.';

/**
 * Collects all hallu-related settings from localStorage into a plain object.
 * JSON-parses values where possible so user/settings.json stays clean and readable.
 */
export function exportStorageToSettingsObject(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    }
  } catch (error) {
    console.warn('Failed to export settings to object:', error);
  }
  return result;
}

/**
 * Loads a settings object from user/settings.json into localStorage.
 */
export function importSettingsObjectToStorage(data: Record<string, unknown>): void {
  try {
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'object' && val !== null) {
        window.localStorage.setItem(key, JSON.stringify(val));
      } else {
        window.localStorage.setItem(key, String(val));
      }
    }
  } catch (error) {
    console.warn('Failed to import settings from object:', error);
  }
}

let syncInitialized = false;

/**
 * Initializes transparent bi-directional synchronization between window.localStorage
 * and user/settings.json via Electron IPC.
 */
export async function initUserSettingsSync(): Promise<void> {
  if (syncInitialized) return;
  syncInitialized = true;

  const api = window.electronAPI;

  if (api?.loadUserSettings) {
    try {
      const savedData = await api.loadUserSettings();
      if (savedData && typeof savedData === 'object' && Object.keys(savedData).length > 0) {
        importSettingsObjectToStorage(savedData);
      } else {
        // If user/settings.json does not exist yet or is empty, seed it from existing localStorage
        const initialData = exportStorageToSettingsObject();
        if (Object.keys(initialData).length > 0) {
          api.saveUserSettings(initialData);
        }
      }
    } catch (err) {
      console.warn('Could not load user/settings.json:', err);
    }
  }

  // Intercept window.localStorage.setItem and removeItem to transparently trigger auto-save
  try {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
    const originalClear = window.localStorage.clear.bind(window.localStorage);

    window.localStorage.setItem = function (key: string, value: string): void {
      originalSetItem(key, value);
      if (key.startsWith(STORAGE_PREFIX) && window.electronAPI?.saveUserSettings) {
        window.electronAPI.saveUserSettings(exportStorageToSettingsObject());
      }
    };

    window.localStorage.removeItem = function (key: string): void {
      originalRemoveItem(key);
      if (key.startsWith(STORAGE_PREFIX) && window.electronAPI?.saveUserSettings) {
        window.electronAPI.saveUserSettings(exportStorageToSettingsObject());
      }
    };

    window.localStorage.clear = function (): void {
      originalClear();
      if (window.electronAPI?.saveUserSettings) {
        window.electronAPI.saveUserSettings(exportStorageToSettingsObject());
      }
    };
  } catch (err) {
    console.warn('Could not hook localStorage methods:', err);
  }

  // Ensure any pending save is flushed on window unload/close
  window.addEventListener('beforeunload', () => {
    if (window.electronAPI?.saveUserSettingsSync) {
      window.electronAPI.saveUserSettingsSync(exportStorageToSettingsObject());
    }
  });
}
