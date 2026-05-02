/**
 * ConnectionLayer Utilities
 *
 * Utility functions for rendering connection lines between passive tree nodes
 * using vanilla Pixi.js.
 *
 * NOTE: The main InteractiveTreeCanvas.tsx now handles connection rendering directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module visualization/tree/layers/ConnectionLayer
 */

import { Container, Graphics } from 'pixi.js';
import type { TreeNode, TreeConnection } from '../hooks/useTreeData';

// Re-export types for consumers
export type { TreeNode, TreeConnection };

/**
 * Color constants matching PoB's visual style
 */
export const CONNECTION_COLORS = {
  /** Both nodes allocated - bright gold */
  ALLOCATED: 0xffc864,
  /** Neither node allocated - dark gray */
  UNALLOCATED: 0x3a3a3a,
  /** One node allocated, one not - dim gold */
  INTERMEDIATE: 0x7a6a4a,
} as const;

/**
 * Line thickness configuration
 */
export const CONNECTION_LINE_WIDTH = {
  ALLOCATED: 3,
  DEFAULT: 2,
} as const;

/**
 * Configuration for connection layer rendering
 */
export interface ConnectionLayerConfig {
  /** Array of tree connections (may include pre-computed paths) */
  connections: TreeConnection[];
  /** Array of tree nodes for position lookup when paths not provided */
  nodes: TreeNode[];
  /** IDs of currently allocated nodes */
  allocatedNodes: number[];
}

/**
 * Determine line color based on allocation state of connected nodes
 */
export function getConnectionColor(
  fromId: number,
  toId: number,
  allocatedSet: Set<number>
): number {
  const fromAllocated = allocatedSet.has(fromId);
  const toAllocated = allocatedSet.has(toId);

  if (fromAllocated && toAllocated) {
    return CONNECTION_COLORS.ALLOCATED;
  } else if (fromAllocated || toAllocated) {
    return CONNECTION_COLORS.INTERMEDIATE;
  }
  return CONNECTION_COLORS.UNALLOCATED;
}

/**
 * Determine line width based on allocation state
 */
export function getConnectionLineWidth(
  fromId: number,
  toId: number,
  allocatedSet: Set<number>
): number {
  const bothAllocated = allocatedSet.has(fromId) && allocatedSet.has(toId);
  return bothAllocated ? CONNECTION_LINE_WIDTH.ALLOCATED : CONNECTION_LINE_WIDTH.DEFAULT;
}

/**
 * Build connections from node data when connections array is empty
 */
export function buildConnectionsFromNodes(nodes: TreeNode[]): TreeConnection[] {
  const connections: TreeConnection[] = [];
  const drawnConnectionKeys = new Set<string>();

  for (const node of nodes) {
    if (!node.connections) continue;

    for (const connectedId of node.connections) {
      // Create a unique key to avoid duplicates (A->B same as B->A)
      const key = [node.id, connectedId].sort((a, b) => a - b).join('-');
      if (drawnConnectionKeys.has(key)) continue;
      drawnConnectionKeys.add(key);

      connections.push({
        fromId: node.id,
        toId: connectedId,
      });
    }
  }

  return connections;
}

/**
 * Draw all connections to a Graphics object
 */
export function drawConnections(
  graphics: Graphics,
  config: ConnectionLayerConfig
): void {
  const { connections, nodes, allocatedNodes } = config;

  // Create lookup maps
  const allocatedSet = new Set(allocatedNodes);
  const nodeMap = new Map<number, TreeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Build connections from nodes if not provided
  const effectiveConnections = connections.length > 0
    ? connections
    : buildConnectionsFromNodes(nodes);

  graphics.clear();

  for (const conn of effectiveConnections) {
    const color = getConnectionColor(conn.fromId, conn.toId, allocatedSet);
    const width = getConnectionLineWidth(conn.fromId, conn.toId, allocatedSet);

    // If connection has a pre-computed path (e.g., for curved orbit connections)
    if (conn.path && conn.path.length >= 2) {
      graphics.moveTo(conn.path[0].x, conn.path[0].y);
      for (let i = 1; i < conn.path.length; i++) {
        graphics.lineTo(conn.path[i].x, conn.path[i].y);
      }
      graphics.stroke({ color, width });
      continue;
    }

    // Otherwise, draw a straight line between nodes
    const fromNode = nodeMap.get(conn.fromId);
    const toNode = nodeMap.get(conn.toId);

    if (fromNode && toNode) {
      graphics.moveTo(fromNode.x, fromNode.y);
      graphics.lineTo(toNode.x, toNode.y);
      graphics.stroke({ color, width });
    }
  }
}

/**
 * Create a connection layer container
 *
 * @param config - Connection layer configuration
 * @returns Container with connection graphics
 */
export function createConnectionLayer(config: ConnectionLayerConfig): Container {
  const container = new Container();
  const graphics = new Graphics();

  drawConnections(graphics, config);
  container.addChild(graphics);

  return container;
}

export default createConnectionLayer;
