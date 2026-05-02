/**
 * Atlas Tree Data Hook
 *
 * Fetches and caches atlas passive tree data from the backend.
 * Mirrors useTreeData but for the atlas tree (no ascendancies, no jewel sockets).
 * Reuses the same TreeData/TreeNode types so InteractiveTreeCanvas can render it.
 */

import { useState, useEffect, useRef } from 'react';
import { callBackend } from '../../../services/tauri-api';
import type { TreeData, TreeNode, TreeGroup, TreeConnection } from '../tree/hooks/useTreeData';
import type { SpriteConfig } from '../tree/types';

// ============================================================================
// Raw API types (atlas-specific response)
// ============================================================================

interface RawAtlasNode {
  id: number;
  name: string;
  stats: string[];
  reminderText?: string[];
  x: number;
  y: number;
  isKeystone: boolean;
  isNotable: boolean;
  isMastery: boolean;
  connections: number[];
  icon: string;
  group?: number;
  orbit?: number;
  orbitIndex?: number;
}

interface RawAtlasTreeResponse {
  nodes: Record<string, RawAtlasNode>;
  groups: Record<string, {
    x: number;
    y: number;
    orbits?: number[];
    nodes?: string[];
    background?: { image: string; isHalfImage?: boolean };
  }>;
  constants: {
    orbitRadii: number[];
    skillsPerOrbit: number[];
    PSSCentreInnerRadius: number;
  };
  sprites?: SpriteConfig;
  imageZoomLevels?: number[];
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  points: { totalPoints: number; ascendancyPoints: number };
}

// ============================================================================
// Cache
// ============================================================================

let cachedAtlasTreeData: TreeData | null = null;
let cachePromise: Promise<TreeData> | null = null;

function getAtlasNodeType(node: RawAtlasNode): TreeNode['type'] {
  if (node.isKeystone) return 'keystone';
  if (node.isNotable) return 'notable';
  if (node.isMastery) return 'mastery';
  return 'normal';
}

async function fetchAtlasTreeData(): Promise<TreeData> {
  const raw = await callBackend<RawAtlasTreeResponse>('/api/v1/atlas/tree-data', 'GET');

  const nodes: TreeNode[] = Object.values(raw.nodes).map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    type: getAtlasNodeType(node),
    name: node.name,
    stats: node.stats,
    reminderText: node.reminderText,
    icon: node.icon,
    group: node.group,
    orbit: node.orbit,
    orbitIndex: node.orbitIndex,
    connections: node.connections || [],
  }));

  const groups: Record<string, TreeGroup> = {};
  for (const [groupId, group] of Object.entries(raw.groups)) {
    groups[groupId] = {
      id: groupId,
      x: group.x,
      y: group.y,
      orbits: group.orbits ?? [],
      nodeIds: group.nodes ?? [],
      background: group.background,
    };
  }

  const connections: TreeConnection[] = [];

  return {
    nodes,
    groups,
    connections,
    constants: {
      orbitRadii: raw.constants.orbitRadii,
      skillsPerOrbit: raw.constants.skillsPerOrbit,
    },
    bounds: {
      minX: raw.min_x,
      maxX: raw.max_x,
      minY: raw.min_y,
      maxY: raw.max_y,
    },
    version: '3.28-atlas',
    sprites: raw.sprites,
    imageZoomLevels: raw.imageZoomLevels,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useAtlasTreeData() {
  const [data, setData] = useState<TreeData | null>(cachedAtlasTreeData);
  const [loading, setLoading] = useState(!cachedAtlasTreeData);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (cachedAtlasTreeData) {
      setData(cachedAtlasTreeData);
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);
    setLoading(true);

    if (!cachePromise) {
      console.log('[useAtlasTreeData] Starting fetch, attempt:', retryCount + 1);
      cachePromise = fetchAtlasTreeData();
    }

    cachePromise
      .then((treeData) => {
        if (mountedRef.current) {
          cachedAtlasTreeData = treeData;
          setData(treeData);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        console.error('[useAtlasTreeData] Failed to fetch atlas tree data:', err);
        cachePromise = null;
        if (mountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(errorMessage || 'Unknown error fetching atlas tree data');
          setLoading(false);
        }
      });

    return () => { mountedRef.current = false; };
  }, [retryCount]);

  const retry = () => {
    cachePromise = null;
    setRetryCount((c) => c + 1);
  };

  return { data, loading, error, retry };
}
