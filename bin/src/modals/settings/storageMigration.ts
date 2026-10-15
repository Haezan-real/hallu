const LEGACY_STORAGE_PREFIX = 'juicecut.';
const STORAGE_PREFIX = 'hallu.';

export function migrateLegacyStorage(): void {
  try {
    const legacyKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    ).filter((key): key is string => key?.startsWith(LEGACY_STORAGE_PREFIX) === true);

    for (const legacyKey of legacyKeys) {
      const currentKey = `${STORAGE_PREFIX}${legacyKey.slice(LEGACY_STORAGE_PREFIX.length)}`;
      const value = window.localStorage.getItem(legacyKey);
      if (value !== null && window.localStorage.getItem(currentKey) === null) {
        window.localStorage.setItem(currentKey, value);
      }
      window.localStorage.removeItem(legacyKey);
    }
  } catch (error) {
    console.warn('Could not migrate previous app settings to Hallu:', error);
  }
}

// Settings saved by the separate Themes and Shaders modals, which became the Styles modal
const RENAMED_KEYS: { from: string; to: string; convert?: (value: string) => string }[] = [
  { from: 'hallu.themes.activeTheme', to: 'hallu.styles.active' },
  { from: 'hallu.styles.activeTheme', to: 'hallu.styles.active' },
  {
    from: 'hallu.modal.themes.pageState',
    to: 'hallu.modal.styles.pageState',
    convert: value => {
      const { themePage, activeTheme, ...rest } = JSON.parse(value) as { themePage?: unknown; activeTheme?: unknown };
      return JSON.stringify({ ...rest, stylePage: themePage ?? null, activeStyle: activeTheme ?? null });
    },
  },
];

// The active style now decides the shader
const REMOVED_KEYS = ['hallu.shaders.active', 'hallu.modal.shaderSelector.pageState'];

// Must run after user/settings.json is imported, since the file can still hold the old keys
export function migrateRenamedKeys(): void {
  for (const { from, to, convert } of RENAMED_KEYS) {
    try {
      const value = window.localStorage.getItem(from);
      if (value === null) continue;
      if (window.localStorage.getItem(to) === null) window.localStorage.setItem(to, convert ? convert(value) : value);
      window.localStorage.removeItem(from);
    } catch (error) {
      console.warn(`Could not migrate the setting ${from}:`, error);
    }
  }
  try {
    REMOVED_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('Could not remove old settings:', error);
  }
}
