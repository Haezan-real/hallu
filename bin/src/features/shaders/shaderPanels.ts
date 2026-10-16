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

interface ShaderPanel {
  element: HTMLElement;
  /** Selector of an ancestor whose bounds are reported instead, e.g. a dock group with its header */
  frame?: string;
}

const panels = new Map<number, ShaderPanel>();

/**
 * Tells the active shader pack where a UI panel is: packs read it as iPanels[slot], and may draw
 * something different behind it. The element should be transparent where the background is
 * meant to show.
 */
export function registerShaderPanel(element: HTMLElement, slot: number, frame?: string): () => void {
  const panel = { element, frame };
  panels.set(slot, panel);
  element.classList.add('shader-panel');
  return () => {
    if (panels.get(slot) === panel) panels.delete(slot);
    element.classList.remove('shader-panel');
  };
}

export function useShaderPanel(ref: RefObject<HTMLElement>, slot: number, frame?: string) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return registerShaderPanel(element, slot, frame);
  }, [ref, slot, frame]);
}

function panelBounds({ element, frame }: ShaderPanel): DOMRect | null {
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const frameElement = frame ? element.closest(frame) : null;
  return frameElement ? frameElement.getBoundingClientRect() : rect;
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
  for (const [slot, panel] of panels) {
    if (slot >= MAX_SHADER_PANELS) continue;
    const rect = panelBounds(panel);
    if (!rect) continue;
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
