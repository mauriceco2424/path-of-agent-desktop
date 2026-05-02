/**
 * Improvement Types for Card-Based Flow
 *
 * Type definitions for the card-based decision flow UX.
 * LLM extracts improvement cards from pathway analysis weaknesses,
 * users select improvements, then choose trade/craft actions.
 */

import type { PathwayType } from './pathway';
import type { InfluenceType, CraftTargetMod } from './crafting.js';
import type { ImpactDisplay, RecipePath, SocketState, SocketRequirement, GemSource, RecipeStep } from './recipe';
import type { TokenUsageSummary } from './TokenUsage.js';
import type { ImprovementCandidate } from './candidates';

// =============================================================================
// Category Type
// =============================================================================

/**
 * Action categories for improvement items.
 * Used for filtering and sorting improvements by their focus area.
 */
export type ActionCategory = 'offensive' | 'defensive' | 'utility';

/**
 * Confidence tier for improvement recommendations.
 * Indicates how well we can validate the improvement's impact.
 *
 * - 'verified': Can simulate with PoB - shows actual DPS/EHP delta
 * - 'meta-backed': Based on meta usage stats - shows "78% of builds use this"
 * - 'utility': Quality of life improvement - can't measure impact numerically
 */
export type ConfidenceTier = 'verified' | 'meta-backed' | 'utility';

/**
 * Action button types that can appear on improvement cards.
 * LLM determines which buttons to show based on improvement context.
 */
export type ActionButtonType = 'analyze' | 'apply' | 'trade' | 'craft' | 'explore';

/**
 * Pre-generated option for the Explore action.
 * LLM generates 2-4 options during initial analysis when multiple valid paths exist.
 */
export interface ExploreOption {
  /** Unique identifier for this option */
  id: string;
  /** Short title (e.g., "Path via Constitution", "Use Brutality") */
  title: string;
  /** Explanation of this approach */
  description: string;
  /** Cost indicator (e.g., "3 points", "~50c") */
  cost?: string;
  /** Expected impact (e.g., "+15% DPS", "+500 life") */
  impact?: string;
  /** Data needed to execute this option (pathway-specific) */
  actionData?: Record<string, unknown>;
}

// =============================================================================
// Unified Action Item Types (Cross-Pathway Priority)
// =============================================================================

/**
 * Unified action item that combines improvement card data with cross-pathway ranking.
 * Used for the "Top 5" priority list that shows the most important actions across all pathways.
 *
 * This type extends ImprovementCard with additional fields for global ranking and
 * display-oriented content (impact instead of metric).
 */
export interface UnifiedActionItem {
  /** Unique identifier (e.g., "gear-offensive-0") */
  id: string;
  /** Which pathway this improvement belongs to */
  pathway: PathwayType;
  /** Category within the pathway */
  category: ActionCategory;
  /** Within-pathway priority (1 = highest within pathway) */
  priority: number;
  /** Cross-pathway rank (1 = highest globally). Set by rankImprovementsGlobally. */
  globalRank: number;

  // Display content
  /** Short action-oriented title (e.g., "Replace X with Y") */
  title: string;
  /** Expected impact description (e.g., "Gain ~25% more damage") */
  impact: string;

  // Additional context
  /** Supporting evidence/details from analysis */
  evidence?: string;
  /** Gear slot (for gear pathway only) */
  slot?: string;
  /** Whether this involves a unique item */
  isUnique?: boolean;
  /** What action type this improvement supports */
  actionType: 'trade' | 'craft' | 'both' | 'respec';
}

// =============================================================================
// Tree Pre-Validation Types
// =============================================================================

/**
 * Quantitative stat change with absolute value and percentage.
 * Used in tree simulation results.
 */
export interface StatDelta {
  /** Absolute change in the stat value */
  value: number;
  /** Percentage change from baseline */
  percent: number;
}

/**
 * Detailed stat delta with before/after values.
 * Used in skills simulation results where full context is needed.
 */
export interface SkillsStatDelta {
  /** Stat value before the change */
  before: number;
  /** Stat value after the change */
  after: number;
  /** Absolute change in the stat value */
  change: number;
  /** Percentage change from baseline */
  percentChange: number;
}

/**
 * Qualitative stats that have meaningful thresholds or caps.
 * These stats are important even when DPS/EHP don't change significantly.
 */
export type QualitativeStat =
  | 'FreezeAvoidChance'
  | 'ShockAvoidChance'
  | 'IgniteAvoidChance'
  | 'StunAvoidChance'
  | 'CurseAvoidChance'
  | 'SpellSuppressionChance'
  | 'BlockChance'
  | 'SpellBlockChance';

/**
 * A qualitative benefit that may not show up in raw DPS/EHP numbers.
 * Examples: reaching ailment immunity, capping spell suppression, etc.
 */
export interface QualitativeBenefit {
  /** Stat that improved */
  stat: QualitativeStat;
  /** Before value (0-100 for avoidance stats) */
  before: number;
  /** After value */
  after: number;
  /** Whether immunity/cap was reached */
  reachedCap: boolean;
  /** Human-readable description */
  description: string;
}

