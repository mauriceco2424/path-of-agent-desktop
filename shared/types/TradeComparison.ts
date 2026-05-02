/**
 * Trade Item Stat Comparison - Type Contracts
 *
 * Feature: 020-trade-item-comparison
 * Date: 2025-11-25
 *
 * These types define the contract for stat comparison data attached to trade results.
 * All types are backward compatible with existing TradeToolResult structure.
 */

// =============================================================================
// Curated Stats (~49 key stats from 651)
// =============================================================================

/**
 * Curated subset of PoB stats for LLM context efficiency.
 * Organized by category for structured reasoning.
 */
export interface CuratedStats {
  /** Core Resource Pools (5 stats) */
  pools: {
    Life: number;
    EnergyShield: number;
    Mana: number;
    Ward: number;
    TotalEHP: number;
  };

  /** DPS Variants (10 stats) */
  dps: {
    CombinedDPS: number;
    TotalDPS: number;
    TotalDotDPS: number;
    HitDPS: number;
    WithIgniteDPS: number;
    WithPoisonDPS: number;
    WithBleedDPS: number;
    WithImpaleDPS: number;
    AverageDamage: number;
    FullDPS: number;
  };

  /** Elemental Resistances (7 stats) */
  resistances: {
    FireResist: number;
    ColdResist: number;
    LightningResist: number;
    ChaosResist: number;
    FireResistOverCap: number;
    ColdResistOverCap: number;
    LightningResistOverCap: number;
  };

  /** Physical Defense (3 stats) */
  physicalDefense: {
    Armour: number;
    PhysicalDamageReduction: number;
    Evasion: number;
  };

  /** Avoidance (4 stats) */
  avoidance: {
    BlockChance: number;
    SpellBlockChance: number;
    EvadeChance: number;
    SpellSuppressionChance: number;
  };

  /** Maximum Hit Survivability (5 stats) */
  maxHitTaken: {
    PhysicalMaximumHitTaken: number;
    FireMaximumHitTaken: number;
    ColdMaximumHitTaken: number;
    LightningMaximumHitTaken: number;
    ChaosMaximumHitTaken: number;
  };

  /** Recovery (6 stats) */
  recovery: {
    LifeRegen: number;
    EnergyShieldRegen: number;
    ManaRegen: number;
    LifeLeech: number;
    EnergyShieldLeech: number;
    LifeOnHit: number;
  };

  /** Offensive Modifiers (6 stats) */
  offense: {
    CritChance: number;
    CritMultiplier: number;
    HitChance: number;
    Speed: number;
    Accuracy: number;
    MovementSpeed: number;
  };

  /** Core Attributes (3 stats) */
  attributes: {
    Str: number;
    Dex: number;
    Int: number;
  };
}

// =============================================================================
// Stat Deltas
// =============================================================================

/**
 * Represents the change in a single stat.
 */
export interface StatDelta {
  /** Absolute change: modified - baseline */
  absolute: number;

  /** Percentage change: ((modified - baseline) / baseline) * 100 */
  percent: number;

  /** Whether this change is beneficial for the build */
  improved: boolean;
}

/**
 * Stat deltas matching CuratedStats structure.
 */
export interface CuratedStatDeltas {
  pools: Record<keyof CuratedStats['pools'], StatDelta>;
  dps: Record<keyof CuratedStats['dps'], StatDelta>;
  resistances: Record<keyof CuratedStats['resistances'], StatDelta>;
  physicalDefense: Record<keyof CuratedStats['physicalDefense'], StatDelta>;
  avoidance: Record<keyof CuratedStats['avoidance'], StatDelta>;
  maxHitTaken: Record<keyof CuratedStats['maxHitTaken'], StatDelta>;
  recovery: Record<keyof CuratedStats['recovery'], StatDelta>;
  offense: Record<keyof CuratedStats['offense'], StatDelta>;
  attributes: Record<keyof CuratedStats['attributes'], StatDelta>;
}

// =============================================================================
// Comparison Summary
// =============================================================================

/**
 * Single stat change entry for summary lists.
 */
export interface StatChangeEntry {
  /** Stat name (e.g., "Life", "CombinedDPS") */
  stat: string;

  /** Category name (e.g., "pools", "dps") */
  category: string;

