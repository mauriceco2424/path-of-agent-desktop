/**
 * EquipmentIconGrid Component - Authentic PoE Inventory Display
 *
 * Visual equipment grid matching the Path of Exile in-game inventory aesthetic.
 * Features dark stone/metal frame with ornate corners, inset slot backgrounds,
 * and a subtle character silhouette in the center.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';
import { ItemTooltip } from './ItemTooltip';
import { FLASK_BASE_TYPES } from './flask-constants';
import type { BuildVisualizationResponse, StructuredMods, ItemDisplayInfo, BaseDefenseStats } from '../../store';

interface EquipmentIconGridProps {
  items: BuildVisualizationResponse['items'];
  onSlotClick?: (slot: string) => void;
  /** Active skill/aura names — used to filter irrelevant Searing Exarch mods */
  activeSkillNames?: Set<string>;
}

type ItemData = {
  name: string;
  baseName: string;
  rarity: string;
  raw: string;
  mods?: StructuredMods;
  displayInfo?: ItemDisplayInfo;
  baseStats?: BaseDefenseStats;
  requirements?: { level?: number; str?: number; dex?: number; int?: number };
};

/**
 * PoE-authentic rarity styling - subtle borders matching in-game colors
 */
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
    glow: 'shadow-[0_0_6px_rgba(59,130,246,0.25)]',
    hoverGlow: 'hover:shadow-[0_0_14px_rgba(59,130,246,0.5)]',
  },
  RARE: {
    border: 'border-yellow-500/70',
    glow: 'shadow-[0_0_6px_rgba(234,179,8,0.25)]',
    hoverGlow: 'hover:shadow-[0_0_14px_rgba(234,179,8,0.5)]',
  },
  UNIQUE: {
    border: 'border-orange-500/80',
    glow: 'shadow-[0_0_8px_rgba(249,115,22,0.35)]',
    hoverGlow: 'hover:shadow-[0_0_16px_rgba(249,115,22,0.6)]',
  },
};

const RARITY_ACCENT_COLORS: Record<string, string> = {
  UNIQUE: 'rgba(175,96,37,0.8)',
  RARE: 'rgba(255,255,119,0.55)',
  MAGIC: 'rgba(88,88,255,0.55)',
  NORMAL: 'transparent',
};

const SLOT_TYPE_TINTS: Record<string, string> = {
  'Weapon 1': 'rgba(251,191,36,0.06)',
  'Weapon 2': 'rgba(251,191,36,0.06)',
  'Helmet': 'rgba(148,163,184,0.06)',
  'Body Armour': 'rgba(148,163,184,0.06)',
  'Gloves': 'rgba(148,163,184,0.06)',
  'Boots': 'rgba(148,163,184,0.06)',
  'Belt': 'rgba(52,211,153,0.05)',
  'Amulet': 'rgba(52,211,153,0.05)',
  'Ring 1': 'rgba(52,211,153,0.05)',
  'Ring 2': 'rgba(52,211,153,0.05)',
};

function getRarityStyle(rarity: string) {
  return RARITY_STYLES[rarity] || RARITY_STYLES.NORMAL;
}

// Fixed cell size in pixels
const CELL_SIZE = 40;

// Slot configurations with dimensions in inventory cells
interface SlotConfig {
  row: number;
  col: number;
  width: number;
  height: number;
}

// Grid layout - 8 columns, 6 rows
const SLOT_CONFIGS: Record<string, SlotConfig> = {
  'Weapon 1': { row: 0, col: 0, width: 2, height: 4 },
  'Helmet': { row: 0, col: 3, width: 2, height: 2 },
  'Weapon 2': { row: 0, col: 6, width: 2, height: 4 },
  'Amulet': { row: 2, col: 5, width: 1, height: 1 },
  'Body Armour': { row: 2, col: 3, width: 2, height: 3 },
  'Ring 1': { row: 3, col: 2, width: 1, height: 1 },
  'Ring 2': { row: 3, col: 5, width: 1, height: 1 },
  'Gloves': { row: 4, col: 0, width: 2, height: 2 },
  'Boots': { row: 4, col: 6, width: 2, height: 2 },
  'Belt': { row: 5, col: 3, width: 2, height: 1 },
};

// Flask size
const FLASK_SIZE = { width: 46, height: 78 };

const POE_WIKI_ICON_BASE = 'https://www.poewiki.net/wiki/Special:Redirect/file/';

