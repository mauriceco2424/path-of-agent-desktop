/**
 * useDesktopTrade Hook
 *
 * Custom React hook for trade operations in the desktop application.
 * Uses the Tauri API wrapper to make trade requests from the user's IP,
 * which provides each user their own rate limit quota.
 *
 * Features:
 * - Trade search with automatic item detail fetching
 * - Loading and error state management
 * - Rate limit awareness and retry logic
 * - Batch item fetching (10 items at a time per API limits)
 */

import { useState, useCallback, useRef } from 'react';
import {
  searchTrade,
  fetchItemDetails,
  TauriApiError,
} from '../services/tauri-api';
import type {
  TradeQuery,
  TradeSearchResult,
} from '../services/tauri-api';

// ============================================
// Type Definitions
// ============================================

/**
 * Trade item with full details
 */
export interface TradeItem {
  id: string;
  listing: {
    price?: {
      amount: number;
      currency: string;
    };
    account: {
      name: string;
    };
    indexed: string;
  };
  item: {
    name?: string;
    typeLine: string;
    baseType?: string;
    rarity?: string;
    ilvl?: number;
    identified?: boolean;
    explicitMods?: string[];
    implicitMods?: string[];
    craftedMods?: string[];
    fracturedMods?: string[];
    enchantMods?: string[];
    properties?: Array<{
      name: string;
      values: Array<[string, number]>;
    }>;
    sockets?: Array<{
      group: number;
      attr: string;
    }>;
  };
}

/**
 * Trade search results with items
 */
export interface TradeResults {
  queryId: string;
  total: number;
  items: TradeItem[];
  tradeUrl: string;
}

/**
 * Rate limit status information
 */
export interface RateLimitStatus {
  isLimited: boolean;
  retryAfter?: number;
  message?: string;
}

/**
 * Hook return type
 */
export interface UseDesktopTradeReturn {
  /** Execute a trade search */
  searchTrade: (
    league: string,
    query: Record<string, unknown>,
    options?: SearchOptions
  ) => Promise<TradeResults | null>;
  /** Current search results */
  results: TradeResults | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Rate limit status */
  rateLimitStatus: RateLimitStatus;
  /** Clear results and errors */
  reset: () => void;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Maximum number of items to fetch details for (default: 10) */
  maxItems?: number;
  /** Whether to auto-fetch item details (default: true) */
  fetchDetails?: boolean;
}

// ============================================
// Constants
// ============================================

/** Trade site base URL */
const TRADE_SITE_URL = 'https://www.pathofexile.com/trade';

/** Maximum items per fetch request (API limit) */
const MAX_ITEMS_PER_FETCH = 10;

/** Default number of items to fetch */
const DEFAULT_MAX_ITEMS = 10;

// ============================================
// Hook Implementation
// ============================================

/**
 * Custom hook for desktop trade operations
 *
 * @returns Trade search functions and state
 *
 * @example
 * ```tsx
 * const { searchTrade, results, loading, error } = useDesktopTrade();
 *
 * const handleSearch = async () => {
 *   const results = await searchTrade('Standard', {
 *     type: 'Helmet',
 *     stats: [{ type: 'explicit', id: 'explicit.stat_123', min: 50 }]
 *   });
 *   if (results) {
 *     console.log('Found', results.total, 'items');
 *   }
 * };
 * ```
 */
export function useDesktopTrade(): UseDesktopTradeReturn {
  const [results, setResults] = useState<TradeResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    isLimited: false,
  });

  // Track if a search is in progress to prevent race conditions
  const searchInProgressRef = useRef(false);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setResults(null);
    setError(null);
    setRateLimitStatus({ isLimited: false });
  }, []);

  /**
   * Build the trade site URL for a query ID
   */
  const buildTradeUrl = useCallback((league: string, queryId: string): string => {
    return `${TRADE_SITE_URL}/search/${encodeURIComponent(league)}/${queryId}`;
  }, []);

  /**
   * Fetch item details in batches
   */
  const fetchItemsInBatches = useCallback(
    async (
      resultIds: string[],
      queryId: string,
      maxItems: number
    ): Promise<TradeItem[]> => {
      const idsToFetch = resultIds.slice(0, Math.min(maxItems, resultIds.length));
      const items: TradeItem[] = [];

      // Fetch in batches of MAX_ITEMS_PER_FETCH
      for (let i = 0; i < idsToFetch.length; i += MAX_ITEMS_PER_FETCH) {
        const batchIds = idsToFetch.slice(i, i + MAX_ITEMS_PER_FETCH);

        try {
          const result = await fetchItemDetails(batchIds, queryId);
          items.push(...(result.result as unknown as TradeItem[]));
        } catch (err) {
          // If rate limited during fetching, return what we have
          if (err instanceof TauriApiError && err.message.includes('Rate limited')) {
            const match = err.message.match(/wait (\d+) seconds/);
            const retryAfter = match ? parseInt(match[1], 10) : 60;

            setRateLimitStatus({
              isLimited: true,
              retryAfter,
              message: `Rate limited. Please wait ${retryAfter} seconds.`,
            });

            // Return partial results
            break;
          }
          throw err;
        }
      }

      return items;
    },
    []
  );

  /**
   * Execute a trade search
   */
  const executeSearch = useCallback(
    async (
      league: string,
      query: Record<string, unknown>,
      options: SearchOptions = {}
    ): Promise<TradeResults | null> => {
      const { maxItems = DEFAULT_MAX_ITEMS, fetchDetails = true } = options;

      // Prevent concurrent searches
      if (searchInProgressRef.current) {
        return null;
      }

      searchInProgressRef.current = true;
      setLoading(true);
      setError(null);
      setRateLimitStatus({ isLimited: false });

      try {
        // Execute the search
        const tradeQuery: TradeQuery = { league, query };
        const searchResult: TradeSearchResult = await searchTrade(tradeQuery);

        const tradeUrl = buildTradeUrl(league, searchResult.id);

        // If no results or not fetching details, return early
        if (searchResult.result.length === 0 || !fetchDetails) {
          const emptyResults: TradeResults = {
            queryId: searchResult.id,
            total: searchResult.total,
            items: [],
            tradeUrl,
          };
          setResults(emptyResults);
          return emptyResults;
        }

        // Fetch item details
        const items = await fetchItemsInBatches(
          searchResult.result,
          searchResult.id,
          maxItems
        );

        const finalResults: TradeResults = {
          queryId: searchResult.id,
          total: searchResult.total,
          items,
          tradeUrl,
        };

        setResults(finalResults);
        return finalResults;
      } catch (err) {
        // Handle rate limiting
        if (err instanceof TauriApiError && err.message.includes('Rate limited')) {
          const match = err.message.match(/wait (\d+) seconds/);
          const retryAfter = match ? parseInt(match[1], 10) : 60;

          setRateLimitStatus({
            isLimited: true,
            retryAfter,
            message: `Rate limited by Trade API. Please wait ${retryAfter} seconds.`,
          });
          setError(`Rate limited. Please wait ${retryAfter} seconds and try again.`);
        } else {
          // Handle other errors
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error occurred';
          setError(errorMessage);
        }

        return null;
      } finally {
        setLoading(false);
        searchInProgressRef.current = false;
      }
    },
    [buildTradeUrl, fetchItemsInBatches]
  );

  return {
    searchTrade: executeSearch,
    results,
    loading,
    error,
    rateLimitStatus,
    reset,
  };
}

export default useDesktopTrade;
