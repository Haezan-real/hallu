import { beforeEach, describe, expect, it } from 'vitest';
import { migrateRenamedKeys } from '../src/modals/settings/storageMigration';

describe('renamed settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('moves the Themes modal settings to the Styles modal', () => {
    window.localStorage.setItem('hallu.themes.activeTheme', 'default/oak');
    window.localStorage.setItem('hallu.modal.themes.pageState', JSON.stringify({ themePage: 'default', activeTheme: 'default/oak' }));

    migrateRenamedKeys();

    expect(window.localStorage.getItem('hallu.styles.active')).toBe('default/oak');
    expect(JSON.parse(window.localStorage.getItem('hallu.modal.styles.pageState')!)).toEqual({ stylePage: 'default', activeStyle: 'default/oak' });
    expect(window.localStorage.getItem('hallu.themes.activeTheme')).toBeNull();
    expect(window.localStorage.getItem('hallu.modal.themes.pageState')).toBeNull();
  });

  it('moves the theme saved before the Themes rename too', () => {
    window.localStorage.setItem('hallu.styles.activeTheme', 'default/cyberpunk');

    migrateRenamedKeys();

    expect(window.localStorage.getItem('hallu.styles.active')).toBe('default/cyberpunk');
    expect(window.localStorage.getItem('hallu.styles.activeTheme')).toBeNull();
  });

  it('keeps a value already saved under the new name', () => {
    window.localStorage.setItem('hallu.themes.activeTheme', 'default/oak');
    window.localStorage.setItem('hallu.styles.active', 'default/forest');

    migrateRenamedKeys();

    expect(window.localStorage.getItem('hallu.styles.active')).toBe('default/forest');
    expect(window.localStorage.getItem('hallu.themes.activeTheme')).toBeNull();
  });

  it('drops the Shaders modal settings, since the style picks the shader', () => {
    window.localStorage.setItem('hallu.shaders.active', 'haezans_shader');
    window.localStorage.setItem('hallu.modal.shaderSelector.pageState', '{}');

    migrateRenamedKeys();

    expect(window.localStorage.getItem('hallu.shaders.active')).toBeNull();
    expect(window.localStorage.getItem('hallu.modal.shaderSelector.pageState')).toBeNull();
  });
});
