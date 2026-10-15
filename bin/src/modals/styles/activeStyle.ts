//src/modals/styles/activeStyle.ts
// The chosen style: its theme colors and its shader always switch together
import { DEFAULT_STYLE, loadStyleLibrary, resolveStyleId } from './styleLibrary';
import { applyThemeToDocument } from './themeColors';
import { applyStyleShader } from './styleShader';

const ACTIVE_STYLE_KEY = 'hallu.styles.active';

function getStoredStyle(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_STYLE_KEY);
  } catch {
    return null;
  }
}

export function getActiveStyle(): string {
  const stored = getStoredStyle();
  return (stored && resolveStyleId(stored)) || DEFAULT_STYLE;
}

function applyStyle(styleId: string, reload = false) {
  applyThemeToDocument(styleId);
  applyStyleShader(styleId, { reload });
}

// Saves the style choice and repaints the app with it
export function setActiveStyle(styleId: string) {
  try {
    window.localStorage.setItem(ACTIVE_STYLE_KEY, styleId);
  } catch {
    // Storage can be unavailable; the style still applies for this session
  }
  applyStyle(styleId);
}

/**
 * Applies the saved style at startup, once the library is loaded. Names saved by older
 * versions are upgraded to their current id; a style whose files are missing stays saved
 * so it comes back with them, and the default shows meanwhile.
 */
export function initActiveStyle() {
  const stored = getStoredStyle();
  const resolved = stored && resolveStyleId(stored);
  if (!stored) setActiveStyle(DEFAULT_STYLE);
  else if (resolved && resolved !== stored) setActiveStyle(resolved);
  else applyStyle(stored);
}

// Style files edited on disk show up immediately, recompiling the active style's shader
export function watchStyles(): () => void {
  const api = window.electronAPI;
  if (!api) return () => {};
  return api.onStylesChanged(() => {
    void loadStyleLibrary().then(() => applyStyle(getActiveStyle(), true));
  });
}
