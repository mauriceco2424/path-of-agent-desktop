/**
 * EquipmentSlotItem Component
 *
 * Expandable accordion item for a single equipment slot.
 * Shows item name and rarity when collapsed, full mod details when expanded.
 * Supports structured mod data with prefix/suffix color differentiation.
 * Displays quality rating indicator when available.
 *
 * Styled with card-forge aesthetic for consistency with TradeMode.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GearQualityRating } from '../../../../shared/types/GearQuality';
import type { StructuredMods, ModEntry, ItemDisplayInfo, BaseDefenseStats } from '../../store';
import { isMetadataLine } from '@shared/utils/item-metadata';
import { FLASK_BASE_TYPES, FLASK_BASE_EFFECTS } from './flask-constants';

interface EquipmentSlotItemProps {
  slot: string;
  item: {
    name: string;
    baseName: string;
    rarity: string;
    raw: string;
    mods?: StructuredMods;
    displayInfo?: ItemDisplayInfo;
    baseStats?: BaseDefenseStats;
    requirements?: { level?: number; str?: number; dex?: number; int?: number };
    flaskData?: {
      lifeTotal?: number;
      lifeGradual?: number;
      lifeInstant?: number;
      manaTotal?: number;
      manaGradual?: number;
      manaInstant?: number;
      duration?: number;
      chargesMax?: number;
      chargesUsed?: number;
      instantPerc?: number;
    };
  } | null;
  isExpanded: boolean;
  onToggle: () => void;
  /** Quality rating for the item (replaces rarity indicator when available) */
  qualityRating?: GearQualityRating;
  /** Whether this slot is highlighted (from hovering improvement card) */
  isHighlighted?: boolean;
}

/** Amber glow for gear pathway - unified accent color */
const AMBER_GLOW = 'rgba(251, 191, 36, 0.4)';

// Simplified rarity colors - just for item name text, not borders
const rarityTextColors: Record<string, string> = {
  NORMAL: 'text-slate-300',
  MAGIC: 'text-blue-400',
  RARE: 'text-yellow-400',
  UNIQUE: 'text-orange-400',
};

// Mod colors - regular mods in blue, special mods in distinct colors
const modColors = {
  implicit: 'text-blue-400',      // Same as explicit (no color distinction)
  explicit: 'text-blue-400',      // Blue for explicits
  prefix: 'text-blue-400',        // Blue
  suffix: 'text-blue-400',        // Blue
  crafted: 'text-[#B4B4FF]',      // Light blue for crafted mods
  fractured: 'text-[#A38D6D]',    // Gold/brown for fractured mods
  enchant: 'text-blue-400',       // Blue
  unknown: 'text-blue-400',       // Blue
} as const;

// Influence badge colors
const influenceColors: Record<string, string> = {
  shaper: 'bg-blue-600/60 text-blue-200',
  elder: 'bg-gray-600/60 text-gray-200',
  crusader: 'bg-yellow-600/60 text-yellow-200',
  hunter: 'bg-green-600/60 text-green-200',
  redeemer: 'bg-cyan-600/60 text-cyan-200',
  warlord: 'bg-red-600/60 text-red-200',
};

