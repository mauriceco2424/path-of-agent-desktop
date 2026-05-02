/**
 * JewelIconGrid Component
 *
 * Displays jewels in a categorized icon grid matching poe.ninja style.
 * Categories: Cluster Jewels, Other (Timeless/Watcher's Eye), Base Jewels, Abyss Jewels
 */

import { useState, useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';
import { JewelSocketDisplay } from './tree/ui/TreeTooltip';
import type { SocketedJewelInfo, ClusterJewelDetails, TimelessTransformInfo } from './tree/ui/TreeTooltip';
import type { StructuredMods, ItemDisplayInfo, ClusterNodeData } from '../../store';

interface JewelItem {
  slot: string;
  name: string;
  baseName: string;
  rarity: string;
  raw: string;
  mods?: StructuredMods;
  displayInfo?: ItemDisplayInfo;
}

interface JewelIconGridProps {
  items: JewelItem[];
  onJewelClick?: (slot: string) => void;
  /** Cluster node data for notable stat lookups in jewel tooltips */
  clusterNodes?: ClusterNodeData[];
  /** Per-socket timeless jewel data for transformed passive display */
  timelessBySocket?: Record<number, {
    jewelName: string;
    conquerorLine?: string;
    transformedNodes: Array<{
      id: number;
      name: string;
      stats: string[];
      originalName?: string;
    }>;
  }>;
}

// Jewel type color styles (gem-socket themed)
const JEWEL_TYPE_COLORS: Record<string, { border: string; glow: string; hoverGlow: string }> = {
  crimson: {
    border: 'border-red-500/40',
    glow: 'shadow-[0_0_4px_rgba(239,68,68,0.15)]',
    hoverGlow: 'shadow-[0_0_10px_rgba(239,68,68,0.35)]',
  },
  viridian: {
    border: 'border-green-500/40',
    glow: 'shadow-[0_0_4px_rgba(34,197,94,0.15)]',
    hoverGlow: 'shadow-[0_0_10px_rgba(34,197,94,0.35)]',
  },
  cobalt: {
    border: 'border-blue-500/40',
    glow: 'shadow-[0_0_4px_rgba(59,130,246,0.15)]',
    hoverGlow: 'shadow-[0_0_10px_rgba(59,130,246,0.35)]',
  },
  prismatic: {
    border: 'border-purple-400/50',
    glow: 'shadow-[0_0_5px_rgba(192,132,252,0.2)]',
    hoverGlow: 'shadow-[0_0_12px_rgba(192,132,252,0.4)]',
  },
  timeless: {
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_5px_rgba(251,191,36,0.2)]',
    hoverGlow: 'shadow-[0_0_12px_rgba(251,191,36,0.4)]',
  },
};

