/**
 * Hybrid Trade Search Types
 *
 * Core type definitions for the two-tier hybrid iterative trade search system.
 * - LLM Layer: Strategic control (scoring weights, iteration decisions)
 * - Backend Layer: Tactical execution (parameter sweeping, convergence)
 *
 * Part of Spec 023: Hybrid Iterative Trade Search
 */

// Import shared types from SearchProfile to avoid duplication
import type {
  ItemConstraints,
  TradeCurrency,
} from './SearchProfile';

// =============================================================================
// T001: Core Types (DpsMetricType, ScoringConfig, StatPriority, PreviousIteration)
// =============================================================================

/**
 * DPS metrics available for scoring
 * LLM selects based on build archetype during strategy formulation
 */
export type DpsMetricType =
  | 'HitDPS'           // Standard attack/spell hit builds
  | 'CombinedDPS'      // Mixed damage builds
  | 'TotalDotDPS'      // Generic DoT (RF, etc.)
  | 'TotalPoisonDPS'   // Poison builds
  | 'IgniteDPS'        // Ignite builds
  | 'BleedDPS'         // Bleed builds
  | 'ColdDotDPS';      // Cold DoT (Vortex, etc.)

/**
 * Scoring configuration from LLM
 * Weights must sum to 1.0
 */
export interface ScoringConfig {
  /** Which DPS metric to use for damage scoring */
  dpsMetric: DpsMetricType;

  /** Weight for DPS component (0-1) */
  dpsWeight: number;

  /** Weight for EHP component (0-1) */
  ehpWeight: number;
}

/**
 * Individual stat priority with importance weighting
 * Used by LLM to specify search requirements
 */
export interface StatPriority {
  /** Human-readable stat name (LLM's vocabulary) */
  stat: string;

  /** Desired minimum value */
  targetValue: number;

  /** Importance weight (0-1) for sweep ordering */
  weight: number;

  /** If true, never loosen below targetValue */
  mandatory: boolean;
}

/**
 * Context from a previous iteration (for cumulative learning)
 */
export interface PreviousIteration {
  /** Iteration number (1-7) */
  iterationNumber: number;

  /** Parameters sent in that iteration */
  parametersSent: Record<string, number>;

  /** Number of results returned */
  resultCount: number;

  /** Best price found (in user's currency) */
  bestPrice: number;

  /** Best upgrade score found */
  bestScore: number;

  /** Outcome of that iteration */
  outcome: 'continue' | 'pivoted' | 'exhausted';
}

// =============================================================================
// T002: LLMIterationRequest
// =============================================================================

/**
 * LLM's request for one iteration of trade search
 * Contains strategic parameters, not raw Trade API filters
 */
export interface LLMIterationRequest {
  /** Unique iteration ID within this search session (1-7) */
  iterationNumber: number;

  /** Equipment slot to search */
  slot: string;

  /** Budget amount */
  budget: number;

  /** Currency for budget (chaos, divine, exalt) */
  currency: TradeCurrency;

  /**
   * Stat priorities with relative importance
   * Higher weight = more important, don't loosen first
   */
  statPriorities: StatPriority[];

  /** Scoring configuration for upgrade quality */
  scoring: ScoringConfig;

  /** Context from previous iterations (for cumulative learning) */
  previousIterations: PreviousIteration[];

  /** Optional constraints */
  constraints?: ItemConstraints;

  /** PoB build XML for delta calculations (optional, may use session) */
  buildXml?: string;
}

// =============================================================================
// T003: SweepStep and SweepHistory
// =============================================================================

/**
 * Price info with amount and currency
 */
export interface PriceInfo {
  amount: number;
  currency: string;
}

/**
 * One step of the backend parameter sweep
 */
export interface SweepStep {
  /** Step number within sweep (1-5) */
  step: number;

  /** Current filter thresholds used */
  thresholds: Record<string, number>;

  /** Results from this query */
  resultCount: number;

  /** Cheapest item info (first in price-sorted results) */
  cheapest: {
    price: PriceInfo;
    upgradeScore: number;
  } | null;

