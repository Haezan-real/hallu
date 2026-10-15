import { afterEach, describe, expect, it } from 'vitest';
import { cubicBezier, parseCssEasing } from '../src/shared/lib/cubicBezier';
import { colorFields } from '../src/modals/themes/colorFields';
import { applyThemeToDocument } from '../src/modals/themes/themes';
import { THEME_FLOATS, ThemeColorFade, parseCssDuration, readThemeColors } from '../src/features/shaders/themeColorFade';
import { THEME_VARS } from '../shaderPacks.cjs';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const colorAt = (colors: Float32Array, varName: string) => {
  const index = colorFields.findIndex(field => field.varName === varName) * 4;
  return Array.from(colors.subarray(index, index + 3)).map(value => Math.round(value * 255));
};

describe('cubic-bezier easing', () => {
  it('matches the CSS curve endpoints and shape', () => {
    const ease = cubicBezier(0.4, 0, 0.2, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.5);
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 5);
  });

  it('parses CSS timing functions', () => {
    expect(parseCssEasing(' cubic-bezier(0.4, 0, 0.2, 1) ')?.(0.5)).toBeCloseTo(cubicBezier(0.4, 0, 0.2, 1)(0.5), 6);
    expect(parseCssEasing('linear')?.(0.25)).toBe(0.25);
    expect(parseCssEasing('ease-in-out')).toBeNull();
  });
});

describe('theme colors for shaders', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('lists theme colors in the same order as the shader boilerplate', () => {
    expect(colorFields.map(field => field.varName)).toEqual(THEME_VARS);
  });

  it('reads CSS colors as exact 0-1 sRGB values', () => {
    const colors = readThemeColors({ getPropertyValue: name => (name === '--border' ? ' #FF00C8' : 'rgb(10, 20, 30)') });
    expect(colors).toHaveLength(THEME_FLOATS);
    expect(colorAt(colors, '--border')).toEqual([255, 0, 200]);
    expect(colorAt(colors, '--bg-base')).toEqual([10, 20, 30]);
  });

  it('parses transition durations', () => {
    expect(parseCssDuration('300ms')).toBe(300);
    expect(parseCssDuration('0.5s')).toBe(500);
    expect(parseCssDuration('0ms')).toBe(0);
  });

  it('fades to a new theme over the UI transition duration, and follows manual edits', async () => {
    const root = document.documentElement;
    applyThemeToDocument('cyberpunk');
    root.style.setProperty('--theme-transition-duration', '1000ms');
    root.style.setProperty('--theme-transition-timing', 'linear');
    const fade = new ThemeColorFade(root);
    expect(colorAt(fade.sample(performance.now()), '--border')).toEqual([255, 0, 200]);

    const start = performance.now();
    root.style.setProperty('--border', '#000000');
    await flush();
    const middle = colorAt(fade.sample(start + 500), '--border');
    expect(middle[0]).toBeGreaterThan(100);
    expect(middle[0]).toBeLessThan(155);
    expect(colorAt(fade.sample(start + 2000), '--border')).toEqual([0, 0, 0]);

    root.style.setProperty('--theme-transition-duration', '0ms');
    applyThemeToDocument('forest');
    await flush();
    expect(colorAt(fade.sample(performance.now()), '--bg-base')).toEqual([15, 38, 30]);
    fade.disconnect();
  });
});