/**
 * Pre-validation simulation result for tree changes.
 * Generated by running PoB calcWith() during initial analysis
 * to validate tree improvement suggestions before showing to users.
 */
export interface TreeSimulationResult {
  /** Node IDs involved in this change */
  nodeIds: number[];

  /** Quantitative stat changes */
  statChanges: {
    dps?: StatDelta;
    ehp?: StatDelta;
    life?: StatDelta;
    energyShield?: StatDelta;
  };

  /** Qualitative benefits gained (immunities, caps reached) */
  qualitativeBenefits: QualitativeBenefit[];

  /** Number of passive points this change requires */
  pointCost: number;

  /** Whether this is an overall upgrade considering all factors */
  isUpgrade: boolean;

  // NEW: Pathfinding results
  /** Target node IDs (from card, before pathfinding) */
  targetNodeIds?: number[];
  /** Travel node IDs needed to reach targets */
  travelNodeIds?: number[];
  /** Breakdown of point costs */
  pointBreakdown?: {
    targetPoints: number;
    travelPoints: number;
    totalPoints: number;
  };
  /** Available passive points for the build */
  availablePoints?: number;
  /** Whether user has enough points for this change */
  hasEnoughPoints?: boolean;
  /** Target nodes that were already allocated */
  alreadyAllocated?: number[];
  /** Nodes that couldn't be reached */
  unreachableNodes?: Array<{ id: number; name: string; reason: string }>;
}

/**
 * Validation status for improvement cards.
 * - 'validated': Successfully simulated with PoB, results available
 * - 'unvalidated': Not yet validated (pending simulation)
 * - 'failed': Simulation attempted but failed (API error)
 * - 'skipped': Simulation not possible (vague title, unresolved nodes)
 * - 'not-applicable': Improvement type doesn't support simulation
 */
export type ValidationStatus = 'validated' | 'unvalidated' | 'failed' | 'skipped' | 'not-applicable';

// =============================================================================
// Slot Assessment Types (Gear Pathway)
// =============================================================================

/**
 * Assessment of problems with a gear slot's current item.
 * Used by gear pathway improvements to describe what's wrong
 * without prescribing specific mod solutions.
 */
export interface SlotAssessment {
  /** List of problems with current item (e.g., "Life pool insufficient (T5 roll: 54, expect 80+)") */
  problems: string[];
  /** Urgency level: 1=critical, 2=important, 3=nice-to-have */
  urgency: 1 | 2 | 3;
  /** Current item info for context */
  currentItem?: {
    name: string;
    rarity: 'Normal' | 'Magic' | 'Rare' | 'Unique';
  };
}

// =============================================================================
// Improvement Card Types
// =============================================================================

/**
 * A single improvement card shown to the user after pathway selection.
 * LLM extracts these from the Weaknesses section of pathway analysis.
 */
export interface ImprovementCard {
  /** Unique ID (e.g., "gear-helmet-001") */
  id: string;
  /** Which pathway this improvement belongs to */
  pathway: PathwayType;
  /** Primary category of improvement for filtering/sorting */
  category: ActionCategory;
  /**
   * All applicable categories for this improvement.
   * Allows improvements to be tagged with multiple categories (e.g., boots can be defensive + utility).
   * Always populated - even single-category items have this as a single-element array.
   */
  categories: ActionCategory[];
  /** Priority ranking (1 = highest priority) */
  priority: number;
  /** Short title (e.g., "Upgrade Helmet") */
  title: string;
  /** Evidence from analysis (e.g., "T5 life roll (54), missing chaos res") */
  evidence: string;
  /** Estimated metric improvement (e.g., "+15% EHP estimated") */
  metric?: string;
  /** For gear: specific slot (e.g., "helmet", "ring1", "weapon") */
  slot?: string;
  /**
   * For gear: assessment of problems with current item.
   * Describes what's wrong without prescribing specific mod solutions.
   * Used by the downstream mod selector workflow.
   */
  slotAssessment?: SlotAssessment;
  /** For gear: PoB trade query score weights (DPS vs EHP balance) set by initial analysis */
  scoreWeights?: { dpsWeight: number; ehpWeight: number };
  /** For skills: target socket group index (1-based) */
  skillGroupIndex?: number;
  /** For skills: label for the socket group (e.g., "Weapon 1") */
  skillGroupLabel?: string;
  /** For skills: slot name for the socket group (e.g., "Weapon 1", "Helmet") */
  skillGroupSlot?: string;
  /** For skills: true if this is the main skill group */
  skillGroupIsMain?: boolean;
  /** For skills: tag when not tied to a specific group (e.g., "New Slot") */
  skillGroupTag?: string;
  /** If true, skip craft option (unique items are trade only) */
  isUnique?: boolean;
  /** What actions are available for this improvement */
  actionType: 'trade' | 'craft' | 'both' | 'respec';

  // === Confidence Tier Fields (Option 3 Implementation) ===

