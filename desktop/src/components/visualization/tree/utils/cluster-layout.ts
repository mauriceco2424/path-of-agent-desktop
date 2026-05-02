/**
 * Cluster Jewel Layout Utilities
 *
 * Calculates positions for cluster jewel sub-tree nodes.
 * Based on PoB's PassiveSpec.lua BuildSubgraph function.
 *
 * Cluster jewels create dynamic sub-graphs attached to jewel sockets.
 * Node IDs >= 65536 (0x10000) are cluster jewel nodes.
 *
 * @module tree/utils/cluster-layout
 */

// Cluster jewel node ID offset - all cluster nodes have IDs >= this value
export const CLUSTER_NODE_OFFSET = 0x10000; // 65536

/**
 * Cluster jewel size configurations
 * Based on PoB's Data/ClusterJewels.lua
 */
export const CLUSTER_SIZES = {
  large: {
    sizeIndex: 2,
    orbit: 3,
    totalIndices: 12,
    minSkills: 8,
    maxSkills: 12,
    // Notable positions for large clusters
    notableIndices: [6, 4, 8, 10, 2],
    // Small passive positions
    smallIndices: [0, 4, 6, 8, 10, 2, 7, 5, 9, 3, 11, 1],
    // Socket positions (for nested medium jewels)
    socketIndices: [4, 8, 6],
  },
  medium: {
    sizeIndex: 1,
    orbit: 2,
    totalIndices: 12,
    minSkills: 4,
    maxSkills: 6,
    notableIndices: [6, 10, 2, 0],
    smallIndices: [0, 6, 8, 4, 10, 2],
    socketIndices: [6],
  },
  small: {
    sizeIndex: 0,
    orbit: 1,
    totalIndices: 6,
    minSkills: 2,
    maxSkills: 3,
    notableIndices: [4],
    smallIndices: [0, 4, 2],
    socketIndices: [4],
  },
} as const;

export type ClusterSize = keyof typeof CLUSTER_SIZES;

/**
 * Orbit radii for cluster jewel positioning
 * These are smaller than the main tree orbits to fit in the socket area
 */
export const CLUSTER_ORBIT_RADII = [0, 82, 162, 335];

/**
 * Skills per orbit for cluster jewels
 * Maps to the totalIndices of each cluster size
 */
export const CLUSTER_SKILLS_PER_ORBIT = [1, 6, 12, 12];

/**
 * Parsed cluster node information
 */
export interface ClusterNodeInfo {
  /** Original node ID */
  id: number;
  /** Node index within the cluster (0-11) */
  nodeIndex: number;
  /** Cluster size index (0=small, 1=medium, 2=large) */
  sizeIndex: number;
  /** Large socket index (0-5) for which large socket this cluster is in */
  largeIndex: number;
  /** Medium socket index (0-2) for nested medium jewels */
  mediumIndex: number;
  /** Cluster size type */
  size: ClusterSize;
}

/**
 * Cluster jewel data structure for rendering
 */
export interface ClusterJewelData {
  /** Socket node ID where the cluster is socketed */
  socketNodeId: number;
  /** Cluster jewel type */
  jewelType: ClusterSize;
  /** Number of passive skills in the cluster */
  passiveCount: number;
  /** Names of notable passives in the cluster */
  notables: string[];
  /** Type of small passive bonus (e.g., "12% increased Projectile Damage") */
  smallPassiveType?: string;
  /** Node ID of nested jewel socket (for medium in large, small in medium) */
  nestedJewelSocket?: number;
  /** Allocated cluster node IDs */
  allocatedNodes: number[];
}

/**
 * Calculated position for a cluster node
 */
export interface ClusterNodePosition {
  /** Node ID */
  id: number;
  /** X position in world coordinates */
  x: number;
  /** Y position in world coordinates */
  y: number;
  /** Node type for rendering */
  type: 'small' | 'notable' | 'socket' | 'mastery' | 'keystone';
  /** Node index within cluster (for debugging) */
  nodeIndex: number;
}

/**
 * Check if a node ID is a cluster jewel node
 */
export function isClusterNode(nodeId: number): boolean {
  return nodeId >= CLUSTER_NODE_OFFSET;
}

/**
 * Parse a cluster node ID to extract its components
 *
 * Node ID structure (from PoB PassiveSpec.lua):
 * - Bits 0-3: Node index (0-11)
 * - Bits 4-5: Size index (0=small, 1=medium, 2=large)
 * - Bits 6-8: Large socket index (0-5)
 * - Bits 9-10: Medium socket index (0-2)
 * - Bit 16: Signal bit (always 1)
 */
