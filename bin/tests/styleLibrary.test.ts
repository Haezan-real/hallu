import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THEME_VARS, compileIconShader, findIcon, readIconImage, readStyleLibrary, validateTheme } from '../styleLibrary.cjs';
import { loadStyleLibrary, resolveStyleId } from '../src/modals/styles/styleLibrary';
import { getThemeColors } from '../src/modals/styles/themeColors';
import type { ElectronAPI } from '../src/shared/platform/electronApi';

const BUILT_IN_THEMES = ['aquatic', 'forest', 'lavender', 'monokai', 'oak', 'og-dark', 'og-light'];
const BUILT_IN_PACKS = ['cyberpunk', 'hallu_feature_demo'];
const MANIFEST = { language: 'glsl', surfaces: { background: 'image.frag' } };

describe('style files', () => {
  let root: string;
  const write = (file: string, contents: unknown) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof contents === 'string' ? contents : JSON.stringify(contents));
  };
  const readJsonFile = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'hallu-styles-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('validates names and colors', () => {
    expect(validateTheme({ colors: { '--border': '#abc' } }, 'file')).toEqual({ name: 'file', colors: { '--border': '#abc' } });
    expect(validateTheme({ name: ' Neon ', colors: {} }, 'file').name).toBe('Neon');
    expect(() => validateTheme([], 'file')).toThrow('object');
    expect(() => validateTheme({ name: 3, colors: {} }, 'file')).toThrow('"name"');
    expect(() => validateTheme({}, 'file')).toThrow('"colors"');
    expect(() => validateTheme({ colors: { '--nope': '#000' } }, 'file')).toThrow('unknown color "--nope"');
    expect(() => validateTheme({ colors: { '--border': 'red' } }, 'file')).toThrow('"--border" must be a hex color');
  });

  it('mirrors the folder tree, folders first and sorted by label', () => {
    write('b.json', { name: 'Zeta', colors: {} });
    write('a.json', { colors: {} });
    write('pack/inner/deep.json', { colors: { '--border': '#123456' } });
    write('pack/top.json', { colors: {} });
    write('.hidden/skip.json', { colors: {} });
    write('notes.txt', 'ignored');

    const library = readStyleLibrary(root);
    expect(library.topLevel).toEqual(['pack', 'a', 'b']);
    expect(library.items.pack).toEqual({ id: 'pack', label: 'pack', type: 'folder', parent: null, children: ['pack/inner', 'pack/top'] });
    expect(library.items['pack/inner/deep']).toEqual({
      id: 'pack/inner/deep', label: 'deep', type: 'style', parent: 'pack/inner', colors: { '--border': '#123456' }, icon: null, shader: null,
    });
    expect(library.items.b).toMatchObject({ label: 'Zeta', parent: null });
    expect(library.problems).toEqual([]);
  });

  it('turns folders with a manifest into shader pack styles, sorted among theme files', () => {
    write('default/og-dark.json', { colors: { '--border': '#111111' } });
    write('neon/manifest.json', { ...MANIFEST, name: 'Neon Night' });
    write('neon/theme.json', { colors: { '--border': '#ff00ff' } });
    write('neon/icon.webp', 'webp bytes');
    write('neon/neon.json', { colors: {} });
    write('more/wave/manifest.json', MANIFEST);
    write('more/wave/theme.json', { colors: {} });

    const library = readStyleLibrary(root);
    expect(library.topLevel).toEqual(['default', 'more', 'neon']);
    expect(library.items.neon).toMatchObject({
      label: 'Neon Night', type: 'style', parent: null, colors: { '--border': '#ff00ff' }, shader: 'neon', icon: { kind: 'image', file: 'neon/icon.webp' },
    });
    expect(library.items['neon/neon']).toBeUndefined();
    expect(library.items['more/wave']).toMatchObject({ label: 'wave', type: 'style', parent: 'more', shader: 'more/wave', icon: null });
    expect(library.problems).toEqual([]);
  });

  it('gives a pack without theme.json one with the default colors', () => {
    write('default/og-dark.json', { colors: { '--border': '#111111' } });
    write('bare/manifest.json', MANIFEST);

    const library = readStyleLibrary(root);
    expect(library.items.bare).toMatchObject({ type: 'style', colors: { '--border': '#111111' }, shader: 'bare' });
    expect(readJsonFile('bare/theme.json')).toEqual({ colors: { '--border': '#111111' } });
  });

  it('skips broken files and packs and reports why', () => {
    write('good.json', { colors: {} });
    write('typo.json', '{ "colors": ');
    write('bad.json', { colors: { '--border': 'blue' } });
    write('broken/manifest.json', { language: 'glsl' });
    write('ugly/manifest.json', MANIFEST);
    write('ugly/theme.json', { colors: { '--border': 'blue' } });

    const library = readStyleLibrary(root);
    expect(library.topLevel).toEqual(['good']);
    expect(library.problems.map((problem: { file: string }) => problem.file).sort())
      .toEqual(['styles/bad.json', 'styles/broken', 'styles/typo.json', 'styles/ugly']);
    expect(library.problems.find((problem: { file: string }) => problem.file === 'styles/ugly').message).toContain('theme.json');
  });

  it('returns an empty library when the folder is missing', () => {
    expect(readStyleLibrary(path.join(root, 'missing'))).toEqual({ topLevel: [], items: {}, problems: [] });
  });

  it('picks an icon by name: shader first, then images in a fixed order', () => {
    expect(findIcon('Neon_night', ['Neon_night.json', 'neon_night.PNG', 'Neon_night.frag'])).toEqual({ kind: 'shader', fileName: 'Neon_night.frag' });
    expect(findIcon('Neon_night', ['Neon_night.json', 'Neon_night.webp', 'Neon_night.png'])).toEqual({ kind: 'image', fileName: 'Neon_night.png' });
    expect(findIcon('Neon_night', ['Neon_night.json', 'Neon_night.gif'])).toEqual({ kind: 'image', fileName: 'Neon_night.gif' });
    expect(findIcon('Neon_night', ['Neon_night.json', 'Neon.png', 'Neon_night.txt'])).toBeNull();
  });

  it('attaches same-name icons to theme files with a version that follows the file', () => {
    write('pack/Neon_night.json', { colors: {} });
    write('pack/Neon_night.webp', 'webp bytes');
    write('pack/plain.json', { colors: {} });
    write('lonely.png', 'no style uses this');

    const library = readStyleLibrary(root);
    const icon = library.items['pack/Neon_night'].icon;
    expect(icon).toMatchObject({ kind: 'image', file: 'pack/Neon_night.webp' });
    expect(icon.version).toBe(fs.statSync(path.join(root, 'pack/Neon_night.webp')).mtimeMs);
    expect(library.items['pack/plain'].icon).toBeNull();
    expect(library.topLevel).toEqual(['pack']);
    expect(readIconImage('pack/Neon_night.webp', root).toString()).toBe('webp bytes');
  });

  it('only serves icon files from inside the styles folder', () => {
    write('a.png', 'image');
    write('a.json', { colors: {} });
    expect(() => readIconImage('../outside.png', root)).toThrow('not inside the styles folder');
    expect(() => readIconImage('a.json', root)).toThrow('not a style icon');
  });

  it('compiles shader icons like a screen pass and reports problems', async () => {
    write('glow.frag', 'void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = iTheme.highlightColor * (fragCoord.x / iResolution.x); }');
    write('bad.frag', 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  fragColor = nope;\n}');
    write('empty.frag', 'void main() {}');

    const glow = await compileIconShader('glow.frag', root);
    expect(glow.ok).toBe(true);
    expect(glow.wgsl).toContain('@fragment');
    const bad = await compileIconShader('bad.frag', root);
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toMatchObject({ line: 2, message: expect.stringContaining('nope') });
    expect(await compileIconShader('empty.frag', root)).toMatchObject({ ok: false, errors: [{ message: expect.stringContaining('mainImage') }] });
    expect(await compileIconShader('missing.frag', root)).toMatchObject({ ok: false, errors: [{ message: 'file not found' }] });
  }, 30000);
});

