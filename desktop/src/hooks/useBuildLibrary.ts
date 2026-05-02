/**
 * useBuildLibrary — fetch helpers for the build library list and detail pages.
 *
 * Two hooks:
 *   - `useBuildLibraryList()` — fetches the summary list once on mount
 *   - `useBuildGuide(slug)`  — fetches a single guide when the slug changes
 *
 * Both follow the cancellation-token pattern (react-component-patterns §8) so
 * unmounting mid-fetch never updates state.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  BuildGuide,
  BuildGuideSummary,
} from '@shared/types/build-library';
import {
  BuildLibraryApiError,
  getBuildGuide,
  listBuildGuides,
} from '../services/build-library-api';

// =============================================================================
// List hook
// =============================================================================

export interface UseBuildLibraryListResult {
  guides: BuildGuideSummary[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useBuildLibraryList(): UseBuildLibraryListResult {
  const [guides, setGuides] = useState<BuildGuideSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchList(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listBuildGuides(controller.signal);
        if (!cancelled) {
          setGuides(result);
          setIsLoading(false);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError' || cancelled) return;
        const message =
          err instanceof BuildLibraryApiError
            ? err.message
            : `Failed to load build library: ${(err as Error).message}`;
        setError(message);
        setIsLoading(false);
      }
    }

    void fetchList();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  return {
    guides,
    isLoading,
    error,
    reload: () => setReloadToken((t) => t + 1),
  };
}

// =============================================================================
// Single-guide hook
// =============================================================================

export interface UseBuildGuideResult {
  guide: BuildGuide | null;
  isLoading: boolean;
  /** True iff the backend returned 404 — distinguishes "not found" from network errors */
  notFound: boolean;
  error: string | null;
}

export function useBuildGuide(slug: string | undefined): UseBuildGuideResult {
  const [guide, setGuide] = useState<BuildGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSlugRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!slug) {
      setGuide(null);
      setIsLoading(false);
      setNotFound(false);
      setError(null);
      return;
    }

    // Reset state on slug change so the user never sees the previous guide
    // briefly while the new one loads.
    if (lastSlugRef.current !== slug) {
      setGuide(null);
      setNotFound(false);
      setError(null);
      lastSlugRef.current = slug;
    }
    setIsLoading(true);

    const controller = new AbortController();
    let cancelled = false;

    async function fetchGuide(): Promise<void> {
      try {
        const result = await getBuildGuide(slug as string, controller.signal);
        if (cancelled) return;
        if (result === null) {
          setNotFound(true);
          setGuide(null);
        } else {
          setGuide(result);
          setNotFound(false);
        }
        setIsLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || cancelled) return;
        const message =
          err instanceof BuildLibraryApiError
            ? err.message
            : `Failed to load build guide: ${(err as Error).message}`;
        setError(message);
        setIsLoading(false);
      }
    }

    void fetchGuide();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug]);

  return { guide, isLoading, notFound, error };
}
