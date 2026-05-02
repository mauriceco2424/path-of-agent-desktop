/**
 * Affix-First Trade Search Types
 *
 * These types support the simplified affix-first trade search approach (Spec 027).
 * The LLM outputs explicit stat IDs and min values directly from KB modules.
 * The backend is a "dumb pipe" that forwards to Trade API and iterates on min values.
 */

import type { AffixSearchDiagnostics } from '../../backend/src/services/trade-search/types';

/**
 * Request from LLM to backend trade service
 */
export interface AffixSearchRequest {
  /** Equipment slot (e.g., "body-armour", "helmet", "ring") */
  slot: string;

  /**
   * Exact stat filters with explicit IDs from KB
   * LLM reads these directly from kb/trade/slot-*.md tier tables
   */
  stats: Array<{
    /** Explicit stat ID (e.g., "explicit.stat_3299347043" for life) */
    id: string;
    /** Initial minimum value from KB tier table (e.g., 80 for T3 life) */
    min: number;
  }>;

  /** Budget constraint - primary stopping criterion */
  budget: {
    /** Maximum price in specified currency */
    max: number;
    /** Currency type */
    currency: 'chaos' | 'divine';
  };

  /** Optional item constraints */
  constraints?: {
    /** Specific base type (e.g., "Astral Plate") */
    baseType?: string;
    /** Required influences (e.g., ["shaper", "elder"]) */
    influence?: string[];
    /** Minimum item level */
    itemLevel?: number;
    /** Corrupted filter */
    corrupted?: boolean;
  };
}

/**
 * Response from backend to LLM
 */
export interface AffixSearchResponse {
  /** Whether search succeeded */
  success: boolean;

  /** Trade URL to view full results */
  tradeUrl: string;

  /** Result summary for LLM decision-making */
  results: {
    /** Total matching items */
    count: number;
    /** Lowest price found */
    minPrice: number;
    /** Median price of top results */
    medianPrice: number;
  };

  /** Top items (first 10) for presentation */
  items: Array<{
    /** Item name (e.g., "Hypnotic Essence Astral Plate") */
    name: string;
    /** Base type (e.g., "Astral Plate") */
    baseType: string;
    /** Price */
    price: {
      amount: number;
      currency: string;
    };
    /** Matched stats with actual values */
    stats: Array<{
      id: string;
      value: number;
    }>;
    /** Trade listing ID for per-item URLs */
    listingId: string;
    /** PoB-formatted item text for validation */
    pobItemText?: string;
  }>;

  /** Iteration history for transparency (all iterations) */
  iterations: Array<{
    /** Iteration step number (1-8) */
    step: number;
    /** Min values used in this iteration (stat ID → value) */
    minValues: Record<string, number>;
    /** Results returned */
    resultCount: number;
    /** Lowest price at this step */
    minPrice: number;
  }>;

  /** Guidance for LLM on next steps */
  guidance: string;

  /** Error message if success=false */
  error?: string;

  /** Ratio of budget used (0-1), calculated as minPrice / budget */
  budgetUtilization?: number;

  /** Whether LLM should consider retrying with different params */
  suggestRetry?: boolean;

  /** Specific retry suggestions when suggestRetry is true */
  retryRecommendation?: {
    reason: string;
    suggestions: string[];
  };

  /** Enhanced diagnostics for LLM decision-making (cliff detection, stat sensitivity) */
  diagnostics?: AffixSearchDiagnostics;
}

/**
 * Internal backend state for tracking optimization progress
 */
export interface IterationState {
  /** Current iteration number (1-5) */
  step: number;

  /** Current minimum values for each stat (stat ID → value) */
  minValues: Map<string, number>;

  /** History of all iterations */
  history: Array<{
    step: number;
    minValues: Record<string, number>;
    resultCount: number;
    minPrice: number;
  }>;

  /** Stopping reason (if stopped) */
  stoppedReason?: 'budget_reached' | 'market_scarcity' | 'max_iterations';
}

/**
 * Progress data emitted during each iteration of the affix search
 * Used for real-time SSE streaming to frontend
 */
export interface IterationProgressData {
  /** Current attempt number (1-indexed) - for multi-attempt searches */
  attemptNumber: number;
  /** Current iteration within attempt (0-indexed) */
  iteration: number;
  /** Maximum iterations allowed for this attempt (may change dynamically) */
  maxIterations?: number;
  /** Human-readable progress message for display */
  message: string;
  /** Time spent on this iteration in milliseconds */
  timeMs?: number;
  /** Current minimum values per affix (stat ID -> value) */
  currentMins: Record<string, number>;
  /** Number of results found at current minimum values */
  resultCount: number;
  /** Minimum price among current results (in search currency) */
  minPrice: number;
  /** Slot being searched (optional for richer UI) */
  slot?: string;
  /** Budget context for this search (optional) */
  budget?: {
    max: number;
    currency: 'chaos' | 'divine';
  };
  /** Trade URL for the current iteration (preview of what is being queried) */
  tradeUrl?: string;
}

/**
 * Callback function type for reporting iteration progress
 * The search service invokes this during each iteration loop
 */
export type IterationProgressCallback = (progress: IterationProgressData) => void;
