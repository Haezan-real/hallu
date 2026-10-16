//src/modals/settings/Settings.tsx
import { useEffect, useState } from 'react';
import { readModalPageState, writeModalPageState } from '../../shared/modals/modalPageState';
import { closePanel, defineToolPanel, openPanel } from '../../shared/panels/openPanel';
import SlidersTab from './tabs/SlidersTab';
import SwitchesTab from './tabs/SwitchesTab';
import ShortcutsTab from './tabs/ShortcutsTab';
import MultiselectsTab from './tabs/MultiselectsTab';
import ComponentsTab from './tabs/ComponentsTab';

export type SettingsTab = 'sliders' | 'checkboxes' | 'shortcuts' | 'multiselects' | 'components';

const TAB_NAMES: Record<SettingsTab, string> = {
  shortcuts: 'Keyboard',
  sliders: 'Sliders',
  checkboxes: 'Switches',
  multiselects: 'Multiselects',
  components: 'Components',
};

const PAGE_STATE_KEY = 'settings';
const tabRequests = new Set<(tab: SettingsTab) => void>();

function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === 'string' && value in TAB_NAMES;
}

function savedTab(): SettingsTab {
  const saved = readModalPageState(PAGE_STATE_KEY);
  return isSettingsTab(saved) ? saved : 'sliders';
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>(savedTab);

  useEffect(() => {
    writeModalPageState(PAGE_STATE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    tabRequests.add(setActiveTab);
    return () => {
      tabRequests.delete(setActiveTab);
    };
  }, []);

  return (
    <div className="settings-root">
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
          {activeTab === 'components' && <ComponentsTab />}
        </div>
      </div>
    </div>
  );
}

defineToolPanel('settings', { title: 'Settings', component: Settings });

/** Opens Settings, or focuses it if it's open; `initialTab` switches it to that tab either way */
export function OpenSettings(initialTab?: SettingsTab) {
  if (initialTab) {
    writeModalPageState(PAGE_STATE_KEY, initialTab);
    tabRequests.forEach(request => request(initialTab));
  }
  const id = openPanel('settings');
  return id ? () => closePanel(id) : undefined;
}
