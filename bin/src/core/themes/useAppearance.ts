import { useEffect } from 'react';
import { applyThemeToDocument } from '../../modals/Styles';
import { DEFAULT_SETTINGS } from '../settings/settingsDefaults';
import { SETTINGS_CHANGED_EVENT, getSettingsChangedDetail } from '../settings/settingsEvents';

//src/core/themes/useAppearance.ts

const DEFAULT_THEME = 'og-dark';
const MAX_OVERLAY_BLUR = 50; //px, blur at 100%

// 0-50% fades a white overlay out, 50-100% fades a black overlay in
function applyOverlayDarken(pct: number) {
  const overlayColor = pct <= 50
    ? `rgba(255,255,255,${(1 - pct / 50).toFixed(3)})`
    : `rgba(0,0,0,${((pct - 50) / 50).toFixed(3)})`;
  document.documentElement.style.setProperty('--modal-overlay-bg', overlayColor);
}

function applyOverlayBlur(pct: number) {
  document.documentElement.style.setProperty('--modal-overlay-blur', `${(pct / 100) * MAX_OVERLAY_BLUR}px`);
}

function readStoredPercent(key: string): number | null {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    const pct = Number(value);
    return !Number.isNaN(pct) && pct >= 0 && pct <= 100 ? pct : null;
  } catch {
    return null;
  }
}

// Applies the saved theme, GUI scale and modal overlay look, and keeps the overlay in sync with Settings
export function useAppearance() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('hallu.styles.activeTheme');
      if (!saved) window.localStorage.setItem('hallu.styles.activeTheme', DEFAULT_THEME);
      applyThemeToDocument(saved || DEFAULT_THEME);
    } catch {}

    try {
      const v = window.localStorage.getItem('hallu.settings.guiScale');
      const scale = v ? Number(v) / 100 : DEFAULT_SETTINGS.guiScale / 100;
      document.documentElement.style.setProperty('--gui-scale', scale.toString());
    } catch {}

    const darken = readStoredPercent('hallu.settings.elevatedPanelDarkenAmount');
    if (darken !== null) applyOverlayDarken(darken);
    const blur = readStoredPercent('hallu.settings.elevatedPanelBlurAmount');
    if (blur !== null) applyOverlayBlur(blur);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = getSettingsChangedDetail(e);
      if (typeof detail?.value !== 'number') return;
      if (detail.key === 'elevatedPanelDarken') applyOverlayDarken(detail.value);
      if (detail.key === 'elevatedPanelBlur') applyOverlayBlur(detail.value);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);
}
