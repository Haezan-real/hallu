import { beforeEach, describe, expect, it } from 'vitest';
import { migrateRenamedKeys } from '../src/modals/settings/storageMigration';

describe('renamed settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('moves the Styles modal settings to their Themes names', () => {
    window.localStorage.setItem('hallu.styles.activeTheme', 'default/cyberpunk');
    window.localStorage.setItem('hallu.modal.styles.pageState', JSON.stringify({ stylePage: 'default', activeTheme: 'default/cyberpunk' }));

    migrateRenamedKeys();

    expect(window.localStorage.getItem('hallu.themes.activeTheme')).toBe('default/cyberpunk');
    expect(JSON.parse(window.localStorage.getItem('hallu.modal.themes.pageState')!)).toEqual({ themePage: 'default', activeTheme: 'default/cyberpunk' });
    expect(window.localStorage.getItem('hallu.styles.activeTheme')).toBeNull();
    expect(window.localStorage.getItem('hallu.modal.styles.pageState')).toBeNull();
  });

  it('keeps a value already saved under the new name', () => {
    window.localStorage.setItem('hallu.styles.activeTheme', 'default/oak');
    window.localStorage.setItem('hallu.themes.activeTheme', 'default/forest');

    migrateRenamedKeys();

    expect(window.localStorage.getItem('hallu.themes.activeTheme')).toBe('default/forest');
    expect(window.localStorage.getItem('hallu.styles.activeTheme')).toBeNull();
  });
});