  /**
   * Confidence tier for this improvement.
   * - 'verified': Can simulate with PoB (e.g., gem swap DPS)
   * - 'meta-backed': Based on meta stats (e.g., "78% use Brutality")
   * - 'utility': QoL improvement, can't measure numerically
   *
   * @default 'meta-backed' (for backwards compatibility)
   */
  confidenceTier?: ConfidenceTier;

  /**
   * Whether this improvement can be simulated with PoB.
   * If true, clicking Apply will run a simulation preview first.
   * If false, shows disclaimer and applies directly.
   */
  canSimulate?: boolean;

  /**
   * Note explaining why simulation is limited/unavailable.
   * Shown to user when canSimulate is false.
   * @example "Guard skill EHP requires active state assumption"
   */
  simulationNote?: string;

  // === Tree Pre-Validation Fields ===

  /**
   * Pre-validated simulation results (tree pathway only).
   * Contains stat changes, qualitative benefits, and point cost
   * from running PoB calcWith() during initial analysis.
   */
  simulation?: TreeSimulationResult;

  /**
   * Pre-validated simulation results for skills pathway.
   * Contains stat changes from gem swaps/additions during initial analysis.
   */
  skillsSimulation?: {
    statChanges: {
      dps?: SkillsStatDelta;
      ehp?: SkillsStatDelta;
    };
    isUpgrade: boolean;
  };

  /**
   * Validation status for this improvement.
   * - 'validated': Successfully simulated, results in `simulation` field
   * - 'unvalidated': Not yet validated
   * - 'failed': Simulation failed (check simulationNote for reason)
   * - 'not-applicable': This improvement type doesn't support simulation
   */
  validationStatus?: ValidationStatus;

  /**
   * Human-readable impact summary for display.
   * Generated from simulation results.
   * @example "+12.5% DPS, +8.3% EHP, reaches 100% spell suppression"
   */
  impactSummary?: string;

  /**
   * Indicator for mixed impact (some stats up, some down).
   * When true, UI should show a warning indicator that this is a tradeoff.
   * @example true when DPS increases but EHP decreases
   */
  hasMixedImpact?: boolean;

  // === Tree Pathway Structured Fields ===

  /**
   * Explicit node names from LLM for tree pathway.
   * Used for simulation when title parsing is ambiguous.
   * Takes precedence over title extraction when provided.
   */
  nodeNames?: string[];

  /**
   * Node names to deallocate (for tree respec swaps).
   * Used with nodeNames to represent "drop X, take Y" suggestions.
   */
  removeNodeNames?: string[];

  /**
   * Node names that could not be resolved against the passive tree database.
   * Populated during initial analysis validation when nodeNames contains
   * entries that don't match any keystone or notable in the tree data.
   * Used for monitoring LLM output quality.
   */
  unresolvedNodeNames?: string[];

  /**
   * Why simulation was skipped (not an error, just not possible).
   * Different from 'failed' which indicates an API/runtime error.
   * - 'vague_title': Title is too generic to extract node names
   * - 'unresolved_nodes': Could not find specified nodes in tree database
   * - 'manual_only': Requires manual tree exploration
   * - 'no_changes': Simulation detected no stat changes (nodes already allocated or invalid)
   */
  simulationSkipReason?: 'vague_title' | 'unresolved_nodes' | 'manual_only' | 'no_changes';

  /**
   * Human-readable explanation for why simulation was skipped.
   * Displayed to user to help them understand next steps.
   * @example "Title does not specify exact node names - manual tree exploration recommended"
   */
  simulationSkipMessage?: string;

  // === Skills Pathway Validation Fields ===

  /**
   * Validation status for skills pathway improvements.
   * - 'validated': Complete and actionable suggestion
   * - 'incomplete': Missing required details (e.g., no gem names)
   * - 'vague': Too generic to be actionable
   * - 'socket_overflow': Would exceed socket limits
   */
  skillsValidationStatus?: 'validated' | 'incomplete' | 'vague' | 'socket_overflow';

  /**
   * Why the skills suggestion was marked as invalid/skipped.
   * - 'no_gem_specified': Could not determine which gem(s) to change
   * - 'vague_title': Title is too generic (e.g., "add better supports")
   * - 'socket_limit_exceeded': Would exceed socket limits
   * - 'invalid_gem_name': Gem name doesn't match any known gem
   */
  skillsSkipReason?: 'no_gem_specified' | 'vague_title' | 'socket_limit_exceeded' | 'invalid_gem_name';

  /**
   * Human-readable explanation for why skills validation failed.
   * Displayed to user to help them understand what's missing.
   * @example "Suggestion recommends adding gems without specifying which ones"
   */
  skillsSkipMessage?: string;

  /**
   * Parsed gem swap details for skills pathway.
   * Contains the gems to remove and add when a swap is detected.
   */
  parsedSwap?: {
    /** Gem to remove from the setup */
    removeGem: string;
    /** Gem to add to the setup */
    addGem: string;
  };

  /**
   * Single gem to add (for add-only skills actions).
   * Used when the action adds a gem without removing one.
   */
  skillsAddGem?: string;

  /**
   * Single gem to remove (for remove-only skills actions).
   * Used when the action removes a gem without adding one.
   */
  skillsRemoveGem?: string;

