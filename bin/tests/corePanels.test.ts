import { describe, expect, it } from 'vitest';
import { CORE_LOCATIONS_KEY, CorePanels, type CorePanelHost } from '../src/app/dock/corePanels';
import type { CorePanelId } from '../src/app/dock/dockLayout';
import type { PanelLocation } from '../src/shared/panels/panelRegistry';

class FakeDock implements CorePanelHost {
  open = new Map<CorePanelId, PanelLocation>();
  log: string[] = [];
  bounds = () => ({ width: 1000, height: 800 });
  isOpen = (id: CorePanelId) => this.open.has(id);
  addFloating(id: CorePanelId, box: { x: number; y: number; width: number; height: number }) {
    this.open.set(id, { type: 'floating', box });
    this.log.push(`float ${id}`);
  }
  addDocked(id: CorePanelId, location: Extract<PanelLocation, { type: 'docked' }>) {
    if (location.referencePanel && !this.open.has(location.referencePanel as CorePanelId)) return false;
    this.open.set(id, location);
    this.log.push(`dock ${id}`);
    return true;
  }
  focus(id: CorePanelId) { this.log.push(`focus ${id}`); }
  remove(id: CorePanelId) { this.open.delete(id); this.log.push(`remove ${id}`); }
  locate = (id: CorePanelId) => this.open.get(id) ?? null;
}

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
  };
};

const docked = (referencePanel: CorePanelId): PanelLocation =>
  ({ type: 'docked', referencePanel, direction: 'right', size: { width: 400, height: 300 } });

describe('CorePanels', () => {
  it('closes a panel and reopens it docked where it was', () => {
    const dock = new FakeDock();
    dock.open.set('mediaPool', docked('viewer'));
    dock.open.set('viewer', docked('timeline'));
    const panels = new CorePanels();
    panels.attach(dock);

    panels.toggle('mediaPool');
    expect(panels.isOpen('mediaPool')).toBe(false);
    panels.toggle('mediaPool');
    expect(panels.isOpen('mediaPool')).toBe(true);
    expect(dock.open.get('mediaPool')).toEqual(docked('viewer'));
    expect(dock.log).toContain('dock mediaPool');
  });

  it('reopens a floating panel at the same box', () => {
    const dock = new FakeDock();
    const box = { x: 50, y: 60, width: 300, height: 200 };
    dock.open.set('viewer', { type: 'floating', box });
    const panels = new CorePanels();
    panels.attach(dock);

    panels.close('viewer');
    panels.open('viewer');
    expect(dock.open.get('viewer')).toEqual({ type: 'floating', box });
  });

  it('floats a panel whose docked neighbour is gone, at its docked size', () => {
    const dock = new FakeDock();
    dock.open.set('timeline', docked('viewer'));
    const panels = new CorePanels();
    panels.attach(dock);

    panels.close('timeline');
    panels.open('timeline');
    expect(dock.log).toContain('float timeline');
    expect(dock.open.get('timeline')).toEqual({ type: 'floating', box: { x: 300, y: 250, width: 400, height: 300 } });
  });

  it('focuses an open panel instead of opening it twice', () => {
    const dock = new FakeDock();
    dock.open.set('viewer', docked('timeline'));
    const panels = new CorePanels();
    panels.attach(dock);

    panels.open('viewer');
    expect(dock.log).toEqual(['focus viewer']);
  });

  it('remembers locations across restarts', () => {
    const storage = memoryStorage();
    const dock = new FakeDock();
    dock.open.set('viewer', { type: 'floating', box: { x: 1, y: 2, width: 300, height: 200 } });
    const first = new CorePanels(storage);
    first.attach(dock);
    first.close('viewer');
    expect(JSON.parse(storage.getItem(CORE_LOCATIONS_KEY)!).viewer.type).toBe('floating');

    const second = new CorePanels(storage);
    expect(second.location('viewer')).toEqual({ type: 'floating', box: { x: 1, y: 2, width: 300, height: 200 } });
  });

  it('records where open panels move to', () => {
    const dock = new FakeDock();
    dock.open.set('viewer', docked('timeline'));
    const panels = new CorePanels();
    panels.attach(dock);

    dock.open.set('viewer', { type: 'floating', box: { x: 5, y: 5, width: 200, height: 100 } });
    panels.recordLocations();
    dock.open.delete('viewer');
    panels.open('viewer');
    expect(dock.open.get('viewer')?.type).toBe('floating');
  });

  it('tells subscribers when panels open and close', () => {
    const dock = new FakeDock();
    const panels = new CorePanels();
    panels.attach(dock);
    let calls = 0;
    panels.subscribe(() => calls++);
    panels.open('timeline');
    panels.close('timeline');
    expect(calls).toBe(2);
  });

  it('reports everything closed and does nothing without a dock', () => {
    const panels = new CorePanels();
    expect(panels.isOpen('viewer')).toBe(false);
    expect(() => panels.toggle('viewer')).not.toThrow();
  });
});
