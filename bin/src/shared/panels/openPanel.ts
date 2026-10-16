//src/shared/panels/openPanel.ts
// The app's panel registry, alongside openModal until every modal has moved into the dock
import { useContext, useEffect, useRef } from 'react';
import { readSetting } from '../../modals/settings/settingsStore';
import { DockPanelContext } from '../dock/dockPanel';
import { modalManager } from '../modals/modalManager';
import { showToast } from '../ui/Toast';
import type { PanelKind } from './panelPolicies';
import { PanelRegistry, type PanelParams, type ToolPanelDefinition } from './panelRegistry';

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const panelRegistry = new PanelRegistry({
  storage: localStorageOrNull(),
  allowMultipleMenus: () => readSetting('allowMultipleMenus'),
  openModalKinds: () => modalManager.openKinds(),
  notify: reason => showToast(reason),
});
modalManager.setOpenPanelsSource(() => panelRegistry.openKinds());

export function defineToolPanel<P extends PanelParams>(kind: PanelKind, definition: ToolPanelDefinition<P>) {
  panelRegistry.define(kind, definition);
}

export function openPanel<P extends PanelParams>(kind: PanelKind, params?: P): string | null {
  return panelRegistry.openPanel(kind, params);
}

export function closePanel(kindOrId: PanelKind | string): boolean {
  return panelRegistry.closePanel(kindOrId);
}

export function isPanelOpen(kind: PanelKind): boolean {
  return panelRegistry.isPanelOpen(kind);
}

/** Opens a tool from inside the panel `from`: alongside it, or in its place while only one menu may be open */
export function openPanelFrom<P extends PanelParams>(from: string, kind: PanelKind, params?: P): string | null {
  if (!readSetting('allowMultipleMenus')) closePanel(from);
  return openPanel(kind, params);
}

/** Whether the dock's focus is on a tool of this kind */
export function isPanelFocused(kind: PanelKind): boolean {
  return panelRegistry.focusedPanel()?.kind === kind;
}

export function closeFocusedFloatingPanel(): boolean {
  return panelRegistry.closeFocusedFloating();
}

/** Lets the exit shortcut step back inside the tool panel this renders in; return false to let it close */
export function usePanelBack(back: () => boolean) {
  const panel = useContext(DockPanelContext);
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    if (!panel) return;
    return panelRegistry.setBackHandler(panel.id, () => backRef.current());
  }, [panel]);
}
