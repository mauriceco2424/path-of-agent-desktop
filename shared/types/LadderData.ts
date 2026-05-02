/**
 * Ladder Data Types
 *
 * Shared types for on-demand ladder data fetching and display.
 * Used by backend routes and frontend components.
 */

import type {
  CachedLadderStats,
  UsageEntry,
  ItemUsage,
  ModUsage,
  StatBenchmark,
  DefensiveLayer,
  KeyDifference,
  TierData,
  MasteryUsage,
  JewelBreakdown,
  EnrichedStatBenchmarks,
  TargetSlotLayout,
  TargetGem,
  CoOccurrenceEntry,
} from '../../backend/src/services/ladder-stats/cached-ladder-analyzer.js';
import type { PrimaryDamageType } from '../../backend/src/services/ladder-stats/pob-stats-enricher.js';

// =============================================================================
// Ladder Status (GET /builds/:buildId/ladder-status)
// =============================================================================

export interface LadderStatusResponse {
  /** Whether cached ladder data exists on disk */
  exists: boolean;
  /** Detected main skill name */
  skill: string;
  /** Detected ascendancy class */
  ascendancy: string;
  /** Number of cached builds (if exists) */
  buildCount?: number;
  /** ISO timestamp of when data was fetched (if exists) */
  fetchedAt?: string;
  /** League the data was fetched from (if exists) */
  league?: string;
  /** How many builds poe.ninja has for this skill+ascendancy (always queried) */
  ninjaAvailableCount?: number;
  /** Quick summary stats (if exists) */
  stats?: LadderStatsSummary;
  /** Full analyzed ladder stats for pathway-specific filtering (if exists) */
  fullStats?: CachedLadderStats;
  /** Level range of the fetched ladder builds (if exists) */
  levelRange?: { min: number; max: number };
  /** Level range that would be searched if a fresh fetch was triggered (based on user's current level) */
  requestedLevelRange?: { min: number; max: number };
  /** If skill was auto-corrected for ladder lookup (L2 fallback), the corrected skill name */
  correctedSkill?: string;
  /** Original skill name before L2 correction */
  correctedFrom?: string;
  /** Whether cached data is stale (user has outgrown the ladder benchmarks in DPS, EHP, or level) */
  stale?: boolean;
  /** Human-readable reason the cache is considered stale */
  staleReason?: string;
  /** Time-machine label from the cache filename (e.g., "day-1", "week-2") — indicates league age of snapshot */
  timeMachineLabel?: string;
}

// =============================================================================
// Ladder Stats Summary (compact version for status response)
// =============================================================================

export interface LadderStatsSummary {
  buildCount: number;
  benchmarks: {
    dps: { avg: number; min: number; max: number };
    ehp: { avg: number; min: number; max: number };
    life: { avg: number; min: number; max: number };
  };
  topKeystones: UsageEntry[];
  topUniques: ItemUsage[];
  topSupports: UsageEntry[];
  topAuras: UsageEntry[];
  /** Non-main, non-support, non-aura active skills (guard, movement, warcry, buff, CWDT) */
  otherSkills?: UsageEntry[];
  /** Level range of the ladder builds included in this summary */
  levelRange?: { min: number; max: number };
}

// =============================================================================
// Ladder Fetch Progress (SSE events from POST /builds/:buildId/ladder-fetch)
// =============================================================================

export type LadderFetchPhase = 'searching' | 'fetching' | 'analyzing' | 'complete' | 'error';

export interface LadderFetchProgressEvent {
  type: 'ladder_progress';
  phase: LadderFetchPhase;
  /** Current build being fetched (1-indexed) */
  current: number;
  /** Total builds to fetch */
  total: number;
  /** Human-readable status message */
  message: string;
  /** Character name being fetched (during 'fetching' phase) */
  characterName?: string;
}

export interface LadderFetchStatsEvent {
  type: 'ladder_stats';
  stats: LadderStatsSummary;
  buildCount: number;
}

export interface LadderFetchCompleteEvent {
  type: 'ladder_complete';
  buildCount: number;
  fetchedAt: string;
  /** Level range of the fetched ladder builds */
  levelRange?: { min: number; max: number };
  /** How many builds were requested */
  targetCount?: number;
  /** How many builds were skipped (private profiles, errors) */
  skippedCount?: number;
}