// Sorted by length descending so "Divine Life Flask" matches before "Life Flask"
const FLASK_BASES_BY_LENGTH = [...FLASK_BASE_TYPES].sort((a, b) => b.length - a.length);
/**
 * Extract a clean flask base type from a name that may include affixes.
 * E.g. "Concentrated Divine Life Flask of Allaying" -> "Divine Life Flask"
 *      "Investigator's Silver Flask of Penetrating" -> "Silver Flask"
 *
 * Returns the matching FLASK_BASE_TYPES entry, or null if no match.
 */
function extractCleanFlaskBase(name: string): string | null {
  if (!name) return null;
  for (const base of FLASK_BASES_BY_LENGTH) {
    if (name.includes(base)) {
      return base;
    }
  }
  return null;
}

/**
 * Build a PoE Wiki icon URL for a given base type name.
 */
function buildWikiIconUrl(baseName: string): string {
  const wikiName = baseName.replace(/ /g, '_');
  return `${POE_WIKI_ICON_BASE}${encodeURIComponent(wikiName)}_inventory_icon.png`;
}

function buildWikiUniqueIconUrl(itemName: string): string {
  const wikiName = itemName.replace(/ /g, '_');
  return `${POE_WIKI_ICON_BASE}${encodeURIComponent(wikiName)}_inventory_icon.png`;
}

function normalizeItemName(name: string | undefined): string {
  if (!name) return '';
  return name.includes(',') ? name.split(',')[0].trim() : name.trim();
}

function normalizeUniqueFlaskName(name: string | undefined, baseName: string | null): string {
  const normalized = normalizeItemName(name);
  if (!normalized || !baseName) return normalized;
  if (normalized.endsWith(baseName)) {
    return normalized.slice(0, -baseName.length).trim();
  }
  return normalized;
}

/**
 * Influence indicator colors
 */
const INFLUENCE_COLORS: Record<string, string> = {
  shaper: 'bg-blue-400',
  elder: 'bg-gray-400',
  crusader: 'bg-yellow-400',
  hunter: 'bg-green-400',
  redeemer: 'bg-cyan-400',
  warlord: 'bg-red-400',
};


/**
 * Equipment slot styled as a carved stone recess
 * Matches the PoE in-game inventory aesthetic
 */
