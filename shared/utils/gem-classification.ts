/**
 * Gem Classification Utilities
 *
 * Shared utilities for identifying main skills vs auras/support gems in PoE builds.
 * Used by ladder-fetcher, initial-analysis, chat routes, and analysis-harness.
 */

/**
 * Keywords that identify non-damage utility gems (should NOT be classified as main skills)
 * Includes auras, heralds, banners, warcries, guards, movement skills, and utility buffs
 */
export const AURA_KEYWORDS = [
  // Core auras
  'aura',
  'determination',
  'grace',
  'discipline',
  'vitality',
  'hatred',
  'wrath',
  'anger',
  'malevolence',
  'zealotry',
  'pride',
  'clarity',
  'precision',
  'haste',
  'envy',
  // Purity auras
  'purity of elements',
  'purity of fire',
  'purity of ice',
  'purity of lightning',
  // Heralds
  'herald of ash',
  'herald of ice',
  'herald of thunder',
  'herald of purity',
  'herald of agony',
  'herald',
  // Banners
  'defiance banner',
  'dread banner',
  'war banner',
  // Aspect skills (from bestiary uniques)
  'aspect of the avian',
  'aspect of the cat',
  'aspect of the crab',
  'aspect of the spider',
  // Defensive aura-like buffs
  'tempest shield',
  'arctic armour',
  // Blessing skills (aura variants)
  'blessing',
  // Warcries (utility, not damage skills)
  'cry',  // Catches all warcries: Rallying Cry, Intimidating Cry, Seismic Cry, etc.
  'autoexertion', // Warcry trigger support (renamed from Call to Arms Support)
  'overexertion', // Warcry-related keystone/support
  // Trigger/automation skills (utility, not damage skills)
  'automation', // Triggers linked instant spells automatically
  'spellslinger', // Triggers linked spells on attack
  'temporal rift', // Time manipulation utility skill
  'protective link', // Support link skill
  'death walk', // Utility from item (creates corpses on kill)
  'petrified blood', // Life reservation utility skill
  // Guard skills
  'molten shell',
  'steelskin',
  'immortal call',
  'bone armour',
  'vaal molten shell',
  'vaal grace',
  // Movement skills (not main damage)
  'flame dash',
  'frostblink',
  'leap slam',
  'whirling blades',
  'shield charge',
  'dash',
  'blink arrow',
  'mirror arrow',
  'lightning warp',
  'bodyswap',
  'phase run',
  'withering step',
  // Utility/trigger skills
  'blood rage',
  'blood and sand',
  'flesh and stone',
  'portal',
  'vaal haste',
  'vaal discipline',
  'vaal grace',
  // Curses (utility, not main damage)
  'curse',
  'mark',
  'conductivity',
  'flammability',
  'frostbite',
  'elemental weakness',
  'vulnerability',
  'despair',
  'enfeeble',
  'temporal chains',
  'punishment',
  'poacher\'s mark',
  'assassin\'s mark',
  'warlord\'s mark',
  'sniper\'s mark',
  // Brands (often utility, can check for "brand" but be careful)
  // Totems are damage so not included
  // Minions are damage so not included (except utility ones)
  'convocation',
  'offering', // Covers all offerings
  'desecrate',
  'bone offering',
  'flesh offering',
  'spirit offering',
  // Other utility
  'fortify',
  'momentum',
  'enduring cry',
  'rallying cry',
  'intimidating cry',
  'seismic cry',
  'ancestral cry',
  'infernal cry',
  'battlemage\'s cry',
  'general\'s cry', // This one IS damage-focused but through exerted attacks
] as const;

/**
 * Keywords that identify support gems
 */
export const SUPPORT_KEYWORDS = [
  'support',
  'awakened',
] as const;

/**
 * Interface for socket group information
 */
export interface SocketGroupInfo {
  enabled?: boolean;
  index?: number;
  slot?: string;
  skills?: string[];
  gemList?: Array<{
    enabled?: boolean;
    nameSpec?: string;
    isSupport?: boolean;
  }>;
  mainActiveSkill?: number;
}

