/**
 * Trade Search Instruction Types for Desktop Execution
 *
 * These types define the interface between the backend LLM tools and the
 * desktop application. Instead of executing Trade API calls directly,
 * the backend returns "search instructions" that the desktop app executes.
 *
 * This enables:
 * - Desktop app to use user's POESESSID for authenticated requests
 * - Better rate limiting per user
 * - Offline mode detection
 * - Future: local caching of trade results
 */

/**
 * Individual stat requirement for trade search
 */
export interface StatRequirement {
  /** Trade API stat ID (e.g., "explicit.stat_3299347043" for life) */
  id: string;
  /** Minimum value for this stat */
  min?: number;
  /** Maximum value for this stat */
  max?: number;
  /** Weight for weighted search sorting */
  weight?: number;
  /**
   * Override iteration priority for this stat.
   * - low: tighten slowly (5% step) - expensive stats like life, ES, crit, +gems
   * - medium: moderate tightening (10% step) - individual resistances
   * - high: tighten fast (20% step) - cheap stats like total res, armor
   * Defaults to KB config based on stat type.
   */
  iterationPriority?: 'low' | 'medium' | 'high';
  /**
   * Override max tightening step percentage per iteration (1-30).
   * Defaults to KB config based on stat type.
   */
  maxStepPercent?: number;
}

/**
 * Stat-specific iteration override from LLM
 */
export interface StatIterationOverride {
  /** Trade API stat ID this override applies to */
  statId: string;
  /** Override priority level */
  priority?: 'low' | 'medium' | 'high';
  /** Override max step percentage (1-30) */
  maxStepPercent?: number;
}

/**
 * Parameters for iterative search optimization
 */
export interface IterationParams {
  /** Maximum iterations to attempt */
  maxIterations: number;
  /** Budget in chaos orbs */
  budgetChaos: number;
  /** How much to loosen min values each iteration (percentage) */
  loosenStepPercent: number;
  /** Result count threshold below which to stop loosening */
  marketScarcityThreshold: number;
  /**
   * Stat-specific overrides from LLM when it has league/build-specific knowledge.
   * These override the default KB-based iteration priorities.
   */
  statOverrides?: StatIterationOverride[];
}

/**
 * Item constraints for trade search instruction
 * Named TradeItemConstraints to avoid conflict with SearchProfile.ItemConstraints
 */
export interface TradeItemConstraints {
  /** Specific base type (e.g., "Astral Plate", "Opal Ring") */
  baseType?: string;
  /** Required influences (e.g., ["shaper"], ["elder", "hunter"]) */
  influence?: string[];
  /** Minimum item level */
  itemLevel?: number;
  /** Corrupted filter (true = only corrupted, false = only non-corrupted) */
  corrupted?: boolean;
  /** Required open affix slots */
  openAffixes?: {
    prefix?: number;
    suffix?: number;
  };
}

/**
 * Budget specification
 */
export interface BudgetSpec {
  /** Maximum price willing to pay */
  max: number;
  /** Currency type */
  currency: 'chaos' | 'divine';
}

/**
 * Trade Search Instruction
 *
 * Returned by LLM tools instead of executing the search directly.
 * The desktop application receives this and executes the actual Trade API calls.
 */
export interface TradeSearchInstruction {
  /** Type of search: affix-first (specific stats) or weighted (DPS optimization) */
  type: 'affix_search' | 'weighted_search';

  /** Equipment slot being searched */
  slot: string;

  /** League to search in (e.g., "Settlers") */
  league: string;

  /** Stat requirements with explicit IDs from KB */
  statRequirements: StatRequirement[];

  /** Budget constraint */
  budget: BudgetSpec;

  /** Optional item constraints */
  constraints?: TradeItemConstraints;

  /** Parameters for iterative optimization */
  iterationParams: IterationParams;

  /** Build ID for context and PoB validation */
  pobBuildId: string;

  /** Human-readable label for this search (shown in UI) */
  searchLabel?: string;

  /**
   * For weighted searches: stat weights for optimization
   * Maps PoB stat name to weight multiplier (e.g., { "FullDPS": 1.0, "TotalEHP": 0.5 })
   */
  statWeights?: Record<string, number>;

  /**
   * For weighted searches: mod patterns to exclude from weighting
   */
  excludeModPatterns?: string[];

  /**
   * Build XML for PoB validation of found items (optional)
   * If provided, desktop will validate top items against the build
   */
  buildXml?: string;
}

/**
 * Individual item result from trade search execution
 */
export interface TradeItemResult {
  /** Trade listing ID */
  id: string;
  /** Item name */
  name: string;
  /** Base type */
  baseType: string;
  /** Price information */
  price: {
    amount: number;
    currency: string;
  };
  /** Matched stats with actual values */
  stats: Record<string, number>;
  /** PoB validation results (if buildXml was provided) */
  pobDelta?: {
    dps?: number;
    dpsPercent?: number;
    ehp?: number;
    ehpPercent?: number;
    life?: number;
    lifePercent?: number;
  };
  /** Direct link to this item on trade site */
  tradeUrl: string;
  /** PoB-formatted item text for copy/paste */
  pobItemText?: string;
}

/**
 * Result of executing a trade search instruction
 *
 * Returned by the desktop application after executing the search.
 * Sent back to the backend/LLM for interpretation.
 */
export interface TradeSearchResult {
  /** Whether search completed successfully */
  success: boolean;

  /** Found items sorted by relevance */
  items: TradeItemResult[];

  /** Number of iterations performed */
  iterationCount: number;

  /** How much of the budget was utilized (0-1) */
  finalBudgetUtilization: number;

  /** Trade URL to view all results */
  searchUrl?: string;

  /** Total count of matching items on trade site */
  totalCount?: number;

  /** Error message if success=false */
  error?: string;

  /** Guidance for LLM on interpreting results */
  guidance?: string;
}

/**
 * SSE event type for trade search instructions
 *
 * Emitted by the backend when a tool returns a TradeSearchInstruction
 * instead of executing the search directly.
 */
export interface TradeSearchInstructionEvent {
  type: 'trade_search_instruction';
  instruction: TradeSearchInstruction;
  /** Tool name that generated this instruction */
  toolName: string;
  /** Unique ID for correlating result with instruction */
  correlationId: string;
}

/**
 * SSE event type for trade search results
 *
 * Sent by the desktop application after executing a trade search instruction.
 */
export interface TradeSearchResultEvent {
  type: 'trade_search_result';
  result: TradeSearchResult;
  /** Correlation ID matching the instruction */
  correlationId: string;
}
