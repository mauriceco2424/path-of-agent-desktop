/**
 * useStashOverview Hook
 *
 * Fetches stash overview data via SSE from the backend sidecar.
 * Caches results in state for instant re-opens.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDesktopStore } from '../../../store';
import type { StashOverviewData, StashOverviewEvent } from '../../../../../shared/types/StashOverview';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';

export interface StashOverviewProgress {
  tabsScanned: number;
  totalTabs: number;
  currentTab: string;
}

export interface UseStashOverviewResult {
  data: StashOverviewData | null;
  isLoading: boolean;
  progress: StashOverviewProgress | null;
  error: string | null;
  refetch: () => void;
}

export function useStashOverview(enabled: boolean): UseStashOverviewResult {
  const [data, setData] = useState<StashOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<StashOverviewProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    const gggAccessToken = useDesktopStore.getState().gggAccessToken;
    if (!gggAccessToken) {
      setError('Not logged in with PoE. Log in via OAuth to view stash data.');
      return;
    }

    // Skip if already have data and not forcing refresh
    if (!force && data) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      const url = `${BACKEND_URL}/api/v1/stash/overview?league=Mirage`;

      const response = await fetch(url, {
        method: 'GET',
        // Token in header, not query — prevents leakage to access logs / dev.log
        headers: { Authorization: `Bearer ${gggAccessToken}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stash fetch failed: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? ''; // Keep incomplete event in buffer

        for (const eventStr of events) {
          const line = eventStr.trim();
          if (!line.startsWith('data: ')) continue;

          try {
            const event: StashOverviewEvent = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              setProgress({
                tabsScanned: event.tabsScanned,
                totalTabs: event.totalTabs,
                currentTab: event.currentTab,
              });
            } else if (event.type === 'complete') {
              setData(event.data);
              setProgress(null);
            } else if (event.type === 'error') {
              setError(event.message);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Failed to fetch stash overview');
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  // Auto-fetch when enabled and no data yet
  useEffect(() => {
    if (enabled && !data && !isLoading && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchData();
    }
  }, [enabled, data, isLoading, fetchData]);

  // Reset fetchedRef when disabled so we can re-fetch on next enable
  useEffect(() => {
    if (!enabled) {
      fetchedRef.current = false;
    }
  }, [enabled]);

  const refetch = useCallback(() => {
    fetchedRef.current = true;
    fetchData(true);
  }, [fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { data, isLoading, progress, error, refetch };
}
