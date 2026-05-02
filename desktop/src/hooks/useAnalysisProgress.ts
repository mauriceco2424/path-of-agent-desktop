/**
 * useAnalysisProgress — HUD progress model for unified analysis
 *
 * Derives a three-phase progress model (preflight → analysis → writing) from
 * the streamed tool-call parts, producing:
 *   - phase:         which phase is currently active
 *   - overallPct:    0..1 weighted across phases (monotone, never decreases)
 *   - phaseLabel:    short text like "Preflight 7 / 13" for the header
 *   - elapsedMs:     wall-clock since the first tool_start
 *   - etaMs:         live, smoothed estimate of time remaining (null during cold start)
 *   - etaLabel:      formatted ETA like "~2m 30s left" (or "" when not shown)
 *
 * The ETA is derived entirely from in-session measurements — no persistent
 * baseline, no static "~5 min" constant. It adapts to this machine and this
 * build as tools complete.
 *
 * Not a React hook with effects: a pure `useMemo` over `parts` + a `nowMs`
 * ticker value the caller provides (the caller already runs a 1 s interval
 * while analysis is live, so we reuse that rather than duplicating timers).
 */

import { useMemo, useRef } from 'react';
import type { MessagePart, ToolCallPart } from '../../../shared/types/Chat';

// =============================================================================
// Constants — expected step counts per analysis mode
// =============================================================================

/**
 * Expected preflight tool completions for unified analysis.
 *
 * Sources (backend/src/services/llm/langchain/):
 *   - skills-preflight.ts   → find_support_suggestions, find_setup_suggestions, test_gem_swaps        (3)
 *   - gear-preflight.ts     → assess_progression, build_mod_menus                                     (2)
 *   - tree-preflight.ts     → discover_tree_nodes, analyze_allocated_tree, test_obvious_candidates,
 *                             test_mastery_alternatives, discover_cluster_options, test_ladder_clusters,
 *                             build_jewel_menus, test_popular_jewels                                  (8)
 *
 * Tree preflight steps 5-8 are conditional on `enableJewelAnalysis` (default
 * true) and on the build having testable clusters / equipped jewel sockets.
 * When a conditional step doesn't emit, the hook snaps the preflight segment
 * to full on phase transition so the bar never gets stuck short of 100%.
 */
const UNIFIED_PREFLIGHT_TOTAL = 13;

/**
 * The unified agent is hard-capped to 3 `test_unified_build` calls —
 * enforced in backend/src/services/llm/langchain/tools/test-unified-build.ts
 * (ROUND_LIMIT_EXCEEDED warning at callNumber > 3).
 */
const UNIFIED_ANALYSIS_TOTAL = 3;

/**
 * Weight distribution across phases for the combined overall percentage.
 * Sum must be 1.0. Writing gets a thin slice because it's typically brief
 * (just the final prose streaming out) but still needs visible progress so
 * the bar doesn't sit at 90% for 20 seconds.
 */
const PHASE_WEIGHTS = {
  preflight: 0.50,
  analysis: 0.40,
  writing: 0.10,
} as const;

/**
 * Progression mode uses a completely different preflight and no
 * `test_unified_build`. We fall back to an indeterminate shimmer by
 * returning totals that won't match anything meaningful — the UI treats
 * this as "progression mode" and renders a simplified bar.
 */
export const ANALYSIS_EXPECTED_STEPS = {
  unified: {
    preflightTotal: UNIFIED_PREFLIGHT_TOTAL,
    analysisTotal: UNIFIED_ANALYSIS_TOTAL,
  },
  progression: {
    preflightTotal: 1,
    analysisTotal: 1,
  },
} as const;

