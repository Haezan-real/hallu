//src/shared/panels/panelPolicies.ts
// What each tool panel is allowed to do

export type PanelKind = 'settings' | 'styles' | 'export' | 'torusMenuEditor' | 'playneedleEditor' | 'colorPicker';

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelPolicy {
  /** Reopens on startup if it was open when Hallu closed; its params must survive JSON */
  restorable: boolean;
  /** Its floating window's size the first time it opens, in CSS pixels */
  defaultSize: PanelSize;
}

// The single source of truth; adding a PanelKind without a policy here is a compile-time error
export const PANEL_POLICIES: Record<PanelKind, PanelPolicy> = {
  settings: { restorable: true, defaultSize: { width: 520, height: 600 } },
  styles: { restorable: true, defaultSize: { width: 480, height: 640 } },
  export: { restorable: false, defaultSize: { width: 400, height: 180 } },
  torusMenuEditor: { restorable: false, defaultSize: { width: 620, height: 540 } },
  playneedleEditor: { restorable: false, defaultSize: { width: 480, height: 560 } },
  colorPicker: { restorable: false, defaultSize: { width: 280, height: 420 } },
};

export function isPanelKind(value: unknown): value is PanelKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PANEL_POLICIES, value);
}
