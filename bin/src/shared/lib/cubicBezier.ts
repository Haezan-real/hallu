//src/shared/lib/cubicBezier.ts

export type Easing = (progress: number) => number;

const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 30;
const EPSILON = 1e-6;

// One axis of a bezier from (0,0) to (1,1) with control values a and b
const bezierAt = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
const bezierSlope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;

// Same curve as CSS cubic-bezier(x1, y1, x2, y2)
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  return progress => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    // Find the curve parameter whose x equals progress, then read its y
    let s = progress;
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const error = bezierAt(x1, x2, s) - progress;
      const slope = bezierSlope(x1, x2, s);
      if (Math.abs(error) < EPSILON || Math.abs(slope) < EPSILON) break;
      s -= error / slope;
    }
    if (s < 0 || s > 1 || Math.abs(bezierAt(x1, x2, s) - progress) > EPSILON) {
      let low = 0;
      let high = 1;
      for (let i = 0; i < BISECTION_ITERATIONS; i++) {
        s = (low + high) / 2;
        if (bezierAt(x1, x2, s) < progress) low = s;
        else high = s;
      }
    }
    return bezierAt(y1, y2, s);
  };
}

// Reads a CSS timing function value; only "linear" and cubic-bezier(...) are understood
export function parseCssEasing(value: string): Easing | null {
  const text = value.trim();
  if (text === 'linear') return progress => Math.min(1, Math.max(0, progress));
  const match = text.match(/^cubic-bezier\(\s*([^)]*)\)$/);
  if (!match) return null;
  const numbers = match[1].split(',').map(Number);
  if (numbers.length !== 4 || numbers.some(n => !Number.isFinite(n))) return null;
  const [x1, y1, x2, y2] = numbers;
  return cubicBezier(x1, y1, x2, y2);
}
