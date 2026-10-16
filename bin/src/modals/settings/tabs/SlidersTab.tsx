//src/modals/settings/tabs/SlidersTab.tsx
import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { SettingSlider } from '../SettingControls';

// Gap in pixels between each slider component in a category
const SLIDER_GAP_PX = 15;

const percent = (v: number) => `${v.toFixed(3)}%`;

function SettingsCategory({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="settings-category">
      <button type="button" className="settings-category-header" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        <span className="settings-category-title">{title}</span>
        <ChevronRight size={14} className="settings-category-arrow" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      </button>
      <div className="settings-category-body" style={{ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', overflow: 'hidden' }}>
        <div style={{ overflow: 'hidden' }}>
          <div className="settings-category-body-inner" style={{ display: 'flex', flexDirection: 'column', gap: SLIDER_GAP_PX }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function SlidersTab() {
  return (
    <div className="settings-panel-content">
      <SettingSlider setting="guiScale" label="GUI scale" step={1} formatValue={v => `${v}%`} />
      <SettingSlider setting="colorTransitionDuration" label="Global transition duration" step={10} formatValue={v => `${v}ms`} />
      <SettingsCategory title="Scrolling">
        <SettingSlider setting="scrollSmooth" label="Timeline scroll smooth factor" step={1} formatValue={percent} />
        <SettingSlider setting="scrollAmount" label="Timeline scroll amount" step={1} formatValue={percent} />
        <SettingSlider setting="scrollZoomAmount" label="Timeline scroll zoom amount" step={1} />
        <SettingSlider setting="scrollZoomSmoothness" label="Timeline scroll zoom smoothness" step={1} formatValue={percent} />
      </SettingsCategory>
      <SettingsCategory title="Miscellaneous">
        <SettingSlider setting="elevatedPanelDarken" label="Draggable modal background darken amount" step={1} formatValue={percent} />
        <SettingSlider setting="elevatedPanelBlur" label="Draggable modal background blur amount" step={1} formatValue={percent} />
        <SettingSlider setting="titleButtonHoverGrow" label="Title bar button hover grow" step={1} formatValue={v => `${v}%`} />
      </SettingsCategory>
    </div>
  );
}
