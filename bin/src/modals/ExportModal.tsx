//src/modals/ExportModal.tsx
import DraggableModal from '../ui/DraggableModal';

interface ExportModalProps {
  onClose: () => void;
  onExport: () => void;
}

export default function ExportModal({ onClose, onExport }: ExportModalProps) {
  return (
    <DraggableModal
      title="Export"
      onClose={onClose}
      style={{ width: 400 }}
      body={
        <div className="settings-panel-content">
          <span style={{ color: 'var(--text-secondary)' }}>Export the video track as a WebM file.</span>
          <button
            className="btn-primary"
            style={{ alignSelf: 'center', padding: '8px 32px', background: 'var(--input-field)' }}
            onClick={() => {
              onClose();
              onExport();
            }}
          >
            Export video
          </button>
        </div>
      }
    />
  );
}
