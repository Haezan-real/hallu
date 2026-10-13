//src/features/playneedle/PlayneedleIcon.tsx
import { DEFAULT_SETTINGS } from '../../modals/settings/settingsDefaults';
import { playneedlePath } from './playneedleFormula';

const ICON_SIZE = 36;
const HORIZONTAL_STRETCH = 0.4;
const VERTICAL_STRETCH = 3;

const ICON_PATH = playneedlePath({
  t: DEFAULT_SETTINGS.playneedle_t,
  j: DEFAULT_SETTINGS.playneedle_j,
  k: DEFAULT_SETTINGS.playneedle_k,
  s: DEFAULT_SETTINGS.playneedle_s,
  v_o: DEFAULT_SETTINGS.playneedle_v_o,
  h_b: DEFAULT_SETTINGS.playneedle_h_b,
  h_r: DEFAULT_SETTINGS.playneedle_h_r,
}, ICON_SIZE, ICON_SIZE);

// The default playneedle shape, cropped to its head
export default function PlayneedleIcon() {
  const half = ICON_SIZE / 2;
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`} fill="none" style={{ opacity: 0.7, flexShrink: 0 }}>
      <g transform={`translate(${half}, 0) scale(${HORIZONTAL_STRETCH}, ${VERTICAL_STRETCH}) translate(-${half}, 0)`}>
        <path d={ICON_PATH} fill="var(--text-secondary)" />
      </g>
    </svg>
  );
}
