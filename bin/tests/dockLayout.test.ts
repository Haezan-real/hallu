import { describe, expect, it } from 'vitest';
import type { SerializedDockview } from 'dockview-react';
import { isConsistentLayout } from '../src/app/dock/dockLayout';

const leaf = (views: string[]) => ({ type: 'leaf', data: { views, id: views[0] ?? 'empty' } });
const layout = (root: object, panels: string[], floating: string[][] = []) => ({
  grid: { root, width: 100, height: 100, orientation: 'HORIZONTAL' },
  panels: Object.fromEntries(panels.map(id => [id, { id, contentComponent: id }])),
  floatingGroups: floating.map(views => ({ data: { views, id: views[0] }, position: {} })),
}) as unknown as SerializedDockview;

describe('isConsistentLayout', () => {
  it('accepts a normal layout, with floating windows', () => {
    const root = { type: 'branch', data: [leaf(['mediaPool', 'viewer']), leaf(['timeline'])] };
    expect(isConsistentLayout(layout(root, ['mediaPool', 'viewer', 'timeline', 'tool.styles'], [['tool.styles']]))).toBe(true);
  });

  it('accepts a layout with some or all panels closed', () => {
    expect(isConsistentLayout(layout({ type: 'branch', data: [leaf(['viewer'])] }, ['viewer']))).toBe(true);
    expect(isConsistentLayout(layout({ type: 'branch', data: [] }, []))).toBe(true);
    expect(isConsistentLayout(layout(leaf([]), []))).toBe(true);
  });

  it('rejects a dock caught mid-teardown: empty groups with panels left over', () => {
    const root = { type: 'branch', data: [leaf([]), leaf([]), leaf([])] };
    expect(isConsistentLayout(layout(root, ['mediaPool', 'viewer', 'timeline']))).toBe(false);
  });

  it('rejects a panel that is in no group', () => {
    expect(isConsistentLayout(layout({ type: 'branch', data: [leaf(['viewer'])] }, ['viewer', 'timeline']))).toBe(false);
  });
});
