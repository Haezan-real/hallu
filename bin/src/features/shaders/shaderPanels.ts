//src/features/shaders/shaderPanels.ts
import { useEffect, type RefObject } from 'react';

/** Mirrors MAX_PANELS in shaderPacks.cjs */
export const MAX_SHADER_PANELS = 8;

const panels = new Set<HTMLElement>();

/**
 * Tells the active shader pack where a UI panel is: packs read it as iPanels, and may draw
 * something different behind it (the cyberpunk pack draws glass). The element should be
 * transparent where the background is meant to show.
 */
export function registerShaderPanel(element: HTMLElement): () => void {
  panels.add(element);
  element.classList.add('shader-panel');
  return () => {
    panels.delete(element);
    element.classList.remove('shader-panel');
  };
}

export function useShaderPanel(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return registerShaderPanel(element);
  }, [ref]);
}

/**
 * The registered panels as (x, y, width, height) in canvas pixels from the bottom-left
 * corner, like fragCoord, packed four floats each. Hidden or empty panels are skipped.
 */
export function measureShaderPanels(canvas: HTMLCanvasElement, out: Float32Array): number {
  if (panels.size === 0) return 0;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return 0;
  const scale = canvas.width / bounds.width;
  let count = 0;
  for (const element of panels) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    out.set([
      (rect.left - bounds.left) * scale,
      (bounds.bottom - rect.bottom) * scale,
      rect.width * scale,
      rect.height * scale,
    ], count * 4);
    if (++count === MAX_SHADER_PANELS) break;
  }
  return count;
}
