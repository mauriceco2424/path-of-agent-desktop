/**
 * StructuredBuildData Interface
 * Extended build representation for LLM contextual reasoning
 *
 * This type provides a structured format for build data that can be used
 * by the LLM to understand and reason about builds.
 */

// Placeholder types - these will be replaced with proper types when we rework the system

/**
 * Equipment item placeholder
 */
export interface EquipmentItem {
  name: string;
  slot: string;
  rarity?: string;
  stats?: string[];
}

/**
 * Skill setup placeholder
 */
export interface SkillSetup {
  name: string;
  supportGems?: string[];
  slot?: string;
}

/**
 * Keystone node placeholder
 */
export interface KeystoneNode {
  name: string;
  stats?: string[];
}

/**
 * Notable node placeholder
 */
export interface NotableNode {
  name: string;
  stats?: string[];
}

/**
 * Ascendancy node placeholder
 */
export interface AscendancyNode {
  name: string;
  stats?: string[];
}

/**
 * Character identity and configuration metadata
 */
export interface CharacterMetadata {
  /** Character class (e.g., "Witch", "Shadow", "Ranger") */
  class: string;
  /** Ascendancy class (e.g., "Necromancer", "Trickster", null if not ascended) */
  ascendancy: string | null;
  /** Character level (1-100) */
  level: number;
  /** Bandit choice if available (e.g., "Kill All", "Alira", "Oak", "Kraityn") */
  bandit?: string | null;
  /** Pantheon selections if available */
  pantheon?: PantheonSelection;
}

/**
 * Pantheon god selections
 */
export interface PantheonSelection {
  /** Major pantheon god (e.g., "Solaris", "Lunaris", "Arakaali") */
  majorGod?: string | null;
  /** Minor pantheon god (e.g., "Gruthkul", "Shakari", "Abberath") */
  minorGod?: string | null;
}

/**
 * Mastery effect (passive mastery with selected bonus)
 */
export interface MasteryEffect {
  /** Mastery type (e.g., "Sword Mastery", "Life Mastery") */
  masteryType: string;
  /** Selected effect text */
  effect: string;
}

/**
 * Flask configuration and effects
 */
export interface FlaskConfiguration {
  /** Active flask items (Flask 1-5) */
  active: EquipmentItem[];
  /** Combined flask effects when active (parsed from flask mods) */
  effects: string[];
}

/**
 * Build configuration and assumptions
 */
export interface BuildConfiguration {
  /** Enemy type assumption (e.g., "Standard", "Shaper", "Sirus", "Pinnacle Boss") */
  enemyType: string;
  /** Active conditions/configurations (e.g., "Full Life", "Leeching", "Onslaught") */
  conditions: string[];
  /** Power charge count */
  powerCharges?: number;
  /** Frenzy charge count */
  frenzyCharges?: number;
  /** Endurance charge count */
  enduranceCharges?: number;
}

// TODO: StructuredBuildData interface needs to be reworked
// The previous implementation extended BuildSummary which has been removed.
// For now, we define a minimal placeholder that can be extended later.

/**
 * Minimal MainSkill placeholder
 * TODO: Replace with proper type from PoB raw data
 */
export interface MainSkillPlaceholder {
  name: string;
  supportGems?: string[];
}

/**
 * Minimal DefensiveStats placeholder
 * TODO: Replace with proper type from PoB raw data
 */
export interface DefensiveStatsPlaceholder {
  life: number;
  energyShield: number;
  fireResistance: number;
  coldResistance: number;
  lightningResistance: number;
  chaosResistance: number;
}

/**
 * Minimal OffensiveStats placeholder
 * TODO: Replace with proper type from PoB raw data
 */
export interface OffensiveStatsPlaceholder {
  dps: number;
}

/**
 * Structured skill configuration
 */
export interface SkillConfiguration {
  /** Primary DPS skill with full gem details */
  mainSkill: MainSkillPlaceholder | null;
  /** All other active skill setups (auras, curses, utility) */
  supportingSkills: SkillSetup[];
  /** Raw socket groups for item-skill mapping */
  socketGroups: SkillSetup[];
}

/**
 * Enhanced passive tree information with mastery tracking
 */
export interface PassiveConfiguration {
  /** Total passive nodes allocated */
  allocatedNodes: number;
  /** Keystone nodes with full metadata */
  keystones: KeystoneNode[];
  /** Notable nodes with full metadata */
  notables: NotableNode[];
  /** Ascendancy nodes with class info */
  ascendancyNodes: AscendancyNode[];
  /** Mastery effects (passive masteries with selected bonuses) */
  masteries: MasteryEffect[];
  /** Allocated node IDs for pathfinding (if available) */
  allocatedNodeIds?: number[];
  /** Passive tree version used for parsing */
  treeVersion?: string;
}

/**
 * StructuredBuildData Interface
 *
 * TODO: This is a placeholder that needs to be reworked to use raw PoB data.
 * The previous implementation extended BuildSummary which has been removed.
 */
export interface StructuredBuildData {
  /**
   * Character identity and configuration
   */
  character: CharacterMetadata;

  /**
   * Character level
   */
  level: number;

  /**
   * Character class
   */
  characterClass: string;

  /**
   * Ascendancy class
   */
  ascendancy: string | null;

  /**
   * All equipped items with stats
   */
  items: EquipmentItem[];

  /**
   * Equipment alias for compatibility
   */
  equipment: EquipmentItem[];

  /**
   * Skill configuration with main/supporting separation
   */
  skillConfig: SkillConfiguration;

  /**
   * Main skill reference
   */
  mainSkill: MainSkillPlaceholder | null;

  /**
   * Passive tree configuration with enriched details
   */
  passives: PassiveConfiguration;

  /**
   * Defensive statistics placeholder
   */
  defenses: DefensiveStatsPlaceholder;

  /**
   * Alias for defenses for compatibility
   */
  defensive: DefensiveStatsPlaceholder;

  /**
   * Offensive statistics placeholder
   */
  offense: OffensiveStatsPlaceholder;

  /**
   * Alias for offense for compatibility
   */
  offensive: OffensiveStatsPlaceholder;

  /**
   * Flask configuration
   */
  flasks: FlaskConfiguration;

  /**
   * Build configuration and assumptions
   */
  config: BuildConfiguration;
}

/**
 * Type guard to check if an object is StructuredBuildData
 * TODO: Update once StructuredBuildData is properly reworked
 */
export function isStructuredBuildData(build: unknown): build is StructuredBuildData {
  if (!build || typeof build !== 'object') return false;
  const b = build as Record<string, unknown>;
  return (
    'character' in b &&
    'skillConfig' in b &&
    'passives' in b &&
    'flasks' in b &&
    'config' in b
  );
}
