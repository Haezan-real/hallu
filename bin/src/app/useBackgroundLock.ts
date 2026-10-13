import { useEffect, useState } from 'react';
import { useSetting } from '../modals/settings/settingsStore';

//src/app/useBackgroundLock.ts

// True while a menu is open and the "allow edits when menu open" setting is off
export function useBackgroundLock(): boolean {
  const [hasModalOpen, setHasModalOpen] = useState(false);
  const [allowEditsWhenMenuOpen] = useSetting('allowEditsWhenMenuOpen');

  useEffect(() => {
    const checkModals = () => setHasModalOpen(!!document.querySelector('.modal-overlay, .torus-overlay'));
    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, []);

  return !allowEditsWhenMenuOpen && hasModalOpen;
}
