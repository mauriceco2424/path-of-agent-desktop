/**
 * NodeSprite Utilities
 *
 * Utility functions for rendering passive tree node sprites using vanilla Pixi.js.
 * Provides visual styling based on node type and allocation state.
 *
 * NOTE: The main InteractiveTreeCanvas.tsx handles rendering directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module components/visualization/tree/sprites/NodeSprite
 */

import { Container, Graphics } from 'pixi.js';
import type { TreeNode } from '../hooks/useTreeData';

// Re-export types for consumers
export type { TreeNode };

/** Colors used for node rendering based on PoB's color scheme */
export const NODE_COLORS = {
  // Allocated states - golden/bright colors
  allocated: {
    keystone: 0xffcc00, // Bright gold
    notable: 0xe6b800, // Yellow-gold
    normal: 0xd4a84b, // Warm gold
    mastery: 0xffd700, // Golden
    ascendancy: 0xffaa00, // Orange-gold
    jewelSocket: 0xffd700, // Golden
  },
  // Unallocated states - dim/gray colors
  unallocated: {
    keystone: 0x4a4a4a, // Dark gray
    notable: 0x555555, // Medium-dark gray
    normal: 0x666666, // Gray
    mastery: 0x444488, // Dim blue-gray
    ascendancy: 0x664466, // Dim purple
    jewelSocket: 0x555555, // Gray
  },
  // Path/reachable states - slightly brighter than unallocated
  reachable: {
    keystone: 0x6a6a5a, // Warm gray
    notable: 0x757565, // Light warm gray
    normal: 0x868676, // Lighter warm gray
    mastery: 0x555588, // Dim blue
    ascendancy: 0x775577, // Dim magenta
    jewelSocket: 0x656565, // Light gray
  },
  // Glow colors
  glow: {
    allocated: 0xffcc00,
    hover: 0xffffff,
    path: 0x88aa88,
  },
  // Border/stroke colors
  border: {
    allocated: 0xffffff,
    hover: 0xffffff,
    normal: 0x333333,
  },
} as const;

/** Node size configurations based on type */
export const NODE_SIZES = {
  keystone: {
    radius: 32,
    glowRadius: 40,
    sides: 8, // Octagon for keystones
  },
  notable: {
    radius: 20,
    glowRadius: 26,
    sides: 6, // Hexagon
  },
  normal: {
    radius: 10,
    glowRadius: 14,
    sides: 0, // Circle (0 = circle)
  },
  mastery: {
    radius: 16,
    glowRadius: 22,
    sides: 0, // Circle with special effect
  },
  ascendancy: {
    radius: 18,
    glowRadius: 24,
    sides: 6, // Hexagon
  },
  jewelSocket: {
    radius: 18,
    glowRadius: 24,
    sides: 4, // Diamond/square for sockets
  },
} as const;

export type NodeType = keyof typeof NODE_SIZES;

/**
 * Configuration for rendering a node sprite
 */
export interface NodeSpriteConfig {
  node: TreeNode;
  isAllocated: boolean;
  isReachable?: boolean;
  isHighlighted?: boolean;
  isHovered?: boolean;
}

/**
 * Draws a regular polygon (hexagon, octagon, etc.) centered at origin.
 */
export function drawPolygon(graphics: Graphics, x: number, y: number, radius: number, sides: number): void {
  const points: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start from top
    points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  graphics.poly(points, true);
}

/**
 * Draws a mastery-style node with a special inner pattern.
 */
export function drawMasteryShape(graphics: Graphics, x: number, y: number, radius: number, isAllocated: boolean): void {
  // Outer circle
  graphics.circle(x, y, radius);

  if (isAllocated) {
    // Inner decorative circles for allocated mastery
    const innerRadius = radius * 0.6;
    graphics.circle(x, y, innerRadius);
  }
}

/**
 * Gets the color for a node based on its type and state.
 */
export function getNodeColor(
  type: NodeType,
  isAllocated: boolean,
  isReachable: boolean
): number {
  if (isAllocated) {
    return NODE_COLORS.allocated[type];
  }
  if (isReachable) {
    return NODE_COLORS.reachable[type];
  }
  return NODE_COLORS.unallocated[type];
}

/**
 * Maps TreeNode type to our internal type system.
 */
