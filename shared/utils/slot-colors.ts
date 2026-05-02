/**
 * Slot Color Constants
 *
 * Shared color scheme for equipment slots used across the application
 * to visually link gear items with their improvement suggestions.
 */

/**
 * Color definitions for each equipment slot.
 * Used for badges, backgrounds, and glows to create visual consistency.
 * bgRaw/glowRaw/borderRaw are used for inline styles where Tailwind classes can't be dynamically generated.
 */
export const SLOT_COLORS: Record<string, { bg: string; bgRaw: string; text: string; glow: string; glowRaw: string; border: string; borderRaw: string }> = {
  // borderRaw uses HEX format to support opacity suffixes (e.g., #ef444480 for 50% opacity)
  weapon:        { bg: 'bg-red-500/20',     bgRaw: 'rgba(239, 68, 68, 0.2)',    text: 'text-red-400',     glow: 'shadow-red-500/20',     glowRaw: '0 0 12px rgba(239, 68, 68, 0.2)',     border: 'border-red-500/50',     borderRaw: '#ef4444' },
  shield:        { bg: 'bg-amber-500/20',   bgRaw: 'rgba(245, 158, 11, 0.2)',   text: 'text-amber-400',   glow: 'shadow-amber-500/20',   glowRaw: '0 0 12px rgba(245, 158, 11, 0.2)',   border: 'border-amber-500/50',   borderRaw: '#f59e0b' },
  helmet:        { bg: 'bg-purple-500/20',  bgRaw: 'rgba(168, 85, 247, 0.2)',   text: 'text-purple-400',  glow: 'shadow-purple-500/20',  glowRaw: '0 0 12px rgba(168, 85, 247, 0.2)',  border: 'border-purple-500/50',  borderRaw: '#a855f7' },
  'body-armour': { bg: 'bg-blue-500/20',    bgRaw: 'rgba(59, 130, 246, 0.2)',   text: 'text-blue-400',    glow: 'shadow-blue-500/20',    glowRaw: '0 0 12px rgba(59, 130, 246, 0.2)',    border: 'border-blue-500/50',    borderRaw: '#3b82f6' },
  gloves:        { bg: 'bg-teal-500/20',    bgRaw: 'rgba(20, 184, 166, 0.2)',   text: 'text-teal-400',    glow: 'shadow-teal-500/20',    glowRaw: '0 0 12px rgba(20, 184, 166, 0.2)',    border: 'border-teal-500/50',    borderRaw: '#14b8a6' },
  boots:         { bg: 'bg-yellow-500/20',  bgRaw: 'rgba(234, 179, 8, 0.2)',    text: 'text-yellow-400',  glow: 'shadow-yellow-500/20',  glowRaw: '0 0 12px rgba(234, 179, 8, 0.2)',   border: 'border-yellow-500/50',  borderRaw: '#eab308' },
  belt:          { bg: 'bg-orange-500/20',  bgRaw: 'rgba(249, 115, 22, 0.2)',   text: 'text-orange-400',  glow: 'shadow-orange-500/20',  glowRaw: '0 0 12px rgba(249, 115, 22, 0.2)',  border: 'border-orange-500/50',  borderRaw: '#f97316' },
  amulet:        { bg: 'bg-pink-500/20',    bgRaw: 'rgba(236, 72, 153, 0.2)',   text: 'text-pink-400',    glow: 'shadow-pink-500/20',    glowRaw: '0 0 12px rgba(236, 72, 153, 0.2)',    border: 'border-pink-500/50',    borderRaw: '#ec4899' },
  ring:          { bg: 'bg-cyan-500/20',    bgRaw: 'rgba(6, 182, 212, 0.2)',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20',    glowRaw: '0 0 12px rgba(6, 182, 212, 0.2)',   border: 'border-cyan-500/50',    borderRaw: '#06b6d4' },
  flask:         { bg: 'bg-emerald-500/20', bgRaw: 'rgba(16, 185, 129, 0.2)',   text: 'text-emerald-400', glow: 'shadow-emerald-500/20', glowRaw: '0 0 12px rgba(16, 185, 129, 0.2)', border: 'border-emerald-500/50', borderRaw: '#10b981' },
  tincture:      { bg: 'bg-violet-500/20',  bgRaw: 'rgba(139, 92, 246, 0.2)',   text: 'text-violet-400',  glow: 'shadow-violet-500/20',  glowRaw: '0 0 12px rgba(139, 92, 246, 0.2)',  border: 'border-violet-500/50',  borderRaw: '#8b5cf6' },
  jewel:         { bg: 'bg-indigo-500/20',  bgRaw: 'rgba(99, 102, 241, 0.2)',   text: 'text-indigo-400',  glow: 'shadow-indigo-500/20',  glowRaw: '0 0 12px rgba(99, 102, 241, 0.2)',  border: 'border-indigo-500/50',  borderRaw: '#6366f1' },
};

/**
 * Human-readable display names for slots.
 * Maps internal slot names to user-friendly labels.
 */
export const SLOT_DISPLAY_NAMES: Record<string, string> = {
  weapon: 'Weapon',
  shield: 'Shield',
  helmet: 'Helmet',
  'body-armour': 'Body Armour',
  gloves: 'Gloves',
  boots: 'Boots',
  belt: 'Belt',
  amulet: 'Amulet',
  ring: 'Ring',
  flask: 'Flask',
  tincture: 'Tincture',
  jewel: 'Jewel',
};

/**
 * Maps various slot name variants to normalized slot names (for COLORS).
 * Collapses specific slots (Ring 1, Ring 2) to generic (ring) for consistent coloring.
 * Handles PoB naming conventions and natural language variations.
 */
const SLOT_ALIASES: Record<string, string> = {
  // PoB slot names
  'weapon 1': 'weapon',
  'weapon 2': 'shield', // Off-hand can be weapon or shield
  'weapon 1 swap': 'weapon',
  'weapon 2 swap': 'shield',
  'body armour': 'body-armour',
  'body armor': 'body-armour',
  'ring 1': 'ring',
  'ring 2': 'ring',
  'flask 1': 'flask',
  'flask 2': 'flask',
  'flask 3': 'flask',
  'flask 4': 'flask',
  'flask 5': 'flask',
  // Natural language variations
  'main hand': 'weapon',
  'off hand': 'shield',
  'offhand': 'shield',
  'chest': 'body-armour',
  'body': 'body-armour',
  'armour': 'body-armour',
  'armor': 'body-armour',
  'head': 'helmet',
  'helm': 'helmet',
  'hands': 'gloves',
  'glove': 'gloves',
  'boot': 'boots',
  'feet': 'boots',
  'neck': 'amulet',
  'necklace': 'amulet',
  'rings': 'ring',
};

/**
 * Maps various slot name variants to SPECIFIC slot names (for MATCHING/HIGHLIGHTING).
 * Preserves slot specificity (Ring 1, Ring 2, Flask 1, etc.) for exact matching.
 */
const SLOT_MATCH_ALIASES: Record<string, string> = {
  // PoB slot names - preserve specificity
  'weapon 1': 'weapon-1',
  'weapon 2': 'weapon-2',
  'weapon 1 swap': 'weapon-1-swap',
  'weapon 2 swap': 'weapon-2-swap',
  'body armour': 'body-armour',
  'body armor': 'body-armour',
  'ring 1': 'ring-1',
  'ring 2': 'ring-2',
  'ring-1': 'ring-1',
  'ring-2': 'ring-2',
  'flask 1': 'flask-1',
  'flask 2': 'flask-2',
  'flask 3': 'flask-3',
  'flask 4': 'flask-4',
  'flask 5': 'flask-5',
  'flask-1': 'flask-1',
  'flask-2': 'flask-2',
  'flask-3': 'flask-3',
  'flask-4': 'flask-4',
  'flask-5': 'flask-5',
  // Natural language variations
  'main hand': 'weapon-1',
  'off hand': 'weapon-2',
  'offhand': 'weapon-2',
  'chest': 'body-armour',
  'body': 'body-armour',
  'armour': 'body-armour',
  'armor': 'body-armour',
  'head': 'helmet',
  'helm': 'helmet',
  'hands': 'gloves',
  'glove': 'gloves',
  'boot': 'boots',
  'feet': 'boots',
  'neck': 'amulet',
  'necklace': 'amulet',
};

/**
 * Normalize a slot name to the canonical form used in SLOT_COLORS.
 * Handles various input formats from PoB and natural language.
 *
 * @param slot - Raw slot name from any source
 * @returns Normalized slot name or undefined if not recognized
 */
export function normalizeSlotName(slot: string | undefined | null): string | undefined {
  if (!slot) return undefined;

  const normalized = slot.toLowerCase().trim();

  // Direct match first
  if (SLOT_COLORS[normalized]) {
    return normalized;
  }

  // Check aliases
  if (SLOT_ALIASES[normalized]) {
    return SLOT_ALIASES[normalized];
  }

  // Partial match for common patterns
  if (normalized.includes('weapon') || normalized.includes('axe') || normalized.includes('sword') ||
      normalized.includes('mace') || normalized.includes('claw') || normalized.includes('dagger') ||
      normalized.includes('staff') || normalized.includes('wand') || normalized.includes('bow')) {
    return 'weapon';
  }
  if (normalized.includes('helmet') || normalized.includes('helm') || normalized.includes('crown') ||
      normalized.includes('mask') || normalized.includes('hood')) {
    return 'helmet';
  }
  if (normalized.includes('body') || normalized.includes('chest') || normalized.includes('armour') ||
      normalized.includes('armor') || normalized.includes('robe') || normalized.includes('vest')) {
    return 'body-armour';
  }
  if (normalized.includes('glove') || normalized.includes('gauntlet') || normalized.includes('hand')) {
    return 'gloves';
  }
  if (normalized.includes('boot') || normalized.includes('shoe') || normalized.includes('greave') ||
      normalized.includes('feet')) {
    return 'boots';
  }
  if (normalized.includes('belt') || normalized.includes('sash') || normalized.includes('stygian')) {
    return 'belt';
  }
  if (normalized.includes('amulet') || normalized.includes('neck') || normalized.includes('talisman')) {
    return 'amulet';
  }
  if (normalized.includes('ring') && !normalized.includes('flask')) {
    return 'ring';
  }
  if (normalized.includes('shield') || normalized.includes('buckler') || normalized.includes('spirit shield')) {
    return 'shield';
  }
  if (normalized.includes('flask')) {
    return 'flask';
  }
  if (normalized.includes('tincture')) {
    return 'tincture';
  }
  if (normalized.includes('jewel')) {
    return 'jewel';
  }

  return undefined;
}

/**
 * Normalize a slot name for MATCHING/HIGHLIGHTING purposes.
 * Unlike normalizeSlotName, this preserves slot specificity (Ring 1 vs Ring 2, Flask 1 vs Flask 2, etc.)
 * Use this when comparing slots for highlighting, NOT for color lookup.
 *
 * @param slot - Raw slot name from any source
 * @returns Normalized slot name that preserves specificity, or undefined if not recognized
 */
export function normalizeSlotForMatching(slot: string | undefined | null): string | undefined {
  if (!slot) return undefined;

  const normalized = slot.toLowerCase().trim();

  // Check specific match aliases first (preserves Ring 1 vs Ring 2, etc.)
  if (SLOT_MATCH_ALIASES[normalized]) {
    return SLOT_MATCH_ALIASES[normalized];
  }

  // For non-specific slots, use generic names
  if (SLOT_COLORS[normalized]) {
    return normalized;
  }

  // Pattern matching for specific numbered slots
  const ringMatch = normalized.match(/ring[- ]?(\d)/);
  if (ringMatch) {
    return `ring-${ringMatch[1]}`;
  }

  const flaskMatch = normalized.match(/flask[- ]?(\d)/);
  if (flaskMatch) {
    return `flask-${flaskMatch[1]}`;
  }

  const weaponMatch = normalized.match(/weapon[- ]?(\d)(?:[- ]?(swap))?/);
  if (weaponMatch) {
    return weaponMatch[2] ? `weapon-${weaponMatch[1]}-swap` : `weapon-${weaponMatch[1]}`;
  }

  const jewelMatch = normalized.match(/jewel[- ]?(\d+)/);
  if (jewelMatch) {
    return `jewel-${jewelMatch[1]}`;
  }

  // Fallback to generic slot names for non-numbered slots
  if (normalized.includes('helmet') || normalized.includes('helm')) return 'helmet';
  if (normalized.includes('body') || normalized.includes('chest') || normalized.includes('armour') || normalized.includes('armor')) return 'body-armour';
  if (normalized.includes('glove') || normalized.includes('gauntlet')) return 'gloves';
  if (normalized.includes('boot') || normalized.includes('greave')) return 'boots';
  if (normalized.includes('belt') || normalized.includes('sash')) return 'belt';
  if (normalized.includes('amulet') || normalized.includes('neck')) return 'amulet';
  if (normalized.includes('shield') || normalized.includes('buckler')) return 'shield';
  if (normalized.includes('tincture')) return 'tincture';
  // Generic ring/flask/jewel only if no number found
  if (normalized.includes('ring')) return 'ring';
  if (normalized.includes('flask')) return 'flask';
  if (normalized.includes('jewel')) return 'jewel';
  if (normalized.includes('weapon')) return 'weapon';

  return undefined;
}

/**
 * Get the color scheme for a slot.
 * Returns a fallback gray color if slot is not recognized.
 *
 * @param slot - Slot name (will be normalized)
 * @returns Color object with bg, bgRaw, text, glow, glowRaw, border, and borderRaw
 */
export function getSlotColor(slot: string | undefined | null): { bg: string; bgRaw: string; text: string; glow: string; glowRaw: string; border: string; borderRaw: string } {
  const normalized = normalizeSlotName(slot);

  if (normalized && SLOT_COLORS[normalized]) {
    return SLOT_COLORS[normalized];
  }

  // Fallback for unrecognized slots (borderRaw already in HEX format)
  return {
    bg: 'bg-slate-500/20',
    bgRaw: 'rgba(100, 116, 139, 0.25)',
    text: 'text-slate-400',
    glow: 'shadow-slate-500/20',
    glowRaw: '0 0 12px rgba(100, 116, 139, 0.2)',
    border: 'border-slate-500',
    borderRaw: '#64748b',
  };
}

/**
 * Get the display name for a slot.
 * Returns the original slot name (capitalized) if not in display names map.
 *
 * @param slot - Slot name (will be normalized)
 * @returns Human-readable slot name
 */
export function getSlotDisplayName(slot: string | undefined | null): string {
  if (!slot) return 'Unknown';

  const normalized = normalizeSlotName(slot);

  if (normalized && SLOT_DISPLAY_NAMES[normalized]) {
    return SLOT_DISPLAY_NAMES[normalized];
  }

  // Fallback: capitalize first letter of each word
  return slot.split(/[-_\s]+/).map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Extract slot name from text (title, evidence, etc.)
 * Useful for fallback when structured slot data is missing.
 *
 * @param texts - Array of text strings to search
 * @returns Normalized slot name or undefined
 */
export function extractSlotFromText(...texts: (string | undefined | null)[]): string | undefined {
  const combined = texts.filter(Boolean).join(' ').toLowerCase();

  // Check for explicit slot mentions
  const slotKeywords = [
    { pattern: /\bweapon\b|\baxe\b|\bsword\b|\bmace\b|\bclaw\b|\bdagger\b|\bstaff\b|\bwand\b|\bbow\b/i, slot: 'weapon' },
    { pattern: /\bshield\b|\bbuckler\b|\bspirit shield\b/i, slot: 'shield' },
    { pattern: /\bhelmet\b|\bhelm\b|\bcrown\b|\bmask\b|\bhood\b/i, slot: 'helmet' },
    { pattern: /\bbody armou?r\b|\bchest\b|\brobe\b|\bvest\b/i, slot: 'body-armour' },
    { pattern: /\bgloves?\b|\bgauntlets?\b/i, slot: 'gloves' },
    { pattern: /\bboots?\b|\bgreaves?\b|\bshoes?\b/i, slot: 'boots' },
    { pattern: /\bbelt\b|\bsash\b|\bstygian\b/i, slot: 'belt' },
    { pattern: /\bamulet\b|\bnecklace\b|\btalisman\b/i, slot: 'amulet' },
    { pattern: /\bring\b(?!.*flask)/i, slot: 'ring' },
    { pattern: /\bflask\b/i, slot: 'flask' },
    { pattern: /\btincture\b/i, slot: 'tincture' },
    { pattern: /\bjewel\b/i, slot: 'jewel' },
  ];

  for (const { pattern, slot } of slotKeywords) {
    if (pattern.test(combined)) {
      return slot;
    }
  }

  return undefined;
}
