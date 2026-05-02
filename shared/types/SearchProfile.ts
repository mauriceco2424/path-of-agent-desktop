/**
 * SearchProfile Types
 *
 * Defines the schema for LLM-driven trade search requests.
 * The LLM specifies WHAT to search (stats, slot, budget, priorities).
 * The backend handles HOW to search (constraint tuning, result count convergence).
 *
 * Part of Trade Search Redesign (Spec 021 refinement)
 * Extended for Spec 023: Hybrid Iterative Trade Search
 */

import type { ScoringConfig } from './HybridTradeSearch';

/**
 * Individual stat filter with importance weighting
 */
export interface StatFilter {
  /** Trade API stat ID (e.g., "pseudo.pseudo_total_life") */
  stat: string;

  /** Initial minimum value for this stat */
  min: number;

  /**
   * Importance weight (0-1) for tuning order.
   * Higher importance = tuned last when tightening.
   * Lower importance = dropped first when loosening.
   * @default 0.5
   */
  importance?: number;
}

/**
 * Ranking priority determines which damage metric to use
 * and how to weight damage vs survivability
 */
export type RankingPriority =
  | 'hit_dps'   // For attack/spell hit builds (uses HitDPS/CombinedDPS)
  | 'dot_dps'   // For RF, poison, bleed, ignite builds (uses TotalDotDPS)
  | 'ehp'       // For tank builds (prioritizes survivability)
  | 'balanced'; // Weight both damage and survivability equally

/**
 * Item constraints beyond stats
 */
export interface ItemConstraints {
  /** Item rarity filter */
  rarity?: 'normal' | 'magic' | 'rare' | 'unique';

  /** Influence requirements (empty array or ["none"] for no influence) */
  influences?: string[];

  /** Minimum item level */
  itemLevelMin?: number;

  /** Corruption status */
  corrupted?: boolean;

  /** Minimum socket links */
  links?: number;
}

/**
 * Currency type for trade searches
 */
export type TradeCurrency = 'chaos' | 'divine' | 'exalt';

/**
 * Main search profile schema - LLM output for trade searches
 */
export interface SearchProfile {
  /**
   * Equipment slot to search for
   * Examples: "ring", "weapon.two", "body_armour", "helmet"
   */
  slot: string;

  /**
   * Maximum budget amount (used with currency field)
   */
  budget: number;

  /**
   * Currency for the budget (chaos, divine, or exalt)
   * Trade API natively supports these currencies - no conversion needed.
   * @default 'chaos'
   */
  currency: TradeCurrency;

  /**
   * @deprecated Use budget + currency instead.
   * Maximum budget in chaos orbs (legacy, kept for backwards compatibility)
   */
  budgetChaos?: number;

  /**
   * Essential stats - never dropped during loosening, only tuned.
   * These are the core requirements for the upgrade.
   */
  mustHave: StatFilter[];

  /**
   * Optional stats - dropped first when no results found.
   * Ordered by importance (least important first to be dropped).
   */
  niceToHave: StatFilter[];

  /**
   * If true, run in preview/count-only mode so the LLM can decide how to adjust.
   * When true, no item fetch or ranking is performed.
   */
  preview?: boolean;

  /**
   * When true, disable automatic tuning/relaxation in the backend.
   * The LLM controls filter adjustments across iterations.
   */
  llmTuning?: boolean;

  /**
   * Mod patterns to exclude from search results.
   * Examples: ["reduced_life", "cannot_roll_attack_mods"]
   */
  avoid?: string[];

  /**
   * Additional item constraints (rarity, influence, etc.)
   */
  constraints?: ItemConstraints;

  /**
   * How to score and rank results.
   * Determines which damage metric to use and weighting.
   */
  rankingPriority: RankingPriority;

  /**
   * Advanced scoring configuration for hybrid trade search (Spec 023).
   * When provided, enables precise control over DPS metric selection
   * and DPS/EHP weighting for upgrade scoring.
   *
   * If not provided, rankingPriority is used to derive default weights:
   * - hit_dps: { dpsWeight: 0.8, ehpWeight: 0.2 }
   * - dot_dps: { dpsWeight: 0.8, ehpWeight: 0.2 }
   * - ehp: { dpsWeight: 0.2, ehpWeight: 0.8 }
   * - balanced: { dpsWeight: 0.5, ehpWeight: 0.5 }
   */
  scoring?: ScoringConfig;
}

/**
 * Result of the adaptive search process
 */
export interface AdaptiveSearchResult {
  /** Whether the search was successful */
  success: boolean;

  /** Total results found after tuning */
  totalResults: number;

  /** Number of iterations required for convergence */
  iterations: number;

  /** What filters were adjusted during tuning */
  adjustments: SearchAdjustment[];

  /** Quality indicator for the search */
  resultQuality: 'precise' | 'broad' | 'relaxed' | 'none';

  /** General trade URL for all results */
  tradeUrl: string;

  /** Human-readable search intent for transparency */
  searchIntent: string;

  /** Error message if search failed */
  error?: string;

  /** Suggestions if no results found */
  suggestions?: string[];
}

/**
 * Record of a single adjustment made during tuning
 */
export interface SearchAdjustment {
  /** Type of adjustment */
  type: 'tighten' | 'loosen' | 'drop';

  /** Which stat was affected */
  stat: string;

  /** Previous value (undefined if stat was dropped) */
  previousValue?: number;

  /** New value (undefined if stat was dropped) */
  newValue?: number;

  /** Reason for adjustment */
  reason: string;
}

/**
 * Scored item from Tier 1 heuristic scoring
 */
export interface HeuristicScoredItem {
  /** Raw trade listing data */
  listing: unknown; // Will be typed more specifically during implementation

  /** Heuristic score (higher = better value) */
  heuristicScore: number;

  /** Price in chaos */
  priceChaos: number;

  /** Parsed stats from listing */
  parsedStats: Record<string, number>;
}

/**
 * Final ranked item after PoB simulation (Tier 2)
 */
export interface RankedTradeItem {
  /** Raw trade listing data */
  listing: unknown;

  /** Final efficiency score (higher = better value) */
  efficiencyScore: number;

  /** Price in chaos */
  priceChaos: number;

  /** DPS change percentage (uses appropriate metric based on archetype) */
  dpsChangePercent: number;

  /** EHP change percentage */
  ehpChangePercent: number;

  /** Whether the build can equip this item */
  canEquip: boolean;

  /** Missing attributes if can't equip */
  missingAttributes?: {
    str?: number;
    dex?: number;
    int?: number;
  };

  /** Targeted trade URL for this specific item (narrow price range) */
  targetedTradeUrl: string;

  /** Full comparison data from PoB simulation (optional when Tier 2 is skipped) */
  comparisonData?: unknown; // Will reference existing TradeComparison types
}

/**
 * Complete response from the adaptive trade search system
 */
export interface AdaptiveTradeSearchResponse {
  /** Whether the search was successful */
  success: boolean;

  /** Adaptive search metadata (constraint tuning info) */
  adaptiveResult: AdaptiveSearchResult;

  /** Top ranked items after full PoB simulation */
  rankedItems: RankedTradeItem[];

  /** General trade URL for browsing all results */
  tradeUrl: string;

  /** Human-readable message about the search results */
  message: string;

  /** Preview/count-only mode indicator */
  preview?: boolean;

  /** Suggestions if no or few results found */
  suggestions?: string[];

  /** Number of items scored in Tier 1 */
  tier1Count?: number;

  /** Number of items ranked in Tier 2 */
  tier2Count?: number;

  /** Time taken for the full search process (ms) */
  totalTimeMs?: number;
}
