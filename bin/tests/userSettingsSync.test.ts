import { describe, expect, it, beforeEach } from 'vitest';
import {
  exportStorageToSettingsObject,
  importSettingsObjectToStorage,
} from '../src/core/settings/userSettingsSync';

describe('userSettingsSync', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exports only hallu.* keys and parses JSON values', () => {
    window.localStorage.setItem('hallu.styles.activeTheme', 'og-dark');
    window.localStorage.setItem('hallu.settings.guiScale', '120');
    window.localStorage.setItem('hallu.settings.keyboardShortcuts', JSON.stringify({ undo: [['ctrl', 'z']] }));
    window.localStorage.setItem('unrelated_key', 'should_be_ignored');

    const result = exportStorageToSettingsObject();

    expect(result['hallu.styles.activeTheme']).toBe('og-dark');
    expect(result['hallu.settings.guiScale']).toBe(120);
    expect(result['hallu.settings.keyboardShortcuts']).toEqual({ undo: [['ctrl', 'z']] });
    expect(result['unrelated_key']).toBeUndefined();
  });

  it('imports object data into localStorage properly stringifying objects', () => {
    const data = {
      'hallu.styles.activeTheme': 'cyberpunk',
      'hallu.settings.guiScale': 150,
      'hallu.settings.keyboardShortcuts': { redo: [['ctrl', 'y']] },
    };

    importSettingsObjectToStorage(data);

    expect(window.localStorage.getItem('hallu.styles.activeTheme')).toBe('cyberpunk');
    expect(window.localStorage.getItem('hallu.settings.guiScale')).toBe('150');
    expect(JSON.parse(window.localStorage.getItem('hallu.settings.keyboardShortcuts')!)).toEqual({ redo: [['ctrl', 'y']] });
  });
});
