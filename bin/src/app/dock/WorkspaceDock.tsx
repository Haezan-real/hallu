//src/app/dock/WorkspaceDock.tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  DockviewReact,
  type DockviewGroupPanelApi,
  type DockviewReadyEvent,
  type DockviewTheme,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { SHADER_PANEL, useShaderPanel } from '../../features/shaders/shaderPanels';
import { DockPanelContext, registerPanelActionsTarget, type DockPanelHandle } from '../../shared/dock/dockPanel';
import { initDockLayout, isCorePanel } from './dockLayout';

/** Same thickness as the splitters the dock replaced */
const SPLITTER_SIZE = 8; //px

// The colours live in index.css (.dockview-theme-hallu), driven by our theme variables
const HALLU_DOCK_THEME: DockviewTheme = {
  name: 'hallu',
  className: 'dockview-theme-hallu',
  colorScheme: 'dark',
  gap: SPLITTER_SIZE,
};

/** Shader packs see the whole group, header included, like the panels before docking */
const SHADER_FRAME = '.dv-groupview';

/** What App renders into each dock panel; panels read it from context so they follow App's state */
export interface WorkspacePanels {
  mediaPool: ReactNode;
  viewer: ReactNode;
  timeline: ReactNode;
  onDropMediaPool: (event: DragEvent<HTMLDivElement>) => void;
  onDragOverMediaPool: (event: DragEvent<HTMLDivElement>) => void;
}

const PanelsContext = createContext<WorkspacePanels | null>(null);

function usePanels(): WorkspacePanels {
  const panels = useContext(PanelsContext);
  if (!panels) throw new Error('Dock panels must render inside WorkspaceDock');
  return panels;
}

function DockPanel({ api, children }: { api: IDockviewPanelProps['api']; children: ReactNode }) {
  const handle = useMemo<DockPanelHandle>(() => ({ id: api.id, setTitle: title => api.setTitle(title) }), [api]);
  return <DockPanelContext.Provider value={handle}>{children}</DockPanelContext.Provider>;
}

function MediaPoolPanel({ api }: IDockviewPanelProps) {
  const { mediaPool, onDropMediaPool, onDragOverMediaPool } = usePanels();
  const ref = useRef<HTMLDivElement>(null);
  useShaderPanel(ref, SHADER_PANEL.mediaPool, SHADER_FRAME);
  return (
    <DockPanel api={api}>
      <div ref={ref} className="workspace-panel-mediapool" onDrop={onDropMediaPool} onDragOver={onDragOverMediaPool}>
        {mediaPool}
      </div>
    </DockPanel>
  );
}

function ViewerPanel({ api }: IDockviewPanelProps) {
  const { viewer } = usePanels();
  const ref = useRef<HTMLDivElement>(null);
  useShaderPanel(ref, SHADER_PANEL.viewer, SHADER_FRAME);
  return (
    <DockPanel api={api}>
      <div ref={ref} className="workspace-panel-viewer">{viewer}</div>
    </DockPanel>
  );
}

function TimelinePanel({ api }: IDockviewPanelProps) {
  const { timeline } = usePanels();
  const ref = useRef<HTMLDivElement>(null);
  useShaderPanel(ref, SHADER_PANEL.timeline, SHADER_FRAME);
  return (
    <DockPanel api={api}>
      <div ref={ref} className="workspace-panel-timeline">{timeline}</div>
    </DockPanel>
  );
}

const COMPONENTS = {
  mediaPool: MediaPoolPanel,
  viewer: ViewerPanel,
  timeline: TimelinePanel,
};

function DockTab({ api }: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(api.title ?? '');
  useEffect(() => {
    setTitle(api.title ?? '');
    const subscription = api.onDidTitleChange(event => setTitle(event.title));
    return () => subscription.dispose();
  }, [api]);

  return (
    <div className="dock-tab">
      <span className="panel-title">{title}</span>
      {!isCorePanel(api.id) && (
        <button
          type="button"
          className="dock-tab-close"
          title="Close"
          onPointerDown={event => event.preventDefault()}
          onClick={event => { event.stopPropagation(); api.close(); }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function useGroupLocation(api: DockviewGroupPanelApi) {
  const [location, setLocation] = useState(api.location.type);
  useEffect(() => {
    setLocation(api.location.type);
    const subscription = api.onDidLocationChange(event => setLocation(event.location.type));
    return () => subscription.dispose();
  }, [api]);
  return location;
}

/** The red and yellow dots of a floating group's title bar */
function FloatingWindowControls({ group, panels }: Pick<IDockviewHeaderActionsProps, 'group' | 'panels'>) {
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    const floatingWindow = group.element.closest('.dv-resize-container');
    floatingWindow?.classList.toggle('dock-floating-minimized', minimized);
    return () => floatingWindow?.classList.remove('dock-floating-minimized');
  }, [group, minimized]);

  // Core panels can't close, so closing their window puts them back into the layout
  const holdsCorePanel = panels.some(panel => isCorePanel(panel.id));
  const close = () => (holdsCorePanel ? group.api.moveTo({ position: 'right' }) : group.api.close());

  return (
    <div className="dock-window-controls">
      <button
        type="button"
        className="status-dot"
        data-color="yellow"
        title={minimized ? 'Restore' : 'Minimize'}
        onClick={() => setMinimized(value => !value)}
      />
      <button
        type="button"
        className="status-dot"
        data-color="red"
        title={holdsCorePanel ? 'Dock back into the layout' : 'Close'}
        onClick={close}
      />
    </div>
  );
}

/** Right side of every group header: the shown panel's own controls, plus window dots when floating */
function GroupHeaderActions({ api, group, panels, activePanel }: IDockviewHeaderActionsProps) {
  const location = useGroupLocation(api);
  const [actionsElement, setActionsElement] = useState<HTMLDivElement | null>(null);
  const panelId = activePanel?.id;
  useEffect(() => {
    if (!panelId || !actionsElement) return;
    return registerPanelActionsTarget(panelId, actionsElement);
  }, [panelId, actionsElement]);

  return (
    <div className="dock-header-actions">
      <div ref={setActionsElement} className="dock-panel-actions" />
      {location === 'floating' && <FloatingWindowControls group={group} panels={panels} />}
    </div>
  );
}

export default function WorkspaceDock(panels: WorkspacePanels) {
  // Not disposed on unmount: StrictMode's rehearsal unmount keeps the same dockview instance
  const disposeLayout = useRef<(() => void) | null>(null);

  const onReady = (event: DockviewReadyEvent) => {
    disposeLayout.current?.();
    disposeLayout.current = initDockLayout(event.api);
  };

  return (
    <PanelsContext.Provider value={panels}>
      <DockviewReact
        className="workspace-dock"
        theme={HALLU_DOCK_THEME}
        components={COMPONENTS}
        defaultTabComponent={DockTab}
        rightHeaderActionsComponent={GroupHeaderActions}
        floatingGroupDragHandle="tabbar"
        onReady={onReady}
      />
    </PanelsContext.Provider>
  );
}