  /**
   * Structured gem change data for skills pathway (preferred over parsed fields).
   * Contains all information needed for one-click "Apply to PoB":
   * - Socket group index and slot
   * - Gems to add/remove with exact names
   * - Socket color change guidance if needed
   *
   * When present, this takes precedence over parsedSwap, skillsAddGem, skillsRemoveGem.
   */
  gemChanges?: SkillsGemChange;

  // === Title Specificity Validation ===

  /**
   * Title specificity validation result.
   * Logs warnings for vague titles (forbidden phrases, missing proper nouns).
   * Used for monitoring and debugging LLM output quality.
   */
  titleValidation?: {
    /** Whether the title passed specificity validation */
    isValid: boolean;
    /** Reason for validation failure (if any) */
    reason?: string;
  };

  // === Crafting Pathway Fields ===

  /**
   * Base type for crafting (e.g., 'Astral Plate', 'Hubris Circlet').
   * Used when actionType is 'craft' or 'both'.
   */
  baseType?: string;

  /**
   * Recommended item level for crafting.
   * Higher item levels unlock better mod tiers.
   */
  itemLevel?: number;

  /**
   * Influence type for crafting (e.g., 'shaper', 'elder').
   * Used to access influence-specific mod pools.
   */
  influence?: InfluenceType;

  /**
   * Target mods to aim for when crafting.
   * Used by the crafting recipe generator.
   */
  targetMods?: CraftTargetMod[];

  // === Dynamic Action Fields (Spec 039) ===

  /**
   * LLM-determined action buttons to render.
   * If missing, apply pathway defaults.
   *
   * @deprecated Use `recipePaths` instead for recipe-based improvements.
   * This field is kept for backward compatibility during the transition to Spec 040.
   * Will be removed in a future version.
   */
  suggestedActions?: ActionButtonType[];

  /**
   * Pre-generated options for Explore action.
   * Only present when suggestedActions includes 'explore'.
   */
  exploreOptions?: ExploreOption[];

  // === Action Recipe Fields (Spec 040) ===

  /**
   * Impact display configuration.
   * Determines what to show on collapsed card.
   */
  impactDisplay?: ImpactDisplay;

  /**
   * Available paths to achieve this improvement.
   * If length > 1, user selects path before seeing recipe.
   * If length === 1, recipe shown directly.
   */
  recipePaths?: RecipePath[];

  /**
   * Pre-computed trade search specification for rare gear improvements.
   * Contains Trade API stat IDs, minimum values, and fallback sets.
   *
   * When present, clicking "Trade" executes directly without LLM call.
   * Generated during initial analysis using tier cap data from KB.
   *
   * Only populated for rare gear (isUnique: false) with actionType 'trade' or 'both'.
   */
  tradeSearchSpec?: TradeSearchSpec;

  /**
   * Current socket state for the relevant slot.
   * Used to determine if socket changes are needed.
   */
  currentSocketState?: SocketState;

  /**
   * Required socket configuration for this improvement.
   * Compared against currentSocketState to generate socket steps.
   */
  socketRequirements?: SocketRequirement;

  /**
   * Gem sources for all gems in this improvement.
   * Used for Skills pathway acquisition steps.
   */
  gemSources?: GemSource[];

  // === Parallel Candidate Fields (Spec: Replace LangChain) ===

  /**
   * Pre-generated candidate options for this improvement.
   * Generated during initial analysis (descriptions only).
   * Validated on-demand when user clicks the card.
   *
   * When present and length > 1, clicking the card triggers parallel
   * PoB validation of all candidates, then shows top 3 to user.
   */
  candidates?: ImprovementCandidate[];

  /**
   * Which candidate was selected by the user (after validation).
   * Set when user picks an option from the validated list.
   * Used to execute the selected candidate's action.
   */
  selectedCandidateId?: string;

  /**
   * Display mode for the card.
   * - 'explore': Shows "We'll explore X options and find the best" messaging
   * - 'direct': Shows traditional "Do X" messaging (single option)
   *
   * Determined by whether candidates array has > 1 item.
   * @default 'direct' for backward compatibility
   */
  displayMode?: 'explore' | 'direct';

  // === Gear Mod Selection Fields (Spec 044) ===

  /**
   * Useful mods for this gear slot identified by the LLM.
   * Used to populate the mod selector UI where users can swap mods in/out.
   * Only present for gear pathway improvements.
   */
  usefulMods?: GearUsefulMods;

  /**
   * LLM's recommended default search configuration.
   * Pre-selects mods and suggests min values for the initial search.
   * User can modify these in the UI before searching.
   */
  defaultSearch?: GearDefaultSearch;

  // === Tier Cap Validation Fields ===

  /**
   * Tier cap violations detected in this improvement card.
   * When populated, indicates the LLM suggested impossible mod values
   * that exceed T1 max rolls for the given slot.
   *
   * @example ["Life: 120 exceeds T1 max of 99", "FireRes: 50% exceeds T1 max of 48%"]
   */
  tierCapViolations?: string[];
}

/**
 * Collection of improvement cards extracted from all pathway analyses.
 */
