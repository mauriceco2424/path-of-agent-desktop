/**
 * JewelSocketOverlay Utilities
 *
 * Renders jewel radius overlays using the same visual approach as Path of Building:
 * - Hovered non-Thread sockets: all standard radii with the plain ring texture
 * - Hovered Thread of Hope sockets: all annuli with the plain ring texture
 * - Allocated sockets with a jewel: the selected radius with shaded rotating rings
 * - Timeless jewels: timeless-specific rotating ring art
 *
 * @module components/visualization/tree/layers/JewelSocketOverlay
 */

import { Container, Sprite, Texture } from 'pixi.js';

/**
 * Current PoB jewel radius data (3.16+ layout, still used by current PoB tree rendering).
 * Keys match PoB's `data.jewelRadius` array indices.
 */
export const JEWEL_RADIUS_BY_INDEX = {
  1: { inner: 0, outer: 960, color: 0xbb6600, label: 'Small' },
  2: { inner: 0, outer: 1440, color: 0x66ffcc, label: 'Medium' },
  3: { inner: 0, outer: 1800, color: 0x2222cc, label: 'Large' },
  4: { inner: 0, outer: 2400, color: 0xc100ff, label: 'Very Large' },
  5: { inner: 0, outer: 2880, color: 0x0b9300, label: 'Massive' },
  6: { inner: 960, outer: 1320, color: 0xd35400, label: 'Variable' },
  7: { inner: 1320, outer: 1680, color: 0x66ffcc, label: 'Variable' },
  8: { inner: 1680, outer: 2040, color: 0x2222cc, label: 'Variable' },
  9: { inner: 2040, outer: 2400, color: 0xc100ff, label: 'Variable' },
  10: { inner: 2400, outer: 2880, color: 0x0b9300, label: 'Variable' },
} as const;

const STANDARD_RADIUS_INDICES = [1, 2, 3, 4, 5] as const;
const THREAD_RADIUS_INDICES = [6, 7, 8, 9, 10] as const;
const ALLOCATED_RING_ALPHA = 0.7;

type JewelRadiusIndex = keyof typeof JEWEL_RADIUS_BY_INDEX;

/**
 * Information about a socketed jewel for overlay rendering.
 */
export interface JewelSocketInfo {
  nodeId: number;
  name: string;
  baseName: string;
  iconUrl?: string;
  radiusLabel?: string;
  radiusIndex?: number;
  impossibleEscapeKeystoneName?: string;
  isTimeless?: boolean;
  isThreadOfHope?: boolean;
  isClusterJewel?: boolean;
}

export interface JewelSocketOverlayTextures {
  hoverRing: Texture | null;
  shadedOuterRing: Texture | null;
  shadedOuterRingFlipped: Texture | null;
  shadedInnerRing: Texture | null;
  shadedInnerRingFlipped: Texture | null;
  timelessVaal1: Texture | null;
  timelessVaal2: Texture | null;
  timelessTemplar1: Texture | null;
  timelessTemplar2: Texture | null;
  timelessMaraketh1: Texture | null;
  timelessMaraketh2: Texture | null;
  timelessKarui1: Texture | null;
  timelessKarui2: Texture | null;
  timelessEternal1: Texture | null;
  timelessEternal2: Texture | null;
}

export interface JewelSocketOverlayConfig {
  socketPositions: Map<number, { x: number; y: number }>;
  jewelData: Map<number, JewelSocketInfo>;
  textures: JewelSocketOverlayTextures;
  passiveNodePositionsByName?: Map<string, { x: number; y: number }>;
  hoveredSocketId?: number | null;
  allocatedSocketIds?: Set<number>;
  clusterSocketIds?: Set<number>;
}

interface SocketOverlayInfo {
  nodeId: number;
  x: number;
  y: number;
  jewel: JewelSocketInfo | null;
  isHovered: boolean;
  isAllocated: boolean;
  isClusterSocket: boolean;
}

export interface AnimatedOverlaySprite {
  sprite: Sprite;
  rotationSpeed: number;
}

export interface JewelOverlayRenderResult {
  animatedSprites: AnimatedOverlaySprite[];
}

interface TimelessTexturePair {
  primary: Texture | null;
  secondary: Texture | null;
}

function createOverlaySprite(
  texture: Texture,
  options: {
    x: number;
    y: number;
    diameter: number;
    tint?: number;
    alpha?: number;
  }
): Sprite {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);
  sprite.position.set(options.x, options.y);
  sprite.width = options.diameter;
  sprite.height = options.diameter;
  sprite.eventMode = 'none';

  if (options.tint != null) {
    sprite.tint = options.tint;
  }
  if (options.alpha != null) {
    sprite.alpha = options.alpha;
  }

  return sprite;
}

