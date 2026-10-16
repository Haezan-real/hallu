//src/app/dock/dockFocus.ts
import type { DockviewApi } from 'dockview-react';

/** Clicking or tabbing into any part of a group, its header included, gives its panel the focus (keyRouter) */
export function initDockFocus(api: DockviewApi): () => void {
  const focusFrom = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const panel = api.groups.find(group => group.element.contains(target))?.activePanel;
    if (panel && api.activePanel !== panel) panel.api.setActive();
  };
  document.addEventListener('pointerdown', focusFrom, true);
  document.addEventListener('focusin', focusFrom);
  return () => {
    document.removeEventListener('pointerdown', focusFrom, true);
    document.removeEventListener('focusin', focusFrom);
  };
}
