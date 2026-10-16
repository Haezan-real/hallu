//src/shared/panels/openPanel.ts
// The app's panel registry
import { useContext, useEffect, useRef } from 'react';
import { DockPanelContext } from '../dock/dockPanel';
import type { PanelKind } from './panelPolicies';
import { PanelRegistry, type PanelParams, type ToolPanelDefinition } from './panelRegistry';

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const panelRegistry = new PanelRegistry({ storage: localStorageOrNull() });

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
