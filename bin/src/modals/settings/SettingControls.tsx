//src/modals/settings/SettingControls.tsx
import type { CSSProperties, ReactNode } from 'react';
import { Slider, type SliderScale } from '../../shared/ui/controls/Slider';
import { Toggle } from '../../shared/ui/controls/Toggle';
import { Multiselect } from '../../shared/ui/controls/Multiselect';
import {
  getEnumValues, getNumberRange, useSetting,
  type BooleanSettingKey, type EnumSettingKey, type NumericSettingKey,
} from './settingsStore';
import { DEFAULT_SETTINGS } from './settingsDefaults';

// Controls bound to one persisted setting: range and default come from the settings schema

export function SettingSlider({ setting, label, step, formatValue, logScale, scale, rangeLabels }: {
  setting: NumericSettingKey;
  label: ReactNode;
  step: number;
  formatValue?: (v: number) => string;
  logScale?: boolean;
  scale?: SliderScale;
  rangeLabels?: ReactNode[];
}) {
  const [value, setValue] = useSetting(setting);
  const { min, max } = getNumberRange(setting);
  return (
    <Slider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={setValue}
      onReset={() => setValue(DEFAULT_SETTINGS[setting])}
      formatValue={formatValue}
      logScale={logScale}
      scale={scale}
      rangeLabels={rangeLabels}
    />
  );
}

export function SettingToggle({ setting, label, style }: { setting: BooleanSettingKey; label: ReactNode; style?: CSSProperties }) {
  const [value, setValue] = useSetting(setting);
  return <Toggle label={label} checked={value} defaultValue={DEFAULT_SETTINGS[setting]} onChange={setValue} style={style} />;
}

export function SettingMultiselect<K extends EnumSettingKey>({ setting, label }: { setting: K; label: ReactNode }) {
  const [value, setValue] = useSetting(setting);
  return <Multiselect label={label} options={getEnumValues(setting)} value={value} onChange={setValue} />;
}
