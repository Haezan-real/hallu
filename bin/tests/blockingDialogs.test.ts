import { describe, expect, it } from 'vitest';
import { closeTopBlockingDialog, hasBlockingDialog, registerBlockingDialog, subscribeBlockingDialogs } from '../src/shared/ui/blockingDialogs';

describe('blocking dialogs', () => {
  it('closes the newest dialog first and reports when none are left', () => {
    const closed: string[] = [];
    let changes = 0;
    const unsubscribe = subscribeBlockingDialogs(() => changes++);
    const unregisterFirst = registerBlockingDialog(() => closed.push('roll'));
    const unregisterSecond = registerBlockingDialog(() => {
      closed.push('confirm');
      unregisterSecond();
    });
    expect(hasBlockingDialog()).toBe(true);

    expect(closeTopBlockingDialog()).toBe(true);
    expect(closed).toEqual(['confirm']);
    expect(hasBlockingDialog()).toBe(true);

    unregisterFirst();
    expect(hasBlockingDialog()).toBe(false);
    expect(closeTopBlockingDialog()).toBe(false);
    expect(changes).toBe(4);

    unregisterFirst();
    expect(changes).toBe(4);
    unsubscribe();
  });
});
