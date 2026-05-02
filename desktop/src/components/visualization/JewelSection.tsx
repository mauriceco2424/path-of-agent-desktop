/**
 * JewelSection Component
 *
 * Displays equipped jewels in the Equipment tab as a flat list.
 * Shows cluster jewel notables inline below the jewel name.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Diamond } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { StructuredMods, ItemDisplayInfo, ModEntry } from '../../store';
import { normalizeSlotForMatching } from '@shared/utils/slot-colors';

// Jewel item type matching BuildVisualizationResponse['items'][number]
interface JewelItem {
  slot: string;
  name: string;
  baseName: string;
  rarity: string;
  raw: string;
  mods?: StructuredMods;
  displayInfo?: ItemDisplayInfo;
}

interface JewelSectionProps {
  items: JewelItem[];
  expandedSlots: string[];
  onToggleSlot: (slot: string) => void;
  /** Currently hovered slot name from improvement cards */
  hoveredSlot?: string | null;
  /** Callback to register slot element refs for scroll-into-view */
  registerSlotRef?: (slot: string, element: HTMLDivElement | null) => void;
}

// Jewel type categories
type JewelCategory = 'tree' | 'cluster' | 'abyss';

interface CategorizedJewel extends JewelItem {
  category: JewelCategory;
  notables?: string[];
}

/** Teal glow for gear pathway - matches EquipmentSlotItem */
const TEAL_GLOW = 'rgba(20, 184, 166, 0.4)';

// Simplified rarity colors - just for item name text, not borders
const rarityTextColors: Record<string, string> = {
  NORMAL: 'text-slate-300',
  MAGIC: 'text-blue-400',
  RARE: 'text-yellow-400',
  UNIQUE: 'text-orange-400',
};

// Mod colors - PoB-matched: implicits white, explicits blue
const modColors = {
  implicit: 'text-[#C8C8C8]',    // White — PoB enchant/implicit color
  explicit: 'text-[#8888FF]',    // Blue — PoB explicit mod color
  prefix: 'text-[#8888FF]',      // Blue
  suffix: 'text-[#8888FF]',      // Blue
  crafted: 'text-[#B4B4FF]',     // Light blue for crafted mods
  fractured: 'text-[#A38D6D]',   // Gold/brown for fractured mods
  unknown: 'text-[#8888FF]',     // Blue
} as const;

/**
 * Format tier/roll info for display (matches EquipmentSlotItem)
 */
interface TierRollDisplay {
  affixBadge?: { label: string; colorClass: string };
  tierRange?: string;
}

function formatTierRollInfo(mod: ModEntry): TierRollDisplay | null {
  const result: TierRollDisplay = {};

  const addAffixBadge = () => {
    if (mod.affixType === 'prefix') {
      result.affixBadge = { label: 'P', colorClass: 'text-sky-400' };
    } else if (mod.affixType === 'suffix') {
      result.affixBadge = { label: 'S', colorClass: 'text-orange-400' };
    }
  };

  if (mod.tier && mod.tierRange) {
    result.tierRange = `T${mod.tier} [${mod.tierRange.min}-${mod.tierRange.max}]`;
    addAffixBadge();
  } else if (mod.rollRange) {
    result.tierRange = `[${mod.rollRange.min}-${mod.rollRange.max}]`;
    // No P/S badge for unique items (rollRange)
  } else if (mod.affixType === 'prefix' || mod.affixType === 'suffix') {
    addAffixBadge();
  }

  if (!result.affixBadge && !result.tierRange) {
    return null;
  }

  return result;
}

/**
 * Get mod color based on affix type and jewel category
 * All jewels use PoB-matched blue (#8888FF) for explicits
 */
function getModColor(affixType: string | undefined, _isClusterJewel?: boolean): string {
  return modColors.explicit;
}

// Removed toTitleCase - now using toUpperCase() directly for ALL CAPS display

/**
 * Check if an item has cluster jewel mods based on mod text patterns.
 * Cluster jewels have distinctive mods like "Added Small Passive Skills also grant"
 * and "Added Passive Skill is <notable>".
 */
