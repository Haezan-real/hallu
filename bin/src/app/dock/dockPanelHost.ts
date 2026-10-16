//src/app/dock/dockPanelHost.ts
import type { DockviewApi, DockviewGroupPanel } from 'dockview-react';
import { panelRegistry } from '../../shared/panels/openPanel';
import type { PanelKind } from '../../shared/panels/panelPolicies';
import { corePanels } from './corePanels';
import { CORE_PANELS, isCorePanel, type CorePanelId } from './dockLayout';
import {
  isToolPanelId,
  type DockDirection,
  type FloatingBox,
  type PanelHost,
  type PanelLocation,
  type PanelParams,
  type ToolPanelSpec,
} from '../../shared/panels/panelRegistry';

/** The dockview component every tool panel renders through (WorkspaceDock's ToolPanel) */
export const TOOL_COMPONENT = 'tool';

export interface ToolPanelData {
  kind: PanelKind;
  params: PanelParams;
}

const FLOATING_WINDOW = '.dv-resize-container';
/** How far apart two groups' edges may be and still count as touching (the splitter gap and then some) */
const EDGE_TOLERANCE = 16; //px

const toolPanelData = ({ kind, params }: ToolPanelSpec): ToolPanelData => ({ kind, params });

/** The dock edge a group runs the whole length of, so it reopens there instead of beside one panel */
function dockEdge(group: DockviewGroupPanel, api: DockviewApi): Exclude<DockDirection, 'within'> | null {
  const dock = group.element.closest('.dv-dockview')?.getBoundingClientRect();
  if (!dock) return null;
  const own = group.element.getBoundingClientRect();
  const near = (a: number, b: number) => Math.abs(a - b) <= EDGE_TOLERANCE;
  const fullHeight = near(own.top, dock.top) && near(own.bottom, dock.bottom);
  const fullWidth = near(own.left, dock.left) && near(own.right, dock.right);
  const others = api.groups.filter(other => other !== group && other.api.location.type === 'grid').length;
  if (others === 0) return null;
  if (fullHeight && near(own.right, dock.right)) return 'right';
  if (fullHeight && near(own.left, dock.left)) return 'left';
  if (fullWidth && near(own.bottom, dock.bottom)) return 'below';
  if (fullWidth && near(own.top, dock.top)) return 'above';
  return null;
}

/**
 * A docked group's neighbour to reopen beside, and on which side of it, judged by their edges.
 * A neighbour whose touching edge is exactly as long as the group's own was split from it, so
 * reopening beside it rebuilds the same split; otherwise the longest shared edge wins.
 */
function dockedNeighbour(group: DockviewGroupPanel, api: DockviewApi): { referencePanel: string; direction: DockDirection } | null {
  const own = group.element.getBoundingClientRect();
  const near = (a: number, b: number) => Math.abs(a - b) <= EDGE_TOLERANCE;
  let best: { referencePanel: string; direction: DockDirection; overlap: number; matched: boolean } | null = null;
  for (const other of api.groups) {
    const referencePanel = other.activePanel?.id;
    if (other === group || other.api.location.type !== 'grid' || !referencePanel) continue;
    const rect = other.element.getBoundingClientRect();
    const across = Math.min(own.bottom, rect.bottom) - Math.max(own.top, rect.top);
    const along = Math.min(own.right, rect.right) - Math.max(own.left, rect.left);
    const sameHeight = near(own.top, rect.top) && near(own.bottom, rect.bottom);
    const sameWidth = near(own.left, rect.left) && near(own.right, rect.right);
    const sides: [DockDirection, number, number, boolean][] = [
      ['right', own.left - rect.right, across, sameHeight],
      ['left', rect.left - own.right, across, sameHeight],
      ['below', own.top - rect.bottom, along, sameWidth],
      ['above', rect.top - own.bottom, along, sameWidth],
    ];
    for (const [direction, gap, overlap, matched] of sides) {
      if (Math.abs(gap) > EDGE_TOLERANCE || overlap <= 0) continue;
      const better = !best || (matched !== best.matched ? matched : overlap > best.overlap);
      if (better) best = { referencePanel, direction, overlap, matched };
    }
  }
  return best && { referencePanel: best.referencePanel, direction: best.direction };
}

/** What to add to the dock: which component renders it, and with what */
export interface DockPanelOptions {
  id: string;
  component: string;
  title: string;
  params?: object;
}

