//src/shared/panels/openPanel.ts
// The app's panel registry, alongside openModal until every modal has moved into the dock
import { readSetting } from '../../modals/settings/settingsStore';
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

export function closeFocusedFloatingPanel(): boolean {
  return panelRegistry.closeFocusedFloating();
}
