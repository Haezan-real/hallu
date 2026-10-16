//src/modals/settings/tabs/SwitchesTab.tsx
import { SettingToggle } from '../SettingControls';

const SPACED = { marginTop: 12 };

export default function SwitchesTab() {
  return (
    <div className="settings-panel-content">
      <SettingToggle setting="draggableHeaderButtons" label="Allow ×, -, and ← buttons in modals' header bar to be draggable" />
      <SettingToggle
        setting="executeHeaderButtonsOnDrag"
        label={<span style={{ color: 'var(--text-secondary)' }}>Execute header button actions when dragging</span>}
        style={SPACED}
      />
      <SettingToggle setting="allowMultipleMenus" label="Allow open multiple menus" style={SPACED} />
      <SettingToggle setting="allowEditsWhenMenuOpen" label="Allow edits when menu is open" style={SPACED} />
    </div>
  );
}
