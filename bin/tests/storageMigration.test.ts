import { beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyStorage } from '../src/modals/settings/storageMigration';

describe('legacy storage migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('moves saved settings to the Hallu namespace', () => {
    window.localStorage.setItem('juicecut.settings.guiScale', '125');

    migrateLegacyStorage();

    expect(window.localStorage.getItem('hallu.settings.guiScale')).toBe('125');
    expect(window.localStorage.getItem('juicecut.settings.guiScale')).toBeNull();
  });

  it('preserves values already saved in the Hallu namespace', () => {
    window.localStorage.setItem('juicecut.settings.guiScale', '125');
    window.localStorage.setItem('hallu.settings.guiScale', '150');

    migrateLegacyStorage();

    expect(window.localStorage.getItem('hallu.settings.guiScale')).toBe('150');
    expect(window.localStorage.getItem('juicecut.settings.guiScale')).toBeNull();
  });
});
