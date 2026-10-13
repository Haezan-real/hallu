//src/App.tsx
import { useState, useCallback } from 'react';
import MediaPool from './panels/MediaPool';
import Viewer from './panels/Viewer';
import ViewerControls from './panels/ViewerControls';
import Timeline from './panels/Timeline';
import RollDialog from './modals/RollDialog';
import ExportModal from './modals/ExportModal';
import { parentMap, StylesModal } from './modals/Styles';
import TitleBar from './window/TitleBar';
import Splitter from './ui/Splitter';
import type { MediaItem, TimelineClip } from './types';
import { HistoryProvider, useHistory, type AppSnapshot } from './core/history';
import { useShortcutLifecycle } from './core/settings/shortcuts';
import { useGlobalShortcuts } from './core/settings/useGlobalShortcuts';
import { useLayoutSettings } from './core/settings/useLayoutSettings';
import { useAppearance } from './core/themes/useAppearance';
import { useExportJob } from './core/media/useExportJob';
import { useMediaLibrary } from './core/media/useMediaLibrary';
import { usePlaybackClock } from './core/media/usePlaybackClock';
import { TRACKS, useTimelineEditor } from './core/timeline/useTimelineEditor';
import { modalManager, registerModalPermissions, showToast } from './core/modals';
import { useBackgroundLock } from './core/modals/useBackgroundLock';
import { useSuppressContextMenu } from './platform/useSuppressContextMenu';

const MULTIPLE_MENUS_MESSAGE = 'opening multiple <br/> menus is disabled!';

