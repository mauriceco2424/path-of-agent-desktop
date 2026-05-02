/**
 * Analysis History Store
 *
 * Persists analysis sessions to the filesystem (Tauri desktop) or
 * localStorage (browser dev mode) so users can browse and restore
 * past analyses across app restarts.
 *
 * Tauri mode: each snapshot stored as an individual JSON file at
 * {appDataDir}/sessions/{id}.json — supports 50 MB budget (~38 full sessions).
 *
 * Browser mode: falls back to localStorage with 4 MB budget.
 */

import { create } from 'zustand';
import type { AnalysisFocus } from '../types/chat-modes';
import type { PathwayType, ParsedPathwayCard, ParsedGeneralAssessment, PathwayHistories, BuildVisualizationResponse } from './index';
import type { MessagePart } from '../../../shared/types/Chat';
import type { BuildRatings } from '../../../shared/types/synthesis';
import type { GearSlotRatings } from '../../../shared/types/GearQuality';
import type { UnifiedActionItem } from '../../../shared/types/improvements';
import type { SeerContextData } from '../../../shared/types/Chat';
import {
  saveSessionSnapshot,
  loadSessionSnapshots,
  deleteSessionSnapshot,
  clearSessionSnapshots,
  isDesktopApp,
} from '../services/tauri-api';

// ============================================
// Types
// ============================================

export type SnapshotStatus = 'imported' | 'streaming' | 'complete' | 'partial' | 'interrupted';

/** Enriched snapshot of an analysis session */
export interface AnalysisSnapshot {
  /** Unique ID */
  id: string;
  /** When the analysis completed (or was last updated) */
  timestamp: number;
  /** Build identity at time of analysis */
  build: {
    characterName?: string;
    class: string;
    ascendancy: string;
    level: number;
    pobCode?: string;
  };
  /** Which pathways were analyzed */
  focus: AnalysisFocus[];
  /** Custom prompt if provided */
  customPrompt: string;
  /** Display label (e.g. "Skills + Gear") */
  label: string;
  /** Per-pathway analysis content (markdown text) */
  pathwayContent: Record<string, string>;
  /** Whether this was a partial (cancelled) analysis */
  isPartial: boolean;
  /** Which pathways completed successfully */
  completedPathways: PathwayType[];

  // --- Enriched fields (Phase 1) ---

  /** Analysis lifecycle status */
  status: SnapshotStatus;
  /** Structured message parts (tool calls, reasoning) for rendering */
  parts?: MessagePart[];
  /** Follow-up chat messages per pathway */
  pathwayHistories?: Partial<PathwayHistories>;
  /** Build visualization data */
  vizData?: BuildVisualizationResponse | null;
  /** Pathway action cards from initial analysis */
  pathwayCards?: ParsedPathwayCard[] | null;
  /** General assessment */
  generalAssessment?: ParsedGeneralAssessment | null;
  /** Build ratings (overall + per-pathway scores) */
  buildRatings?: BuildRatings | null;
  /** Gear slot quality ratings */
  gearSlotRatings?: GearSlotRatings | null;
  /** Seer context (LLM transparency data) */
  seerContext?: SeerContextData | null;
  /** Top actions (cross-pathway priority list) */
  topActions?: UnifiedActionItem[] | null;
  /** Pathway priority order */
  pathwayPriorityOrder?: PathwayType[] | null;

  // --- Enriched fields (Phase 2: complete session capture) ---

  /** Token usage entries from this analysis (for Oracle's Ledger restore) */
  tokenEntries?: import('../../../shared/types/TokenUsage').TokenUsageEntry[];
  /** Aggregated token/cost totals for this analysis */
  tokenTotals?: import('../../../shared/types/TokenUsage').TokenUsageTotals;
  /** Credits spent during this analysis */
  creditsUsed?: number;
  /** Personalized suggested follow-up questions */
  suggestedQuestions?: string[] | null;
  /** Tree simulation results (if user ran tree optimization) */
  treeSimulationResults?: import('./index').TreeSimulationResults | null;
  /** Tree diff visualization nodes (added/removed highlights) */
  treeDiffNodes?: { added: number[]; removed: number[] } | null;
}

