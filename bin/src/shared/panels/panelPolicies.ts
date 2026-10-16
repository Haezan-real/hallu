//src/shared/panels/panelPolicies.ts
// What each tool panel (and each modal still opened through openModal) is allowed to do

export type PanelKind = 'settings' | 'styles' | 'export' | 'torusMenuEditor' | 'playneedleEditor' | 'colorPicker' | 'rollDialog';

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelPolicy {
  /** Counts as a menu: with "Allow open multiple menus" off, only one menu is open at a time */
  menu: boolean;
  /** Opening it again focuses the open one instead of adding another */
  singleton: boolean;
  /** Reopens on startup if it was open when Hallu closed; its params must survive JSON */
  restorable: boolean;
  /** Its floating window's size the first time it opens, in CSS pixels */
  defaultSize: PanelSize;
}

// The single source of truth; adding a PanelKind without a policy here is a compile-time error
export const PANEL_POLICIES: Record<PanelKind, PanelPolicy> = {
  settings: { menu: true, singleton: true, restorable: true, defaultSize: { width: 520, height: 600 } },
  styles: { menu: true, singleton: true, restorable: true, defaultSize: { width: 480, height: 640 } },
  export: { menu: true, singleton: true, restorable: false, defaultSize: { width: 480, height: 420 } },
  torusMenuEditor: { menu: true, singleton: true, restorable: false, defaultSize: { width: 620, height: 540 } },
  playneedleEditor: { menu: true, singleton: true, restorable: false, defaultSize: { width: 480, height: 560 } },
  colorPicker: { menu: false, singleton: false, restorable: false, defaultSize: { width: 300, height: 380 } },
  rollDialog: { menu: false, singleton: false, restorable: false, defaultSize: { width: 360, height: 200 } },
};

export const MULTIPLE_MENUS_DISABLED = '⚠ <br/>opening multiple menus is disabled';

export function isPanelKind(value: unknown): value is PanelKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PANEL_POLICIES, value);
}

/** Whether another `kind` may open next to the ones already open, modals and panels alike */
export function canOpenPanel(
  kind: PanelKind,
  openKinds: readonly PanelKind[],
  allowMultipleMenus: boolean,
): { allowed: boolean; reason?: string } {
  if (allowMultipleMenus || !PANEL_POLICIES[kind].menu) return { allowed: true };
  if (openKinds.some(open => PANEL_POLICIES[open].menu)) return { allowed: false, reason: MULTIPLE_MENUS_DISABLED };
  return { allowed: true };
}
