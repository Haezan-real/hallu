import { describe, expect, it } from 'vitest';
import { MULTIPLE_MENUS_DISABLED, PANEL_POLICIES, canOpenPanel, type PanelKind } from '../src/shared/panels/panelPolicies';
import {
  LOCATIONS_KEY,
  PanelRegistry,
  clampBox,
  type FloatingBox,
  type PanelHost,
  type PanelLocation,
  type PanelRegistryOptions,
  type ToolPanelSpec,
} from '../src/shared/panels/panelRegistry';

const Empty = () => null;

/** A dock with no layout of its own: just which panels are where */
class FakeDock implements PanelHost {
  panels = new Map<string, { spec: ToolPanelSpec; location: PanelLocation }>();
  others = new Set<string>(['timeline', 'viewer']);
  focused: string | null = null;
  focusedIsFloating = true;
  calls: string[] = [];

  bounds() {
    return { width: 1600, height: 900 };
  }
  addFloating(spec: ToolPanelSpec, box: FloatingBox) {
    this.calls.push(`float ${spec.id}`);
    this.panels.set(spec.id, { spec, location: { type: 'floating', box } });
    this.focused = spec.id;
  }
  addDocked(spec: ToolPanelSpec, location: Extract<PanelLocation, { type: 'docked' }>) {
    const { referencePanel } = location;
    if (referencePanel && !this.others.has(referencePanel) && !this.panels.has(referencePanel)) return false;
    this.calls.push(`dock ${spec.id} ${location.direction} ${referencePanel ?? 'edge'}`);
    this.panels.set(spec.id, { spec, location });
    this.focused = spec.id;
    return true;
  }
  focus(id: string) {
    this.calls.push(`focus ${id}`);
    this.focused = id;
  }
  remove(id: string) {
    this.calls.push(`remove ${id}`);
    this.panels.delete(id);
  }
  locate(id: string) {
    return this.panels.get(id)?.location ?? null;
  }
  focusedPanel() {
    return this.focused;
  }
  focusedFloating() {
    return this.focusedIsFloating ? this.focused : null;
  }
  move(id: string, location: PanelLocation) {
    this.panels.get(id)!.location = location;
  }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function setup(options: PanelRegistryOptions = {}, kinds: PanelKind[] = ['settings', 'styles', 'colorPicker', 'export']) {
  const registry = new PanelRegistry(options);
  for (const kind of kinds) registry.define(kind, { title: kind, component: Empty });
  const dock = new FakeDock();
  registry.attach(dock, []);
  return { registry, dock };
}

describe('panel policies', () => {
  it('keeps menus exclusive only when multiple menus are turned off', () => {
    expect(canOpenPanel('settings', ['styles'], true)).toEqual({ allowed: true });
    expect(canOpenPanel('settings', ['styles'], false)).toEqual({ allowed: false, reason: MULTIPLE_MENUS_DISABLED });
    expect(canOpenPanel('settings', ['colorPicker'], false)).toEqual({ allowed: true });
    expect(canOpenPanel('colorPicker', ['settings'], false)).toEqual({ allowed: true });
  });

  it('gives every kind a usable default size', () => {
    for (const policy of Object.values(PANEL_POLICIES)) {
      expect(policy.defaultSize.width).toBeGreaterThan(0);
      expect(policy.defaultSize.height).toBeGreaterThan(0);
    }
  });
});

describe('panel registry', () => {
  it('opens a singleton once and focuses it after that', () => {
    const { registry, dock } = setup();
    const id = registry.openPanel('settings', { tab: 'switches' });
    expect(id).toBe('tool.settings');
    expect(registry.openPanel('settings')).toBe(id);
    expect(dock.calls).toEqual(['float tool.settings', 'focus tool.settings']);
    expect(dock.panels.get(id!)!.spec.params).toEqual({ tab: 'switches' });
    expect(registry.isPanelOpen('settings')).toBe(true);
  });

  it('adds another window for kinds that may be open more than once, offset from the last', () => {
    const { registry, dock } = setup();
    const first = registry.openPanel('colorPicker')!;
    const second = registry.openPanel('colorPicker')!;
    expect(first).not.toBe(second);
    const box = (id: string) => (dock.locate(id) as Extract<PanelLocation, { type: 'floating' }>).box;
    expect(box(second).x - box(first).x).toBe(24);
    expect(box(second).y - box(first).y).toBe(24);
    expect(registry.openKinds()).toEqual(['colorPicker', 'colorPicker']);
  });

  it('floats new tools in the middle of the dock at their default size', () => {
    const { registry, dock } = setup();
    registry.openPanel('export');
    const { width, height } = PANEL_POLICIES.export.defaultSize;
    expect(dock.locate('tool.export')).toEqual({
      type: 'floating',
      box: { x: (1600 - width) / 2, y: (900 - height) / 2, width, height },
    });
  });

  it('refuses a second menu when multiple menus are off, counting old-style modals too', () => {
    const notified: string[] = [];
    let modals: PanelKind[] = [];
    const { registry } = setup({ allowMultipleMenus: () => false, openModalKinds: () => modals, notify: reason => notified.push(reason) });
    expect(registry.openPanel('settings')).not.toBeNull();
    expect(registry.openPanel('styles')).toBeNull();
    expect(registry.openPanel('colorPicker')).not.toBeNull();
    registry.closePanel('settings');
    modals = ['export'];
    expect(registry.openPanel('styles')).toBeNull();
    expect(notified).toEqual([MULTIPLE_MENUS_DISABLED, MULTIPLE_MENUS_DISABLED]);
  });

  it('closes by kind or id and reports what is open', () => {
    const { registry, dock } = setup();
    const first = registry.openPanel('colorPicker')!;
    const second = registry.openPanel('colorPicker')!;
    expect(registry.closePanel('colorPicker')).toBe(true);
    expect(dock.panels.has(second)).toBe(false);
    expect(registry.closePanel(first)).toBe(true);
    expect(registry.isPanelOpen('colorPicker')).toBe(false);
    expect(registry.closePanel('colorPicker')).toBe(false);
  });

  it('forgets panels the dock closed by itself', () => {
    const { registry, dock } = setup();
    const id = registry.openPanel('styles')!;
    dock.remove(id);
    registry.panelRemoved(id);
    expect(registry.isPanelOpen('styles')).toBe(false);
  });

  it('does nothing for kinds nobody has defined, or before the dock is ready', () => {
    const { registry } = setup({}, []);
    expect(registry.openPanel('settings')).toBeNull();
    const detached = new PanelRegistry();
    detached.define('settings', { title: 'Settings', component: Empty });
    expect(detached.openPanel('settings')).toBeNull();
  });

  it('closes the focused floating tool for the exit shortcut, and nothing else', () => {
    const { registry, dock } = setup();
    registry.openPanel('styles');
    dock.focused = 'timeline';
    expect(registry.closeFocusedFloating()).toBe(false);
    dock.focused = 'tool.styles';
    dock.focusedIsFloating = false;
    expect(registry.closeFocusedFloating()).toBe(false);
    dock.focusedIsFloating = true;
    expect(registry.closeFocusedFloating()).toBe(true);
    expect(registry.isPanelOpen('styles')).toBe(false);
  });

  it('reports which tool has the focus, wherever it is', () => {
    const { registry, dock } = setup({}, ['settings', 'torusMenuEditor']);
    const id = registry.openPanel('torusMenuEditor')!;
    dock.focusedIsFloating = false;
    expect(registry.focusedPanel()).toEqual({ id, kind: 'torusMenuEditor' });
    dock.focused = 'timeline';
    expect(registry.focusedPanel()).toBeNull();
    registry.openPanel('settings');
    expect(registry.focusedPanel()?.kind).toBe('settings');
  });

  it('lets the focused tool step back before the exit shortcut closes it', () => {
    const { registry, dock } = setup();
    const id = registry.openPanel('styles')!;
    dock.focused = id;
    dock.focusedIsFloating = true;
    let depth = 1;
    registry.setBackHandler(id, () => depth > 0 && depth-- > 0);
    expect(registry.closeFocusedFloating()).toBe(true);
    expect(registry.isPanelOpen('styles')).toBe(true);
    expect(registry.closeFocusedFloating()).toBe(true);
    expect(registry.isPanelOpen('styles')).toBe(false);

    // A closed panel's handler doesn't carry over when it opens again
    let stepped = false;
    registry.openPanel('styles');
    registry.setBackHandler(id, () => (stepped = true));
    registry.closePanel(id);
    registry.openPanel('styles');
    expect(registry.closeFocusedFloating()).toBe(true);
    expect(stepped).toBe(false);
    expect(registry.isPanelOpen('styles')).toBe(false);
  });
});

describe('remembered locations', () => {
  it('reopens a tool where it was floating, saved across sessions', () => {
    const storage = memoryStorage();
    const { registry, dock } = setup({ storage });
    const id = registry.openPanel('settings')!;
    const moved: PanelLocation = { type: 'floating', box: { x: 40, y: 60, width: 500, height: 400 } };
    dock.move(id, moved);
    registry.recordLocations();
    registry.closePanel(id);
    expect(JSON.parse(storage.data.get(LOCATIONS_KEY)!)).toEqual({ settings: moved });

    const next = setup({ storage });
    next.registry.openPanel('settings');
    expect(next.dock.locate('tool.settings')).toEqual(moved);
  });

  it('records the location at close even without a layout change first', () => {
    const storage = memoryStorage();
    const { registry, dock } = setup({ storage });
    const id = registry.openPanel('styles')!;
    const moved: PanelLocation = { type: 'floating', box: { x: 10, y: 20, width: 300, height: 200 } };
    dock.move(id, moved);
    registry.closePanel(id);
    expect(registry.location('styles')).toEqual(moved);
  });

  it('docks a tool back beside the panel it sat next to, or floats it at that size if that panel is gone', () => {
    const docked: PanelLocation = { type: 'docked', referencePanel: 'viewer', direction: 'right', size: { width: 420, height: 700 } };
    const storage = memoryStorage({ [LOCATIONS_KEY]: JSON.stringify({ settings: docked }) });
    const { registry, dock } = setup({ storage });
    registry.openPanel('settings');
    expect(dock.calls).toEqual(['dock tool.settings right viewer']);

    registry.closePanel('settings');
    dock.others.delete('viewer');
    dock.calls = [];
    registry.openPanel('settings');
    expect(dock.calls).toEqual(['float tool.settings']);
    expect(dock.locate('tool.settings')).toMatchObject({ type: 'floating', box: { width: 420, height: 700 } });
  });

  it('docks a tool back along a whole edge of the dock', () => {
    const edge: PanelLocation = { type: 'docked', direction: 'right', size: { width: 320, height: 900 } };
    const storage = memoryStorage({ [LOCATIONS_KEY]: JSON.stringify({ settings: edge }) });
    const { registry, dock } = setup({ storage });
    expect(registry.location('settings')).toEqual(edge);
    registry.openPanel('settings');
    expect(dock.calls).toEqual(['dock tool.settings right edge']);
  });

  it('keeps remembered windows inside a smaller dock', () => {
    expect(clampBox({ x: 1500, y: -30, width: 400, height: 1200 }, { width: 1600, height: 900 }))
      .toEqual({ x: 1200, y: 0, width: 400, height: 900 });
  });

  it('ignores saved locations it cannot read', () => {
    const storage = memoryStorage({
      [LOCATIONS_KEY]: JSON.stringify({ settings: { type: 'floating', box: { x: 'a' } }, nope: { type: 'floating' } }),
    });
    const { registry } = setup({ storage });
    expect(registry.location('settings')).toBeUndefined();
  });
});

describe('startup restore', () => {
  it('keeps restorable tools from the saved layout and closes the rest', () => {
    const registry = new PanelRegistry();
    for (const kind of ['settings', 'export', 'colorPicker'] as const) registry.define(kind, { title: kind, component: Empty });
    const dock = new FakeDock();
    registry.attach(dock, [
      { id: 'tool.settings', params: { kind: 'settings', params: { tab: 'keys' } } },
      { id: 'tool.export', params: { kind: 'export', params: {} } },
      { id: 'tool.styles', params: { kind: 'styles', params: {} } },
      { id: 'tool.colorPicker.7', params: { kind: 'colorPicker', params: {} } },
      { id: 'tool.unknown', params: { kind: 'unknown' } },
    ]);
    expect(registry.openKinds()).toEqual(['settings']);
    expect(dock.calls).toEqual(['remove tool.export', 'remove tool.styles', 'remove tool.colorPicker.7', 'remove tool.unknown']);
    expect(registry.openPanel('settings')).toBe('tool.settings');
  });

  it('numbers new windows after the restored ones', () => {
    const registry = new PanelRegistry();
    registry.define('settings', { title: 'Settings', component: Empty });
    registry.define('colorPicker', { title: 'Color', component: Empty });
    registry.attach(new FakeDock(), [{ id: 'tool.settings.3', params: { kind: 'settings', params: {} } }]);
    expect(registry.openPanel('colorPicker')).toBe('tool.colorPicker.4');
  });
});