// =============================================================================
// Tool timing model — calibrated from backend/dev.log on a reference machine
// =============================================================================
//
// The previous ETA estimator averaged completed preflight tool durations and
// multiplied by remaining count. That model fails catastrophically for this
// pipeline because the tools are *wildly* not-IID:
//
//   find_support_suggestions     ~500 ms
//   assess_progression           ~100 ms
//   discover_tree_nodes        ~3,000 ms
//   test_popular_jewels       ~20,000 ms
//   test_obvious_candidates  ~100,000 ms  ← ~200× some tools
//
// A mean-based estimator produces wild swings as each large tool lands. The
// fix is to model each tool's expected duration directly, then learn a single
// PC-speed factor from the ratio of actual-to-expected as tools complete.
//
// Calibrated from dev.log runs: preflight total wall-clock ~180 s, dominated
// by tree pipeline (~156 s modeled). The three pipelines run in parallel on
// 3 PoB containers so effective preflight time is max(pipelines).
//
// If the constants drift from reality, the speed factor absorbs it — the
// table only needs to capture the right *ratios between tools* and the right
// order of magnitude.

type ToolPipeline = 'skills' | 'gear' | 'tree';

/**
 * Expected wall-clock per preflight tool on a "reference" machine.
 * The self-calibrating speed factor scales this to match the user's PC.
 */
const EXPECTED_MS_BY_TOOL: Record<string, number> = {
  // Skills pipeline
  find_support_suggestions: 500,
  find_setup_suggestions: 500,
  test_gem_swaps: 8_000, // preflight variant

  // Gear pipeline
  assess_progression: 200,
  build_mod_menus: 4_000,

  // Tree pipeline
  discover_tree_nodes: 3_000,
  analyze_allocated_tree: 1_500,
  test_obvious_candidates: 100_000, // the monster step
  test_mastery_alternatives: 25_000,
  discover_cluster_options: 1_000,
  test_ladder_clusters: 5_000,
  build_jewel_menus: 500,
  test_popular_jewels: 20_000,
};

/** Which parallel pipeline each preflight tool belongs to. */
const TOOL_PIPELINE: Record<string, ToolPipeline> = {
  find_support_suggestions: 'skills',
  find_setup_suggestions: 'skills',
  test_gem_swaps: 'skills',
  assess_progression: 'gear',
  build_mod_menus: 'gear',
  discover_tree_nodes: 'tree',
  analyze_allocated_tree: 'tree',
  test_obvious_candidates: 'tree',
  test_mastery_alternatives: 'tree',
  discover_cluster_options: 'tree',
  test_ladder_clusters: 'tree',
  build_jewel_menus: 'tree',
  test_popular_jewels: 'tree',
};

/**
 * Expected wall-clock per `test_unified_build` call. From logs:
 *   req-j: 44s / 38s / 40s
 *   req-k: 50s / 31s / 18s (call 3 was combined-only)
 * 40 s is a good central estimate; the unified speed factor adjusts it.
 */
const EXPECTED_UNIFIED_CALL_MS = 40_000;

/**
 * Expected writing-phase wall-clock (LLM streaming the final prose).
 * Usually 15-25 s — we don't have per-run data so a fixed 20 s is fine.
 */
const EXPECTED_WRITING_MS = 20_000;

/**
 * Minimum expected duration for a tool completion to contribute to the
 * speed-factor calibration. Tiny tools (e.g. assess_progression at ~100 ms)
 * are dominated by constant-cost noise and would skew the ratio.
 */
const SPEED_FACTOR_MIN_EXPECTED_MS = 2_000;

// =============================================================================
// Types
// =============================================================================

export type AnalysisPhase = 'idle' | 'preflight' | 'analysis' | 'writing' | 'done';
export type EtaConfidence = 'none' | 'low' | 'medium' | 'high';

export interface AnalysisProgress {
  phase: AnalysisPhase;
  /** 0..1 — monotone, weighted combination across the three phases. */
  overallPct: number;

  preflightDone: number;
  preflightTotal: number;
  analysisDone: number;
  analysisTotal: number;

  /** Short label for the header subtitle. e.g. "Preflight 7 / 13" */
  phaseLabel: string;

  /** Wall-clock since the first tool_start (0 if nothing has started). */
  elapsedMs: number;
  /** Smoothed estimate of remaining time. null while we lack data. */
  etaMs: number | null;
  etaConfidence: EtaConfidence;
  /** Formatted right-side label. "" when hidden. */
  etaLabel: string;