export interface ImprovementCardCollection {
  skills: ImprovementCard[];
  tree: ImprovementCard[];
  gear: ImprovementCard[];
}

/**
 * Action card shown after user selects an improvement.
 * Used for Trade vs Craft selection.
 */
export interface ActionCard {
  /** Type of action */
  type: 'trade' | 'craft' | 'confirm';
  /** ID of the improvement this action is for */
  improvementId: string;
  /** Trade-specific search parameters */
  searchParams?: {
    /** Gear slot to search */
    slot: string;
    /** Stats to search for */
    stats: string[];
    /** User's budget in chaos */
    budget?: number;
  };
  /** Craft-specific method (e.g., "Essence spam", "Fossil craft") */
  craftingMethod?: string;
  /** Estimated cost in chaos for crafting */
  estimatedCost?: number;
}

// =============================================================================
// Stats Tracking Types
// =============================================================================

/**
 * Stats delta for PoB tracker badge.
 * Shows cumulative changes from original build.
 */
export interface StatsDelta {
  /** DPS change from baseline (absolute) */
  dps: number;
  /** EHP change from baseline (composite, absolute) */
  ehp: number;
  /** DPS change as percentage */
  dpsPercent: number;
  /** EHP change as percentage */
  ehpPercent: number;
}

/**
 * Single stat change entry for improvement history.
 * Records before/after stats for each applied improvement.
 * Note: Named ImprovementStatChange to avoid conflict with HybridTradeSearch.StatChange
 */
export interface ImprovementStatChange {
  /** When the change was applied */
  timestamp: number;
  /** ID of the improvement that caused this change */
  improvementId: string;
  /** Human-readable description (e.g., "Equipped new helmet") */
  description: string;
  /** DPS before the change */
  dpsBefore: number;
  /** DPS after the change */
  dpsAfter: number;
  /** EHP before the change */
  ehpBefore: number;
  /** EHP after the change */
  ehpAfter: number;
}

/**
 * Cumulative build stats for tracker.
 * Tracks original vs current stats and full change history.
 */
