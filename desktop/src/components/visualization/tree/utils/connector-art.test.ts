import { describe, expect, it } from 'vitest';
import {
  buildOrbitConnectorLayouts,
  buildStraightConnectorLayout,
  getConnectionState,
  getConnectorStyle,
} from './connector-art';

const LINE_TEXTURE_SCALE = 1.33;
const ORBIT_TEXTURE_SCALE = 2 * 1.33;

describe('connector art', () => {
  it('builds PoB-sized straight connector layouts', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const texture = { width: 119, height: 4 };
    const style = getConnectorStyle('Active');

    const layout = buildStraightConnectorLayout(from, to, texture, LINE_TEXTURE_SCALE, style);

    expect(layout).not.toBeNull();
    expect(layout?.kind).toBe('line');
    expect(layout?.length).toBeCloseTo(100, 6);
    expect(layout?.thickness).toBeCloseTo(10.64, 6);
    expect(layout?.repeatWidth).toBeCloseTo(158.27, 6);
    expect(layout?.rotation).toBeCloseTo(0, 6);
    expect(layout?.textureKey).toBe('LineConnectorActive');
  });

  it('splits long orbit connectors into two quads like PoB', () => {
    const from = { x: 0, y: -100 };
    const to = { x: 0, y: 100 };
    const center = { x: 0, y: 0 };
    const texture = { width: 62, height: 62 };
    const style = getConnectorStyle('Normal');

    const layouts = buildOrbitConnectorLayouts(from, to, center, 4, texture, ORBIT_TEXTURE_SCALE, style);

    expect(layouts).toHaveLength(2);
    expect(layouts[0].kind).toBe('mesh');
    expect(layouts[0].textureKey).toBe('Orbit4Normal');
    expect(Array.from(layouts[0].uvs)).toEqual([1, 1, 0, 1, 0, 0, 1, 0]);
    expect(Array.from(layouts[1].uvs)).toEqual([1, 1, 0, 1, 0, 0, 1, 0]);
  });

  it('sizes orbit meshes from the PoB texture dimensions', () => {
    const from = { x: 0, y: -162 };
    const to = { x: 162, y: 0 };
    const center = { x: 0, y: 0 };
    const smallTexture = { width: 20, height: 20 };
    const largeTexture = { width: 42, height: 42 };
    const style = getConnectorStyle('Normal');
    const [smallLayout] = buildOrbitConnectorLayouts(from, to, center, 2, smallTexture, ORBIT_TEXTURE_SCALE, style);
    const [largeLayout] = buildOrbitConnectorLayouts(from, to, center, 2, largeTexture, ORBIT_TEXTURE_SCALE, style);
    const getMaxDistance = (layout: { vertices: Float32Array }) => {
      let maxDistance = 0;

      for (let i = 0; i < layout.vertices.length; i += 2) {
        maxDistance = Math.max(
          maxDistance,
          Math.hypot(layout.vertices[i] - center.x, layout.vertices[i + 1] - center.y)
        );
      }

      return maxDistance;
    };

    expect(getMaxDistance(largeLayout) / getMaxDistance(smallLayout))
      .toBeCloseTo(largeTexture.width / smallTexture.width, 6);
  });

  it('uses PoB top-origin wheel angles for orbit quads', () => {
    const from = { x: 0, y: -100 };
    const to = { x: 100, y: 0 };
    const center = { x: 0, y: 0 };
    const texture = { width: 64, height: 64 };
    const style = getConnectorStyle('Normal');

    const [layout] = buildOrbitConnectorLayouts(from, to, center, 2, texture, ORBIT_TEXTURE_SCALE, style);

    const expectedVertices = [
      0,
      0,
      0,
      -170.24,
      170.24,
      -170.24,
      170.24,
      0,
    ];

    Array.from(layout.vertices).forEach((value, index) => {
      expect(value).toBeCloseTo(expectedVertices[index], 4);
    });
  });

  it('returns muted connector styling for inactive ascendancy wheels', () => {
    const style = getConnectorStyle('Normal', { isMuted: true });

    expect(style.alpha).toBeCloseTo(0.4, 6);
    expect(style.tint).toBe(0xbfc2c7);
  });

  it('tracks connector states in PoB order', () => {
    expect(getConnectionState(true)).toBe('Active');
    expect(getConnectionState(false, true)).toBe('Intermediate');
    expect(getConnectionState(false, false)).toBe('Normal');
  });
});