function getJewelTypeStyle(baseName: string, name: string): typeof JEWEL_TYPE_COLORS['crimson'] | null {
  const lower = (baseName || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();

  // Timeless jewels
  if (['glorious vanity', 'lethal pride', 'brutal restraint', 'militant faith', 'elegant hubris']
      .some(t => nameLower.includes(t))) {
    return JEWEL_TYPE_COLORS.timeless;
  }
  // Prismatic (Watcher's Eye)
  if (lower.includes('prismatic')) return JEWEL_TYPE_COLORS.prismatic;
  // Standard jewel types
  if (lower.includes('crimson')) return JEWEL_TYPE_COLORS.crimson;
  if (lower.includes('viridian')) return JEWEL_TYPE_COLORS.viridian;
  if (lower.includes('cobalt')) return JEWEL_TYPE_COLORS.cobalt;

  return null;
}

// Rarity styles - subtle borders for carved slot aesthetic
const RARITY_STYLES: Record<string, {
  border: string;
  glow: string;
  hoverGlow: string;
}> = {
  NORMAL: {
    border: 'border-stone-600/60',
    glow: '',
    hoverGlow: 'hover:shadow-[0_0_8px_rgba(168,162,158,0.3)]',
  },
  MAGIC: {
    border: 'border-blue-500/70',
    glow: 'shadow-[0_0_4px_rgba(59,130,246,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_10px_rgba(59,130,246,0.4)]',
  },
  RARE: {
    border: 'border-yellow-500/70',
    glow: 'shadow-[0_0_4px_rgba(234,179,8,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_10px_rgba(234,179,8,0.4)]',
  },
  UNIQUE: {
    border: 'border-orange-500/80',
    glow: 'shadow-[0_0_6px_rgba(249,115,22,0.3)]',
    hoverGlow: 'hover:shadow-[0_0_12px_rgba(249,115,22,0.5)]',
  },
};

function getRarityStyle(rarity: string) {
  return RARITY_STYLES[rarity] || RARITY_STYLES.NORMAL;
}

// Jewel size in pixels (smaller than equipment cells)
const JEWEL_SIZE = 36;

type JewelCategory = 'cluster' | 'other' | 'base' | 'abyss';

interface CategorizedJewel extends JewelItem {
  category: JewelCategory;
}

/**
 * Check if an item has cluster jewel mods
 */
function hasClusterJewelMods(item: JewelItem): boolean {
  if (!item.mods) return false;

  const allMods = [
    ...(item.mods.implicits || []),
    ...(item.mods.explicits || []),
    ...(item.mods.crafted || []),
    ...(item.mods.enchants || []),
  ];

  for (const mod of allMods) {
    const modText = (mod.text || '').toLowerCase();
    if (
      modText.includes('added small passive') ||
      modText.includes('added passive skill is') ||
      modText.includes('passive skills in radius')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a jewel is a "special" jewel (Watcher's Eye, Timeless, etc.)
 */
function isSpecialJewel(item: JewelItem): boolean {
  const name = (item.name || '').toLowerCase();
  const baseName = (item.baseName || '').toLowerCase();

  // Watcher's Eye
  if (name.includes("watcher's eye") || baseName.includes("prismatic jewel")) {
    return true;
  }

  // Timeless jewels
  const timelessBases = ['glorious vanity', 'lethal pride', 'brutal restraint', 'militant faith', 'elegant hubris'];
  if (timelessBases.some(t => name.includes(t) || baseName.includes(t))) {
    return true;
  }

  // Thread of Hope
  if (name.includes('thread of hope')) {
    return true;
  }

  // Impossible Escape
  if (name.includes('impossible escape')) {
    return true;
  }

  // Megalomaniac (large cluster with random notables)
  if (name.includes('megalomaniac')) {
    return true;
  }

  return false;
}

/**
 * Categorize a jewel
 */
function categorizeJewel(item: JewelItem): JewelCategory {
  const slotLower = (item.slot ?? '').toLowerCase();
  const baseNameLower = (item.baseName ?? '').toLowerCase();

  // Abyss jewels (in gear slots)
  if (slotLower.includes('abyss')) {
    return 'abyss';
  }

  // Special jewels BEFORE cluster — Impossible Escape has "passive skills in radius"
  // mod text that falsely triggers cluster detection via hasClusterJewelMods()
  if (isSpecialJewel(item)) {
    return 'other';
  }

  // Cluster jewels
  if (baseNameLower.includes('cluster') || hasClusterJewelMods(item)) {
    return 'cluster';
  }

  // Default to base jewels (regular tree jewels)
  return 'base';
}

/**
 * Check if an item is a jewel
 */
function isJewelItem(item: JewelItem): boolean {
  const slotLower = (item.slot ?? '').toLowerCase();
  return (
    slotLower.includes('jewel') ||
    slotLower.includes('cluster') ||
    slotLower.includes('abyss')
  );
}

const TIMELESS_BASES = ['Elegant Hubris', 'Militant Faith', 'Lethal Pride', 'Brutal Restraint', 'Glorious Vanity', 'Timeless Jewel'];

/**
 * Build a SocketedJewelInfo from a JewelItem for use with JewelSocketDisplay.
 */
function buildSocketedJewelInfo(jewel: JewelItem): SocketedJewelInfo {
  const nameLower = (jewel.name || '').toLowerCase();
  const baseNameLower = (jewel.baseName || '').toLowerCase();

  const isTimeless = TIMELESS_BASES.some(t => nameLower.includes(t.toLowerCase()) || baseNameLower.includes(t.toLowerCase()));
  const isThreadOfHope = nameLower.includes('thread of hope');
  const isClusterJewel = baseNameLower.includes('cluster jewel');

  let clusterSize: 'large' | 'medium' | 'small' | undefined;
  if (isClusterJewel) {
    if (baseNameLower.includes('large')) clusterSize = 'large';
    else if (baseNameLower.includes('medium')) clusterSize = 'medium';
    else if (baseNameLower.includes('small')) clusterSize = 'small';
  }

  // Collect mod texts, tracking implicits separately so the tooltip can render
  // them above a divider (matches ItemTooltip / JewelSection pattern).
  const implicitStats: string[] = [];
  const stats: string[] = [];
  if (jewel.mods) {
    if (jewel.mods.implicits) {
      for (const mod of jewel.mods.implicits) {
        if (mod.text) implicitStats.push(mod.text);
      }
    }
    const explicitGroups = [jewel.mods.explicits, jewel.mods.crafted];
    for (const group of explicitGroups) {
      if (group) {
        for (const mod of group) {
          if (mod.text) stats.push(mod.text);
        }
      }
    }
  }

  // Extract radius from stats (e.g. "Passives in Radius ..." or "Medium Radius" etc.)
  let radiusLabel: string | undefined;
  for (const stat of [...implicitStats, ...stats]) {
    const radiusMatch = stat.match(/(Small|Medium|Large|Variable)\s+Radius/i);
    if (radiusMatch) {
      radiusLabel = radiusMatch[1];
      break;
    }
  }

  return {
    name: jewel.name,
    baseName: jewel.baseName,
    rarity: jewel.rarity?.toUpperCase(),
    isTimeless,
    isThreadOfHope,
    isClusterJewel,
    clusterSize,
    implicitStats,
    stats,
    radiusLabel,
  };
}

/**
 * Parse socket node ID from jewel slot string (e.g. "Jewel 26725" -> 26725)
 */
function parseSocketNodeId(slot: string): number | null {
  const match = slot.match(/Jewel\s+(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

interface JewelIconProps {
  jewel: CategorizedJewel;
  onClick?: () => void;
  /** Cluster details for this jewel's socket (if it's a cluster jewel) */
  clusterJewelDetails?: ClusterJewelDetails;
  /** Timeless jewel transformation data for this socket */
  timelessInfo?: TimelessTransformInfo;
}

function JewelIcon({ jewel, onClick, clusterJewelDetails, timelessInfo }: JewelIconProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = jewel.rarity?.toUpperCase() || 'NORMAL';
  const rarityStyle = getRarityStyle(rarity);
  const jewelTypeStyle = getJewelTypeStyle(jewel.baseName, jewel.name);
  const activeStyle = jewelTypeStyle ?? rarityStyle;
  const iconUrl = jewel.displayInfo?.iconUrl;
  const fallbackIconUrl = jewel.displayInfo?.fallbackIconUrl;

  // Truncate name for display
  const displayName = jewel.displayInfo?.itemName || jewel.name || jewel.baseName;
  const truncatedName = displayName.length > 12 ? displayName.slice(0, 10) + '...' : displayName;

  const jewelContent = (
    <div
      className="flex flex-col items-center gap-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Carved stone slot container */}
      <div
        className="relative cursor-pointer transition-all duration-150"
        style={{
          width: `${JEWEL_SIZE}px`,
          height: `${JEWEL_SIZE}px`,
        }}
        onClick={onClick}
      >
        {/* Outer stone border - the "lip" of the carved slot */}
        <div
          className={cn(
            'absolute inset-0 rounded-[3px]',
            'bg-gradient-to-b from-[#2a2520] via-[#1f1b17] to-[#18140f]',
            'border border-[#3a3530]/60',
            isHovered && 'border-[#4a4540]/80'
          )}
        />

        {/* Inner carved recess */}
        <div
          className={cn(
            'absolute rounded-[2px] flex items-center justify-center overflow-hidden',
            'shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),inset_0_0_8px_rgba(0,0,0,0.8)]',
            'bg-[#0c0c0e]',
            activeStyle.glow,
            isHovered && activeStyle.hoverGlow
          )}
          style={{
            top: '3px',
            left: '3px',
            right: '3px',
            bottom: '3px',
          }}
        >
          {/* Rarity border inside the slot */}
          <div
            className={cn(
              'absolute inset-0 rounded-[1px] pointer-events-none',
              'border',
              activeStyle.border
            )}
          />

          {iconUrl ? (
            <img
              src={iconUrl}
              alt={displayName}
              className="max-w-full max-h-full object-contain relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{
                maxWidth: `${JEWEL_SIZE - 8}px`,
                maxHeight: `${JEWEL_SIZE - 8}px`,
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Try fallback icon URL before hiding
                if (fallbackIconUrl && target.src !== fallbackIconUrl) {
                  target.src = fallbackIconUrl;
                  return;
                }
                target.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-[0.5rem] text-stone-600 text-center">
              Jewel
            </span>
          )}

          {/* Corrupted indicator */}
          {jewel.displayInfo?.isCorrupted && (
            <div
              className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-red-700 border border-black/60 z-20"
              title="Corrupted"
            />
          )}
        </div>

        {/* Hover highlight */}
        {isHovered && (
          <div
            className="absolute inset-0 rounded-[3px] pointer-events-none"
            style={{
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          />
        )}
      </div>

      {/* Name label */}
      <span className="text-[0.625rem] text-slate-500 text-center max-w-[60px] truncate">
        {truncatedName}
      </span>
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root open={isHovered}>
        <Tooltip.Trigger asChild>{jewelContent}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={8} className="z-50">
            <JewelSocketDisplay
              socketedJewel={buildSocketedJewelInfo(jewel)}
              isAllocated={true}
              clusterJewelDetails={clusterJewelDetails}
              timelessInfo={timelessInfo}
            />
            <Tooltip.Arrow className="fill-slate-700" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}


/**
 * Build ClusterJewelDetails from item mods, enriching notable stats from a global lookup.
 * The lookup maps notable name → stats from ALL cluster nodes in the build.
 * Notable stats are universal (same notable always has the same stats).
 */
function buildClusterDetailsFromMods(
  jewel: JewelItem,
  notableStatsLookup: Map<string, string[]>,
): ClusterJewelDetails | undefined {
  if (!jewel.mods) return undefined;
  const allMods = [
    ...(jewel.mods.enchants || []),
    ...(jewel.mods.implicits || []),
    ...(jewel.mods.explicits || []),
    ...(jewel.mods.crafted || []),
  ];

  let totalPassives = 0;
  let smallPassiveGrant: string | undefined;
  let hasNestedSocket = false;
  const notableNames: string[] = [];

  for (const mod of allMods) {
    const text = mod.text || '';

    const passiveMatch = text.match(/Adds (\d+) Passive Skills?/i);
    if (passiveMatch) {
      totalPassives = parseInt(passiveMatch[1], 10);
      continue;
    }

    const grantMatch = text.match(/Added Small Passive Skills grant:\s*(.+)/i);
    if (grantMatch) {
      smallPassiveGrant = grantMatch[1].trim();
      continue;
    }

    const alsoGrantMatch = text.match(/Added Small Passive Skills also grant:\s*(.+)/i);
    if (alsoGrantMatch) {
      if (!smallPassiveGrant) smallPassiveGrant = alsoGrantMatch[1].trim();
      continue;
    }

    if (/Added Passive Skill is a Jewel Socket/i.test(text)) {
      hasNestedSocket = true;
      continue;
    }

    const notableMatch = text.match(/Added Passive Skill is (.+)/i);
    if (notableMatch) {
      notableNames.push(notableMatch[1].trim());
    }
  }

  if (totalPassives === 0 && notableNames.length === 0) return undefined;

  return {
    totalPassives,
    smallPassiveGrant,
    hasNestedSocket,
    notables: notableNames.map(name => ({
      name,
      stats: notableStatsLookup.get(name) ?? [],
    })),
  };
}

export function JewelIconGrid({ items, onJewelClick, clusterNodes, timelessBySocket }: JewelIconGridProps) {
  // Build ClusterJewelDetails by socketNodeId from cluster node data,
  // plus a secondary index by sorted notable names for fallback matching.
  // Primary index: socket node ID → ClusterJewelDetails (for direct slot matching)
  // Global lookup: notable name → stats (for enriching mod-based fallback)
  const { clusterDetailsBySocket, notableStatsLookup } = useMemo(() => {
    if (!clusterNodes?.length) {
      return {
        clusterDetailsBySocket: new Map<number, ClusterJewelDetails>(),
        notableStatsLookup: new Map<string, string[]>(),
      };
    }

    // Global lookup: every Notable node's name → stats (universal across all jewels)
    const notableStats = new Map<string, string[]>();
    for (const node of clusterNodes) {
      if (node.type === 'Notable' && node.name && node.stats?.length) {
        notableStats.set(node.name, node.stats);
      }
    }

    // Group by socketNodeId for primary (slot-based) lookup
    const bySocket = new Map<number, ClusterNodeData[]>();
    for (const node of clusterNodes) {
      if (node.socketNodeId == null) continue;
      const existing = bySocket.get(node.socketNodeId);
      if (existing) {
        existing.push(node);
      } else {
        bySocket.set(node.socketNodeId, [node]);
      }
    }

    const result = new Map<number, ClusterJewelDetails>();
    for (const [socketId, nodes] of bySocket) {
      const notables = nodes
        .filter(n => n.type === 'Notable' && n.name && n.stats?.length)
        .map(n => ({ name: n.name, stats: n.stats! }));

      const hasNestedSocket = nodes.some(n => n.type === 'Socket');
      const smallPassives = nodes.filter(n => n.type === 'Normal');
      const smallPassiveGrant = smallPassives.length > 0 && smallPassives[0].stats?.length
        ? smallPassives[0].stats[0]
        : undefined;

      result.set(socketId, {
        totalPassives: nodes.filter(n => n.type !== 'Mastery').length,
        notables,
        hasNestedSocket,
        smallPassiveGrant,
      });
    }

    return { clusterDetailsBySocket: result, notableStatsLookup: notableStats };
  }, [clusterNodes]);

  // Filter all jewels and categorize them for display order
  const allJewels = useMemo(() => {
    const jewels = items.filter(isJewelItem);

    // Categorize for sorting (cluster first, then special, then base, then abyss)
    const categorized: CategorizedJewel[] = jewels.map((jewel) => ({
      ...jewel,
      category: categorizeJewel(jewel),
    }));

    // Sort: cluster > other > base > abyss
    const categoryOrder: Record<JewelCategory, number> = {
      cluster: 0,
      other: 1,
      base: 2,
      abyss: 3,
    };

    return categorized.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
  }, [items]);

  if (allJewels.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      {/* Ornate divider + label */}
      <div className="flex items-center gap-3 w-full max-w-[280px]">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(167,139,250,0.35))' }} />
        <span className="text-[0.5625rem] font-display uppercase tracking-widest text-violet-400/70" style={{ textShadow: '0 0 8px rgba(167,139,250,0.25)' }}>Jewels</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(167,139,250,0.35))' }} />
      </div>

      {/* Jewel icons */}
      <div className="flex flex-wrap justify-center gap-2">
        {allJewels.map((jewel, index) => (
          <JewelIcon
            key={`${jewel.slot}-${index}`}
            jewel={jewel}
            onClick={() => onJewelClick?.(jewel.slot)}
            clusterJewelDetails={
              jewel.category === 'cluster'
                ? (
                    // Primary: match by socket node ID (works when slot normalization succeeds)
                    clusterDetailsBySocket.get(parseSocketNodeId(jewel.slot) ?? -1)
                    // Fallback: build from item mods, enrich notables with stats from global lookup
                    ?? buildClusterDetailsFromMods(jewel, notableStatsLookup)
                  )
                : undefined
            }
            timelessInfo={(() => {
              if (!timelessBySocket) return undefined;
              const socketId = parseSocketNodeId(jewel.slot);
              if (socketId == null) return undefined;
              const info = timelessBySocket[socketId];
              if (!info) return undefined;
              return { conquerorLine: info.conquerorLine, transformedNodes: info.transformedNodes };
            })()}
          />
        ))}
      </div>
    </div>
  );
}

export default JewelIconGrid;