  /** Most expensive item info (last in fetched results) */
  mostExpensive: {
    price: PriceInfo;
    upgradeScore: number;
  } | null;

  /** What action was taken based on results */
  action: 'initial' | 'tighten' | 'loosen' | 'converged' | 'exhausted';

  /** Adjustment details if action was tighten/loosen */
  adjustment?: {
    stat: string;
    previousValue: number;
    newValue: number;
    reason: string;
  };
}

/**
 * Summary of sweep for LLM decision-making
 */
export interface SweepSummary {
  /** Price range of results */
  priceRange: { min: number; max: number; currency: string };

  /** Score range of results */
  scoreRange: { min: number; max: number };

  /** Best score and its price point */
  bestScoreAtPrice: { score: number; price: number };

  /** Budget utilization (0-1, bestPrice / budget) */
  budgetUtilization: number;
}

/**
 * Final state after sweep completion
 */
export interface SweepFinalState {
  /** Whether target range (20-50) was reached */
  converged: boolean;

  /** Whether max iterations (5) were exhausted */
  exhausted: boolean;

  /** Total number of sweep steps taken */
  totalSteps: number;

  /** Final filter thresholds used */
  finalThresholds: Record<string, number>;
}

/**
 * Complete sweep history returned to LLM
 */
export interface SweepHistory {
  /** All sweep steps taken */
  steps: SweepStep[];

  /** Final state */
  finalState: SweepFinalState;

  /** Summary for LLM decision-making */
  summary: SweepSummary;
}

// =============================================================================
// T004: UpgradeScore
// =============================================================================

/**
 * DPS change component with full breakdown
 */
export interface DpsChangeComponent {
  /** Which DPS metric was used */
  metric: DpsMetricType;

  /** DPS value before equipping item */
  before: number;

  /** DPS value after equipping item */
  after: number;

  /** Percentage change ((after - before) / before * 100) */
  percentChange: number;

  /** Weighted contribution to final score */
  weightedContribution: number;
}

/**
 * EHP change component with full breakdown
 */
export interface EhpChangeComponent {
  /** EHP value before equipping item */
  before: number;

  /** EHP value after equipping item */
  after: number;

  /** Percentage change */
  percentChange: number;

  /** Weighted contribution to final score */
  weightedContribution: number;
}

/**
 * Quality classification for upgrades
 */
export type UpgradeQuality =
  | 'significant'  // score >= 15%
  | 'moderate'     // score >= 5%
  | 'marginal'     // score > 0%
  | 'sidegrade'    // score === 0%
  | 'downgrade';   // score < 0%

/**
 * Upgrade score for one item
 * Based on weighted composite of DPS% and EHP% changes
 */
export interface UpgradeScore {
  /** Final composite score */
  score: number;

  /** Component breakdown */
  components: {
    dpsChange: DpsChangeComponent;
    ehpChange: EhpChangeComponent;
  };

  /** Weights used (from ScoringConfig) */
  weights: {
    dps: number;
    ehp: number;
  };

  /** Qualitative assessment */
  quality: UpgradeQuality;
}

// =============================================================================
// T005: PoBDelta
// =============================================================================

/**
 * Single stat change with before/after values
 */
export interface StatChange {
  before: number;
  after: number;
  change: number;
  changePercent: number;
  /** Alias used by some UI components */
  percentChange?: number;
}

/**
 * PoB delta calculation result
 */
export interface PoBDelta {
  /** Whether calculation succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Timing */
  calculationTimeMs: number;

  /** DPS values (multiple metrics) */
  dps: {
    HitDPS: StatChange;
    TotalDotDPS: StatChange;
    CombinedDPS: StatChange;
    TotalPoisonDPS?: StatChange;
    IgniteDPS?: StatChange;
    BleedDPS?: StatChange;
    ColdDotDPS?: StatChange;
  };

  /** EHP values */
  ehp: {
    TotalEHP: StatChange;
    PhysicalMaxHit: StatChange;
    ElementalMaxHit: StatChange;
  };

