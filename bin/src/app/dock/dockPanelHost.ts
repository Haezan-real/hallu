//src/app/dock/dockPanelHost.ts
import type { DockviewApi, DockviewGroupPanel } from 'dockview-react';
import { panelRegistry } from '../../shared/panels/openPanel';
import type { PanelKind } from '../../shared/panels/panelPolicies';
import {
  isToolPanelId,
  type DockDirection,
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

/** A docked group's neighbour to reopen beside, and on which side of it, judged by their edges */
function dockedNeighbour(group: DockviewGroupPanel, api: DockviewApi): { referencePanel: string; direction: DockDirection } | null {
  const own = group.element.getBoundingClientRect();
  let best: { referencePanel: string; direction: DockDirection; overlap: number } | null = null;
  for (const other of api.groups) {
    const referencePanel = other.activePanel?.id;
    if (other === group || other.api.location.type !== 'grid' || !referencePanel) continue;
    const rect = other.element.getBoundingClientRect();
    const across = Math.min(own.bottom, rect.bottom) - Math.max(own.top, rect.top);
    const along = Math.min(own.right, rect.right) - Math.max(own.left, rect.left);
    const sides: [DockDirection, number, number][] = [
      ['right', own.left - rect.right, across],
      ['left', rect.left - own.right, across],
      ['below', own.top - rect.bottom, along],
      ['above', rect.top - own.bottom, along],
    ];
    for (const [direction, gap, overlap] of sides) {
      if (Math.abs(gap) > EDGE_TOLERANCE || overlap <= 0) continue;
      if (!best || overlap > best.overlap) best = { referencePanel, direction, overlap };
    }
  }
  return best && { referencePanel: best.referencePanel, direction: best.direction };
}

export function createDockPanelHost(api: DockviewApi): PanelHost {
  return {
    bounds: () => ({ width: api.width, height: api.height }),

    addFloating(panel, box) {
      api.addPanel({
        id: panel.id,
        component: TOOL_COMPONENT,
        title: panel.title,
        params: toolPanelData(panel),
        floating: { x: box.x, y: box.y, width: box.width, height: box.height },
      });
    },

    addDocked(panel, location) {
      const { referencePanel, direction, size } = location;
      if (referencePanel ? !api.getPanel(referencePanel) : direction === 'within') return false;
      // Only the size along the split: the other one would resize the panels it's split from
      const sideways = direction === 'left' || direction === 'right';
      const stacked = direction === 'above' || direction === 'below';
      // Splitting off a whole dock edge rebuilds the grid's root and loses the sizes across it
      const kept = referencePanel ? [] : api.groups
        .filter(group => group.api.location.type === 'grid')
        .map(group => ({ group, width: group.width, height: group.height }));
      const added = api.addPanel({
        id: panel.id,
        component: TOOL_COMPONENT,
        title: panel.title,
        params: toolPanelData(panel),
        position: referencePanel ? { referencePanel, direction } : { direction },
        ...(sideways && { initialWidth: size.width }),
        ...(stacked && { initialHeight: size.height }),
      });
      for (const { group, width, height } of kept) {
        group.api.setSize(sideways ? { height } : { width });
      }
      // Sizes set on a group include the gap between groups, which its measured size doesn't,
      // so setting the recorded size alone would shrink the tool on every reopen
      const { group } = added;
      if (sideways) group.api.setSize({ width: size.width + (size.width - group.width) });
      if (stacked) group.api.setSize({ height: size.height + (size.height - group.height) });
      return true;
    },

    focus: id => api.getPanel(id)?.api.setActive(),

    remove: id => api.getPanel(id)?.api.close(),

    locate(id): PanelLocation | null {
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
    },

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
