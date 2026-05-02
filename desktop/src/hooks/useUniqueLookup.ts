/**
 * useUniqueLookup Hook
 *
 * Fetches the unique item lookup table from the backend once and caches it
 * at the module level. All unique item tooltip data is available
 * synchronously after the initial load.
 */

import { useState, useEffect } from 'react';
import { callBackend } from '../services/tauri-api';

export interface UniqueTooltipPayload {
  name: string;
  baseType: string;
  slot: string;
  implicits: string[];
  explicits: Array<{ text: string }>;
}

// Module-level cache so we only fetch once across all component instances
let cachedUniqueMap: Map<string, UniqueTooltipPayload> | null = null;
let fetchPromise: Promise<Map<string, UniqueTooltipPayload>> | null = null;

async function fetchUniqueLookup(): Promise<Map<string, UniqueTooltipPayload>> {
  const raw = await callBackend<Record<string, UniqueTooltipPayload>>('/api/v1/unique-lookup', 'GET');
  const map = new Map<string, UniqueTooltipPayload>();
  for (const [name, payload] of Object.entries(raw)) {
    map.set(name, payload);
  }
  return map;
}

const EMPTY_MAP = new Map<string, UniqueTooltipPayload>();

export function useUniqueLookup() {
  const [uniqueMap, setUniqueMap] = useState<Map<string, UniqueTooltipPayload>>(cachedUniqueMap ?? EMPTY_MAP);
  const [ready, setReady] = useState(cachedUniqueMap !== null);

  useEffect(() => {
    if (cachedUniqueMap) {
      setUniqueMap(cachedUniqueMap);
      setReady(true);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchUniqueLookup();
    }

    let mounted = true;
    fetchPromise
      .then((map) => {
        cachedUniqueMap = map;
        if (mounted) {
          setUniqueMap(map);
          setReady(true);
        }
      })
      .catch((err) => {
        console.error('[useUniqueLookup] Failed to fetch unique lookup:', err);
        fetchPromise = null;
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { uniqueMap, ready };
}
