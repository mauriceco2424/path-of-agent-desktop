/**
 * Type definitions for Unique Item data parsed from PoB Lua files.
 * Used by both build-time parser and runtime service.
 */

/**
 * A single mod line on a unique item
 */
export interface UniqueModLine {
  /** Raw mod text with values substituted (e.g., "+25 to all Attributes") */
  text: string;

  /** Original text template with ranges (e.g., "+(20-30) to all Attributes") */
  template?: string;

  /** Minimum roll value (if variable) */
  min?: number;

  /** Maximum roll value (if variable) */
  max?: number;

  /** Computed mid-roll value (rounded) */
  mid?: number;

  /** Which variant indices include this mod (1-indexed, matches PoB) */
  variants?: number[];
}

/**
 * Variant information for a unique item
 */
export interface UniqueVariant {
  /** Variant label (e.g., "Pre 3.19.0", "Current", "Strength: Anger") */
  label: string;

  /** 1-indexed variant number (matches PoB format) */
  index: number;

  /** Whether this is a legacy/outdated version */
  isLegacy: boolean;
}

/**
 * Complete unique item data
 */
export interface UniqueItem {
  /** Unique item name (e.g., "Ashes of the Stars") */
  name: string;

  /** Base type (e.g., "Onyx Amulet") */
  baseType: string;

  /** Equipment slot category */
  slot: UniqueSlotType;

  /** Level requirement to equip */
  requiresLevel?: number;

  /** Base type implicit mods */
  implicits: UniqueModLine[];

  /** Unique-specific explicit mods */
  explicits: UniqueModLine[];

  /** All variant definitions */
  variants: UniqueVariant[];

  /** Index of the "Current" variant (or last if no Current specified) */
  currentVariantIndex: number;

  /** Drop source (e.g., "Drops from The Eater of Worlds (Uber)") */
  source?: string;

  /** League where item was introduced */
  league?: string;

  /** Whether the item is no longer obtainable */
  isUnobtainable: boolean;

  /** Whether the item is always corrupted */
  isCorrupted: boolean;

  /** Talisman tier if applicable */
  talismanTier?: number;

  /** Whether this is a Foulborn variant (Breach-corrupted unique, 3.27+) */
  foulborn?: boolean;
}

/**
 * Slot types for unique items (matches gear KB slots)
 */
export type UniqueSlotType =
  | 'amulet'
  | 'belt'
  | 'body-armour'
  | 'boots'
  | 'gloves'
  | 'helmet'
  | 'ring'
  | 'shield'
  | 'quiver'
  | 'flask'
  | 'jewel'
  | 'weapon-1h-sword'
  | 'weapon-2h-sword'
  | 'weapon-axe'
  | 'weapon-mace'
  | 'weapon-staff'
  | 'weapon-dagger'
  | 'weapon-claw'
  | 'weapon-bow'
  | 'weapon-wand'
  | 'tincture'
  | 'fishing'
  | 'unknown';

/**
 * Roll type for generating item text
 */
export type RollType = 'min' | 'mid' | 'max';

/**
 * Options for generating PoB item text
 */
export interface GeneratePoBTextOptions {
  /** Which roll values to use (default: 'mid') */
  rolls?: RollType;

  /** Specific variant index to use (default: currentVariantIndex) */
  variantIndex?: number;
}

/**
 * Mapping from PoB Lua file names to slot types
 */
export const POB_FILE_TO_SLOT: Record<string, UniqueSlotType> = {
  'amulet.lua': 'amulet',
  'belt.lua': 'belt',
  'body.lua': 'body-armour',
  'boots.lua': 'boots',
  'gloves.lua': 'gloves',
  'helmet.lua': 'helmet',
  'ring.lua': 'ring',
  'shield.lua': 'shield',
  'quiver.lua': 'quiver',
  'flask.lua': 'flask',
  'jewel.lua': 'jewel',
  'sword.lua': 'weapon-1h-sword', // Note: contains both 1h and 2h
  'axe.lua': 'weapon-axe',
  'mace.lua': 'weapon-mace',
  'staff.lua': 'weapon-staff',
  'dagger.lua': 'weapon-dagger',
  'claw.lua': 'weapon-claw',
  'bow.lua': 'weapon-bow',
  'wand.lua': 'weapon-wand',
  'tincture.lua': 'tincture',
  'fishing.lua': 'fishing',
};

/**
 * Cached unique items database structure
 */
export interface UniquesDatabase {
  /** Generation timestamp */
  generatedAt: string;

  /** PoB submodule commit or version */
  pobVersion?: string;

  /** Total number of unique items */
  count: number;

  /** All unique items indexed by normalized name */
  items: Record<string, UniqueItem>;

  /** Index by slot for quick slot-based lookups */
  bySlot: Record<UniqueSlotType, string[]>;
}
