//src/features/shaders/themeColorFade.ts
import { colorFields } from '../../modals/themes/colorFields';
import { hexToRgb, toHexColor } from '../../shared/lib/color';
import { cubicBezier, parseCssEasing, type Easing } from '../../shared/lib/cubicBezier';

// One vec4 per theme color, in colorFields order (HalluTheme in shaderPacks.cjs uses the same order)
export const THEME_FLOATS = colorFields.length * 4;
const DEFAULT_EASING = cubicBezier(0.4, 0, 0.2, 1);

type StyleSource = Pick<CSSStyleDeclaration, 'getPropertyValue'>;

// sRGB values in 0-1, so a shader writing them out reproduces the CSS color exactly
export function readThemeColors(style: StyleSource): Float32Array {
  const colors = new Float32Array(THEME_FLOATS);
  colorFields.forEach((field, index) => {
    const { r, g, b } = hexToRgb(toHexColor(style.getPropertyValue(field.varName)));
    colors.set([r / 255, g / 255, b / 255, 1], index * 4);
  });
  return colors;
}

// "300ms" / "0.3s" -> milliseconds
export function parseCssDuration(value: string): number {
  const text = value.trim();
  const amount = Number.parseFloat(text);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return text.endsWith('ms') ? amount : text.endsWith('s') ? amount * 1000 : amount;
}

/**
 * Follows the theme's CSS color variables on <html> (theme switches and manual color edits)
 * and fades to new colors with the same duration and easing as the UI's theme transition.
 */
export class ThemeColorFade {
  private from: Float32Array;
  private to: Float32Array;
  private current: Float32Array;
  private startTime = 0;
  private duration = 0;
  private easing: Easing = DEFAULT_EASING;
  private observer: MutationObserver;

  constructor(private root: HTMLElement = document.documentElement) {
    this.to = readThemeColors(getComputedStyle(root));
    this.from = this.to.slice();
    this.current = this.to.slice();
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(root, { attributes: true, attributeFilter: ['style'] });
  }

  disconnect() {
    this.observer.disconnect();
  }

  /** The colors as they should look at `now` (a performance.now() timestamp). */
  sample(now: number): Float32Array {
    const progress = this.duration > 0 ? Math.min(1, Math.max(0, (now - this.startTime) / this.duration)) : 1;
    const eased = this.easing(progress);
    for (let i = 0; i < THEME_FLOATS; i++) this.current[i] = this.from[i] + (this.to[i] - this.from[i]) * eased;
    return this.current;
  }

  private refresh() {
    const style = getComputedStyle(this.root);
    const next = readThemeColors(style);
    if (next.every((value, index) => value === this.to[index])) return;
    // Start from wherever an unfinished fade currently is, like a CSS transition does
    const now = performance.now();
    this.from = this.sample(now).slice();
    this.to = next;
    this.startTime = now;
    this.duration = parseCssDuration(style.getPropertyValue('--theme-transition-duration'));
    this.easing = parseCssEasing(style.getPropertyValue('--theme-transition-timing')) ?? DEFAULT_EASING;
  }
}
