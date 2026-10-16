//src/modals/export/ExportModal.tsx
import { closePanel, defineToolPanel, openPanel } from '../../shared/panels/openPanel';
import type { ToolPanelProps } from '../../shared/panels/panelRegistry';
import { exportTimeline } from './timelineExport';

export default function Export({ close }: ToolPanelProps) {
  return (
    <div className="editor-root">
      <div className="settings-panel-content">
        <span style={{ color: 'var(--text-secondary)' }}>Export the video track as a WebM file.</span>
        <button
          className="btn-primary"
          style={{ alignSelf: 'center', padding: '8px 32px', background: 'var(--input-field)' }}
          onClick={() => {
            close();
            void exportTimeline();
          }}
        >
          Export video
        </button>
      </div>
    </div>
  );
}

defineToolPanel('export', { title: 'Export', component: Export });

/** Opens Export, or focuses it if it's open; it always exports the timeline as it is when clicked */
export function OpenExport() {
  const id = openPanel('export');
  return id ? () => closePanel(id) : undefined;
}