// Quality indicator colors (replaces rarity when available)
const qualityColors: Record<GearQualityRating, string> = {
  GOOD: 'bg-green-500',
  AVERAGE: 'bg-yellow-500',
  POOR: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

/**
 * Extract quality from raw item text.
 * Looks for lines like "Quality: +20%" or "Quality: 20%"
 */
function extractQuality(raw: string): number | null {
  const match = raw.match(/Quality:\s*\+?(\d+)%?/i);
  return match ? parseInt(match[1], 10) : null;
}


/**
 * Extract flask base type from raw item text.
 * Searches aggressively for flask type patterns in the raw PoB item text.
 * Returns clean flask type like "Jade Flask" or "Divine Life Flask".
 */
function extractFlaskBaseFromRaw(raw: string): string | null {
  if (!raw) return null;
  const lines = raw.split('\n').map(l => l.trim());

  // First: Look for exact match with known flask types (most reliable)
  for (const line of lines) {
    // Skip lines that look like mods (contain mod-like text)
    if (line.includes('%') || line.includes('+') || line.includes('increased') ||
        line.includes('reduced') || line.includes('Grants') || line.includes('Immunity') ||
        line.includes('during') || line.includes('Regenerate') || line.includes('Charges')) {
      continue;
    }

    for (const flaskType of FLASK_BASE_TYPES) {
      if (line === flaskType) {
        return flaskType;
      }
    }
  }

  // Second: Use regex to find flask base type patterns
  // This handles lines like "Divine Life Flask" that may have prefixes stripped
  const flaskTypeRegex = /\b(Small|Medium|Large|Greater|Grand|Giant|Colossal|Sacred|Hallowed|Sanctified|Divine|Eternal)?\s*(Life|Mana|Hybrid)\s+Flask\b/i;
  const utilityFlaskRegex = /\b(Quicksilver|Bismuth|Stibnite|Sulphur|Silver|Basalt|Granite|Jade|Quartz|Amethyst|Ruby|Sapphire|Topaz|Aquamarine|Diamond|Gold|Corundum|Iron)\s+Flask\b/i;
  const tinctureRegex = /\b(Ironwood|Prismatic|Rosethorn|Ashbark|Borealwood|Fulgurite|Blood Sap|Poisonberry|Sporebloom|Oakbranch)\s+Tincture\b/i;

  for (const line of lines) {
    // Skip obvious mod lines
    if (line.includes('%') && !line.match(/^\w+\s+(Flask|Tincture)$/)) continue;
    if (line.includes('Grants') || line.includes('Immunity')) continue;

    // Check for tinctures
    const tinctureMatch = line.match(tinctureRegex);
    if (tinctureMatch) {
      return tinctureMatch[0];
    }

    // Check for utility flasks (no tier prefix)
    const utilityMatch = line.match(utilityFlaskRegex);
    if (utilityMatch) {
      return utilityMatch[0];
    }

    // Check for life/mana/hybrid flasks with tier
    const tieredMatch = line.match(flaskTypeRegex);
    if (tieredMatch) {
      // Reconstruct clean name: "[Tier] Type Flask"
      const tier = tieredMatch[1] || '';
      const type = tieredMatch[2];
      return tier ? `${tier} ${type} Flask` : `${type} Flask`;
    }
  }

  // Third: Look for any line containing "Flask" or "Tincture" that isn't a mod
  for (const line of lines) {
    if ((line.includes('Flask') || line.includes('Tincture')) &&
        !line.includes('%') && !line.includes('+') &&
        !line.includes('increased') && !line.includes('reduced') &&
        !line.includes('Grants') && !line.includes('during') &&
        !line.includes('Immunity') && !line.includes('Charges') &&
        line.length < 50) {
      return line;
    }
  }

  return null;
}

/**
 * Format tier/roll info for display
 * Returns structured info with affix type badge and tier/range
 */
interface TierRollDisplay {
  affixBadge?: { label: string; colorClass: string };
  tierRange?: string;
}

function formatTierRollInfo(mod: ModEntry): TierRollDisplay | null {
  const result: TierRollDisplay = {};

  // Helper to add P/S badge based on affixType
  const addAffixBadge = () => {
    if (mod.affixType === 'prefix') {
      result.affixBadge = { label: 'P', colorClass: 'text-sky-400' };
    } else if (mod.affixType === 'suffix') {
      result.affixBadge = { label: 'S', colorClass: 'text-orange-400' };
    }
  };

  // Tier info for rare items (with P/S badge)
  if (mod.tier && mod.tierRange) {
    result.tierRange = `T${mod.tier} [${mod.tierRange.min}-${mod.tierRange.max}]`;
    addAffixBadge();
  }
  // Roll range for unique items - also show P/S badge if we know the affix type
  else if (mod.rollRange) {
    result.tierRange = `[${mod.rollRange.min}-${mod.rollRange.max}]`;
    addAffixBadge();
  }
  // No tier or roll range, but still show P/S badge if we have affix type
  else if (mod.affixType === 'prefix' || mod.affixType === 'suffix') {
    addAffixBadge();
  }

  // Return null if nothing to display
  if (!result.affixBadge && !result.tierRange) {
    return null;
  }

  return result;
}

/**
 * Get the appropriate color class for a mod based on its type
 */
function getModColor(affixType: string | undefined, isFractured?: boolean, isCrafted?: boolean): string {
  if (isFractured) return modColors.fractured;
  if (isCrafted) return modColors.crafted;
  // Blue for all regular explicits
  return modColors.explicit;
}

/**
 * Extract item requirements from raw item text
 */
interface ItemRequirements {
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
}

function extractRequirements(raw: string | undefined): ItemRequirements | null {
  if (!raw) return null;

  const reqs: ItemRequirements = {};

  // Format 1: LevelReq: 65 (PoB modern format)
  const levelReqMatch = raw.match(/LevelReq:\s*(\d+)/i);
  if (levelReqMatch) {
    reqs.level = parseInt(levelReqMatch[1], 10);
  }

  // Format 2: Level: 68 (under Requirements section)
  const levelMatch = raw.match(/\bLevel:\s*(\d+)/m);
  if (levelMatch && !reqs.level) {
    reqs.level = parseInt(levelMatch[1], 10);
  }

  // Simpler patterns for Str/Dex/Int - use word boundary
  const strMatch = raw.match(/\bStr:\s*(\d+)/m);
  const dexMatch = raw.match(/\bDex:\s*(\d+)/m);
  const intMatch = raw.match(/\bInt:\s*(\d+)/m);

  if (strMatch) reqs.str = parseInt(strMatch[1], 10);
  if (dexMatch) reqs.dex = parseInt(dexMatch[1], 10);
  if (intMatch) reqs.int = parseInt(intMatch[1], 10);

  return Object.keys(reqs).length > 0 ? reqs : null;
}

/**
 * Extract socket string from raw text
 */
function extractSockets(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/Sockets:\s*([RGBWDA\-\s]+)/i);
  return match ? match[1].trim() : null;
}