export function addFloatingPanel(api: DockviewApi, panel: DockPanelOptions, box: FloatingBox) {
  api.addPanel({ ...panel, floating: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

/** Docks a panel back at a recorded location; returns false when that spot is gone */
export function addDockedPanel(api: DockviewApi, panel: DockPanelOptions, location: Extract<PanelLocation, { type: 'docked' }>): boolean {
  const { referencePanel, direction, size } = location;
  if (referencePanel ? !api.getPanel(referencePanel) : direction === 'within') return false;
  // Only the size along the split: the other one would resize the panels it's split from
  const sideways = direction === 'left' || direction === 'right';
  const stacked = direction === 'above' || direction === 'below';
  // A split can rebuild the branches around it (a whole dock edge rebuilds the grid's root),
  // which loses the sizes across it
  const kept = !sideways && !stacked ? [] : api.groups
    .filter(group => group.api.location.type === 'grid')
    .map(group => ({ group, width: group.width, height: group.height }));
  const added = api.addPanel({
    ...panel,
    position: referencePanel ? { referencePanel, direction } : { direction },
    ...(sideways && { initialWidth: size.width }),
    ...(stacked && { initialHeight: size.height }),
  });
  for (const { group, width, height } of kept) {
    setMeasuredSize(group, sideways ? { height } : { width });
  }
  setMeasuredSize(added.group, sideways ? { width: size.width } : stacked ? { height: size.height } : {});
  return true;
}

/**
 * Sizes set on a group include the gap between groups, which its measured size doesn't, so
 * setting a measured size alone would shrink the group a little every time
 */
function setMeasuredSize(group: DockviewGroupPanel, size: { width?: number; height?: number }) {
  const { width, height } = size;
  if (width !== undefined) group.api.setSize({ width });
  if (height !== undefined) group.api.setSize({ height });
  if (width !== undefined && group.width !== width) group.api.setSize({ width: width + (width - group.width) });
  if (height !== undefined && group.height !== height) group.api.setSize({ height: height + (height - group.height) });
}

/** Where a panel is now, in a form addDockedPanel and addFloatingPanel can put it back at */
export function locatePanel(api: DockviewApi, id: string): PanelLocation | null {
  const group = api.getPanel(id)?.group;
  if (!group) return null;
  const type = group.api.location.type;
  if (type === 'floating') {
    const floatingWindow = group.element.closest<HTMLElement>(FLOATING_WINDOW);
    if (!floatingWindow) return null;
    const { offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height } = floatingWindow;
    return { type: 'floating', box: { x, y, width, height } };
  }
  if (type !== 'grid') return null;
  const size = { width: group.width, height: group.height };
  const tabmate = group.panels.find(panel => panel.id !== id);
  if (tabmate) return { type: 'docked', referencePanel: tabmate.id, direction: 'within', size };
  const edge = dockEdge(group, api);
  if (edge) return { type: 'docked', direction: edge, size };
  const neighbour = dockedNeighbour(group, api);
  return neighbour && { type: 'docked', ...neighbour, size };
}

const toolPanelOptions = (panel: ToolPanelSpec): DockPanelOptions =>
  ({ id: panel.id, component: TOOL_COMPONENT, title: panel.title, params: toolPanelData(panel) });

export function createDockPanelHost(api: DockviewApi): PanelHost {
  return {
    bounds: () => ({ width: api.width, height: api.height }),
    addFloating: (panel, box) => addFloatingPanel(api, toolPanelOptions(panel), box),
    addDocked: (panel, location) => addDockedPanel(api, toolPanelOptions(panel), location),
    focus: id => api.getPanel(id)?.api.setActive(),
    remove: id => api.getPanel(id)?.api.close(),
    locate: id => locatePanel(api, id),

    focusedFloating() {
      const group = api.activeGroup;
      return group?.api.location.type === 'floating' ? group.activePanel?.id ?? null : null;
    },
  };
}

/**
 * Connects the panel registry to the dock after its layout is restored, then keeps it told
 * about closed panels and layout changes. Returns a dispose function.
 */
export function attachDockPanelRegistry(api: DockviewApi): () => void {
  const restored = api.panels
    .filter(panel => isToolPanelId(panel.id))
    .map(panel => ({ id: panel.id, params: panel.params }));
  const detach = panelRegistry.attach(createDockPanelHost(api), restored);
  const subscriptions = [
    api.onDidRemovePanel(panel => panelRegistry.panelRemoved(panel.id)),
    api.onDidLayoutChange(() => panelRegistry.recordLocations()),
  ];
  return () => {
    for (const subscription of subscriptions) subscription.dispose();
    detach();
  };
}

/** Connects the media pool, viewer and timeline toggles to the dock. Returns a dispose function */
export function attachCorePanels(api: DockviewApi): () => void {
  const options = (id: CorePanelId): DockPanelOptions => ({ id, component: id, title: CORE_PANELS[id].title });
  const detach = corePanels.attach({
    bounds: () => ({ width: api.width, height: api.height }),
    isOpen: id => api.getPanel(id) !== undefined,
    addFloating: (id, box) => addFloatingPanel(api, options(id), box),
    addDocked: (id, location) => addDockedPanel(api, options(id), location),
    focus: id => api.getPanel(id)?.api.setActive(),
    remove: id => api.getPanel(id)?.api.close(),
    locate: id => locatePanel(api, id),
  });
  const changed = () => corePanels.panelsChanged();
  const subscriptions = [
    api.onDidAddPanel(changed),
    api.onDidRemovePanel(changed),
    api.onDidLayoutFromJSON(changed),
    api.onDidLayoutChange(() => corePanels.recordLocations()),
  ];
  return () => {
    for (const subscription of subscriptions) subscription.dispose();
    detach();
  };
}

/** What a panel's close button does: core panels and tools remember where they were */
export function closeDockPanel(panel: { id: string; api: { close(): void } }) {
  if (isCorePanel(panel.id)) corePanels.close(panel.id);
  else if (!panelRegistry.closePanel(panel.id)) panel.api.close();
}
