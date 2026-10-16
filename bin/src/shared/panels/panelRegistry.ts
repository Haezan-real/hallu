//src/shared/panels/panelRegistry.ts
import type { ComponentType } from 'react';
import { PANEL_POLICIES, isPanelKind, type PanelKind, type PanelSize } from './panelPolicies';

/** A tool's own options, e.g. which tab to show; restorable tools must keep them JSON-safe */
export type PanelParams = Record<string, unknown>;

export interface ToolPanelProps<P extends PanelParams = PanelParams> {
  params: P;
  close: () => void;
}

export interface ToolPanelDefinition<P extends PanelParams = PanelParams> {
  title: string;
  component: ComponentType<ToolPanelProps<P>>;
}

/** A floating window's bounds within the dock, in CSS pixels */
export interface FloatingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DockDirection = 'within' | 'left' | 'right' | 'above' | 'below';

/**
 * Where a tool was last seen: floating at a box, or docked beside (or as a tab of) another
 * panel; without a referencePanel, along that whole edge of the dock
 */
export type PanelLocation =
  | { type: 'floating'; box: FloatingBox }
  | { type: 'docked'; referencePanel?: string; direction: DockDirection; size: PanelSize };

export interface ToolPanelSpec {
  id: string;
  kind: PanelKind;
  title: string;
  params: PanelParams;
}

/** What the registry needs from the dock; app/dock/dockPanelHost.ts provides it */
export interface PanelHost {
  /** Size of the area floating windows live in */
  bounds(): PanelSize;
  addFloating(panel: ToolPanelSpec, box: FloatingBox): void;
  /** Returns false when the spot is gone, e.g. the panel it sat beside was closed */
  addDocked(panel: ToolPanelSpec, location: Extract<PanelLocation, { type: 'docked' }>): boolean;
  focus(id: string): void;
  remove(id: string): void;
  locate(id: string): PanelLocation | null;
  /** The panel shown in the focused group, if that group is floating */
  focusedFloating(): string | null;
}

export interface PanelRegistryOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

interface OpenPanel {
  id: string;
  kind: PanelKind;
  params: PanelParams;
}

export const LOCATIONS_KEY = 'hallu.panels.locations';
const ID_PREFIX = 'tool.';

export const isToolPanelId = (id: string) => id.startsWith(ID_PREFIX);

function isFiniteBox(box: unknown): box is FloatingBox {
  const b = box as FloatingBox | null;
  return !!b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0;
}

export function isLocation(value: unknown): value is PanelLocation {
  const location = value as PanelLocation | null;
  if (!location) return false;
  if (location.type === 'floating') return isFiniteBox(location.box);
  return location.type === 'docked'
    && (typeof location.referencePanel === 'string' || (location.referencePanel === undefined && location.direction !== 'within'))
    && ['within', 'left', 'right', 'above', 'below'].includes(location.direction)
    && Number.isFinite(location.size?.width) && Number.isFinite(location.size?.height);
}

/** Keeps a window inside the dock, shrinking it first if the dock got smaller */
export function clampBox(box: FloatingBox, bounds: PanelSize): FloatingBox {
  const width = Math.min(box.width, bounds.width);
  const height = Math.min(box.height, bounds.height);
  return {
    x: Math.min(Math.max(box.x, 0), Math.max(bounds.width - width, 0)),
    y: Math.min(Math.max(box.y, 0), Math.max(bounds.height - height, 0)),
    width,
    height,
  };
}

/**
 * Tool panels in the dock, at most one of each kind: opens them where they were last (floating
 * or docked) and remembers every tool's location for next time.
 */
export class PanelRegistry {
  private host: PanelHost | null = null;
  private open = new Map<string, OpenPanel>();
  private definitions = new Map<PanelKind, ToolPanelDefinition>();
  private backHandlers = new Map<string, () => boolean>();
  private locations: Partial<Record<PanelKind, PanelLocation>>;
  private listeners = new Set<() => void>();
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;

  constructor(options: PanelRegistryOptions = {}) {
    this.storage = options.storage ?? null;
    this.locations = this.readLocations();
  }

  define<P extends PanelParams>(kind: PanelKind, definition: ToolPanelDefinition<P>) {
    this.definitions.set(kind, definition as unknown as ToolPanelDefinition);
  }

  definition(kind: PanelKind): ToolPanelDefinition | undefined {
    return this.definitions.get(kind);
  }

