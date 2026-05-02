import { useMemo } from 'react';
import { useSidebarSpriteData } from '../components/visualization/tree/hooks/useSidebarSpriteData';
import type { NodeIconInfo } from '../components/visualization/tree/hooks/useSidebarSpriteData';
import { useTreeData } from '../components/visualization/tree/hooks/useTreeData';
import type { MasteryEffect } from '../components/visualization/tree/hooks/useTreeData';
import { useDesktopStore } from '../store/index';
import { getKnownTransformedNodeIconAlias } from '../components/visualization/tree/utils/sprite-resolver';

/**
 * Hook to enrich tree node names with sprite icon data and stat tooltips.
 * Used by tree tool result renderers to display rich node badges.
 *
 * Returns maps for looking up node icons, stats, types, and IDs by name or numeric ID.
 * Also merges timeless jewel-transformed node names from nodeOverrides so tooltips
 * work for names like "Corrupted Soul" that don't exist in the static tree database.
 */
export function useTreeNodeEnrichment() {
  const { nodeIconMap, spriteConfig, zoomLevel, ready } = useSidebarSpriteData();
  const { data: treeData } = useTreeData();
  const nodeOverrides = useDesktopStore(s => s.vizData?.tree?.nodeOverrides);

  // Merge timeless jewel-transformed node icons into the base icon map.
  // Same pattern as TreeVizTab's passiveIconMap — without this, transformed nodes
  // like "Corrupted Soul" have no inline icon in analysis text.
  const enrichedIconMap = useMemo(() => {
    if (!nodeOverrides) return nodeIconMap;
    const merged = new Map(nodeIconMap);
    for (const override of Object.values(nodeOverrides)) {
      const iconPath = getKnownTransformedNodeIconAlias(override.name) ?? override.icon;
      if (!override.name || !iconPath || merged.has(override.name)) {
        continue;
      }
      merged.set(override.name, {
        iconPath,
        spriteCategory: 'keystoneActive',
      } satisfies NodeIconInfo);
    }
    return merged;
  }, [nodeIconMap, nodeOverrides]);

  const nodeStatsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (treeData?.nodes) {
      for (const node of treeData.nodes) {
        if (node.name && node.stats?.length && !map.has(node.name)) {
          map.set(node.name, node.stats);
        }
      }
    }
    // Always merge timeless jewel-transformed node names, even if treeData
    // hasn't loaded yet — nodeOverrides arrive via vizData independently
    if (nodeOverrides) {
      for (const override of Object.values(nodeOverrides)) {
        if (override.name && override.stats?.length && !map.has(override.name)) {
          map.set(override.name, override.stats);
        }
      }
    }
    return map;
  }, [treeData, nodeOverrides]);

  const nodeTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (treeData?.nodes) {
      for (const node of treeData.nodes) {
        if (node.name && !map.has(node.name)) {
          if (node.ascendancyName) map.set(node.name, 'ascendancy');
          else if (node.type === 'keystone') map.set(node.name, 'keystone');
          else if (node.type === 'notable') map.set(node.name, 'notable');
          else if (node.type === 'mastery') map.set(node.name, 'mastery');
        }
      }
    }
    // Always merge timeless jewel-transformed nodes, even if treeData
    // hasn't loaded yet — ensures tooltips work for transformed keystones
    if (nodeOverrides) {
      for (const override of Object.values(nodeOverrides)) {
        if (override.name && !map.has(override.name)) {
          map.set(override.name, 'keystone');
        }
      }
    }
    return map;
  }, [treeData, nodeOverrides]);

  /** Map from numeric node ID to enriched node info for resolving addNodes/removeNodes arrays */
  const nodeIdMap = useMemo(() => {
    const map = new Map<number, { name: string; type: string; stats?: string[] }>();
    if (!treeData?.nodes) return map;
    for (const node of treeData.nodes) {
      if (!map.has(node.id)) {
        map.set(node.id, {
          name: node.name ?? '',
          type: node.ascendancyName ? 'ascendancy' : (node.type ?? 'normal'),
          stats: node.stats,
        });
      }
    }
    return map;
  }, [treeData]);

  /** Map from node name to mastery effects (for mastery nodes in tooltips) */
  const nodeMasteryMap = useMemo(() => {
    const map = new Map<string, MasteryEffect[]>();
    if (!treeData?.nodes) return map;
    for (const node of treeData.nodes) {
      if (node.name && node.masteryEffects?.length && !map.has(node.name)) {
        map.set(node.name, node.masteryEffects);
      }
    }
    return map;
  }, [treeData]);

  return { nodeIconMap: enrichedIconMap, spriteConfig, zoomLevel, ready, nodeStatsMap, nodeTypeMap, nodeIdMap, nodeMasteryMap };
}
