/**
 * Jewel Socket Mapper Utility
 *
 * Maps equipped jewels from the build's items array to their corresponding
 * tree socket node IDs for tooltip display.
 *
 * @module components/visualization/tree/utils/jewel-socket-mapper
 */

import type { SocketedJewelInfo } from '../ui/TreeTooltip';

/**
 * Item from the build visualization response
 */
interface BuildItem {
  slot: string;
  name?: string;
  baseName?: string;
  rarity?: string;
  displayInfo?: {
    iconUrl?: string;
  };
  jewelRadiusLabel?: string;
  jewelRadiusIndex?: number;
  mods?: {
    implicits?: Array<{ text: string }>;
    explicits?: Array<{ text: string }>;
    crafted?: Array<{ text: string }>;
  };
}

/**
 * Known timeless jewel base types
 */
const TIMELESS_JEWEL_BASES = [
  'Timeless Jewel',
  'Elegant Hubris',
  'Militant Faith',
  'Lethal Pride',
  'Brutal Restraint',
  'Glorious Vanity',
];

function containsTimelessName(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return TIMELESS_JEWEL_BASES.some(
    (timeless) => lower.includes(timeless.toLowerCase())
  );
}

/**
 * Check if a jewel is a timeless jewel based on base name or item name.
 * PoB may put the useful identifier in either field.
 */
function isTimelessJewel(
  baseName: string | undefined,
  name: string | undefined
): boolean {
  return containsTimelessName(baseName) || containsTimelessName(name);
}

/**
 * Check if a jewel is Thread of Hope based on name or base type.
 */
function isThreadOfHope(
  name: string | undefined,
  baseName: string | undefined
): boolean {
  const lowerName = name?.toLowerCase() ?? '';
  const lowerBase = baseName?.toLowerCase() ?? '';
  return lowerName.includes('thread of hope') || lowerBase.includes('thread of hope');
}

/**
 * Check if a jewel is a cluster jewel based on its base name or item name.
 * PoB sometimes puts "Large Cluster Jewel" in the name field instead of baseName.
 */
function isClusterJewel(baseName: string | undefined, name: string | undefined): boolean {
  const baseCheck = baseName?.toLowerCase().includes('cluster') ?? false;
  const nameCheck = name?.toLowerCase().includes('cluster jewel') ?? false;
  return baseCheck || nameCheck;
}

/**
 * Get the cluster jewel size from its base name or item name.
 * PoB sometimes puts the cluster type in the name field.
 */
function getClusterSize(baseName: string | undefined, name: string | undefined): 'large' | 'medium' | 'small' | undefined {
  // Check baseName first
  const baseLower = (baseName || '').toLowerCase();
  if (baseLower.includes('large cluster')) return 'large';
  if (baseLower.includes('medium cluster')) return 'medium';
  if (baseLower.includes('small cluster')) return 'small';

  // Fall back to name (PoB often puts cluster type in name)
  const nameLower = (name || '').toLowerCase();
  if (nameLower.includes('large cluster')) return 'large';
  if (nameLower.includes('medium cluster')) return 'medium';
  if (nameLower.includes('small cluster')) return 'small';

  return undefined;
}

/**
 * Normalize radius labels into canonical tooltip/overlay values.
 */
function normalizeRadiusLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const lower = label.trim().toLowerCase();

  if (lower.includes('very large')) return 'Very Large';
  if (lower.includes('massive')) return 'Massive';
  if (lower.includes('large')) return 'Large';
  if (lower.includes('medium')) return 'Medium';
  if (lower.includes('small')) return 'Small';
  if (lower.includes('variable')) return 'Variable';

  return undefined;
}

/**
 * Extract the radius label from Thread of Hope or other radius-affecting jewels
 */
function extractRadiusLabel(mods: BuildItem['mods']): string | undefined {
  if (!mods) return undefined;

  // Look for radius mods in all mod types
  const allMods = [
    ...(mods.implicits || []),
    ...(mods.explicits || []),
  ];

  for (const mod of allMods) {
    const text = mod.text?.toLowerCase() || '';

    // Thread of Hope has mods like "Only affects Passives in Small Ring"
    if (text.includes('small ring') || text.includes('small radius')) {
      return 'Small';
    }
    if (text.includes('medium ring') || text.includes('medium radius')) {
      return 'Medium';
    }
    if (text.includes('very large')) {
      return 'Very Large';
    }
    if (text.includes('massive ring')) {
      return 'Massive';
    }
    if (text.includes('large ring') || text.includes('large radius')) {
      return 'Large';
    }
  }

  return undefined;
}

/**
 * Derive a radius label from PoB radius index.
 */
function radiusLabelFromIndex(index: number | undefined): string | undefined {
  if (index === 1 || index === 6) return 'Small';
  if (index === 2 || index === 7) return 'Medium';
  if (index === 3 || index === 8) return 'Large';
  if (index === 4 || index === 9) return 'Very Large';
  if (index === 5 || index === 10) return 'Massive';
  return undefined;
}

/**
 * Infer PoB jewel radius index from label.
 * Standard radii: 1=Small, 2=Medium, 3=Large, 4=Very Large, 5=Massive.
 * Thread of Hope annuli: 6-10.
 */
function inferRadiusIndex(
  radiusLabel: string | undefined,
  isThread: boolean
): number | undefined {
  if (!radiusLabel) return undefined;

  const label = radiusLabel.toLowerCase();

  if (isThread) {
    if (label === 'small') return 6;
    if (label === 'medium') return 7;
    if (label === 'large') return 8;
    if (label === 'very large') return 9;
    if (label === 'massive') return 10;
    return undefined;
  }

  if (label === 'small') return 1;
  if (label === 'medium') return 2;
  if (label === 'large') return 3;
  if (label === 'very large') return 4;
  if (label === 'massive') return 5;
  return undefined;
}

