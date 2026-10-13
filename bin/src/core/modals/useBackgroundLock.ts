import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../settings/settingsDefaults';
import { SETTINGS_CHANGED_EVENT, getSettingsChangedDetail } from '../settings/settingsEvents';

//src/core/modals/useBackgroundLock.ts

function readAllowEditsWhenMenuOpen(): boolean {
  try {
    const value = window.localStorage.getItem('hallu.settings.allowEditsWhenMenuOpen');
    return value === null ? DEFAULT_SETTINGS.allowEditsWhenMenuOpen : value === 'true';
  } catch {
    return DEFAULT_SETTINGS.allowEditsWhenMenuOpen;
  }
}

// True while a menu is open and the "allow edits when menu open" setting is off
export function useBackgroundLock(): boolean {
  const [hasModalOpen, setHasModalOpen] = useState(false);
  const [allowEditsWhenMenuOpen, setAllowEditsWhenMenuOpen] = useState(readAllowEditsWhenMenuOpen);

  useEffect(() => {
    const checkModals = () => setHasModalOpen(!!document.querySelector('.modal-overlay, .torus-overlay'));
    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = getSettingsChangedDetail(e);
      if (detail?.key === 'allowEditsWhenMenuOpen' && typeof detail.value === 'boolean') {
        setAllowEditsWhenMenuOpen(detail.value);
      }
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);

  return !allowEditsWhenMenuOpen && hasModalOpen;
}
