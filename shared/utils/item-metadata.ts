/**
 * Item Metadata Patterns
 *
 * Shared patterns for filtering PoB item metadata lines from mod parsing.
 * Used by both backend item-parser and frontend EquipmentSlotItem fallback.
 */

/**
 * Metadata line patterns to filter out from mod parsing
 * These lines are item properties, not mods
 */
export const METADATA_PATTERNS: RegExp[] = [
  /^Quality:\s*\+?\d+%?$/i,
  /^LevelReq:\s*\d+$/i,
  /^Level:\s*\d+$/i,
  /^Unique ID:/i,
  /^Implicits:\s*\d+$/i,
  /^Sockets:\s*[RGBW\-\s]+$/i,
  /^Item Level:\s*\d+$/i,
  /^Requirements:$/i,
  /^Str:\s*\d+$/i,
  /^Dex:\s*\d+$/i,
  /^Int:\s*\d+$/i,
  /^Armour:\s*\d+$/i,
  /^ArmourBasePercentile:\s*[\d.]+$/i,
  /^Evasion Rating:\s*\d+$/i,
  /^Evasion:\s*\d+$/i,
  /^EvasionBasePercentile:\s*[\d.]+$/i,
  /^Energy Shield:\s*\d+$/i,
  /^EnergyShieldBasePercentile:\s*[\d.]+$/i,
  /^Ward:\s*\d+$/i,
  /^WardBasePercentile:\s*[\d.]+$/i,
  /^Block:\s*\d+%$/i,
  /^Chance to Block:\s*\d+%$/i,
  /^Physical Damage:\s*\d+-\d+$/i,
  /^Elemental Damage:\s*\d+-\d+$/i,
  /^Critical Strike Chance:\s*\d+(\.\d+)?%$/i,
  /^Attacks per Second:\s*\d+(\.\d+)?$/i,
  /^Weapon Range:\s*\d+$/i,
  /^Rarity:\s*\w+$/i,
  /^Radius:\s*\w+$/i,
  /^Limited to:\s*\d+$/i,
  /^Has \d+ Abyssal Socket/i,
  /^Has \d+ Socket/i,
];

/**
 * Check if a line is metadata (not a mod)
 */
export function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();

  // Empty lines
  if (!trimmed) return true;

  // Separator lines
  if (trimmed === '--------') return true;

  // Check against metadata patterns
  for (const pattern of METADATA_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Check if a rarity string represents a unique item.
 * PoB uses "RELIC" for foil/relic uniques — these are functionally identical
 * to uniques for mod handling, icon lookup, and display purposes.
 */
export function isUniqueRarity(rarity: string | undefined): boolean {
  if (!rarity) return false;
  const upper = rarity.toUpperCase();
  return upper === 'UNIQUE' || upper === 'RELIC';
}
