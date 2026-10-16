import { useEffect, useState } from 'react';
import { useSetting } from '../modals/settings/settingsStore';

//src/app/useBackgroundLock.ts

// True while a menu is open and the "allow edits when menu open" setting is off
export function useBackgroundLock(): boolean {
  const [hasModalOpen, setHasModalOpen] = useState(false);
  const [allowEditsWhenMenuOpen] = useSetting('allowEditsWhenMenuOpen');

  useEffect(() => {
    // A torus previewed inside a tool panel (the Torus Menu Editor's) isn't a menu over the app
    const checkModals = () => setHasModalOpen([...document.querySelectorAll('.modal-overlay, .torus-overlay')]
      .some(element => !element.closest('.workspace-panel-tool')));
    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, []);

  return !allowEditsWhenMenuOpen && hasModalOpen;
}
