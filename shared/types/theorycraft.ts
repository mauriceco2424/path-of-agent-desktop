/**
 * Theorycraft Optimization Types
 *
 * Types for the multi-option parallel validation system used in
 * the theorycraft command's optimization loop (Step 6.5).
 *
 * Architecture:
 * 1. LLM proposes 3-5 OptimizationOptions per iteration
 * 2. All options are validated via PoB API in parallel
 * 3. ValidationResults are returned to LLM for comparison
 * 4. LLM picks the best option based on actual DPS/EHP deltas
 * 5. Process repeats until convergence (3 no-improvement iterations or 10 max)
 */

// ============================================================================
// Option Types - What the LLM proposes
// ============================================================================

/**
 * The type of change being proposed
 */
export type OptimizationChangeType =
  | 'gem_swap' // Swap one support gem for another
  | 'gem_add' // Add a new gem to a setup
  | 'gem_remove' // Remove a gem from a setup
  | 'tree_notable' // Add/remove a notable passive
  | 'tree_keystone' // Add/remove a keystone
  | 'tree_travel' // Change tree pathing
  | 'aura_swap' // Swap one aura for another
  | 'aura_add' // Add a new aura
  | 'aura_remove' // Remove an aura
  | 'gear_mod' // Change a mod on gear (theoretical)
  | 'flask_change' // Change flask setup
  | 'cluster_notable' // Add/change cluster jewel notable
  | 'compound'; // Multiple changes bundled together

/**
 * A single atomic change within an optimization option
 */
export interface OptimizationChange {
  type: OptimizationChangeType;
  description: string;

  // For gem changes
  gemName?: string;
  targetGem?: string; // The gem being replaced (for swaps)
  skillGroup?: string; // Which skill setup this affects

  // For tree changes
  nodeName?: string;
  nodeId?: number;
  travelNodes?: number; // How many travel nodes required

  // For aura changes
  auraName?: string;
  targetAura?: string; // The aura being replaced (for swaps)

  // For compound changes
  subChanges?: OptimizationChange[];
}

/**
 * A complete optimization option proposed by the LLM
 * Each iteration, the LLM proposes 3-5 of these
 */
export interface OptimizationOption {
  /** Unique identifier for this option (e.g., "A", "B", "C") */
  id: string;

  /** Human-readable description of what this option does */
  description: string;

  /** The type of primary change */
  type: OptimizationChangeType;

  /** The specific changes to apply */
  changes: OptimizationChange[];

  /** LLM's hypothesis about expected impact */
  expectedImpact: string;

  /** What this option prioritizes */
  focus: 'dps' | 'ehp' | 'balanced' | 'utility';

  /** Estimated point/resource cost if applicable */
  cost?: {
    passivePoints?: number;
    manaReservation?: number;
    socketRequirement?: number;
  };
}

/**
 * A complete proposal from the LLM containing multiple options
 */
export interface OptimizationProposal {
  /** The options to test (3-5 typically) */
  options: OptimizationOption[];

  /** LLM's reasoning for these specific options */
  reasoning: string;

  /** Current focus area based on build state */
  focusArea: 'dps' | 'ehp' | 'balanced';

  /** What metrics the LLM is trying to improve */
  targetMetrics: string[];
}

// ============================================================================
// Validation Result Types - What comes back from PoB
// ============================================================================

/**
 * Core build stats used for comparison
 */
export interface BuildStats {
  /** Total DPS (combined if multiple skills) */
  dps: number;

  /** Effective Hit Pool */
  ehp: number;

  /** Raw life pool */
  life: number;

  /** Energy shield if applicable */
  energyShield?: number;

  /** Mana pool */
  mana?: number;

  /** Mana reserved percentage */
  manaReserved?: number;

  /** Movement speed */
  movementSpeed?: number;

  /** Any additional stats the LLM should know about */
  additionalStats?: Record<string, number>;
}

/**
 * Percentage deltas between baseline and result
 */
export interface StatDeltas {
  dpsPercent: number;
  ehpPercent: number;
  lifePercent: number;
  energyShieldPercent?: number;
  manaPercent?: number;
  movementSpeedPercent?: number;
}

/**
 * Verdict on whether this change is beneficial
 */
