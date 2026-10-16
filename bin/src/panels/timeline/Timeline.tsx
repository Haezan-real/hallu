//src/panels/timeline/Timeline.tsx
import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Film, Music } from 'lucide-react';
import type { TimelineClip, Track, MediaItem } from '../../types';
import { formatTimecode } from '../../types';
import TorusMenu from '../../features/torus/TorusMenu';
import FormulaPlayneedle from '../../features/playneedle/FormulaPlayneedle';
import { usePlayneedleParams } from '../../features/playneedle/usePlayneedleParams';
import { playneedleButtonCenter } from '../../features/playneedle/playneedleFormula';
import { onSettingChange, useSetting } from '../../modals/settings/settingsStore';
import {
  HEADER_H, TAIL_FRAMES, TRACK_H, clampZoom, frameToX, getJoinPairs, rulerTicks, xToFrame,
} from './timelineGeometry';
import { useTimelineScrollZoom } from './useTimelineScrollZoom';
import { useTimelinePointer } from './useTimelinePointer';
import { useTimelineTorus } from './useTimelineTorus';
import { TimelineGrid, TimelineRuler } from './TimelineRuler';
import TimelineClipView from './TimelineClipView';
import { SHADER_PANEL, useShaderPanel } from '../../features/shaders/shaderPanels';
import PanelHeaderActions from '../../shared/dock/PanelHeaderActions';

interface Props {
  clips: TimelineClip[];
  tracks: Track[];
  playhead: number;
  selectedIds: string[];
  onSeek: (frame: number) => void;
  onDropMedia: (mediaId: string, track: number, startFrame: number) => void;
  onSelectClip: (id: string, multi: boolean) => void;
  onSplitClip: (clipId: string, frame: number) => void;
  onTrimLatter: (clipId: string, frame: number, ripple: boolean) => void;
  onTrimFormer: (clipId: string, frame: number, ripple: boolean) => void;
  onNudge: (ids: string[], delta: number) => void;
  onJoin: (clipAId: string, clipBId: string) => void;
  onFadeChange: (clipId: string, side: 'in' | 'out', frames: number) => void;
  onFadeDragStart: () => void;
  onFadeDragEnd: () => void;
  onRoll: (clipId: string) => void;
  onStepEdge: (clipId: string | null, cutBetween: [string, string] | null, direction: number, ripple: boolean) => void;
  totalFrames: number;
  mediaItems: Map<string, MediaItem>;
}