export function parseClusterNodeId(nodeId: number): ClusterNodeInfo | null {
  if (!isClusterNode(nodeId)) {
    return null;
  }

  const id = nodeId - CLUSTER_NODE_OFFSET;

  // Extract components using bit manipulation
  const nodeIndex = id & 0xf; // Bits 0-3
  const sizeIndex = (id >> 4) & 0x3; // Bits 4-5
  const largeIndex = (id >> 6) & 0x7; // Bits 6-8
  const mediumIndex = (id >> 9) & 0x3; // Bits 9-10

  // Determine size from sizeIndex
  let size: ClusterSize;
  switch (sizeIndex) {
    case 2:
      size = 'large';
      break;
    case 1:
      size = 'medium';
      break;
    default:
      size = 'small';
  }

  return {
    id: nodeId,
    nodeIndex,
    sizeIndex,
    largeIndex,
    mediumIndex,
    size,
  };
}

/**
 * Calculate the position of a cluster node relative to its socket
 *
 * @param socketX - X position of the socket in world coordinates
 * @param socketY - Y position of the socket in world coordinates
 * @param nodeIndex - Node index within the cluster (0 = entrance)
 * @param size - Cluster jewel size
 * @param socketOrbitIndex - The orbit index of the socket node in the main tree
 * @returns Position in world coordinates
 */
export function calculateClusterNodePosition(
  socketX: number,
  socketY: number,
  nodeIndex: number,
  size: ClusterSize,
  socketOrbitIndex: number = 0
): { x: number; y: number } {
  const config = CLUSTER_SIZES[size];

  // Get the orbit radius for this cluster size
  const orbit = config.orbit;
  const radius = CLUSTER_ORBIT_RADII[orbit];
  const totalIndices = config.totalIndices;

  // Calculate the base angle for the socket
  // The cluster extends outward from the socket, so we need to consider
  // the socket's position in the main tree to orient the cluster
  // For simplicity, assume clusters extend radially outward from tree center
  const socketAngle = Math.atan2(socketY, socketX);

  // Calculate the node's angle within the cluster
  // Nodes are arranged in an arc around the entrance point
  // The entrance (index 0) connects to the socket
  const arcSpan = Math.PI * 0.6; // Clusters span about 108 degrees
  const nodeAngle = socketAngle + (nodeIndex / totalIndices - 0.5) * arcSpan;

  // Calculate position using orbit formula
  // The cluster group center is offset from the socket
  const groupOffset = radius * 0.8;
  const groupX = socketX + Math.cos(socketAngle) * groupOffset;
  const groupY = socketY + Math.sin(socketAngle) * groupOffset;

  // Calculate node position within the cluster group
  // Use similar formula to main tree but with cluster-specific radii
  const nodeRadius = radius * 0.6;
  const x = groupX + nodeRadius * Math.cos(nodeAngle);
  const y = groupY + nodeRadius * Math.sin(nodeAngle);

  return { x, y };
}

/**
 * Calculate positions for all nodes in a cluster jewel
 *
 * @param socketX - Socket X position
 * @param socketY - Socket Y position
 * @param size - Cluster size
 * @param nodeCount - Number of nodes in this cluster
 * @param notableCount - Number of notables
 * @param socketCount - Number of nested sockets
 * @param socketOrbitIndex - Socket's position in main tree
 * @returns Array of node positions
 */
