//src/modals/settings/tabs/MultiselectsTab.tsx
import { SettingMultiselect } from '../SettingControls';

export default function MultiselectsTab() {
  return (
    <div className="settings-panel-content">
      <SettingMultiselect setting="viewerControlsType" label="Viewer controls type" />
      <SettingMultiselect setting="timecodePanel" label="Timecode display" />
      <SettingMultiselect setting="zoomEpicenter" label="Timeline zoom epicenter" />
      <SettingMultiselect setting="torusScrollingDisabled" label="Disable scrolling when torus menu is open and mouse is on:" />
    </div>
  );
}
