//src/modals/settings/tabs/ShortcutsTab.tsx
import { SHORTCUT_LABELS, type ShortcutAction } from '../shortcuts';
import { ShortcutEditor } from '../ShortcutEditor';

export default function ShortcutsTab() {
  return (
    <div className="settings-panel-content">
      {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map(action => <ShortcutEditor key={action} action={action} />)}
    </div>
  );
}
