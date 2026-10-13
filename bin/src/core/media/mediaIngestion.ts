import type { MediaItem, MediaType } from '../../types';
import { FPS, secondsToFrames } from '../../types';

//src/core/media/mediaIngestion.ts

const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'mov', 'webm']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'aac']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'avif', 'gif', 'webp']);

const DEFAULT_IMAGE_DURATION = 5 * FPS;
const THUMBNAIL_WIDTH = 120; //px
const THUMBNAIL_HEIGHT = 68; //px

export function getMediaType(fileName: string): MediaType | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  return null;
}

export function loadMediaDuration(file: File, type: MediaType): Promise<number> {
  return new Promise(resolve => {
    if (type === 'image') { resolve(DEFAULT_IMAGE_DURATION); return; }
    const el = type === 'video'
      ? document.createElement('video')
      : document.createElement('audio');
    const tempUrl = URL.createObjectURL(file);
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(tempUrl);
    };
    el.preload = 'metadata';
    el.src = tempUrl;
    el.onloadedmetadata = () => {
      resolve(secondsToFrames(el.duration));
      cleanup();
    };
    el.onerror = () => {
      resolve(5 * FPS);
      cleanup();
    };
  });
}

export function generateThumbnail(file: File, type: MediaType): Promise<string | undefined> {
  return new Promise(resolve => {
    if (type === 'audio') { resolve(undefined); return; }
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const tempUrl = URL.createObjectURL(file);
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(tempUrl);
    };
    video.src = tempUrl;
    video.onloadeddata = () => { video.currentTime = 0.5; };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMBNAIL_WIDTH; canvas.height = THUMBNAIL_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
      cleanup();
    };
    video.onerror = () => {
      resolve(undefined);
      cleanup();
    };
  });
}

export function revokeMediaResources(items: Iterable<Pick<MediaItem, 'src'>>): void {
  for (const item of items) {
    URL.revokeObjectURL(item.src);
  }
}