export interface LadderFetchErrorEvent {
  type: 'ladder_error';
  message: string;
}

export type LadderFetchEvent =
  | LadderFetchProgressEvent
  | LadderFetchStatsEvent
  | LadderFetchCompleteEvent
  | LadderFetchErrorEvent;

// =============================================================================
// Build Comparison (user's build vs ladder benchmarks)
// =============================================================================

export interface BuildComparisonResponse {
  /** User's DPS percentile among ladder builds (0-100) */
  dpsPercentile: number;
  /** User's EHP percentile among ladder builds (0-100) */
  ehpPercentile: number;
  /** User's life percentile among ladder builds (0-100) */
  lifePercentile: number;
  /** Notable divergences between user's build and ladder trends */
  divergences: BuildDivergence[];
}

export interface BuildDivergence {
  category: 'keystone' | 'unique' | 'support' | 'aura';
  name: string;
  /** Percentage of ladder builds using this (0-100) */
  ladderUsage: number;
  /** Whether the user's build has this */
  userHas: boolean;
}

// =============================================================================
// Fetch Request
// =============================================================================

export interface LadderFetchRequest {
  targetCount: 10 | 20 | 30;
}

// Re-export the full stats type for components that need it
export type {
  CachedLadderStats,
  EnrichedStatBenchmarks,
  ItemUsage,
  ModUsage,
  StatBenchmark,
  DefensiveLayer,
  KeyDifference,
  TierData,
  MasteryUsage,
  JewelBreakdown,
  PrimaryDamageType,
  TargetSlotLayout,
  TargetGem,
  CoOccurrenceEntry,
};

// =============================================================================
// Progression Data (from server-hydrated per-combo profiles)
// =============================================================================

/** Three tier names that correspond to level bands */
export type ProgressionTier = 'early_mapping' | 'endgame' | 'aspirational';

/** Simple stat distribution per tier */
export interface ProgressionStatDist {
  p25: number;
  median: number;
  p75: number;
}

/** Adoption entry with name and percentage */
export interface ProgressionAdoption {
  name: string;
  pct: number;
}

/** Per-tier aggregated data */
export interface ProgressionTierData {
  buildCount: number;
  medianLevel: number;
  stats: {
    combinedDps?: ProgressionStatDist;
    ehp?: ProgressionStatDist;
    life?: ProgressionStatDist;
    energyShield?: ProgressionStatDist;
    armour?: ProgressionStatDist;
    evasion?: ProgressionStatDist;
  };
  uniques?: ProgressionAdoption[];
  supports?: ProgressionAdoption[];
  auras?: ProgressionAdoption[];
  keystones?: ProgressionAdoption[];
  notables?: ProgressionAdoption[];
  ascNodes?: ProgressionAdoption[];
}

/** A single change between two tiers */
export interface ProgressionChange {
  name: string;
  category: 'uniques' | 'supports' | 'auras' | 'keystones' | 'notables' | 'ascNodes';
  fromPct: number;
  toPct: number;
  delta: number;
}

/** Transition between two adjacent tiers */
export interface ProgressionTransition {
  from: ProgressionTier;
  to: ProgressionTier;
  fromDisplay: string;
  toDisplay: string;
  appearing: ProgressionChange[];
  fading: ProgressionChange[];
  statGrowth: {
    combinedDps?: { from: number; to: number; growthPct: number };
    ehp?: { from: number; to: number; growthPct: number };
    life?: { from: number; to: number; growthPct: number };
  };
}

/** Item/gem classification across tiers */
export interface CoreVsTransitional {
  core: Array<{
    name: string;
    category: string;
    earlyPct: number;
    endgamePct: number;
  }>;
  transitional: Array<{
    name: string;
    category: string;
    type: 'early_only' | 'aspirational';
    earlyPct: number;
    endgamePct: number;
  }>;
}

/**
 * Structured progression profile for a skill+ascendancy combo.
 * Shows how builds evolve across level tiers (Early Mapping → Endgame → Aspirational).
 * Consumed by the ProgressionSection in LadderBenchmarksModal.
 */
export interface ProgressionData {
  skill: string;
  ascendancy: string;
  tierData: Partial<Record<ProgressionTier, ProgressionTierData>>;
  transitions: ProgressionTransition[];
  coreVsTransitional: CoreVsTransitional;
}
