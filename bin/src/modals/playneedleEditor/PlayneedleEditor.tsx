import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import FormulaPlayneedle from '../../features/playneedle/FormulaPlayneedle';
import { usePlayneedleParams } from '../../features/playneedle/usePlayneedleParams';
import BackButton from '../../shared/ui/BackButton';
import { closePanel, defineToolPanel, openPanel } from '../../shared/panels/openPanel';
import type { NumericSettingKey } from '../settings/settingsStore';
import { SettingSlider } from '../settings/SettingControls';
import { OpenSettings } from '../settings/Settings';

//src/modals/playneedleEditor/PlayneedleEditor.tsx

interface SliderConfig {
  key: Extract<NumericSettingKey, `playneedle_${string}`>;
  label: ReactNode;
  step: number;
  logScale?: boolean;
  format?: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  { key: 'playneedle_t', label: <span>t ！ Total thickness of the needle part</span>, step: 0.001 },
  { key: 'playneedle_j', label: <span>j ！ Length of the ribbon at the top</span>, step: 0.001 },
  { key: 'playneedle_k', label: <span>k ！ Falloff of the ribbon (log scale)</span>, step: 1, logScale: true },
  { key: 'playneedle_s', label: <span>s ！ Vertical height of the playneedle button</span>, step: 0.1 },
  { key: 'playneedle_v_o', label: <span>v<sub>o</sub> ！ Vertical offset of the playneedle button</span>, step: 0.001 },
  { key: 'playneedle_h_b', label: <span>h<sub>b</sub> ！ Horizontal width of the playneedle button</span>, step: 0.001 },
  { key: 'playneedle_h_r', label: <span>h<sub>r</sub> ！ Horizontal width of the ribbon</span>, step: 0.001 },
  { key: 'playneedle_width', label: <span>Playneedle width (px)</span>, step: 1, format: v => `${Math.round(v)}px` },
];

export default function PlayneedleEditor() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewHeight, setPreviewHeight] = useState(260);
  const { params, width } = usePlayneedleParams();

  // The playneedle fills the preview's height, however the panel is sized
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const updateHeight = () => setPreviewHeight(el.clientHeight);
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    updateHeight();
    return () => ro.disconnect();
  }, []);

  return (
    <div className="editor-root">
      <div className="tool-panel-nav">
        <BackButton onClick={() => OpenSettings('components')} />
        <span className="panel-title">Settings</span>
      </div>
      <div className="playneedle-editor-body">
        <div className="playneedle-editor-sliders">
          {SLIDERS.map(({ key, label, step, logScale, format }) => (
            <SettingSlider key={key} setting={key} label={label} step={step} logScale={logScale} formatValue={format} />
          ))}
        </div>
        <div ref={previewRef} className="playneedle-editor-preview">
          <FormulaPlayneedle
            height={previewHeight}
            maxWidth={width}
            color="var(--playneedle)"
            params={params}
          />
        </div>
      </div>
    </div>
  );
}

defineToolPanel('playneedleEditor', { title: 'Playneedle Editor', component: PlayneedleEditor });

/** Opens the editor, or focuses it */
export function OpenPlayneedleEditor() {
  const id = openPanel('playneedleEditor');
  return id ? () => closePanel(id) : undefined;
}
