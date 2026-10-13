//src/panels/timeline/timelineGeometry.ts
import type { TimelineClip } from '../../types';
import { FPS, formatTimecode } from '../../types';

export const TRACK_H = 64;
export const HEADER_H = 32;
export const PX_PER_FRAME = 4;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
// Empty space kept after the last clip
export const TAIL_FRAMES = 60 * FPS;

export function clampZoom(zoom: number) { return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)); }
export function frameToX(frame: number, zoom: number) { return frame * PX_PER_FRAME * zoom; }
export function xToFrame(x: number, zoom: number) { return Math.round(x / (PX_PER_FRAME * zoom)); }

/** Frame under a viewport x coordinate inside the scrolling track area. */
export function frameAtClientX(scrollEl: HTMLElement, clientX: number, zoom: number) {
  const x = scrollEl.scrollLeft + (clientX - scrollEl.getBoundingClientRect().left);
  return Math.max(0, xToFrame(x, zoom));
}

export interface RulerTick { x: number; label: string }

/** One tick per 1, 2 or 5 seconds depending on how much room a second gets. */
export function rulerTicks(totalFrames: number, zoom: number): RulerTick[] {
  const ticks: RulerTick[] = [];
  const pxPerSec = PX_PER_FRAME * zoom * FPS;
  const step = pxPerSec < 40 ? 5 : pxPerSec < 80 ? 2 : 1;
  const frames = totalFrames + TAIL_FRAMES;
  for (let s = 0; s * FPS <= frames; s += step) {
    ticks.push({ x: frameToX(s * FPS, zoom), label: formatTimecode(s * FPS) });
  }
  return ticks;
}

/** Adjacent clips on the same track that can be joined. */
export function getJoinPairs(clips: TimelineClip[]): Array<{ clipA: TimelineClip; clipB: TimelineClip }> {
  const pairs: Array<{ clipA: TimelineClip; clipB: TimelineClip }> = [];
  for (const clipA of clips) {
    const clipB = clips.find(c =>
      c.track === clipA.track &&
      c.id !== clipA.id &&
      Math.abs(c.startFrame - clipA.endFrame) <= 1
    );
    if (clipB) {
      const alreadyAdded = pairs.some(p => p.clipA.id === clipB.id || p.clipB.id === clipA.id);
      if (!alreadyAdded) pairs.push({ clipA, clipB });
    }
  }
  return pairs;
}

export function clipColorClass(type: string) {
  return type === 'video' ? 'clip-video' : type === 'audio' ? 'clip-audio' : 'clip-image';
}
