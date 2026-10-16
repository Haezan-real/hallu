//src/shared/dock/PanelHeaderActions.tsx
import { useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DockPanelContext, getPanelActionsTarget, subscribeActionTargets } from './dockPanel';

/** Puts a panel's controls in its dock group header; rendered in place when not docked */
export default function PanelHeaderActions({ children }: { children: ReactNode }) {
  const panel = useContext(DockPanelContext);
  const getTarget = useCallback(() => (panel ? getPanelActionsTarget(panel.id) : null), [panel]);
  const target = useSyncExternalStore(subscribeActionTargets, getTarget);
  if (!panel) return <>{children}</>;
  return target ? createPortal(children, target) : null;
}
