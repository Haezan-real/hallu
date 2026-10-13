//src/features/torus/torusSettings.ts
import type { GraphPoint } from '../../shared/lib/graph';

const SIZE_GRAPH_KEY = 'hallu.settings.torusSizeGraph';
const SEGMENT_HANDLES_KEY = 'hallu.settings.torusSegmentHandleValues';

export const DEFAULT_TORUS_SIZE_GRAPH: GraphPoint[] = [
  { time: 0, size: 0 },
  { time: 0.75, size: 1 },
  { time: 1, size: 1 },
];

export function getSavedSizeGraph(): GraphPoint[] {
  try {
    const raw = window.localStorage.getItem(SIZE_GRAPH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const points = parsed
          .map((item: Partial<GraphPoint> | null) => ({ time: Number(item?.time), size: Number(item?.size) }))
          .filter(p => !Number.isNaN(p.time) && !Number.isNaN(p.size));
        if (points.length >= 2) {
          const sorted = points.sort((a, b) => a.time - b.time);
          return [
            { time: 0, size: 0 },
            ...sorted.filter(p => p.time > 0 && p.time < 1),
            { time: 1, size: 1 },
          ];
        }
      }
    }
  } catch {}
  return DEFAULT_TORUS_SIZE_GRAPH;
}

export function saveSizeGraph(graph: GraphPoint[]): void {
  try { window.localStorage.setItem(SIZE_GRAPH_KEY, JSON.stringify(graph)); } catch {}
}

export function getSavedSegmentHandleValues(): number[] {
  try {
    const raw = window.localStorage.getItem(SEGMENT_HANDLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v: unknown) => Number(v)).filter((n: number) => !Number.isNaN(n));
      }
    }
  } catch {}
  return [];
}

export function saveSegmentHandleValues(values: number[]): void {
  try { window.localStorage.setItem(SEGMENT_HANDLES_KEY, JSON.stringify(values)); } catch {}
}
