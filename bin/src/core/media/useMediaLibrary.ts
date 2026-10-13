import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { AppSnapshot } from '../history';
import type { MediaItem, TimelineClip } from '../../types';
import { generateId } from '../../types';
import { generateThumbnail, getMediaType, loadMediaDuration, revokeMediaResources } from './mediaIngestion';

//src/core/media/useMediaLibrary.ts

type HistoryApi = { push: (snapshot: AppSnapshot) => void };

interface MediaLibraryOptions {
  mediaItems: Map<string, MediaItem>;
  setMediaItems: Dispatch<SetStateAction<Map<string, MediaItem>>>;
  setClips: Dispatch<SetStateAction<TimelineClip[]>>;
  history: HistoryApi;
  snapshot: () => AppSnapshot;
}

export function useMediaLibrary({ mediaItems, setMediaItems, setClips, history, snapshot }: MediaLibraryOptions) {
  const isMountedRef = useRef(true);
  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;

  useEffect(() => {
    // StrictMode unmounts and remounts once in dev, so this has to be re-armed on every mount
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      revokeMediaResources(mediaItemsRef.current.values());
    };
  }, []);

  const handleAddMedia = useCallback(async (files: FileList) => {
    history.push(snapshot());
    for (const file of Array.from(files)) {
      if (!isMountedRef.current) return;
      const type = getMediaType(file.name);
      if (!type) continue;
      const src = URL.createObjectURL(file);
      const duration = await loadMediaDuration(file, type);
      if (!isMountedRef.current) {
        revokeMediaResources([{ src }]);
        return;
      }
      const thumbnail = await generateThumbnail(file, type);
      if (!isMountedRef.current) {
        revokeMediaResources([{ src }]);
        return;
      }
      const item: MediaItem = { id: generateId(), name: file.name, type, file, src, duration, thumbnail };
      setMediaItems(previous => {
        const next = new Map(previous);
        next.set(item.id, item);
        return next;
      });
    }
  }, [history, snapshot, setMediaItems]);

  const handleRemoveMedia = useCallback((id: string) => {
    history.push(snapshot());
    const item = mediaItems.get(id);
    if (item) revokeMediaResources([item]);
    setMediaItems(previous => {
      if (!previous.has(id)) return previous;
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
    setClips(prev => prev.filter(c => c.mediaId !== id));
  }, [mediaItems, history, snapshot, setMediaItems, setClips]);

  const handleDropMediaPool = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleAddMedia(e.dataTransfer.files);
  }, [handleAddMedia]);

  const handleDragOverMediaPool = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return { handleAddMedia, handleRemoveMedia, handleDropMediaPool, handleDragOverMediaPool };
}