  /** Absolute change value */
  absolute: number;

  /** Percentage change */
  percent: number;
}

/**
 * Resistance status changes.
 */
export interface ResistanceStatus {
  /** Fire resistance change */
  fireChange: number;

  /** Cold resistance change */
  coldChange: number;

  /** Lightning resistance change */
  lightningChange: number;

  /** Chaos resistance change */
  chaosChange: number;

  /** Whether any resistance dropped below cap (75%) */
  anyDroppedBelowCap: boolean;
}

/**
 * Attribute requirement status for an item.
 */
export interface AttributeRequirementStatus {
  /** Whether the build can equip this item */
  canEquip: boolean;

  /** Missing Strength to equip (0 if can equip) */
  missingStr: number;

  /** Missing Dexterity to equip (0 if can equip) */
  missingDex: number;

  /** Missing Intelligence to equip (0 if can equip) */
  missingInt: number;

  /** Details message for LLM context */
  message?: string;
}

/**
 * Per-skill DPS data for comparison context.
 * Lets LLM see exactly how each skill's damage changes.
 */
export interface SkillDpsData {
  /** Skill name */
  name: string;
  /** Total DPS for this skill */
  totalDps: number;
  /** Combined DPS (hit + dot) */
  combinedDps: number;
  /** Hit-only DPS */
  hitDps: number;
  /** DoT DPS */
  dotDps: number;
}

/**
 * Condensed comparison summary for quick LLM assessment.
 */
export interface ComparisonSummary {
  /** Main skill name from PoB (e.g., "Earthshatter", "Lightning Arrow") */
  mainSkillName?: string;

  /** Per-skill DPS data for baseline build */
  baselineSkillDps?: SkillDpsData[];

  /** Per-skill DPS data for modified build (with trade item equipped) */
  modifiedSkillDps?: SkillDpsData[];

  /** Top 5 stat improvements (sorted by significance) */
  topGains: StatChangeEntry[];

  /** Top 5 stat losses (sorted by significance) */
  topLosses: StatChangeEntry[];

  /** Net CombinedDPS change */
  netDpsChange: number;

  /** Net CombinedDPS percentage change */
  netDpsPercent: number;

  /** Net TotalEHP change */
  netEhpChange: number;

  /** Net TotalEHP percentage change */
  netEhpPercent: number;

  /** Net Life change */
  netLifeChange: number;

  /** Net Life percentage change */
  netLifePercent: number;

  /** Resistance cap status */
  resistanceStatus: ResistanceStatus;

  /** Attribute requirement status (whether build can equip the item) */
  attributeStatus?: AttributeRequirementStatus;

  // === DPS Breakdown Awareness (Spec 020) ===

  /** Hit DPS absolute change (optional for archetype-aware analysis) */
  hitDpsChange?: number;

  /** Hit DPS percentage change (optional) */
  hitDpsPercent?: number;

  /** DoT DPS absolute change (optional for archetype-aware analysis) */
  dotDpsChange?: number;

  /** DoT DPS percentage change (optional) */
  dotDpsPercent?: number;

  /** Primary DPS type for this build ('hit' or 'dot') */
  primaryDpsType?: 'hit' | 'dot';
}

// =============================================================================
// Complete Comparison Result
// =============================================================================

/** Verdict for item comparison */
export type ComparisonVerdict = 'upgrade' | 'downgrade' | 'sidegrade';

/** Grade classification for trade items based on DPS×EHP score improvement */
export type TradeGrade = 'S' | 'A' | 'B' | 'C' | 'F';

/**
 * Complete stat comparison for a single trade item.
 * Attached to TradeItemDisplay.comparison field.
 */
export interface CuratedStatComparison {
  /** Whether comparison was successfully calculated */
  comparisonAvailable: boolean;

  /** Error message if comparison failed */
  error?: string;

  /** Baseline stats (current equipped item or empty slot) */
  baseline?: CuratedStats;

  /** Modified stats (with trade item equipped) */
  modified?: CuratedStats;

  /** Calculated differences */
  deltas?: CuratedStatDeltas;

  /** Condensed summary for quick LLM reference */
  summary?: ComparisonSummary;

  /** Overall verdict */
  verdict?: ComparisonVerdict;

  /** Slot name used for comparison */
  slotName?: string;

