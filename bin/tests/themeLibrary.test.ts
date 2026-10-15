import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THEME_VARS, compileIconShader, findIcon, readIconImage, readThemeLibrary, validateTheme } from '../themeLibrary.cjs';
import { getThemeColors, loadThemeLibrary, resolveThemeId } from '../src/modals/themes/themes';
import type { ElectronAPI } from '../src/shared/platform/electronApi';

const BUILT_IN_THEMES = ['aquatic', 'cyberpunk', 'forest', 'lavender', 'monokai', 'oak', 'og-dark', 'og-light'];

describe('theme files', () => {
  let root: string;
  const write = (file: string, contents: unknown) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof contents === 'string' ? contents : JSON.stringify(contents));
  };

  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'hallu-themes-')); });
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

    const library = readThemeLibrary(root);
    expect(library.topLevel).toEqual(['pack', 'a', 'b']);
    expect(library.items.pack).toEqual({ id: 'pack', label: 'pack', type: 'folder', parent: null, children: ['pack/inner', 'pack/top'] });
    expect(library.items['pack/inner/deep']).toEqual({
      id: 'pack/inner/deep', label: 'deep', type: 'theme', parent: 'pack/inner', colors: { '--border': '#123456' }, icon: null,
    });
    expect(library.items.b).toMatchObject({ label: 'Zeta', parent: null });
    expect(library.problems).toEqual([]);
  });

  it('skips broken files and reports why', () => {
    write('good.json', { colors: {} });
    write('typo.json', '{ "colors": ');
    write('bad.json', { colors: { '--border': 'blue' } });
    const library = readThemeLibrary(root);
    expect(library.topLevel).toEqual(['good']);
    expect(library.problems.map((problem: { file: string }) => problem.file).sort()).toEqual(['themes/bad.json', 'themes/typo.json']);
  });

  it('returns an empty library when the folder is missing', () => {
    expect(readThemeLibrary(path.join(root, 'missing'))).toEqual({ topLevel: [], items: {}, problems: [] });
  });

  it('picks a same-name icon: shader first, then images in a fixed order', () => {
    expect(findIcon('Neon_night', ['Neon_night.json', 'neon_night.PNG', 'Neon_night.frag'])).toEqual({ kind: 'shader', fileName: 'Neon_night.frag' });
    expect(findIcon('Neon_night', ['Neon_night.json', 'Neon_night.webp', 'Neon_night.png'])).toEqual({ kind: 'image', fileName: 'Neon_night.png' });
    expect(findIcon('Neon_night', ['Neon_night.json', 'Neon_night.gif'])).toEqual({ kind: 'image', fileName: 'Neon_night.gif' });
    expect(findIcon('Neon_night', ['Neon_night.json', 'Neon.png', 'Neon_night.txt'])).toBeNull();
  });

  it('attaches icons to themes with a version that follows the file', () => {
    write('pack/Neon_night.json', { colors: {} });
    write('pack/Neon_night.webp', 'webp bytes');
    write('pack/plain.json', { colors: {} });
    write('lonely.png', 'no theme uses this');

    const library = readThemeLibrary(root);
    const icon = library.items['pack/Neon_night'].icon;
    expect(icon).toMatchObject({ kind: 'image', file: 'pack/Neon_night.webp' });
    expect(icon.version).toBe(fs.statSync(path.join(root, 'pack/Neon_night.webp')).mtimeMs);
    expect(library.items['pack/plain'].icon).toBeNull();
    expect(library.topLevel).toEqual(['pack']);
    expect(readIconImage('pack/Neon_night.webp', root).toString()).toBe('webp bytes');
  });

  it('only serves icon files from inside the themes folder', () => {
    write('a.png', 'image');
    write('a.json', { colors: {} });
    expect(() => readIconImage('../outside.png', root)).toThrow('not inside the themes folder');
    expect(() => readIconImage('a.json', root)).toThrow('not a theme icon');
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

describe('built-in themes', () => {
  const library = readThemeLibrary();

  it('ship as complete files in user/themes/default', () => {
    expect(library.problems).toEqual([]);
    expect(library.items.default).toMatchObject({ type: 'folder', children: BUILT_IN_THEMES.map(name => `default/${name}`) });
    for (const name of BUILT_IN_THEMES) {
      const theme = library.items[`default/${name}`];
      expect(theme?.type).toBe('theme');
      if (theme?.type === 'theme') expect(Object.keys(theme.colors)).toEqual(THEME_VARS);
    }
  });

  it('resolves theme names saved before themes were files, and fills missing colors from the default', async () => {
    const extra = { id: 'mine/partial', label: 'partial', type: 'theme', parent: null, colors: { '--border': '#010203' } };
    window.electronAPI = {
      loadThemes: async () => ({ ...library, items: { ...library.items, [extra.id]: extra } }),
    } as unknown as ElectronAPI;
    await loadThemeLibrary();

    expect(resolveThemeId('cyberpunk')).toBe('default/cyberpunk');
    expect(resolveThemeId('default/forest')).toBe('default/forest');
    expect(resolveThemeId('partial')).toBe('mine/partial');
    expect(resolveThemeId('gone')).toBeNull();

    const colors = getThemeColors('mine/partial');
    expect(colors['--border']).toBe('#010203');
    expect(colors['--bg-base']).toBe(getThemeColors('default/og-dark')['--bg-base']);
    expect(getThemeColors('gone')).toEqual(getThemeColors('default/og-dark'));
  });
});
