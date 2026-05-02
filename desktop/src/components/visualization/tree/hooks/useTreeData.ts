import { useState, useEffect, useRef } from 'react';
import { callBackend } from '../../../../services/tauri-api';
import type { SpriteConfig } from '../types';

/**
 * Mastery effect data
 */
export interface MasteryEffect {
  effect: number;
  stats: string[];
  reminderText?: string[];
}

/**
 * Tree node data from the backend
 */
export interface TreeNode {
  id: number;
  x: number;
  y: number;
  type: 'normal' | 'notable' | 'keystone' | 'mastery' | 'ascendancy' | 'jewelSocket';
  name?: string;
  stats?: string[];
  icon?: string;
  /** Mastery inactive icon path (for unallocated mastery nodes) */
  inactiveIcon?: string;
  /** Mastery active icon path (for allocated mastery nodes) */
  activeIcon?: string;
  /** Mastery active effect image */
  activeEffectImage?: string;
  /** Reminder text lines (e.g. for timeless jewel overrides) */
  reminderText?: string[];
  ascendancyName?: string;
  isAscendancyStart?: boolean;
  isClassStart?: boolean;
  isJewelSocket?: boolean;
  isProxy?: boolean;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  /** Connected node IDs (combined in + out) */
  connections?: number[];
  /** Available mastery effects (for mastery nodes) */
  masteryEffects?: MasteryEffect[];
  /**
   * Cluster expansion metadata. `parent` lets the renderer hide phantom
   * proxy sockets (Medium-in-Large, Small-in-Medium) when their ancestor
   * socket has a cluster equipped — PoB replaces them with the subgraph.
   */
  expansionJewel?: {
    size: number;
    index: number;
    proxy?: string;
    parent?: string;
  };
}

/**
 * Connection between two nodes
 */
export interface TreeConnection {
  fromId: number;
  toId: number;
  path?: { x: number; y: number }[];
}

/**
 * World bounds for the tree
 */
export interface TreeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Group center and background data from the passive tree.
 */
