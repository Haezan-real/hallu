import { describe, expect, it } from 'vitest';
import { roundIconCorners } from '../iconRounding.cjs';

const SIZE = 64;
const RADIUS = 12;
const opaqueBitmap = () => Buffer.alloc(SIZE * SIZE * 4, 255);
const alphaAt = (bitmap: Buffer, x: number, y: number) => bitmap[(y * SIZE + x) * 4 + 3];

describe('icon corner rounding', () => {
  it('makes the outer corner pixels transparent', () => {
    const rounded = roundIconCorners(opaqueBitmap(), SIZE, RADIUS);
    expect(alphaAt(rounded, 0, 0)).toBe(0);
    expect(alphaAt(rounded, SIZE - 1, 0)).toBe(0);
    expect(alphaAt(rounded, 0, SIZE - 1)).toBe(0);
    expect(alphaAt(rounded, SIZE - 1, SIZE - 1)).toBe(0);
  });

  it('keeps edges and the interior opaque', () => {
    const rounded = roundIconCorners(opaqueBitmap(), SIZE, RADIUS);
    expect(alphaAt(rounded, SIZE / 2, 0)).toBe(255);
    expect(alphaAt(rounded, 0, SIZE / 2)).toBe(255);
    expect(alphaAt(rounded, SIZE / 2, SIZE / 2)).toBe(255);
  });

  it('does not modify the input bitmap', () => {
    const input = opaqueBitmap();
    roundIconCorners(input, SIZE, RADIUS);
    expect(alphaAt(input, 0, 0)).toBe(255);
  });
});