export default function Timeline({
  clips, tracks, playhead, selectedIds,
  onSeek, onDropMedia, onSelectClip,
  onSplitClip, onTrimLatter, onTrimFormer,
  onNudge, onJoin, onFadeChange, onFadeDragStart, onFadeDragEnd, onRoll, onStepEdge,
  totalFrames,
  mediaItems
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  useShaderPanel(labelsRef, SHADER_PANEL.timelineLabels);
  const playheadRef = useRef(playhead);
  useEffect(() => { playheadRef.current = playhead; }, [playhead]);

  const [timecodePanel] = useSetting('timecodePanel');
  const [torusScrollingDisabled] = useSetting('torusScrollingDisabled');
  const { params: playneedleParams, width: pnWidth } = usePlayneedleParams();
  const [playheadHeight, setPlayheadHeight] = useState(200);

  const { zoom, setZoom } = useTimelineScrollZoom(scrollRef, playheadRef);
  const { startClipDrag, startFadeDrag, startScrub } = useTimelinePointer({
    clips, selectedIds, zoom, scrollRef,
    onSeek, onSelectClip, onNudge, onFadeChange, onFadeDragStart, onFadeDragEnd,
  });

  const playheadX = frameToX(playhead, zoom);
  const totalWidth = Math.max(frameToX(totalFrames + TAIL_FRAMES, zoom), 1200);
  const ticks = rulerTicks(totalFrames, zoom);

  const { torus, open: openTorus, close: closeTorus } = useTimelineTorus({
    clips, playhead, playheadX, scrollRef,
    buttonCenter: playneedleButtonCenter(playneedleParams),
  });

  // Keep the playneedle height synchronized with the visible timeline pane
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const updatePlayheadHeight = () => {
      const nextHeight = Math.max(1, Math.round(scrollEl.clientHeight));
      setPlayheadHeight(prev => (prev === nextHeight ? prev : nextHeight));
    };

    updatePlayheadHeight();
    const resizeObserver = new ResizeObserver(updatePlayheadHeight);
    resizeObserver.observe(scrollEl);
    window.addEventListener('resize', updatePlayheadHeight);
    const stopWatchingScale = onSettingChange('guiScale', () => { setTimeout(updatePlayheadHeight, 50); });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePlayheadHeight);
      stopWatchingScale();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && selectedIds.length > 0) { e.preventDefault(); onNudge(selectedIds, -1); }
      if (e.key === 'ArrowRight' && selectedIds.length > 0) { e.preventDefault(); onNudge(selectedIds, 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, onNudge]);

  const handleTrackDrop = (e: React.DragEvent, trackIdx: number) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('text/plain');
    if (!mediaId) return;
    const scrollX = scrollRef.current?.scrollLeft ?? 0;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frame = Math.max(0, xToFrame(e.clientX - rect.left + scrollX, zoom));
    onDropMedia(mediaId, trackIdx, frame);
  };

  const joinPairs = getJoinPairs(clips);

  return (
    <div className="timeline">
      <PanelHeaderActions>
        <div className="zoom-ctrl">
          <button className="icon-btn" onClick={() => setZoom(z => clampZoom(z - 0.25))}>-</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom(z => clampZoom(z + 0.25))}>+</button>
        </div>
        {timecodePanel === 'timeline' || timecodePanel === 'both' ? (
          <span className="timecode">{formatTimecode(playhead)}</span>
        ) : null}
      </PanelHeaderActions>

      <div className="tl-main">
        <div ref={labelsRef} className="tl-labels">
          {tracks.map(tr => (
            <div key={tr.id} className="tl-label" style={{ height: TRACK_H }}>
              {tr.type === 'video' ? <Film size={13} /> : <Music size={13} />}
              <span>{tr.label}</span>
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="tl-scroll" style={{ position: 'relative', overflow: 'auto hidden', flex: 1, height: '100%' }}>
          <div
            className="tl-inner"
            style={{ width: totalWidth, position: 'relative', height: '100%' }}
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.tl-clip') || target.closest('.fade-handle') || target.closest('.join-btn') || target.closest('.tl-playhead')) {
                return;
              }
              e.preventDefault();
              startScrub(e.clientX);
            }}
          >
            <TimelineRuler ticks={ticks} totalWidth={totalWidth} />
            <TimelineGrid ticks={ticks} totalWidth={totalWidth} />

            <div className="tl-tracks-wrap" style={{ height: `calc(100% - ${HEADER_H}px)` }}>
              {tracks.map((tr, tIdx) => (
                <div
                  key={tr.id}
                  className="tl-track"
                  style={{ height: TRACK_H, width: totalWidth }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={e => handleTrackDrop(e, tIdx)}
                >
                  {clips.filter(c => c.track === tIdx).map(clip => (
                    <TimelineClipView
                      key={clip.id}
                      clip={clip}
                      media={mediaItems.get(clip.mediaId)}
                      zoom={zoom}
                      selected={selectedIds.includes(clip.id)}
                      onDragStart={e => startClipDrag(e, clip.id)}
                      onSelect={e => { e.stopPropagation(); onSelectClip(clip.id, e.shiftKey); }}
                      onFadeDragStart={(e, side) => startFadeDrag(e, clip.id, side)}
                    />
                  ))}

                  {joinPairs
                    .filter(p => p.clipA.track === tIdx)
                    .map(({ clipA, clipB }) => (
                      <button
                        key={`join-${clipA.id}-${clipB.id}`}
                        className="join-btn"
                        style={{ left: frameToX(clipA.endFrame, zoom) - 16, top: TRACK_H / 2 - 10 }}
                        onClick={e => { e.stopPropagation(); onJoin(clipA.id, clipB.id); }}
                        title="Join clips"
                      >
                        J
                      </button>
                    ))
                  }
                </div>
              ))}
            </div>

            {/* Formula-based playneedle */}
            <div
              className="tl-playhead"
              style={{
                position: 'absolute',
                left: playheadX - pnWidth / 2,
                top: 0,
                width: pnWidth,
                height: '100%',
                zIndex: 40,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              <div
                style={{ pointerEvents: 'all', width: '100%', height: '100%' }}
                onMouseDown={(e) => { e.preventDefault(); startScrub(); }}
                onClick={(e) => { e.stopPropagation(); openTorus(); }}
              >
                <FormulaPlayneedle
                  height={playheadHeight}
                  maxWidth={pnWidth}
                  color="var(--playneedle)"
                  params={playneedleParams}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {torus && (() => {
        const { target } = torus;
        return (
          <TorusMenu
            pos={torus.pos}
            target={target}
            onClose={closeTorus}
            onSplit={() => { if (target.kind === 'inside') onSplitClip(target.clipId, target.frame); }}
            onTrimLatter={(ripple) => { if (target.kind === 'inside') onTrimLatter(target.clipId, target.frame, ripple); }}
            onTrimFormer={(ripple) => { if (target.kind === 'inside') onTrimFormer(target.clipId, target.frame, ripple); }}
            onStep={(dir, ripple) => onStepEdge(target.kind === 'edge' ? target.clipId : null, target.kind === 'cut' ? [target.clipAId, target.clipBId] : null, dir, ripple)}
            onRoll={() => { if (target.kind === 'inside') onRoll(target.clipId); }}
            disableScrolling={torusScrollingDisabled}
          />
        );
      })()}
    </div>
  );
}
