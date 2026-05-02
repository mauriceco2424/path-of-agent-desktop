/**
 * Item Visualization Types
 *
 * Types for displaying gear items with structured mod information
 * in the frontend visualization components.
 */

/**
 * Value range for a mod tier or unique roll
 */
export interface ModValueRange {
  min: number;
  max: number;
}

/**
 * A parsed mod with type classification and optional affix info
 */
export interface ParsedMod {
  /** The mod text as displayed, e.g., "+95 to maximum Life" */
  text: string;
  /** Type of mod based on source/behavior */
  type: 'implicit' | 'explicit' | 'crafted' | 'fractured' | 'enchant';
  /** Whether this is a prefix, suffix, or unknown (for explicit mods) */
  affixType: 'prefix' | 'suffix' | 'unknown';
  /** Extracted numeric value if applicable */
  value?: number;
  /** Tier number for rare item mods (1 = best, up to 10) */
  tier?: number;
  /** Value range for this tier (rare items) */
  tierRange?: ModValueRange;
  /** Roll range for unique item mods (min/max possible roll) */
  rollRange?: ModValueRange;
  /** Source of implicit mods — base item, Searing Exarch, or Eater of Worlds */
  implicitSource?: 'base' | 'searing_exarch' | 'eater_of_worlds';
}

/**
 * Structured mods organized by category for display
 */
export interface StructuredMods {
  /** Implicit mods (above the separator line) */
  implicits: ParsedMod[];
  /** Explicit mods (standard affixes) */
  explicits: ParsedMod[];
  /** Crafted mods (from crafting bench, marked with {crafted}) */
  crafted: ParsedMod[];
  /** Enchant mods (lab enchants, typically on helmet/gloves/boots) */
  enchants: ParsedMod[];
}

/**
 * Base defense stats extracted from item metadata
 */
export interface BaseDefenseStats {
  /** Base armour value */
  armour?: number;
  /** Base evasion rating */
  evasion?: number;
  /** Base energy shield value */
  energyShield?: number;
  /** Base ward value */
  ward?: number;
  /** Block chance percentage */
  block?: number;
}

/**
 * Weapon stats computed by PoB (includes mod effects, quality, etc.)
 */
export interface BaseWeaponStats {
  /** Physical damage range */
  physicalMin?: number;
  physicalMax?: number;
  /** DPS values */
  physicalDPS?: number;
  elementalDPS?: number;
  chaosDPS?: number;
  totalDPS?: number;
  /** Critical strike chance (percentage, e.g. 8.30) */
  critChance?: number;
  /** Attacks per second */
  attackRate?: number;
  /** Weapon range (PoB units, divide by 10 for metres) */
  range?: number;
  /** Elemental damage breakdown */
  fireMin?: number; fireMax?: number;
  coldMin?: number; coldMax?: number;
  lightningMin?: number; lightningMax?: number;
  /** Chaos damage */
  chaosMin?: number; chaosMax?: number;
}

/**
 * Display information for an item header
 */
export interface ItemDisplayInfo {
  /** Item name (e.g., "Doom Spike") */
  itemName: string;
  /** Base type (e.g., "Astral Plate") */
  baseName: string;
  /** Whether the item is corrupted */
  isCorrupted: boolean;
  /** Influence types present on the item */
  influences: string[];
  /** Whether the item has a fractured mod */
  isFractured: boolean;
  /** Base defense stats (armour, evasion, energy shield, etc.) */
  baseStats?: BaseDefenseStats;
  /** Weapon stats computed by PoB (damage, crit, APS, DPS) */
  weaponStats?: BaseWeaponStats;
  /** CDN URL for the item icon (from web.poecdn.com) */
  iconUrl?: string;
  /** Fallback icon URL if primary fails (e.g., base type icon for Replica uniques) */
  fallbackIconUrl?: string;
}