registerModalPermissions();

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
  const [showExport, setShowExport] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [stylePage, setStylePage] = useState<string | null>(null);

  const totalFrames = clips.reduce((max, c) => Math.max(max, c.endFrame), 0);
  const { playhead, setPlayhead, playing, setPlaying } = usePlaybackClock(totalFrames);

  const {
    playheadTop,
    setPlayheadTop,
    includeResizeInUndo,
    setIncludeResizeInUndo,
    leftWidthPct,
    setLeftWidthPct,
    leftCollapsed,
    timelineHeightPct,
    setTimelineHeightPct,
  } = useLayoutSettings();

  const snapshot = useCallback(() => ({
    clips: JSON.parse(JSON.stringify(clips)),
    mediaItems: Array.from(mediaItems.entries()),
    selectedIds: [...selectedIds],
    playhead,
    settings: { playheadTop, includeResizeInUndo },
    layout: { leftWidthPct, timelineHeightPct }
  }), [clips, mediaItems, selectedIds, playhead, playheadTop, includeResizeInUndo, leftWidthPct, timelineHeightPct]);

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
      const layout = typeof snap.layout === 'object' && snap.layout !== null ? snap.layout as Record<string, unknown> : {};
      if (settings) {
        if (typeof settings.playheadTop === 'number') {
          const v = settings.playheadTop;
          setPlayheadTop(v >= 0 && v <= 100 ? v : 15);
        }
        setIncludeResizeInUndo(typeof settings.includeResizeInUndo === 'boolean' ? settings.includeResizeInUndo : includeResizeInUndo);
      }
      if (layout) {
        setLeftWidthPct(typeof layout.leftWidthPct === 'number' ? layout.leftWidthPct : leftWidthPct);
        setTimelineHeightPct(typeof layout.timelineHeightPct === 'number' ? layout.timelineHeightPct : timelineHeightPct);
      }
    } catch (err) {
      console.warn('Failed to restore snapshot', err);
    }
  }, [setClips, setMediaItems, setSelectedIds, setPlayhead, playheadTop, includeResizeInUndo, leftWidthPct, timelineHeightPct]);

  // Opens a modal whose visibility lives in App state, if the modal manager allows it
  const openStateModal = useCallback((type: 'styles' | 'export', setOpen: (open: boolean) => void) => {
    const result = modalManager.requestOpen(type);
    if (!result.allowed) {
      showToast(MULTIPLE_MENUS_MESSAGE);
      return;
    }
    modalManager.registerClose(result.id!, () => setOpen(false));
    setOpen(true);
  }, []);

  // Styles goes back one level if inside a sub-page, otherwise closes
  const closeStateModal = useCallback(() => {
    if (showExport) { setShowExport(false); return true; }
    if (showStyle) {
      if (stylePage) setStylePage(parentMap[stylePage] || null);
      else setShowStyle(false);
      return true;
    }
    return false;
  }, [showExport, showStyle, stylePage]);

  const undo = useCallback(() => history.undo(snapshot(), restore), [history, snapshot, restore]);
  const redo = useCallback(() => history.redo(snapshot(), restore), [history, snapshot, restore]);
  const togglePlaying = useCallback(() => setPlaying(p => !p), [setPlaying]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  useGlobalShortcuts({ undo, redo, togglePlaying, clearSelection, closeStateModal });

  const { handleAddMedia, handleRemoveMedia, handleDropMediaPool, handleDragOverMediaPool } =
    useMediaLibrary({ mediaItems, setMediaItems, setClips, history, snapshot });

  const {
    handleDropMedia, handleSelectClip, handleNudge, handleSplitClip,
    handleTrimLatter, handleTrimFormer, handleJoin, handleFadeChange,
    handleFadeDragStart, handleFadeDragEnd,
    handleStepEdge, handleRollApply,
  } = useTimelineEditor({ clips, mediaItems, setClips, setSelectedIds, history, snapshot });

  const { exportVideo: handleExport } = useExportJob({ clips, mediaItems, totalFrames });

  const rollClip = rollClipId ? clips.find(c => c.id === rollClipId) ?? null : null;
  const rollMedia = rollClip ? mediaItems.get(rollClip.mediaId) ?? null : null;

  return (
    <div id="editor-container" style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
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
      <TitleBar onOpenStyles={() => openStateModal('styles', setShowStyle)} />
      <div
        className="workspace"
        style={{
          '--timeline-height': `${timelineHeightPct}vh`,
          '--left-width': leftCollapsed ? '36px' : `${leftWidthPct}vw`,
          '--vsplit-width': leftCollapsed ? '0px' : '8px',
        } as React.CSSProperties}
      >
        <div className="workspace-panel-mediapool" onDrop={handleDropMediaPool} onDragOver={handleDragOverMediaPool}>
          {!leftCollapsed && (
            <MediaPool items={Array.from(mediaItems.values())} selectedMediaId={selectedMediaId} onSelect={setSelectedMediaId} onAdd={handleAddMedia} onRemove={handleRemoveMedia} />
          )}
        </div>

        {!leftCollapsed && (
          <div className="workspace-vsplit">
             <Splitter orientation="vertical" onChange={(dx) => {
               const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
               const dxPct = dx / viewportWidth * 100;
               setLeftWidthPct(w => Math.max(5, Math.min(50, w + dxPct)));
             }} onDragEnd={() => { history.push({ ...snapshot(), __meta: { type: 'resize' } }); }} />
          </div>
        )}

        <div className="workspace-panel-viewer">
          <Viewer clips={clips} mediaItems={mediaItems} playhead={playhead} playing={playing} totalFrames={totalFrames} onExport={() => openStateModal('export', setShowExport)} />
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
        </div>

        <div className="workspace-hsplit">
          <Splitter orientation="horizontal" thickness={8} onChange={(dy) => {
            const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
            const dyPct = dy / viewportHeight * 100;
            setTimelineHeightPct(h => Math.max(15, Math.min(60, h - dyPct)));
          }} onDragEnd={() => { history.push({ ...snapshot(), __meta: { type: 'resize' } }); }} />
        </div>

        <Timeline clips={clips} tracks={TRACKS} mediaItems={mediaItems} playhead={playhead} selectedIds={selectedIds} onSeek={setPlayhead} onDropMedia={handleDropMedia} onSelectClip={handleSelectClip} onSplitClip={handleSplitClip} onTrimLatter={handleTrimLatter} onTrimFormer={handleTrimFormer} onNudge={handleNudge} onJoin={handleJoin} onFadeChange={handleFadeChange} onFadeDragStart={handleFadeDragStart} onFadeDragEnd={handleFadeDragEnd} onRoll={setRollClipId} onStepEdge={handleStepEdge} totalFrames={totalFrames} />
      </div>
      {showExport && (
        <ExportModal
          onClose={() => {
            modalManager.close('export');
            setShowExport(false);
          }}
          onExport={() => void handleExport()}
        />
      )}
      <StylesModal showStyle={showStyle} setShowStyle={(v) => {
        setShowStyle(v);
        if (!v) modalManager.close('styles');
      }} stylePage={stylePage} setStylePage={setStylePage} />
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
