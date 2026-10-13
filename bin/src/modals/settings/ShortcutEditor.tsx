//src/modals/settings/ShortcutEditor.tsx
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Plus } from 'lucide-react';
import {
  SHORTCUT_LABELS, formatShortcutCombo, getShortcutKeys, keysFromEvent,
  resetDefaultShortcuts, setShortcutKeys, type ShortcutAction,
} from './shortcuts';
import { SETTINGS_CHANGED_EVENT, getSettingsChangedDetail } from './settingsEvents';

// Editable list of key combinations for one shortcut action
export function ShortcutEditor({ action }: { action: ShortcutAction }) {
  const [combos, setCombos] = useState(() => getShortcutKeys(action));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      if (getSettingsChangedDetail(e)?.key === 'keyboardShortcuts') setCombos(getShortcutKeys(action));
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, [action]);

  const save = (next: string[][]) => {
    setShortcutKeys(action, next);
    setCombos(next);
  };

  const addCombination = () => {
    const next = [...combos, []];
    save(next);
    const newIndex = next.length - 1;
    setEditingIndex(newIndex);
    setTimeout(() => chipRefs.current[newIndex]?.focus(), 0);
  };

  const removeCombination = (index: number) => {
    save(combos.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  const reset = () => {
    resetDefaultShortcuts(action);
    setCombos(getShortcutKeys(action));
    setEditingIndex(null);
  };

  const handleChipKeyDown = (e: React.KeyboardEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const keys = keysFromEvent(e);
    if (keys.length === 0) return;
    save(combos.map((combo, i) => (i === index ? keys : combo)));
    setEditingIndex(null);
  };

  return (
    <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ lineHeight: 1.2 }}>{SHORTCUT_LABELS[action]}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="icon-btn" onClick={addCombination} title="Add shortcut combination" style={{ padding: 4 }}><Plus size={14} /></button>
          <button type="button" className="icon-btn" onClick={reset} title="Reset to default shortcuts" style={{ padding: 4 }}><RotateCcw size={14} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {combos.map((keys, idx) => {
          const isEditing = editingIndex === idx;
          return (
            <div
              key={idx}
              ref={el => { chipRefs.current[idx] = el; }}
              tabIndex={0}
              onFocus={() => setEditingIndex(idx)}
              onBlur={() => { setTimeout(() => setEditingIndex(null), 150); }}
              onKeyDown={e => handleChipKeyDown(e, idx)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: isEditing ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                border: isEditing ? '1px solid var(--highlight-color)' : '1px solid var(--border-mid)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                cursor: 'pointer',
                outline: 'none',
                minHeight: 28,
              }}
              title={isEditing ? 'Press keys to assign...' : keys.length === 0 ? 'Click then press keys to assign' : 'Click then press new keys to reassign'}
            >
              <span style={{ fontSize: 12, color: keys.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                {isEditing && keys.length === 0 ? '...' : keys.length > 0 ? formatShortcutCombo(keys) : 'None'}
              </span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                onMouseDown={e => { e.stopPropagation(); removeCombination(idx); }}
                title="Remove this combination"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
