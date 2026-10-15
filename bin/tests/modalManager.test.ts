import { describe, expect, it } from 'vitest';
import { modalManager } from '../src/shared/modals/modalManager';

describe('modal manager lifecycle', () => {
  it('closes the most recently registered instance through its callback', () => {
    const first = modalManager.requestOpen('settings');
    const second = modalManager.requestOpen('themes');
    const closed: number[] = [];
    modalManager.registerClose(first.id!, () => closed.push(first.id!));
    modalManager.registerClose(second.id!, () => closed.push(second.id!));

    expect(modalManager.getOpenCount('settings')).toBe(1);
    expect(modalManager.getOpenCount('themes')).toBe(1);
    expect(modalManager.closeTop()).toBe(true);
    expect(closed).toEqual([second.id]);
    expect(modalManager.getOpenCount('themes')).toBe(0);

    modalManager.closeInstance(first.id!);
    expect(closed).toEqual([second.id, first.id]);
  });
});
