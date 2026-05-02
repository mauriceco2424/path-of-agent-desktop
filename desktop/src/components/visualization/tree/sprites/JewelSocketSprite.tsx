/**
 * JewelSocketSprite Utilities
 *
 * Utility functions for rendering jewel socket sprites using vanilla Pixi.js.
 * Shows different visual states:
 * - Empty socket: Diamond shape with standard styling
 * - Filled socket: Diamond with jewel type indicator
 * - Allocated: Golden glow
 * - Hovered: Highlight effect
 *
 * NOTE: The main InteractiveTreeCanvas.tsx handles rendering directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module components/visualization/tree/sprites/JewelSocketSprite
 */

import { Container, Graphics } from 'pixi.js';
import type { JewelSocketInfo } from '../layers/JewelSocketOverlay';
import type { TreeNode } from '../hooks/useTreeData';

// Re-export types for consumers
export type { JewelSocketInfo, TreeNode };

/**
 * Colors for jewel socket rendering
 */
export const SOCKET_COLORS = {
  // Empty socket states
  empty: {
    fill: 0x333344,
    border: 0x555566,
    borderAllocated: 0x888899,
  },
  // Filled socket states
  filled: {
    normal: 0x4a4a6a,
    allocated: 0xffd700,
  },
  // Jewel type indicators
  jewel: {
    crimson: 0xff4444,      // Str (red)
    viridian: 0x44ff44,     // Dex (green)
    cobalt: 0x4444ff,       // Int (blue)
    prismatic: 0xffffff,    // All attributes (white)
    abyss: 0x66ff66,        // Abyss (eye green)
    cluster: 0xaa44ff,      // Cluster (purple)
    timeless: 0xffd700,     // Timeless (golden)
    unique: 0xff8800,       // Unique jewel (orange)
  },
  // Glow effects
  glow: {
    allocated: 0xffcc00,
    hover: 0xffffff,
    timeless: 0xffd700,
    cluster: 0xaa44ff,
  },
} as const;

/**
 * Socket visual configuration
 */
export const SOCKET_SIZE = {
  radius: 18,
  glowRadius: 26,
  iconRadius: 12,
  sides: 4, // Diamond shape (rotated square)
} as const;

/**
 * Configuration for rendering a jewel socket sprite
 */
export interface JewelSocketSpriteConfig {
  /** Tree node data for the socket */
  node: TreeNode;
  /** Whether the socket is allocated */
  isAllocated: boolean;
  /** Whether the socket is reachable from allocated nodes */
  isReachable?: boolean;
  /** Whether the socket is highlighted (e.g., search result) */
  isHighlighted?: boolean;
  /** Whether the socket is currently hovered */
  isHovered?: boolean;
  /** Jewel data if a jewel is socketed */
  jewelData?: JewelSocketInfo | null;
}

/**
 * Determine jewel type color from jewel info
 */
export function getJewelColor(jewel: JewelSocketInfo | null | undefined): number {
  if (!jewel) return SOCKET_COLORS.empty.fill;

  const baseLower = (jewel.baseName ?? '').toLowerCase();
  const nameLower = (jewel.name ?? '').toLowerCase();

  // Check for specific jewel types
  if (jewel.isTimeless || baseLower.includes('timeless')) {
    return SOCKET_COLORS.jewel.timeless;
  }
  if (baseLower.includes('cluster')) {
    return SOCKET_COLORS.jewel.cluster;
  }
  if (baseLower.includes('abyss') || baseLower.includes('eye jewel')) {
    return SOCKET_COLORS.jewel.abyss;
  }

  // Check base jewel types
  if (baseLower.includes('crimson')) {
    return SOCKET_COLORS.jewel.crimson;
  }
  if (baseLower.includes('viridian')) {
    return SOCKET_COLORS.jewel.viridian;
  }
  if (baseLower.includes('cobalt')) {
    return SOCKET_COLORS.jewel.cobalt;
  }
  if (baseLower.includes('prismatic')) {
    return SOCKET_COLORS.jewel.prismatic;
  }

  // Check for unique jewels by rarity or specific names
  if (nameLower !== baseLower && !baseLower.includes('jewel')) {
    // Has a unique name distinct from base
    return SOCKET_COLORS.jewel.unique;
  }

  return SOCKET_COLORS.filled.normal;
}

