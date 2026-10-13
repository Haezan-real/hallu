//src/features/torus/useTorusAudio.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireAudioService, type SoundKey } from '../../shared/platform/audioService';

/** Audio is shared across menu instances and released when the last menu closes. */
export function useTorusAudio() {
  const serviceRef = useRef<ReturnType<typeof acquireAudioService> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const service = acquireAudioService();
    serviceRef.current = service;
    service.ready.then(setReady);
    return () => {
      service.release();
      serviceRef.current = null;
    };
  }, []);

  const play = useCallback((sound: SoundKey, volume = 1.0) => {
    serviceRef.current?.playSound(sound, volume);
  }, []);

  return { ready, play };
}
