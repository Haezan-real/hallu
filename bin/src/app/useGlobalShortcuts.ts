import { useEffect } from 'react';
import { isShortcutMatch } from '../modals/settings/shortcuts';
import { installKeyRouter, useGlobalKeys } from '../shared/keyboard/keyRouter';
import { closeFocusedFloatingPanel } from '../shared/panels/openPanel';

//src/app/useGlobalShortcuts.ts

interface GlobalShortcutHandlers {
  undo: () => void;
  redo: () => void;
  togglePlaying: () => void;
  clearSelection: () => void;
}

// Routes the keyboard (keyRouter), and handles whatever the focused panel doesn't use
export function useGlobalShortcuts({ undo, redo, togglePlaying, clearSelection }: GlobalShortcutHandlers) {
  useEffect(() => installKeyRouter(window), []);

  useGlobalKeys(e => {
    const key = e.key.toLowerCase();
    if (isShortcutMatch('undo', e)) { undo(); return true; }
    if (isShortcutMatch('redo', e)) { redo(); return true; }
    if (e.ctrlKey && key === 'a') return true;
    if (e.altKey && key === 'd') { clearSelection(); return true; }
    if (e.key === ' ') { togglePlaying(); return true; }
    if (isShortcutMatch('exitModal', e)) return closeFocusedFloatingPanel();
    if (isShortcutMatch('toggleTorusMenu', e)) {
      window.dispatchEvent(new CustomEvent('hallu-torus-toggle'));
      return true;
    }
    return false;
  });
}