function hasClusterJewelMods(item: JewelItem): boolean {
  if (!item.mods) return false;

  // Check all mod categories
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
 * Categorize a jewel based on its slot, baseName, and mods.
 * - Tree jewels: slot contains "Jewel" (case insensitive), NOT "cluster", NOT "abyss"
 * - Cluster jewels: baseName contains "Cluster" OR has cluster-specific mods
 * - Abyss jewels (gear): slot contains "Abyss"
 */
function categorizeJewel(item: JewelItem): JewelCategory {
  const slotLower = (item.slot ?? '').toLowerCase();
  const baseNameLower = (item.baseName ?? '').toLowerCase();
  const nameLower = (item.name ?? '').toLowerCase();

  // Check for Abyss jewels first (in gear slots)
  if (slotLower.includes('abyss')) {
    return 'abyss';
  }

  // Check for Cluster jewels by baseName
  if (baseNameLower.includes('cluster')) {
    return 'cluster';
  }

  // Check for Cluster jewels by mod patterns (some cluster jewels have random names
  // like "Rapture Cut" that don't include "cluster" in the name/base).
  // Exclude Impossible Escape — has "passive skills in radius" but is NOT a cluster jewel.
  if (!nameLower.includes('impossible escape') && hasClusterJewelMods(item)) {
    return 'cluster';
  }

  // Default to tree jewels
  return 'tree';
}

/**
 * Extract cluster notable names from raw item text.
 * Looks for lines matching: "1 Added Passive Skill is <notable name>"
 *
 * Filter out non-notable results like "Jewel Socket" which come from
 * mods like "# Added Passive Skills are Jewel Sockets"
 */
function extractClusterNotables(raw: string): string[] {
  const notables: string[] = [];
  const lines = raw.split('\n');

  // Words/phrases that are NOT notable names (they're mod effects)
  const notNotables = [
    'jewel socket',
    'jewel sockets',
    'a jewel socket',
  ];

  for (const line of lines) {
    // Match "1 Added Passive Skill is <name>" or "Added Passive Skill is <name>" pattern
    // The "1" prefix indicates the count of notables
    const match = line.match(/(?:\d+\s+)?Added Passive Skill is (.+)/i);
    if (match && match[1]) {
      const notable = match[1].trim();
      // Filter out non-notable names
      if (!notNotables.includes(notable.toLowerCase())) {
        notables.push(notable);
      }
    }
  }

  return notables;
}

/**
 * Check if an item is a jewel based on its slot name.
 * Jewel slots include: "Jewel 1", "Jewel 2", etc., cluster sockets, and abyss sockets
 */
function isJewelItem(item: JewelItem): boolean {
  const slotLower = (item.slot ?? '').toLowerCase();
  return (
    slotLower.includes('jewel') ||
    slotLower.includes('cluster') ||
    slotLower.includes('abyss')
  );
}

interface JewelItemRowProps {
  jewel: CategorizedJewel;
  isExpanded: boolean;
  onToggle: () => void;
  /** Whether this jewel is highlighted (from hovering improvement card) */
  isHighlighted?: boolean;
}

/**
 * Individual jewel row component with expandable details.
 * Uses card-forge styling for consistency with EquipmentSlotItem.
 */
function JewelItemRow({ jewel, isExpanded, onToggle, isHighlighted }: JewelItemRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = jewel.rarity?.toUpperCase() || 'NORMAL';
  const rarityTextColor = rarityTextColors[rarity] || rarityTextColors.NORMAL;
  const displayName = jewel.displayInfo?.itemName || jewel.name || jewel.baseName;

  // Format slot name for display
  const formatSlotName = (slot: string): string => {
    // For cluster jewels, show position
    if (slot.toLowerCase().includes('cluster')) {
      return slot;
    }
    // For abyss jewels, show which gear piece
    if (slot.toLowerCase().includes('abyss')) {
      // Extract the gear slot (e.g., "Belt Abyss" -> "Belt")
      const parts = slot.split(/\s+/);
      if (parts.length > 1) {
        return `${parts[0]} Abyss`;
      }
      return 'Abyss';
    }
    // For tree jewels, keep the original slot name
    return slot;
  };

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative rounded-lg overflow-hidden',
        'card-forge',
        'transition-all duration-200'
      )}
      style={{
        ...(isHovered ? {
          boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 0 25px ${TEAL_GLOW}`,
          borderColor: 'rgba(20, 184, 166, 0.4)',
        } : {}),
        ...(isHighlighted ? {
          boxShadow: `0 4px 24px rgba(0, 0, 0, 0.5), 0 0 30px ${TEAL_GLOW}`,
          borderColor: 'rgba(20, 184, 166, 0.6)',
          transform: 'scale(1.01)',
        } : {}),
      }}
    >
      {/* Subtle top glow on hover */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 pointer-events-none',
          (isHovered || isHighlighted) && 'opacity-100'
        )}
        style={{
          background: `radial-gradient(circle at 50% 0%, ${TEAL_GLOW} 0%, transparent 70%)`,
        }}
      />

      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'relative z-[1] w-full flex items-center gap-2 px-3 py-2.5',
          'text-left transition-colors cursor-pointer'
        )}
      >
        {/* Expand/Collapse icon */}
        <span className={cn(
          'transition-colors duration-200 flex-shrink-0',
          isHovered ? 'text-teal-400' : 'text-slate-500'
        )}>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>

        {/* Slot name */}
        <span className={cn(
          'text-xs font-display font-medium uppercase tracking-wider w-20 flex-shrink-0 transition-colors duration-200',
          isHovered ? 'text-slate-200' : 'text-slate-400'
        )}>
          {formatSlotName(jewel.slot)}
        </span>

        {/* Jewel name */}
        <span className={cn('text-sm font-medium truncate', rarityTextColor)}>
          {displayName}
        </span>

        {/* Cluster jewel badge */}
        {jewel.category === 'cluster' && (
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium flex-shrink-0">
            Cluster
          </span>
        )}

        {/* Abyss jewel badge */}
        {jewel.category === 'abyss' && (
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-green-300 font-medium flex-shrink-0">
            Abyss
          </span>
        )}

        {/* Rarity indicator */}
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0 ml-auto',
            rarity === 'UNIQUE' && 'bg-orange-500',
            rarity === 'RARE' && 'bg-yellow-500',
            rarity === 'MAGIC' && 'bg-blue-500',
            rarity === 'NORMAL' && 'bg-slate-500'
          )}
        />
      </button>

      {/* Cluster notables (shown when collapsed for quick reference) */}
      {!isExpanded && jewel.notables && jewel.notables.length > 0 && (
        <div className="relative z-[1] px-3 pb-2 -mt-1">
          <div className="text-xs text-amber-400/80 pl-7">
            <span className="text-slate-500 mr-1">-</span>
            {jewel.notables.join(', ')}
          </div>
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="relative z-[1] px-3 pb-3 pt-2 border-t border-slate-700/30 bg-black/20">
              {/* Base type */}
              <div className="text-xs text-slate-500 mb-1">
                {jewel.baseName}
              </div>

              {/* Cluster notables (expanded view) - PoB style gold color */}
              {jewel.notables && jewel.notables.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-slate-400 mb-0.5">Notables:</div>
                  <div className="pl-2 space-y-0.5">
                    {jewel.notables.map((notable, idx) => (
                      <div key={idx} className="text-sm text-amber-400 font-medium">
                        {notable}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show mods if available - left-aligned with right info */}
              {jewel.mods && (
                <div>
                  {/* Implicits - left-aligned with right info */}
                  {jewel.mods.implicits.filter(m => m.text?.trim()).length > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {jewel.mods.implicits
                        .filter(m => m.text?.trim())
                        .map((mod, idx) => {
                          const tierRollInfo = formatTierRollInfo(mod);
                          return (
                            <div key={`impl-${idx}`} className="flex justify-between items-baseline gap-4">
                              <span className={cn('text-sm font-pob', modColors.implicit)}>
                                {mod.text || ''}
                              </span>
                              {(tierRollInfo?.tierRange || tierRollInfo?.affixBadge) && (
                                <span className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                                  {tierRollInfo.tierRange && <span>{tierRollInfo.tierRange}</span>}
                                  {tierRollInfo.affixBadge && (
                                    <span className={cn('font-semibold', tierRollInfo.affixBadge.colorClass)}>
                                      {tierRollInfo.affixBadge.label}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Separator between implicits and explicits */}
                  {jewel.mods.implicits.filter(m => m.text?.trim()).length > 0 &&
                   jewel.mods.explicits.filter(m => m.text?.trim()).length > 0 && (
                    <div className="border-t border-slate-700/30 my-2" />
                  )}

                  {/* Explicits - left-aligned with right info */}
                  {jewel.mods.explicits.filter(m => m.text?.trim()).length > 0 && (
                    <div className="space-y-0.5">
                      {jewel.mods.explicits
                        .filter(m => m.text?.trim())
                        .map((mod, idx) => {
                          const tierRollInfo = formatTierRollInfo(mod);
                          return (
                            <div key={`expl-${idx}`} className="flex justify-between items-baseline gap-4">
                              <span className={cn('text-sm font-pob', getModColor(mod.affixType, jewel.category === 'cluster'))}>
                                {mod.text || ''}
                              </span>
                              {(tierRollInfo?.tierRange || tierRollInfo?.affixBadge) && (
                                <span className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                                  {tierRollInfo.tierRange && <span>{tierRollInfo.tierRange}</span>}
                                  {tierRollInfo.affixBadge && (
                                    <span className={cn('font-semibold', tierRollInfo.affixBadge.colorClass)}>
                                      {tierRollInfo.affixBadge.label}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Corruption status */}
              {jewel.displayInfo?.isCorrupted && (
                <div className="mt-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-600/60 text-red-200 font-medium">
                    Corrupted
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Main JewelSection component.
 * Displays all equipped jewels as a flat list matching other equipment sections.
 */
export function JewelSection({
  items,
  expandedSlots,
  onToggleSlot,
  hoveredSlot,
  registerSlotRef,
}: JewelSectionProps) {
  // Filter and enrich jewels (memoized to avoid recomputation every render)
  const allJewels = useMemo(() => {
    const jewels = items.filter(isJewelItem);

    if (jewels.length === 0) {
      return [];
    }

    // Categorize and enrich jewels with notables
    return jewels.map((jewel) => {
      const category = categorizeJewel(jewel);
      const notables = category === 'cluster' ? extractClusterNotables(jewel.raw) : undefined;
      return { ...jewel, category, notables };
    });
  }, [items]);

  if (allJewels.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Section header - matching GearVizTab styling */}
      <h3 className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-widest text-teal-400/80 mb-2 px-1">
        <Diamond className="w-3.5 h-3.5" />
        Jewels
      </h3>

      {/* Flat list of jewels */}
      <div className="space-y-2">
        {allJewels.map((jewel, index) => {
          // Normalize slot for consistent matching (e.g., "JEWEL 2491" → "jewel-2491")
          // This ensures expansion state works regardless of slot name format variations
          const normalizedSlot = normalizeSlotForMatching(jewel.slot) || jewel.slot;

          // Check if this jewel should be highlighted (matches hovered improvement card)
          // Handle both specific jewel matching (jewel-1, jewel-26725) and generic jewel matching
          // When hoveredSlot is generic "jewel", highlight all jewels
          const isHighlighted = hoveredSlot !== null && (
            normalizedSlot === hoveredSlot ||
            (hoveredSlot === 'jewel' && normalizedSlot?.startsWith('jewel'))
          );

          // Check expansion using normalized slot (compare against normalized values in expandedSlots)
          const isExpanded = expandedSlots.some(
            (s) => (normalizeSlotForMatching(s) || s) === normalizedSlot
          );

          return (
            <div
              key={`jewel-${jewel.slot}-${jewel.baseName || ''}-${index}`}
              ref={(el) => registerSlotRef?.(jewel.slot, el)}
            >
              <JewelItemRow
                jewel={jewel}
                isExpanded={isExpanded}
                onToggle={() => onToggleSlot(normalizedSlot)}
                isHighlighted={isHighlighted}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default JewelSection;
