/**
 * Shared flow types for the desktop application.
 * Consolidates types used across improvement flow components.
 */

import type { CraftingRecipe, InfluenceType } from '../../../shared/types/crafting';

export type CraftProgressState =
  | 'idle'
  | 'planning'
  | 'loading'
  | 'applying'
  | 'complete'
  | 'error';

// =============================================================================
// Search and Inline Result Types
// =============================================================================

/**
 * Progress states for trade/craft search operations
 */
export type SearchProgressState =
  | 'idle'
  | 'loading-build'
  | 'planning'
  | 'plan-ready'
  | 'searching'
  | 'fetching-items'
  | 'validating'
  | 'retrying'
  | 'complete'
  | 'error'
  | 'craft-configuring'
  | 'craft-loading-mods'
  | 'craft-analyzing'
  | 'craft-complete';

/**
 * Tab options for inline results panel
 */
export type InlineTab = 'details' | 'results' | 'craft';

/**
 * Trade search response for inline display
 */
export interface InlineTradeResponse {
  success: boolean;
  tradeUrl: string;
  items?: Array<{
    name: string;
    price: { amount: number; currency: string };
    tradeUrl?: string;
    comparison?: {
      dpsChange: number;
      dpsChangePercent: number;
      lifeChange: number;
      ehpChange: number;
      verdict: string;
    };
  }>;
  error?: string;
}

/**
 * Configuration state for crafting panel
 */
export interface CraftConfigState {
  slot?: string;
  baseType?: string;
  itemLevel?: number;
  influence?: InfluenceType;
  targetMods?: Array<{ stat: string; displayName: string; minValue?: number } | string>;
  configuredBudget?: number;
  configuredCurrency?: 'chaos' | 'divine';
}

/**
 * Per-card trade state for inline results (multiple cards can have results).
 * Includes both trade search state and craft flow state.
 */
export interface CardTradeState {
  results: InlineTradeResponse | null;
  progress: SearchProgressState;
  activeTab: InlineTab;
  // Configuration state (shown before search executes)
  configuredBudget?: number;
  configuredCurrency?: 'chaos' | 'divine';
  availableStats?: Array<{ id: string; name: string; fullText?: string; minValue: number }>;
  enabledStats?: string[];
  slot?: string;
  // Weighted search flag - rings, amulets, jewels, weapons use weighted ranking
  isWeightedSlot?: boolean;
  // Original search parameters for adjustment modal
  originalParams?: {
    slot: string;
    stats: Array<{ id: string; name: string; fullText?: string; minValue: number }>;
    budget?: number;
    currency?: 'chaos' | 'divine';
  };
  // Current iteration progress (updated during search)
  currentIteration?: {
    iteration: number;
    maxIterations: number;
    message?: string;
    timeMs?: number;
    currentMins: Record<string, number>;
    resultCount: number;
    minPrice: number;
    tradeUrl?: string;
  };
  // Iteration history from previous search
  iterationHistory?: Array<{
    step: number;
    minValues: Record<string, number>;
    resultCount: number;
    minPrice: number;
    tradeUrl?: string;
  }>;
  // Why the search stopped
  stoppedReason?: 'budget_reached' | 'market_scarcity' | 'max_iterations';
  // Budget utilization (0-1)
  budgetUtilization?: number;
  // Craft flow state
  craftProgress?: CraftProgressState;
  craftResults?: CraftingRecipe | null;
  craftConfig?: CraftConfigState;
  // Craft recipe step completion tracking (T078)
  craftRecipeCompletedSteps?: string[];

  // Active stat set (which config is being used)
  activeStatSetId?: 'primary' | 'fallback-1' | 'fallback-2' | 'custom';

  // User customizations (swaps and min value adjustments)
  customizations?: {
    swappedStats: Array<{ removed: string; added: string }>;
    adjustedMins: Record<string, number>;
  };

  // Current fallback index (for auto-retry tracking)
  currentFallbackIndex?: number;

  // Upgrade plan from LLM (Step 1 of gear upgrade flow)
  upgradePlan?: UpgradePlan;

  // Error message for display
  errorMessage?: string;

  // Validated items from PoB (Step 3 of gear upgrade flow)
  validatedItems?: import('../../../shared/types/ItemComparison').ValidatedItem[];

  // Baseline stats for comparison
  validationBaseline?: { dps: number; ehp: number };

  // Validation count for progress display
  validationProgress?: { current: number; total: number };
}

/**
 * Upgrade plan response from /api/v1/chat/plan-upgrade endpoint.
 * Contains either must-have mods for rare item search, or unique item recommendation.
 */
export interface UpgradePlan {
  /** Type of upgrade recommended */
  type: 'rare' | 'unique';
  /** For rare: required mods with Trade API stat IDs */
  mustHaveMods?: Array<{
    statId: string;
    minValue: number;
    description: string;
  }>;
  /** For rare: whether to fill remaining slots with weighted stats */
  fillWithWeighted?: boolean;
  /** For unique: name of the recommended unique item */
  uniqueName?: string;
  /** LLM reasoning for the recommendation */
  reasoning: string;
}
