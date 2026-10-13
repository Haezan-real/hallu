//src/panels/timeline/useTimelineTorus.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TimelineClip } from '../../types';
import { torusTargetAt, type TorusTarget } from '../../features/torus/torusTarget';

interface OpenTorus {
  target: TorusTarget;
  pos: { x: number; y: number };
}

/**
 * The torus menu opened from the playneedle button, by click or by the toggle shortcut.
 * It is anchored on the button center: `buttonCenter` is its height as a fraction of the track area.
 */
export function useTimelineTorus({ clips, playhead, playheadX, scrollRef, buttonCenter }: {
  clips: TimelineClip[];
  playhead: number;
  playheadX: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  buttonCenter: number;
}) {
  const [torus, setTorus] = useState<OpenTorus | null>(null);

  const open = useCallback(() => {
    const el = scrollRef.current;
    let pos = { x: 400, y: 300 };
    if (el) {
      const rect = el.getBoundingClientRect();
      pos = { x: rect.left + playheadX - el.scrollLeft, y: rect.top + buttonCenter * el.clientHeight };
    }
    setTorus({ target: torusTargetAt(clips, playhead), pos });
  }, [clips, playhead, playheadX, scrollRef, buttonCenter]);

  const close = useCallback(() => setTorus(null), []);

  const torusRef = useRef(torus);
  torusRef.current = torus;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const handler = () => {
      if (torusRef.current) close();
      else openRef.current();
    };
    window.addEventListener('hallu-torus-toggle', handler);
    return () => window.removeEventListener('hallu-torus-toggle', handler);
  }, [close]);

  return { torus, open, close };
}
