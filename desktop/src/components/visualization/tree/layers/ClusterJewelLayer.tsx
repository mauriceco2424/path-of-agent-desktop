/**
 * Cluster Jewel Layer Utilities
 *
 * Utility functions for rendering cluster jewel sub-trees using vanilla Pixi.js.
 * Cluster jewels create dynamic sub-graphs with their own nodes and connections.
 *
 * NOTE: The main InteractiveTreeCanvas.tsx handles rendering directly.
 * These utilities are kept for potential future use or refactoring.
 *
 * @module tree/layers/ClusterJewelLayer
 */

import { Container, Graphics } from 'pixi.js';
import type { TreeNode } from '../hooks/useTreeData';
import {
  isClusterNode,
  parseClusterNodeId,
  CLUSTER_SIZES,
  CLUSTER_ORBIT_RADII,
  type ClusterSize,
  type ClusterNodeInfo,
} from '../utils/cluster-layout';
import { renderNode, NODE_LAYER_COLORS, NODE_LAYER_SIZES } from './NodeLayer';

// Re-export for consumers
export { NODE_LAYER_COLORS as NODE_COLORS, NODE_LAYER_SIZES as NODE_SIZES };

// ============================================================================
// Types
// ============================================================================

/**
 * Cluster jewel data for rendering
 */
export interface ClusterJewel {
  /** Socket node ID in the main tree */
  socketNodeId: number;
  /** Socket position in world coordinates */
  socketX: number;
  socketY: number;
  /** Cluster size */
  size: ClusterSize;
  /** All cluster nodes (allocated and unallocated visible in build) */
  nodes: ClusterNodeRenderInfo[];
  /** Connections between cluster nodes */
  connections: ClusterConnectionInfo[];
}

/**
 * Cluster node info for rendering
 */
export interface ClusterNodeRenderInfo {
  /** Original node ID */
  id: number;
  /** Calculated X position */
  x: number;
  /** Calculated Y position */
  y: number;
  /** Node type for rendering */
  type: 'small' | 'notable' | 'socket' | 'keystone';
  /** Node name (from PoB data) */
  name: string;
  /** Stat descriptions */
  stats: string[];
  /** Whether this node is allocated */
  isAllocated: boolean;
  /** Node index within cluster */
  nodeIndex: number;
  /** Whether this is the entrance node (connects to main tree) */
  isEntrance: boolean;
}

/**
 * Connection between cluster nodes
 */
export interface ClusterConnectionInfo {
  fromId: number;
  toId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isActive: boolean;
}

/**
 * Configuration for cluster jewel layer rendering
 */
export interface ClusterJewelLayerConfig {
  /** Cluster jewels to render */
  clusterJewels: ClusterJewel[];
  /** Set of allocated node IDs (for highlighting) */
  allocatedNodeIds: Set<number>;
}

// ============================================================================
// Cluster Colors
// ============================================================================

export const CLUSTER_COLORS = {
  connection: {
    active: 0xd4a84b, // Golden for allocated path
    inactive: 0x444444, // Dark gray for unallocated
  },
  background: {
    large: 0x1a1a2a, // Dark blue tint
    medium: 0x1a2a1a, // Dark green tint
    small: 0x2a1a1a, // Dark red tint
  },
  border: {
    large: 0x3366aa,
    medium: 0x33aa66,
    small: 0xaa6633,
  },
} as const;

// ============================================================================
// Drawing Functions
// ============================================================================

/**
 * Draw the background arc/region for a cluster jewel
 */
export function drawClusterBackground(
  graphics: Graphics,
  cluster: ClusterJewel
): void {
  const config = CLUSTER_SIZES[cluster.size];
  const radius = CLUSTER_ORBIT_RADII[config.orbit] * 0.8;

  // Calculate center and direction
  const socketX = cluster.socketX;
  const socketY = cluster.socketY;
  const dist = Math.sqrt(socketX * socketX + socketY * socketY);
  const dirX = dist > 0 ? socketX / dist : 0;
  const dirY = dist > 0 ? socketY / dist : 1;

  // Group center offset from socket
  const groupOffset = radius * 0.6;
  const centerX = socketX + dirX * groupOffset;
  const centerY = socketY + dirY * groupOffset;

  // Draw a subtle background arc
  const bgColor = CLUSTER_COLORS.background[cluster.size];
  const borderColor = CLUSTER_COLORS.border[cluster.size];

  // Arc background
  graphics.circle(centerX, centerY, radius * 0.9);
  graphics.fill({ color: bgColor, alpha: 0.3 });

  // Border ring
  graphics.circle(centerX, centerY, radius * 0.9);
  graphics.stroke({ color: borderColor, width: 2, alpha: 0.4 });

  // Inner decorative ring
  graphics.circle(centerX, centerY, radius * 0.4);
  graphics.stroke({ color: borderColor, width: 1, alpha: 0.2 });
}

/**
 * Draw connections between cluster nodes
 */
