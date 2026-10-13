//src/panels/timeline/TimelineClipView.tsx
import type { MediaItem, TimelineClip } from '../../types';
import Waveform from './Waveform';
import ThumbnailRoll from './ThumbnailRoll';
import { TRACK_H, clipColorClass, frameToX } from './timelineGeometry';

interface Props {
  clip: TimelineClip;
  media: MediaItem | undefined;
  zoom: number;
  selected: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onSelect: (e: React.MouseEvent) => void;
  onFadeDragStart: (e: React.MouseEvent, side: 'in' | 'out') => void;
}

export default function TimelineClipView({ clip, media, zoom, selected, onDragStart, onSelect, onFadeDragStart }: Props) {
  const x = frameToX(clip.startFrame, zoom);
  const w = Math.max(frameToX(clip.endFrame - clip.startFrame, zoom), 4);
  const fadeInW = frameToX(clip.fades.in, zoom);
  const fadeOutW = frameToX(clip.fades.out, zoom);

  return (
    <div
      data-clip-id={clip.id}
      className={`tl-clip ${clipColorClass(clip.type)}${selected ? ' selected' : ''}`}
      style={{ left: x, width: w, height: TRACK_H, top: 0 }}
      onMouseDown={onDragStart}
      onClick={onSelect}
    >
      {fadeInW > 0 && <div className="fade-overlay fade-in" style={{ width: fadeInW }} />}
      {fadeOutW > 0 && <div className="fade-overlay fade-out" style={{ width: fadeOutW }} />}
      <div className="clip-inner" style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 22px' }}>
        <span className="clip-label">{clip.name}</span>
        <div style={{ flex: 1 }}>
          {clip.type === 'audio' && media && (
            <Waveform src={media.src} width={w} height={TRACK_H - 24} color="#d1fae5" />
          )}
          {clip.type === 'video' && media && (
            <ThumbnailRoll src={media.src} totalWidth={w} height={Math.min(48, TRACK_H - 16)} count={Math.min(8, Math.max(3, Math.floor(w / 80)))} />
          )}
        </div>
      </div>
      <div className="fade-handle fade-handle-l" onMouseDown={e => onFadeDragStart(e, 'in')} />
      <div className="fade-handle fade-handle-r" onMouseDown={e => onFadeDragStart(e, 'out')} />
    </div>
  );
}
