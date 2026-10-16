//src/app/App.tsx
import { useState, useCallback } from 'react';
import MediaPool from '../panels/mediapool/MediaPool';
import Viewer from '../panels/viewer/Viewer';
import ViewerControls from '../panels/viewer/ViewerControls';
import Timeline from '../panels/timeline/Timeline';
import RollDialog from '../modals/roll/RollDialog';
import { OpenExport } from '../modals/export/ExportModal';
import TitleBar from './titlebar/TitleBar';
import WorkspaceDock from './dock/WorkspaceDock';
import type { MediaItem, TimelineClip } from '../types';
import { HistoryProvider, useHistory, type AppSnapshot } from '../shared/history';
import { useShortcutLifecycle } from '../modals/settings/shortcuts';
import { useGlobalShortcuts } from './useGlobalShortcuts';
import { useLayoutSettings } from '../modals/settings/useLayoutSettings';
import { useAppearance } from './useAppearance';
import { useExportJob } from '../modals/export/useExportJob';
import { useMediaLibrary } from '../panels/mediapool/useMediaLibrary';
import { usePlaybackClock } from '../panels/viewer/usePlaybackClock';
import { TRACKS, useTimelineEditor } from '../panels/timeline/useTimelineEditor';
import { useBackgroundLock } from './useBackgroundLock';
import { useSuppressContextMenu } from './useSuppressContextMenu';
import ShaderBackground from '../features/shaders/ShaderBackground';

function AppContent() {
  useShortcutLifecycle();
  useAppearance();
  useSuppressContextMenu();
  const history = useHistory();
  const blockBackground = useBackgroundLock();

  const [mediaItems, setMediaItems] = useState<Map<string, MediaItem>>(new Map());
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [rollClipId, setRollClipId] = useState<string | null>(null);

  const totalFrames = clips.reduce((max, c) => Math.max(max, c.endFrame), 0);
  const { playhead, setPlayhead, playing, setPlaying } = usePlaybackClock(totalFrames);

  const { playheadTop, setPlayheadTop } = useLayoutSettings();

  const snapshot = useCallback(() => ({
    clips: JSON.parse(JSON.stringify(clips)),
    mediaItems: Array.from(mediaItems.entries()),
    selectedIds: [...selectedIds],
    playhead,
    settings: { playheadTop },
  }), [clips, mediaItems, selectedIds, playhead, playheadTop]);

  const restore = useCallback((snap: AppSnapshot) => {
    try {
      const clipsValue = Array.isArray(snap.clips) ? snap.clips as TimelineClip[] : [];
      const mediaValue = Array.isArray(snap.mediaItems) ? snap.mediaItems as Array<[string, MediaItem]> : [];
      const selectedValue = Array.isArray(snap.selectedIds) ? snap.selectedIds as string[] : [];
      setClips(clipsValue);
      setMediaItems(new Map(mediaValue));
      setSelectedIds(selectedValue);
      setPlayhead(typeof snap.playhead === 'number' ? snap.playhead : 0);
      const settings = typeof snap.settings === 'object' && snap.settings !== null ? snap.settings as Record<string, unknown> : {};
      if (typeof settings.playheadTop === 'number') {
        const v = settings.playheadTop;
        setPlayheadTop(v >= 0 && v <= 100 ? v : 15);
      }
    } catch (err) {
      console.warn('Failed to restore snapshot', err);
    }
  }, [setClips, setMediaItems, setSelectedIds, setPlayhead, setPlayheadTop]);

  const undo = useCallback(() => history.undo(snapshot(), restore), [history, snapshot, restore]);
  const redo = useCallback(() => history.redo(snapshot(), restore), [history, snapshot, restore]);
  const togglePlaying = useCallback(() => setPlaying(p => !p), [setPlaying]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  useGlobalShortcuts({ undo, redo, togglePlaying, clearSelection });

  const { handleAddMedia, handleRemoveMedia, handleDropMediaPool, handleDragOverMediaPool } =
    useMediaLibrary({ mediaItems, setMediaItems, setClips, history, snapshot });

  const {
    handleDropMedia, handleSelectClip, handleNudge, handleSplitClip,
    handleTrimLatter, handleTrimFormer, handleJoin, handleFadeChange,
    handleFadeDragStart, handleFadeDragEnd,
    handleStepEdge, handleRollApply,
  } = useTimelineEditor({ clips, mediaItems, setClips, setSelectedIds, history, snapshot });

  // Export runs this timeline's export through timelineExport, whenever it's clicked
  useExportJob({ clips, mediaItems, totalFrames });
  const openExport = useCallback(() => { OpenExport(); }, []);

  const rollClip = rollClipId ? clips.find(c => c.id === rollClipId) ?? null : null;
  const rollMedia = rollClip ? mediaItems.get(rollClip.mediaId) ?? null : null;

  return (
    <div id="editor-container" style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
    <ShaderBackground />
    <div className="app-shell">
      {/* Background blocking overlay: sits below modal/torus overlays (z-index 199 vs 200) */}
      {blockBackground && (
        <div
          className="app-bg-lock"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
            background: 'transparent',
            pointerEvents: 'auto',
          }}
        />
      )}
      {Array.from(mediaItems.values()).map(item =>
        item.type === 'video' ? (
          <video key={item.id} id={`vid-${item.id}`} src={item.src} style={{ display: 'none' }} preload="auto" muted />
        ) : item.type === 'audio' ? (
          <audio key={item.id} id={`aud-${item.id}`} src={item.src} style={{ display: 'none' }} preload="auto" />
        ) : null
      )}
      <TitleBar />
      <div className="workspace">
        <WorkspaceDock
          onDropMediaPool={handleDropMediaPool}
          onDragOverMediaPool={handleDragOverMediaPool}
          mediaPool={
            <MediaPool items={Array.from(mediaItems.values())} selectedMediaId={selectedMediaId} onSelect={setSelectedMediaId} onAdd={handleAddMedia} onRemove={handleRemoveMedia} />
          }
          viewer={<>
            <Viewer clips={clips} mediaItems={mediaItems} playhead={playhead} playing={playing} totalFrames={totalFrames} onExport={openExport} />
            <ViewerControls
              style={{ marginTop: 'auto' }}
              clips={clips}
              mediaItems={mediaItems}
              playhead={playhead}
              playing={playing}
              totalFrames={totalFrames}
              onPlayPause={togglePlaying}
              onSeek={setPlayhead}
            />
          </>}
          timeline={
            <Timeline clips={clips} tracks={TRACKS} mediaItems={mediaItems} playhead={playhead} selectedIds={selectedIds} onSeek={setPlayhead} onDropMedia={handleDropMedia} onSelectClip={handleSelectClip} onSplitClip={handleSplitClip} onTrimLatter={handleTrimLatter} onTrimFormer={handleTrimFormer} onNudge={handleNudge} onJoin={handleJoin} onFadeChange={handleFadeChange} onFadeDragStart={handleFadeDragStart} onFadeDragEnd={handleFadeDragEnd} onRoll={setRollClipId} onStepEdge={handleStepEdge} totalFrames={totalFrames} />
          }
        />
      </div>
      {rollClip && rollMedia && (
        <RollDialog clip={rollClip} media={rollMedia} onClose={() => setRollClipId(null)} onApply={handleRollApply} />
      )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HistoryProvider>
      <AppContent />
    </HistoryProvider>
  );
}
