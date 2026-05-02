/**
 * Jewel Radius Effects Utility
 *
 * Parses jewel "Passive Skills in Radius also grant" mods and pre-computes
 * a map of affected node IDs to their granted effects for tooltip display.
 *
 * @module components/visualization/tree/utils/jewel-radius-effects
 */

import type { SocketedJewelInfo } from '../ui/TreeTooltip';
import type { TreeNode } from '../hooks/useTreeData';
import { JEWEL_RADIUS_BY_INDEX } from '../layers/JewelSocketOverlay';

export interface JewelGrantedEffect {
  jewelName: string;
  socketNodeId: number;
  grantedStats: string[];
}

const RADIUS_GRANT_PATTERN = /^Passive Skills in Radius also grant:?\s*(.+)$/i;

/** Node types excluded from "Passive Skills in Radius" effects (matches PoB's jewelOtherFuncs filters) */
const EXCLUDED_NODE_TYPES = new Set(['keystone', 'jewelSocket']);

/**
 * Extract granted stat text from jewel mod lines matching the
 * "Passive Skills in Radius also grant" pattern.
 */
export function parseRadiusGrantMods(stats: string[]): string[] {
  const granted: string[] = [];
  for (const stat of stats) {
    const match = stat.match(RADIUS_GRANT_PATTERN);
    if (match) {
      granted.push(match[1].trim());
    }
  }
  return granted;
}

/**
 * Pre-compute a map of nodeId -> jewel granted effects for all nodes
 * affected by equipped jewels with radius grant mods.
 */
export function buildNodeJewelEffectsMap(
  equippedJewels: Map<number, SocketedJewelInfo>,
  allNodes: TreeNode[],
): Map<number, JewelGrantedEffect[]> {
  const effectsMap = new Map<number, JewelGrantedEffect[]>();

  if (!equippedJewels || equippedJewels.size === 0) return effectsMap;

  // Build a quick lookup for socket node positions
  const nodesById = new Map(allNodes.map(n => [n.id, n]));

  for (const [socketNodeId, jewel] of equippedJewels) {
    // Skip timeless jewels (they replace nodes entirely) and cluster jewels
    if (jewel.isTimeless || jewel.isClusterJewel) continue;
    // Need radius info and stats
    if (!jewel.radiusIndex || !jewel.stats || jewel.stats.length === 0) continue;

    const grantedStats = parseRadiusGrantMods(jewel.stats);
    if (grantedStats.length === 0) continue;

    const socketNode = nodesById.get(socketNodeId);
    if (!socketNode) continue;

    const radiusData = JEWEL_RADIUS_BY_INDEX[jewel.radiusIndex as keyof typeof JEWEL_RADIUS_BY_INDEX];
    if (!radiusData) continue;

    const outerSq = radiusData.outer * radiusData.outer;
    const innerSq = radiusData.inner * radiusData.inner;

    const effect: Omit<JewelGrantedEffect, 'socketNodeId'> = {
      jewelName: jewel.name,
      grantedStats,
    };

    for (const node of allNodes) {
      if (node.id === socketNodeId) continue;
      if (EXCLUDED_NODE_TYPES.has(node.type)) continue;
      if (node.isClassStart || node.isAscendancyStart || node.isProxy) continue;

      const dx = node.x - socketNode.x;
      const dy = node.y - socketNode.y;
      const distSq = dx * dx + dy * dy;

      // Standard radii: within outer circle. Annuli (Thread of Hope): between inner and outer.
      if (distSq > outerSq) continue;
      if (innerSq > 0 && distSq < innerSq) continue;

      const existing = effectsMap.get(node.id);
      const entry: JewelGrantedEffect = { ...effect, socketNodeId };
      if (existing) {
        existing.push(entry);
      } else {
        effectsMap.set(node.id, [entry]);
      }
    }
  }

  return effectsMap;
}