interface AnalysisHistoryState {
  /** All saved analysis snapshots, newest first */
  snapshots: AnalysisSnapshot[];
  /** ID of the snapshot currently being streamed/edited (for incremental saves) */
  activeSnapshotId: string | null;
  /** Whether snapshots have been loaded from disk (Tauri) or localStorage (browser) */
  _loaded: boolean;
}

interface AnalysisHistoryActions {
  /** Initialize the store — loads snapshots from disk/localStorage. Call once on app startup. */
  init: () => Promise<void>;
  /** Save a new analysis snapshot */
  saveSnapshot: (snapshot: Omit<AnalysisSnapshot, 'id' | 'timestamp'>) => string;
  /** Update an existing snapshot by ID (merge fields). Creates new if ID not found. */
  upsertSnapshot: (id: string, update: Partial<Omit<AnalysisSnapshot, 'id'>>) => void;
  /** Delete a snapshot by ID */
  deleteSnapshot: (id: string) => void;
  /** Clear all history */
  clearAll: () => void;
  /** Get snapshots, optionally filtered by build */
  getSnapshots: (filter?: { ascendancy?: string; level?: number }) => AnalysisSnapshot[];
  /** Set the active snapshot ID (links follow-up saves) */
  setActiveSnapshotId: (id: string | null) => void;
  /** Get the active snapshot */
  getActiveSnapshot: () => AnalysisSnapshot | null;
  /** Get storage usage stats */
  getStorageStats: () => { usedBytes: number; budgetBytes: number; snapshotCount: number };
}

// ============================================
// Constants
// ============================================

/** Max snapshots to keep (oldest auto-pruned) */
const MAX_SNAPSHOTS = 50;

/** Tauri: 50 MB budget on disk */
const SIZE_BUDGET_TAURI = 50 * 1024 * 1024;

/** Browser: 4 MB budget in localStorage */
const SIZE_BUDGET_BROWSER = 4 * 1024 * 1024;

/** Active budget based on runtime environment */
const SIZE_BUDGET_BYTES = isDesktopApp() ? SIZE_BUDGET_TAURI : SIZE_BUDGET_BROWSER;

/** Age threshold for tiering — 90 days for Tauri (plenty of space), 30 days for browser */
const TIERING_AGE_MS = isDesktopApp()
  ? 90 * 24 * 60 * 60 * 1000
  : 30 * 24 * 60 * 60 * 1000;

/** localStorage key (used for browser mode and migration) */
const LS_KEY = 'poa-analysis-history';

// ============================================
// Size management helpers
// ============================================

function estimateSize(snapshots: AnalysisSnapshot[]): number {
  return JSON.stringify(snapshots).length;
}

/**
 * Strip heavy data from old snapshots and prune to stay within budget.
 * Returns the kept snapshots and the IDs of any pruned snapshots.
 */
function enforceStorageBudget(snapshots: AnalysisSnapshot[]): { kept: AnalysisSnapshot[]; prunedIds: string[] } {
  let result = [...snapshots];
  const now = Date.now();
  const prunedIds: string[] = [];

  // Step 1: Age-based tiering — strip heavy fields from old snapshots
  result = result.map(s => {
    if (now - s.timestamp > TIERING_AGE_MS) {
      const { vizData: _v, parts: _p, pathwayHistories: _h, seerContext: _s, topActions: _t, tokenEntries: _te, treeSimulationResults: _tr, ...lightweight } = s;
      return lightweight as AnalysisSnapshot;
    }
    return s;
  });

  // Step 2: If still over budget, remove oldest until under
  let currentSize = estimateSize(result);
  while (result.length > 1 && currentSize > SIZE_BUDGET_BYTES) {
    const removed = result.pop()!;
    prunedIds.push(removed.id);
    currentSize -= JSON.stringify(removed).length + 1;
  }

  return { kept: result, prunedIds };
}

