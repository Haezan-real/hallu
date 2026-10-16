import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { registerBlockingDialog } from './blockingDialogs';

//src/shared/ui/BlockingDialog.tsx

interface BlockingDialogProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** A small popup centered over the app, for things that need an answer first (Roll, confirmations); useBackgroundLock blocks the app behind it */
export default function BlockingDialog({ title, onClose, children }: BlockingDialogProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => registerBlockingDialog(() => closeRef.current()), []);

  return createPortal(
    <div className="blocking-dialog-layer">
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-header modal-header--centered">
          <span className="panel-title settings-title">{title}</span>
          <button className="icon-btn modal-close-btn" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
