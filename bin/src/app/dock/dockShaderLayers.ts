//src/app/dock/dockShaderLayers.ts
import type { DockviewApi } from 'dockview-react';
import { refreshShaderPanelLayers, setShaderPanelLayering, type ShaderPanelLayer } from '../../features/shaders/shaderPanels';
import { registerShaderMirror } from '../../features/shaders/shaderMirrors';

/** dockview's floating window; it keeps the windows' stacking order in aria-level */
const FLOATING_WINDOW = '.dv-resize-container';

function dockLayer(element: HTMLElement): ShaderPanelLayer {
  const floatingWindow = element.closest(FLOATING_WINDOW);
  if (!floatingWindow) return { floating: false, depth: 0 };
  return { floating: true, depth: 1 + (Number(floatingWindow.getAttribute('aria-level')) || 0) };
}

/**
 * Keeps the shader panels' back-to-front order in step with the dock, and backs every floating
 * window with a mirror of the shader background so it covers the panels beneath it. Returns a
 * dispose function.
 */
export function initDockShaderLayers(api: DockviewApi): () => void {
  setShaderPanelLayering(dockLayer);
  const mirrors = new Map<Element, () => void>();

  const syncMirrors = () => {
    const windows = new Set<Element>();
    for (const group of api.groups) {
      const floatingWindow = group.element.closest(FLOATING_WINDOW);
      if (floatingWindow) windows.add(floatingWindow);
    }
    for (const [floatingWindow, remove] of mirrors) {
      if (windows.has(floatingWindow) && floatingWindow.isConnected) continue;
      remove();
      mirrors.delete(floatingWindow);
    }
    for (const floatingWindow of windows) {
      if (mirrors.has(floatingWindow)) continue;
      const canvas = document.createElement('canvas');
      canvas.className = 'dock-shader-mirror';
      floatingWindow.prepend(canvas);
      const unregister = registerShaderMirror(canvas);
      mirrors.set(floatingWindow, () => {
        unregister();
        canvas.remove();
      });
    }
  };

  // dockview restacks floating windows in its own listeners, so read the order after them
  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      syncMirrors();
      refreshShaderPanelLayers();
    });
  };
  refresh();
  const subscriptions = [
    api.onDidLayoutChange(refresh),
    api.onDidActiveGroupChange(refresh),
    api.onDidActivePanelChange(refresh),
  ];
  return () => {
    for (const subscription of subscriptions) subscription.dispose();
    for (const remove of mirrors.values()) remove();
    mirrors.clear();
  };
}
