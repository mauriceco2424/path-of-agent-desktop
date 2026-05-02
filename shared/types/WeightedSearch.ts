/**
 * Weighted Trade Search Types
 *
 * Type definitions for the weighted trade search feature (search_trade_weighted tool).
 * This search uses PoB's built-in weight system to optimize item selection based on
 * stat priorities and calculates weighted sums for ranking results.
 *
 * Part of Spec XXX: Weighted Trade Search
 */

import type { TradeCurrency } from './SearchProfile';

// =============================================================================
// T001: Search Parameters
// =============================================================================

/**
 * Hard requirement for weighted search - must be present on item
 */
export interface WeightedSearchHardRequirement {
  /** Trade API stat ID (e.g., "explicit.stat_3299347043" for life) */
  id: string;
  /** Minimum value required */
  min?: number;
  /** Maximum value allowed */
  max?: number;
}

/**
 * Open affix requirements for crafting bases
 */
export interface WeightedSearchOpenAffixes {
  /** Number of open prefixes required (0-3) */
  prefix?: number;
  /** Number of open suffixes required (0-3) */
  suffix?: number;
}

/**
 * Stat weight configuration for PoB optimization
 */
export interface WeightedSearchStatWeight {
  /** PoB stat name (e.g., "FullDPS", "TotalEHP", "Life") */
  stat: string;
  /** Weight multiplier (default 1.0) */
  weightMult: number;
}

/**
 * Item constraints for weighted search
 */
export interface WeightedSearchConstraints {
  /** Specific base type (e.g., "Two-Stone Ring") */
  baseType?: string;
  /** Required influences (e.g., ["shaper", "elder"]) */
  influence?: string[];
  /** Minimum item level */
  itemLevel?: number;
  /** Corruption filter */
  corrupted?: boolean;
}

/**
 * Budget constraint
 */
export interface WeightedSearchBudget {
  /** Maximum price */
  max: number;
  /** Currency type */
  currency: TradeCurrency;
}

/**
 * Parameters for search_trade_weighted tool
 */
export interface WeightedSearchParams {
  /** Equipment slot (e.g., "ring", "helmet", "jewel") */
  slot: string;
  /** What PoB optimizes for (default: FullDPS) */
  statWeights?: WeightedSearchStatWeight[];
  /** Must-have requirements (added as "and" filter) */
  hardRequirements?: WeightedSearchHardRequirement[];
  /** Open affix requirements for crafting */
  openAffixes?: WeightedSearchOpenAffixes;
  /** Mod patterns to exclude from weighted sum */
  excludeModPatterns?: string[];
  /** Auto-exclude mods below this weight threshold */
  excludeModsBelowWeight?: number;
  /** Budget constraint (required) */
  budget: WeightedSearchBudget;
  /** Item constraints */
  constraints?: WeightedSearchConstraints;
  /** PoB build XML (required for weight calculation) */
  buildXml: string;
}

// =============================================================================
// T002: Search Results
// =============================================================================

/**
 * Individual item result from weighted search
 */
export interface WeightedSearchItem {
  /** Item name */
  name: string;
  /** Base type */
  baseType: string;
  /** Price */
  price: { amount: number; currency: string };
  /** Weighted sum value */
  weightedSum: number;
  /** Trade listing ID */
  listingId: string;
  /** PoB item text for import */
  pobItemText?: string;
}

/**
 * Mod weight info returned to LLM
 */
export interface WeightedSearchModInfo {
  /** Trade API stat ID */
  tradeModId: string;
  /** Display name for LLM */
  displayName?: string;
  /** Calculated weight */
  weight: number;
  /** Whether included in final query */
  included: boolean;
  /** Reason if excluded */
  excludeReason?: string;
}

/**
 * Validated item with PoB delta calculations
 */
export interface WeightedSearchValidatedItem {
  /** Item name */
  name: string;
  /** Price info */
  price: { amount: number; currency: string };
  /** Validation result from PoB */
  validation: {
    /** Absolute DPS change */
    dpsChange: number;
    /** Percentage DPS change */
    dpsPercentChange: number;
    /** Absolute EHP change */
    ehpChange: number;
    /** Percentage EHP change */
    ehpPercentChange: number;
    /** Overall verdict */
    verdict: 'upgrade' | 'sidegrade' | 'downgrade';
  };
}

/**
 * Response from search_trade_weighted tool
 */
export interface WeightedSearchResponse {
  /** Whether search succeeded */
  success: boolean;
  /** Trade site URL */
  tradeUrl: string;
  /** Result summary */
  results: {
    count: number;
    minPrice: number;
    medianPrice: number;
  };
  /** Top items found */
  items: WeightedSearchItem[];
  /** Mod weights for LLM explanation */
  modWeights: {
    included: WeightedSearchModInfo[];
    excluded: WeightedSearchModInfo[];
  };
  /** PoB validated items (if buildXml provided) */
  validatedItems?: WeightedSearchValidatedItem[];
  /** Human-readable guidance */
  guidance: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// T003: Internal Types (for service implementation)
// =============================================================================

/**
 * Mod weight mapping from PoB stat to Trade API stat
 */
export interface PoBToTradeModMapping {
  /** PoB stat name */
  pobStat: string;
  /** Trade API stat ID */
  tradeStatId: string;
  /** Weight calculated by PoB */
  weight: number;
  /** Human-readable display name */
  displayName: string;
}

/**
 * Query construction result
 */
export interface WeightedQueryConstruction {
  /** Success indicator */
  success: boolean;
  /** Constructed Trade API query */
  query?: Record<string, unknown>;
  /** Mods included in weighted sum */
  includedMods: PoBToTradeModMapping[];
  /** Mods excluded from weighted sum */
  excludedMods: PoBToTradeModMapping[];
  /** Error message if construction failed */
  error?: string;
}
