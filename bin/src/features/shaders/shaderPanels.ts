//src/features/shaders/shaderPanels.ts
import { useEffect, type RefObject } from 'react';

/** Mirrors MAX_PANELS in shaderPacks.cjs */
export const MAX_SHADER_PANELS = 8;

/** Which iPanels slot each panel fills; packs rely on these, so keep them in step with shaderPacks.cjs */
export const SHADER_PANEL = {
  mediaPool: 0,
  viewer: 1,
  timeline: 2,
  timelineLabels: 3,
} as const;

const panels = new Map<number, HTMLElement>();

/**
 * Tells the active shader pack where a UI panel is: packs read it as iPanels[slot], and may draw
 * something different behind it. The element should be transparent where the background is
 * meant to show.
 */
export function registerShaderPanel(element: HTMLElement, slot: number): () => void {
  panels.set(slot, element);
  element.classList.add('shader-panel');
  return () => {
    if (panels.get(slot) === element) panels.delete(slot);
    element.classList.remove('shader-panel');
  };
}

export function useShaderPanel(ref: RefObject<HTMLElement>, slot: number) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return registerShaderPanel(element, slot);
  }, [ref, slot]);
}

/**
 * The registered panels as (x, y, width, height) in canvas pixels from the bottom-left
 * corner, like fragCoord, packed four floats each at their slot. Slots with no panel, or a
 * hidden one, are all zeros. Returns one past the highest slot in use.
 */
export function measureShaderPanels(canvas: HTMLCanvasElement, out: Float32Array): number {
  out.fill(0);
  if (panels.size === 0) return 0;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return 0;
  const scale = canvas.width / bounds.width;
  let count = 0;
  for (const [slot, element] of panels) {
    if (slot >= MAX_SHADER_PANELS) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    out.set([
      (rect.left - bounds.left) * scale,
      (bounds.bottom - rect.bottom) * scale,
      rect.width * scale,
      rect.height * scale,
    ], slot * 4);
    count = Math.max(count, slot + 1);
  }
  return count;
}