export function mapNodeType(node: TreeNode): NodeType {
  switch (node.type) {
    case 'keystone':
      return 'keystone';
    case 'notable':
      return 'notable';
    case 'mastery':
      return 'mastery';
    case 'jewelSocket':
      return 'jewelSocket';
    case 'ascendancy':
      return node.isAscendancyStart ? 'jewelSocket' : 'ascendancy';
    default:
      return 'normal';
  }
}

/**
 * Draw a node's glow effect
 */
export function drawNodeGlow(
  graphics: Graphics,
  x: number,
  y: number,
  config: NodeSpriteConfig
): void {
  const nodeType = mapNodeType(config.node);
  const sizeConfig = NODE_SIZES[nodeType];
  const showGlow = config.isHovered || config.isHighlighted;

  if (!showGlow) return;

  const glowColor = config.isAllocated
    ? NODE_COLORS.glow.allocated
    : NODE_COLORS.glow.hover;
  const glowRadius = sizeConfig.glowRadius;

  // Draw soft glow using multiple alpha layers
  const layers = 4;
  for (let i = layers; i > 0; i--) {
    const layerRadius = glowRadius + (i * 4);
    const alpha = 0.15 / i;

    if (sizeConfig.sides === 0) {
      graphics.circle(x, y, layerRadius);
    } else {
      drawPolygon(graphics, x, y, layerRadius, sizeConfig.sides);
    }
    graphics.fill({ color: glowColor, alpha });
  }
}

/**
 * Draw a node's main shape
 */
export function drawNodeShape(
  graphics: Graphics,
  x: number,
  y: number,
  config: NodeSpriteConfig
): void {
  const nodeType = mapNodeType(config.node);
  const sizeConfig = NODE_SIZES[nodeType];
  const { radius, sides } = sizeConfig;
  const fillColor = getNodeColor(nodeType, config.isAllocated, config.isReachable ?? false);
  const isHovered = config.isHovered ?? false;

  // Draw the shape based on node type
  if (nodeType === 'mastery') {
    drawMasteryShape(graphics, x, y, radius, config.isAllocated);
  } else if (sides === 0) {
    // Circle
    graphics.circle(x, y, radius);
  } else {
    // Polygon
    drawPolygon(graphics, x, y, radius, sides);
  }

  // Fill the shape
  graphics.fill({ color: fillColor });

  // Draw border
  if (nodeType === 'mastery') {
    // Mastery uses circle border
    graphics.circle(x, y, radius);
  } else if (sides === 0) {
    graphics.circle(x, y, radius);
  } else {
    drawPolygon(graphics, x, y, radius, sides);
  }

  const borderColor = config.isAllocated || isHovered
    ? NODE_COLORS.border.allocated
    : NODE_COLORS.border.normal;
  const borderWidth = config.isAllocated ? 2 : 1;
  const borderAlpha = config.isAllocated ? 0.8 : 0.4;

  graphics.stroke({ color: borderColor, width: borderWidth, alpha: borderAlpha });

  // Keystone inner glow when allocated
  if (nodeType === 'keystone' && config.isAllocated) {
    drawPolygon(graphics, x, y, radius * 0.7, sides);
    graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
  }

  // Notable inner highlight when allocated
  if (nodeType === 'notable' && config.isAllocated) {
    drawPolygon(graphics, x, y, radius * 0.6, sides);
    graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.25 });
  }
}

/**
 * Render a complete node sprite (glow + shape) to a container
 */
export function renderNodeSprite(container: Container, config: NodeSpriteConfig): void {
  const { node } = config;

  // Create glow graphics (rendered behind node)
  const glowGraphics = new Graphics();
  drawNodeGlow(glowGraphics, node.x, node.y, config);
  container.addChild(glowGraphics);

  // Create node graphics
  const nodeGraphics = new Graphics();
  drawNodeShape(nodeGraphics, node.x, node.y, config);
  container.addChild(nodeGraphics);
}

/**
 * Create a standalone node sprite container
 */
export function createNodeSprite(config: NodeSpriteConfig): Container {
  const container = new Container();
  container.x = config.node.x;
  container.y = config.node.y;

  // Render at origin since container is positioned
  const centeredConfig = {
    ...config,
    node: { ...config.node, x: 0, y: 0 },
  };

  renderNodeSprite(container, centeredConfig);
  return container;
}

export default createNodeSprite;
