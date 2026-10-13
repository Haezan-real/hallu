//src/modals/themes/themes.ts
import { colorFields, type ThemeColors } from './colorFields';
import { themesByName } from './themePalettes';

export const DEFAULT_THEME = 'og-dark';
const ACTIVE_THEME_KEY = 'hallu.styles.activeTheme';

export function getThemeColors(themeName: string): ThemeColors {
  return themesByName[themeName] ?? themesByName[DEFAULT_THEME];
}

export function applyThemeToDocument(themeName: string) {
  const themeColors = getThemeColors(themeName);
  colorFields.forEach(c => { document.documentElement.style.setProperty(c.varName, themeColors[c.varName]); });
}

export function getStoredTheme(): string | null {
  try { return window.localStorage.getItem(ACTIVE_THEME_KEY); } catch { return null; }
}

export function getActiveTheme(): string {
  return getStoredTheme() || DEFAULT_THEME;
}

// Saves the theme choice and repaints the app with it
export function setActiveTheme(themeName: string) {
  try { window.localStorage.setItem(ACTIVE_THEME_KEY, themeName); } catch {}
  applyThemeToDocument(themeName);
}
