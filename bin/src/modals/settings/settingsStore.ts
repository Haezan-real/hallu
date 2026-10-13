import { useCallback, useEffect, useState } from 'react';
import { SETTINGS_CHANGED_EVENT, dispatchSettingsChanged, getSettingsChangedDetail } from './settingsEvents';
import { DEFAULT_SETTINGS, type SettingsValues } from './settingsDefaults';

//src/modals/settings/settingsStore.ts

export type SettingKey = keyof SettingsValues;
type KeysWithValue<V> = { [K in SettingKey]: SettingsValues[K] extends V ? K : never }[SettingKey];
export type NumericSettingKey = KeysWithValue<number>;
export type BooleanSettingKey = KeysWithValue<boolean>;
export type EnumSettingKey = KeysWithValue<string>;

type NumericSetting = { kind: 'number'; default: number; min: number; max: number };
type BooleanSetting = { kind: 'boolean'; default: boolean };
type EnumSetting<T extends string> = { kind: 'enum'; default: T; values: readonly T[] };
type SettingSchema = { [K in SettingKey]: NumericSetting | BooleanSetting | EnumSetting<string> };

const number = (key: SettingKey, min: number, max: number): NumericSetting =>
  ({ kind: 'number', default: DEFAULT_SETTINGS[key] as number, min, max });
const boolean = (key: SettingKey): BooleanSetting =>
  ({ kind: 'boolean', default: DEFAULT_SETTINGS[key] as boolean });
const oneOf = (key: SettingKey, values: readonly string[]): EnumSetting<string> =>
  ({ kind: 'enum', default: DEFAULT_SETTINGS[key] as string, values });

export const SETTINGS_SCHEMA: SettingSchema = {
  guiScale: number('guiScale', 50, 200),
  includeResizeInUndo: boolean('includeResizeInUndo'),
  zoomEpicenter: oneOf('zoomEpicenter', ['playneedle', 'middle', 'cursor']),
  scrollSmooth: number('scrollSmooth', 0, 100),
  scrollAmount: number('scrollAmount', 1, 400),
  scrollZoomAmount: number('scrollZoomAmount', 1, 100),
  scrollZoomSmoothness: number('scrollZoomSmoothness', 0, 100),
  cancelZoomOnScroll: boolean('cancelZoomOnScroll'),
  viewerControlsType: oneOf('viewerControlsType', ['compact', 'centered']),
  timecodePanel: oneOf('timecodePanel', ['timeline', 'viewer', 'both', 'none']),
  torusScrollingDisabled: oneOf('torusScrollingDisabled', ['whole torus menu', 'annular sectors only', 'none']),
  elevatedPanelDarken: number('elevatedPanelDarken', 0, 100),
  elevatedPanelBlur: number('elevatedPanelBlur', 0, 100),
  draggableHeaderButtons: boolean('draggableHeaderButtons'),
  allowMultipleMenus: boolean('allowMultipleMenus'),
  allowEditsWhenMenuOpen: boolean('allowEditsWhenMenuOpen'),
  executeHeaderButtonsOnDrag: boolean('executeHeaderButtonsOnDrag'),
  playneedle_t: number('playneedle_t', 0, 0.5),
  playneedle_j: number('playneedle_j', -0.05, 0.25),
  playneedle_k: number('playneedle_k', 10, 1000),
  playneedle_s: number('playneedle_s', 10, 50),
  playneedle_v_o: number('playneedle_v_o', 0, 1),
  playneedle_h_b: number('playneedle_h_b', 0.5, 1),
  playneedle_h_r: number('playneedle_h_r', 0, 1),
  playneedle_width: number('playneedle_width', 0, 100),
  playneedleIconHorizontalStretch: number('playneedleIconHorizontalStretch', 0, 2),
  colorTransitionDuration: number('colorTransitionDuration', 0, 1000),
  torusDuration: number('torusDuration', 0, 2000),
  torusDelay: number('torusDelay', -1000, 1000),
  torusHoverScale: number('torusHoverScale', 1, 1.5),
};

function storageKey(key: SettingKey): string {
  const legacyKeys: Partial<Record<SettingKey, string>> = {
    elevatedPanelDarken: 'hallu.settings.elevatedPanelDarkenAmount',
    elevatedPanelBlur: 'hallu.settings.elevatedPanelBlurAmount',
  };
  return legacyKeys[key] ?? `hallu.settings.${key}`;
}

export function getNumberRange(key: SettingKey): { min: number; max: number } {
  const definition = SETTINGS_SCHEMA[key];
  if (definition.kind !== 'number') throw new Error(`${key} is not a numeric setting`);
  return { min: definition.min, max: definition.max };
}

export function getEnumValues<K extends EnumSettingKey>(key: K): readonly SettingsValues[K][] {
  const definition = SETTINGS_SCHEMA[key];
  if (definition.kind !== 'enum') throw new Error(`${key} is not an enum setting`);
  return definition.values as readonly SettingsValues[K][];
}

function normalizeSetting<K extends SettingKey>(key: K, value: unknown): SettingsValues[K] {
  const definition = SETTINGS_SCHEMA[key];
  if (definition.kind === 'boolean') return (typeof value === 'boolean' ? value : definition.default) as SettingsValues[K];
  if (definition.kind === 'enum') return (typeof value === 'string' && definition.values.includes(value) ? value : definition.default) as SettingsValues[K];
  const numericValue = Number(value);
  return (Number.isFinite(numericValue) ? Math.min(definition.max, Math.max(definition.min, numericValue)) : definition.default) as SettingsValues[K];
}

export function readSetting<K extends SettingKey>(key: K): SettingsValues[K] {
  const definition = SETTINGS_SCHEMA[key];
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw === null) return definition.default as SettingsValues[K];
    if (definition.kind === 'boolean') return (raw === 'true') as SettingsValues[K];
    if (definition.kind === 'enum') return normalizeSetting(key, raw);
    return normalizeSetting(key, raw === '' ? NaN : Number(raw));
  } catch {
    return definition.default as SettingsValues[K];
  }
}

// Persists the value (clamped to the schema) and notifies every listener of that key
export function writeSetting<K extends SettingKey>(key: K, value: SettingsValues[K]): void {
  const normalized = normalizeSetting(key, value);
  try { window.localStorage.setItem(storageKey(key), String(normalized)); } catch {}
  dispatchSettingsChanged(key, normalized);
}

export function onSettingChange<K extends SettingKey>(key: K, listener: (value: SettingsValues[K]) => void): () => void {
  const handler = (event: Event) => {
    const detail = getSettingsChangedDetail(event);
    if (detail?.key === key) listener(normalizeSetting(key, detail.value));
  };
  window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
}

export function useSetting<K extends SettingKey>(key: K): [SettingsValues[K], (value: SettingsValues[K]) => void] {
  const [value, setValue] = useState(() => readSetting(key));
  useEffect(() => onSettingChange(key, next => setValue(() => next)), [key]);
  const update = useCallback((next: SettingsValues[K]) => writeSetting(key, next), [key]);
  return [value, update];
}
