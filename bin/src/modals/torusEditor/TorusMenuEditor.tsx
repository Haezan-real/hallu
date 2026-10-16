//src/modals/torusEditor/TorusMenuEditor.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import GraphEditor, { DEFAULT_GRAPH_CONFIG, type GraphConfig } from '../../shared/ui/graphEditor/GraphEditor';
import { handleValuesToOffsets } from '../../shared/ui/graphEditor/graphGeometry';
import type { GraphPoint } from '../../shared/lib/graph';
import BackButton from '../../shared/ui/BackButton';
import { closePanel, defineToolPanel, isPanelFocused, openPanel } from '../../shared/panels/openPanel';
import TorusMenu from '../../features/torus/TorusMenu';
import type { TorusTarget } from '../../features/torus/torusTarget';
import {
  getSavedSizeGraph, getSavedSegmentHandleValues, saveSizeGraph, saveSegmentHandleValues,
} from '../../features/torus/torusSettings';
import { isShortcutMatch } from '../settings/shortcuts';
import { ShortcutEditor } from '../settings/ShortcutEditor';
import { SettingSlider } from '../settings/SettingControls';
import { OpenSettings } from '../settings/Settings';
import { DELAY_SCALE } from './delayScale';

const TORUS_GRAPH_CONFIG: GraphConfig = {
  ...DEFAULT_GRAPH_CONFIG,
  width: 100,
  height: 100, // controls how tall the graph is
  padding: 10, // controls the clipping and how wide the plot is
};

const PREVIEW_TARGET: TorusTarget = { kind: 'inside', clipId: '__preview__', frame: 0 };

export default function TorusMenuEditor() {
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

  // While this panel has the dock's focus, the torus shortcut previews here instead of on the timeline
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isShortcutMatch('toggleTorusMenu', e) || !isPanelFocused('torusMenuEditor')) return;
      e.preventDefault();
      e.stopPropagation();
      toggleTorus();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [toggleTorus]);

  return (
    <div className="editor-root">
      <div className="tool-panel-nav">
        <BackButton onClick={() => OpenSettings('components')} />
        <span className="panel-title">Settings</span>
      </div>
      <div className="torus-editor-body">
        <div className="torus-editor-controls">
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

        <div className="torus-editor-preview">
          {torusOpen && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}>
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
  );
}

defineToolPanel('torusMenuEditor', { title: 'Torus Menu Editor', component: TorusMenuEditor });

/** Opens the editor, or focuses it */
export function OpenTorusMenuEditor() {
  const id = openPanel('torusMenuEditor');
  return id ? () => closePanel(id) : undefined;
}
