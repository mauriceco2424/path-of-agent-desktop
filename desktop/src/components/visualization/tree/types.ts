/** Processed node ready for rendering */
export interface RenderableNode {
  id: number;
  name: string;
  stats: string[];
  reminderText?: string[];

  // Calculated position
  x: number;
  y: number;

  // Node type
  type:
    | 'small'
    | 'notable'
    | 'keystone'
    | 'mastery'
    | 'jewelSocket'
    | 'ascendancyStart';
  isKeystone: boolean;
  isNotable: boolean;
  isMastery: boolean;
  isJewelSocket: boolean;
  isAscendancyStart: boolean;
  ascendancyName?: string;

  // Connections
  connections: number[]; // Combined in + out

  // Sprite
  icon: string;
  /** Mastery inactive icon path */
  inactiveIcon?: string;
  /** Mastery active icon path */
  activeIcon?: string;
  /** Mastery active effect image */
  activeEffectImage?: string;

  // Mastery specific
  masteryEffects?: MasteryEffect[];
}

export interface MasteryEffect {
  effect: number;
  stats: string[];
  reminderText?: string[];
}

export interface RenderableGroup {
  id: string;
  x: number;
  y: number;
  orbits: number[];
  nodeIds: string[];
  background?: {
    image: string;
    isHalfImage?: boolean;
  };
  ascendancyName?: string;
  isAscendancyStart?: boolean;
}

export interface TreeConstants {
  orbitRadii: number[];
  skillsPerOrbit: number[];
}

export interface TreeDataResponse {
  nodes: Record<string, RenderableNode>;
  groups: Record<string, RenderableGroup>;
  constants: TreeConstants;
  sprites: SpriteConfig;
  imageZoomLevels: number[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface SpriteConfig {
  [spriteType: string]: {
    [zoomLevel: string]: {
      filename: string;
      w: number;
      h: number;
      coords: Record<string, { x: number; y: number; w: number; h: number }>;
    };
  };
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

// ============================================================================
// Cluster Jewel Types
// ============================================================================

/** Cluster jewel size classification */
export type ClusterJewelSize = 'large' | 'medium' | 'small';

/**
 * Cluster jewel data for rendering
 * Represents a single cluster jewel socketed in the tree
 */
export interface ClusterJewelRenderData {
  /** Socket node ID where the cluster is socketed */
  socketNodeId: number;
  /** Cluster jewel type/size */
  size: ClusterJewelSize;
  /** Number of passive skills in the cluster (4-12 depending on size) */
  passiveCount: number;
  /** Notable passive names in this cluster */
  notables: string[];
  /** Small passive stat description (e.g., "12% increased Projectile Damage") */
  smallPassiveType?: string;
  /** Cluster node IDs that are allocated */
  allocatedNodeIds: number[];
  /** All cluster node IDs (allocated + unallocated) */
  allNodeIds: number[];
  /** Nested cluster jewel socket ID (for medium in large, small in medium) */
  nestedSocketId?: number;
  /** Item name of the jewel */
  jewelName?: string;
  /** Base item type (e.g., "Large Cluster Jewel") */
  baseType?: string;
}

/**
 * Cluster node for rendering
 * Extends RenderableNode with cluster-specific properties
 */
export interface ClusterNode extends Omit<RenderableNode, 'type'> {
  /** Node type - cluster nodes can be small, notable, or socket */
  type: 'small' | 'notable' | 'jewelSocket' | 'keystone';
  /** Parent socket ID in the main tree */
  parentSocketId: number;
  /** Cluster size this node belongs to */
  clusterSize: ClusterJewelSize;
  /** Node index within the cluster (0-11) */
  nodeIndex: number;
  /** Whether this node is the cluster entrance (connects to main tree) */
  isClusterEntrance: boolean;
}

/**
 * Cluster connection between nodes
 */
export interface ClusterConnection {
  /** Source node ID */
  fromId: number;
  /** Target node ID */
  toId: number;
  /** Whether this connection goes to the main tree socket */
  isSocketConnection: boolean;
  /** Whether the connection is active (both nodes allocated) */
  isActive: boolean;
}
