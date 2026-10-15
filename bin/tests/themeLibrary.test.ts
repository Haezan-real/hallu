import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THEME_VARS, readThemeLibrary, validateTheme } from '../themeLibrary.cjs';
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
      id: 'pack/inner/deep', label: 'deep', type: 'theme', parent: 'pack/inner', colors: { '--border': '#123456' },
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
