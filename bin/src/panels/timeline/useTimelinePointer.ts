//src/panels/timeline/useTimelinePointer.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TimelineClip } from '../../types';
import { frameAtClientX, frameToX, xToFrame } from './timelineGeometry';

interface Options {
  clips: TimelineClip[];
  selectedIds: string[];
  zoom: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSeek: (frame: number) => void;
  onSelectClip: (id: string, multi: boolean) => void;
  onNudge: (ids: string[], delta: number) => void;
  onFadeChange: (clipId: string, side: 'in' | 'out', frames: number) => void;
  onFadeDragStart: () => void;
  onFadeDragEnd: () => void;
}

/** Mouse drags on the timeline: moving clips, fade handles, and scrubbing the playhead. */
export function useTimelinePointer({
  clips, selectedIds, zoom, scrollRef,
  onSeek, onSelectClip, onNudge, onFadeChange, onFadeDragStart, onFadeDragEnd,
}: Options) {
  const [dragState, setDragState] = useState<{
    clipId: string; origStart: number; mouseStartX: number;
  } | null>(null);
  const [fadeState, setFadeState] = useState<{
    clipId: string; side: 'in' | 'out'; origFrames: number; mouseStartX: number;
  } | null>(null);
  const scrubbingRef = useRef(false);
  const lastMouseClientX = useRef(0);

  const startClipDrag = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    if (!selectedIds.includes(clipId)) onSelectClip(clipId, e.shiftKey);
    setDragState({ clipId, origStart: clip.startFrame, mouseStartX: e.clientX });
  };

  const startFadeDrag = (e: React.MouseEvent, clipId: string, side: 'in' | 'out') => {
    e.stopPropagation();
    e.preventDefault();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    setFadeState({
      clipId, side,
      origFrames: side === 'in' ? clip.fades.in : clip.fades.out,
      mouseStartX: e.clientX
    });
    onFadeDragStart();
  };

  /** Starts scrubbing; with a clientX the playhead first jumps there. */
  const startScrub = (clientX?: number) => {
    const scrollEl = scrollRef.current;
    if (clientX !== undefined && scrollEl) onSeek(frameAtClientX(scrollEl, clientX, zoom));
    scrubbingRef.current = true;
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMouseClientX.current = e.clientX;
    if (dragState) {
      const deltaFrames = xToFrame(e.clientX - dragState.mouseStartX, zoom);
      const newStart = Math.max(0, dragState.origStart + deltaFrames);
      // Preview with a transform; the clip only moves in state on mouseup
      const el = document.querySelector(`[data-clip-id="${dragState.clipId}"]`) as HTMLElement;
      if (el) el.style.transform = `translateX(${frameToX(newStart - dragState.origStart, zoom)}px)`;
    }
    if (fadeState) {
      const deltaFrames = xToFrame(e.clientX - fadeState.mouseStartX, zoom) * (fadeState.side === 'in' ? 1 : -1);
      onFadeChange(fadeState.clipId, fadeState.side, Math.max(0, fadeState.origFrames + deltaFrames));
    }
    if (scrubbingRef.current && scrollRef.current) {
      onSeek(frameAtClientX(scrollRef.current, lastMouseClientX.current, zoom));
    }
  }, [dragState, fadeState, zoom, onFadeChange, onSeek, scrollRef]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragState) {
      const deltaFrames = xToFrame(e.clientX - dragState.mouseStartX, zoom);
      if (deltaFrames !== 0) onNudge([dragState.clipId], deltaFrames);
      const el = document.querySelector(`[data-clip-id="${dragState.clipId}"]`) as HTMLElement;
      if (el) el.style.transform = '';
      setDragState(null);
    }
    if (fadeState) {
      setFadeState(null);
      onFadeDragEnd();
    }
    scrubbingRef.current = false;
  }, [dragState, fadeState, zoom, onNudge, onFadeDragEnd]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Keep scrubbing while the view scrolls under a stationary mouse
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const handleScroll = () => {
      if (scrubbingRef.current) onSeek(frameAtClientX(scrollEl, lastMouseClientX.current, zoom));
    };
    scrollEl.addEventListener('scroll', handleScroll);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [zoom, onSeek, scrollRef]);

  return { startClipDrag, startFadeDrag, startScrub };
}
