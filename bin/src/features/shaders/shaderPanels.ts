//src/features/shaders/shaderPanels.ts
import { useEffect, type RefObject } from 'react';

/** Mirrors MAX_PANELS in shaderPacks.cjs */
export const MAX_SHADER_PANELS = 16;

/** The kind packs read from iPanelInfo[i].x; documented in shaderPacks.cjs, so keep the numbers stable */
export const SHADER_PANEL_KIND = {
  mediaPool: 0,
  viewer: 1,
  timeline: 2,
  timelineLabels: 3,
  tool: 4,
} as const;

export type ShaderPanelKind = typeof SHADER_PANEL_KIND[keyof typeof SHADER_PANEL_KIND];

/** Where a panel sits in the window stack: grid panels at depth 0, floating windows above in stacking order */
export interface ShaderPanelLayer {
  floating: boolean;
  depth: number;
}

interface ShaderPanel {
  element: HTMLElement;
  kind: ShaderPanelKind;
  /** Selector of an ancestor whose bounds are reported instead, e.g. a dock group with its header */
  frame?: string;
  layer: ShaderPanelLayer;
  /** How many other panels contain this one, so a column inside a panel comes after it */
  nesting: number;
}

const GRID_LAYER: ShaderPanelLayer = { floating: false, depth: 0 };

const panels: ShaderPanel[] = [];
let layerOf: (element: HTMLElement) => ShaderPanelLayer | undefined = () => undefined;

/** Recomputes every panel's layer and sorts them back to front */
export function refreshShaderPanelLayers() {
  for (const panel of panels) {
    panel.layer = layerOf(panel.element) ?? GRID_LAYER;
    panel.nesting = panels.filter((other) => other !== panel && other.element.contains(panel.element)).length;
  }
  panels.sort((a, b) => a.layer.depth - b.layer.depth || a.nesting - b.nesting);
}

/** Lets the dock say which window each panel is in; call refreshShaderPanelLayers when that changes */
export function setShaderPanelLayering(resolve: (element: HTMLElement) => ShaderPanelLayer | undefined) {
  layerOf = resolve;
  refreshShaderPanelLayers();
}

/**
 * Tells the active shader pack where a UI panel is: packs read it from iPanels with its kind in
 * iPanelInfo, and may draw something different behind it. The element should be transparent
 * where the background is meant to show.
 */
export function registerShaderPanel(element: HTMLElement, kind: ShaderPanelKind, frame?: string): () => void {
  const panel: ShaderPanel = { element, kind, frame, layer: GRID_LAYER, nesting: 0 };
  panels.push(panel);
  element.classList.add('shader-panel');
  refreshShaderPanelLayers();
  return () => {
    const index = panels.indexOf(panel);
    if (index >= 0) panels.splice(index, 1);
    element.classList.remove('shader-panel');
    refreshShaderPanelLayers();
  };
}

export function useShaderPanel(ref: RefObject<HTMLElement>, kind: ShaderPanelKind, frame?: string) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return registerShaderPanel(element, kind, frame);
  }, [ref, kind, frame]);
}

function panelBounds({ element, frame }: ShaderPanel, canvas: HTMLCanvasElement): DOMRect | null {
  // A panel popped out into another window isn't over this background
  if (element.ownerDocument !== canvas.ownerDocument) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const frameElement = frame ? element.closest(frame) : null;
  return frameElement ? frameElement.getBoundingClientRect() : rect;
}

/**
 * The shown panels back to front: rects as (x, y, width, height) in canvas pixels from the
 * bottom-left corner, like fragCoord, and info as (kind, floating, 0, 0), four values each.
 * Hidden panels are left out and the rest is zeros. Returns how many panels were written.
 */
export function measureShaderPanels(canvas: HTMLCanvasElement, rects: Float32Array, info: Int32Array): number {
  rects.fill(0);
  info.fill(0);
  if (panels.length === 0) return 0;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return 0;
  const scale = canvas.width / bounds.width;
  let count = 0;
  for (const panel of panels) {
    if (count >= MAX_SHADER_PANELS) break;
    const rect = panelBounds(panel, canvas);
    if (!rect) continue;
    rects.set([
      (rect.left - bounds.left) * scale,
      (bounds.bottom - rect.bottom) * scale,
      rect.width * scale,
      rect.height * scale,
    ], count * 4);
    info.set([panel.kind, panel.layer.floating ? 1 : 0, 0, 0], count * 4);
    count++;
  }
  return count;
}