export type ChangeVerdict =
  | 'upgrade' // Clear improvement
  | 'sidegrade' // Trade-offs, roughly equal
  | 'downgrade' // Net negative
  | 'invalid'; // Could not be applied

/**
 * Result of validating a single optimization option
 */
export interface ValidationResult {
  /** The option ID that was tested */
  optionId: string;

  /** Whether the validation succeeded */
  success: boolean;

  /** The baseline stats before applying changes */
  baseline: BuildStats;

  /** The result stats after applying changes */
  result: BuildStats;

  /** Percentage changes */
  deltas: StatDeltas;

  /** Overall verdict */
  verdict: ChangeVerdict;

  /** Error message if validation failed */
  error?: string;

  /** Time taken to validate in ms */
  validationTimeMs?: number;

  /** Any warnings about the change */
  warnings?: string[];
}

// ============================================================================
// Iteration State Types - Tracking the optimization loop
// ============================================================================

/**
 * Record of what happened in a single iteration
 */
export interface IterationRecord {
  /** Which iteration number (1-indexed) */
  iteration: number;

  /** The options that were proposed */
  proposedOptions: OptimizationOption[];

  /** The validation results for each option */
  validationResults: ValidationResult[];

  /** Which option was selected (or null if skipped) */
  selectedOption: string | null;

  /** Why this option was selected (or why all were skipped) */
  reasoning: string;

  /** Timestamp when this iteration completed */
  timestamp: Date;
}

/**
 * A change that was successfully applied to the build
 */
export interface AppliedChange {
  /** Which iteration this came from */
  iteration: number;

  /** The option that was applied */
  option: OptimizationOption;

  /** The DPS delta from this change */
  dpsGain: number;

  /** The EHP delta from this change */
  ehpGain: number;
}

/**
 * Complete state of the optimization loop
 */
export interface IterationState {
  /** Current iteration number */
  iteration: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Current build stats */
  currentStats: BuildStats;

  /** Initial build stats (before any optimization) */
  initialStats: BuildStats;

  /** History of all iterations */
  history: IterationRecord[];

  /** Count of consecutive iterations with no improvement */
  noImprovementCount: number;

  /** Maximum no-improvement iterations before stopping */
  noImprovementThreshold: number;

  /** All changes that have been successfully applied */
  appliedChanges: AppliedChange[];

  /** Whether the loop has converged */
  converged: boolean;

  /** Why the loop stopped */
  convergenceReason?: 'max_iterations' | 'no_improvement' | 'target_reached' | 'user_stopped';
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the optimization loop
 */
export interface OptimizationConfig {
  /** Maximum iterations to run (default: 10) */
  maxIterations: number;

  /** How many options to request per iteration (default: 3-5) */
  optionsPerIteration: {
    min: number;
    max: number;
  };

  /** Stop after this many iterations with no improvement (default: 3) */
  noImprovementThreshold: number;

  /** Whether compound changes are allowed (default: true) */
  allowCompoundChanges: boolean;

  /** Minimum DPS improvement to count as "improvement" (default: 1%) */
  minDpsImprovementPercent: number;

  /** Maximum EHP loss allowed for DPS gain (default: 10%) */
  maxEhpLossPercent: number;

  /** Focus area for optimization */
  focus: 'dps' | 'ehp' | 'balanced';
}

/**
 * Default configuration values
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  maxIterations: 10,
  optionsPerIteration: { min: 3, max: 5 },
  noImprovementThreshold: 3,
  allowCompoundChanges: true,
  minDpsImprovementPercent: 1,
  maxEhpLossPercent: 10,
  focus: 'balanced',
};

// ============================================================================
// Analysis Types - Enhanced validation with breakpoints and defenses
// ============================================================================

/**
 * Mod tier policy for item generation
 */
export interface ModTierPolicyConfig {
  /** Policy name (e.g., 'realistic_day3', 'validation_t3') */
  name: string;

  /** Default tier to use if category not specified */
  defaultTier: number;

