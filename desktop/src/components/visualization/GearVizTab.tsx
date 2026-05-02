/**
 * GearVizTab Component
 *
 * Visual equipment grid displaying gear in a PoE-authentic icon layout.
 * Features ornate frame, rarity-colored slots, flask shelf, and jewel gallery.
 */

import { useMemo } from 'react';
import { EquipmentIconGrid } from './EquipmentIconGrid';
import { JewelIconGrid } from './JewelIconGrid';
import type { BuildVisualizationResponse } from '../../store';

interface GearVizTabProps {
  items: BuildVisualizationResponse['items'];
  skills?: BuildVisualizationResponse['skills'];
  /** Cluster node data for notable stat lookups in jewel tooltips */
  clusterNodes?: BuildVisualizationResponse['tree']['clusterNodes'];
  /** Per-socket timeless jewel data for transformed passive display */
  timelessBySocket?: BuildVisualizationResponse['tree']['timelessBySocket'];
  /** @deprecated Kept for interface compat — list view removed */
  expandedSlots?: string[];
  /** @deprecated Kept for interface compat — list view removed */
  onToggleSlot?: (slot: string) => void;
}

export function GearVizTab({ items, skills, clusterNodes, timelessBySocket }: GearVizTabProps) {
  // Derive active skill names from all enabled socket groups
  const activeSkillNames = useMemo(() => {
    if (!skills?.groups) return undefined;
    const names = new Set<string>();
    for (const group of skills.groups) {
      if (!group.enabled) continue;
      for (const gem of group.gemList ?? []) {
        if (gem.enabled && gem.nameSpec) {
          names.add(gem.nameSpec);
        }
      }
    }
    return names.size > 0 ? names : undefined;
  }, [skills]);
  return (
    <div className="flex flex-col gap-2">
      {/* Icon Grid */}
      {items.length > 0 && (
        <div className="flex flex-col items-center py-2">
          <EquipmentIconGrid items={items} activeSkillNames={activeSkillNames} />
          <JewelIconGrid items={items} clusterNodes={clusterNodes} timelessBySocket={timelessBySocket} />
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <p className="text-sm">No equipment data available</p>
        </div>
      )}
    </div>
  );
}

export default GearVizTab;
