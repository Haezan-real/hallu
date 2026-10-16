//src/shared/dock/dockPanel.ts
import { createContext, useContext, useEffect } from 'react';

/** What a docked panel can change about its group header */
export interface DockPanelHandle {
  id: string;
  setTitle: (title: string) => void;
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

/** Shows a title in the panel's dock header, e.g. one that includes a count */
export function usePanelTitle(title: string) {
  const panel = useContext(DockPanelContext);
  useEffect(() => { panel?.setTitle(title); }, [panel, title]);
}