export interface BuildTracker {
  /** Original build stats at session start */
  originalStats: {
    dps: number;
    ehp: number;
  };
  /** Current build stats after all changes */
  currentStats: {
    dps: number;
    ehp: number;
  };
  /** History of all changes applied */
  changes: ImprovementStatChange[];
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from POST /api/v1/pathways/:pathway/improvements endpoint.
 * Returns improvement cards for a selected pathway.
 */
export interface PathwayImprovementsResponse {
  /** Which pathway these improvements are for */
  pathway: PathwayType;
  /** List of improvement cards for the pathway */
  improvements: ImprovementCard[];
  /** How many improvements have been completed */
  completedCount: number;
  /** Total improvements available */
  totalCount: number;
}

/**
 * Response from GET /api/v1/builds/:id/tracker endpoint.
 * Returns cumulative stats for the PoB tracker badge.
 */
export interface BuildTrackerResponse {
  /** Build ID */
  buildId: string;
  /** Build tracker with stats and history */
  tracker: BuildTracker;
  /** Current PoB code for export */
  pobCode?: string;
}

// =============================================================================
// Action Request/Response Types
// =============================================================================

/**
 * Request body for POST /api/v1/actions/trade
 */
export interface TradeActionRequest {
  /** Build ID */
  buildId: string;
  /** Improvement ID to execute trade for */
  improvementId: string;
  /** Optional budget in chaos orbs */
  budget?: number;
}

/**
 * Response from POST /api/v1/actions/trade
 */
export interface TradeActionResponse {
  /** Whether the trade search was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Trade search URL for the user to open */
  tradeUrl?: string;
  /** Summary of search parameters used */
  searchSummary?: {
    slot: string;
    stats: string[];
    budget?: number;
  };
  /** Number of results found */
  resultCount?: number;
  /** Items found from affix-search */
  items?: Array<{
    name: string;
    baseType: string;
    price: { amount: number; currency: string };
    stats?: Array<{ id: string; value: number }>;
    listingId: string;
  }>;
  /** Iteration history from affix-search (for progress display) */
  iterations?: Array<{
    step: number;
    minValues: Record<string, number>;
    resultCount: number;
    minPrice: number;
  }>;
}

/**
 * Request body for POST /api/v1/actions/craft
 */
export interface CraftActionRequest {
  /** Build ID */
  buildId: string;
  /** Improvement ID to get crafting guidance for */
  improvementId: string;
  /** Optional crafting configuration (budget, method preference, etc.) */
  config?: {
    /** Budget amount */
    budget?: number;
    /** Currency type for budget */
    currency?: 'chaos' | 'divine';
    /** Method preference: recommended (balanced), cheapest, or fastest */
    methodPreference?: 'recommended' | 'cheapest' | 'fastest';
    /** Specific target mods to enable (by stat ID) */
    enabledTargetMods?: string[];
  };
}

/**
 * Response from POST /api/v1/actions/craft
 */
export interface CraftActionResponse {
  /** Whether crafting guidance was generated */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Recommended crafting method */
  craftingMethod?: string;
  /** Estimated cost in chaos */
  estimatedCost?: number;
  /** Step-by-step crafting instructions */
  steps?: string[];
  /** Alternative methods if primary fails */
  alternatives?: {
    method: string;
    estimatedCost: number;
  }[];
}

/**
 * Request body for POST /api/v1/actions/apply
 */
export interface ApplyActionRequest {
  /** Build ID */
  buildId: string;
  /** Improvement ID being applied */
  improvementId: string;
  /** Item data to apply (format depends on pathway) */
  itemData: Record<string, unknown>;
}

/**
 * Response from POST /api/v1/actions/apply
 */
export interface ApplyActionResponse {
  /** Whether the change was successfully applied */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Updated stats after applying the change */
  newStats?: {
    dps: number;
    ehp: number;
  };
  /** Stats delta from this change */
  delta?: StatsDelta;
  /** New PoB code with the change applied */
  pobCode?: string;
}

// =============================================================================
// Trade Search Spec Types (Pre-computed during Initial Analysis)
// =============================================================================

/**
 * Priority level for trade search stats.
 * Determines how strictly to enforce minimum values.
 */
export type TradeStatPriority = 'must-have' | 'high' | 'nice-to-have';

/**
 * A single stat requirement for trade search.
 * Contains Trade API stat ID, minimum value, and priority.
 */
export interface TradeSearchStat {
  /** Trade API stat ID (e.g., "explicit.stat_3299347043" for life) */
  id: string;
  /** Minimum value for this stat (within T1 range) */
  min: number;
  /** Human-readable stat name for display */
  displayName: string;
  /** Priority level for this stat */
  priority: TradeStatPriority;
  /** Whether this stat can be swapped out in fallback searches */
  swappable: boolean;
}

/**
 * Fallback stat set for when primary search returns too few results.
 * Pre-computed during initial analysis to avoid LLM call at click time.
 */
export interface TradeSearchFallback {
  /** Unique identifier for this fallback set */
  id: string;
  /** Human-readable name (e.g., "Relaxed Requirements") */
  name: string;
  /** Stats to search for in this fallback */
  stats: Array<{ id: string; min: number; displayName: string }>;
}

/**
 * Pre-computed trade search specification.
 * Generated during initial analysis to enable zero-LLM trade execution at click time.
 *
 * This replaces the legacy proactive trade-planning call. All stat selection and
 * fallback planning is done upfront during gear pathway analysis.
 */
export interface TradeSearchSpec {
  /** Target slot for the search (e.g., "Ring", "Helmet") */
  slot: string;
  /** Primary stats to search for, with Trade API IDs and minimum values */
  stats: TradeSearchStat[];
  /** Pre-planned fallback sets for when primary search has too few results */
  fallbackSets?: TradeSearchFallback[];
  /** Optional LLM reasoning from analysis (for debugging) */
  reasoning?: string;
  /** Confidence in this search spec */
  confidence?: 'high' | 'medium' | 'low';
}

// =============================================================================
// Gear Mod Selection Types (Simplified Trade Search - Spec 044)
// =============================================================================

/**
 * A single mod option that the LLM identified as useful for a gear slot.
 * Includes the Trade API stat ID so frontend can build searches directly.
 */
export interface GearModOption {
  /** Short display name (e.g., "Life", "Fire Resistance") */
  name: string;
  /** Full mod text (e.g., "+# to maximum Life", "+#% to Fire Resistance") */
  displayName: string;
  /** Trade API stat ID (e.g., "explicit.stat_3299347043") */
  statId: string;
  /** Whether this mod is essential or optional for the upgrade */
  priority: 'required' | 'optional';
}

/**
 * Collection of useful mods for a gear slot, split by affix type.
 * LLM generates this during initial analysis to populate the mod selector UI.
 */
export interface GearUsefulMods {
  /** Useful prefix mods for this slot (max 6 options) */
  prefixes: GearModOption[];
  /** Useful suffix mods for this slot (max 6 options) */
  suffixes: GearModOption[];
}

/**
 * LLM's recommended default search configuration.
 * Pre-selects mods and suggests reasonable min values.
 */
export interface GearDefaultSearch {
  /** Short names of prefixes to include by default (max 3) */
  selectedPrefixes: string[];
  /** Short names of suffixes to include by default (max 3) */
  selectedSuffixes: string[];
  /** Suggested minimum values keyed by mod short name */
  suggestedMins: Record<string, number>;
}

// =============================================================================
// Item Paste Flow Types (Trade Purchase Completion)
// =============================================================================

/**
 * State for item paste flow after trade purchase
 */
export interface ItemPasteState {
  /** Whether paste modal is open */
  isOpen: boolean;
  /** Target slot for the item */
  targetSlot: string;
  /** Pasted item text (raw PoE format) */
  itemText: string | null;
  /** Validation result */
  validation: ItemPasteValidation | null;
  /** Stat preview from PoB calcWith */
  preview: StatPreview | null;
}

/**
 * Result of validating pasted item text
 */
export interface ItemPasteValidation {
  /** Whether item is valid for target slot */
  isValid: boolean;
  /** Detected item slot from parsed text */
  detectedSlot: string | null;
  /** Parsed item name */
  itemName: string | null;
  /** Parsed item base type */
  baseType: string | null;
  /** Slot mismatch warning (non-blocking) */
  slotMismatch: boolean;
  /** Error message if invalid */
  error: string | null;
}

/**
 * Stat preview before apply
 */
export interface StatPreview {
  /** DPS change */
  dps: {
    before: number;
    after: number;
    delta: number;
    percent: number;
  };
  /** EHP change */
  ehp: {
    before: number;
    after: number;
    delta: number;
    percent: number;
  };
  /** Life change */
  life: {
    before: number;
    after: number;
    delta: number;
  };
  /** ES change */
  es: {
    before: number;
    after: number;
    delta: number;
  };
  /** Resistance changes (optional) */
  resistances?: {
    fire: { before: number; after: number };
    cold: { before: number; after: number };
    lightning: { before: number; after: number };
    chaos: { before: number; after: number };
  };
}

// =============================================================================
// Gem Apply Types (Skills Pathway)
// =============================================================================

/**
 * Gem quality type variants for PoB API (PascalCase format).
 * Alternative quality gems have different effects.
 * Note: This uses PascalCase to match PoB API format.
 * Different from GemInstance.ts GemQualityType which uses lowercase.
 */
export type PoBGemQualityType = 'Default' | 'Anomalous' | 'Divergent' | 'Phantasmal';

/**
 * Item base attribute type for chromatic calculations.
 * Determines socket color probabilities when using Chromatic Orbs.
 */
export type ItemBaseAttributeType = 'str' | 'dex' | 'int' | 'str_dex' | 'str_int' | 'dex_int';

/**
 * Socket color change information for skills improvements.
 * When gem swaps require different socket colors, provides guidance on chromatic costs.
 */
export interface SocketColorChange {
  /** Current socket colors (e.g., "RRRGGB") */
  current: string;
  /** Target socket colors (e.g., "RRGGBB") */
  target: string;
  /** Item base type for calculating chromatic cost */
  itemBaseType?: ItemBaseAttributeType;
  /** Estimated chromatic orbs needed (average) */
  estimatedChromes?: number;
}

/**
 * Structured gem change data for skills pathway improvements.
 * Provides all necessary information for one-click "Apply to PoB" functionality.
 *
 * This replaces text-based parsing of evidence field with explicit structured data.
 */
export interface SkillsGemChange {
  /** Socket group index (1-based) */
  socketGroupIndex: number;
  /** Socket group slot name (e.g., "Weapon 1", "Body Armour") */
  socketGroupSlot: string;

