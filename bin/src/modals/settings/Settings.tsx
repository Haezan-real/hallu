//src/modals/settings/Settings.tsx
import { useState } from 'react';
import DraggableModal from '../../shared/ui/DraggableModal';
import { openModal } from '../../shared/modals/openModal';
import { readModalPageState } from '../../shared/modals/modalPageState';
import SlidersTab from './tabs/SlidersTab';
import SwitchesTab from './tabs/SwitchesTab';
import ShortcutsTab from './tabs/ShortcutsTab';
import MultiselectsTab from './tabs/MultiselectsTab';
import ComponentsTab from './tabs/ComponentsTab';

// Settings modal dimensions
const SETTINGS_MODAL_WIDTH = '480px';
const SETTINGS_MODAL_HEIGHT = '72vh';
const SETTINGS_MODAL_MIN_HEIGHT = '0vh';
const SETTINGS_MODAL_MAX_HEIGHT = '100vh';

export type SettingsTab = 'sliders' | 'checkboxes' | 'shortcuts' | 'multiselects' | 'components';

const TAB_NAMES: Record<SettingsTab, string> = {
  shortcuts: 'Keyboard',
  sliders: 'Sliders',
  checkboxes: 'Switches',
  multiselects: 'Multiselects',
  components: 'Components',
};

function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === 'string' && value in TAB_NAMES;
}

function savedTab(): SettingsTab {
  const saved = readModalPageState('settings');
  return isSettingsTab(saved) ? saved : 'sliders';
}

export default function Settings({ onClose, initialTab }: { onClose: () => void; initialTab?: SettingsTab }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => initialTab ?? savedTab());

  return (
    <DraggableModal
      title="Settings"
      onClose={onClose}
      className="settings-modal"
      style={{ width: SETTINGS_MODAL_WIDTH, height: SETTINGS_MODAL_HEIGHT, minHeight: SETTINGS_MODAL_MIN_HEIGHT, maxHeight: SETTINGS_MODAL_MAX_HEIGHT, overflow: 'hidden' }}
      persistenceKey="settings"
      pageState={activeTab}
      body={
        <div className="settings-body">
          <nav className="settings-tabs" aria-label="Settings sections">
            {(Object.keys(TAB_NAMES) as SettingsTab[]).map(tab => (
              <button
                key={tab}
                type="button"
                className={'settings-tab' + (activeTab === tab ? ' settings-tab--active' : '')}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_NAMES[tab]}
              </button>
            ))}
          </nav>
          <div className="settings-panel">
            {activeTab === 'sliders' && <SlidersTab />}
            {activeTab === 'checkboxes' && <SwitchesTab />}
            {activeTab === 'multiselects' && <MultiselectsTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
            {activeTab === 'components' && <ComponentsTab onClose={onClose} reopenSettings={() => OpenSettings('components')} />}
          </div>
        </div>
      }
    />
  );
}

export function OpenSettings(initialTab?: SettingsTab) {
  return openModal('settings', close => <Settings onClose={close} initialTab={initialTab} />);
}