function EquipmentSlot({
  slot,
  item,
  config,
  onClick,
  style,
  explicitSize,
  slotName,
  isAnyHovered,
  isThisHovered,
  onHoverChange,
  flaskShape,
  activeSkillNames,
}: {
  slot: string;
  item: ItemData | null;
  config?: SlotConfig;
  onClick?: () => void;
  style?: React.CSSProperties;
  explicitSize?: { width: number; height: number };
  slotName: string;
  isAnyHovered: boolean;
  isThisHovered: boolean;
  onHoverChange?: (hovered: boolean) => void;
  flaskShape?: boolean;
  activeSkillNames?: Set<string>;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = item?.rarity?.toUpperCase() || 'NORMAL';
  const rarityStyle = item ? getRarityStyle(rarity) : null;
  const iconUrl = item?.displayInfo?.iconUrl;
  const fallbackIconUrl = item?.displayInfo?.fallbackIconUrl;
  const cleanFlaskBaseName = flaskShape && item?.baseName
    ? extractCleanFlaskBase(item.baseName) ?? item.baseName
    : null;
  const uniqueFlaskName = flaskShape && rarity === 'UNIQUE'
    ? normalizeUniqueFlaskName(item?.name || item?.displayInfo?.itemName, cleanFlaskBaseName)
    : '';
  const derivedUniqueFlaskIconUrl = uniqueFlaskName ? buildWikiUniqueIconUrl(uniqueFlaskName) : undefined;
  const primaryIconUrl = derivedUniqueFlaskIconUrl || iconUrl;
  const secondaryIconUrl = derivedUniqueFlaskIconUrl && iconUrl && iconUrl !== derivedUniqueFlaskIconUrl
    ? iconUrl
    : fallbackIconUrl;

  // Calculate pixel dimensions using fixed cell size
  const width = explicitSize?.width ?? (config ? config.width * CELL_SIZE : CELL_SIZE);
  const height = explicitSize?.height ?? (config ? config.height * CELL_SIZE : CELL_SIZE);

  const outerRadius = flaskShape ? 'rounded-t-[4px] rounded-b-[10px]' : 'rounded-[3px]';
  const innerRadius = flaskShape ? 'rounded-t-[3px] rounded-b-[9px]' : 'rounded-[2px]';

  const slotContent = (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-150",
        isAnyHovered && !isThisHovered && "opacity-60"
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ...style,
      }}
      onClick={onClick}
      onMouseEnter={() => { setIsHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setIsHovered(false); onHoverChange?.(false); }}
    >
      {/* Outer stone border - the "lip" of the carved slot */}
      <div
        className={cn(
          'absolute inset-0',
          outerRadius,
          'bg-gradient-to-b from-[#2a2520] via-[#1f1b17] to-[#18140f]',
          'border border-[#3a3530]/60',
          item && 'slot-corners',
          item && rarity === 'UNIQUE' && 'slot-unique-pulse',
          isHovered && 'border-[#4a4540]/80'
        )}
      />

      {/* Inner carved recess - where the item sits */}
      <div
        className={cn(
          'absolute flex items-center justify-center overflow-hidden',
          innerRadius,
          // Deep inset shadow to look carved into stone
          'shadow-[inset_0_2px_6px_rgba(0,0,0,0.95),inset_0_0_12px_rgba(0,0,0,0.8)]',
          // Empty slot - very dark void
          !item && 'bg-[#08080a]',
          // Item present - slightly lighter with rarity tint
          item && [
            'bg-[#0c0c0e]',
            rarityStyle?.glow,
            isHovered && rarityStyle?.hoverGlow,
          ]
        )}
        style={{
          top: '3px',
          left: '3px',
          right: '3px',
          bottom: '3px',
          ...(!item && SLOT_TYPE_TINTS[slotName] ? { backgroundColor: SLOT_TYPE_TINTS[slotName] } : {}),
        }}
      >
        {/* Rarity border inside the slot */}
        {item && (
          <div
            className={cn(
              'absolute inset-0 rounded-[1px] pointer-events-none',
              'border',
              rarityStyle?.border
            )}
          />
        )}

        {/* Item icon */}
        {primaryIconUrl ? (
          <img
            src={primaryIconUrl}
            alt={item?.name || slot}
            className="max-w-full max-h-full object-contain relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            style={{
              maxWidth: `${width - 10}px`,
              maxHeight: `${height - 10}px`,
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              // Try fallback icon URL before giving up (e.g., base type icon for Replica uniques)
              if (secondaryIconUrl && target.src !== secondaryIconUrl) {
                target.src = secondaryIconUrl;
                return;
              }
              // For flasks, try extracting the clean base type and building a corrected wiki URL.
              // The backend may provide a URL with affixes (e.g., "Divine Life Flask of Allaying")
              // that doesn't exist on the wiki -- retry with just the base type.
              const isFlask = slot.toLowerCase().includes('flask');
              if (isFlask && item?.baseName) {
                const cleanBase = extractCleanFlaskBase(item.baseName);
                if (cleanBase) {
                  const cleanUrl = buildWikiIconUrl(cleanBase);
                  if (target.src !== cleanUrl) {
                    target.src = cleanUrl;
                    return;
                  }
                }
              }
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const fallbackEl = document.createElement('span');
                fallbackEl.className = 'text-[0.5rem] text-stone-700 text-center px-1 uppercase tracking-wider opacity-40';
                fallbackEl.textContent = slot.replace(/\s*\d+$/, '');
                parent.appendChild(fallbackEl);
              }
            }}
          />
        ) : (
          // Empty slot indicator
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-6 h-6 border border-dashed border-stone-700 rounded-sm" />
          </div>
        )}

        {/* Influence indicators */}
        {item?.displayInfo?.influences && item.displayInfo.influences.length > 0 && (
          <div className="absolute top-1 right-1 flex gap-0.5 z-20">
            {item.displayInfo.influences.map((inf) => (
              <div
                key={inf}
                className={cn(
                  'w-2 h-2 rounded-full',
                  'border border-black/60',
                  'shadow-sm',
                  INFLUENCE_COLORS[inf.toLowerCase()] || 'bg-stone-400'
                )}
                title={inf}
              />
            ))}
          </div>
        )}


      </div>

      {/* Rarity accent strip */}
      {item && (
        <div
          className="absolute top-0 left-[3px] right-[3px] h-[2px] z-20 rounded-t-sm"
          style={{
            background: `linear-gradient(to right, transparent, ${RARITY_ACCENT_COLORS[rarity] || 'transparent'}, transparent)`
          }}
        />
      )}

      {/* Hover effects */}
      {isHovered && item && (
        <div className={cn("absolute inset-0 pointer-events-none overflow-hidden z-30", outerRadius)}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2/3 bg-amber-500/20 blur-lg" />
        </div>
      )}
      {isHovered && !item && (
        <div
          className={cn("absolute inset-0 pointer-events-none", outerRadius)}
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 8px rgba(0,0,0,0.5)' }}
        />
      )}
    </div>
  );

  // Wrap with tooltip if item exists
  if (item) {
    return (
      <Tooltip.Provider delayDuration={100}>
        <Tooltip.Root open={isHovered}>
          <Tooltip.Trigger asChild>{slotContent}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="z-50">
              <ItemTooltip
                name={item.name}
                baseName={item.baseName}
                rarity={item.rarity}
                mods={item.mods}
                displayInfo={item.displayInfo}
                activeSkillNames={activeSkillNames}
                baseStats={item.baseStats}
                raw={item.raw}
                requirements={item.requirements}
              />
              <Tooltip.Arrow className="fill-stone-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }

  return slotContent;
}

// Fixed grid dimensions
const GRID_COLS = 8;
const GRID_ROWS = 6;
const GRID_WIDTH = GRID_COLS * CELL_SIZE; // 320px
const GRID_HEIGHT = GRID_ROWS * CELL_SIZE; // 240px
const FRAME_PADDING = 12;

export function EquipmentIconGrid({ items, onSlotClick, activeSkillNames }: EquipmentIconGridProps) {
  const [hoveredSlotName, setHoveredSlotName] = useState<string | null>(null);

  // Build slot -> item map
  const itemsBySlot = useMemo(() => {
    const map = new Map<string, ItemData>();
    for (const item of items) {
      map.set(item.slot, {
        name: item.name,
        baseName: item.baseName,
        rarity: item.rarity,
        raw: item.raw,
        mods: item.mods,
        displayInfo: item.displayInfo,
        baseStats: item.displayInfo?.baseStats,
        requirements: item.requirements,
      });
    }
    return map;
  }, [items]);

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Main gear section header */}
      <div className="flex items-center gap-3 w-full" style={{ maxWidth: `${GRID_WIDTH + FRAME_PADDING * 2}px` }}>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(251,191,36,0.35))' }} />
        <span className="text-[0.5625rem] font-display uppercase tracking-widest text-amber-400/70 text-glow-amber">Main Gear</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(251,191,36,0.35))' }} />
      </div>

      {/* Main equipment grid - metallic display case */}
      <div
        className={cn(
          'relative',
          'gear-frame',
          'rounded-lg',
          'corner-accent'
        )}
        style={{
          width: `${GRID_WIDTH + FRAME_PADDING * 2}px`,
          height: `${GRID_HEIGHT + FRAME_PADDING * 2}px`,
          padding: `${FRAME_PADDING}px`,
        }}
      >
        {/* Ambient center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-amber-500/[0.06] rounded-full blur-3xl pointer-events-none" />

        {/* Equipment slots grid */}
        <div
          className="relative"
          style={{
            width: `${GRID_WIDTH}px`,
            height: `${GRID_HEIGHT}px`,
          }}
        >
          {Object.entries(SLOT_CONFIGS).map(([slot, config]) => (
            <div
              key={slot}
              className="absolute"
              style={{
                left: `${config.col * CELL_SIZE}px`,
                top: `${config.row * CELL_SIZE}px`,
              }}
            >
              <EquipmentSlot
                slot={slot}
                item={itemsBySlot.get(slot) || null}
                config={config}
                onClick={() => onSlotClick?.(slot)}
                slotName={slot}
                isAnyHovered={hoveredSlotName !== null}
                isThisHovered={hoveredSlotName === slot}
                onHoverChange={(hovered) => setHoveredSlotName(hovered ? slot : null)}
                activeSkillNames={activeSkillNames}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Flask section header - teal accent */}
      <div className="flex items-center gap-3 w-full" style={{ maxWidth: `${GRID_WIDTH + FRAME_PADDING * 2}px` }}>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(45,212,191,0.3))' }} />
        <span className="text-[0.5625rem] font-display uppercase tracking-widest text-teal-400/70" style={{ textShadow: '0 0 8px rgba(45,212,191,0.25)' }}>Flasks</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(45,212,191,0.3))' }} />
      </div>

      {/* Flask row in subtle frame */}
      <div className="flask-frame flex gap-1 justify-center px-3 py-2.5 rounded-lg">
        {['Flask 1', 'Flask 2', 'Flask 3', 'Flask 4', 'Flask 5'].map((slot) => (
          <EquipmentSlot
            key={slot}
            slot={slot}
            item={itemsBySlot.get(slot) || null}
            explicitSize={FLASK_SIZE}
            onClick={() => onSlotClick?.(slot)}
            slotName={slot}
            isAnyHovered={hoveredSlotName !== null}
            isThisHovered={hoveredSlotName === slot}
            onHoverChange={(hovered) => setHoveredSlotName(hovered ? slot : null)}
            activeSkillNames={activeSkillNames}
            flaskShape
          />
        ))}
      </div>
    </motion.div>
  );
}

export default EquipmentIconGrid;