  /** Gems to add to the socket group */
  add?: Array<{
    /** Gem display name (must match PoB exactly) */
    name: string;
    /** Gem level (defaults to 20) */
    level?: number;
    /** Gem quality (defaults to 20) */
    quality?: number;
    /** Quality type variant */
    qualityType?: PoBGemQualityType;
    /** Optional socket position (1-6) for precise placement */
    socketPosition?: number;
  }>;

  /** Gems to remove from the socket group */
  remove?: Array<{
    /** Gem display name to remove */
    name: string;
    /** Optional socket position (1-6) if known */
    socketPosition?: number;
  }>;

  /** Socket color change information (only if colors need to change) */
  colorChange?: SocketColorChange;
}

// =============================================================================
// Socket Modification Guidance Types
// =============================================================================

/**
 * Socket color modification method.
 * Used to recommend the most cost-effective approach.
 */
export type SocketColorMethod =
  | 'chromatic_spam'   // Use Chromatic Orbs directly
  | 'bench_1_color'    // Crafting bench: "At least 1 X socket"
  | 'bench_2_color'    // Crafting bench: "At least 2 X sockets"
  | 'bench_3_color'    // Crafting bench: "At least 3 X sockets"
  | 'vorici_method'    // Jeweller's socket manipulation trick
  | 'harvest';         // Harvest crafts (if available)

/**
 * A socket color modification option with cost breakdown.
 */
export interface SocketColorMethodOption {
  /** Method identifier */
  method: SocketColorMethod;
  /** Human-readable description */
  description: string;
  /** Average cost in primary currency (chromatics) */
  cost: number;
  /** Additional currency needed (e.g., jewellers for Vorici method) */
  additionalCurrency?: {
    type: 'jeweller' | 'vaal' | 'lifeforce';
    amount: number;
  };
  /** Step-by-step instructions */
  steps: string[];
  /** Whether this is the recommended method */
  recommended: boolean;
}

/**
 * Complete socket color modification guidance.
 * Compares all available methods and recommends the cheapest.
 */
export interface SocketColorGuidance {
  /** Current socket colors (e.g., "RRRGGB") */
  currentColors: string;
  /** Target socket colors (e.g., "RRGGBB") */
  targetColors: string;
  /** Item base type */
  baseType: ItemBaseAttributeType;
  /** Average chromatic orbs needed for random rolling */
  averageCost: number;
  /** 25th percentile cost (lucky outcome) */
  lowerBound: number;
  /** 75th percentile cost (unlucky outcome) */
  upperBound: number;
  /** Recommended method for this color change */
  recommendedMethod: SocketColorMethod;
  /** All available methods with costs */
  methods: SocketColorMethodOption[];
}

/**
 * Socket/link modification estimate.
 * Provides guidance for socket count and link count changes.
 */
export interface SocketModificationGuidance {
  /** What type of modification */
  type: 'socket_count' | 'link_count' | 'socket_color';
  /** Current state (e.g., "4S", "4L", "RRRG") */
  current: string;
  /** Target state (e.g., "6S", "6L", "RRGGBB") */
  target: string;
  /** Recommended method description */
  recommendedMethod: string;
  /** Average cost (primary currency) */
  averageCost: number;
  /** Currency type */
  currencyType: 'jeweller' | 'fusing' | 'chromatic';
  /** Whether to use bench craft (guaranteed) vs manual (RNG) */
  useBenchCraft: boolean;
  /** Bench craft cost if available */
  benchCraftCost?: number;
  /** For corrupted items, additional vaal orb cost */
  vaalOrbCost?: number;
  /** Step-by-step instructions */
  steps: string[];
}

/**
 * Complete socket modification plan for an item.
 * Includes socket count, link count, and color changes in optimal order.
 */
export interface SocketModificationPlan {
  /** Item slot being modified */
  slot: string;
  /** Whether the item is corrupted */
  isCorrupted: boolean;
  /** Item base attribute type */
  baseType: ItemBaseAttributeType;
  /** Ordered list of modifications to apply */
  modifications: SocketModificationGuidance[];
  /** Total estimated cost in chaos equivalent */
  totalCostEstimate: number;
  /** Summary for display */
  summary: string;
}

/**
 * Request to apply gem changes to a build
 */
export interface GemApplyRequest {
  /** Build ID */
  buildId: string;

