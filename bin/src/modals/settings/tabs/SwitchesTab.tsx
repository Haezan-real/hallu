//src/modals/settings/tabs/SwitchesTab.tsx
import { SettingToggle } from '../SettingControls';

export default function SwitchesTab() {
  return (
    <div className="settings-panel-content">
      <SettingToggle setting="allowEditsWhenMenuOpen" label="Allow edits while a dialog is open" />
    </div>
  );
}
