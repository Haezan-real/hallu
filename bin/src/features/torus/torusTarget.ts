//src/features/torus/torusTarget.ts
import type { TimelineClip } from '../../types';

export type TorusTarget =
  | { kind: 'inside'; clipId: string; frame: number }
  | { kind: 'edge'; clipId: string; side: 'start' | 'end'; frame: number }
  | { kind: 'cut'; clipAId: string; clipBId: string; frame: number };

/** What the torus menu would act on if opened at `playhead`. */
export function torusTargetAt(clips: TimelineClip[], playhead: number): TorusTarget {
  for (const clip of clips) {
    if (Math.abs(playhead - clip.startFrame) <= 1) {
      const adj = clips.find(c => c.track === clip.track && Math.abs(c.endFrame - clip.startFrame) <= 1);
      if (adj) return { kind: 'cut', clipAId: adj.id, clipBId: clip.id, frame: playhead };
      return { kind: 'edge', clipId: clip.id, side: 'start', frame: playhead };
    }
    if (Math.abs(playhead - clip.endFrame) <= 1) {
      const adj = clips.find(c => c.track === clip.track && Math.abs(c.startFrame - clip.endFrame) <= 1);
      if (adj) return { kind: 'cut', clipAId: clip.id, clipBId: adj.id, frame: playhead };
      return { kind: 'edge', clipId: clip.id, side: 'end', frame: playhead };
    }
    if (playhead > clip.startFrame && playhead < clip.endFrame) {
      return { kind: 'inside', clipId: clip.id, frame: playhead };
    }
  }
  return { kind: 'inside', clipId: '', frame: playhead };
}
