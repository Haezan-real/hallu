import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getColorPickerBinding,
  pickColor,
  releaseColorPickerTarget,
  setColorPickerTarget,
  subscribeColorPickerTarget,
} from '../src/modals/colorPicker/colorPickerTarget';
import { exportTimeline, provideTimelineExport } from '../src/modals/export/timelineExport';

describe('color picker target', () => {
  beforeEach(() => releaseColorPickerTarget());

  it('reports picks to whatever opened it most recently', () => {
    const first = { value: '#111111', onChange: vi.fn(), onClose: vi.fn() };
    const second = { value: '#222222', onChange: vi.fn(), onClose: vi.fn() };
    setColorPickerTarget(first);
    pickColor('#aaaaaa');
    setColorPickerTarget(second);
    pickColor('#bbbbbb');

    expect(first.onChange.mock.calls).toEqual([['#aaaaaa']]);
    expect(second.onChange.mock.calls).toEqual([['#bbbbbb']]);
    expect(first.onClose).toHaveBeenCalledTimes(1);
    expect(second.onClose).not.toHaveBeenCalled();
  });

  it('starts over at each new target, even the same color twice', () => {
    setColorPickerTarget({ value: '#123456', onChange: () => {} });
    const firstId = getColorPickerBinding()!.id;
    setColorPickerTarget({ value: '#123456', onChange: () => {} });
    expect(getColorPickerBinding()!.id).not.toBe(firstId);
    expect(getColorPickerBinding()!.target.value).toBe('#123456');
  });

  it('keeps its starting color while picking, so the wheel is not reset under the pointer', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeColorPickerTarget(listener);
    setColorPickerTarget({ value: '#000000', onChange: () => {} });
    listener.mockClear();
    pickColor('#ff0000');
    expect(listener).not.toHaveBeenCalled();
    expect(getColorPickerBinding()!.target.value).toBe('#000000');
    unsubscribe();
  });

  it('tells the target when the picker closes, and then reports nowhere', () => {
    const target = { value: '#000000', onChange: vi.fn(), onClose: vi.fn() };
    setColorPickerTarget(target);
    releaseColorPickerTarget();
    releaseColorPickerTarget();
    pickColor('#ffffff');
    expect(target.onClose).toHaveBeenCalledTimes(1);
    expect(target.onChange).not.toHaveBeenCalled();
    expect(getColorPickerBinding()).toBeNull();
  });
});

describe('timeline export', () => {
  it('always runs the latest timeline export', async () => {
    const stale = vi.fn(async () => {});
    const latest = vi.fn(async () => {});
    const dropStale = provideTimelineExport(stale);
    const dropLatest = provideTimelineExport(latest);
    // A re-render swaps exporters: the old one's cleanup must not unhook the new one
    dropStale();
    await exportTimeline();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
    dropLatest();
    await expect(exportTimeline()).resolves.toBeUndefined();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
