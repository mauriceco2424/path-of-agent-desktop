/**
 * Trade Executor Service
 *
 * Core trade execution service for the desktop application.
 * Receives TradeSearchInstruction from SSE and executes trades via Tauri commands.
 *
 * Key Features:
 * - Executes trade searches from user's IP (solves rate limiting)
 * - Handles iteration logic for optimal results
 * - Coordinates with trade-iterator for adaptive step sizing
 * - Returns results in format compatible with chat UI
 *
 * Architecture:
 * - SSE receives tool_start for search_trade
 * - This service extracts search params and runs via Tauri
 * - Results are returned to the chat flow
 */

import {
  searchTrade as tauriSearchTrade,
  fetchItemDetails,
  TauriApiError,
} from './tauri-api';
import type { TradeQuery, TradeSearchResult } from './tauri-api';
import {
  calculateAdaptiveStep,
  tightenMinValues,
  loosenMinValues,
  checkStoppingConditions,
  type IteratorState,
  type IteratorProgress,
} from './trade-iterator';
import type { TradeToolResult, TradeItemDisplay } from '../../../shared/types/Chat';

// ============================================
// Type Definitions
// ============================================

/**
 * Trade search instruction from the LLM.
 * Matches the format sent via SSE tool_start events.
 */
export interface TradeSearchInstruction {
  slot: string;
  stats: Array<{ id: string; min: number; label?: string }>;
  budget: { max: number; currency: 'chaos' | 'divine' };
  constraints?: {
    baseType?: string;
    itemLevel?: number;
    corrupted?: boolean;
    influence?: string[];
  };
  searchIntent?: string;
}

/**
 * Trade execution options
 */
export interface TradeExecutionOptions {
  /** League to search in */
  league: string;
  /** Maximum iterations for tuning */
  maxIterations?: number;
  /** Maximum items to fetch */
  maxItems?: number;
  /** Progress callback for each iteration */
  onProgress?: (progress: IteratorProgress) => void;
}

/**
 * Trade execution result
 */
export interface TradeExecutionResult {
  success: boolean;
  result: TradeToolResult | null;
  error?: string;
}

// ============================================
// Constants
// ============================================

/** Trade site base URL for generating links */
const TRADE_SITE_URL = 'https://www.pathofexile.com/trade';

/** Default maximum iterations */
const DEFAULT_MAX_ITERATIONS = 5;

/** Items to fetch for response */
const DEFAULT_MAX_ITEMS = 5;

/** Maximum items per fetch request (Trade API limit) */
const MAX_ITEMS_PER_FETCH = 10;

/** Market scarcity threshold */
const MARKET_SCARCITY_THRESHOLD = 5;

// ============================================
// Slot Mappings
// ============================================

/**
 * Map PoB/display slot names to Trade API categories.
 * Matches the backend slot-mappings.ts logic.
 */
const SLOT_TO_CATEGORY: Record<string, string> = {
  // Armor slots
  'helmet': 'armour.helmet',
  'helm': 'armour.helmet',
  'body armour': 'armour.chest',
  'body-armour': 'armour.chest',
  'bodyarmour': 'armour.chest',
  'chest': 'armour.chest',
  'gloves': 'armour.gloves',
  'boots': 'armour.boots',
  // Accessories
  'belt': 'accessory.belt',
  'amulet': 'accessory.amulet',
  'ring': 'accessory.ring',
  'ring 1': 'accessory.ring',
  'ring 2': 'accessory.ring',
  // Weapons
  'weapon 1': 'weapon',
  'weapon 2': 'weapon',
  'weapon': 'weapon',
  'main hand': 'weapon',
  'off hand': 'weapon',
  'shield': 'armour.shield',
  // Other
  'quiver': 'armour.quiver',
  'flask': 'flask',
  'jewel': 'jewel',
};

function normalizeSlotToCategory(slot: string): string {
  const normalized = slot.toLowerCase().trim();
  const category = SLOT_TO_CATEGORY[normalized];
  if (!category) {
    // Default to generic category if not found
    console.warn(`[TradeExecutor] Unknown slot "${slot}", defaulting to armour`);
    return 'armour';
  }
  return category;
}

// ============================================
// Trade Executor Implementation
// ============================================

