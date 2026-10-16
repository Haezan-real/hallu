//src/shared/dock/dockPanel.ts
import { createContext } from 'react';

/** The docked panel a component is rendered in */
export interface DockPanelHandle {
  id: string;
}

export const DockPanelContext = createContext<DockPanelHandle | null>(null);

// Each group header offers a slot for the controls of the panel it is showing
const actionTargets = new Map<string, HTMLElement>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

export function subscribeActionTargets(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPanelActionsTarget(panelId: string): HTMLElement | null {
  return actionTargets.get(panelId) ?? null;
}

export function registerPanelActionsTarget(panelId: string, element: HTMLElement): () => void {
  actionTargets.set(panelId, element);
  notify();
  return () => {
    if (actionTargets.get(panelId) !== element) return;
    actionTargets.delete(panelId);
    notify();
  };
}