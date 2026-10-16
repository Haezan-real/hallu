//src/app/dock/dockLayout.ts
import type { DockviewApi, SerializedDockview } from 'dockview-react';
import { DEFAULT_LAYOUT } from '../../modals/settings/settingsDefaults';

/** Saved through userSettingsSync, so it ends up in user/settings.json */
const LAYOUT_KEY = 'hallu.layout.dock';
/** Sizes from the splitter layout, used once to size the first dock layout */
const LEGACY_LEFT_WIDTH_KEY = 'hallu.layout.leftWidthPct';
const LEGACY_TIMELINE_HEIGHT_KEY = 'hallu.layout.timelineHeightPct';
const SAVE_DELAY_MS = 400;

export const CORE_PANELS = {
  mediaPool: { id: 'mediaPool', title: 'Media Pool' },
  viewer: { id: 'viewer', title: 'Viewer' },
  timeline: { id: 'timeline', title: 'Timeline' },
} as const;

const CORE_PANEL_IDS: ReadonlySet<string> = new Set(Object.values(CORE_PANELS).map(panel => panel.id));

export function isCorePanel(id: string): boolean {
  return CORE_PANEL_IDS.has(id);
}

function readPercent(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  } catch {
    return fallback;
  }
}

function readSavedLayout(): SerializedDockview | null {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) as SerializedDockview : null;
  } catch {
    return null;
  }
}

function hasCorePanels(api: DockviewApi): boolean {
  return [...CORE_PANEL_IDS].every(id => api.getPanel(id) !== undefined);
}

/** Media pool on the left, viewer on the right, timeline across the bottom */
function buildDefaultLayout(api: DockviewApi, leftWidthPct: number, timelineHeightPct: number) {
  api.clear();
  const { mediaPool, viewer, timeline } = CORE_PANELS;
  const timelinePanel = api.addPanel({ ...timeline, component: timeline.id });
  const mediaPoolPanel = api.addPanel({
    ...mediaPool,
    component: mediaPool.id,
    position: { referencePanel: timelinePanel, direction: 'above' },
  });
  api.addPanel({
    ...viewer,
    component: viewer.id,
    position: { referencePanel: mediaPoolPanel, direction: 'right' },
  });
  // The splitter layout measured these against the window, so the same percentages give the same sizes
  timelinePanel.group.api.setSize({ height: window.innerHeight * timelineHeightPct / 100 });
  mediaPoolPanel.group.api.setSize({ width: window.innerWidth * leftWidthPct / 100 });
}

let activeApi: DockviewApi | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function saveLayout(api: DockviewApi) {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (!hasCorePanels(api)) return;
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(api.toJSON()));
    window.localStorage.removeItem(LEGACY_LEFT_WIDTH_KEY);
    window.localStorage.removeItem(LEGACY_TIMELINE_HEIGHT_KEY);
  } catch (error) {
    console.warn('Could not save the panel layout:', error);
  }
}

/** Restores the saved layout, or builds the default one; then saves every change */
export function initDockLayout(api: DockviewApi): () => void {
  activeApi = api;
  const saved = readSavedLayout();
  let restored = false;
  if (saved) {
    try {
      api.fromJSON(saved);
      restored = hasCorePanels(api);
    } catch (error) {
      console.warn('Could not restore the saved panel layout, using the default:', error);
    }
  }
  if (!restored) {
    buildDefaultLayout(
      api,
      readPercent(LEGACY_LEFT_WIDTH_KEY, DEFAULT_LAYOUT.leftWidthPct, 5, 50),
      readPercent(LEGACY_TIMELINE_HEIGHT_KEY, DEFAULT_LAYOUT.timelineHeightPct, 15, 60),
    );
    saveLayout(api);
  }

  const subscription = api.onDidLayoutChange(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLayout(api), SAVE_DELAY_MS);
  });
  const flush = () => { if (saveTimer !== undefined) saveLayout(api); };
  window.addEventListener('beforeunload', flush);

  return () => {
    flush();
    subscription.dispose();
    window.removeEventListener('beforeunload', flush);
    if (activeApi === api) activeApi = null;
  };
}

/** Puts every panel back where it starts on a fresh install */
export function resetLayout() {
  const api = activeApi;
  if (!api) return;
  buildDefaultLayout(api, DEFAULT_LAYOUT.leftWidthPct, DEFAULT_LAYOUT.timelineHeightPct);
  saveLayout(api);
}