/**
 * Extract implicit mod lines from a jewel's mods.
 * Corrupted jewels have implicits like "Corrupted Blood cannot be inflicted on you"
 * that the tooltip renders above a divider, separate from explicits.
 */
function extractJewelImplicits(mods: BuildItem['mods']): string[] {
  if (!mods?.implicits) return [];
  const stats: string[] = [];
  for (const mod of mods.implicits) {
    if (mod.text?.trim()) {
      stats.push(mod.text);
    }
  }
  return stats;
}

/**
 * Extract explicit + crafted stat lines from a jewel's mods.
 * Implicits are tracked separately via `extractJewelImplicits`.
 */
function extractJewelStats(mods: BuildItem['mods']): string[] {
  if (!mods) return [];

  const stats: string[] = [];

  // Add explicits
  if (mods.explicits) {
    for (const mod of mods.explicits) {
      if (mod.text?.trim()) {
        stats.push(mod.text);
      }
    }
  }

  // Add crafted
  if (mods.crafted) {
    for (const mod of mods.crafted) {
      if (mod.text?.trim()) {
        stats.push(mod.text);
      }
    }
  }

  return stats;
}

function extractImpossibleEscapeKeystoneName(mods: BuildItem['mods']): string | undefined {
  // Scan both implicits and explicits — the keystone-unlock mod is an explicit
  // on Impossible Escape today, but don't assume the source layer.
  const stats = [...extractJewelImplicits(mods), ...extractJewelStats(mods)];

  for (const stat of stats) {
    const match = stat.match(/passives in radius of (.+) can be allocated without being connected to your tree/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Parse the jewel slot name to extract the socket node ID.
 * PoB uses the format "Jewel {nodeId}" for tree jewel slots.
 *
 * @param slot - The slot name from the item (e.g., "Jewel 26725")
 * @returns The socket node ID, or undefined if not a valid jewel slot
 */
export function parseJewelSlotToNodeId(slot: string | undefined): number | undefined {
  if (!slot) return undefined;
  // Match "Jewel {number}" pattern
  const match = slot.match(/^Jewel\s+(\d+)$/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Check if an item slot represents a tree jewel socket (not abyss jewels in gear)
 * NOTE: Cluster jewels ARE included - they use "Jewel {nodeId}" format for outer ring sockets
 */
export function isTreeJewelSlot(slot: string | undefined): boolean {
  if (!slot) return false;
  const slotLower = slot.toLowerCase();
  // Exclude only Abyss jewels (in gear sockets, not tree)
  // Do NOT exclude "cluster" - cluster jewels go in tree sockets with "Jewel {nodeId}" format
  if (slotLower.includes('abyss')) {
    return false;
  }
  return parseJewelSlotToNodeId(slot) !== undefined;
}

/**
 * Create a SocketedJewelInfo object from a build item
 */
function createSocketedJewelInfo(item: BuildItem): SocketedJewelInfo {
  const timeless = isTimelessJewel(item.baseName, item.name);
  const threadOfHope = isThreadOfHope(item.name, item.baseName);
  // Pass both baseName and name - PoB sometimes puts cluster type in name field
  const cluster = isClusterJewel(item.baseName, item.name);
  const clusterSize = getClusterSize(item.baseName, item.name);

  const normalizedPoBLabel = normalizeRadiusLabel(item.jewelRadiusLabel);
  const extractedLabel = extractRadiusLabel(item.mods);
  const indexLabel = radiusLabelFromIndex(item.jewelRadiusIndex);

  let radiusLabel = normalizedPoBLabel;
  if (!radiusLabel || radiusLabel === 'Variable') {
    radiusLabel = extractedLabel || indexLabel || radiusLabel;
  }

  const radiusIndex = item.jewelRadiusIndex ?? inferRadiusIndex(extractedLabel || radiusLabel, threadOfHope);
  const impossibleEscapeKeystoneName = extractImpossibleEscapeKeystoneName(item.mods);

  return {
    name: item.name || 'Unknown Jewel',
    baseName: item.baseName || 'Jewel',
    iconUrl: item.displayInfo?.iconUrl,
    rarity: item.rarity || 'normal',
    isTimeless: timeless,
    isThreadOfHope: threadOfHope,
    implicitStats: extractJewelImplicits(item.mods),
    stats: extractJewelStats(item.mods),
    radiusLabel,
    radiusIndex,
    impossibleEscapeKeystoneName,
    isClusterJewel: cluster,
    clusterSize: clusterSize,
  };
}

/**
 * Extract equipped jewels from items array and create a map of socket node ID -> jewel info.
 *
 * @param items - Array of items from the build visualization response
 * @returns Map of socket node ID to SocketedJewelInfo
 */
export function extractEquippedJewels(
  items: BuildItem[]
): Map<number, SocketedJewelInfo> {
  const jewelMap = new Map<number, SocketedJewelInfo>();

  for (const item of items) {
    // Only process tree jewel slots
    if (!isTreeJewelSlot(item.slot)) {
      continue;
    }

    const nodeId = parseJewelSlotToNodeId(item.slot);
    if (nodeId === undefined) {
      continue;
    }

    // Create jewel info and add to map
    const jewelInfo = createSocketedJewelInfo(item);
    jewelMap.set(nodeId, jewelInfo);
  }

  return jewelMap;
}
