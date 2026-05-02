/**
 * useLadderData Hook
 *
 * Manages the full lifecycle of on-demand ladder data fetching:
 * 1. Checks if cached ladder data exists for the current build
 * 2. Provides controls to start/cancel SSE-based ladder fetching
 * 3. Tracks progress, stats, and completion state via Zustand store
 *
 * State is persisted in the Zustand store (ladderStatus, ladderStats)
 * so it survives tab navigation within the session.
 *
 * @module desktop/src/hooks/useLadderData
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesktopStore } from '../store';
import { fetchLadderDataStream } from '../services/sse-client';
import type {
  LadderStatusResponse,
  LadderStatsSummary,
  LadderFetchProgressEvent,
  LadderFetchCompleteEvent,
} from '../../../shared/types/LadderData';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';

// ============================================
// Hook Return Type
// ============================================

export interface UseLadderDataResult {
  /** Ladder status from backend (cached data info, available count) */
  status: LadderStatusResponse | null;
  /** Aggregated ladder statistics (benchmarks, top keystones, etc.) */
  stats: LadderStatsSummary | null;
  /** Current fetch progress event (phase, current/total, message) */
  progress: LadderFetchProgressEvent | null;
  /** Whether a ladder fetch is currently in progress */
  isFetching: boolean;
  /** Whether the initial status check is loading */
  isLoading: boolean;
  /** User-selected fetch size (null = skip/not selected) */
  selectedSize: 10 | 20 | 30 | 50 | 100 | null;
  /** Set the target fetch size */
  setSelectedSize: (size: 10 | 20 | 30 | 50 | 100 | null) => void;
  /** Start fetching ladder data via SSE stream. Pass freshFetch=true to discard cached builds. */
  startFetch: (freshFetch?: boolean) => Promise<void>;
  /** Cancel an in-progress fetch */
  cancelFetch: () => void;
  /** Re-check ladder status from backend */
  refreshStatus: () => Promise<void>;
  /** Error message from the last fetch attempt (null if no error) */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
}

// ============================================
// Main Hook
// ============================================

export interface UseLadderDataOptions {
  /** Main skill name — used as fallback when build not in sidecar memory */
  skill?: string;
  /** Ascendancy name — used as fallback when build not in sidecar memory */
  ascendancy?: string;
  /** Character level — used as fallback when build not in sidecar memory */
  level?: number;
  /**
   * When false, the hook checks cached status but skips auto-fetch.
   * Use this to delay ladder fetching until after visualization completes,
   * preventing concurrent GGG API calls that cause rate limiting on GGG imports.
   */
  ready?: boolean;
}

