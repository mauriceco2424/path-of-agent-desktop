import { describe, expect, it } from 'vitest';
import { extractNormalizedWheelDelta, getWheelZoomScale, normalizeWheelDelta } from './wheel-zoom';

describe('wheel zoom utils', () => {
  it('converts line deltas into pixel deltas', () => {
    expect(normalizeWheelDelta(3, 1, 900)).toBe(48);
  });

  it('clamps extreme deltas to avoid jumpy zooming', () => {
    expect(normalizeWheelDelta(5000, 0, 900)).toBe(600);
    expect(normalizeWheelDelta(-5000, 0, 900)).toBe(-600);
  });

  it('supports legacy mousewheel deltas', () => {
    expect(extractNormalizedWheelDelta({ wheelDelta: 120 }, 900)).toBe(-120);
    expect(extractNormalizedWheelDelta({ wheelDelta: -120 }, 900)).toBe(120);
  });

  it('zooms out for positive deltas and in for negative deltas', () => {
    expect(getWheelZoomScale(1, 120, 0.02, 2)).toBeLessThan(1);
    expect(getWheelZoomScale(1, -120, 0.02, 2)).toBeGreaterThan(1);
  });

  it('respects configured zoom bounds', () => {
    expect(getWheelZoomScale(0.03, 500, 0.02, 2)).toBe(0.02);
    expect(getWheelZoomScale(1.95, -500, 0.02, 2)).toBe(2);
  });
});