function addHoverRing(
  container: Container,
  texture: Texture | null,
  x: number,
  y: number,
  radiusIndex: JewelRadiusIndex
): void {
  if (!texture) return;

  const ring = JEWEL_RADIUS_BY_INDEX[radiusIndex];
  container.addChild(createOverlaySprite(texture, {
    x,
    y,
    diameter: ring.outer * 2,
    tint: ring.color,
    alpha: 1,
  }));

  if (ring.inner > 0) {
    container.addChild(createOverlaySprite(texture, {
      x,
      y,
      diameter: ring.inner * 2,
      tint: ring.color,
      alpha: 1,
    }));
  }
}

function addAnimatedRingSprite(
  container: Container,
  texture: Texture | null,
  x: number,
  y: number,
  diameter: number,
  rotationSpeed: number,
  animatedSprites: AnimatedOverlaySprite[]
): void {
  if (!texture || diameter <= 0) return;

  const sprite = createOverlaySprite(texture, {
    x,
    y,
    diameter,
    alpha: ALLOCATED_RING_ALPHA,
  });
  // Freeze the decorative ring artwork instead of rotating it every frame.
  // The animated version keeps the full tree in a continuous redraw path.
  sprite.rotation = rotationSpeed;
  container.addChild(sprite);
}

function addGenericAllocatedRing(
  container: Container,
  textures: JewelSocketOverlayTextures,
  x: number,
  y: number,
  radiusIndex: JewelRadiusIndex,
  animatedSprites: AnimatedOverlaySprite[]
): void {
  const ring = JEWEL_RADIUS_BY_INDEX[radiusIndex];

  addAnimatedRingSprite(
    container,
    textures.shadedOuterRing,
    x,
    y,
    ring.outer * 2,
    -0.7,
    animatedSprites
  );
  addAnimatedRingSprite(
    container,
    textures.shadedOuterRingFlipped,
    x,
    y,
    ring.outer * 2,
    0.7,
    animatedSprites
  );

  if (ring.inner > 0) {
    const innerDiameter = ring.inner * 2 * 1.06;
    addAnimatedRingSprite(
      container,
      textures.shadedInnerRing,
      x,
      y,
      innerDiameter,
      -0.7,
      animatedSprites
    );
    addAnimatedRingSprite(
      container,
      textures.shadedInnerRingFlipped,
      x,
      y,
      innerDiameter,
      0.7,
      animatedSprites
    );
  }
}

function addImpossibleEscapeAllocatedRing(
  container: Container,
  textures: JewelSocketOverlayTextures,
  x: number,
  y: number,
  radiusIndex: JewelRadiusIndex,
  animatedSprites: AnimatedOverlaySprite[]
): void {
  const ring = JEWEL_RADIUS_BY_INDEX[radiusIndex];
  const innerDiameter = 150 * 2;

  addAnimatedRingSprite(
    container,
    textures.shadedOuterRing,
    x,
    y,
    ring.outer * 2,
    -0.8,
    animatedSprites
  );
  addAnimatedRingSprite(
    container,
    textures.shadedOuterRingFlipped,
    x,
    y,
    ring.outer * 2,
    1,
    animatedSprites
  );
  addAnimatedRingSprite(
    container,
    textures.shadedInnerRing,
    x,
    y,
    innerDiameter,
    -1.2,
    animatedSprites
  );
  addAnimatedRingSprite(
    container,
    textures.shadedInnerRingFlipped,
    x,
    y,
    innerDiameter,
    1,
    animatedSprites
  );
}

function getTimelessTexturePair(
  textures: JewelSocketOverlayTextures,
  jewel: JewelSocketInfo
): TimelessTexturePair | null {
  const lowerName = jewel.name.toLowerCase();

  if (lowerName.startsWith('glorious vanity')) {
    return { primary: textures.timelessVaal1, secondary: textures.timelessVaal2 };
  }
  if (lowerName.startsWith('militant faith')) {
    return { primary: textures.timelessTemplar1, secondary: textures.timelessTemplar2 };
  }
  if (lowerName.startsWith('brutal restraint')) {
    return { primary: textures.timelessMaraketh1, secondary: textures.timelessMaraketh2 };
  }
  if (lowerName.startsWith('lethal pride')) {
    return { primary: textures.timelessKarui1, secondary: textures.timelessKarui2 };
  }
  if (lowerName.startsWith('elegant hubris')) {
    return { primary: textures.timelessEternal1, secondary: textures.timelessEternal2 };
  }

  return null;
}

