/**
 * Trade Iterator Service
 *
 * Implements the iteration logic for trade search optimization.
 * Port of key logic from backend/src/services/trade-search/archive/affix-search.ts.
 *
 * Features:
 * - Adaptive step sizing based on budget utilization
 * - Market scarcity detection
 * - Min value loosening when no results found
 * - Stopping condition checks
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Iterator state for tracking search progress.
 */
export interface IteratorState {
  /** Current iteration step (1-based) */
  step: number;
  /** Current minimum values per stat */
  minValues: Map<string, number>;
  /** History of all iterations */
  history: IterationHistoryEntry[];
  /** Reason for stopping (if stopped) */
  stoppedReason?: StopReason;
}

/**
 * Single iteration history entry.
 */
export interface IterationHistoryEntry {
  step: number;
  minValues: Record<string, number>;
  resultCount: number;
  minPrice: number;
}

/**
 * Progress update for UI display.
 */
export interface IteratorProgress {
  /** Current iteration number */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Results found in this iteration */
  resultCount: number;
  /** Minimum price found */
  minPrice: number;
  /** User's budget */
  budget: number;
  /** Human-readable status text */
  statusText: string;
  /** Trade URL for this iteration */
  tradeUrl: string;
  /** Time taken for iteration (ms) */
  timeMs: number;
  /** Current filter values */
  currentFilters: {
    slot?: string;
    budget: number;
    currency: 'chaos' | 'divine';
    stats: Array<{ id: string; min: number; label?: string }>;
    minPrice?: number;
  };
}

/**
 * Reason for stopping iteration.
 */
export type StopReason = 'budget_reached' | 'market_scarcity' | 'max_iterations';

// ============================================
// Constants
// ============================================

/** Percentage to loosen min values when zero results found */
const LOOSEN_STEP_PERCENT = 0.20; // 20%

/** Market scarcity threshold - stop if results drop below this */
const MARKET_SCARCITY_THRESHOLD = 5;

/** Budget utilization threshold for stopping (80%) */
const BUDGET_REACHED_THRESHOLD = 0.80;

// ============================================
// Adaptive Step Sizing
// ============================================

/**
 * Calculate adaptive step size based on budget utilization.
 *
 * When far from budget (low utilization), use larger steps to converge faster.
 * When near budget (high utilization), use smaller steps for fine-tuning.
 *
 * @param utilization - Current budget utilization (minPrice / budget), 0-1 range
 * @returns Step percentage to apply (e.g., 0.30 = 30%)
 */
export function calculateAdaptiveStep(utilization: number): number {
  if (utilization < 0.25) return 0.30; // 30% step when far from budget
  if (utilization < 0.70) return 0.20; // 20% step mid-range
  return 0.10; // 10% step when near budget (fine-tuning)
}

/**
 * Determine maximum iterations based on progress.
 *
 * Extends to 8 iterations when:
 * - Budget utilization < 50% AND
 * - Making >= 10% price progress per iteration
 *
 * @param utilization - Current budget utilization (0-1)
 * @param priceProgress - Price increase ratio from last iteration (0-1)
 * @returns Maximum iterations allowed
 */
export function getMaxIterations(utilization: number, priceProgress: number): number {
  const BASE_MAX = 5;
  const EXTENDED_MAX = 8;
  const MIN_PROGRESS_FOR_EXTENSION = 0.10;

  if (utilization < 0.50 && priceProgress >= MIN_PROGRESS_FOR_EXTENSION) {
    return EXTENDED_MAX;
  }
  return BASE_MAX;
}

// ============================================
// Min Value Operations
// ============================================

/**
 * Increase all min values by the specified step percentage.
 *
 * Used when tightening requirements to push prices up toward budget.
 *
 * @param minValues - Map of stat ID to current min value (mutated in place)
 * @param stepPercent - Percentage to increase by (e.g., 0.10 = 10%)
 */
export function tightenMinValues(
  minValues: Map<string, number>,
  stepPercent: number = 0.10
): void {
  for (const [statId, currentValue] of minValues) {
    const newValue = Math.ceil(currentValue * (1 + stepPercent));
    minValues.set(statId, newValue);
    console.log(`[Iterator] Tightening ${statId}: ${currentValue} -> ${newValue}`);
  }
}

/**
 * Decrease all min values by the loosen step percentage.
 *
 * Used as fallback when zero results are found to recover from
 * overly aggressive starting values.
 *
 * @param minValues - Map of stat ID to current min value (mutated in place)
 */
export function loosenMinValues(minValues: Map<string, number>): void {
  for (const [statId, currentValue] of minValues) {
    const newValue = Math.floor(currentValue * (1 - LOOSEN_STEP_PERCENT));
    minValues.set(statId, Math.max(1, newValue)); // Never go below 1
    console.log(`[Iterator] Loosening ${statId}: ${currentValue} -> ${Math.max(1, newValue)}`);
  }
}

// ============================================
// Stopping Conditions
// ============================================

/**
 * Check stopping conditions and return the reason if should stop.
 *
 * Stopping conditions:
 * - Budget reached: minPrice >= 80% of budget (primary constraint)
 * - Market scarcity: resultCount < 5 (no market liquidity)
 *
 * @param resultCount - Number of results from current search
 * @param minPrice - Minimum price from current results
 * @param budget - User's budget
 * @returns Stop reason or undefined to continue
 */
export function checkStoppingConditions(
  resultCount: number,
  minPrice: number,
  budget: number
): StopReason | undefined {
  // Check budget constraint
  if (minPrice > 0 && minPrice >= budget * BUDGET_REACHED_THRESHOLD) {
    return 'budget_reached';
  }

  // Check market scarcity
  if (resultCount < MARKET_SCARCITY_THRESHOLD) {
    return 'market_scarcity';
  }

  return undefined;
}

// ============================================
// Stat Sensitivity (Advanced)
// ============================================

/**
 * Stat sensitivity classification.
 */
export type StatSensitivity = 'unknown' | 'low' | 'medium' | 'high';

/**
 * Sensitivity info for a single stat.
 */
export interface StatSensitivityInfo {
  statId: string;
  sensitivity: StatSensitivity;
  safeValue: number;
  currentValue: number;
  cliffValue?: number;
}

/**
 * Calculate elasticity: percent change in results / percent change in value.
 *
 * Higher values = more sensitive (results drop faster when value increases).
 *
 * @param beforeCount - Result count before value change
 * @param afterCount - Result count after value change
 * @param beforeValue - Stat value before change
 * @param afterValue - Stat value after change
 * @returns Elasticity value
 */
export function calculateElasticity(
  beforeCount: number,
  afterCount: number,
  beforeValue: number,
  afterValue: number
): number {
  if (beforeCount === 0 || beforeValue === 0) return 0;

  const resultChangePercent = ((beforeCount - afterCount) / beforeCount) * 100;
  const valueChangePercent = ((afterValue - beforeValue) / beforeValue) * 100;

  if (valueChangePercent === 0) return 0;
  return resultChangePercent / valueChangePercent;
}

/**
 * Classify sensitivity based on elasticity value.
 *
 * @param elasticity - Calculated elasticity value
 * @returns Sensitivity classification
 */
export function classifySensitivity(elasticity: number): StatSensitivity {
  const HIGH_THRESHOLD = 5.0;
  const MEDIUM_THRESHOLD = 2.0;

  if (elasticity >= HIGH_THRESHOLD) return 'high';
  if (elasticity >= MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}
