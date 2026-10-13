//src/features/playneedle/usePlayneedleParams.ts
import { useMemo } from 'react';
import { useSetting } from '../../modals/settings/settingsStore';
import type { PlayneedleParams } from './playneedleFormula';

/** The saved playneedle shape and width, kept in sync with the settings. */
export function usePlayneedleParams(): { params: PlayneedleParams; width: number } {
  const [t] = useSetting('playneedle_t');
  const [j] = useSetting('playneedle_j');
  const [k] = useSetting('playneedle_k');
  const [s] = useSetting('playneedle_s');
  const [v_o] = useSetting('playneedle_v_o');
  const [h_b] = useSetting('playneedle_h_b');
  const [h_r] = useSetting('playneedle_h_r');
  const [width] = useSetting('playneedle_width');
  const params = useMemo(() => ({ t, j, k, s, v_o, h_b, h_r }), [t, j, k, s, v_o, h_b, h_r]);
  return { params, width };
}