  /** Key stat changes from session stat subset */
  keyStatChanges: Array<{
    stat: string;
    before: number;
    after: number;
    change: number;
    changePercent: number;
  }>;

  /** Can the build equip this item? */
  canEquip: boolean;

  /** Missing requirements if can't equip */
  missingRequirements?: {
    str?: number;
    dex?: number;
    int?: number;
  };
}

// =============================================================================
// T006: BudgetContext
// =============================================================================

/**
 * Budget recommendation action
 */
export type BudgetRecommendationAction = 'continue' | 'stop' | 'pivot';

/**
 * Budget recommendation with reasoning
 */
export interface BudgetRecommendation {
  action: BudgetRecommendationAction;
  reason: string;
}

/**
 * Helpful context for budget decisions
 */
export interface BudgetDecisionContext {
  /** < 50% of budget utilized */
  isSignificantlyUnderBudget: boolean;

  /** Found upgrade with score >= 5% */
  hasGoodUpgrade: boolean;

  /** Sweep found items above current price point */
  marketHasHigherOptions: boolean;
}

/**
 * Budget context for iteration decisions
 */
export interface BudgetContext {
  /** User's specified budget */
  userBudget: PriceInfo;

  /** Best item found */
  bestFound: PriceInfo | null;

  /** Budget utilization (0-1) */
  utilization: number;

  /** Recommendation for LLM */
  recommendation: BudgetRecommendation;

  /** Helpful context */
  context: BudgetDecisionContext;
}

// =============================================================================
// T007: BackendSweepResult
// =============================================================================

/**
 * Single trade item with full scoring data
 */
export interface TradeItem {
  /** Item identification */
  name: string;
  baseType: string;

  /** Price info */
  price: PriceInfo;
  priceChaos: number;  // Normalized for comparison

  /** Upgrade evaluation */
  upgradeScore: UpgradeScore;
  pobDelta: PoBDelta | null;  // null if calculation timed out

  /** Item mods */
  mods: string[];

  /** Trade link for this specific item */
  targetedTradeUrl: string;
}

/**
 * Retry guidance for failed requests
 * T045: Provides actionable retry information
 */
export interface RetryGuidance {
  /** Whether retry is recommended */
  recommended: boolean;

  /** Seconds to wait before retry */
  afterSeconds?: number;

  /** Maximum retry attempts */
  maxAttempts?: number;
}

/**
 * Backend response to LLM iteration request
 */
export interface BackendSweepResult {
  /** Success status */
  success: boolean;

  /** Error if failed */
  error?: string;

  /** Error type category for programmatic handling */
  errorType?: 'rate_limit' | 'server_error' | 'network_error' | 'validation' | 'no_results' | 'unknown_stat' | 'unknown';

  /** Retry guidance if error occurred (T045) */
  retryGuidance?: RetryGuidance;

  /** Iteration this responds to */
  iterationNumber: number;

  /** Sweep history showing what was tried */
  sweepHistory: SweepHistory;

  /** Final results (limited to top N by score) */
  items: TradeItem[];

  /** Budget context for LLM decision */
  budgetContext: BudgetContext;

  /** General trade URL */
  tradeUrl: string;

  /** Timing */
  totalTimeMs: number;

  /** Suggestions if no results or poor results */
  suggestions?: string[];

  /** Number of PoB delta calculations that failed (T046) */
  pobFailures?: number;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates that scoring weights sum to 1.0
 */
export function validateScoringConfig(config: ScoringConfig): boolean {
  const sum = config.dpsWeight + config.ehpWeight;
  return Math.abs(sum - 1.0) < 0.001 &&
         config.dpsWeight >= 0 && config.dpsWeight <= 1 &&
         config.ehpWeight >= 0 && config.ehpWeight <= 1;
}

/**
 * Determines upgrade quality from score
 */
export function getUpgradeQuality(score: number): UpgradeQuality {
  if (score >= 15) return 'significant';
  if (score >= 5) return 'moderate';
  if (score > 0) return 'marginal';
  if (score === 0) return 'sidegrade';
  return 'downgrade';
}
