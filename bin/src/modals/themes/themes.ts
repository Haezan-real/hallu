//src/modals/themes/themes.ts
import { useSyncExternalStore } from 'react';
import type { ThemeLibrary, ThemeLibraryItem } from '../../shared/platform/electronApi';
import { colorFields, type ThemeColors } from './colorFields';

export const DEFAULT_THEME = 'default/og-dark';
const DEFAULT_FOLDER = 'default';
const ACTIVE_THEME_KEY = 'hallu.themes.activeTheme';

type ThemeItem = Extract<ThemeLibraryItem, { type: 'theme' }>;

let library: ThemeLibrary = { topLevel: [], items: {}, problems: [] };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getThemeLibrary(): ThemeLibrary {
  return library;
}

export function useThemeLibrary(): ThemeLibrary {
  return useSyncExternalStore(subscribe, getThemeLibrary);
}

// Reads user/themes through the main process; broken theme files are reported and skipped
export async function loadThemeLibrary() {
  const api = window.electronAPI;
  if (!api) return;
  library = await api.loadThemes();
  for (const problem of library.problems) console.warn(`Skipping theme ${problem.file}: ${problem.message}`);
  listeners.forEach(listener => listener());
}

// Theme files edited on disk show up immediately, repainting the app if the active theme changed
export function watchThemeLibrary(): () => void {
  const api = window.electronAPI;
  if (!api) return () => {};
  return api.onThemesChanged(() => {
    void loadThemeLibrary().then(() => applyThemeToDocument(getActiveTheme()));
  });
}

// Accepts ids like "default/cyberpunk", and bare names like "cyberpunk" saved before themes were files
export function resolveThemeId(themeId: string): string | null {
  if (library.items[themeId]?.type === 'theme') return themeId;
  if (library.items[`${DEFAULT_FOLDER}/${themeId}`]?.type === 'theme') return `${DEFAULT_FOLDER}/${themeId}`;
  const match = Object.values(library.items).find(item => item.type === 'theme' && item.id.split('/').pop() === themeId);
  return match?.id ?? null;
}

function findTheme(themeId: string): ThemeItem | undefined {
  const id = resolveThemeId(themeId);
  const item = id ? library.items[id] : undefined;
  return item?.type === 'theme' ? item : undefined;
}

// Colors a theme file leaves out come from the default theme; '' means the stylesheet's own default
export function getThemeColors(themeId: string): ThemeColors {
  const fallback = findTheme(DEFAULT_THEME);
  const theme = findTheme(themeId) ?? fallback;
  const colors = {} as ThemeColors;
  for (const { varName } of colorFields) colors[varName] = theme?.colors[varName] ?? fallback?.colors[varName] ?? '';
  return colors;
}

export function applyThemeToDocument(themeId: string) {
  const colors = getThemeColors(themeId);
  const rootStyle = document.documentElement.style;
  colorFields.forEach(({ varName }) => {
    if (colors[varName]) rootStyle.setProperty(varName, colors[varName]);
    else rootStyle.removeProperty(varName);
  });
}

export function getStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_THEME_KEY);
  } catch {
    return null;
  }
}

export function getActiveTheme(): string {
  const stored = getStoredTheme();
  return (stored && resolveThemeId(stored)) || DEFAULT_THEME;
}

// Saves the theme choice and repaints the app with it
export function setActiveTheme(themeId: string) {
  try {
    window.localStorage.setItem(ACTIVE_THEME_KEY, themeId);
  } catch {
    // Storage can be unavailable; the theme still applies for this session
  }
  applyThemeToDocument(themeId);
}
