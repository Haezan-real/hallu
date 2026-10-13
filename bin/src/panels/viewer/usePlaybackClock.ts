import { useEffect, useState } from 'react';
import { FPS } from '../../types';

//src/panels/viewer/usePlaybackClock.ts

export function usePlaybackClock(totalFrames: number) {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const intervalId = setInterval(() => {
      setPlayhead(p => { if (p >= totalFrames) { setPlaying(false); return p; } return p + 1; });
    }, 1000 / FPS);
    return () => clearInterval(intervalId);
  }, [playing, totalFrames]);

  return { playhead, setPlayhead, playing, setPlaying };
}
