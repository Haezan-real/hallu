import { useEffect } from 'react';
import { isShortcutMatch } from '../modals/settings/shortcuts';
import { closeFocusedFloatingPanel, isPanelFocused } from '../shared/panels/openPanel';
import { closeTopBlockingDialog } from '../shared/ui/blockingDialogs';

//src/app/useGlobalShortcuts.ts

interface GlobalShortcutHandlers {
  undo: () => void;
  redo: () => void;
  togglePlaying: () => void;
  clearSelection: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
}

export function useGlobalShortcuts({ undo, redo, togglePlaying, clearSelection }: GlobalShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey && key === 'a') { e.preventDefault(); return; }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && ((e.shiftKey && key === 'z') || (e.altKey && key === 'z') || (key === 'y' && !e.altKey && !e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Capture phase so these run before any focused panel sees the key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'd') { e.preventDefault(); clearSelection(); }
      if (e.key === ' ') { e.preventDefault(); togglePlaying(); }
      if (isShortcutMatch('exitModal', e)) {
        if (isTypingTarget(e.target)) return;
        // Blocking dialogs sit above floating panels, so they close first
        if (closeTopBlockingDialog() || closeFocusedFloatingPanel()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (isShortcutMatch('toggleTorusMenu', e)) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        // The Torus Menu Editor handles this shortcut itself while it has the dock's focus
        if (isPanelFocused('torusMenuEditor')) return;
        window.dispatchEvent(new CustomEvent('hallu-torus-toggle'));
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [togglePlaying, clearSelection]);
}
