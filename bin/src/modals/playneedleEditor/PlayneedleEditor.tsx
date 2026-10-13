import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import FormulaPlayneedle from '../../features/playneedle/FormulaPlayneedle';
import { usePlayneedleParams } from '../../features/playneedle/usePlayneedleParams';
import DraggableModal from '../../shared/ui/DraggableModal';
import BackButton from '../../shared/ui/BackButton';
import { openModal } from '../../shared/modals/openModal';
import type { NumericSettingKey } from '../settings/settingsStore';
import { SettingSlider } from '../settings/SettingControls';

//src/modals/playneedleEditor/PlayneedleEditor.tsx

// Playneedle Editor modal caps
const EDITOR_MAX_WIDTH = '480px';
const EDITOR_MAX_HEIGHT = '72vh';
// Left padding for the sliders column
const PADDING_LEFT = 10;

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

export function OpenPlayneedleEditor(onBack?: () => void) {
  return openModal('playneedleEditor', close => (
    <PlayneedleEditorModal onClose={close} onBack={() => { close(); onBack?.(); }} />
  ));
}

export interface PlayneedleEditorModalProps {
  onClose: () => void;
  onBack: () => void;
}

export default function PlayneedleEditorModal({ onClose, onBack }: PlayneedleEditorModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewHeight, setPreviewHeight] = useState(260);
  const { params, width } = usePlayneedleParams();

  // Watch the preview container height to make the playneedle fill the modal
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
    <DraggableModal
      title="Playneedle Editor"
      onClose={onClose}
      headerLeft={<BackButton onClick={onBack} />}
      style={{ width: EDITOR_MAX_WIDTH, maxHeight: EDITOR_MAX_HEIGHT, minHeight: 0, overflow: 'hidden' }}
      body={
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 16, padding: `4px 0 12px ${PADDING_LEFT}px`, flex: 1, minHeight: 0, overflow: 'hidden', height: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, width: 260, overflowY: 'scroll', overflowX: 'hidden', paddingRight: 4, flexShrink: 0, minHeight: 0, flex: 3 }}>
            {SLIDERS.map(({ key, label, step, logScale, format }) => (
              <SettingSlider key={key} setting={key} label={label} step={step} logScale={logScale} formatValue={format} />
            ))}
          </div>

          <div
            ref={previewRef}
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: 260,
              flex: 1,
              alignSelf: 'stretch',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <FormulaPlayneedle
              height={previewHeight}
              maxWidth={width}
              color="var(--playneedle)"
              params={params}
            />
          </div>
        </div>
      }
    />
  );
}
