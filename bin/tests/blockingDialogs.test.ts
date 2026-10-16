import { describe, expect, it } from 'vitest';
import { hasBlockingDialog, registerBlockingDialog, subscribeBlockingDialogs } from '../src/shared/ui/blockingDialogs';

describe('blocking dialogs', () => {
  it('counts open dialogs, and unregistering twice does nothing', () => {
    let changes = 0;
    const unsubscribe = subscribeBlockingDialogs(() => changes++);
    const closeRoll = registerBlockingDialog();
    const closeConfirm = registerBlockingDialog();
    expect(hasBlockingDialog()).toBe(true);

    closeConfirm();
    closeConfirm();
    expect(hasBlockingDialog()).toBe(true);
    closeRoll();
    expect(hasBlockingDialog()).toBe(false);
    expect(changes).toBe(4);
    unsubscribe();
  });
});
