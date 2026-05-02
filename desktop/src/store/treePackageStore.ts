/**
 * Tree Package Store
 *
 * Lightweight Zustand store that maps tree refs (TR1, TR2...) to their
 * node change data. Populated at SSE receive time from batch_test_tree /
 * test_unified_build results. Consumed by TreePill for hover tooltips
 * and "Show on Tree" click behavior.
 */

import { create } from 'zustand';

/**
 * Cluster subgraph node data for preview rendering of suggested cluster jewels.
 * Mirrors the shape of ClusterNodeData from vizData.tree.clusterNodes so the
 * canvas can merge both arrays and reuse its existing render path.
 */
export interface PreviewClusterNode {
  id: number;
  name: string;
  type: string;
  stats?: string[];
  icon?: string;
  x: number;
  y: number;
  orbit?: number;
  orbitIndex?: number;
  isAllocated: boolean;
  socketNodeId?: number;
  clusterSize?: string;
  groupX?: number;
  groupY?: number;
  links?: number[];
}

export interface TreePackageData {
  ref: string;
  label: string;
  addNodes: number[];
  removeNodes: number[];
  dps?: { pct?: string };
  ehp?: { pct?: string };
  pointCost?: number;
  extras?: string[];
  /** Raw PoB item text for jewel_equip results (Watcher's Eye, etc.) */
  jewelText?: string;
  /**
   * Cluster subgraph snapshot for suggested cluster jewels (not yet equipped
   * in the persisted build). When present, the tree canvas merges these with
   * vizData.tree.clusterNodes so the full cluster "wheel" (smalls + notables
   * + mastery + internal ring links) renders during preview.
   */
  clusterSubgraph?: PreviewClusterNode[];
}

interface TreePackageStore {
  packages: Map<string, TreePackageData>;
  registerPackage: (data: TreePackageData) => void;
  clearPackages: () => void;
}

export const useTreePackageStore = create<TreePackageStore>((set) => ({
  packages: new Map(),

  registerPackage: (data) =>
    set((state) => {
      const next = new Map(state.packages);
      next.set(data.ref.toLowerCase(), data);
      return { packages: next };
    }),

  clearPackages: () => set({ packages: new Map() }),
}));

/** Selector hook for a single package by ref */
export function useTreePackage(ref: string): TreePackageData | undefined {
  return useTreePackageStore((s) => s.packages.get(ref.toLowerCase()));
}

// =============================================================================
// SSE-time hydration — called when tool_result arrives for tree tools
// =============================================================================

interface TreeResult {
  ref?: string;
  label?: string;
  /** tree_change type */
  addNodes?: number[];
  removeNodes?: number[];
  /** jewel_equip / cluster_chain type — backend emits these instead of addNodes */
  type?: 'tree_change' | 'jewel_equip' | 'cluster_chain';
  socketNodeId?: number;
  allocatedNotables?: number[];
  /**
   * Full BFS path the cluster spec walks (outer-socket travel + cluster smalls
   * + notables). Returned by calc_with_jewel and calc_with_cluster_chain. When
   * present, this is the authoritative "what gets speced" list — preferred
   * over the [socketNodeId, ...allocatedNotables] fallback which undercounts.
   */
  allocatedPathNodes?: number[];
  /** Cluster subgraph nodes (with positions + links) for preview rendering. */
  clusterSubgraph?: PreviewClusterNode[];
  dps?: { pct?: string };
  ehp?: { pct?: string };
  pointCost?: number;
  extras?: string[];
  jewelText?: string;
}

/**
 * Hydrate tree package store from a batch_test_tree / batch_simulate_tree
 * tool_result SSE event.
 *
 * For tree_change results, the backend emits explicit addNodes/removeNodes.
 * For jewel_equip and cluster_chain results, it emits socketNodeId +
 * allocatedNotables — synthesize addNodes so TreePill's "show on tree"
 * click still highlights the cluster's effect (outer socket + notables
 * allocated by BFS). Without this, cluster refs render with empty node
 * lists and the click falls back to plain navigation.
 */
export function hydrateTreePackagesFromToolResult(data: Record<string, unknown>): void {
  const results = (data.results ?? []) as TreeResult[];
  const { registerPackage } = useTreePackageStore.getState();

  for (const r of results) {
    const ref = r.ref;
    if (!ref || !ref.toUpperCase().startsWith('TR')) continue;

    let addNodes = r.addNodes ?? [];
    const removeNodes = r.removeNodes ?? [];

    if ((r.type === 'jewel_equip' || r.type === 'cluster_chain') && addNodes.length === 0) {
      // Prefer allocatedPathNodes (full BFS path: outer travel + cluster smalls
      // + notables) so the tree viz shows the correct point cost. Fall back to
      // [socketNodeId, ...allocatedNotables] only when the backend didn't
      // return the path (older Lua build).
      if (r.allocatedPathNodes?.length) {
        addNodes = [...r.allocatedPathNodes];
      } else {
        const synthesized: number[] = [];
        if (typeof r.socketNodeId === 'number') synthesized.push(r.socketNodeId);
        if (r.allocatedNotables?.length) synthesized.push(...r.allocatedNotables);
        addNodes = synthesized;
      }
    }

    registerPackage({
      ref,
      label: r.label ?? '',
      addNodes,
      removeNodes,
      dps: r.dps,
      ehp: r.ehp,
      pointCost: r.pointCost,
      extras: r.extras,
      ...(r.jewelText ? { jewelText: r.jewelText } : {}),
      ...(r.clusterSubgraph?.length ? { clusterSubgraph: r.clusterSubgraph } : {}),
    });
  }
}