/**
 * Result from getMainSkillForBuild
 */
export interface MainSkillResult {
  skill: string;
  isSpecialCase: boolean;
  specialCaseType?: 'aurabot' | 'unknown' | 'support-only';
}

/**
 * Check if a gem name is an aura (not a main damage skill)
 *
 * @param gemName - The name of the gem to check
 * @returns true if the gem is an aura/herald/banner/etc
 */
export function isAuraGem(gemName: string): boolean {
  if (!gemName) return false;
  const gemLower = gemName.toLowerCase();
  return AURA_KEYWORDS.some(keyword => gemLower.includes(keyword));
}

/**
 * Check if a gem name is a support gem
 *
 * @param gemName - The name of the gem to check
 * @returns true if the gem is a support gem
 */
export function isSupportGem(gemName: string): boolean {
  if (!gemName) return false;
  const gemLower = gemName.toLowerCase();
  return SUPPORT_KEYWORDS.some(keyword => gemLower.includes(keyword));
}

/**
 * Support gem effects that appear as selectable skills in PoB's displaySkillList.
 * These are support gems that modify how a skill works and show up as separate skill variants.
 * For example, "Pulverise Support" on Earthshatter creates a "Pulverise" entry in displaySkillList.
 */
const SUPPORT_GEM_VARIANTS = [
  // Melee support gems that create skill variants
  'pulverise',
  'fist of war',
  'shockwave',
  'ruthless',
  'multistrike',
  'melee splash',
  'ancestral call',
  'tribal fury',
  // Spell support gems that create skill variants
  'spell echo',
  'unleash',
  'intensify',
  // Attack support gems that create skill variants
  'barrage',
  'volley',
  'greater volley',
  'arrow nova',
  // Trigger support gems
  'cast when damage taken',
  'cast on critical strike',
  'cast on death',
  'cast while channelling',
  'arcanist brand',
  // Attack speed support gems
  'faster attacks',
  'faster projectiles',
  'greater multiple projectiles',
  'lesser multiple projectiles',
  // Other support gem variants that appear in displaySkillList
  'brutality',
  'elemental focus',
  'controlled destruction',
  'concentrated effect',
  'increased area of effect',
  'minion damage',
  'added fire damage',
  'added cold damage',
  'added lightning damage',
  'added chaos damage',
  'physical to lightning',
  'cold to fire',
  'avatar of fire',
  'fortify',  // Also appears as a variant
  'onslaught',
] as const;

/**
 * Check if a skill name is a support gem variant that appears in displaySkillList
 * These are support gems whose effects show up as selectable skill variants in PoB
 *
 * @param skillName - The skill name to check
 * @returns true if the skill is a support gem variant
 */
export function isSupportGemVariant(skillName: string): boolean {
  if (!skillName) return false;
  const skillLower = skillName.toLowerCase();
  return SUPPORT_GEM_VARIANTS.some(variant => skillLower === variant);
}

/**
 * Extract the main skill from a socket group, filtering out auras and supports
 *
 * @param group - Socket group information from PoB data
 * @returns The main skill name or null if none found
 */
export function extractMainSkill(group: SocketGroupInfo): string | null {
  if (!group || group.enabled === false) return null;

  // If gemList is available (detailed gem data), use it
  // gemList has the actual gems with isSupport flag - this is the reliable source
  if (group.gemList && group.gemList.length > 0) {
    const enabledGems = group.gemList.filter(g => g.enabled !== false);

    // Find the first enabled non-support, non-aura gem
    // Note: mainActiveSkill is an index into displaySkillList (skill variants), not gemList
    // So we can't use mainActiveSkill directly as a gemList index
    for (const gem of enabledGems) {
      if (gem.isSupport) continue;
      const gemName = gem.nameSpec || '';
      if (gemName && !isAuraGem(gemName)) {
        return gemName;
      }
    }

    return null;
  }

  // Fallback: Use skills array (less detailed, contains displaySkillList entries)
  // The skills array contains skill variant names which may include support-modified versions
  // We need to filter these out by checking against known support gem patterns
  if (group.skills && group.skills.length > 0) {
    for (const skill of group.skills) {
      // Skip auras and utility skills
      if (isAuraGem(skill)) continue;
      // Skip support gems (names ending in " Support")
      if (isSupportGem(skill)) continue;
      // Skip known support-gem variants that appear in displaySkillList
      if (isSupportGemVariant(skill)) continue;

      return skill;
    }
  }

  return null;
}