  /**
   * Connects the dock once its saved layout is restored. `restored` are the tool panels that
   * came back with it: restorable tools whose kind is defined stay, the rest are closed.
   */
  attach(host: PanelHost, restored: readonly { id: string; params: unknown }[]): () => void {
    this.host = host;
    this.open.clear();
    for (const { id, params } of restored) {
      const data = params as { kind?: unknown; params?: unknown } | undefined;
      const kind = data?.kind;
      if (!isPanelKind(kind) || !PANEL_POLICIES[kind].restorable || !this.definitions.has(kind)) {
        host.remove(id);
        continue;
      }
      this.open.set(id, { id, kind, params: (data?.params as PanelParams) ?? {} });
    }
    this.emit();
    return () => {
      if (this.host === host) this.host = null;
    };
  }

  /**
   * Opens a tool, or focuses it if it's already open. New windows go where that kind was last,
   * or float in the middle of the dock. Returns the panel id, or null when it couldn't open
   * (unknown kind, or no dock yet).
   */
  openPanel<P extends PanelParams>(kind: PanelKind, params?: P): string | null {
    const host = this.host;
    const definition = this.definitions.get(kind);
    if (!host || !definition) return null;

    const existing = this.find(kind);
    if (existing) {
      host.focus(existing.id);
      return existing.id;
    }

    const id = `${ID_PREFIX}${kind}`;
    const spec: ToolPanelSpec = { id, kind, title: definition.title, params: params ?? {} };
    // Registered first so the dock's add events already see it as open
    this.open.set(id, { id, kind, params: spec.params });
    const location = this.locations[kind];
    const docked = location?.type === 'docked' && host.addDocked(spec, location);
    if (!docked) host.addFloating(spec, this.floatingBox(kind, location, host.bounds()));
    this.emit();
    return id;
  }

  /** Closes a panel by id or kind. Returns whether one closed */
  closePanel(kindOrId: PanelKind | string): boolean {
    const panel = this.open.get(kindOrId) ?? this.find(kindOrId as PanelKind);
    if (!panel || !this.host) return false;
    this.record(panel);
    this.host.remove(panel.id);
    this.panelRemoved(panel.id);
    return true;
  }

  isPanelOpen(kind: PanelKind): boolean {
    return this.find(kind) !== undefined;
  }

  /**
   * Exit shortcut: the focused floating tool steps back (e.g. out of a folder) if its back
   * handler says it did, or else closes. Returns whether anything happened.
   */
  closeFocusedFloating(): boolean {
    const id = this.host?.focusedFloating();
    if (!id || !this.open.has(id)) return false;
    return this.backHandlers.get(id)?.() || this.closePanel(id);
  }

  /** What the exit shortcut does first in a panel; return false to let it close. Returns an unregister function */
  setBackHandler(id: string, back: () => boolean): () => void {
    this.backHandlers.set(id, back);
    return () => {
      if (this.backHandlers.get(id) === back) this.backHandlers.delete(id);
    };
  }

  /** The dock removed a panel, e.g. through its close button */
  panelRemoved(id: string) {
    this.backHandlers.delete(id);
    if (this.open.delete(id)) this.emit();
  }

  /** The dock layout changed: remember where every open tool now is */
  recordLocations() {
    let changed = false;
    for (const panel of this.open.values()) changed = this.record(panel, false) || changed;
    if (changed) this.saveLocations();
  }

  location(kind: PanelKind): PanelLocation | undefined {
    return this.locations[kind];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private find(kind: PanelKind): OpenPanel | undefined {
    return [...this.open.values()].find(panel => panel.kind === kind);
  }

  private floatingBox(kind: PanelKind, location: PanelLocation | undefined, bounds: PanelSize): FloatingBox {
    if (location?.type === 'floating') return clampBox(location.box, bounds);
    const size = location?.type === 'docked' ? location.size : PANEL_POLICIES[kind].defaultSize;
    return clampBox({ x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2, ...size }, bounds);
  }

  private record(panel: OpenPanel, save = true): boolean {
    const location = this.host?.locate(panel.id);
    if (!location || JSON.stringify(location) === JSON.stringify(this.locations[panel.kind])) return false;
    this.locations[panel.kind] = location;
    if (save) this.saveLocations();
    return true;
  }

  private readLocations(): Partial<Record<PanelKind, PanelLocation>> {
    try {
      const raw = this.storage?.getItem(LOCATIONS_KEY);
      const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      const locations: Partial<Record<PanelKind, PanelLocation>> = {};
      for (const [kind, location] of Object.entries(parsed)) {
        if (isPanelKind(kind) && isLocation(location)) locations[kind] = location;
      }
      return locations;
    } catch {
      return {};
    }
  }

  private saveLocations() {
    try {
      this.storage?.setItem(LOCATIONS_KEY, JSON.stringify(this.locations));
    } catch {
      // Storage can be unavailable; locations are still remembered for this session
    }
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}