  /** True for the progression advisor mode — UI can render a simpler fallback. */
  isProgressionMode: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function formatEta(ms: number): string {
  if (ms <= 10_000) return 'almost done';
  if (ms < 30_000) {
    // 10-30s → round to 5s
    const s = Math.round(ms / 5000) * 5;
    return `~${s}s left`;
  }
  if (ms < 120_000) {
    // 30s-2m → "~1m 10s left" rounded to 5s
    const total = Math.round(ms / 5000) * 5;
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    if (mins === 0) return `~${secs}s left`;
    if (secs === 0) return `~${mins}m left`;
    return `~${mins}m ${secs}s left`;
  }
  // > 2 min → round to 10s for a steadier display
  const total = Math.round(ms / 10_000) * 10;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (secs === 0) return `~${mins}m left`;
  return `~${mins}m ${secs}s left`;
}

function weightedOverall(
  phase: AnalysisPhase,
  preflightPct: number,
  analysisPct: number,
  writingPct: number,
): number {
  // Phases earlier than the current one are counted as 1.0 so the bar doesn't
  // regress if a late stray event arrives.
  const pre = phase === 'preflight' ? preflightPct : phase === 'idle' ? 0 : 1;
  const ana =
    phase === 'analysis'
      ? analysisPct
      : phase === 'preflight' || phase === 'idle'
        ? 0
        : 1;
  const wri =
    phase === 'writing'
      ? writingPct
      : phase === 'done'
        ? 1
        : 0;

  return (
    pre * PHASE_WEIGHTS.preflight +
    ana * PHASE_WEIGHTS.analysis +
    wri * PHASE_WEIGHTS.writing
  );
}

// =============================================================================
// Hook
// =============================================================================

export interface UseAnalysisProgressArgs {
  parts: MessagePart[];
  /** Analysis is actively running (not restored history, not finished). */
  isAnalyzing: boolean;
  /** Active pathway from the store — drives mode-specific totals. */
  activePathway: string | null;
  /** Live monotonic clock; caller should tick this every ~1s during analysis. */
  nowMs: number;
  /** True when the LLM is currently streaming prose content (writing phase). */
  isWriting: boolean;
}

/**
 * Derive live analysis progress from the streamed tool parts.
 *
 * Safe to call on every render — the calculation is O(parts) and the hook
 * internally memoizes the result and clamps the overall percentage monotone
 * across renders via a ref.
 */
export function useAnalysisProgress({
  parts,
  isAnalyzing,
  activePathway,
  nowMs,
  isWriting,
}: UseAnalysisProgressArgs): AnalysisProgress {
  const monotoneRef = useRef<number>(0);
  // Self-calibrating speed factor — ratio of actualMs / expectedMs averaged
  // across completed preflight tools whose expected duration exceeds
  // SPEED_FACTOR_MIN_EXPECTED_MS. Starts at 1 (reference machine) and
  // converges after 1-2 significant tools. Separate factor for unified calls
  // because they include LLM reasoning time, which scales differently from
  // pure PoB sim cost.
  const preflightSpeedRef = useRef<{ factor: number; samples: number }>({ factor: 1, samples: 0 });
  const unifiedSpeedRef = useRef<{ factor: number; samples: number }>({ factor: 1, samples: 0 });

  return useMemo(() => {
    const isProgression = activePathway === 'progression';
    const totals = isProgression
      ? ANALYSIS_EXPECTED_STEPS.progression
      : ANALYSIS_EXPECTED_STEPS.unified;

    // ── Extract tool parts ──────────────────────────────────────────────
    const toolParts: ToolCallPart[] = [];
    for (const p of parts) {
      if (p.type === 'tool_call') toolParts.push(p);
    }

    if (toolParts.length === 0 && !isAnalyzing) {
      // Idle — nothing to show.
      return {
        phase: 'idle',
        overallPct: 0,
        preflightDone: 0,
        preflightTotal: totals.preflightTotal,
        analysisDone: 0,
        analysisTotal: totals.analysisTotal,
        phaseLabel: '',
        elapsedMs: 0,
        etaMs: null,
        etaConfidence: 'none',
        etaLabel: '',
        isProgressionMode: isProgression,
      };
    }

    // ── Classify tools ──────────────────────────────────────────────────
    const preflightCompleted: ToolCallPart[] = [];
    const unifiedCompleted: ToolCallPart[] = [];
    let preflightRunning = 0;
    let unifiedRunning = 0;

    for (const p of toolParts) {
      if (p.preflight) {
        if (p.status === 'running') preflightRunning += 1;
        else preflightCompleted.push(p);
      } else if (p.tool === 'test_unified_build') {
        if (p.status === 'running') unifiedRunning += 1;
        else if (p.status === 'complete') unifiedCompleted.push(p);
      }
    }

    const preflightDone = preflightCompleted.length;
    const analysisStarted = unifiedCompleted.length > 0 || unifiedRunning > 0;
    const analysisDone = unifiedCompleted.length;

    // ── Detect phase ────────────────────────────────────────────────────
    let phase: AnalysisPhase;
    if (!isAnalyzing) {
      phase = toolParts.length > 0 ? 'done' : 'idle';
    } else if (analysisDone >= totals.analysisTotal && isWriting) {
      phase = 'writing';
    } else if (analysisStarted) {
      phase = 'analysis';
    } else {
      phase = 'preflight';
    }

    // ── Snap preflight to full on transition ───────────────────────────
    // Conditional preflight steps (e.g. test_ladder_clusters) may never
    // emit, so preflightDone can be < total when analysis starts. Clamp
    // the displayed denominator so the bar reaches the phase boundary.
    const displayedPreflightDone =
      phase === 'preflight' ? preflightDone : totals.preflightTotal;
    const displayedAnalysisDone =
      phase === 'analysis' ? analysisDone : phase === 'writing' || phase === 'done' ? totals.analysisTotal : 0;

    const preflightPct =
      totals.preflightTotal > 0
        ? Math.min(1, displayedPreflightDone / totals.preflightTotal)
        : 0;
    const analysisPct =
      totals.analysisTotal > 0
        ? Math.min(1, displayedAnalysisDone / totals.analysisTotal)
        : 0;

    // Writing phase — we don't know the token count in advance. Fall back
    // to a time-based bloom: 20 s assumed, ramping linearly.
    const writingStartMs =
      phase === 'writing' && unifiedCompleted.length > 0
        ? Math.max(
            ...unifiedCompleted.map(
              (p) => (p.startTime ?? 0) + (p.durationMs ?? 0),
            ),
          )
        : 0;
    const writingElapsedMs = writingStartMs > 0 ? Math.max(0, nowMs - writingStartMs) : 0;
    const writingPct = Math.min(1, writingElapsedMs / 20_000);

    // ── Elapsed ─────────────────────────────────────────────────────────
    const firstStart = toolParts
      .map((p) => p.startTime ?? Number.POSITIVE_INFINITY)
      .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
    let elapsedMs = 0;
    if (firstStart !== Number.POSITIVE_INFINITY) {
      if (phase === 'done') {
        // Freeze elapsed at the latest completion.
        const lastEnd = toolParts.reduce((max, p) => {
          const end = (p.startTime ?? 0) + (p.durationMs ?? 0);
          return end > max ? end : max;
        }, 0);
        elapsedMs = Math.max(0, lastEnd - firstStart);
      } else {
        elapsedMs = Math.max(0, nowMs - firstStart);
      }
    }

    // ── Overall percentage — monotone ───────────────────────────────────
    let overallPct = weightedOverall(phase, preflightPct, analysisPct, writingPct);
    if (phase === 'done') overallPct = 1;
    if (overallPct < monotoneRef.current) overallPct = monotoneRef.current;
    monotoneRef.current = overallPct;

    // ── Recalibrate speed factors from completed tools ─────────────────
    // The speed factor is a simple running mean of actualMs/expectedMs
    // ratios, computed ONLY from tools with expected > 2 s (small tools are
    // dominated by noise and would skew the ratio). Each render recomputes
    // from scratch — cheap because there are only ~13 preflight tools max.
    if (!isProgression) {
      let preflightRatioSum = 0;
      let preflightSamples = 0;
      for (const p of preflightCompleted) {
        if (p.status !== 'complete') continue;
        const expected = EXPECTED_MS_BY_TOOL[p.tool];
        if (!expected || expected < SPEED_FACTOR_MIN_EXPECTED_MS) continue;
        const actual = p.durationMs;
        if (actual == null || actual <= 0) continue;
        preflightRatioSum += actual / expected;
        preflightSamples += 1;
      }
      if (preflightSamples > 0) {
        preflightSpeedRef.current = {
          factor: preflightRatioSum / preflightSamples,
          samples: preflightSamples,
        };
      }

      let unifiedRatioSum = 0;
      let unifiedSamples = 0;
      for (const p of unifiedCompleted) {
        const actual = p.durationMs;
        if (actual == null || actual <= 0) continue;
        unifiedRatioSum += actual / EXPECTED_UNIFIED_CALL_MS;
        unifiedSamples += 1;
      }
      if (unifiedSamples > 0) {
        unifiedSpeedRef.current = {
          factor: unifiedRatioSum / unifiedSamples,
          samples: unifiedSamples,
        };
      }
    }

    const preflightSpeedFactor = preflightSpeedRef.current.factor;
    const preflightSpeedSamples = preflightSpeedRef.current.samples;
    // Unified phase inherits the preflight speed factor as its seed because
    // both share the same underlying PoB sim cost. Once real unified-call
    // data lands, `unifiedSpeedRef.current` takes over.
    const unifiedSpeedFactor =
      unifiedSpeedRef.current.samples > 0
        ? unifiedSpeedRef.current.factor
        : preflightSpeedFactor;

    // ── ETA — deterministic model with self-calibration ───────────────
    // Strategy: compute the *total* expected wall-clock from first-tool-start
    // to done, then subtract actual elapsed time. This makes the ETA tick
    // down smoothly by 1 second every second between tool completions, and
    // only *corrects* (up or down) when a tool completes and we recalibrate.
    //
    //   totalBaseline = preflightTotal + analysisTotal + writingTotal
    //     preflightTotal = max(skillsTotal, gearTotal, treeTotal)    ← parallel
    //                      but "done" tools subtract their ACTUAL time, not expected,
    //                      so the speedFactor applies only to future work.
    //     analysisTotal  = analysisDoneActual + (3 - done) × 40s × unifiedSpeedFactor
    //     writingTotal   = 20s (fixed)
    //
    //   etaMs = max(0, totalBaseline - elapsedMs)
    //
    // No smoothing needed — the subtraction against elapsedMs naturally
    // produces a smooth countdown. The only discrete jumps happen when a tool
    // completes AND the speed factor changes significantly.

    const completedPreflightTools = preflightCompleted.filter((p) => p.status === 'complete');
    const completedPreflightToolNames = new Set(completedPreflightTools.map((p) => p.tool));

    /**
     * Expected total wall-clock for a single preflight pipeline.
     * Completed tools contribute their *actual* duration (no prediction needed).
     * Remaining tools contribute `expected × speedFactor`.
     */
    function pipelineTotalMs(pipeline: ToolPipeline): number {
      let sum = 0;
      // Past work: sum of actual durations for already-completed tools in this pipeline
      for (const p of completedPreflightTools) {
        if (TOOL_PIPELINE[p.tool] !== pipeline) continue;
        sum += p.durationMs ?? 0;
      }
      // Future work: sum of expected × speedFactor for remaining tools in this pipeline
      for (const [toolName, expected] of Object.entries(EXPECTED_MS_BY_TOOL)) {
        if (TOOL_PIPELINE[toolName] !== pipeline) continue;
        if (completedPreflightToolNames.has(toolName)) continue;
        sum += expected * preflightSpeedFactor;
      }
      return sum;
    }

    const preflightTotalMs = Math.max(
      pipelineTotalMs('skills'),
      pipelineTotalMs('gear'),
      pipelineTotalMs('tree'),
    );

    // Analysis baseline: actual durations for completed unified calls +
    // projected cost for remaining ones. Only computed once we're past the
    // preflight phase to keep the preflight-phase baseline stable.
    const analysisActualMs = unifiedCompleted.reduce(
      (sum, p) => sum + (p.durationMs ?? 0),
      0,
    );
    const analysisRemainingCalls = Math.max(0, totals.analysisTotal - analysisDone);
    const analysisTotalMs =
      analysisActualMs +
      analysisRemainingCalls * EXPECTED_UNIFIED_CALL_MS * unifiedSpeedFactor;

    // Writing phase: fixed 20 s assumed. When we're IN the writing phase,
    // this naturally decays via the elapsed subtraction.
    const writingTotalMs = EXPECTED_WRITING_MS;

    const totalBaselineMs = preflightTotalMs + analysisTotalMs + writingTotalMs;

    let rawEtaMs: number | null = null;
    let etaConfidence: EtaConfidence = 'none';

    if (phase === 'preflight' || phase === 'analysis' || phase === 'writing') {
      rawEtaMs = Math.max(0, totalBaselineMs - elapsedMs);

      // Confidence grows as we accumulate data. Even at samples=0 we show a
      // real number because the baseline model is meaningful from t=0.
      if (phase === 'preflight') {
        etaConfidence =
          preflightSpeedSamples === 0
            ? 'low'
            : preflightSpeedSamples >= 3
              ? 'high'
              : 'medium';
      } else if (phase === 'analysis') {
        etaConfidence =
          unifiedSpeedRef.current.samples >= 2
            ? 'high'
            : unifiedSpeedRef.current.samples >= 1
              ? 'medium'
              : 'low';
      } else {
        etaConfidence = 'medium';
      }
    }

    const etaMs: number | null = rawEtaMs;

    // ── Format the ETA label ────────────────────────────────────────────
    // If elapsed has exceeded the baseline (we guessed low), show
    // "still working…" rather than negative numbers. This can happen when
    // the speed factor is still converging on an unusually slow build.
    let etaLabel = '';
    if (phase === 'done' || phase === 'idle') {
      etaLabel = '';
    } else if (etaMs == null || etaConfidence === 'none') {
      etaLabel = 'estimating…';
    } else if (etaMs <= 0) {
      etaLabel = 'still working…';
    } else {
      etaLabel = formatEta(etaMs);
    }

    // ── Phase label ─────────────────────────────────────────────────────
    let phaseLabel: string;
    if (isProgression) {
      phaseLabel =
        phase === 'done'
          ? 'Assessment complete'
          : phase === 'writing'
            ? 'Writing up…'
            : 'Assessing progression';
    } else {
      switch (phase) {
        case 'preflight':
          phaseLabel = `Preflight ${preflightDone} / ${totals.preflightTotal}`;
          break;
        case 'analysis':
          phaseLabel = `Analysis round ${Math.min(
            analysisDone + (unifiedRunning > 0 ? 1 : 0),
            totals.analysisTotal,
          )} / ${totals.analysisTotal}`;
          break;
        case 'writing':
          phaseLabel = 'Writing up…';
          break;
        case 'done':
          phaseLabel = 'Analysis complete';
          break;
        default:
          phaseLabel = '';
      }
    }

    return {
      phase,
      overallPct,
      preflightDone,
      preflightTotal: totals.preflightTotal,
      analysisDone,
      analysisTotal: totals.analysisTotal,
      phaseLabel,
      elapsedMs,
      etaMs,
      etaConfidence,
      etaLabel,
      isProgressionMode: isProgression,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, isAnalyzing, activePathway, nowMs, isWriting]);
}