export function drawClusterConnections(
  graphics: Graphics,
  connections: ClusterConnectionInfo[]
): void {
  for (const conn of connections) {
    const color = conn.isActive
      ? CLUSTER_COLORS.connection.active
      : CLUSTER_COLORS.connection.inactive;
    const width = conn.isActive ? 3 : 2;
    const alpha = conn.isActive ? 0.9 : 0.4;

    // Draw the connection line
    graphics.moveTo(conn.fromX, conn.fromY);
    graphics.lineTo(conn.toX, conn.toY);
    graphics.stroke({ color, width, alpha });
  }
}

/**
 * Convert ClusterNodeRenderInfo to TreeNode format for rendering
 */
function clusterNodeToTreeNode(node: ClusterNodeRenderInfo): TreeNode {
  const nodeType: TreeNode['type'] =
    node.type === 'socket'
      ? 'jewelSocket'
      : node.type === 'small'
        ? 'normal'
        : node.type;

  return {
    id: node.id,
    x: node.x,
    y: node.y,
    type: nodeType,
    name: node.name,
    stats: node.stats,
    isJewelSocket: node.type === 'socket',
    connections: [],
  };
}

/**
 * Render a single cluster node
 */
export function drawClusterNode(
  graphics: Graphics,
  node: ClusterNodeRenderInfo
): void {
  const treeNode = clusterNodeToTreeNode(node);
  renderNode(graphics, treeNode, node.isAllocated, false);
}

/**
 * Draw a complete cluster jewel (background, connections, nodes)
 */
export function drawClusterJewel(
  container: Container,
  cluster: ClusterJewel
): void {
  // Background graphics
  const bgGraphics = new Graphics();
  drawClusterBackground(bgGraphics, cluster);
  container.addChild(bgGraphics);

  // Connection graphics
  const connGraphics = new Graphics();
  drawClusterConnections(connGraphics, cluster.connections);
  container.addChild(connGraphics);

  // Node graphics (each node in its own Graphics for potential interaction)
  for (const node of cluster.nodes) {
    const nodeGraphics = new Graphics();
    drawClusterNode(nodeGraphics, node);
    container.addChild(nodeGraphics);
  }
}

/**
 * Create a cluster jewel layer container with all clusters rendered
 *
 * @param config - Cluster jewel layer configuration
 * @returns Container with rendered clusters, or null if no clusters
 */
export function createClusterJewelLayer(config: ClusterJewelLayerConfig): Container | null {
  const { clusterJewels } = config;

  if (clusterJewels.length === 0) {
    return null;
  }

  const container = new Container();
  container.sortableChildren = true;

  for (const cluster of clusterJewels) {
    const clusterContainer = new Container();
    drawClusterJewel(clusterContainer, cluster);
    container.addChild(clusterContainer);
  }

  return container;
}

// ============================================================================
// Utility Functions for Building Cluster Data
// ============================================================================

/**
 * Build cluster jewel render data from allocated nodes and socket positions.
 *
 * This function takes the raw allocated node IDs and builds the complete
 * cluster jewel data structures needed for rendering.
 *
 * @param allocatedNodeIds - All allocated node IDs (including cluster nodes)
 * @param socketPositions - Map of socket node ID to position
 * @param clusterNodeData - Optional map of cluster node ID to its metadata (name, stats)
 */
export function buildClusterJewelData(
  allocatedNodeIds: number[],
  socketPositions: Map<number, { x: number; y: number }>,
  clusterNodeData?: Map<
    number,
    { name: string; stats: string[]; type: 'small' | 'notable' | 'socket' | 'keystone' }
  >
): ClusterJewel[] {
  const clusterJewels: ClusterJewel[] = [];

  // Group cluster nodes by their socket
  const clusterNodesBySocket = new Map<number, ClusterNodeInfo[]>();

  for (const nodeId of allocatedNodeIds) {
    if (!isClusterNode(nodeId)) continue;

    const info = parseClusterNodeId(nodeId);
    if (!info) continue;

    // Use largeIndex to determine which socket this cluster is in
    // This is a simplified approach - full implementation would need
    // to track actual socket assignments from PoB
    const socketKey = info.largeIndex;

    if (!clusterNodesBySocket.has(socketKey)) {
      clusterNodesBySocket.set(socketKey, []);
    }
    clusterNodesBySocket.get(socketKey)!.push(info);
  }

  // For each socket with cluster nodes, build the cluster jewel data
  for (const [socketKey, clusterNodes] of clusterNodesBySocket) {
    if (clusterNodes.length === 0) continue;

    // Determine cluster size from the nodes
    const firstNode = clusterNodes[0];
    const size = firstNode.size;

    // Find the socket position (this would need to be mapped from actual jewel slots)
    // For now, use a placeholder position based on socketKey
    const socketPos = findSocketPosition(socketKey, socketPositions);
    if (!socketPos) continue;

    // Calculate positions for all cluster nodes
    const nodes = calculateClusterNodePositions(
      clusterNodes,
      socketPos.x,
      socketPos.y,
      size,
      clusterNodeData,
      new Set(allocatedNodeIds)
    );

    // Generate connections
    const connections = generateClusterNodeConnections(
      nodes,
      socketPos.nodeId,
      socketPos.x,
      socketPos.y,
      new Set(allocatedNodeIds)
    );

    clusterJewels.push({
      socketNodeId: socketPos.nodeId,
      socketX: socketPos.x,
      socketY: socketPos.y,
      size,
      nodes,
      connections,
    });
  }

  return clusterJewels;
}

