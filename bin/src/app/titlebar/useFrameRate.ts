//src/app/titlebar/useFrameRate.ts
import { useEffect, useState } from 'react';

// Measures the app window's frame rate, updated once per second
export function useFrameRate(): number | null {
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    let fpsStartTime = performance.now();

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - fpsStartTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        fpsStartTime = now;
      }
      rafId = requestAnimationFrame(measureFps);
    };
    rafId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}