// ============================================
// Persistence helpers
// ============================================

/**
 * Persist a single snapshot to disk (Tauri) or all snapshots to localStorage (browser).
 * Fire-and-forget — store is in-memory authoritative, disk is best-effort.
 */
function persistSnapshot(snapshot: AnalysisSnapshot): void {
  if (isDesktopApp()) {
    saveSessionSnapshot(snapshot.id, snapshot).catch((err) => {
      console.warn('[AnalysisHistory] Failed to persist snapshot to disk:', err);
    });
  } else {
    persistAllToLocalStorage();
  }
}

/** Persist all current snapshots to localStorage (browser mode only) */
function persistAllToLocalStorage(): void {
  const { snapshots } = useAnalysisHistoryStore.getState();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ state: { snapshots }, version: 3 }));
  } catch {
    // QuotaExceededError — best-effort
    console.warn('[AnalysisHistory] localStorage quota exceeded');
  }
}

/** Delete a snapshot from disk (Tauri only — browser persists all-at-once) */
function deleteFromDisk(id: string): void {
  if (isDesktopApp()) {
    deleteSessionSnapshot(id).catch((err) => {
      console.warn('[AnalysisHistory] Failed to delete snapshot from disk:', err);
    });
  } else {
    persistAllToLocalStorage();
  }
}