describe('built-in styles', () => {
  const library = readStyleLibrary();

  it('ship as complete theme files in user/styles/default', () => {
    expect(library.problems).toEqual([]);
    const children = [...BUILT_IN_THEMES, ...BUILT_IN_PACKS].sort().map(name => `default/${name}`);
    expect(library.items.default).toMatchObject({ type: 'folder', children });
    for (const name of BUILT_IN_THEMES) {
      const style = library.items[`default/${name}`];
      expect(style).toMatchObject({ type: 'style', shader: null });
      if (style?.type === 'style') expect(Object.keys(style.colors)).toEqual(THEME_VARS);
    }
  });

  it('include the cyberpunk shader pack with its own colors and icon', () => {
    const style = library.items['default/cyberpunk'];
    expect(style).toMatchObject({
      type: 'style', parent: 'default', shader: 'default/cyberpunk', icon: { kind: 'image', file: 'default/cyberpunk/icon.webp' },
    });
    if (style?.type === 'style') expect(Object.keys(style.colors)).toEqual(THEME_VARS);
  });

  it('resolves names saved by older versions, and fills missing colors from the default', async () => {
    const extra = { id: 'mine/partial', label: 'partial', type: 'style', parent: null, colors: { '--border': '#010203' }, icon: null, shader: null };
    window.electronAPI = {
      loadStyles: async () => ({ ...library, items: { ...library.items, [extra.id]: extra } }),
    } as unknown as ElectronAPI;
    await loadStyleLibrary();

    expect(resolveStyleId('forest')).toBe('default/forest');
    expect(resolveStyleId('default/forest')).toBe('default/forest');
    expect(resolveStyleId('cyberpunk')).toBe('default/cyberpunk');
    expect(resolveStyleId('default/cyberpunk')).toBe('default/cyberpunk');
    expect(resolveStyleId('partial')).toBe('mine/partial');
    expect(resolveStyleId('gone')).toBeNull();

    const colors = getThemeColors('mine/partial');
    expect(colors['--border']).toBe('#010203');
    expect(colors['--bg-base']).toBe(getThemeColors('default/og-dark')['--bg-base']);
    expect(getThemeColors('gone')).toEqual(getThemeColors('default/og-dark'));
  });
});