/**
 * Get the main skill for a build from socket groups
 *
 * Handles special cases:
 * - Aurabot builds (all auras) -> returns "Aurabot"
 * - Unknown builds -> returns "Unknown"
 * - Support-only groups -> skips them
 *
 * @param groups - Array of socket groups from PoB skills data
 * @param mainSocketGroup - Index of the main socket group (optional)
 * @param fallbackActiveSkill - Fallback from fullCalcs.activeSkill (optional)
 * @returns MainSkillResult with the skill name and special case info
 */
export function getMainSkillForBuild(
  groups: SocketGroupInfo[],
  mainSocketGroup?: number,
  fallbackActiveSkill?: string
): MainSkillResult {
  if (!groups || groups.length === 0) {
    return { skill: 'Unknown', isSpecialCase: true, specialCaseType: 'unknown' };
  }

  // First priority: Try the main socket group
  if (typeof mainSocketGroup === 'number') {
    const mainGroup = groups.find(g => g.index === mainSocketGroup);
    if (mainGroup) {
      const skill = extractMainSkill(mainGroup);
      if (skill) {
        return { skill, isSpecialCase: false };
      }
    }
  }

  // Second priority: Scan all enabled groups for a main skill
  const enabledGroups = groups.filter(g => g.enabled !== false);
  for (const group of enabledGroups) {
    const skill = extractMainSkill(group);
    if (skill) {
      return { skill, isSpecialCase: false };
    }
  }

  // Third priority: Use fallback activeSkill if provided and not an aura
  if (fallbackActiveSkill && !isAuraGem(fallbackActiveSkill)) {
    return { skill: fallbackActiveSkill, isSpecialCase: false };
  }

  // Check if this is an aurabot build (all enabled groups contain only auras)
  const allAuras = enabledGroups.every(group => {
    const skills = group.skills || [];
    const gemNames = group.gemList?.filter(g => !g.isSupport).map(g => g.nameSpec || '') || [];
    const allSkills = [...skills, ...gemNames].filter(Boolean);
    return allSkills.length === 0 || allSkills.every(s => isAuraGem(s) || isSupportGem(s));
  });

  if (allAuras && enabledGroups.length > 0) {
    return { skill: 'Aurabot', isSpecialCase: true, specialCaseType: 'aurabot' };
  }

  return { skill: 'Unknown', isSpecialCase: true, specialCaseType: 'unknown' };
}

/**
 * Extract all auras from socket groups (for aura statistics)
 *
 * @param groups - Array of socket groups from PoB skills data
 * @returns Array of unique aura names
 */
export function extractAurasFromGroups(groups: SocketGroupInfo[]): string[] {
  const auras: string[] = [];

  for (const group of groups) {
    if (group.enabled === false) continue;

    // Check gemList if available
    if (group.gemList) {
      for (const gem of group.gemList) {
        if (gem.enabled === false || gem.isSupport) continue;
        const gemName = gem.nameSpec || '';
        if (isAuraGem(gemName)) {
          auras.push(gemName);
        }
      }
    }

    // Check skills array
    if (group.skills) {
      for (const skill of group.skills) {
        if (isAuraGem(skill)) {
          auras.push(skill);
        }
      }
    }
  }

  return [...new Set(auras)];
}