// Socket color mapping for display
const SOCKET_COLORS: Record<string, string> = {
  R: 'text-red-400',
  G: 'text-green-400',
  B: 'text-blue-400',
  W: 'text-slate-100',
  A: 'text-slate-100', // Abyssal
  D: 'text-slate-100', // Delve
};

/**
 * Parse item mods from the raw text
 * Raw text format typically includes item header, implicit/explicit mods
 * Uses the "Implicits: N" line to correctly classify mods
 */
interface FallbackModEntry {
  text: string;
  isCrafted?: boolean;
  isFractured?: boolean;
}

function parseItemMods(raw: string): { implicits: FallbackModEntry[]; explicits: FallbackModEntry[] } {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const implicits: FallbackModEntry[] = [];
  const explicits: FallbackModEntry[] = [];

  // Find the Implicits: N line to know how many implicits to expect
  let implicitCount = 0;
  let implicitCountLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^Implicits:\s*(\d+)$/i);
    if (match) {
      implicitCount = parseInt(match[1], 10);
      implicitCountLineIndex = i;
      break;
    }
  }

  // Start parsing mods after the Implicits: N line
  let implicitsSeen = 0;
  const startIndex = implicitCountLineIndex >= 0 ? implicitCountLineIndex + 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    let parsedLine = lines[i];
    const modEntry: FallbackModEntry = { text: '' };

    // Skip item name/base lines and separators
    if (parsedLine.startsWith('Rarity:') || parsedLine.startsWith('Item Class:')) continue;
    if (parsedLine.startsWith('--------')) continue;

    // Skip metadata lines (Unique ID, BasePercentile, Quality, LevelReq, etc.)
    if (isMetadataLine(parsedLine)) continue;

    // Handle tagged mods specially
    if (parsedLine.includes('(implicit)')) {
      modEntry.text = parsedLine.replace('(implicit)', '').trim();
      implicits.push(modEntry);
      implicitsSeen++;
      continue;
    }
    if (parsedLine.includes('(crafted)')) {
      modEntry.text = parsedLine.replace('(crafted)', '').trim();
      modEntry.isCrafted = true;
      explicits.push(modEntry);
      continue;
    }
    if (parsedLine.includes('(fractured)')) {
      modEntry.text = parsedLine.replace('(fractured)', '').trim();
      modEntry.isFractured = true;
      explicits.push(modEntry);
      continue;
    }

    // Handle {tag} prefix mods
    const tagMatch = parsedLine.match(/^\{([^}]+)\}\s*/);
    if (tagMatch) {
      const tag = tagMatch[1]?.toLowerCase();
      if (tag === 'crafted') modEntry.isCrafted = true;
      if (tag === 'fractured') modEntry.isFractured = true;
      parsedLine = parsedLine.replace(/^\{[^}]+\}\s*/, '');
    }

    // Check if this looks like a mod (contains numbers, percent, or common mod keywords)
    const looksLikeMod =
      /\d/.test(parsedLine) ||
      parsedLine.includes('%') ||
      parsedLine.includes('increased') ||
      parsedLine.includes('reduced') ||
      parsedLine.includes('added') ||
      parsedLine.includes('to ') ||
      parsedLine.includes('Adds ') ||
      parsedLine.includes('+') ||
      parsedLine.includes('Grants') ||
      parsedLine.includes('Immunity');

    if (looksLikeMod) {
      modEntry.text = parsedLine.trim();
      // Classify based on implicit count from "Implicits: N" line
      if (implicitsSeen < implicitCount) {
        implicits.push(modEntry);
        implicitsSeen++;
      } else {
        explicits.push(modEntry);
      }
    }
  }

  return { implicits, explicits };
}

