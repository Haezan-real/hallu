import { useEffect, useState } from 'react';
import { SETTINGS_CHANGED_EVENT, getSettingsChangedDetail } from '../state/settingsEvents';
import { DEFAULT_LAYOUT, DEFAULT_SETTINGS } from '../state/settingsDefaults';

//src/hooks/useLayoutSettings.ts

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

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
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
  const [includeResizeInUndo, setIncludeResizeInUndo] = useState(() =>
    readBoolean('hallu.settings.includeResizeInUndo', DEFAULT_SETTINGS.includeResizeInUndo),
  );
  const [leftWidthPct, setLeftWidthPct] = useState(() =>
    readNumber('hallu.layout.leftWidthPct', DEFAULT_LAYOUT.leftWidthPct, 5, 50),
  );
  const [leftCollapsed] = useState(() =>
    readBoolean('hallu.layout.leftCollapsed', DEFAULT_LAYOUT.leftCollapsed),
  );
  const [timelineHeightPct, setTimelineHeightPct] = useState(() =>
    readNumber('hallu.layout.timelineHeightPct', DEFAULT_LAYOUT.timelineHeightPct, 15, 60),
  );
  const [, setGuiScale] = useState(() => readNumber('hallu.settings.guiScale', DEFAULT_SETTINGS.guiScale, 50, 200));

  useEffect(() => {
    try { window.localStorage.setItem('hallu.layout.leftCollapsed', String(leftCollapsed)); } catch {}
  }, [leftCollapsed]);

  useEffect(() => {
    try { window.localStorage.setItem('hallu.layout.leftWidthPct', String(leftWidthPct)); } catch {}
  }, [leftWidthPct]);

  useEffect(() => {
    try { window.localStorage.setItem('hallu.layout.timelineHeightPct', String(timelineHeightPct)); } catch {}
  }, [timelineHeightPct]);

  useEffect(() => {
    try { window.localStorage.setItem('hallu.settings.playheadTopPercent', String(playheadTop)); } catch {}
  }, [playheadTop]);

  useEffect(() => {
    try { window.localStorage.setItem('hallu.settings.includeResizeInUndo', String(includeResizeInUndo)); } catch {}
  }, [includeResizeInUndo]);

  useEffect(() => {
    const handleSettingsChange = (event: Event) => {
      const detail = getSettingsChangedDetail(event);
      if (!detail) return;
      if (detail.key === 'playheadTopPercent' && typeof detail.value === 'number') {
        setPlayheadTop(Math.max(0, Math.min(100, detail.value)));
      }
      if (detail.key === 'guiScale' && typeof detail.value === 'number') {
        setGuiScale(detail.value);
      }
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChange);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChange);
  }, []);

  return {
    playheadTop,
    setPlayheadTop,
    includeResizeInUndo,
    setIncludeResizeInUndo,
    leftWidthPct,
    setLeftWidthPct,
    leftCollapsed,
    timelineHeightPct,
    setTimelineHeightPct,
  };
}