/** Clear all snapshots from disk or localStorage */
function clearDisk(): void {
  if (isDesktopApp()) {
    clearSessionSnapshots().catch((err) => {
      console.warn('[AnalysisHistory] Failed to clear sessions from disk:', err);
    });
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

// Debounce map for upsert persistence (prevents disk thrashing during streaming)
const pendingPersists = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedPersist(snapshot: AnalysisSnapshot): void {
  const existing = pendingPersists.get(snapshot.id);
  if (existing) clearTimeout(existing);

  pendingPersists.set(snapshot.id, setTimeout(() => {
    pendingPersists.delete(snapshot.id);
    persistSnapshot(snapshot);
  }, 500));
}

/** Flush any pending debounced persist for a snapshot (e.g., before delete) */
function flushPendingPersist(id: string): void {
  const existing = pendingPersists.get(id);
  if (existing) {
    clearTimeout(existing);
    pendingPersists.delete(id);
    const snapshot = useAnalysisHistoryStore.getState().snapshots.find(s => s.id === id);
    if (snapshot) persistSnapshot(snapshot);
  }
}

// ============================================
// Migration: localStorage → file-based (Tauri)
// ============================================

function migrateFromLocalStorage(): AnalysisSnapshot[] | null {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    let snapshots: AnalysisSnapshot[] = parsed?.state?.snapshots ?? [];

    // Apply v1→v2 migration if needed (add status field)
    const version = parsed?.version ?? 1;
    if (version < 2) {
      snapshots = snapshots.map(s => ({
        ...s,
        status: s.isPartial ? 'partial' as const : 'complete' as const,
      }));
    }

    if (snapshots.length === 0) return null;

    // Persist each snapshot to disk
    for (const snapshot of snapshots) {
      saveSessionSnapshot(snapshot.id, snapshot).catch(() => {});
    }

    // Clear localStorage now that data is on disk
    localStorage.removeItem(LS_KEY);

    return snapshots;
  } catch {
    return null;
  }
}

// ============================================
// Store
// ============================================

export const useAnalysisHistoryStore = create<AnalysisHistoryState & AnalysisHistoryActions>()(
  (set, get) => ({
    snapshots: [],
    activeSnapshotId: null,
    _loaded: false,

    init: async () => {
      if (get()._loaded) return; // Already initialized

      if (isDesktopApp()) {
        try {
          const raw = await loadSessionSnapshots();
          let snapshots = raw as AnalysisSnapshot[];
          snapshots.sort((a, b) => b.timestamp - a.timestamp);

          if (snapshots.length === 0) {
            // Try migrating from localStorage (first launch after upgrade)
            const migrated = migrateFromLocalStorage();
            if (migrated) {
              migrated.sort((a, b) => b.timestamp - a.timestamp);
              set({ snapshots: migrated, _loaded: true });
              return;
            }
          }

          set({ snapshots, _loaded: true });
        } catch {
          // Tauri not available yet (race condition) — try localStorage
          const migrated = migrateFromLocalStorage();
          set({ snapshots: migrated ?? [], _loaded: true });
        }
      } else {
        // Browser mode: load from localStorage directly
        try {
          const stored = localStorage.getItem(LS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            let snapshots: AnalysisSnapshot[] = parsed?.state?.snapshots ?? [];
            // Apply v1→v2 migration
            const version = parsed?.version ?? 1;
            if (version < 2) {
              snapshots = snapshots.map(s => ({
                ...s,
                status: s.isPartial ? 'partial' as const : 'complete' as const,
              }));
            }
            snapshots.sort((a, b) => b.timestamp - a.timestamp);
            set({ snapshots, _loaded: true });
            return;
          }
        } catch {
          // Ignore parse errors
        }
        set({ _loaded: true });
      }
    },

    saveSnapshot: (snapshot) => {
      const id = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newSnapshot: AnalysisSnapshot = {
        ...snapshot,
        id,
        timestamp: Date.now(),
        status: snapshot.status ?? (snapshot.isPartial ? 'partial' : 'complete'),
      };

      set((state) => {
        let updated = [newSnapshot, ...state.snapshots];
        if (updated.length > MAX_SNAPSHOTS) {
          updated.length = MAX_SNAPSHOTS;
        }
        const { kept, prunedIds } = enforceStorageBudget(updated);

        // Async: persist new snapshot, delete any pruned
        persistSnapshot(newSnapshot);
        for (const prunedId of prunedIds) {
          deleteFromDisk(prunedId);
        }

        return { snapshots: kept, activeSnapshotId: id };
      });

      return id;
    },

    upsertSnapshot: (id, update) => {
      set((state) => {
        const idx = state.snapshots.findIndex(s => s.id === id);
        if (idx === -1) {
          return state;
        }
        const updated = [...state.snapshots];
        updated[idx] = {
          ...updated[idx],
          ...update,
          timestamp: Date.now(),
        };
        return { snapshots: updated };
      });

      // Debounced persist — upsert fires frequently during streaming
      const snapshot = get().snapshots.find(s => s.id === id);
      if (snapshot) debouncedPersist(snapshot);
    },

    deleteSnapshot: (id) => {
      flushPendingPersist(id);
      set((state) => ({
        snapshots: state.snapshots.filter((s) => s.id !== id),
        activeSnapshotId: state.activeSnapshotId === id ? null : state.activeSnapshotId,
      }));
      deleteFromDisk(id);
    },

    clearAll: () => {
      // Flush all pending persists
      for (const [, timer] of pendingPersists) clearTimeout(timer);
      pendingPersists.clear();

      set({ snapshots: [], activeSnapshotId: null });
      clearDisk();
    },

    getSnapshots: (filter) => {
      const { snapshots } = get();
      if (!filter) return snapshots;
      return snapshots.filter((s) => {
        if (filter.ascendancy && s.build.ascendancy !== filter.ascendancy) return false;
        if (filter.level && s.build.level !== filter.level) return false;
        return true;
      });
    },

    setActiveSnapshotId: (id) => {
      set({ activeSnapshotId: id });
    },

    getActiveSnapshot: () => {
      const { snapshots, activeSnapshotId } = get();
      if (!activeSnapshotId) return null;
      return snapshots.find(s => s.id === activeSnapshotId) ?? null;
    },

    getStorageStats: () => {
      const { snapshots } = get();
      return {
        usedBytes: estimateSize(snapshots),
        budgetBytes: SIZE_BUDGET_BYTES,
        snapshotCount: snapshots.length,
      };
    },
  })
);
