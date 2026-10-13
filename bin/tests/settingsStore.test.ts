import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SETTINGS_SCHEMA, readSetting, useSetting } from '../src/modals/settings/settingsStore';

describe('settings schema', () => {
  it('falls back to defaults and clamps invalid persisted numbers', () => {
    window.localStorage.setItem('hallu.settings.guiScale', '999');
    window.localStorage.setItem('hallu.settings.scrollAmount', 'not-a-number');
    expect(readSetting('guiScale')).toBe(200);
    expect(readSetting('scrollAmount')).toBe(100);
  });

  it('normalizes runtime updates to schema ranges', () => {
    const { result } = renderHook(() => useSetting('elevatedPanelBlur'));
    act(() => result.current[1](999));
    expect(result.current[0]).toBe(100);
    expect(SETTINGS_SCHEMA.elevatedPanelBlur).toMatchObject({ min: 0, max: 100 });
  });

  it('keeps every subscriber of a key in sync', () => {
    const first = renderHook(() => useSetting('playneedle_j'));
    const second = renderHook(() => useSetting('playneedle_j'));
    act(() => first.result.current[1](-0.02));
    expect(second.result.current[0]).toBe(-0.02);
  });
});
