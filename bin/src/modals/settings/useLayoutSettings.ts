import { useEffect, useState } from 'react';
import { SETTINGS_CHANGED_EVENT, getSettingsChangedDetail } from './settingsEvents';
import { DEFAULT_LAYOUT } from './settingsDefaults';

//src/modals/settings/useLayoutSettings.ts

function readNumber(key: string, fallback: number, min?: number, max?: number): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    if (!Number.isFinite(value)) return fallback;
    if (min !== undefined && value < min) return fallback;
    if (max !== undefined && value > max) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

export function useLayoutSettings() {
  const [playheadTop, setPlayheadTop] = useState(() => {
    const stored = readNumber('hallu.settings.playheadTopPercent', DEFAULT_LAYOUT.playheadTop, 0, 100);
    if (stored !== DEFAULT_LAYOUT.playheadTop) return stored;
    return readNumber('hallu.settings.playheadTop', DEFAULT_LAYOUT.playheadTop, 0, 100);
  });

  useEffect(() => {
    try { window.localStorage.setItem('hallu.settings.playheadTopPercent', String(playheadTop)); } catch {}
  }, [playheadTop]);

  useEffect(() => {
    const handleSettingsChange = (event: Event) => {
      const detail = getSettingsChangedDetail(event);
      if (!detail) return;
      if (detail.key === 'playheadTopPercent' && typeof detail.value === 'number') {
        setPlayheadTop(Math.max(0, Math.min(100, detail.value)));
      }
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChange);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChange);
  }, []);

  return { playheadTop, setPlayheadTop };
}
