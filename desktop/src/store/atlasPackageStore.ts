/**
 * Atlas Package Store
 *
 * Lightweight Zustand store that maps atlas refs (AT1, AT2...) to their
 * suggested node data. Populated at SSE receive time from suggest_atlas_path
 * tool results. Consumed by AtlasPill for hover tooltips and "Show on Atlas"
 * click behavior.
 */

import { create } from 'zustand';

export interface AtlasPackageData {
  ref: string;
  label: string;
  suggestedNodes: number[];
  breakdown?: { travel: number; notables: number; keystones: number };
  reachedTargets?: string[];
}

interface AtlasPackageStore {
  packages: Map<string, AtlasPackageData>;
  registerPackage: (data: AtlasPackageData) => void;
  clearPackages: () => void;
}

export const useAtlasPackageStore = create<AtlasPackageStore>((set) => ({
  packages: new Map(),

  registerPackage: (data) =>
    set((state) => {
      const next = new Map(state.packages);
      next.set(data.ref.toLowerCase(), data);
      return { packages: next };
    }),

  clearPackages: () => set({ packages: new Map() }),
}));

/** Selector hook for a single atlas package by ref */
export function useAtlasPackage(ref: string): AtlasPackageData | undefined {
  return useAtlasPackageStore((s) => s.packages.get(ref.toLowerCase()));
}

// =============================================================================
// SSE-time hydration — called when tool_result arrives for suggest_atlas_path
// =============================================================================

interface AtlasPathResult {
  ref?: string;
  label?: string;
  suggestedNodes?: number[];
  breakdown?: { travel: number; notables: number; keystones: number };
  reachedTargets?: string[];
}

/**
 * Hydrate atlas package store from a suggest_atlas_path tool_result SSE event.
 */
export function hydrateAtlasPackagesFromToolResult(data: Record<string, unknown>): void {
  const result = data as AtlasPathResult;
  const ref = result.ref;
  if (!ref || !ref.toUpperCase().startsWith('AT')) return;

  const { registerPackage } = useAtlasPackageStore.getState();
  registerPackage({
    ref,
    label: result.label ?? ref,
    suggestedNodes: result.suggestedNodes ?? [],
    breakdown: result.breakdown,
    reachedTargets: result.reachedTargets,
  });
}
