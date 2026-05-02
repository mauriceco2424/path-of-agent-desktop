/**
 * useLadderBenchmarks Hook
 *
 * Fetches full ladder statistics (all 16 categories) from the backend
 * for display in the LadderBenchmarksModal. Uses the dedicated
 * /api/v1/builds/:id/ladder-stats-full endpoint which returns the
 * complete CachedLadderStats structure.
 *
 * Returns { data, isLoading, error } with proper TypeScript types.
 */

import { useState, useEffect, useCallback } from 'react';
import { callBackend } from '../../../services/tauri-api';
import type { CachedLadderStats, ProgressionData } from '../../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

export interface LadderStatsFullResponse {
  exists: boolean;
  skill: string;
  ascendancy: string;
  buildCount?: number;
  fetchedAt?: string;
  league?: string;
  stats?: CachedLadderStats;
  levelRange?: { min: number; max: number };
  /** Structured progression profile (tier trajectory, transitions, core items) */
  progressionData?: ProgressionData;
}

export interface UseLadderBenchmarksResult {
  data: LadderStatsFullResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export interface UseLadderBenchmarksOptions {
  /** Main skill name — fallback when build not in sidecar memory */
  skill?: string;
  /** Ascendancy name — fallback when build not in sidecar memory */
  ascendancy?: string;
}

export function useLadderBenchmarks(
  buildId: string | null,
  enabled: boolean,
  options?: UseLadderBenchmarksOptions,
): UseLadderBenchmarksResult {
  const [data, setData] = useState<LadderStatsFullResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!buildId) return;

    setData(null);
    setIsLoading(true);
    setError(null);

    try {
      // Include skill/ascendancy as query params so the endpoint works
      // even when the build isn't in the sidecar's in-memory store
      const params = new URLSearchParams();
      if (options?.skill) params.set('skill', options.skill);
      if (options?.ascendancy) params.set('ascendancy', options.ascendancy);
      const qs = params.toString();
      const response = await callBackend<LadderStatsFullResponse>(
        `/api/v1/builds/${buildId}/ladder-stats-full${qs ? `?${qs}` : ''}`,
        'GET'
      );

      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ladder data';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [buildId, options?.skill, options?.ascendancy]);

  useEffect(() => {
    if (enabled && buildId) {
      fetchData();
    }
  }, [enabled, buildId, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
