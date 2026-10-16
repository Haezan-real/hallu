import { useSyncExternalStore } from 'react';
import { useSetting } from '../modals/settings/settingsStore';
import { hasBlockingDialog, subscribeBlockingDialogs } from '../shared/ui/blockingDialogs';

//src/app/useBackgroundLock.ts

// True while a blocking dialog is open and the "allow edits when a dialog is open" setting is off
export function useBackgroundLock(): boolean {
  const dialogOpen = useSyncExternalStore(subscribeBlockingDialogs, hasBlockingDialog);
  const [allowEditsWhenMenuOpen] = useSetting('allowEditsWhenMenuOpen');
  return dialogOpen && !allowEditsWhenMenuOpen;
}