/**
 * Execute a trade search with iterative optimization.
 *
 * This is the main entry point for desktop trade execution.
 * It handles the full iteration flow including:
 * - Building Trade API queries
 * - Executing searches via Tauri (user's IP)
 * - Adaptive step sizing for optimization
 * - Fetching item details for results
 *
 * @param instruction - Trade search instruction from LLM
 * @param options - Execution options
 * @returns Trade execution result with TradeToolResult
 */
export async function executeTradeSearch(
  instruction: TradeSearchInstruction,
  options: TradeExecutionOptions
): Promise<TradeExecutionResult> {
  const {
    league,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    maxItems = DEFAULT_MAX_ITEMS,
    onProgress,
  } = options;

  console.log(`[TradeExecutor] Starting search for ${instruction.slot}`);
  console.log(`[TradeExecutor] Budget: ${instruction.budget.max} ${instruction.budget.currency}`);
  console.log(`[TradeExecutor] Stats: ${instruction.stats.map(s => `${s.id}=${s.min}`).join(', ')}`);

  // Initialize iterator state
  const state: IteratorState = {
    step: 0,
    minValues: new Map(instruction.stats.map(s => [s.id, s.min])),
    history: [],
    stoppedReason: undefined,
  };

  // Track last successful result
  let lastSearchResult: TradeSearchResult | null = null;
  let lastMinPrice = 0;
  let lastResultCount = 0;
  let lastNonZeroResult: TradeSearchResult | null = null;
  let lastNonZeroMinPrice = 0;
  let lastNonZeroCount = 0;
  let previousMinPrice = 0;
  let hasLoosened = false;

  // Main iteration loop
  while (state.step < maxIterations && !state.stoppedReason) {
    state.step++;
    console.log(`[TradeExecutor] Iteration ${state.step}/${maxIterations}`);
    const iterationStart = Date.now();

    // Build Trade API query
    const query = buildTradeQuery(instruction, state.minValues, league);

    // Execute search via Tauri
    let searchResult: TradeSearchResult;
    try {
      searchResult = await tauriSearchTrade(query);
    } catch (error) {
      console.error(`[TradeExecutor] Trade API error:`, error);

      // Check if rate limited
      if (error instanceof TauriApiError && error.message.includes('Rate limited')) {
        return {
          success: false,
          result: null,
          error: error.message,
        };
      }

      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Trade API error',
      };
    }

    const resultCount = searchResult.total;
    const tradeUrl = buildTradeUrl(league, searchResult.id);
    let minPrice = 0;

    // Fetch first item to get minimum price
    if (resultCount > 0 && searchResult.result.length > 0) {
      try {
        const firstItem = await fetchItemDetails([searchResult.result[0]], searchResult.id);
        if (firstItem.result.length > 0) {
          const listing = firstItem.result[0] as unknown as { listing?: { price?: { amount: number } } };
          minPrice = listing?.listing?.price?.amount || 0;
        }
      } catch (error) {
        console.warn(`[TradeExecutor] Failed to fetch first item for price:`, error);
      }
    }

    console.log(`[TradeExecutor] Step ${state.step}: ${resultCount} results, minPrice=${minPrice}`);
    const iterationTimeMs = Date.now() - iterationStart;

    // Handle zero results
    if (resultCount === 0 && !hasLoosened) {
      console.log(`[TradeExecutor] Zero results - applying loosen fallback`);
      hasLoosened = true;
      loosenMinValues(state.minValues);
      state.step--; // Don't count as an iteration
      continue;
    }

    // Record history
    const minValuesRecord: Record<string, number> = {};
    for (const [id, value] of state.minValues) {
      minValuesRecord[id] = value;
    }
    state.history.push({
      step: state.step,
      minValues: minValuesRecord,
      resultCount,
      minPrice,
    });

    // Emit progress
    if (onProgress) {
      onProgress({
        iteration: state.step,
        maxIterations,
        resultCount,
        minPrice,
        budget: instruction.budget.max,
        statusText: generateStatusText(state.step, resultCount, minPrice, instruction.budget.max),
        tradeUrl,
        timeMs: iterationTimeMs,
        currentFilters: {
          slot: instruction.slot,
          budget: instruction.budget.max,
          currency: instruction.budget.currency,
          stats: instruction.stats.map(s => ({
            id: s.id,
            min: state.minValues.get(s.id) || s.min,
            label: s.label,
          })),
          minPrice,
        },
      });
    }

    // Store results
    lastSearchResult = searchResult;
    lastMinPrice = minPrice;
    lastResultCount = resultCount;

    if (resultCount > 0) {
      lastNonZeroResult = searchResult;
      lastNonZeroMinPrice = minPrice;
      lastNonZeroCount = resultCount;
    }

    // Check stopping conditions
    const budgetUtilization = minPrice / instruction.budget.max;
    const stopReason = checkStoppingConditions(resultCount, minPrice, instruction.budget.max);
    if (stopReason) {
      state.stoppedReason = stopReason;
      console.log(`[TradeExecutor] Stopping: ${stopReason}`);
      break;
    }

    // Calculate adaptive step and tighten
    const stepPercent = calculateAdaptiveStep(budgetUtilization);
    console.log(`[TradeExecutor] Using adaptive step: ${(stepPercent * 100).toFixed(0)}%`);
    tightenMinValues(state.minValues, stepPercent);

    previousMinPrice = minPrice;
  }

  // Check max iterations
  if (!state.stoppedReason && state.step >= maxIterations) {
    state.stoppedReason = 'max_iterations';
    console.log(`[TradeExecutor] Stopping: max iterations reached`);
  }

  // Fall back to last non-zero result if final iteration was empty
  if (lastResultCount === 0 && lastNonZeroResult) {
    console.log('[TradeExecutor] Final iteration returned 0; falling back to last non-zero');
    lastSearchResult = lastNonZeroResult;
    lastMinPrice = lastNonZeroMinPrice;
    lastResultCount = lastNonZeroCount;
  }

  // Build final result
  if (!lastSearchResult) {
    return {
      success: false,
      result: null,
      error: 'No results found after all iterations',
    };
  }

  // Fetch items for response
  const items = await fetchTradeItems(lastSearchResult, maxItems);
  const tradeUrl = buildTradeUrl(league, lastSearchResult.id);

  const result: TradeToolResult = {
    tool: 'search_trade',
    success: true,
    tradeUrl,
    totalResults: lastResultCount,
    listings: items,
    slot: instruction.slot,
    budget: instruction.budget,
    minPrice: lastMinPrice,
    budgetUtilization: instruction.budget.max > 0 ? lastMinPrice / instruction.budget.max : 0,
    iterations: state.history,
    guidance: generateGuidance(state, lastResultCount, lastMinPrice, instruction.budget.max, hasLoosened),
    searchIntent: instruction.searchIntent,
  };

  return { success: true, result };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build a Trade API query from instruction and current min values.
 */
