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