  /** Socket group index (1-based) */
  socketGroupIndex: number;

  /** Changes to apply */
  changes: GemChanges;
}

/**
 * Gem changes to apply
 */
export interface GemChanges {
  /** Gems to add */
  add?: Array<{
    name: string;
    level?: number;
    quality?: number;
  }>;

  /** Gem names to remove */
  remove?: string[];
}

/**
 * Response from gem apply endpoint
 */
export interface GemApplyResponse {
  /** Whether apply succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Actual stat delta from PoB */
  actualDelta?: {
    dpsBefore: number;
    dpsAfter: number;
    dpsPercent: number;
    ehpBefore: number;
    ehpAfter: number;
    ehpPercent: number;
  };

  /** Updated PoB code */
  pobCode?: string;
}

// =============================================================================
// Enricher Types (Backend + Frontend Shared)
// =============================================================================

/**
 * Individual stat filter for trade search (enricher version).
 * Used by the recipe enricher and frontend tier data.
 */
export interface TradeStatFilter {
  /** Trade API stat ID */
  id: string;
  /** Internal stat name */
  stat: string;
  /** Minimum value required */
  min?: number;
  /** Maximum value (optional, for capping) */
  max?: number;
  /** Weight for sorting priority */
  weight: number;
  /** Whether this stat is required */
  required: boolean;
}

/**
 * Trade search specification for the enricher.
 * Extended version with additional fields for lazy enrichment.
 */
export interface EnrichedTradeSearchSpec {
  /** Target slot for the search */
  slot: string;
  /** Stats to filter by with minimum values */
  stats: TradeStatFilter[];
  /** Maximum price in chaos (optional) */
  maxPrice?: number;
  /** Required base types (optional) */
  baseTypes?: string[];
  /** Whether unique items should be included */
  includeUniques?: boolean;
}

/**
 * Tier range data for a single mod tier.
 */
export interface TierRange {
  tier: number;
  min: number;
  max: number;
  iLvl: number;
}

/**
 * Tier data for a mod, used by mod selectors.
 */
export interface ModTierData {
  statCategory: string;
  modPattern: string;
  affixType: 'prefix' | 'suffix';
  tiers: TierRange[];
}

/**
 * API response for slot tier data.
 */
export interface SlotTierRangesResponse {
  slot: string;
  mods: ModTierData[];
}

/**
 * Parsed target mod from evidence.
 */
export interface ParsedTargetMod {
  stat: string;
  minValue?: number;
  maxTier?: number;
  tradeId?: string;
  sourceText: string;
  weight: number;
}

/**
 * Craft recipe summary for display.
 */
export interface CraftRecipeSummary {
  name: string;
  method: string;
  steps: RecipeStep[];
  estimatedCost: number;
  costRange: {
    low: number;
    high: number;
  };
  successRate: number;
  difficulty?: number;
  recommendedBase?: {
    name: string;
    itemLevel: number;
    estimatedCost: number;
  };
  warnings: string[];
}

/**
 * Enriched gear card result from backend.
 */
export interface EnrichedGearCard {
  cardId: string;
  tradeSpec: EnrichedTradeSearchSpec;
  craftRecipe?: CraftRecipeSummary;
  targetMods: ParsedTargetMod[];
  craftingViable: boolean;
  enrichedAt: string;
}