function buildTradeQuery(
  instruction: TradeSearchInstruction,
  minValues: Map<string, number>,
  league: string
): TradeQuery {
  const statFilters: Array<{ id: string; value: { min: number } }> = [];

  for (const [statId, minValue] of minValues) {
    statFilters.push({
      id: statId,
      value: { min: minValue },
    });
  }

  const query: Record<string, unknown> = {
    query: {
      status: { option: 'any' },
      stats: statFilters.length > 0 ? [{
        type: 'and',
        filters: statFilters,
      }] : undefined,
      filters: {
        type_filters: {
          filters: {
            category: { option: normalizeSlotToCategory(instruction.slot) },
            rarity: { option: 'rare' },
          },
        },
        trade_filters: {
          filters: {
            price: {
              max: instruction.budget.max,
              option: instruction.budget.currency,
            },
          },
        },
      },
    },
    sort: { price: 'asc' },
  };

  // Add constraints
  if (instruction.constraints) {
    const constraints = instruction.constraints;
    const queryObj = query.query as Record<string, unknown>;
    const filters = queryObj.filters as Record<string, unknown>;

    if (constraints.baseType) {
      queryObj.type = constraints.baseType;
    }

    if (constraints.itemLevel || constraints.corrupted !== undefined || constraints.influence) {
      const miscFilters: Record<string, unknown> = { filters: {} };
      const miscFiltersObj = miscFilters.filters as Record<string, unknown>;

      if (constraints.itemLevel) {
        miscFiltersObj.ilvl = { min: constraints.itemLevel };
      }

      if (constraints.corrupted !== undefined) {
        miscFiltersObj.corrupted = { option: constraints.corrupted };
      }

      if (constraints.influence) {
        for (const influence of constraints.influence) {
          miscFiltersObj[`${influence}_item`] = { option: true };
        }
      }

      filters.misc_filters = miscFilters;
    }
  }

  return { league, query };
}

