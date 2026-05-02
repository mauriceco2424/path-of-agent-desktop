/**
 * Item Comparison Types
 *
 * Types for comparing items and analyzing stat differences
 * Part of Spec 009 Phase 2.1 - Item Comparison Diff Calculator
 */

/**
 * Key statistics extracted from full calculations
 * Used for baseline and comparison snapshots
 */
export interface KeyStats {
  /** Effective Hit Pool (universal survivability metric) */
  ehp: number;

  /** Combined DPS (hit + DoT) */
  combinedDPS: number;

  /** Maximum life */
  life: number;

  /** Maximum energy shield */
  energyShield: number;

  /** Armour rating */
  armour: number;

  /** Evasion rating */
  evasion: number;

  /** Fire resistance */
  fireRes: number;

  /** Cold resistance */
  coldRes: number;

  /** Lightning resistance */
  lightningRes: number;

  /** Chaos resistance */
  chaosRes: number;

  /** Maximum physical hit that can be taken */
  physicalMaxHit: number;

  /** Maximum fire hit that can be taken */
  fireMaxHit: number;

  /** Maximum cold hit that can be taken */
  coldMaxHit: number;

  /** Maximum lightning hit that can be taken */
  lightningMaxHit: number;

  /** Maximum chaos hit that can be taken */
  chaosMaxHit: number;
}

/**
 * Numeric stat difference with absolute and percentage changes
 */
export interface NumericDiff {
  /** Absolute difference (new - old) */
  absolute: number;

  /** Percentage change ((new - old) / old * 100) */
  percentage: number;
}

/**
 * Resistance stat difference with capped status
 */
export interface ResistanceDiff {
  /** Absolute difference in resistance value */
  absolute: number;

  /** Whether resistance is capped (≥75%) in both baseline and modified */
  capped: boolean;
}

/**
 * Complete stat differences between baseline and modified build
 */
export interface StatDiffs {
  // Survivability
  ehp: NumericDiff;
  life: NumericDiff;
  energyShield: NumericDiff;
  armour: NumericDiff;
  evasion: NumericDiff;
  physicalMaxHit: NumericDiff;
  fireMaxHit: NumericDiff;
  coldMaxHit: NumericDiff;
  lightningMaxHit: NumericDiff;
  chaosMaxHit: NumericDiff;

  // Damage
  combinedDPS: NumericDiff;

  // Resistances
  fireRes: ResistanceDiff;
  coldRes: ResistanceDiff;
  lightningRes: ResistanceDiff;
  chaosRes: ResistanceDiff;
}

/**
 * Item recommendation verdict
 */
export type ItemVerdict = 'upgrade' | 'sidegrade' | 'downgrade';

/**
 * AI-generated recommendation for item swap
 */
export interface ItemRecommendation {
  /** Overall verdict on whether to use the new item */
  verdict: ItemVerdict;

  /** Positive changes (improvements) */
  pros: string[];

  /** Negative changes (downgrades or warnings) */
  cons: string[];
}

/**
 * Complete item comparison result
 */
export interface ItemComparisonResult {
  /** Baseline build stats (before item change) */
  baseline: KeyStats;

  /** Modified build stats (after item change) */
  withNewItem: KeyStats;

  /** Statistical differences between baseline and modified */
  diffs: StatDiffs;

  /** AI-generated recommendation */
  recommendation: ItemRecommendation;
}

/**
 * Request parameters for item comparison
 */
export interface ItemComparisonRequest {
  /** Base64-encoded PoB build XML */
  baselineBuildXml: string;

  /** Item text to add (from PoB or in-game) */
  newItemText: string;

  /** Slot to equip item in (e.g., "Body Armour", "Weapon 1") */
  slotName: string;
}

// =============================================================================
// Batch Validation Types (Trade Search Optimization)
// =============================================================================

/**
 * Trade item candidate for batch validation
 * Represents an item returned from trade search that needs PoB validation
 */
export interface TradeItemCandidate {
  /** Trade item ID */
  id: string;

  /** Full item text for PoB (from trade API) */
  itemText: string;

  /** Item price */
  price: {
    amount: number;
    currency: string;
  };

  /** Trade website URL */
  tradeUrl: string;
}

/**
 * Input for batch validation of trade items
 */
export interface BatchValidationInput {
  /** Build ID to load baseline from storage */
  buildId: string;

  /** Equipment slot to test (trade format: "ring1", "helmet", "body-armour") */
  slot: string;

  /** Items to validate */
  items: TradeItemCandidate[];

  /** Maximum items to validate (default: 10) */
  limit?: number;

  /** Custom scoring weights for DPS vs EHP (each 0-1, default 0.5/0.5) */
  scoringWeights?: { dps: number; ehp: number };
}

/**
 * PoB delta calculation for a single item (simplified version for batch validation)
 *
 * Note: This is a simpler version than HybridTradeSearch.PoBDelta which has
 * detailed per-skill DPS breakdowns. This version focuses on summary stats
 * for quick batch validation.
 */
export interface BatchPoBDelta {
  /** DPS comparison */
  dps: {
    before: number;
    after: number;
    percentChange: number;
  };

  /** EHP comparison */
  ehp: {
    before: number;
    after: number;
    percentChange: number;
  };

  /** Resistance changes (only included if significant) */
  resistances?: {
    fire?: { before: number; after: number };
    cold?: { before: number; after: number };
    lightning?: { before: number; after: number };
    chaos?: { before: number; after: number };
  };
}

/**
 * A validated item with PoB calculations
 */
export interface ValidatedItem {
  /** Trade item ID */
  id: string;

  /** Full item text */
  itemText: string;

  /** Item price */
  price: {
    amount: number;
    currency: string;
  };

  /** Trade website URL */
  tradeUrl: string;

  /** PoB calculation results */
  pobDelta: BatchPoBDelta;

  /** Overall verdict */
  verdict: ItemVerdict;

  /** Human-readable reasons for the verdict */
  reasons: string[];

  /** Combined score for sorting (higher = better) */
  score: number;

  /** Time taken to validate this item in ms */
  validationTimeMs?: number;

  /** Error message if validation failed */
  error?: string;
}

/**
 * Result of batch validation
 */
export interface BatchValidationResult {
  /** Validated items sorted by score (best first) */
  validatedItems: ValidatedItem[];

  /** Baseline stats before any item changes */
  baseline: {
    dps: number;
    ehp: number;
  };

  /** Total time for batch validation in ms */
  elapsedMs: number;

  /** Number of items that failed validation */
  failedCount: number;

  /** Items that failed validation (for debugging) */
  failedItems?: Array<{
    id: string;
    error: string;
  }>;
}
