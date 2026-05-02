/**
 * useMetaIntel — Fetch hook for the Meta Intel daily digest.
 *
 * Calls GET /api/v1/intel/daily on the REMOTE server (api.pathofagent.com),
 * not the local sidecar — intel data only exists on the production server.
 * Supports fetching multiple days (last 7 days by default).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// Types
// ============================================

export interface IntelBuildInfo {
  skill: string;
  ascendancy: string;
  budget: string;
  keyUniques: string[];
  playstyle: string;
}

export interface IntelItem {
  title: string;
  url: string;
  source: 'youtube' | 'reddit' | 'forum' | 'article';
  author: string;
  category: string;
  subcategory?: string;
  relevance: number;
  publishedDate: string;
  ingestedAt: string;
  tags: string[];
  summary: string;
  keyTakeaways: string[];
  buildInfo?: IntelBuildInfo;
}

export interface IntelDigest {
  date: string;
  itemCount: number;
  categories: Record<string, number>;
  items: IntelItem[];
}

interface UseMetaIntelResult {
  digests: IntelDigest[];
  allItems: IntelItem[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  availableDays: string[];
}

// ============================================
// Constants
// ============================================

// Intel lives on the production server, not the local sidecar
const REMOTE_API_URL =
  import.meta.env.VITE_REMOTE_API_URL || 'https://api.pathofagent.com';

// In dev mode, fall back to local backend (which serves sample data)
const INTEL_API_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876')
  : REMOTE_API_URL;

const DAYS_TO_FETCH = 7;

function formatDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ============================================
// Hook
// ============================================

export function useMetaIntel(): UseMetaIntelResult {
  const [digests, setDigests] = useState<IntelDigest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchDigests(): Promise<void> {
      setLoading(true);
      setError(null);
      console.log('[MetaIntel] Starting fetch from:', INTEL_API_URL);

      try {
        // Fetch each day sequentially to avoid abort issues
        const dates = Array.from({ length: DAYS_TO_FETCH }, (_, i) => formatDate(i));
        console.log('[MetaIntel] Fetching dates:', dates);
        const validDigests: IntelDigest[] = [];

        for (const date of dates) {
          if (cancelled) break;
          try {
            const url = `${INTEL_API_URL}/api/v1/intel/daily?date=${date}`;
            console.log('[MetaIntel] Fetching:', url);
            const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
            console.log('[MetaIntel] Response:', resp.status, resp.statusText);
            if (!resp.ok) { console.log('[MetaIntel] Skipping non-OK response'); continue; }
            const data: unknown = await resp.json();
            console.log('[MetaIntel] Data for', date, ':', (data as Record<string, unknown>).itemCount, 'items');
            if (
              typeof data === 'object' &&
              data !== null &&
              'items' in data &&
              Array.isArray((data as Record<string, unknown>).items)
            ) {
              const digest = data as IntelDigest;
              if (digest.itemCount > 0) {
                validDigests.push(digest);
              }
            }
          } catch {
            // Skip failed days
          }
          // Show results progressively — update after first successful day
          if (validDigests.length > 0 && !cancelled) {
            setDigests([...validDigests]);
            setLoading(false);
          }
        }

        if (cancelled) return;
        console.log('[MetaIntel] Final digests:', validDigests.length, 'days with data');
        setDigests(validDigests);
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof DOMException && err.name === 'AbortError'
            ? 'Request timed out'
            : err instanceof Error
              ? err.message
              : 'Unknown error fetching intel digest';

        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDigests();
    return () => { cancelled = true; };
  }, [fetchKey]);

  // Derive current view from selected day
  const currentDigest = digests[selectedDay] ?? null;
  const allItems = currentDigest?.items ?? [];
  const totalCount = digests.reduce((sum, d) => sum + d.itemCount, 0);
  const availableDays = digests.map((d) => d.date);

  return {
    digests,
    allItems,
    totalCount,
    loading,
    error,
    refetch,
    selectedDay,
    setSelectedDay,
    availableDays,
  };
}
