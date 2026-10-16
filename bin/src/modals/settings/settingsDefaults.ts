export type ZoomEpicenter = 'playneedle' | 'middle' | 'cursor';
export type ViewerControlsType = 'compact' | 'centered';
export type TimecodePanel = 'timeline' | 'viewer' | 'both' | 'none';
export type TorusScrollingDisabled = 'whole torus menu' | 'annular sectors only' | 'none';

//src/modals/settings/settingsDefaults.ts

export interface SettingsValues {
  guiScale: number;
  zoomEpicenter: ZoomEpicenter;
  scrollSmooth: number;
  scrollAmount: number;
  scrollZoomAmount: number;
  scrollZoomSmoothness: number;
  cancelZoomOnScroll: boolean;
  viewerControlsType: ViewerControlsType;
  timecodePanel: TimecodePanel;
  torusScrollingDisabled: TorusScrollingDisabled;
  elevatedPanelDarken: number;
  elevatedPanelBlur: number;
  allowEditsWhenMenuOpen: boolean;
  playneedle_t: number;
  playneedle_j: number;
  playneedle_k: number;
  playneedle_s: number;
  playneedle_v_o: number;
  playneedle_h_b: number;
  playneedle_h_r: number;
  playneedle_width: number;
  playneedleIconHorizontalStretch: number;
  colorTransitionDuration: number;
  torusDuration: number;
  torusDelay: number;
  torusHoverScale: number;
}

export const DEFAULT_SETTINGS: SettingsValues = {
  guiScale: 100,
  zoomEpicenter: 'playneedle',
  scrollSmooth: 50,
  scrollAmount: 100,
  scrollZoomAmount: 25,
  scrollZoomSmoothness: 70,
  cancelZoomOnScroll: true,
  viewerControlsType: 'compact',
  timecodePanel: 'both',
  torusScrollingDisabled: 'none',
  elevatedPanelDarken: 50,
  elevatedPanelBlur: 0,
  allowEditsWhenMenuOpen: true,
  playneedle_t: 0.092,
  playneedle_j: 0.049,
  playneedle_k: 103,
  playneedle_s: 16.4,
  playneedle_v_o: 0.4,
  playneedle_h_b: 0.8,
  playneedle_h_r: 1,
  playneedle_width: 20,
  playneedleIconHorizontalStretch: 0.4,
  colorTransitionDuration: 0,
  torusDuration: 300,
  torusDelay: 0,
  torusHoverScale: 1.08,
};

export const DEFAULT_LAYOUT = {
  playheadTop: 15,
  leftWidthPct: 20,
  timelineHeightPct: 35,
};
