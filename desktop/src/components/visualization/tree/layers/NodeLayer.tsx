/**
 * NodeLayer Utilities
 *
 * Utility functions for rendering passive tree nodes using vanilla Pixi.js.
 * Originally designed for @pixi/react JSX rendering, now converted to
 * imperative utility functions for use with vanilla Pixi.js.
 *
 * NOTE: The main InteractiveTreeCanvas.tsx now handles node rendering directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module visualization/tree/layers/NodeLayer
 */

import { Container, Graphics } from 'pixi.js';
import type { TreeNode } from '../hooks/useTreeData';

// Re-export types for consumers
export type { TreeNode };

/**
 * Configuration for node layer rendering
 */
export interface NodeLayerConfig {
  nodes: TreeNode[];
  allocatedNodes: number[];
  reachableNodes?: Set<number>;
  highlightedNodes?: Set<number>;
}

/**
 * Node colors based on allocation state
 */
export const NODE_LAYER_COLORS = {
  allocated: {
    keystone: 0xffd700,
    notable: 0xe6b800,
    small: 0xccaa00,
    mastery: 0xb366ff,
    jewelSocket: 0x00ccff,
    ascendancy: 0xff6600,
  },
  unallocated: {
    keystone: 0x666666,
    notable: 0x555555,
    small: 0x444444,
    mastery: 0x553366,
    jewelSocket: 0x336666,
    ascendancy: 0x553300,
  },
  reachable: {
    keystone: 0x888866,
    notable: 0x777755,
    small: 0x666644,
    mastery: 0x664488,
    jewelSocket: 0x448888,
    ascendancy: 0x774422,
  },
} as const;

/**
 * Node sizes by type
 */
export const NODE_LAYER_SIZES = {
  keystone: 24,
  notable: 16,
  small: 8,
  mastery: 14,
  jewelSocket: 16,
  ascendancy: 14,
} as const;

/**
 * Get the color for a node based on its type and state
 */
export function getNodeColor(
  nodeType: string,
  isAllocated: boolean,
  isReachable: boolean
): number {
  const type = nodeType as keyof typeof NODE_LAYER_COLORS.allocated;

  if (isAllocated) {
    return NODE_LAYER_COLORS.allocated[type] || NODE_LAYER_COLORS.allocated.small;
  }
  if (isReachable) {
    return NODE_LAYER_COLORS.reachable[type] || NODE_LAYER_COLORS.reachable.small;
  }
  return NODE_LAYER_COLORS.unallocated[type] || NODE_LAYER_COLORS.unallocated.small;
}

/**
 * Get the size for a node based on its type
 */
export function getNodeSize(nodeType: string): number {
  const type = nodeType as keyof typeof NODE_LAYER_SIZES;
  return NODE_LAYER_SIZES[type] || NODE_LAYER_SIZES.small;
}

/**
 * Draw a polygon shape for special node types
 */
export function drawPolygon(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  sides: number,
  color: number,
  isAllocated: boolean
): void {
  const angleOffset = -Math.PI / 2; // Start from top
  const points: number[] = [];

  for (let i = 0; i < sides; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / sides;
    points.push(x + radius * Math.cos(angle));
    points.push(y + radius * Math.sin(angle));
  }

  graphics.poly(points);
  graphics.fill({ color, alpha: isAllocated ? 1 : 0.7 });

  if (isAllocated) {
    graphics.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.5 });
    graphics.stroke();
  }
}

/**
 * Render a single node to a Graphics object
 */
export function renderNode(
  graphics: Graphics,
  node: TreeNode,
  isAllocated: boolean,
  isReachable: boolean = false
): void {
  const nodeType = node.type;
  const color = getNodeColor(nodeType, isAllocated, isReachable);
  const size = getNodeSize(nodeType);

  if (nodeType === 'keystone') {
    // Octagon for keystones
    drawPolygon(graphics, node.x, node.y, size, 8, color, isAllocated);
  } else if (nodeType === 'notable' || nodeType === 'ascendancy') {
    // Hexagon for notables
    drawPolygon(graphics, node.x, node.y, size, 6, color, isAllocated);
  } else if (nodeType === 'jewelSocket') {
    // Diamond for jewel sockets
    drawPolygon(graphics, node.x, node.y, size, 4, color, isAllocated);
  } else {
    // Circle for small passives and mastery
    graphics.circle(node.x, node.y, size);
    graphics.fill({ color, alpha: isAllocated ? 1 : 0.7 });
    if (isAllocated) {
      graphics.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.5 });
      graphics.stroke();
    }
  }
}

/**
 * Create a node layer container with all nodes rendered
 *
 * @param config - Node layer configuration
 * @returns Container with rendered nodes
 */
export function createNodeLayer(config: NodeLayerConfig): Container {
  const { nodes, allocatedNodes, reachableNodes, highlightedNodes } = config;
  const container = new Container();
  container.sortableChildren = true;

  const allocatedSet = new Set(allocatedNodes);

  // Sort nodes for proper z-ordering
  const sortedNodes = [...nodes].sort((a, b) => {
    const aAllocated = allocatedSet.has(a.id);
    const bAllocated = allocatedSet.has(b.id);
    const aReachable = reachableNodes?.has(a.id) ?? false;
    const bReachable = reachableNodes?.has(b.id) ?? false;

    // Allocated nodes on top
    if (aAllocated && !bAllocated) return 1;
    if (!aAllocated && bAllocated) return -1;

    // Reachable nodes in the middle
    if (aReachable && !bReachable) return 1;
    if (!aReachable && bReachable) return -1;

    return 0;
  });

  // Render each node
  for (const node of sortedNodes) {
    const isAllocated = allocatedSet.has(node.id);
    const isReachable = reachableNodes?.has(node.id) ?? false;

    const nodeGraphics = new Graphics();
    renderNode(nodeGraphics, node, isAllocated, isReachable);
    container.addChild(nodeGraphics);
  }

  return container;
}

export default createNodeLayer;