/**
 * Find the socket position for a given cluster socket key
 */
function findSocketPosition(
  socketKey: number,
  socketPositions: Map<number, { x: number; y: number }>
): { nodeId: number; x: number; y: number } | null {
  // Try to find a matching socket from the positions map
  // In a full implementation, this would use PoB's socket-to-cluster mapping
  for (const [nodeId, pos] of socketPositions) {
    // Simplified: just return the first socket for now
    // Real implementation would match based on PoB's cluster socket assignments
    return { nodeId, x: pos.x, y: pos.y };
  }
  return null;
}

/**
 * Calculate positions for cluster nodes
 */
function calculateClusterNodePositions(
  clusterNodes: ClusterNodeInfo[],
  socketX: number,
  socketY: number,
  size: ClusterSize,
  clusterNodeData:
    | Map<number, { name: string; stats: string[]; type: 'small' | 'notable' | 'socket' | 'keystone' }>
    | undefined,
  allocatedNodeIds: Set<number>
): ClusterNodeRenderInfo[] {
  const config = CLUSTER_SIZES[size];
  const nodes: ClusterNodeRenderInfo[] = [];

  // Calculate direction from center to socket
  const dist = Math.sqrt(socketX * socketX + socketY * socketY);
  const dirX = dist > 0 ? socketX / dist : 0;
  const dirY = dist > 0 ? socketY / dist : 1;

  // Group center is offset from socket
  const groupOffset = CLUSTER_ORBIT_RADII[config.orbit] * 0.6;
  const groupX = socketX + dirX * groupOffset;
  const groupY = socketY + dirY * groupOffset;
  const baseAngle = Math.atan2(dirY, dirX);

  // Calculate position for each node
  for (const info of clusterNodes) {
    const index = info.nodeIndex;
    const totalIndices = config.totalIndices;

    // Map index to angle
    const arcSpan = Math.PI * 0.67; // ~120 degrees
    const normalizedIndex = index / totalIndices;
    const angle = baseAngle + (normalizedIndex - 0.5) * arcSpan;

    const nodeRadius = CLUSTER_ORBIT_RADII[config.orbit] * 0.5;
    const x = groupX + nodeRadius * Math.cos(angle);
    const y = groupY + nodeRadius * Math.sin(angle);

    // Get node metadata if available
    const metadata = clusterNodeData?.get(info.id);

    // Determine node type based on index position
    let nodeType: 'small' | 'notable' | 'socket' | 'keystone' = 'small';
    const notableIndices = config.notableIndices as readonly number[];
    const socketIndices = config.socketIndices as readonly number[];

    if (notableIndices.includes(index)) {
      nodeType = 'notable';
    } else if (socketIndices.includes(index)) {
      nodeType = 'socket';
    }

    nodes.push({
      id: info.id,
      x,
      y,
      type: metadata?.type ?? nodeType,
      name: metadata?.name ?? `Cluster Node ${index}`,
      stats: metadata?.stats ?? [],
      isAllocated: allocatedNodeIds.has(info.id),
      nodeIndex: index,
      isEntrance: index === 0,
    });
  }

  return nodes;
}

/**
 * Generate connections between cluster nodes
 */
function generateClusterNodeConnections(
  nodes: ClusterNodeRenderInfo[],
  socketNodeId: number,
  socketX: number,
  socketY: number,
  allocatedNodeIds: Set<number>
): ClusterConnectionInfo[] {
  const connections: ClusterConnectionInfo[] = [];

  // Sort nodes by index
  const sortedNodes = [...nodes].sort((a, b) => a.nodeIndex - b.nodeIndex);

  // Connect adjacent nodes in the arc
  for (let i = 0; i < sortedNodes.length - 1; i++) {
    const from = sortedNodes[i];
    const to = sortedNodes[i + 1];

    connections.push({
      fromId: from.id,
      toId: to.id,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      isActive: from.isAllocated && to.isAllocated,
    });
  }

  // Connect entrance node to socket
  const entranceNode = sortedNodes.find((n) => n.isEntrance);
  if (entranceNode) {
    connections.push({
      fromId: entranceNode.id,
      toId: socketNodeId,
      fromX: entranceNode.x,
      fromY: entranceNode.y,
      toX: socketX,
      toY: socketY,
      isActive: entranceNode.isAllocated && allocatedNodeIds.has(socketNodeId),
    });
  }

  return connections;
}

export default createClusterJewelLayer;
