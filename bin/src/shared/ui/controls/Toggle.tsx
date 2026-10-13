import type { CSSProperties, ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
//src/shared/ui/controls/Toggle.tsx

interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  defaultValue: boolean;
  onChange: (checked: boolean) => void;
  style?: CSSProperties;
}

export function Toggle({ label, checked, defaultValue, onChange, style }: ToggleProps) {
  const resetTitle = `Reset to default (${defaultValue ? 'Checked' : 'Unchecked'})`;
  return (
    <div className="settings-field" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, ...style }}>
      <span style={{ flex: 1, lineHeight: 1.2 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" className="toggle-switch" checked={checked} onChange={e => onChange(e.target.checked)} title={resetTitle} />
        <button type="button" className="icon-btn" onClick={() => onChange(defaultValue)} title={resetTitle} style={{ padding: 4 }}><RotateCcw size={14} /></button>
      </div>
    </div>
  );
}