/**
 * Build a trade site URL from league and query ID.
 */
function buildTradeUrl(league: string, queryId: string): string {
  return `${TRADE_SITE_URL}/search/${encodeURIComponent(league)}/${queryId}`;
}

/**
 * Fetch trade items from search results.
 */
async function fetchTradeItems(
  searchResult: TradeSearchResult,
  maxItems: number
): Promise<TradeItemDisplay[]> {
  const items: TradeItemDisplay[] = [];

  if (searchResult.result.length === 0) {
    return items;
  }

  const idsToFetch = searchResult.result.slice(0, Math.min(maxItems, MAX_ITEMS_PER_FETCH));

  try {
    const fetchResult = await fetchItemDetails(idsToFetch, searchResult.id);

    for (const rawItem of fetchResult.result) {
      const item = rawItem as Record<string, unknown>;
      const itemData = item.item as Record<string, unknown> | undefined;
      const listing = item.listing as Record<string, unknown> | undefined;
      const price = listing?.price as { amount: number; currency: string } | undefined;

      if (!itemData || !price) continue;

      items.push({
        name: formatItemName(itemData),
        baseType: (itemData.typeLine as string) || 'Unknown',
        price: {
          amount: price.amount,
          currency: price.currency,
        },
        matchedStats: extractMatchedStats(itemData),
        listingId: item.id as string,
      });
    }
  } catch (error) {
    console.error(`[TradeExecutor] Failed to fetch items:`, error);
  }

  return items;
}

/**
 * Format item name from trade result.
 */
function formatItemName(item: Record<string, unknown>): string {
  const name = item.name as string | undefined;
  const typeLine = item.typeLine as string | undefined;

  if (name && typeLine) {
    return `${name} ${typeLine}`.trim();
  }
  return typeLine || 'Unknown Item';
}

/**
 * Extract matched stats from item.
 */
function extractMatchedStats(item: Record<string, unknown>): string[] {
  const stats: string[] = [];

  const explicitMods = item.explicitMods as string[] | undefined;
  if (explicitMods) {
    stats.push(...explicitMods.slice(0, 3));
  }

  return stats;
}

/**
 * Generate status text for iteration progress.
 */
function generateStatusText(
  step: number,
  resultCount: number,
  minPrice: number,
  budget: number
): string {
  if (step === 1) {
    return `Searching... found ${resultCount} results, minimum ${minPrice}c`;
  }

  if (minPrice >= budget * 0.8) {
    return `Budget limit approaching: ${resultCount} results, minimum ${minPrice}c`;
  }

  if (resultCount < 10) {
    return `Market thinning: ${resultCount} results, minimum ${minPrice}c`;
  }

  return `Tightening requirements: ${resultCount} results, minimum ${minPrice}c`;
}

/**
 * Generate guidance text for LLM.
 */
function generateGuidance(
  state: IteratorState,
  resultCount: number,
  minPrice: number,
  budget: number,
  hasLoosened: boolean
): string {
  const parts: string[] = [];

  parts.push(`Performed ${state.step} iteration(s).`);

  if (hasLoosened) {
    parts.push('Loosened requirements by 20% after initial zero results.');
  }

  const utilization = budget > 0 ? minPrice / budget : 0;
  const utilizationPct = (utilization * 100).toFixed(0);

  switch (state.stoppedReason) {
    case 'budget_reached':
      parts.push(`Stopped because minimum price (${minPrice}) approached budget limit (${budget}).`);
      break;
    case 'market_scarcity':
      parts.push(`Stopped due to market scarcity (only ${resultCount} results).`);
      break;
    case 'max_iterations':
      parts.push(`Reached maximum iterations.`);
      if (utilization < 0.50) {
        parts.push(`Budget underutilized (${utilizationPct}%).`);
      }
      break;
    default:
      parts.push('Search completed normally.');
  }

  if (minPrice > 0) {
    parts.push(`Budget utilization: ${utilizationPct}% (${minPrice}/${budget}).`);
  }

  return parts.join(' ');
}
