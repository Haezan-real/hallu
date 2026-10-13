//src/features/playneedle/playneedleFormula.ts

export interface PlayneedleParams {
  t: number;   // thickness of needle (0 to 0.5)
  j: number;   // length of ribbon at top (-0.05 to 0.25)
  k: number;   // falloff of ribbon (10 to 1000)
  s: number;   // vertical height of button (10 to 50)
  v_o: number; // vertical offset of button (0 to 1)
  h_b: number; // horizontal width of button (0.5 to 1)
  h_r: number; // horizontal width of ribbon (0 to 1)
}

/**
 * f(x) = h_r * (1 / (1 + e^(k*(x-j)))) * (1-t) + t
 *        + h_b * (1-t) * sin(s * (x - v_o * (1 - π/s)))^2
 *        * ceil(-0.1 * (x - v_o * (1 - π/s)) * ((x - v_o * (1 - π/s)) - π/s))
 *
 * Domain: x in [0, 1] (top to bottom of playneedle)
 * Range: f(x) in [0, 1] (width as fraction of total width)
 */
export function playneedleWidthAt(x: number, p: PlayneedleParams): number {
  const { t, j, k, s, v_o, h_b, h_r } = p;

  // Ribbon component: h_r * sigmoid * (1-t) + t
  const sigmoid = 1.0 / (1.0 + Math.exp(k * (x - j)));
  const ribbon = h_r * sigmoid * (1.0 - t) + t;

  // Button component
  const buttonStart = v_o * (1.0 - Math.PI / s);
  const buttonSin = Math.sin(s * (x - buttonStart));
  const buttonShape = buttonSin * buttonSin;

  // Button window: ceil(-0.1 * (x - buttonStart) * ((x - buttonStart) - π/s))
  const dx = x - buttonStart;
  const buttonWindow = Math.ceil(-0.1 * dx * (dx - Math.PI / s));

  const button = h_b * (1.0 - t) * buttonShape * buttonWindow;

  return ribbon + button;
}

/** Vertical center of the button, as a fraction of the needle height. */
export function playneedleButtonCenter({ v_o, s }: Pick<PlayneedleParams, 'v_o' | 's'>): number {
  return v_o * (1 - Math.PI / s) + Math.PI / (2 * s);
}

/** Closed SVG outline of the needle: down the left edge, back up the right edge. */
export function playneedlePath(params: PlayneedleParams, height: number, maxWidth: number, steps = 200): string {
  const halfMaxW = maxWidth / 2;
  const left: string[] = [];
  const right: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const y = x * height;
    const halfWidth = playneedleWidthAt(x, params) * halfMaxW;
    left.push(`${halfMaxW - halfWidth} ${y}`);
    right.push(`${halfMaxW + halfWidth} ${y}`);
  }

  return `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`;
}