/**
 * Draw a diamond shape (rotated square)
 */
export function drawDiamond(graphics: Graphics, x: number, y: number, radius: number): void {
  // Diamond is a square rotated 45 degrees
  const points = [
    x, y - radius,  // Top
    x + radius, y,  // Right
    x, y + radius,  // Bottom
    x - radius, y,  // Left
  ];
  graphics.poly(points, true);
}

/**
 * Draw a socket's glow effect
 */
export function drawSocketGlow(
  graphics: Graphics,
  x: number,
  y: number,
  config: JewelSocketSpriteConfig
): void {
  const showGlow = config.isHovered || config.isHighlighted || config.isAllocated;
  if (!showGlow) return;

  const glowColor = config.isAllocated
    ? SOCKET_COLORS.glow.allocated
    : config.jewelData?.isTimeless
      ? SOCKET_COLORS.glow.timeless
      : config.jewelData?.baseName?.toLowerCase().includes('cluster')
        ? SOCKET_COLORS.glow.cluster
        : SOCKET_COLORS.glow.hover;

  // Draw soft glow layers
  const layers = 4;
  for (let i = layers; i > 0; i--) {
    const layerRadius = SOCKET_SIZE.glowRadius + i * 4;
    const alpha = 0.15 / i;
    drawDiamond(graphics, x, y, layerRadius);
    graphics.fill({ color: glowColor, alpha });
  }
}

/**
 * Draw a socket's main shape
 */
export function drawSocketShape(
  graphics: Graphics,
  x: number,
  y: number,
  config: JewelSocketSpriteConfig
): void {
  const { radius } = SOCKET_SIZE;
  const hasJewel = !!config.jewelData;
  const jewelColor = getJewelColor(config.jewelData);
  const isHovered = config.isHovered ?? false;

  // Outer diamond (socket frame)
  drawDiamond(graphics, x, y, radius);

  // Fill color based on state
  let fillColor: number;
  if (hasJewel) {
    fillColor = config.isAllocated ? SOCKET_COLORS.filled.allocated : SOCKET_COLORS.filled.normal;
  } else {
    fillColor = SOCKET_COLORS.empty.fill;
  }
  graphics.fill({ color: fillColor });

  // Border
  drawDiamond(graphics, x, y, radius);
  const borderColor = config.isAllocated || isHovered
    ? SOCKET_COLORS.empty.borderAllocated
    : SOCKET_COLORS.empty.border;
  graphics.stroke({ color: borderColor, width: 2, alpha: config.isAllocated ? 0.9 : 0.6 });

  // Inner jewel indicator (if jewel is socketed)
  if (hasJewel) {
    const innerRadius = SOCKET_SIZE.iconRadius;
    drawDiamond(graphics, x, y, innerRadius);
    graphics.fill({ color: jewelColor, alpha: 0.9 });
    drawDiamond(graphics, x, y, innerRadius);
    graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
  }

  // Allocated state inner highlight
  if (config.isAllocated && hasJewel) {
    drawDiamond(graphics, x, y, radius * 0.7);
    graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
  }
}

/**
 * Render a complete jewel socket sprite (glow + shape) to a container
 */
export function renderJewelSocketSprite(container: Container, config: JewelSocketSpriteConfig): void {
  const { node } = config;

  // Create glow graphics (behind socket)
  const glowGraphics = new Graphics();
  drawSocketGlow(glowGraphics, node.x, node.y, config);
  container.addChild(glowGraphics);

  // Create socket graphics
  const socketGraphics = new Graphics();
  drawSocketShape(socketGraphics, node.x, node.y, config);
  container.addChild(socketGraphics);
}

/**
 * Create a standalone jewel socket sprite container
 */
export function createJewelSocketSprite(config: JewelSocketSpriteConfig): Container {
  const container = new Container();
  container.x = config.node.x;
  container.y = config.node.y;

  // Render at origin since container is positioned
  const centeredConfig = {
    ...config,
    node: { ...config.node, x: 0, y: 0 },
  };

  renderJewelSocketSprite(container, centeredConfig);
  return container;
}

export default createJewelSocketSprite;