export function EquipmentSlotItem({
  slot,
  item,
  isExpanded,
  onToggle,
  qualityRating,
  isHighlighted,
}: EquipmentSlotItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isEmpty = !item;
  const rarity = item?.rarity?.toUpperCase() || 'NORMAL';
  const rarityTextColor = rarityTextColors[rarity] || rarityTextColors.NORMAL;

  // Use structured mods when they contain any text, otherwise fall back to raw parsing
  const countModText = (mods: ModEntry[] | undefined): number => {
    if (!mods) return 0;
    return mods.reduce((count, mod) => {
      const text = mod.text?.trim();
      return text ? count + 1 : count;
    }, 0);
  };
  const structuredCounts = item?.mods
    ? {
        implicits: countModText(item.mods.implicits),
        explicits: countModText(item.mods.explicits),
        crafted: countModText(item.mods.crafted),
        enchants: countModText(item.mods.enchants),
      }
    : { implicits: 0, explicits: 0, crafted: 0, enchants: 0 };
  const structuredHasAnyMods =
    structuredCounts.implicits +
      structuredCounts.explicits +
      structuredCounts.crafted +
      structuredCounts.enchants >
    0;
  const fallbackMods = item?.raw ? parseItemMods(item.raw) : { implicits: [], explicits: [] };
  const useStructuredMods = structuredHasAnyMods;

  // Get display info with fallbacks
  const displayName = item?.displayInfo?.itemName || item?.name || '';
  const displayBaseName = item?.displayInfo?.baseName || item?.baseName || '';
  const isCorrupted = item?.displayInfo?.isCorrupted || false;
  const influences = item?.displayInfo?.influences || [];
  const isFractured = item?.displayInfo?.isFractured || false;

  // Flask header display logic: show baseName for non-unique flasks, unique name for unique flasks
  // For flasks, ALWAYS extract from raw text first (most reliable) since backend baseName may be incomplete
  const isFlaskSlot = slot.toLowerCase().includes('flask');
  const isUniqueFlask = isFlaskSlot && item?.rarity?.toUpperCase() === 'UNIQUE';

  // For non-unique flasks: prioritize raw text extraction over item.baseName
  // This ensures we get clean flask type like "Jade Flask" not modifier text
  let flaskBaseName = '';
  if (isFlaskSlot && !isUniqueFlask) {
    // Try raw text extraction first (most reliable for flask type)
    if (item?.raw) {
      const extractedBase = extractFlaskBaseFromRaw(item.raw);
      if (extractedBase) {
        flaskBaseName = extractedBase;
      }
    }
    // Fall back to baseName if extraction failed
    if (!flaskBaseName && item?.baseName) {
      flaskBaseName = item.baseName;
    }
    // Fall back to displayBaseName
    if (!flaskBaseName && displayBaseName) {
      flaskBaseName = displayBaseName;
    }
    // Last resort
    if (!flaskBaseName) {
      flaskBaseName = 'Flask';
    }
  }

  const headerDisplayName = isFlaskSlot
    ? (isUniqueFlask ? displayName : flaskBaseName)
    : (displayName || displayBaseName);

  // Extract item quality from raw text for display in expanded view
  const quality = item?.raw ? extractQuality(item.raw) : null;

  // Get flask base effect for utility flasks (e.g., Jade Flask -> "+3000 to Evasion Rating during Effect")
  const flaskBaseEffect = isFlaskSlot && flaskBaseName ? FLASK_BASE_EFFECTS[flaskBaseName] : null;

  // Prefer structured requirements from PoB, fall back to raw text parsing
  const requirements = item?.requirements || (item?.raw ? extractRequirements(item.raw) : null);

  // Extract sockets for display
  const sockets = item?.raw ? extractSockets(item.raw) : null;

  // Helper to check if we have any mods to display
  const hasAnyMods = useStructuredMods
    ? structuredHasAnyMods
    : (fallbackMods.implicits.length > 0 || fallbackMods.explicits.length > 0);

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative rounded-lg overflow-hidden',
        'card-forge',
        'transition-all duration-200',
        isEmpty && 'opacity-60'
      )}
      style={{
        ...(isHovered && !isEmpty ? {
          boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 0 25px ${AMBER_GLOW}`,
          borderColor: 'rgba(251, 191, 36, 0.4)',
        } : {}),
        ...(isHighlighted && !isEmpty ? {
          boxShadow: `0 4px 24px rgba(0, 0, 0, 0.5), 0 0 30px ${AMBER_GLOW}`,
          borderColor: 'rgba(251, 191, 36, 0.6)',
          transform: 'scale(1.01)',
        } : {}),
      }}
    >
      {/* Subtle top glow on hover */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 pointer-events-none',
          (isHovered || isHighlighted) && !isEmpty && 'opacity-100'
        )}
        style={{
          background: `radial-gradient(circle at 50% 0%, ${AMBER_GLOW} 0%, transparent 70%)`,
        }}
      />

      {/* Header - always visible */}
      <button
        onClick={onToggle}
        disabled={isEmpty}
        className={cn(
          'relative z-[1] w-full flex items-center gap-3 px-3 py-2.5',
          'text-left transition-colors',
          !isEmpty && 'cursor-pointer',
          isEmpty && 'cursor-default'
        )}
      >
        {/* Expand/Collapse icon */}
        <span className={cn(
          'transition-colors duration-200',
          isHovered && !isEmpty ? 'text-amber-400' : 'text-slate-500'
        )}>
          {isEmpty ? (
            <span className="w-4 h-4 block" />
          ) : isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        {/* Slot name */}
        <span className={cn(
          'text-xs font-display font-medium uppercase tracking-wider w-24 flex-shrink-0 transition-colors duration-200',
          isHovered && !isEmpty ? 'text-slate-200' : 'text-slate-400'
        )}>
          {slot}
        </span>

        {/* Item name or empty indicator */}
        {isEmpty ? (
          <span className="text-sm text-slate-600 italic">Empty</span>
        ) : (
          <span className={cn('text-sm font-medium truncate', rarityTextColor)}>
            {headerDisplayName}
          </span>
        )}

        {/* Quality indicator dot - only shown when LLM assessment exists */}
        {!isEmpty && qualityRating && (
          <span
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0 ml-auto',
              qualityColors[qualityRating] || 'bg-slate-500'
            )}
            title={`Quality: ${qualityRating}`}
          />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && item && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-2 border-t border-slate-700/30 bg-black/20">
              {/* Base type - centered */}
              <div className="text-sm text-slate-500 mb-2 text-center font-pob">
                {isFlaskSlot ? flaskBaseName : displayBaseName}
              </div>

              {/* Quality - centered like ItemTooltip */}
              {quality !== null && quality > 0 && (
                <div className="text-sm text-[#8888ff] font-pob text-center mb-2">
                  Quality: +{quality}%
                </div>
              )}

              {/* Flask base effect (utility flasks have intrinsic effects) */}
              {flaskBaseEffect && (
                <div className="text-sm text-amber-300/90 mb-2 italic text-center">
                  {flaskBaseEffect}
                </div>
              )}

              {/* Flask recovery stats from PoB (life/mana flasks) */}
              {isFlaskSlot && item?.flaskData && (
                <div className="text-sm text-amber-300/90 mb-2 italic text-center space-y-0.5">
                  {item.flaskData.lifeTotal != null && item.flaskData.lifeTotal > 0 && item.flaskData.duration != null && (
                    <div>
                      Recovers {Math.round(item.flaskData.lifeTotal).toLocaleString()} Life over {item.flaskData.duration.toFixed(1)}s
                      {item.flaskData.instantPerc != null && item.flaskData.instantPerc > 0 && (
                        <span className="text-stone-400"> ({Math.round(item.flaskData.instantPerc)}% instant)</span>
                      )}
                    </div>
                  )}
                  {item.flaskData.manaTotal != null && item.flaskData.manaTotal > 0 && item.flaskData.duration != null && (
                    <div>
                      Recovers {Math.round(item.flaskData.manaTotal).toLocaleString()} Mana over {item.flaskData.duration.toFixed(1)}s
                      {item.flaskData.instantPerc != null && item.flaskData.instantPerc > 0 && (
                        <span className="text-stone-400"> ({Math.round(item.flaskData.instantPerc)}% instant)</span>
                      )}
                    </div>
                  )}
                  {item.flaskData.chargesUsed != null && item.flaskData.chargesMax != null && (
                    <div className="text-stone-500 text-xs">
                      {item.flaskData.chargesUsed} charges per use / {item.flaskData.chargesMax} max
                    </div>
                  )}
                </div>
              )}

              {/* Base defense stats (armour, evasion, ES, ward, block) - centered */}
              {item.baseStats && (
                <div className="text-sm text-[#8888ff] font-pob text-center mb-2 space-x-3">
                  {item.baseStats.armour !== undefined && item.baseStats.armour > 0 && (
                    <span>Armour: {item.baseStats.armour.toLocaleString()}</span>
                  )}
                  {item.baseStats.evasion !== undefined && item.baseStats.evasion > 0 && (
                    <span>Evasion: {item.baseStats.evasion.toLocaleString()}</span>
                  )}
                  {item.baseStats.energyShield !== undefined && item.baseStats.energyShield > 0 && (
                    <span>ES: {item.baseStats.energyShield.toLocaleString()}</span>
                  )}
                  {item.baseStats.ward !== undefined && item.baseStats.ward > 0 && (
                    <span>Ward: {item.baseStats.ward.toLocaleString()}</span>
                  )}
                  {item.baseStats.block !== undefined && item.baseStats.block > 0 && (
                    <span>Block: {item.baseStats.block}%</span>
                  )}
                </div>
              )}

              {/* Sockets - colored display, centered */}
              {sockets && (
                <div className="text-sm text-[#7f7f7f] font-pob text-center mb-2">
                  Sockets:{' '}
                  <span className="font-mono">
                    {sockets.split('').map((char, idx) => {
                      if (char === '-' || char === ' ') {
                        return <span key={idx} className="text-[#5a5a5a]">{char}</span>;
                      }
                      const colorClass = SOCKET_COLORS[char.toUpperCase()] || 'text-[#c8c8c8]';
                      return <span key={idx} className={colorClass}>{char}</span>;
                    })}
                  </span>
                </div>
              )}

              {/* Requirements - centered */}
              {requirements && (
                <div className="text-sm text-[#7f7f7f] font-pob text-center mb-2">
                  Requires{' '}
                  {[
                    requirements.level ? `Level ${requirements.level}` : '',
                    requirements.str ? `${requirements.str} Str` : '',
                    requirements.dex ? `${requirements.dex} Dex` : '',
                    requirements.int ? `${requirements.int} Int` : '',
                  ].filter(Boolean).join(', ')}
                </div>
              )}

              {/* Status badges (corruption, influences) - centered */}
              {(isCorrupted || influences.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-2 justify-center">
                  {isCorrupted && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/60 text-red-400 font-medium">
                      Corrupted
                    </span>
                  )}
                  {influences.map((influence) => (
                    <span
                      key={influence}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-medium capitalize',
                        influenceColors[influence.toLowerCase()] || 'bg-slate-700/60 text-slate-300'
                      )}
                    >
                      {influence}
                    </span>
                  ))}
                </div>
              )}

              {/* Render structured mods if available - left-aligned with right info */}
              {useStructuredMods ? (
                <div>
                  {/* Enchants */}
                  {structuredCounts.enchants > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {item.mods!.enchants.filter((mod) => mod.text?.trim()).map((mod, idx) => {
                        const tierRollInfo = formatTierRollInfo(mod);
                        return (
                          <div key={`enchant-${idx}`} className="flex justify-between items-baseline gap-4">
                            <span className={cn('text-sm font-pob', modColors.enchant)}>
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

                  {/* Implicits - left-aligned with right info + eldritch source badges */}
                  {structuredCounts.implicits > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {item.mods!.implicits.filter((mod) => mod.text?.trim()).map((mod, idx) => {
                        const tierRollInfo = formatTierRollInfo(mod);
                        // Source badge for eldritch implicits: EX (Searing Exarch), EW (Eater of Worlds)
                        const sourceBadge = mod.implicitSource === 'searing_exarch'
                          ? { label: 'SE', colorClass: 'text-red-400' }
                          : mod.implicitSource === 'eater_of_worlds'
                            ? { label: 'EW', colorClass: 'text-blue-400' }
                            : null;
                        const hasInfo = tierRollInfo?.tierRange || tierRollInfo?.affixBadge || sourceBadge;
                        return (
                          <div key={`implicit-${idx}`} className="flex justify-between items-baseline gap-4">
                            <span className={cn('text-sm font-pob', modColors.implicit)}>
                              {mod.text || ''}
                            </span>
                            {hasInfo && (
                              <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                                {tierRollInfo?.tierRange && <span className="text-slate-500">{tierRollInfo.tierRange}</span>}
                                {tierRollInfo?.affixBadge && (
                                  <span className={cn('font-semibold', tierRollInfo.affixBadge.colorClass)}>
                                    {tierRollInfo.affixBadge.label}
                                  </span>
                                )}
                                {sourceBadge && (
                                  <span className={cn('font-semibold', sourceBadge.colorClass)}>
                                    {sourceBadge.label}
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
                  {(structuredCounts.implicits > 0 || structuredCounts.enchants > 0) &&
                   (structuredCounts.explicits > 0 || structuredCounts.crafted > 0) && (
                    <div className="border-t border-slate-700/30 my-2" />
                  )}

                  {/* Explicits - left-aligned with right info */}
                  {structuredCounts.explicits > 0 && (
                    <div className="space-y-0.5">
                      {item.mods!.explicits.filter((mod) => mod.text?.trim()).map((mod, idx) => {
                        const tierRollInfo = formatTierRollInfo(mod);
                        return (
                          <div key={`explicit-${idx}`} className="flex justify-between items-baseline gap-4">
                            <span className={cn('text-sm font-pob', getModColor(mod.affixType, mod.type === 'fractured', false))}>
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

                  {/* Crafted mods - left-aligned with right info */}
                  {structuredCounts.crafted > 0 && (
                    <div className="space-y-0.5 mt-1">
                      {item.mods!.crafted.filter((mod) => mod.text?.trim()).map((mod, idx) => {
                        const tierRollInfo = formatTierRollInfo(mod);
                        return (
                          <div key={`crafted-${idx}`} className="flex justify-between items-baseline gap-4">
                            <span className={cn('text-sm font-pob', modColors.crafted)}>
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
              ) : (
                /* Fallback: Render parsed mods from raw text - left-aligned */
                <div>
                  {/* Implicit mods */}
                  {fallbackMods.implicits.length > 0 && (
                    <div className="mb-2 space-y-0.5">
                      {fallbackMods.implicits.map((mod, idx) => (
                        <div key={idx} className="flex justify-between items-baseline gap-4">
                          <span
                            className={cn(
                              'text-sm font-pob',
                              mod.isFractured ? modColors.fractured : modColors.implicit
                            )}
                          >
                            {mod.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Separator between implicits and explicits */}
                  {fallbackMods.implicits.length > 0 && fallbackMods.explicits.length > 0 && (
                    <div className="border-t border-slate-700/30 my-2" />
                  )}

                  {/* Explicit mods */}
                  {fallbackMods.explicits.length > 0 && (
                    <div className="space-y-0.5">
                      {fallbackMods.explicits.map((mod, idx) => (
                        <div key={idx} className="flex justify-between items-baseline gap-4">
                          <span
                            className={cn(
                              'text-sm font-pob',
                              mod.isCrafted
                                ? modColors.crafted
                                : mod.isFractured
                                  ? modColors.fractured
                                  : modColors.unknown
                            )}
                          >
                            {mod.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No mods found */}
              {!hasAnyMods && (
                <div className="text-sm text-slate-500 italic">
                  No modifiers found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default EquipmentSlotItem;
