//src/features/shaders/glassPanels.ts
import { useEffect, type RefObject } from 'react';

/** Corner radius in CSS pixels, shared by the panel element and the glass drawn behind it */
export const GLASS_RADIUS = 0;
export const MAX_GLASS_PANELS = 8;

/** A registered panel in canvas pixels, top-left origin */
export interface GlassRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

const panels = new Set<HTMLElement>();

/**
 * Has the shader background draw frosted glass behind the element. The element should be
 * transparent where the glass is meant to show; it gets the glass's rounded corners.
 */
export function registerGlassPanel(element: HTMLElement): () => void {
  panels.add(element);
  element.classList.add('glass-panel');
  element.style.borderRadius = `${GLASS_RADIUS}px`;
  return () => {
    panels.delete(element);
    element.classList.remove('glass-panel');
    element.style.borderRadius = '';
  };
}

export function useGlassPanel(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return registerGlassPanel(element);
  }, [ref]);
}

/** Where the registered panels sit on the canvas this frame; hidden or empty panels are skipped */
export function measureGlassPanels(canvas: HTMLCanvasElement): GlassRect[] {
  if (panels.size === 0) return [];
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return [];
  const scale = canvas.width / bounds.width;
  const rects: GlassRect[] = [];
  for (const element of panels) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    rects.push({
      x: (rect.left - bounds.left) * scale,
      y: (rect.top - bounds.top) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      radius: Math.min(GLASS_RADIUS * scale, rect.width * scale * 0.5, rect.height * scale * 0.5),
    });
    if (rects.length === MAX_GLASS_PANELS) break;
  }
  return rects;
}
