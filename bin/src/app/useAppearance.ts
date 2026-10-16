import { useEffect } from 'react';
import { watchStyles } from '../modals/styles/activeStyle';
import { onSettingChange, readSetting } from '../modals/settings/settingsStore';

//src/app/useAppearance.ts

const MAX_OVERLAY_BLUR = 50; //px, blur at 100%

function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

// 0-50% fades a white overlay out, 50-100% fades a black overlay in
function applyOverlayDarken(pct: number) {
  setCssVar('--modal-overlay-bg', pct <= 50
    ? `rgba(255,255,255,${(1 - pct / 50).toFixed(3)})`
    : `rgba(0,0,0,${((pct - 50) / 50).toFixed(3)})`);
}

function applyOverlayBlur(pct: number) {
  setCssVar('--modal-overlay-blur', `${(pct / 100) * MAX_OVERLAY_BLUR}px`);
}

function applyTitleButtonHoverGrow(pct: number) {
  setCssVar('--title-button-hover-scale', String(1 + pct / 100));
}

function applyGuiScale(pct: number) {
  setCssVar('--gui-scale', String(pct / 100));
}

export function applyTransitionDuration(ms: number) {
  setCssVar('--theme-transition-duration', `${ms}ms`);
  setCssVar('--theme-transition-timing', 'cubic-bezier(0.4, 0, 0.2, 1)');
}

// Applies the GUI scale, transition speed and modal overlay look, and keeps them and the active style in sync
export function useAppearance() {
  useEffect(() => {
    applyGuiScale(readSetting('guiScale'));
    applyTransitionDuration(readSetting('colorTransitionDuration'));
    applyOverlayDarken(readSetting('elevatedPanelDarken'));
    applyOverlayBlur(readSetting('elevatedPanelBlur'));
    applyTitleButtonHoverGrow(readSetting('titleButtonHoverGrow'));

    const unsubscribers = [
      onSettingChange('titleButtonHoverGrow', applyTitleButtonHoverGrow),
      onSettingChange('guiScale', applyGuiScale),
      onSettingChange('colorTransitionDuration', applyTransitionDuration),
      onSettingChange('elevatedPanelDarken', applyOverlayDarken),
      onSettingChange('elevatedPanelBlur', applyOverlayBlur),
      watchStyles(),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, []);
}
