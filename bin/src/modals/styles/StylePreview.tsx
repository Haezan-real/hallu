//src/modals/styles/StylePreview.tsx
import type { ThemeColors } from './colorFields';

const SIZE = 96;
const RULER_STEP = 8;

/**
 * A miniature Hallu editor painted in one style's colors: title bar, media pool,
 * viewer and timeline with clips, automation and the playneedle.
 */
export default function StylePreview({ colors }: { colors: ThemeColors }) {
  const c = (varName: keyof ThemeColors) => colors[varName] || 'transparent';
  const rulerTicks = Array.from({ length: Math.floor((SIZE - 12) / RULER_STEP) + 1 }, (_, i) => 12 + i * RULER_STEP);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: 'block' }}>
      <rect width={SIZE} height={SIZE} fill={c('--splitter')} />

      {/* Title bar */}
      <rect width={SIZE} height={9} fill={c('--bg-panel')} />
      <circle cx={5} cy={4.5} r={2} fill={c('--text-secondary')} />
      <rect x={9} y={3.5} width={8} height={2} rx={1} fill={c('--text-muted')} />
      {[40, 44, 48].map(x => <rect key={x} x={x - 1.2} y={3.3} width={2.4} height={2.4} rx={0.6} fill={c('--text-secondary')} />)}
      <circle cx={82} cy={4.5} r={1.6} fill="var(--accent-amber)" />
      <circle cx={86.5} cy={4.5} r={1.6} fill="var(--accent-green)" />
      <circle cx={91} cy={4.5} r={1.6} fill="var(--accent-rose)" />

      {/* Media pool */}
      <rect x={0} y={10} width={47} height={45} fill={c('--bg-panel')} />
      <rect x={3} y={12.5} width={16} height={2} rx={1} fill={c('--text-primary')} />
      <rect x={41.5} y={12.5} width={3} height={2} rx={0.5} fill={c('--text-muted')} />
      <rect x={3} y={17} width={41} height={35} rx={1.5} fill={c('--bg-base')} stroke={c('--border-mid')} strokeWidth={0.5} strokeDasharray="1.5 1" />
      <rect x={13} y={23} width={21} height={11} rx={1} fill={c('--bg-elevated')} stroke={c('--border')} strokeWidth={0.4} />
      <rect x={15} y={25} width={8} height={7} rx={0.6} fill={c('--bg-hover')} />
      <rect x={24.5} y={25.5} width={7.5} height={1.5} rx={0.75} fill={c('--text-secondary')} />
      <rect x={24.5} y={28.5} width={5} height={1.5} rx={0.75} fill={c('--text-muted')} />
      <rect x={13} y={38} width={21} height={4} rx={1} fill={c('--input-field-bg')} stroke={c('--input-field')} strokeWidth={0.4} />
      <rect x={15} y={39.4} width={9} height={1.2} rx={0.6} fill={c('--text-muted')} />

      {/* Viewer */}
      <rect x={48} y={10} width={48} height={45} fill={c('--bg-panel')} />
      <rect x={51} y={12.5} width={10} height={2} rx={1} fill={c('--text-primary')} />
      <rect x={50} y={17} width={44} height={31} fill={c('--bg-viewer')} />
      <rect x={52} y={19} width={40} height={27} fill={c('--video-bg')} stroke={c('--border')} strokeWidth={0.5} />
      <rect x={50} y={51} width={36} height={1} rx={0.5} fill={c('--border-mid')} />
      <rect x={50} y={51} width={14} height={1} rx={0.5} fill={c('--highlight-color')} />
      <rect x={88} y={50.5} width={6} height={2} rx={1} fill={c('--text-muted')} />

      {/* Timeline */}
      <rect x={0} y={56} width={SIZE} height={40} fill={c('--bg-panel')} />
      <rect x={3} y={58.5} width={12} height={2} rx={1} fill={c('--text-primary')} />
      <rect x={80} y={58.5} width={13} height={2} rx={1} fill={c('--text-secondary')} />
      <rect x={0} y={62} width={SIZE} height={4} fill={c('--bg-base')} />
      <rect x={12} y={66} width={SIZE - 12} height={30} fill={c('--bg-base')} />
      {rulerTicks.map(x => <line key={x} x1={x} y1={62} x2={x} y2={SIZE} stroke={c('--border')} strokeWidth={0.35} />)}
      <line x1={0} y1={66} x2={SIZE} y2={66} stroke={c('--border')} strokeWidth={0.4} />
      <line x1={0} y1={78.5} x2={SIZE} y2={78.5} stroke={c('--border')} strokeWidth={0.4} />
      <line x1={0} y1={87} x2={SIZE} y2={87} stroke={c('--border')} strokeWidth={0.4} />
      <rect x={3} y={71.3} width={6} height={1.8} rx={0.9} fill={c('--text-muted')} />
      <rect x={3} y={81.8} width={6} height={1.8} rx={0.9} fill={c('--text-muted')} />

      {/* Clips, automation and the playneedle */}
      <rect x={20} y={67.5} width={30} height={9.5} rx={1} fill={c('--input-field')} opacity={0.85} />
      <rect x={54} y={67.5} width={22} height={9.5} rx={1} fill={c('--input-field')} opacity={0.55} />
      <rect x={20} y={79.8} width={40} height={5.8} rx={1} fill={c('--highlight-color')} fillOpacity={0.3} stroke={c('--highlight-color')} strokeWidth={0.4} />
      <polyline points="20,74.5 29,70 40,72.5 50,69.5" fill="none" stroke={c('--automation-line')} strokeWidth={0.7} strokeLinejoin="round" />
      {[[20, 74.5], [29, 70], [40, 72.5], [50, 69.5]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={0.9} fill={c('--automation-line')} />)}
      <line x1={36} y1={62} x2={36} y2={SIZE} stroke={c('--playneedle')} strokeWidth={0.8} />
      <path d="M33.8 62h4.4L36 64.8z" fill={c('--playneedle')} />
    </svg>
  );
}
