//src/app/dock/corePanels.ts
// Opening and closing the media pool, viewer and timeline from the title bar
import { useSyncExternalStore } from 'react';
import { clampBox, isLocation, type FloatingBox, type PanelLocation, type PanelSize } from '../../shared/panels/panelRegistry';
import type { CorePanelId } from './dockLayout';

export interface CorePanelHost {
  bounds(): PanelSize;
  isOpen(id: CorePanelId): boolean;
  addFloating(id: CorePanelId, box: FloatingBox): void;
  /** Returns false when the recorded spot is gone */
  addDocked(id: CorePanelId, location: Extract<PanelLocation, { type: 'docked' }>): boolean;
  focus(id: CorePanelId): void;
  remove(id: CorePanelId): void;
  locate(id: CorePanelId): PanelLocation | null;
}

export const CORE_LOCATIONS_KEY = 'hallu.layout.corePanels';
const CORE_IDS: readonly CorePanelId[] = ['mediaPool', 'viewer', 'timeline'];
/** Size of a core panel reopened with nowhere recorded to go */
const FALLBACK_SIZE: PanelSize = { width: 640, height: 400 };

/**
 * The media pool, viewer and timeline can be closed and reopened. Closed ones stay out of the
 * saved dock layout; this remembers where each one was so it reopens there.
 */
export class CorePanels {
  private host: CorePanelHost | null = null;
  private locations: Partial<Record<CorePanelId, PanelLocation>>;
  private listeners = new Set<() => void>();
  private storage: Pick<Storage, 'getItem' | 'setItem'> | null;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    this.storage = storage;
    this.locations = this.readLocations();
  }

  attach(host: CorePanelHost): () => void {
    this.host = host;
    this.emit();
    return () => {
      if (this.host !== host) return;
      this.host = null;
      this.emit();
    };
  }

  isOpen(id: CorePanelId): boolean {
    return this.host?.isOpen(id) ?? false;
  }

  /** Opens a core panel where it was last, or focuses it if it's already open */
  open(id: CorePanelId) {
    const host = this.host;
    if (!host) return;
    if (host.isOpen(id)) {
      host.focus(id);
      return;
    }
    const location = this.locations[id];
    const docked = location?.type === 'docked' && host.addDocked(id, location);
    if (!docked) host.addFloating(id, this.floatingBox(location, host.bounds()));
    host.focus(id);
    this.emit();
  }

  close(id: CorePanelId) {
    const host = this.host;
    if (!host?.isOpen(id)) return;
    this.record(id);
    host.remove(id);
    this.emit();
  }

  toggle(id: CorePanelId) {
    if (this.isOpen(id)) this.close(id);
    else this.open(id);
  }

  /** The dock added or removed panels */
  panelsChanged() {
    this.emit();
  }

  /** The dock layout changed: remember where every open core panel now is */
  recordLocations() {
    let changed = false;
    for (const id of CORE_IDS) {
      if (this.isOpen(id)) changed = this.record(id, false) || changed;
    }
    if (changed) this.saveLocations();
  }

  location(id: CorePanelId): PanelLocation | undefined {
    return this.locations[id];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private floatingBox(location: PanelLocation | undefined, bounds: PanelSize): FloatingBox {
    if (location?.type === 'floating') return clampBox(location.box, bounds);
    const size = location?.type === 'docked' ? location.size : FALLBACK_SIZE;
    return clampBox({ x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2, ...size }, bounds);
  }

  private record(id: CorePanelId, save = true): boolean {
    const location = this.host?.locate(id);
    if (!location || JSON.stringify(location) === JSON.stringify(this.locations[id])) return false;
    this.locations[id] = location;
    if (save) this.saveLocations();
    return true;
  }

  private readLocations(): Partial<Record<CorePanelId, PanelLocation>> {
    try {
      const raw = this.storage?.getItem(CORE_LOCATIONS_KEY);
      const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      const locations: Partial<Record<CorePanelId, PanelLocation>> = {};
      for (const id of CORE_IDS) {
        if (isLocation(parsed[id])) locations[id] = parsed[id];
      }
      return locations;
    } catch {
      return {};
    }
  }

  private saveLocations() {
    try {
      this.storage?.setItem(CORE_LOCATIONS_KEY, JSON.stringify(this.locations));
    } catch {
      // Storage can be unavailable; locations are still remembered for this session
    }
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const corePanels = new CorePanels(localStorageOrNull());

export function useCorePanelOpen(id: CorePanelId): boolean {
  return useSyncExternalStore(
    listener => corePanels.subscribe(listener),
    () => corePanels.isOpen(id),
  );
}