  /** Whether to use best available if target tier doesn't exist */
  fallbackToBestAvailable: boolean;
}

/**
 * PoB configuration template identifier
 */
export type ContentTierConfig = 'leveling' | 'mapping' | 'bossing' | 'pinnacle' | 'uber';

/**
 * Options for theorycraft validation
 */
export interface TheorycraftValidationOptions {
  /** Optimization focus */
  focus: 'dps' | 'ehp' | 'balanced';

  /** Content tier for PoB config */
  contentTier?: ContentTierConfig;

  /** Mod tier policy for item generation */
  modTierPolicy?: string;

  /** Include breakpoint analysis */
  includeBreakpoints?: boolean;

  /** Include defensive layer analysis */
  includeDefenses?: boolean;

  /** Include unique upgrade recommendations */
  includeUniqueRecommendations?: boolean;
}

// ============================================================================
// Summary Types - Final output
// ============================================================================

/**
 * Summary of the entire optimization process
 */
export interface OptimizationSummary {
  /** Starting stats */
  initialStats: BuildStats;

  /** Final stats after optimization */
  finalStats: BuildStats;

  /** Overall deltas */
  totalDeltas: StatDeltas;

  /** Number of iterations run */
  iterationsRun: number;

  /** Number of changes applied */
  changesApplied: number;

  /** List of all applied changes with their individual impacts */
  appliedChanges: AppliedChange[];

  /** Changes that were tested but rejected */
  rejectedChanges: Array<{
    option: OptimizationOption;
    reason: string;
  }>;

  /** Why optimization stopped */
  convergenceReason: string;

  /** Total time taken */
  totalTimeMs: number;
}

// ============================================================================
// Parallel Theorycraft Types - Multiple competing agents
// ============================================================================

/**
 * Configuration for parallel theorycraft mode.
 *
 * In parallel mode, multiple agents run the same optimization task
 * independently. Since LLM optimization is non-deterministic, each
 * agent explores different paths and may find different local optima.
 */
export interface ParallelTheorycraftConfig {
  /** Number of agents to run (default: 3, max: 5) */
  agentCount: number;

  /** All agents use the same optimization focus */
  focus: 'balanced';

  /** Scoring weights for comparing results */
  scoring: ParallelScoringConfig;

  /** Optimization config shared by all agents */
  optimizationConfig: OptimizationConfig;
}

/**
 * Scoring configuration for comparing parallel agent results.
 */
export interface ParallelScoringConfig {
  /** Weight for DPS in score calculation (0.0 - 1.0) */
  dpsWeight: number;

  /** Weight for EHP in score calculation (0.0 - 1.0) */
  ehpWeight: number;
}

/**
 * Result from a single parallel theorycraft agent.
 */
export interface ParallelAgentResult {
  /** Agent identifier (1-indexed) */
  agentId: number;

  /** Final DPS achieved */
  finalDps: number;

  /** Final EHP achieved */
  finalEhp: number;

  /** Final Life value */
  finalLife: number;

  /** Number of optimization iterations run */
  iterationsRun: number;

  /** Number of changes applied during optimization */
  changesApplied: number;

  /** PoB export code for this build */
  pobCode: string;

  /** Normalized score (0-100) based on scoring config */
  score: number;

  /** Full optimization summary */
  summary: OptimizationSummary;

  /** Applied changes for comparison */
  keyChanges: string[];

  /** Time taken for this agent's run in ms */
  timeMs: number;
}

/**
 * Comparison data between parallel agents.
 */
export interface ParallelComparison {
  /** All agent results sorted by score (highest first) */
  results: ParallelAgentResult[];

  /** The winning agent */
  winner: ParallelAgentResult;

  /** DPS range across all agents */
  dpsRange: { min: number; max: number; spread: number };

  /** EHP range across all agents */
  ehpRange: { min: number; max: number; spread: number };

  /** Key differences found between agents */
  keyDifferences: string[];

  /** Total time for all parallel runs */
  totalTimeMs: number;
}

/**
 * Default configuration for parallel theorycraft.
 */
export const DEFAULT_PARALLEL_CONFIG: ParallelTheorycraftConfig = {
  agentCount: 3,
  focus: 'balanced',
  scoring: {
    dpsWeight: 0.5,
    ehpWeight: 0.5,
  },
  optimizationConfig: DEFAULT_OPTIMIZATION_CONFIG,
};
