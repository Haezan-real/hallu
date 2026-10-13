import type { ReactNode } from 'react';
//src/shared/ui/controls/Multiselect.tsx

interface MultiselectProps<T extends string> {
  label: ReactNode;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  formatOption?: (opt: T) => string;
}

export function Multiselect<T extends string>({ label, options, value, onChange, formatOption }: MultiselectProps<T>) {
  const fmt = formatOption || ((opt: T) => opt.charAt(0).toUpperCase() + opt.slice(1));
  return (
    <div className="settings-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <span style={{ lineHeight: 1.2 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--radius-sm)',
                border: active ? '1px solid var(--highlight-color)' : '1px solid var(--border-mid)',
                background: active ? 'rgba(56,189,248,0.15)' : 'var(--bg-elevated)',
                color: active ? 'var(--highlight-color)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {fmt(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
