//src/features/shaders/shaderOptIns.ts
// What the drawing shader pack has opted into painting itself; ShaderBackground sets it
import { useSyncExternalStore } from 'react';

let paintsMasterTitleBar = false;
const listeners = new Set<() => void>();

export function setShaderPaintsMasterTitleBar(value: boolean) {
  if (value === paintsMasterTitleBar) return;
  paintsMasterTitleBar = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the pack set "PaintHalluMasterTitleBar", so Hallu's title bar is transparent and in iPanels */
export function useShaderPaintsMasterTitleBar(): boolean {
  return useSyncExternalStore(subscribe, () => paintsMasterTitleBar);
}