export function calculateClusterLayout(
  socketX: number,
  socketY: number,
  size: ClusterSize,
  nodeCount: number,
  notableCount: number,
  socketCount: number,
  socketOrbitIndex: number = 0
): ClusterNodePosition[] {
  const config = CLUSTER_SIZES[size];
  const positions: ClusterNodePosition[] = [];

  // Track which indices are used
  const usedIndices = new Map<number, ClusterNodePosition>();

  // Calculate the direction from center to socket (cluster extends outward)
  const distFromCenter = Math.sqrt(socketX * socketX + socketY * socketY);
  const dirX = distFromCenter > 0 ? socketX / distFromCenter : 0;
  const dirY = distFromCenter > 0 ? socketY / distFromCenter : 1;

  // Cluster group center is offset from socket along the radial direction
  const groupOffset = CLUSTER_ORBIT_RADII[config.orbit] * 0.6;
  const groupX = socketX + dirX * groupOffset;
  const groupY = socketY + dirY * groupOffset;

  // Calculate angle offset based on socket position
  const baseAngle = Math.atan2(dirY, dirX);

  // Helper to calculate position for a given index
  const calcPosition = (index: number): { x: number; y: number } => {
    const totalIndices = config.totalIndices;
    // Map index to angle - entrance (0) is closest to socket
    // Arc spans from -60 to +60 degrees around the radial direction
    const arcSpan = Math.PI * 0.67; // ~120 degrees
    const normalizedIndex = index / totalIndices;
    const angle = baseAngle + (normalizedIndex - 0.5) * arcSpan;

    const nodeRadius = CLUSTER_ORBIT_RADII[config.orbit] * 0.5;
    return {
      x: groupX + nodeRadius * Math.cos(angle),
      y: groupY + nodeRadius * Math.sin(angle),
    };
  };

  // First pass: place sockets at their designated indices
  const socketIndicesCopy = [...config.socketIndices];
  for (let i = 0; i < Math.min(socketCount, socketIndicesCopy.length); i++) {
    const index = socketIndicesCopy[i];
    const pos = calcPosition(index);
    const nodePos: ClusterNodePosition = {
      id: CLUSTER_NODE_OFFSET + index, // Placeholder ID
      x: pos.x,
      y: pos.y,
      type: 'socket',
      nodeIndex: index,
    };
    usedIndices.set(index, nodePos);
    positions.push(nodePos);
  }

  // Second pass: place notables at their designated indices
  const notableIndicesCopy = [...config.notableIndices];
  let notablesPlaced = 0;
  for (const index of notableIndicesCopy) {
    if (notablesPlaced >= notableCount) break;
    if (usedIndices.has(index)) continue;

    const pos = calcPosition(index);
    const nodePos: ClusterNodePosition = {
      id: CLUSTER_NODE_OFFSET + index, // Placeholder ID
      x: pos.x,
      y: pos.y,
      type: 'notable',
      nodeIndex: index,
    };
    usedIndices.set(index, nodePos);
    positions.push(nodePos);
    notablesPlaced++;
  }

  // Third pass: fill remaining slots with small passives
  const smallCount = nodeCount - socketCount - notableCount;
  let smallsPlaced = 0;
  for (const index of config.smallIndices) {
    if (smallsPlaced >= smallCount) break;
    if (usedIndices.has(index)) continue;

    const pos = calcPosition(index);
    const nodePos: ClusterNodePosition = {
      id: CLUSTER_NODE_OFFSET + index, // Placeholder ID
      x: pos.x,
      y: pos.y,
      type: 'small',
      nodeIndex: index,
    };
    usedIndices.set(index, nodePos);
    positions.push(nodePos);
    smallsPlaced++;
  }

  // Ensure entrance node (index 0) is always present
  if (!usedIndices.has(0)) {
    const pos = calcPosition(0);
    positions.push({
      id: CLUSTER_NODE_OFFSET,
      x: pos.x,
      y: pos.y,
      type: 'small',
      nodeIndex: 0,
    });
  }

  return positions;
}

/**
 * Generate cluster node connections
 * Cluster nodes connect sequentially around the arc,
 * with the entrance node connecting to the socket
 */
export function generateClusterConnections(
  positions: ClusterNodePosition[],
  socketNodeId: number,
  size: ClusterSize
): Array<{ fromId: number; toId: number }> {
  const connections: Array<{ fromId: number; toId: number }> = [];

  // Sort positions by node index to get the arc order
  const sorted = [...positions].sort((a, b) => a.nodeIndex - b.nodeIndex);

  // Connect adjacent nodes in the arc
  for (let i = 0; i < sorted.length - 1; i++) {
    connections.push({
      fromId: sorted[i].id,
      toId: sorted[i + 1].id,
    });
  }

  // Close the arc for large and medium clusters
  if (size !== 'small' && sorted.length > 2) {
    connections.push({
      fromId: sorted[sorted.length - 1].id,
      toId: sorted[0].id,
    });
  }

  // Connect entrance (index 0) to the socket
  const entranceNode = sorted.find((p) => p.nodeIndex === 0);
  if (entranceNode) {
    connections.push({
      fromId: entranceNode.id,
      toId: socketNodeId,
    });
  }

  return connections;
}

/**
 * Extract cluster jewel information from allocated nodes
 *
 * @param allocatedNodes - All allocated node IDs
 * @returns Map of socket ID to cluster nodes allocated in that socket
 */
export function groupClusterNodesBySocket(
  allocatedNodes: number[]
): Map<number, ClusterNodeInfo[]> {
  const groups = new Map<number, ClusterNodeInfo[]>();

  for (const nodeId of allocatedNodes) {
    if (!isClusterNode(nodeId)) continue;

    const info = parseClusterNodeId(nodeId);
    if (!info) continue;

    // Create a socket key based on the cluster's position in the tree
    // This is a simplified approach - full implementation would track
    // which socket each cluster is actually in
    const socketKey = info.largeIndex * 10 + info.mediumIndex;

    if (!groups.has(socketKey)) {
      groups.set(socketKey, []);
    }
    groups.get(socketKey)!.push(info);
  }

  return groups;
}
