import type { CSSProperties, ReactNode } from 'react';
//src/shared/ui/IconTile.tsx

const TILE_WIDTH = 90;
const TILE_HEIGHT = 100;

interface IconTileProps {
  label: string;
  // A 24x24 stroke path, or a custom icon element
  icon: string | ReactNode;
  active?: boolean;
  onClick: () => void;
}

// Large icon button used by the Styles, Shaders and Settings > Components grids
export function IconTile({ label, icon, active = false, onClick }: IconTileProps) {
  const color = active ? 'var(--accent-green)' : 'var(--text-secondary)';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: active ? 'rgba(52, 211, 153, 0.2)' : 'transparent', border: active ? '1px solid var(--accent-green)' : '1px solid transparent', borderRadius: 'var(--radius-md)', padding: '12px 16px', cursor: 'pointer', color, width: TILE_WIDTH, height: TILE_HEIGHT, flexShrink: 0 }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {typeof icon === 'string' ? (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>
          <path d={icon} />
        </svg>
      ) : icon}
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', color, textAlign: 'center' }}>{label}</span>
    </button>
  );
}

export function IconTileGrid({ children, rowGap = 8 }: { children: ReactNode; rowGap?: number }) {
  const style: CSSProperties = { flex: 1, padding: 16, overflow: 'auto', display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TILE_WIDTH}px)`, gap: `${rowGap}px 12px`, alignItems: 'flex-start', alignContent: 'start', justifyContent: 'flex-start' };
  return <div style={style}>{children}</div>;
}
