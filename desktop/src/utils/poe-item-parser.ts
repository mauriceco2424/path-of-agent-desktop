/**
 * PoE Item Text Parser
 *
 * Parses item text copied from Path of Exile (Ctrl+C) into a structured format.
 * Designed for use in the ItemBuilder modal to populate item data from clipboard.
 *
 * The PoE clipboard format has these characteristics:
 * - Sections separated by "--------"
 * - First line is always "Rarity: X"
 * - Item name and base type follow rarity (for rare/unique items)
 * - Properties like Quality, Armour, etc. appear before mods
 * - Implicit mods appear before the separator after base stats
 * - Explicit mods appear in later sections
 * - Influence markers (e.g., "Shaper Item") appear at the end
 * - Corrupted marker appears at the very end if corrupted
 */

import type { CraftedItemSpec, InfluenceType } from '../../../shared/types/crafting';

// =============================================================================
// Types
// =============================================================================

/**
 * Mod types that can appear on items
 */
export type ModType = 'implicit' | 'explicit' | 'crafted' | 'fractured' | 'enchant';

/**
 * A single mod parsed from item text
 */
export interface ParsedMod {
  /** The raw mod text as displayed in game */
  text: string;
  /** Type of mod based on location and markers */
  type: ModType;
}

/**
 * Requirements section from item
 */
export interface ItemRequirements {
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
}

/**
 * Parsed item data structure
 */
