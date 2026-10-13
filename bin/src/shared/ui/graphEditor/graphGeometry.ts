import { evaluateSegment, type GraphPoint } from '../../lib/graph';

//src/shared/ui/graphEditor/graphGeometry.ts

export interface GraphConfig {
  width: number;
  height: number;
  padding: number;
  minTimeDelta: number;
}

const CURVE_SAMPLES_PER_SEGMENT = 30;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getGraphMetrics(config: GraphConfig, graphWidth: number) {
  const plotWidth = Math.max(0, graphWidth - config.padding * 2);
  const plotHeight = Math.max(0, config.height - config.padding * 2);
  return { plotWidth, plotHeight };
}

export function graphPointToSvg(config: GraphConfig, point: GraphPoint, graphWidth: number) {
  const { plotWidth, plotHeight } = getGraphMetrics(config, graphWidth);
  return {
    x: config.padding + point.time * plotWidth,
    y: config.padding + (1 - point.size) * plotHeight,
  };
}

export function graphCoordsFromEvent(config: GraphConfig, event: { clientX: number; clientY: number }, svg: SVGSVGElement | null, graphWidth: number) {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const { plotWidth, plotHeight } = getGraphMetrics(config, graphWidth);
  const x = clamp((event.clientX - rect.left - config.padding) / plotWidth, 0, 1);
  const y = clamp(1 - (event.clientY - rect.top - config.padding) / plotHeight, 0, 1);
  return { time: x, size: y };
}

// An easing handle sits on the segment's vertical midpoint and may move a quarter of the segment's height either way
export function segmentHandleRange(config: GraphConfig, pointA: GraphPoint, pointB: GraphPoint, graphWidth: number) {
  const a = graphPointToSvg(config, pointA, graphWidth);
  const b = graphPointToSvg(config, pointB, graphWidth);
  const mid = (a.y + b.y) / 2;
  const reach = Math.abs(a.y - b.y) / 4;
  return { mid, min: mid - reach, max: mid + reach };
}

// Converts a handle's SVG y position into the -1..1 easing value used by evaluateSegment
export function handleOffsetToValue(config: GraphConfig, pointA: GraphPoint, pointB: GraphPoint, graphWidth: number, offsetY: number | undefined): number {
  const { mid, min, max } = segmentHandleRange(config, pointA, pointB, graphWidth);
  const range = max - min;
  if (range <= 0) return 0;
  const direction = Math.sign(pointB.size - pointA.size);
  return clamp(-((offsetY ?? mid) - mid) * 2 / range * direction, -1, 1);
}

export function handleValueToOffset(config: GraphConfig, pointA: GraphPoint, pointB: GraphPoint, graphWidth: number, value: number): number {
  const { mid, min, max } = segmentHandleRange(config, pointA, pointB, graphWidth);
  const range = max - min;
  if (range <= 0) return mid;
  const direction = Math.sign(pointB.size - pointA.size);
  return clamp(mid - (value * range * direction) / 2, min, max);
}

export function handleValuesToOffsets(config: GraphConfig, sortedPoints: GraphPoint[], graphWidth: number, values: number[]): number[] {
  return values.map((value, index) => {
    const pointA = sortedPoints[index];
    const pointB = sortedPoints[index + 1];
    return pointA && pointB ? handleValueToOffset(config, pointA, pointB, graphWidth, value) : 0;
  });
}

export function buildSmoothCurvePath(config: GraphConfig, points: GraphPoint[], graphWidth: number, handleValues: number[]) {
  if (points.length === 0) return '';
  const start = graphPointToSvg(config, points[0], graphWidth);
  let d = `M ${start.x} ${start.y}`;
  for (let i = 1; i < points.length; i++) {
    const pointA = points[i - 1];
    const pointB = points[i];
    for (let s = 0; s <= CURVE_SAMPLES_PER_SEGMENT; s++) {
      const t = s / CURVE_SAMPLES_PER_SEGMENT;
      const svgPoint = graphPointToSvg(config, {
        time: pointA.time + (pointB.time - pointA.time) * t,
        size: pointA.size + (pointB.size - pointA.size) * evaluateSegment(t, handleValues[i - 1] ?? 0),
      }, graphWidth);
      d += ` L ${svgPoint.x} ${svgPoint.y}`;
    }
  }
  return d;
}