export interface TreeGroup {
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

/**
 * Tree layout constants needed to match PoB sizing/orbits.
 */
export interface TreeConstants {
  orbitRadii: number[];
  skillsPerOrbit: number[];
}

/**
 * Full tree data structure
 */
export interface TreeData {
  nodes: TreeNode[];
  groups: Record<string, TreeGroup>;
  connections: TreeConnection[];
  constants: TreeConstants;
  bounds: TreeBounds;
  version: string;
  /** Sprite sheet configurations for rendering */
  sprites?: SpriteConfig;
  /** Available zoom levels for sprites */
  imageZoomLevels?: number[];
}

// Cache the tree data since it's static
let cachedTreeData: TreeData | null = null;
let cachePromise: Promise<TreeData> | null = null;

/**
 * Hook to fetch and cache tree data from the backend.
 * Tree data is static per game version, so we cache it globally.
 * Includes retry mechanism for transient failures.
 */
export function useTreeData() {
  const [data, setData] = useState<TreeData | null>(cachedTreeData);
  const [loading, setLoading] = useState(!cachedTreeData);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // If we have cached data, use it
    if (cachedTreeData) {
      setData(cachedTreeData);
      setLoading(false);
      setError(null);
      return;
    }

    // Clear error state on retry
    setError(null);
    setLoading(true);

    // If a fetch is already in progress, wait for it
    if (!cachePromise) {
      console.log('[useTreeData] Starting fetch, attempt:', retryCount + 1);
      cachePromise = fetchTreeData();
    }

    cachePromise
      .then((treeData) => {
        if (mountedRef.current) {
          cachedTreeData = treeData;
          setData(treeData);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        console.error('[useTreeData] Failed to fetch tree data:', err);
        // Clear the promise so we can retry
        cachePromise = null;

        if (mountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(errorMessage || 'Unknown error fetching tree data');
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [retryCount]);

  // Retry function to manually trigger a refetch
  const retry = () => {
    cachePromise = null; // Clear any stale promise
    setRetryCount((c) => c + 1);
  };

  return { data, loading, error, retry };
}

/**
 * Raw node data from the backend API
 */
interface RawTreeNode {
  id: number;
  name?: string;
  stats?: string[];
  x: number;
  y: number;
  isKeystone?: boolean;
  isNotable?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  ascendancyName?: string;
  isAscendancyStart?: boolean;
  isClassStart?: boolean;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  isProxy?: boolean;
  connections?: number[];
  icon?: string;
  expansionJewel?: {
    size: number;
    index: number;
    proxy?: string;
    parent?: string;
  };
  /** Mastery inactive icon path (for unallocated mastery nodes) */
  inactiveIcon?: string;
  /** Mastery active icon path (for allocated mastery nodes) */
  activeIcon?: string;
  /** Mastery active effect image */
  activeEffectImage?: string;
  masteryEffects?: MasteryEffect[];
}

/**
 * Raw API response format
 */
interface RawTreeDataResponse {
  nodes: Record<string, RawTreeNode>;
  groups: Record<string, {
    x: number;
    y: number;
    orbits?: number[];
    nodes?: string[];
    background?: {
      image: string;
      isHalfImage?: boolean;
    };
  }>;
  constants: TreeConstants;
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  /** Sprite sheet configurations */
  sprites?: SpriteConfig;
  /** Available zoom levels for sprites */
  imageZoomLevels?: number[];
}

/**
 * Determine node type from raw node data
 */
function getNodeType(node: RawTreeNode): TreeNode['type'] {
  if (node.isKeystone) return 'keystone';
  if (node.isNotable) return 'notable';
  if (node.isMastery) return 'mastery';
  if (node.isJewelSocket) return 'jewelSocket';
  if (node.ascendancyName) return 'ascendancy';
  return 'normal';
}

/**
 * Fetch tree data from the backend API
 */
async function fetchTreeData(): Promise<TreeData> {
  // Use callBackend for proper Tauri/browser environment handling
  const raw = await callBackend<RawTreeDataResponse>('/api/v1/tree-data', 'GET');

  // Transform the API response to match our TreeData format
  const nodes: TreeNode[] = Object.values(raw.nodes).map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    type: getNodeType(node),
    name: node.name,
    stats: node.stats,
    icon: node.icon,
    // Mastery nodes have special icon paths
    inactiveIcon: node.inactiveIcon,
    activeIcon: node.activeIcon,
    activeEffectImage: node.activeEffectImage,
    ascendancyName: node.ascendancyName,
    isAscendancyStart: node.isAscendancyStart,
    isClassStart: node.isClassStart,
    isJewelSocket: node.isJewelSocket,
    isProxy: node.isProxy,
    group: node.group,
    orbit: node.orbit,
    orbitIndex: node.orbitIndex,
    connections: node.connections || [],
    masteryEffects: node.masteryEffects,
    expansionJewel: node.expansionJewel,
  }));

  const groups: Record<string, TreeGroup> = {};
  for (const [groupId, group] of Object.entries(raw.groups)) {
    const nodeIds = group.nodes ?? [];
    const ascendancyStartNode = nodeIds
      .map((nodeId) => raw.nodes[nodeId])
      .find((node) => node?.isAscendancyStart && node.ascendancyName);

    groups[groupId] = {
      id: groupId,
      x: group.x,
      y: group.y,
      orbits: group.orbits ?? [],
      nodeIds,
      background: group.background,
      ascendancyName: ascendancyStartNode?.ascendancyName,
      isAscendancyStart: ascendancyStartNode?.isAscendancyStart,
    };
  }

  // Connections are derived from node data (already included in nodes)
  const connections: TreeConnection[] = [];

  // Debug: Check if sprites are in raw response
  console.log('[useTreeData] Raw response sprites check:', {
    hasSprites: !!raw.sprites,
    spriteKeys: raw.sprites ? Object.keys(raw.sprites).slice(0, 5) : [],
    rawKeys: Object.keys(raw).filter(k => k.includes('sprite') || k.includes('Sprite')),
  });

  return {
    nodes,
    groups,
    connections,
    constants: raw.constants,
    bounds: {
      minX: raw.min_x,
      maxX: raw.max_x,
      minY: raw.min_y,
      maxY: raw.max_y,
    },
    version: '3.28', // Current version
    sprites: raw.sprites,
    imageZoomLevels: raw.imageZoomLevels,
  };
}

/**
 * Clear the cached tree data (useful for testing or when game version changes)
 */
export function clearTreeDataCache() {
  cachedTreeData = null;
  cachePromise = null;
}