export interface ParsedPoEItem {
  /** Item rarity */
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  /** Item name (for rare/unique items) */
  name?: string;
  /** Base type (e.g., "Titanium Spirit Shield") */
  baseType: string;
  /** Item level */
  itemLevel?: number;
  /** Quality percentage */
  quality?: number;
  /** Socket string (e.g., "B-B-B") */
  sockets?: string;
  /** Item requirements */
  requirements?: ItemRequirements;
  /** Influence types on the item */
  influence?: InfluenceType[];
  /** Whether the item is corrupted */
  corrupted?: boolean;
  /** Whether the item is mirrored */
  mirrored?: boolean;
  /** Whether the item is synthesised */
  synthesised?: boolean;
  /** All mods with their types */
  mods: ParsedMod[];
  /** Convenience: just implicit mod texts */
  implicitMods?: string[];
  /** Convenience: just explicit mod texts */
  explicitMods?: string[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Section separator in PoE item text
 */
const SEPARATOR = '--------';

/**
 * Influence detection patterns
 */
const INFLUENCE_PATTERNS: Record<string, InfluenceType> = {
  'shaper item': 'shaper',
  'elder item': 'elder',
  'crusader item': 'crusader',
  'hunter item': 'hunter',
  'redeemer item': 'redeemer',
  'warlord item': 'warlord',
  'searing exarch item': 'searing',
  'eater of worlds item': 'eater',
};

/**
 * Lines that indicate item status markers (not mods)
 */
const STATUS_MARKERS = new Set([
  'corrupted',
  'mirrored',
  'synthesised',
  'synthesised item',
  'fractured item',
  'split',
]);

/**
 * Patterns that identify property/metadata lines (not mods)
 */
const PROPERTY_PATTERNS: RegExp[] = [
  /^Quality:\s*\+?\d+%/i,
  /^Armour:\s*\d+/i,
  /^Evasion(?:\s+Rating)?:\s*\d+/i,
  /^Energy Shield:\s*\d+/i,
  /^Ward:\s*\d+/i,
  /^(?:Chance to )?Block:\s*\d+%/i,
  /^Physical Damage:\s*\d+/i,
  /^Elemental Damage:/i,
  /^Chaos Damage:\s*\d+/i,
  /^Critical Strike Chance:\s*[\d.]+%/i,
  /^Attacks per Second:\s*[\d.]+/i,
  /^Weapon Range:\s*\d+/i,
  /^Level:\s*\d+/i,
  /^Str:\s*\d+/i,
  /^Dex:\s*\d+/i,
  /^Int:\s*\d+/i,
  /^Sockets:\s*[RGBW\-\s]+$/i,
  /^Item Level:\s*\d+/i,
  /^Requirements:$/i,
  /^Item Class:/i,
  /^Stack Size:/i,
  /^Radius:\s*\w+/i,
  /^Limited to:\s*\d+/i,
  /^Has \d+ Abyssal Socket/i,
  /^Has \d+ Socket/i,
  /^Map Tier:\s*\d+/i,
  /^Talisman Tier:\s*\d+/i,
];

// =============================================================================
// Main Parser Functions
// =============================================================================

/**
 * Check if text looks like a PoE item (Ctrl+C copy)
 *
 * @param text - Text to validate
 * @returns True if text appears to be a PoE item
 */
export function isPoEItemText(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  // Must start with "Rarity:"
  if (!trimmed.startsWith('Rarity:')) {
    return false;
  }

  // Must have at least one section separator
  if (!trimmed.includes(SEPARATOR)) {
    return false;
  }

  // Must have a valid rarity
  const firstLine = trimmed.split('\n')[0];
  const rarityMatch = firstLine.match(/^Rarity:\s*(\w+)/i);
  if (!rarityMatch) {
    return false;
  }

  const rarity = rarityMatch[1].toLowerCase();
  return ['normal', 'magic', 'rare', 'unique', 'currency', 'gem', 'divination card'].includes(rarity);
}

/**
 * Parse PoE item text (Ctrl+C from game) into structured format
 *
 * @param text - Raw item text from clipboard
 * @returns Parsed item data or null if parsing fails
 */
export function parsePoEItemText(text: string): ParsedPoEItem | null {
  if (!isPoEItemText(text)) {
    return null;
  }

  const lines = text.trim().split('\n').map(l => l.trim());
  const sections = splitIntoSections(lines);

  if (sections.length === 0 || sections[0].length === 0) {
    return null;
  }

  // Parse rarity from first line
  const rarityLine = sections[0][0];
  const rarity = parseRarity(rarityLine);
  if (!rarity) {
    return null;
  }

  // Parse name and base type from first section
  const { name, baseType } = parseNameAndBase(sections[0], rarity);
  if (!baseType) {
    return null;
  }

  // Initialize result
  const result: ParsedPoEItem = {
    rarity,
    baseType,
    mods: [],
  };

  if (name) {
    result.name = name;
  }

  // Track parsing state
  let foundImplicitSection = false;
  let implicitCount: number | undefined;
  const allInfluences: InfluenceType[] = [];

  // Process each section
  for (let sectionIndex = 1; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];

    for (const line of section) {
      const lineLower = line.toLowerCase();

      // Check for item level
      const itemLevelMatch = line.match(/^Item Level:\s*(\d+)/i);
      if (itemLevelMatch) {
        const itemLevel = parseInt(itemLevelMatch[1], 10);
        if (!isNaN(itemLevel)) {
          result.itemLevel = itemLevel;
        }
        continue;
      }

      // Check for quality
      const qualityMatch = line.match(/^Quality:\s*\+?(\d+)%/i);
      if (qualityMatch) {
        const quality = parseInt(qualityMatch[1], 10);
        if (!isNaN(quality)) {
          result.quality = quality;
        }
        continue;
      }

      // Check for sockets (PoE1 valid colors: R, G, B, W only)
      const socketsMatch = line.match(/^Sockets:\s*([RGBW\-\s]+)$/i);
      if (socketsMatch) {
        result.sockets = socketsMatch[1].replace(/\s/g, '');
        continue;
      }

      // Check for requirements section
      if (lineLower === 'requirements:') {
        result.requirements = parseRequirements(section);
        continue;
      }

      // Check for influences
      for (const [pattern, influence] of Object.entries(INFLUENCE_PATTERNS)) {
        if (lineLower === pattern) {
          allInfluences.push(influence);
          break;
        }
      }

      // Check for status markers
      if (lineLower === 'corrupted') {
        result.corrupted = true;
        continue;
      }
      if (lineLower === 'mirrored') {
        result.mirrored = true;
        continue;
      }
      if (lineLower === 'synthesised' || lineLower === 'synthesised item') {
        result.synthesised = true;
        continue;
      }

      // Skip known status markers
      if (STATUS_MARKERS.has(lineLower)) {
        continue;
      }

      // Skip property lines
      if (isPropertyLine(line)) {
        continue;
      }

      // Check for implicit count marker (PoB format)
      const implicitCountMatch = line.match(/^Implicits:\s*(\d+)$/i);
      if (implicitCountMatch) {
        implicitCount = parseInt(implicitCountMatch[1], 10);
        continue;
      }

      // Remaining non-empty lines should be mods
      if (line && !isInfluenceLine(lineLower)) {
        const mod = parseModLine(line, sectionIndex, foundImplicitSection, implicitCount);
        if (mod) {
          result.mods.push(mod);

          // Track if we've passed implicit section (heuristic: crafted/fractured mods indicate explicit section)
          if (mod.type === 'crafted' || mod.type === 'fractured') {
            foundImplicitSection = true;
          }
        }
      }
    }

    // After first mod section, mark as having passed implicits
    if (result.mods.length > 0 && sectionIndex === 1) {
      foundImplicitSection = true;
    }
  }

  // Set influences if found
  if (allInfluences.length > 0) {
    result.influence = allInfluences;
  }

  // Build convenience arrays
  result.implicitMods = result.mods
    .filter(m => m.type === 'implicit' || m.type === 'enchant')
    .map(m => m.text);
  result.explicitMods = result.mods
    .filter(m => m.type === 'explicit' || m.type === 'crafted' || m.type === 'fractured')
    .map(m => m.text);

  // Post-process: if we have implicit count from PoB format, reclassify mods
  if (implicitCount !== undefined && implicitCount > 0) {
    reclassifyModsWithImplicitCount(result, implicitCount);
  }

  return result;
}

/**
 * Convert parsed item to CraftedItemSpec format for use with Item Builder
 *
 * @param parsed - Parsed PoE item
 * @returns CraftedItemSpec for use with crafting endpoints
 */
export function parsedItemToCraftedSpec(parsed: ParsedPoEItem): CraftedItemSpec {
  const spec: CraftedItemSpec = {
    baseType: parsed.baseType,
    itemLevel: parsed.itemLevel ?? 1,
    rarity: parsed.rarity,
    mods: [],
  };

  if (parsed.name) {
    spec.name = parsed.name;
  }

  if (parsed.influence && parsed.influence.length > 0) {
    spec.influence = parsed.influence[0]; // CraftedItemSpec only supports single influence
  }

  if (parsed.corrupted) {
    spec.corrupted = true;
  }

  // Convert mods to CraftedItemMod format
  // Note: We don't have full mod IDs or tier info from clipboard text,
  // so we create partial specs that can be enhanced by the Item Builder
  for (const mod of parsed.mods) {
    // Skip enchants for CraftedItemSpec (they're handled separately)
    if (mod.type === 'enchant') {
      continue;
    }

    spec.mods.push({
      id: '', // Will need to be resolved by mod lookup
      stat: mod.text,
      values: extractModValues(mod.text),
      type: mod.type === 'implicit' ? 'implicit' : 'prefix', // Default explicit to prefix
    });
  }

  return spec;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Split item lines into sections (separated by "--------")
 */
function splitIntoSections(lines: string[]): string[][] {
  const sections: string[][] = [];
  let currentSection: string[] = [];

  for (const line of lines) {
    if (line === SEPARATOR) {
      if (currentSection.length > 0) {
        sections.push(currentSection);
        currentSection = [];
      }
    } else {
      currentSection.push(line);
    }
  }

  if (currentSection.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Parse rarity from the "Rarity: X" line
 */
function parseRarity(line: string): ParsedPoEItem['rarity'] | null {
  const match = line.match(/^Rarity:\s*(\w+)/i);
  if (!match) {
    return null;
  }

  const rarityStr = match[1].toLowerCase();
  switch (rarityStr) {
    case 'normal':
      return 'normal';
    case 'magic':
      return 'magic';
    case 'rare':
      return 'rare';
    case 'unique':
      return 'unique';
    default:
      // Currency, gems, etc. - treat as normal for item purposes
      return 'normal';
  }
}

/**
 * Parse item name and base type from the first section
 */
function parseNameAndBase(
  section: string[],
  rarity: ParsedPoEItem['rarity']
): { name?: string; baseType: string } {
  // First line is always rarity, skip it
  const contentLines = section.slice(1).filter(l => l && !isPropertyLine(l));

  if (contentLines.length === 0) {
    return { baseType: '' };
  }

  // For Normal items: only base type
  if (rarity === 'normal') {
    return { baseType: contentLines[0] };
  }

  // For Magic items: combined name+base (e.g., "Beryl Ring of Resistance")
  // We try to extract the base type, but it's complex so return full text
  if (rarity === 'magic') {
    return { baseType: contentLines[0] };
  }

  // For Rare/Unique items: first line is name, second is base type
  if (contentLines.length >= 2) {
    return {
      name: contentLines[0],
      baseType: contentLines[1],
    };
  }

  // Fallback: single line is the base type
  return { baseType: contentLines[0] };
}

/**
 * Parse requirements from a requirements section
 */
function parseRequirements(section: string[]): ItemRequirements {
  const requirements: ItemRequirements = {};

  for (const line of section) {
    const levelMatch = line.match(/^Level:\s*(\d+)/i);
    if (levelMatch) {
      const level = parseInt(levelMatch[1], 10);
      if (!isNaN(level)) {
        requirements.level = level;
      }
      continue;
    }

    const strMatch = line.match(/^Str(?:ength)?:\s*(\d+)/i);
    if (strMatch) {
      const str = parseInt(strMatch[1], 10);
      if (!isNaN(str)) {
        requirements.str = str;
      }
      continue;
    }

    const dexMatch = line.match(/^Dex(?:terity)?:\s*(\d+)/i);
    if (dexMatch) {
      const dex = parseInt(dexMatch[1], 10);
      if (!isNaN(dex)) {
        requirements.dex = dex;
      }
      continue;
    }

    const intMatch = line.match(/^Int(?:elligence)?:\s*(\d+)/i);
    if (intMatch) {
      const int = parseInt(intMatch[1], 10);
      if (!isNaN(int)) {
        requirements.int = int;
      }
      continue;
    }
  }

  return requirements;
}

/**
 * Check if a line is a property/metadata line (not a mod)
 */
function isPropertyLine(line: string): boolean {
  for (const pattern of PROPERTY_PATTERNS) {
    if (pattern.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a line is an influence marker
 */
function isInfluenceLine(lineLower: string): boolean {
  return Object.keys(INFLUENCE_PATTERNS).includes(lineLower);
}

/**
 * Parse a single mod line and determine its type.
 *
 * NOTE: This function supports BOTH formats:
 * 1. PoE game clipboard format (Ctrl+C in game) - no special tags
 * 2. Path of Building export format - includes {crafted}, {fractured} tags
 *
 * The {crafted} and {fractured} tags only appear in PoB exports, not in
 * the actual PoE game clipboard. This is intentional to support PoB imports.
 */
function parseModLine(
  line: string,
  sectionIndex: number,
  passedImplicitSection: boolean,
  _implicitCount?: number
): ParsedMod | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  // Check for crafted mod marker (PoB export format only, not PoE clipboard)
  if (trimmed.startsWith('{crafted}')) {
    return {
      text: trimmed.replace(/^\{crafted\}\s*/i, ''),
      type: 'crafted',
    };
  }

  // Check for fractured mod marker (PoB export format only, not PoE clipboard)
  if (trimmed.startsWith('{fractured}')) {
    return {
      text: trimmed.replace(/^\{fractured\}\s*/i, ''),
      type: 'fractured',
    };
  }

  // Check for other tag markers (rare in clipboard text but possible)
  const tagMatch = trimmed.match(/^\{([^}]+)\}\s*(.*)/);
  if (tagMatch) {
    const tag = tagMatch[1].toLowerCase();
    const modText = tagMatch[2];

    if (tag === 'crafted') {
      return { text: modText, type: 'crafted' };
    }
    if (tag === 'fractured') {
      return { text: modText, type: 'fractured' };
    }
    // Other tags - treat as explicit
    return { text: modText, type: 'explicit' };
  }

  // Determine implicit vs explicit based on section position
  // In clipboard format:
  // - Section 1 (after rarity/name): Usually implicits or base stats
  // - Later sections: Usually explicits
  // - Enchants often appear with specific patterns

  // Check for enchant patterns (common on helmet/boots/gloves)
  if (isEnchantMod(trimmed)) {
    return {
      text: trimmed,
      type: 'enchant',
    };
  }

  // NOTE: Implicit vs explicit classification is heuristic-based. The PoE clipboard
  // format doesn't explicitly mark which mods are implicit. This heuristic uses
  // section index which works for most items but may misclassify mods on items
  // with unusual section layouts (e.g., synthesised items, items with many sockets).
  const type: ModType = !passedImplicitSection && sectionIndex <= 2 ? 'implicit' : 'explicit';

  return {
    text: trimmed,
    type,
  };
}

/**
 * Check if a mod is likely an enchantment
 */
function isEnchantMod(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Lab enchant patterns
  const enchantPatterns = [
    /^\d+% increased .*? damage if you['']?ve killed recently/i,
    /^trigger decree of/i,
    /^trigger edict of/i,
    /^trigger commandment of/i,
    /^trigger word of/i,
    /^enchantment/i,
    /^of the grave/i,
    /^adds \d+ to \d+ .* damage if you['']?ve killed recently/i,
    /damage penetrates \d+% .* resistance if you haven['']?t killed recently/i,
    /regenerate \d+% of life per second if you were hit recently/i,
    /% increased movement speed if you haven['']?t been hit recently/i,
    /% increased attack and cast speed if you['']?ve killed recently/i,
  ];

  for (const pattern of enchantPatterns) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }

  return false;
}

/**
 * Reclassify mods when we have explicit implicit count information
 */
function reclassifyModsWithImplicitCount(item: ParsedPoEItem, implicitCount: number): void {
  // Find mods that aren't explicitly typed (crafted/fractured/enchant)
  const unclassifiedMods = item.mods.filter(
    m => m.type !== 'crafted' && m.type !== 'fractured' && m.type !== 'enchant'
  );

  let implicitsSeen = 0;

  for (const mod of unclassifiedMods) {
    if (implicitsSeen < implicitCount) {
      mod.type = 'implicit';
      implicitsSeen++;
    } else {
      mod.type = 'explicit';
    }
  }

  // Rebuild convenience arrays
  item.implicitMods = item.mods
    .filter(m => m.type === 'implicit' || m.type === 'enchant')
    .map(m => m.text);
  item.explicitMods = item.mods
    .filter(m => m.type === 'explicit' || m.type === 'crafted' || m.type === 'fractured')
    .map(m => m.text);
}

/**
 * Extract numeric values from a mod text
 */
function extractModValues(text: string): number[] {
  const values: number[] = [];

  // Match various numeric patterns
  // "+95 to maximum Life" -> [95]
  // "Adds 10 to 20 Fire Damage" -> [10, 20]
  // "+25% to Fire Resistance" -> [25]
  // "Regenerate 1.5% of Life per second" -> [1.5]

  const regex = /([+-]?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    if (!isNaN(value)) {
      values.push(value);
    }
  }

  return values;
}

/**
 * Parse unique item text specifically, extracting any unique-specific info
 * This is a specialized helper for unique items which have fixed mods
 */
export function parseUniqueItemText(text: string): ParsedPoEItem | null {
  const parsed = parsePoEItemText(text);
  if (!parsed || parsed.rarity !== 'unique') {
    return null;
  }

  // For unique items, all mods after implicits are "explicit" (fixed by the unique)
  // Uniques don't have crafted/fractured mods (though can have corrupted implicits)
  return parsed;
}

/**
 * Attempt to extract base type from magic item name
 * Magic items combine prefix/suffix with base type: "Beryl Ring of Resistance"
 * This is heuristic-based and may not always be accurate
 */
export function extractBaseFromMagicName(magicName: string): string | null {
  // Common base type patterns to look for
  const baseTypePatterns = [
    // Rings
    /\b((?:Iron|Coral|Paua|Gold|Topaz|Sapphire|Ruby|Two-Stone|Diamond|Prismatic|Unset|Steel|Opal|Amethyst|Vermillion|Cerulean|Bone|Moonstone|Breach) Ring)\b/i,
    // Amulets
    /\b((?:Coral|Paua|Gold|Jade|Lapis|Citrine|Turquoise|Agate|Onyx|Marble|Blue Pearl|Ashscale Talisman|Avian Twins Talisman|Black Maw Talisman|Bonespire Talisman|Breakrib Talisman|Chrysalis Talisman|Clutching Talisman|Deadhand Talisman|Deep One Talisman|Fangjaw Talisman|Greatwolf Talisman|Hexclaw Talisman|Horned Talisman|Lone Antler Talisman|Longtooth Talisman|Mandible Talisman|Monkey Paw Talisman|Monkey Twins Talisman|Primal Skull Talisman|Rot Head Talisman|Rotfeather Talisman|Spinefuse Talisman|Splitnewt Talisman|Three Hands Talisman|Three Rat Talisman|Undying Flesh Talisman|Wereclaw Talisman|Writhing Talisman) Amulet)\b/i,
    // Belts
    /\b((?:Chain|Rustic Sash|Stygian Vise|Heavy Belt|Leather Belt|Cloth Belt|Studded Belt|Crystal Belt|Vanguard Belt|Micro-Distillery Belt) Belt)\b/i,
  ];

  for (const pattern of baseTypePatterns) {
    const match = magicName.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Fallback: couldn't determine base type
  return null;
}
