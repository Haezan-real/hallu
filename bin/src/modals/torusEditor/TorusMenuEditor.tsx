//src/modals/torusEditor/TorusMenuEditor.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import GraphEditor, { DEFAULT_GRAPH_CONFIG, type GraphConfig } from '../../shared/ui/graphEditor/GraphEditor';
import { handleValuesToOffsets } from '../../shared/ui/graphEditor/graphGeometry';
import type { GraphPoint } from '../../shared/lib/graph';
import DraggableModal from '../../shared/ui/DraggableModal';
import BackButton from '../../shared/ui/BackButton';
import { openModal } from '../../shared/modals/openModal';
import TorusMenu from '../../features/torus/TorusMenu';
import type { TorusTarget } from '../../features/torus/torusTarget';
import {
  getSavedSizeGraph, getSavedSegmentHandleValues, saveSizeGraph, saveSegmentHandleValues,
} from '../../features/torus/torusSettings';
import { isShortcutMatch } from '../settings/shortcuts';
import { ShortcutEditor } from '../settings/ShortcutEditor';
import { SettingSlider } from '../settings/SettingControls';
import { DELAY_SCALE } from './delayScale';

// Torus Menu Editor modal dimensions
const EDITOR_WIDTH = 620;
const EDITOR_HEIGHT = 370;

const TORUS_GRAPH_CONFIG: GraphConfig = {
  ...DEFAULT_GRAPH_CONFIG,
  width: 100,
  height: 100, // controls how tall the graph is
  padding: 10, // controls the clipping and how wide the plot is
};

const PREVIEW_TARGET: TorusTarget = { kind: 'inside', clipId: '__preview__', frame: 0 };

export function OpenTorusMenuEditor(onBack?: () => void) {
  return openModal('torusMenuEditor', close => (
    <TorusMenuEditorModal onClose={close} onBack={() => { close(); onBack?.(); }} />
  ));
}

export interface TorusMenuEditorModalProps {
  onClose: () => void;
  onBack: () => void;
}

export default function TorusMenuEditorModal({ onClose, onBack }: TorusMenuEditorModalProps) {
  const [torusOpen, setTorusOpen] = useState(false);
  const [sizeGraph, setSizeGraph] = useState<GraphPoint[]>(getSavedSizeGraph);
  const [segmentHandleValues, setSegmentHandleValues] = useState<number[]>(getSavedSegmentHandleValues);
  // GraphEditor works in pixel offsets; seed it once from the saved handle values
  const [initialEasingOffsets] = useState(() => handleValuesToOffsets(
    TORUS_GRAPH_CONFIG,
    sizeGraph.slice().sort((a, b) => a.time - b.time),
    TORUS_GRAPH_CONFIG.width,
    segmentHandleValues,
  ));

  const sortedSizeGraph = useMemo(() => sizeGraph.slice().sort((a, b) => a.time - b.time), [sizeGraph]);

  useEffect(() => { saveSizeGraph(sortedSizeGraph); }, [sortedSizeGraph]);
  useEffect(() => { saveSegmentHandleValues(segmentHandleValues); }, [segmentHandleValues]);

  const toggleTorus = useCallback(() => setTorusOpen(open => !open), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isShortcutMatch('toggleTorusMenu', e)) {
        e.preventDefault();
        e.stopPropagation();
        toggleTorus();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [toggleTorus]);

  return (
    <DraggableModal
      title="Torus Menu Editor"
      onClose={onClose}
      headerLeft={<BackButton onClick={onBack} />}
      style={{ width: EDITOR_WIDTH, minHeight: EDITOR_HEIGHT }}
      body={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0 12px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, width: 260 }}>
              <SettingSlider setting="torusDuration" label="Duration" step={10} formatValue={v => `${v}ms`} />
              <ShortcutEditor action="toggleTorusMenu" />
              <GraphEditor
                graph={sizeGraph}
                onChange={setSizeGraph}
                onEasingChange={setSegmentHandleValues}
                config={TORUS_GRAPH_CONFIG}
                Y_label="size"
                X_label="time"
                initialEasingOffsets={initialEasingOffsets}
              />
              <SettingSlider
                setting="torusDelay"
                label="Delay"
                step={1}
                scale={DELAY_SCALE}
                formatValue={v => `${v}ms`}
                rangeLabels={['-1000ms', '0ms', '1000ms']}
              />
              <SettingSlider
                setting="torusHoverScale"
                label="Hover Scale"
                step={0.01}
                formatValue={v => `${v.toFixed(2)}x`}
                rangeLabels={['1.00x', '1.08x', '1.50x']}
              />
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: 260,
                height: 260,
              }}
            >
              {torusOpen && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 5,
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                  }}>
                    <TorusMenu
                      pos={{ x: 0, y: 0 }}
                      target={PREVIEW_TARGET}
                      onClose={toggleTorus}
                      showCloseButton
                      sizeGraph={sortedSizeGraph}
                      segmentHandleValues={segmentHandleValues}
                      closeOnBackgroundClick={false}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                className="torus-toggle-btn"
                onClick={toggleTorus}
                title="Toggle torus menu"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1px solid var(--border-mid)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3000,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                •••
              </button>
            </div>
          </div>
        </div>
      }
    />
  );
}