  // ==========================================================================
  // DPS×EHP Scoring Fields (added for trade item ranking)
  // ==========================================================================

  /** Rank among compared items (1 = best, 2 = second best, etc.) */
  rank?: number;

  /** Grade classification based on score improvement (S/A/B/C/F) */
  grade?: TradeGrade;

  /** Absolute score change (DPS×EHP composite) */
  scoreDelta?: number;

  /** Percentage change in composite score */
  scorePercent?: number;

  /** Percentage change in DPS only */
  dpsPercent?: number;

  /** Percentage change in EHP only */
  ehpPercent?: number;

  /** Whether the build meets attribute requirements to equip this item */
  canEquip?: boolean;

  /** Warning message if item cannot be equipped (e.g., "Missing 20 Str") */
  equipWarning?: string;
}

// =============================================================================
// Comparison Metadata
// =============================================================================

/**
 * Metadata about the comparison process for a trade search.
 */
export interface ComparisonMeta {
  /** Number of items comparison was attempted for */
  itemsCompared: number;

  /** Number of successful comparisons */
  successfulComparisons: number;

  /** Total time taken for all comparisons (milliseconds) */
  comparisonTimeMs: number;

  /** Whether comparison was attempted */
  comparisonAttempted: boolean;

  /** Reason if comparison was not attempted or skipped */
  skipReason?: string;

  /**
   * Build interpretation hint for LLM (Spec 020, T025)
   * Tells LLM which DPS metric to prioritize based on build archetype
   */
  buildHint?: string;
}

// =============================================================================
// Service Interfaces
// =============================================================================

/**
 * Request to compare trade items against build.
 */
export interface TradeComparisonRequest {
  /** Build XML for comparison baseline */
  buildXml: string;

  /** Slot to use for comparison (e.g., "Helmet", "Body Armour") */
  slotName: string;

  /** Maximum number of items to compare (default: 3) */
  maxItems?: number;
}

/**
 * Result of trade item comparison.
 */
export interface TradeComparisonResult {
  /** Comparison metadata */
  meta: ComparisonMeta;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * List of all key stat names organized by category.
 * Used by StatCurator to extract curated stats.
 */
export const KEY_STAT_NAMES = {
  pools: ['Life', 'EnergyShield', 'Mana', 'Ward', 'TotalEHP'] as const,

  dps: [
    'CombinedDPS',
    'TotalDPS',
    'TotalDotDPS',
    'HitDPS',
    'WithIgniteDPS',
    'WithPoisonDPS',
    'WithBleedDPS',
    'WithImpaleDPS',
    'AverageDamage',
    'FullDPS',
  ] as const,

  resistances: [
    'FireResist',
    'ColdResist',
    'LightningResist',
    'ChaosResist',
    'FireResistOverCap',
    'ColdResistOverCap',
    'LightningResistOverCap',
  ] as const,

  physicalDefense: ['Armour', 'PhysicalDamageReduction', 'Evasion'] as const,

  avoidance: [
    'BlockChance',
    'SpellBlockChance',
    'EvadeChance',
    'SpellSuppressionChance',
  ] as const,

  maxHitTaken: [
    'PhysicalMaximumHitTaken',
    'FireMaximumHitTaken',
    'ColdMaximumHitTaken',
    'LightningMaximumHitTaken',
    'ChaosMaximumHitTaken',
  ] as const,

  recovery: [
    'LifeRegen',
    'EnergyShieldRegen',
    'ManaRegen',
    'LifeLeech',
    'EnergyShieldLeech',
    'LifeOnHit',
  ] as const,

  offense: [
    'CritChance',
    'CritMultiplier',
    'HitChance',
    'Speed',
    'Accuracy',
    'MovementSpeed',
  ] as const,

  attributes: ['Str', 'Dex', 'Int'] as const,
} as const;

/** Total number of curated stats */
export const CURATED_STAT_COUNT = 49;

/** Default number of items to compare per trade search */
export const DEFAULT_MAX_COMPARISON_ITEMS = 30;

/** Maximum time budget for comparisons (milliseconds) */
export const COMPARISON_TIME_BUDGET_MS = 5000;

/** Resistance cap threshold (75% for elemental, varies for chaos) */
export const RESISTANCE_CAP = 75;
