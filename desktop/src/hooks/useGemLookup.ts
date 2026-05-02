/**
 * useGemLookup Hook
 *
 * Fetches the gem lookup table from the backend once and caches it
 * at the module level. All skill gem tooltip data is available
 * synchronously after the initial load.
 */

import { useState, useEffect } from 'react';
import { callBackend } from '../services/tauri-api';

export interface GemTooltipPayload {
  description: string | null;
  statText: string[];
  gemTags: string[];
  isSupport: boolean;
  color: string; // 'r', 'g', 'b', 'd'
  iconUrl: string;
  manaCost: number | null;
  manaReservation: number | null;
  lifeReservation: number | null;
  requirements?: {
    level?: number | null;
    str?: number | null;
    dex?: number | null;
    int?: number | null;
  };
  costMultiplier: number | null;
  damageEffectiveness: number | null;
}

// Module-level cache so we only fetch once across all component instances
let cachedGemMap: Map<string, GemTooltipPayload> | null = null;
let fetchPromise: Promise<Map<string, GemTooltipPayload>> | null = null;

async function fetchGemLookup(): Promise<Map<string, GemTooltipPayload>> {
  const raw = await callBackend<Record<string, GemTooltipPayload>>('/api/v1/gem-lookup', 'GET');
  const map = new Map<string, GemTooltipPayload>();
  for (const [name, payload] of Object.entries(raw)) {
    map.set(name, payload);
  }
  return map;
}

const EMPTY_MAP = new Map<string, GemTooltipPayload>();

export function useGemLookup() {
  const [gemMap, setGemMap] = useState<Map<string, GemTooltipPayload>>(cachedGemMap ?? EMPTY_MAP);
  const [ready, setReady] = useState(cachedGemMap !== null);

  useEffect(() => {
    if (cachedGemMap) {
      setGemMap(cachedGemMap);
      setReady(true);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchGemLookup();
    }

    let mounted = true;
    fetchPromise
      .then((map) => {
        cachedGemMap = map;
        if (mounted) {
          setGemMap(map);
          setReady(true);
        }
      })
      .catch((err) => {
        console.error('[useGemLookup] Failed to fetch gem lookup:', err);
        fetchPromise = null;
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { gemMap, ready };
}