function addTimelessAllocatedRing(
  container: Container,
  textures: JewelSocketOverlayTextures,
  jewel: JewelSocketInfo,
  x: number,
  y: number,
  radiusIndex: JewelRadiusIndex,
  animatedSprites: AnimatedOverlaySprite[]
): void {
  const pair = getTimelessTexturePair(textures, jewel);
  if (!pair?.primary || !pair.secondary) {
    addGenericAllocatedRing(container, textures, x, y, radiusIndex, animatedSprites);
    return;
  }

  const ring = JEWEL_RADIUS_BY_INDEX[radiusIndex];
  addAnimatedRingSprite(container, pair.primary, x, y, ring.outer * 2, -0.7, animatedSprites);
  addAnimatedRingSprite(container, pair.secondary, x, y, ring.outer * 2, 0.7, animatedSprites);
}

export function getSocketsWithOverlays(config: JewelSocketOverlayConfig): SocketOverlayInfo[] {
  const { socketPositions, jewelData, hoveredSocketId, allocatedSocketIds, clusterSocketIds } = config;
  const result: SocketOverlayInfo[] = [];

  if (hoveredSocketId != null && socketPositions.has(hoveredSocketId)) {
    const pos = socketPositions.get(hoveredSocketId)!;
    const jewel = jewelData.get(hoveredSocketId) || null;
    result.push({
      nodeId: hoveredSocketId,
      x: pos.x,
      y: pos.y,
      jewel,
      isHovered: true,
      isAllocated: allocatedSocketIds?.has(hoveredSocketId) ?? false,
      isClusterSocket: clusterSocketIds?.has(hoveredSocketId) ?? false,
    });
  }

  if (allocatedSocketIds) {
    for (const nodeId of allocatedSocketIds) {
      if (nodeId === hoveredSocketId) continue;
      if (!socketPositions.has(nodeId)) continue;
      const jewel = jewelData.get(nodeId);
      if (!jewel) continue;

      const pos = socketPositions.get(nodeId)!;
      result.push({
        nodeId,
        x: pos.x,
        y: pos.y,
        jewel,
        isHovered: false,
        isAllocated: true,
        isClusterSocket: clusterSocketIds?.has(nodeId) ?? false,
      });
    }
  }

  return result;
}

function clearContainer(container: Container): void {
  const children = [...container.children];
  for (const child of children) {
    container.removeChild(child);
    child.destroy();
  }
}

export function drawJewelSocketOverlays(
  container: Container,
  config: JewelSocketOverlayConfig
): JewelOverlayRenderResult {
  clearContainer(container);

  const animatedSprites: AnimatedOverlaySprite[] = [];
  const socketsWithOverlays = getSocketsWithOverlays(config);

  for (const socket of socketsWithOverlays) {
    const { x, y, jewel, isHovered, isAllocated, isClusterSocket } = socket;
    if (isClusterSocket || jewel?.isClusterJewel) {
      continue;
    }

    if (isHovered) {
      const hoverIndices = jewel?.isThreadOfHope ? THREAD_RADIUS_INDICES : STANDARD_RADIUS_INDICES;
      for (const radiusIndex of hoverIndices) {
        addHoverRing(container, config.textures.hoverRing, x, y, radiusIndex);
      }
      continue;
    }

    if (!isAllocated || !jewel?.radiusIndex) {
      continue;
    }

    const radiusIndex = jewel.radiusIndex as JewelRadiusIndex;
    if (!JEWEL_RADIUS_BY_INDEX[radiusIndex]) {
      continue;
    }

    const impossibleEscapeCenter = jewel.impossibleEscapeKeystoneName
      ? config.passiveNodePositionsByName?.get(jewel.impossibleEscapeKeystoneName.toLowerCase())
      : undefined;
    if (impossibleEscapeCenter) {
      addImpossibleEscapeAllocatedRing(
        container,
        config.textures,
        impossibleEscapeCenter.x,
        impossibleEscapeCenter.y,
        radiusIndex,
        animatedSprites
      );
      continue;
    }

    if (jewel.isTimeless) {
      addTimelessAllocatedRing(container, config.textures, jewel, x, y, radiusIndex, animatedSprites);
    } else {
      addGenericAllocatedRing(container, config.textures, x, y, radiusIndex, animatedSprites);
    }
  }

  return { animatedSprites };
}

export function createJewelSocketOverlay(config: JewelSocketOverlayConfig): Container | null {
  const container = new Container();
  const result = drawJewelSocketOverlays(container, config);
  if (container.children.length === 0 && result.animatedSprites.length === 0) {
    container.destroy();
    return null;
  }
  return container;
}

export default createJewelSocketOverlay;
