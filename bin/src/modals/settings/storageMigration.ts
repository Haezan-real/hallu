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

// Settings saved before the Styles modal was renamed to Themes
const RENAMED_KEYS: { from: string; to: string; convert?: (value: string) => string }[] = [
  { from: 'hallu.styles.activeTheme', to: 'hallu.themes.activeTheme' },
  {
    from: 'hallu.modal.styles.pageState',
    to: 'hallu.modal.themes.pageState',
    convert: value => {
      const { stylePage, ...rest } = JSON.parse(value) as { stylePage?: unknown };
      return JSON.stringify({ ...rest, themePage: stylePage ?? null });
    },
  },
];

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
}