export function useLadderData(buildId: string | null, options?: UseLadderDataOptions): UseLadderDataResult {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref to hold fetchStatus so startFetchWithSize can call it without circular deps
  const fetchStatusRef = useRef<(id: string) => Promise<void>>(null);
  // Guard against double auto-fetch (status check can fire twice during mount)
  const autoFetchTriggeredRef = useRef<string | null>(null);
  // L2 skill correction: when the backend corrects the skill for ladder lookup,
  // store it here so subsequent fetch/status calls use the corrected name
  const correctedSkillRef = useRef<string | null>(null);

  // Select ladder state from store using shallow comparison
  const {
    ladderStatus,
    ladderFetchProgress,
    ladderStats,
    isLadderFetching,
    selectedLadderFetchSize,
    ladderFetchError,
    setLadderStatus,
    setLadderFetchProgress,
    setLadderStats,
    setIsLadderFetching,
    setSelectedLadderFetchSize,
    setLadderFetchError,
    resetLadderState,
  } = useDesktopStore(
    useShallow((state) => ({
      ladderStatus: state.ladderStatus,
      ladderFetchProgress: state.ladderFetchProgress,
      ladderStats: state.ladderStats,
      isLadderFetching: state.isLadderFetching,
      selectedLadderFetchSize: state.selectedLadderFetchSize,
      ladderFetchError: state.ladderFetchError,
      setLadderStatus: state.setLadderStatus,
      setLadderFetchProgress: state.setLadderFetchProgress,
      setLadderStats: state.setLadderStats,
      setIsLadderFetching: state.setIsLadderFetching,
      setSelectedLadderFetchSize: state.setSelectedLadderFetchSize,
      setLadderFetchError: state.setLadderFetchError,
      resetLadderState: state.resetLadderState,
    }))
  );

  // Internal: start fetch with an explicit size (bypasses store selectedSize check).
  // Used by auto-fetch and by the public startFetch.
  const startFetchWithSize = useCallback(async (id: string, size: 10 | 20 | 30 | 50 | 100, freshFetch?: boolean) => {
    // Abort any existing fetch
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSelectedLadderFetchSize(size);
    setIsLadderFetching(true);
    setLadderFetchProgress(null);
    setLadderFetchError(null);

    await fetchLadderDataStream(
      id,
      size,
      // onProgress
      (event) => {
        setLadderFetchProgress(event);
      },
      // onStats
      (event) => {
        setLadderStats(event.stats);
      },
      // onComplete
      (event: LadderFetchCompleteEvent) => {
        setIsLadderFetching(false);
        setLadderFetchProgress(null);
        // Detect partial success: some builds were skipped
        if (event.skippedCount && event.skippedCount > 0 && event.targetCount && event.buildCount < event.targetCount) {
          setLadderFetchError(
            `Fetched ${event.buildCount} of ${event.targetCount} builds (${event.skippedCount} skipped due to private profiles or errors).`
          );
        } else {
          setLadderFetchError(null);
        }
        // Refresh status to get the latest cached data (via ref to avoid circular dep)
        fetchStatusRef.current?.(id);
      },
      // onError
      (errorMessage) => {
        console.error('[useLadderData] Fetch error:', errorMessage);
        setLadderFetchError(errorMessage);
        setIsLadderFetching(false);
        setLadderFetchProgress(null);
      },
      controller.signal,
      freshFetch,
      // Pass build context as fallback when build not in sidecar memory.
      // Prefer L2-corrected skill if available (from ladder-status response).
      { skill: correctedSkillRef.current || options?.skill, ascendancy: options?.ascendancy, level: options?.level },
    );
  }, [
    setSelectedLadderFetchSize,
    setIsLadderFetching,
    setLadderFetchProgress,
    setLadderFetchError,
    setLadderStats,
    options?.skill,
    options?.ascendancy,
    options?.level,
  ]);

  // Fetch ladder status from backend
  const fetchStatus = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // Include skill/ascendancy/level as query params so the endpoint works
      // even when the build isn't in the sidecar's in-memory store (e.g. after restart).
      // Prefer L2-corrected skill if available from a previous status check.
      const params = new URLSearchParams();
      const effectiveSkill = correctedSkillRef.current || options?.skill;
      if (effectiveSkill) params.set('skill', effectiveSkill);
      if (options?.ascendancy) params.set('ascendancy', options.ascendancy);
      if (options?.level) params.set('level', String(options.level));
      const qs = params.toString();
      const response = await fetch(
        `${BACKEND_URL}/api/v1/builds/${id}/ladder-status${qs ? `?${qs}` : ''}`
      );

      if (!response.ok) {
        console.error('[useLadderData] Status check failed:', response.status);
        // Don't clear existing status on error — keep showing cached data
        return;
      }

      const data: LadderStatusResponse = await response.json();
      setLadderStatus(data);

      // L2 skill correction: if backend corrected the skill for ladder lookup,
      // store it so subsequent fetch calls use the corrected name
      if (data.correctedSkill) {
        correctedSkillRef.current = data.correctedSkill;
        console.log(`[useLadderData] Skill corrected for ladder: ${data.correctedFrom} → ${data.correctedSkill}`);
      }

      // If cached data exists with stats, populate the stats in store
      if (data.exists && data.stats) {
        setLadderStats(data.stats);
      }

      // Auto-fetch: ensure we always have 50 builds cached, or refetch if stale.
      // Staleness: backend detects when user DPS/EHP/level exceeds ladder averages.
      const cachedCount = data.buildCount ?? 0;
      const needsFetch = !data.exists || cachedCount < 50;
      const isStale = data.stale === true;

      // Gate auto-fetch on `ready` flag to prevent concurrent GGG API calls.
      // GGG character imports and ladder fetches both hit the GGG API — running
      // them simultaneously causes rate limiting and incomplete data.
      // When ready=false, we still check status (above) but defer the actual fetch.
      const isReady = options?.ready !== false; // default true for backward compat
      if ((needsFetch || isStale) && isReady && autoFetchTriggeredRef.current !== id) {
        autoFetchTriggeredRef.current = id;
        const reason = !data.exists ? 'No cached data'
          : isStale ? `Stale: ${data.staleReason ?? 'user outgrew ladder benchmarks'}`
          : `Only ${cachedCount} builds cached`;
        console.log(`[useLadderData] ${reason} — auto-starting ladder fetch (50 builds)`);
        startFetchWithSize(id, 50, isStale);
      }
    } catch (err) {
      console.error('[useLadderData] Failed to check ladder status:', err);
      // Don't clear existing status on error — keep showing cached data
    } finally {
      setIsLoading(false);
    }
  }, [setLadderStatus, setLadderStats, options?.skill, options?.ascendancy, options?.level, options?.ready, startFetchWithSize]);

  // Keep ref in sync so startFetchWithSize onComplete can call fetchStatus
  fetchStatusRef.current = fetchStatus;

  // Auto-check status on mount / when buildId changes / when ready becomes true.
  // Note: ladder state is already reset by setBuild() in the store,
  // so we don't call resetLadderState() here — doing so would trigger
  // an extra Zustand update → re-render → duplicate API calls.
  const isReady = options?.ready !== false;
  useEffect(() => {
    if (!buildId) return;
    // Skip placeholder buildIds from session restore — real ID arrives shortly
    if (buildId.startsWith('restoring-')) return;
    // Reset auto-fetch guard and L2 skill correction when build changes
    // (but not when ready toggles — we want the deferred auto-fetch to fire once ready becomes true)
    if (!isReady) {
      autoFetchTriggeredRef.current = null;
      correctedSkillRef.current = null;
    }

    fetchStatus(buildId);
  }, [buildId, isReady, fetchStatus]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Refresh status (callable externally)
  const refreshStatus = useCallback(async () => {
    if (!buildId) return;
    await fetchStatus(buildId);
  }, [buildId, fetchStatus]);

  // Start ladder data fetch via SSE (public API — uses store selectedSize or defaults to 50)
  const startFetch = useCallback(async (freshFetch?: boolean) => {
    if (!buildId) return;
    const size = selectedLadderFetchSize ?? 50;
    await startFetchWithSize(buildId, size, freshFetch);
  }, [buildId, selectedLadderFetchSize, startFetchWithSize]);

  // Cancel in-progress fetch
  const cancelFetch = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLadderFetching(false);
    setLadderFetchProgress(null);
  }, [setIsLadderFetching, setLadderFetchProgress]);

  // Clear error state
  const clearError = useCallback(() => {
    setLadderFetchError(null);
  }, [setLadderFetchError]);

  return {
    status: ladderStatus,
    stats: ladderStats,
    progress: ladderFetchProgress,
    isFetching: isLadderFetching,
    isLoading,
    selectedSize: selectedLadderFetchSize,
    setSelectedSize: setSelectedLadderFetchSize,
    startFetch,
    cancelFetch,
    refreshStatus,
    error: ladderFetchError,
    clearError,
  };
}
