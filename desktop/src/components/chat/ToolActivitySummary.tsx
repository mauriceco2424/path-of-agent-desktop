/**
 * ToolActivitySummary — Unified Analysis Monitor Card
 *
 * A self-contained card with two views (overview / detail) that replaces
 * both the old activity feed AND separate ToolStepCard rendering.
 *
 * Overview: header + stats strip + scrollable activity feed + footer.
 * Detail: header with close button + full tool result renderer.
 *
 * Aesthetic: "Forge Hub" — deep dark backgrounds with dramatic amber/emerald
 * glows, individual tool cards with colored left-edge accents, radial bloom
 * effects, and breathing animations. Each tool call feels like a distinct
 * element being forged.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cog,
  X,
  Zap,
  Loader2,
  Activity,
  Timer,
  Brain,
  Eye,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MessagePart, ToolCallPart } from '../../../../shared/types/Chat';
import { TOOL_RENDERERS, stripToolTags, DefaultResult } from './ToolStepCard';
import { hydrateGearPackagesFromToolResult } from '../../store/gearPackageStore';
import { hydrateTreePackagesFromToolResult } from '../../store/treePackageStore';
import { hydrateAtlasPackagesFromToolResult } from '../../store/atlasPackageStore';
import { useDesktopStore } from '../../store';
import { useAnalysisProgress, type AnalysisPhase } from '../../hooks/useAnalysisProgress';

// =============================================================================
// Types
// =============================================================================

interface ToolActivitySummaryProps {
  /** All message parts for the active pathway (tool_call + text) */
  parts: MessagePart[];
  /** Whether the analysis is currently in progress */
  isAnalyzing: boolean;
  /**
   * Rendering variant.
   * - `'analysis'` (default): full "Analyzing Build" shell for the initial
   *   unified-build analysis run.
   * - `'follow-up'`: lighter wording for follow-up chat messages where the
   *   agent is just running a tool or two (e.g. a single trade search). The
   *   title becomes "Running Tools" / "Tools Complete" and the footer drops
   *   the "final written assessment" disclaimer since there is no separate
   *   assessment pass in a follow-up reply.
   */
  variant?: 'analysis' | 'follow-up';
}

// =============================================================================
// Constants
// =============================================================================

/** Tools that represent actual PoB simulations / computations */
const POB_SIM_TOOLS = new Set([
  'test_gear_setups', 'batch_test_tree', 'simulate_tree_changes',
  'test_gem_swaps', 'test_skill_setup', 'batch_test_jewels',
  'equip_and_test_item', 'validate_items_with_pob', 'test_combat_config',
  'test_combined_changes', 'test_unified_build', 'test_popular_jewels', 'search_and_validate',
  'simulate_ascendancy_swap',
]);

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/** True when the tool has rendered results worth clicking into */
function hasViewableResult(tool: ToolCallPart): boolean {
  return tool.status === 'complete' && tool.result != null && Object.keys(tool.result).length > 0;
}

/**
 * Extract a short contextual subtitle from tool input.
 *
 * Priority:
 * 1. `input.intent` — LLM-provided explanation of why it's making this call
 * 2. Structural extraction — slot names, candidate counts, etc.
 */
/**
 * Extract structural context from tool input (slot names, candidate counts, etc).
 * Does NOT include `input.intent` — that's shown separately as the primary description.
 */
function getToolContext(tool: ToolCallPart): string | null {
  const input = tool.input as Record<string, unknown> | undefined;
  if (!input) return null;
  switch (tool.tool) {
    case 'test_gear_setups': {
      const setups = input.setups as Array<{ items?: Array<{ slot?: string }> }> | undefined;
      if (!setups?.length) return null;
      const slots = new Set<string>();
      for (const s of setups) {
        if (s.items) for (const item of s.items) if (item.slot) slots.add(item.slot);
      }
      if (slots.size > 0) return [...slots].slice(0, 3).join(', ') + (slots.size > 3 ? ` +${slots.size - 3}` : '');
      return `${setups.length} setup${setups.length !== 1 ? 's' : ''}`;
    }

    case 'batch_simulate_tree': {
      const candidates = input.candidates as Array<{
        addNodes?: unknown[];
        removeNodes?: unknown[];
      }> | undefined;
      if (!candidates?.length) return null;
      const totalAdds = candidates.reduce((n, c) => n + (c.addNodes?.length ?? 0), 0);
      const totalRemoves = candidates.reduce((n, c) => n + (c.removeNodes?.length ?? 0), 0);
      if (totalRemoves > 0 && totalAdds === 0) return `Checking ${candidates.length} node${candidates.length !== 1 ? 's' : ''} for respec`;
      if (totalAdds > 0 && totalRemoves === 0) return `Testing ${candidates.length} node addition${candidates.length !== 1 ? 's' : ''}`;
      return `${candidates.length} tree change${candidates.length !== 1 ? 's' : ''}`;
    }

    case 'test_gem_swaps': {
      const swaps = input.swaps as Array<unknown> | undefined;
      if (!swaps?.length) return null;
      return `${swaps.length} support gem swap${swaps.length !== 1 ? 's' : ''}`;
    }

    case 'test_skill_setup': {
      const variants = input.variants as Array<{ label?: string }> | undefined;
      if (!variants?.length) return null;
      const labels = variants.map((v) => v.label).filter(Boolean).slice(0, 2);
      if (labels.length > 0) return labels.join(', ') + (variants.length > labels.length ? ` +${variants.length - labels.length}` : '');
      return `${variants.length} setup variant${variants.length !== 1 ? 's' : ''}`;
    }

    case 'batch_test_jewels': {
      const configs = input.configurations as Array<unknown> | undefined;
      if (!configs?.length) return null;
      return `${configs.length} jewel configuration${configs.length !== 1 ? 's' : ''}`;
    }

    case 'simulate_tree_changes': {
      const addNodes = input.addNodes as unknown[] | undefined;
      const removeNodes = input.removeNodes as unknown[] | undefined;
      const parts: string[] = [];
      if (addNodes?.length) parts.push(`+${addNodes.length} node${addNodes.length !== 1 ? 's' : ''}`);
      if (removeNodes?.length) parts.push(`-${removeNodes.length} node${removeNodes.length !== 1 ? 's' : ''}`);
      return parts.length > 0 ? parts.join(', ') : null;
    }

    case 'search_trade':
    case 'search_trade_weighted': {
      return (input.slot as string) ?? null;
    }

    default:
      return null;
  }
}

/** Get accent color config for a tool based on its type */
function getToolAccent(tool: ToolCallPart): { color: string; glow: string; bg: string; border: string } {
  if (tool.preflight) {
    return {
      color: 'rgb(56, 189, 248)',       // sky-400
      glow: 'rgba(56, 189, 248, 0.4)',
      bg: 'rgba(56, 189, 248, 0.06)',
      border: 'rgba(56, 189, 248, 0.15)',
    };
  }
  if (POB_SIM_TOOLS.has(tool.tool)) {
    return {
      color: 'rgb(251, 191, 36)',       // amber-400
      glow: 'rgba(251, 191, 36, 0.4)',
      bg: 'rgba(251, 191, 36, 0.06)',
      border: 'rgba(251, 191, 36, 0.15)',
    };
  }
  // General / synthesis / other
  return {
    color: 'rgb(167, 139, 250)',         // violet-400
    glow: 'rgba(167, 139, 250, 0.4)',
    bg: 'rgba(167, 139, 250, 0.06)',
    border: 'rgba(167, 139, 250, 0.15)',
  };
}

/**
 * Phase-specific accent tokens for the HUD progress bar and card chrome.
 * preflight = sky, analysis = amber, writing = violet, done = emerald (quiet).
 * Mirrors the existing tool-accent palette used by ActivityRow / Section headers.
 */
interface PhaseAccent {
  solid: string;        // rgb — for icons, segment fills, borders
  glow: string;         // rgba — for box-shadow glows
  border: string;       // rgba — idle card border
  borderActive: string; // rgba — active card border (animated)
  dim: string;          // rgba — empty segment background
}

function getPhaseAccent(phase: AnalysisPhase): PhaseAccent {
  switch (phase) {
    case 'preflight':
      return {
        solid: 'rgb(56, 189, 248)',         // sky-400
        glow: 'rgba(56, 189, 248, 0.45)',
        border: 'rgba(56, 189, 248, 0.18)',
        borderActive: 'rgba(56, 189, 248, 0.32)',
        dim: 'rgba(56, 189, 248, 0.08)',
      };
    case 'analysis':
      return {
        solid: 'rgb(251, 191, 36)',         // amber-400
        glow: 'rgba(251, 191, 36, 0.45)',
        border: 'rgba(251, 191, 36, 0.22)',
        borderActive: 'rgba(251, 191, 36, 0.38)',
        dim: 'rgba(251, 191, 36, 0.08)',
      };
    case 'writing':
      return {
        solid: 'rgb(167, 139, 250)',        // violet-400
        glow: 'rgba(167, 139, 250, 0.45)',
        border: 'rgba(167, 139, 250, 0.22)',
        borderActive: 'rgba(167, 139, 250, 0.38)',
        dim: 'rgba(167, 139, 250, 0.08)',
      };
    case 'done':
      return {
        solid: 'rgb(52, 211, 153)',         // emerald-400
        glow: 'rgba(52, 211, 153, 0.25)',
        border: 'rgba(71, 85, 105, 0.25)',
        borderActive: 'rgba(71, 85, 105, 0.25)',
        dim: 'rgba(71, 85, 105, 0.18)',
      };
    default:
      return {
        solid: 'rgb(148, 163, 184)',        // slate-400
        glow: 'rgba(148, 163, 184, 0.25)',
        border: 'rgba(71, 85, 105, 0.25)',
        borderActive: 'rgba(71, 85, 105, 0.25)',
        dim: 'rgba(71, 85, 105, 0.18)',
      };
  }
}

// =============================================================================
// HUD Phase Bar — three-segment progress display
// =============================================================================

interface HudPhaseBarProps {
  progress: import('../../hooks/useAnalysisProgress').AnalysisProgress;
}

/**
 * Segmented HUD progress bar. Three chunks represent preflight / analysis /
 * writing phases; each fills independently and glows when active. Inline
 * step readouts (e.g. "7 / 13") sit beneath each segment.
 *
 * Progression mode is rendered as a single shimmering indeterminate segment
 * since progression has no meaningful step count.
 */
function HudPhaseBar({ progress }: HudPhaseBarProps) {
  const { phase, preflightDone, preflightTotal, analysisDone, analysisTotal, isProgressionMode } = progress;

  if (isProgressionMode) {
    // Simpler fallback — single indeterminate shimmer for progression mode.
    const accent = getPhaseAccent(phase === 'done' ? 'done' : 'preflight');
    return (
      <div className="mt-3 h-[6px] rounded-full overflow-hidden relative" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accent.glow} 50%, transparent 100%)`,
            animation: 'shimmer 2s linear infinite',
          }}
        />
      </div>
    );
  }

  const preflightAccent = getPhaseAccent('preflight');
  const analysisAccent = getPhaseAccent('analysis');
  const writingAccent = getPhaseAccent('writing');

  // Per-segment fill — normalized 0..1 within the segment itself, not the
  // overall bar. Past phases clamp to 1; future phases stay at 0.
  const preflightFill =
    phase === 'preflight'
      ? Math.min(1, preflightTotal > 0 ? preflightDone / preflightTotal : 0)
      : phase === 'idle'
        ? 0
        : 1;
  const analysisFill =
    phase === 'analysis'
      ? Math.min(1, analysisTotal > 0 ? analysisDone / analysisTotal : 0)
      : phase === 'writing' || phase === 'done'
        ? 1
        : 0;
  const writingFill = phase === 'writing' ? 0.5 : phase === 'done' ? 1 : 0;

  const segments: Array<{
    key: 'preflight' | 'analysis' | 'writing';
    flex: number;
    fill: number;
    accent: PhaseAccent;
    active: boolean;
    label: string;
  }> = [
    {
      key: 'preflight',
      flex: 50,
      fill: preflightFill,
      accent: preflightAccent,
      active: phase === 'preflight',
      label: `${Math.min(preflightDone, preflightTotal)} / ${preflightTotal}`,
    },
    {
      key: 'analysis',
      flex: 40,
      fill: analysisFill,
      accent: analysisAccent,
      active: phase === 'analysis',
      label: `${analysisDone} / ${analysisTotal}`,
    },
    {
      key: 'writing',
      flex: 10,
      fill: writingFill,
      accent: writingAccent,
      active: phase === 'writing',
      label: phase === 'writing' ? '…' : '—',
    },
  ];

  return (
    <div className="mt-3">
      {/* Bar row */}
      <div className="flex items-center gap-1.5">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="relative h-[6px] rounded-full overflow-hidden"
            style={{
              flexGrow: seg.flex,
              background: seg.active || seg.fill > 0 ? seg.accent.dim : 'rgba(15, 23, 42, 0.6)',
              boxShadow: seg.active ? `inset 0 0 4px ${seg.accent.glow}` : 'none',
              transition: 'background 0.4s ease-out',
            }}
          >
            {/* Fill */}
            <motion.div
              initial={false}
              animate={{ width: `${Math.max(seg.fill * 100, seg.fill > 0 ? 3 : 0)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${seg.accent.solid} 0%, ${seg.accent.glow.replace(/[\d.]+\)$/, '0.7)')} 100%)`,
                boxShadow: seg.active
                  ? `0 0 10px ${seg.accent.glow}, 0 0 3px ${seg.accent.solid}`
                  : `0 0 4px ${seg.accent.glow}`,
              }}
            >
              {/* Shimmer sweep only on active segment */}
              {seg.active && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.32) 50%, transparent 100%)',
                    animation: 'shimmer 1.8s linear infinite',
                  }}
                />
              )}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Segment readouts — tiny numbers under each segment */}
      <div className="flex items-center gap-1.5 mt-1">
        {segments.map((seg) => (
          <div
            key={`${seg.key}-label`}
            className="flex items-center justify-between text-[0.5rem] font-mono tabular-nums px-0.5"
            style={{
              flexGrow: seg.flex,
              color: seg.active ? seg.accent.solid : 'rgb(100, 116, 139)',
              opacity: seg.active ? 0.75 : 0.35,
              textShadow: seg.active ? `0 0 6px ${seg.accent.glow}` : undefined,
              transition: 'color 0.3s ease-out, opacity 0.3s ease-out',
            }}
          >
            <span className="uppercase tracking-[0.1em]">{seg.key}</span>
            <span>{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Animation variants
// =============================================================================

const viewVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: 'easeIn' } },
};

// =============================================================================
// Sub-components
// =============================================================================

interface ActivityRowProps {
  tool: ToolCallPart;
  onClick: (() => void) | undefined;
}

/** A single tool card in the activity feed — mini card style with colored accents */
function ActivityRow({ tool, onClick }: ActivityRowProps) {
  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';
  const clickable = onClick != null;
  const accent = getToolAccent(tool);

  // Intent = the LLM's explanation of *why* it's calling this tool (from input.intent)
  const intent = (tool.input as Record<string, unknown> | undefined)?.intent as string | undefined;
  // Context = structural extraction (slot names, candidate counts, etc.)
  const structuralContext = getToolContext(tool);
  // Outcome = what the tool returned (from result.summary/description)
  const rawOutcome = (tool.result?.summary as string) ?? (tool.result?.description as string) ?? null;
  const outcomeText = rawOutcome ? stripToolTags(rawOutcome) : null;

  // Outcome/structural context first (factual status), intent below (the "why")
  const statusLine = outcomeText ?? structuralContext;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      data-tool-name={tool.tool}
      data-call-number={tool.result?.callNumber != null ? String(tool.result.callNumber) : undefined}
      onClick={onClick}
      className={cn(
        'group/row relative rounded-lg overflow-hidden',
        'transition-all duration-200',
        !isRunning && clickable && 'cursor-pointer hover:scale-[1.01]',
      )}
      style={{
        background: isRunning
          ? `linear-gradient(135deg, ${accent.bg} 0%, rgba(251, 191, 36, 0.02) 100%)`
          : isError
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)'
            : `linear-gradient(135deg, ${accent.bg} 0%, transparent 100%)`,
        border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.15)' : accent.border}`,
        boxShadow: isRunning
          ? `0 0 12px ${accent.glow.replace('0.4', '0.08')}, inset 0 1px 0 rgba(255,255,255,0.02)`
          : clickable
            ? `inset 0 1px 0 rgba(255,255,255,0.02)`
            : 'none',
      }}
      whileHover={clickable && !isRunning ? {
        boxShadow: `0 0 16px ${accent.glow.replace('0.4', '0.12')}, inset 0 1px 0 rgba(255,255,255,0.03)`,
      } : undefined}
    >
      {/* Color accent bar (left edge) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: isError
            ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.6) 0%, rgba(239, 68, 68, 0.2) 100%)'
            : `linear-gradient(180deg, ${accent.color} 0%, ${accent.glow.replace('0.4', '0.15')} 100%)`,
          boxShadow: isRunning ? `0 0 6px ${accent.glow.replace('0.4', '0.3')}` : 'none',
        }}
      />

      {/* Shimmer sweep for running row */}
      {isRunning && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${accent.glow.replace('0.4', '0.08')} 50%, transparent 100%)`,
              animation: 'shimmer 2s linear infinite',
            }}
          />
        </div>
      )}

      <div className="relative flex items-start gap-2.5 px-3 pl-4 py-2">
        {/* Status icon */}
        <div className="relative flex-shrink-0 w-4 h-4 mt-[1px] flex items-center justify-center">
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accent.color }} />
          ) : isError ? (
            <XCircle className="w-3.5 h-3.5 text-red-400/80" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accent.color, opacity: 0.7 }} />
          )}
          {/* Glow dot behind running icon */}
          {isRunning && (
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: `0 0 10px ${accent.glow}`, background: 'transparent' }}
            />
          )}
        </div>

        {/* Name + intent + outcome */}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              'block truncate text-[0.6875rem] leading-tight',
              isRunning && 'font-medium',
              isError && 'text-red-300/70',
              !isRunning && !isError && 'group-hover/row:text-slate-200',
            )}
            style={{
              color: isRunning
                ? accent.color
                : isError
                  ? undefined
                  : 'rgb(148, 163, 184)', // slate-400
              textShadow: isRunning ? `0 0 12px ${accent.glow}` : undefined,
            }}
          >
            {tool.displayName}
          </span>
          {/* Status line: outcome or structural context */}
          {statusLine && (
            <span className="block truncate text-[0.5625rem] text-slate-600 leading-tight mt-[2px]">
              {statusLine}
            </span>
          )}
          {/* Intent line: the LLM's explanation of why it called this tool */}
          {intent && (
            <span
              className="block text-[0.5625rem] text-slate-400/70 leading-tight mt-[1px] italic"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}
            >
              {intent}
            </span>
          )}
        </div>

        {/* Duration / running dots */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-[1px]">
          {tool.durationMs != null && !isRunning && (
            <span
              className="text-[0.5625rem] font-mono tabular-nums"
              style={{ color: accent.color, opacity: 0.4 }}
            >
              {formatDuration(tool.durationMs)}
            </span>
          )}
          {isRunning && (
            <div className="flex items-center gap-[3px] flex-shrink-0">
              <div className="w-[3px] h-[3px] rounded-full animate-pulse" style={{ backgroundColor: accent.color }} />
              <div className="w-[3px] h-[3px] rounded-full animate-pulse [animation-delay:150ms]" style={{ backgroundColor: accent.color, opacity: 0.7 }} />
              <div className="w-[3px] h-[3px] rounded-full animate-pulse [animation-delay:300ms]" style={{ backgroundColor: accent.color, opacity: 0.4 }} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ToolActivitySummary({
  parts,
  isAnalyzing,
  variant = 'analysis',
}: ToolActivitySummaryProps) {
  const isFollowUpVariant = variant === 'follow-up';
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const agenticFeedRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const activePathway = useDesktopStore((s) => s.activePathway);
  const isProgressionMode = activePathway === 'progression';

  // ── Derived state ────────────────────────────────────────────────────────

  const toolParts = useMemo(
    () => parts.filter((p): p is ToolCallPart => p.type === 'tool_call'),
    [parts],
  );

  // Hydrate gear + tree package stores from completed tool results.
  // Covers restored history (where SSE handler didn't run) and HMR reloads.
  useEffect(() => {
    for (const p of toolParts) {
      if (p.status !== 'complete' || !p.result) continue;

      if (p.tool === 'test_gear_setups') {
        hydrateGearPackagesFromToolResult(p.result as Record<string, unknown>);
      } else if (p.tool === 'batch_test_tree' || p.tool === 'batch_simulate_tree') {
        hydrateTreePackagesFromToolResult(p.result as Record<string, unknown>);
      } else if (p.tool === 'suggest_atlas_path') {
        hydrateAtlasPackagesFromToolResult(p.result as Record<string, unknown>);
      } else if (p.tool === 'test_unified_build') {
        // Unified tool nests gear + tree data inside sections
        const ud = p.result as Record<string, unknown>;
        const sections = Array.isArray(ud.sections)
          ? ud.sections as Array<Record<string, unknown>>
          : [];
        for (const s of sections) {
          // Display payloads nest under section.data; model payloads spread flat
          const sectionData = (s.data && typeof s.data === 'object')
            ? s.data as Record<string, unknown>
            : Array.isArray(s.results) ? s as Record<string, unknown>
            : null;
          if (!sectionData) continue;
          if (s.kind === 'gear') hydrateGearPackagesFromToolResult(sectionData);
          if (s.kind === 'tree') hydrateTreePackagesFromToolResult(sectionData);
        }
      }
    }
  }, [toolParts]);

  const totalTools = toolParts.length;
  const completedTools = toolParts.filter((p) => p.status === 'complete').length;
  const errorTools = toolParts.filter((p) => p.status === 'error').length;
  const runningTool = toolParts.find((p) => p.status === 'running');

  const totalDurationMs = useMemo(
    () => toolParts.reduce((sum, p) => sum + (p.durationMs ?? 0), 0),
    [toolParts],
  );

  const finishedTools = completedTools + errorTools;
  const allDone = !isAnalyzing && !runningTool;
  const hasErrors = errorTools > 0;

  // LLM is thinking: analyzing but no tool is currently running in PoB
  const isThinking = isAnalyzing && !runningTool;

  // ── Preflight vs Sim breakdown ────────────────────────────────────────────

  const preflightCount = useMemo(
    () => toolParts.filter((p) => p.preflight === true && p.status !== 'running').length,
    [toolParts],
  );
  const simCount = useMemo(() => {
    let count = 0;
    for (const p of toolParts) {
      if (!POB_SIM_TOOLS.has(p.tool) || p.preflight || p.status === 'running') continue;
      if (p.tool === 'test_unified_build' && p.result) {
        // Count individual sub-tool invocations within unified build
        const tested = p.result.tested as Record<string, number> | undefined;
        if (tested) {
          count += (tested.gear > 0 ? 1 : 0) + (tested.gemSwaps > 0 ? 1 : 0)
            + (tested.skillSetups > 0 ? 1 : 0) + (tested.tree > 0 ? 1 : 0)
            + (tested.combined > 0 ? 1 : 0);
        } else {
          count += 1; // fallback
        }
      } else {
        count += 1;
      }
    }
    return count;
  }, [toolParts]);

  // ── Aggregate configs tested (sum of totalTested across all tool results) ──

  const totalConfigsTested = useMemo(() => {
    let total = 0;
    for (const p of toolParts) {
      if (p.status !== 'complete' || !p.result) continue;
      // totalTestedAllPasses is the cumulative count if available (avoids double-counting)
      // Otherwise fall back to totalTested for that single call
      const tested = (p.result.totalTested as number) ?? 0;
      total += tested;
    }
    return total;
  }, [toolParts]);

  // ── Live elapsed timer ────────────────────────────────────────────────────

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (allDone || totalTools === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [allDone, totalTools]);

  const firstStartTime = toolParts[0]?.startTime;
  const elapsedMs = useMemo(() => {
    if (!firstStartTime) return 0;
    if (allDone) {
      const lastEnd = Math.max(
        ...toolParts.map((p) => (p.startTime ?? 0) + (p.durationMs ?? 0)),
      );
      return lastEnd - firstStartTime;
    }
    return now - firstStartTime;
  }, [allDone, firstStartTime, now, toolParts]);

  // ── HUD progress model ──────────────────────────────────────────────────
  // Follow-up variant is short and single-tool; the HUD bar only renders for
  // the full analysis variant.
  const unifiedCompleteCount = useMemo(
    () => toolParts.filter((p) => p.tool === 'test_unified_build' && p.status === 'complete').length,
    [toolParts],
  );
  const isWriting =
    !isFollowUpVariant && isAnalyzing && !runningTool && unifiedCompleteCount >= 3;

  const progress = useAnalysisProgress({
    parts,
    isAnalyzing,
    activePathway: activePathway ?? null,
    nowMs: now,
    isWriting,
  });

  const phaseAccent = getPhaseAccent(progress.phase);
  const showHud = !isFollowUpVariant && (isAnalyzing || toolParts.length > 0);

  // ── Completion flash ──────────────────────────────────────────────────────

  const prevAllDoneRef = useRef(allDone);
  const [showCompletionFlash, setShowCompletionFlash] = useState(false);

  useEffect(() => {
    if (!prevAllDoneRef.current && allDone && totalTools > 0) {
      setShowCompletionFlash(true);
      const timer = setTimeout(() => setShowCompletionFlash(false), 1500);
      return () => clearTimeout(timer);
    }
    prevAllDoneRef.current = allDone;
  }, [allDone, totalTools]);

  // ── Auto-collapse when analysis completes ────────────────────────────────
  //
  // Only applies to the full 'analysis' variant. Follow-up replies are short
  // and should stay expanded inline so the user can click into the tool result
  // without an extra click to re-expand the shell.
  useEffect(() => {
    if (isFollowUpVariant) return;
    if (allDone && totalTools > 0) {
      setIsCollapsed(true);
    }
  }, [allDone, totalTools, isFollowUpVariant]);

  // ── Expand while analysis is running ───────────────────────────────────
  useEffect(() => {
    if (!allDone && isCollapsed) {
      setIsCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  // Split tools into preflight and agentic (non-preflight) groups
  const preflightTools = useMemo(
    () => toolParts.filter((p) => p.preflight === true),
    [toolParts],
  );
  const agenticTools = useMemo(
    () => toolParts.filter((p) => !p.preflight),
    [toolParts],
  );

  // Show last 8 of each group in their respective feeds
  const visiblePreflightTools = preflightTools.slice(-8);
  const visibleAgenticTools = agenticTools.slice(-8);

  // Legacy — kept for scroll/auto-collapse logic
  const visibleTools = toolParts.slice(-8);

  // The tool currently expanded in detail view
  const expandedTool = expandedToolId
    ? toolParts.find((p) => p.id === expandedToolId) ?? null
    : null;

  // ── Auto-scroll feed to bottom on new tools ──────────────────────────────

  useEffect(() => {
    if (expandedToolId === null) {
      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
      if (agenticFeedRef.current) agenticFeedRef.current.scrollTop = agenticFeedRef.current.scrollHeight;
    }
  }, [toolParts.length, runningTool?.id, expandedToolId]);

  // ── Auto-collapse detail view when a new tool starts running ─────────────

  useEffect(() => {
    if (runningTool && expandedToolId) {
      setExpandedToolId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningTool?.id]);

  // ── SimResult pill navigation ────────────────────────────────────────────

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      const toolName = target.getAttribute('data-tool-name');
      const callNum = target.getAttribute('data-call-number');
      if (toolName) {
        const match = callNum
          ? toolParts.find(
              (p) => p.tool === toolName && String(p.result?.callNumber) === callNum,
            )
          : [...toolParts].reverse().find((p) => p.tool === toolName);
        if (match) {
          setExpandedToolId(match.id);
          setIsCollapsed(false);
        }
      }
    };
    el.addEventListener('expand-tool-step', handler, true);
    return () => el.removeEventListener('expand-tool-step', handler, true);
  }, [toolParts]);

  // ── Early exit ───────────────────────────────────────────────────────────

  if (totalTools === 0 && !isAnalyzing) return null;

  // ── Render ───────────────────────────────────────────────────────────────

  // ── Collapsed bar ──────────────────────────────────────────────────────
  if (isCollapsed && allDone) {
    return (
      <div ref={cardRef} className="mb-4">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className={cn(
            'relative w-full rounded-xl overflow-hidden',
            'flex items-center gap-3 px-4 py-2.5',
            'hover:brightness-110 transition-all duration-200',
            'text-left',
          )}
          style={{
            background:
              'linear-gradient(180deg, rgba(15, 10, 25, 0.95) 0%, rgba(8, 5, 15, 0.98) 100%)',
            border: `1px solid ${hasErrors ? 'rgba(239, 68, 68, 0.2)' : 'rgba(71, 85, 105, 0.25)'}`,
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          }}
        >
          {/* Status icon */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.06) 50%, transparent 70%)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
            }}
          >
            {hasErrors ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/80" />
            )}
          </div>

          {/* Title */}
          <span className="font-display text-xs font-semibold text-amber-100/80 tracking-wide">
            Analysis Complete
          </span>

          {/* Compact stats */}
          <div className="flex items-center gap-2 text-[0.625rem] font-mono tabular-nums">
            <span className="text-slate-500">{totalTools} tools</span>
            <span className="text-slate-700">&bull;</span>
            <span className="text-slate-500">{formatDuration(elapsedMs)}</span>
            {totalConfigsTested > 0 && (
              <>
                <span className="text-slate-700">&bull;</span>
                <span className="text-emerald-400/60">{totalConfigsTested} tested</span>
              </>
            )}
          </div>

          {/* Expand chevron */}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-auto flex-shrink-0" />
        </button>
      </div>
    );
  }

  // Phase-driven chrome. During analysis the card border + radial glows
  // cross-fade from sky (preflight) → amber (analysis) → violet (writing).
  // When done or errored, fall back to the quiet slate/red chrome.
  const chromeColor = showHud && !allDone
    ? phaseAccent
    : hasErrors
      ? {
          solid: 'rgb(239, 68, 68)',
          glow: 'rgba(239, 68, 68, 0.25)',
          border: 'rgba(239, 68, 68, 0.2)',
          borderActive: 'rgba(239, 68, 68, 0.2)',
          dim: 'rgba(239, 68, 68, 0.1)',
        }
      : getPhaseAccent('idle');

  return (
    <div ref={cardRef} className="mb-4">
      <div
        className={cn(
          'relative rounded-xl overflow-hidden',
          'transition-all duration-500',
        )}
        style={{
          background:
            'linear-gradient(180deg, rgba(15, 10, 25, 0.95) 0%, rgba(8, 5, 15, 0.98) 100%)',
          border: `1px solid ${!allDone ? chromeColor.borderActive : chromeColor.border}`,
          boxShadow: !allDone
            ? `0 4px 30px rgba(0, 0, 0, 0.35), 0 0 40px ${chromeColor.glow.replace(/[\d.]+\)$/, '0.1)')}, inset 0 1px 0 rgba(255, 255, 255, 0.04)`
            : '0 4px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          animation: !allDone ? 'borderPulse 3s ease-in-out infinite' : 'none',
          transition: 'border-color 0.6s ease-out, box-shadow 0.6s ease-out',
        }}
      >
        {/* Decorative radial glow (top-left) — phase-tinted */}
        <div
          className="absolute top-0 left-0 w-48 h-48 -translate-y-1/2 -translate-x-1/4 rounded-full pointer-events-none"
          style={{
            background: !allDone
              ? `radial-gradient(circle, ${chromeColor.glow.replace(/[\d.]+\)$/, '0.15)')} 0%, transparent 70%)`
              : 'radial-gradient(circle, rgba(251, 191, 36, 0.04) 0%, transparent 70%)',
            transition: 'background 0.6s ease-out',
          }}
        />

        {/* Secondary glow (bottom-right, breathing) — complementary tint */}
        {!allDone && (
          <div
            className="absolute bottom-0 right-0 w-36 h-36 translate-y-1/3 translate-x-1/4 rounded-full pointer-events-none animate-glow-breathe"
            style={{
              background: `radial-gradient(circle, ${chromeColor.glow.replace(/[\d.]+\)$/, '0.06)')} 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Completion celebration flash */}
        <AnimatePresence>
          {showCompletionFlash && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, exit: { duration: 1.0 } }}
              style={{
                background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.18) 0%, transparent 65%)',
                boxShadow: 'inset 0 0 80px rgba(251, 191, 36, 0.06)',
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {expandedTool ? (
            /* ═══════════════════════════════════════════════════════════════
               DETAIL VIEW — single tool result
               ═══════════════════════════════════════════════════════════════ */
            <motion.div
              key="detail"
              variants={viewVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              data-tool-name={expandedTool.tool}
              data-call-number={
                expandedTool.result?.callNumber != null
                  ? String(expandedTool.result.callNumber)
                  : undefined
              }
            >
              {/* Detail header */}
              <div className="relative px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                  {/* Icon in tinted box */}
                  <div
                    className="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.06) 50%, transparent 70%)',
                      border: '1px solid rgba(251, 191, 36, 0.2)',
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-400/80" />
                  </div>

                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-sm font-semibold text-amber-100/90 tracking-wide truncate">
                      {expandedTool.displayName}
                    </h3>
                    {expandedTool.durationMs != null && (
                      <p className="text-[0.625rem] text-amber-400/40 mt-0.5">
                        Completed in {formatDuration(expandedTool.durationMs)}
                      </p>
                    )}
                  </div>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setExpandedToolId(null)}
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0',
                      'text-slate-500 hover:text-amber-300/80',
                      'border border-transparent hover:border-amber-500/20',
                      'hover:bg-amber-500/[0.06]',
                      'transition-all duration-200',
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Detail body — no height constraint, let page scroll */}
              <div className="px-4 pb-4">
                <DetailBody tool={expandedTool} />
              </div>
            </motion.div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               OVERVIEW — header + stats + activity feed + footer
               ═══════════════════════════════════════════════════════════════ */
            <motion.div
              key="overview"
              variants={viewVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="relative px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                  {/* Icon in tinted box — breathing glow while analyzing */}
                  <motion.div
                    className="relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    animate={!allDone ? {
                      boxShadow: [
                        '0 0 12px rgba(251, 191, 36, 0.15), inset 0 0 8px rgba(251, 191, 36, 0.08)',
                        '0 0 24px rgba(251, 191, 36, 0.35), inset 0 0 16px rgba(251, 191, 36, 0.18)',
                        '0 0 12px rgba(251, 191, 36, 0.15), inset 0 0 8px rgba(251, 191, 36, 0.08)',
                      ],
                    } : { boxShadow: '0 0 0px transparent' }}
                    transition={!allDone ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.5 }}
                    style={{
                      background: !allDone
                        ? 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.12) 50%, rgba(251, 191, 36, 0.03) 100%)'
                        : 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.06) 50%, transparent 70%)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                    }}
                  >
                    {!allDone ? (
                      <Cog className="w-[18px] h-[18px] text-amber-400 animate-[spin_3s_linear_infinite]" />
                    ) : hasErrors ? (
                      <AlertTriangle className="w-[18px] h-[18px] text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-[18px] h-[18px] text-amber-400/80" />
                    )}

                    {/* Ember dots floating near icon */}
                    {!allDone && (
                      <>
                        <motion.div
                          className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400/50"
                          animate={{ y: [0, -4, 0], opacity: [0.3, 0.8, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ boxShadow: '0 0 6px rgba(251, 191, 36, 0.6)' }}
                        />
                        <motion.div
                          className="absolute top-0.5 -right-2 w-1 h-1 rounded-full bg-amber-400/30"
                          animate={{ y: [0, -3, 0], opacity: [0.2, 0.6, 0.2] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                          style={{ boxShadow: '0 0 4px rgba(251, 191, 36, 0.4)' }}
                        />
                        <motion.div
                          className="absolute -top-0.5 -left-1 w-1 h-1 rounded-full bg-amber-400/25"
                          animate={{ y: [0, -3, 0], opacity: [0.15, 0.5, 0.15] }}
                          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 1.0 }}
                          style={{ boxShadow: '0 0 4px rgba(251, 191, 36, 0.3)' }}
                        />
                      </>
                    )}
                  </motion.div>

                  {/* Title + subtitle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h3
                        className="font-display text-[0.9375rem] font-semibold text-amber-100/90 tracking-wide flex-1 min-w-0 truncate"
                        style={!allDone ? { textShadow: `0 0 24px ${phaseAccent.glow.replace(/[\d.]+\)$/, '0.25)')}` } : undefined}
                      >
                        {isProgressionMode
                          ? (!allDone ? 'Assessing Progression' : 'Assessment Complete')
                          : isFollowUpVariant
                            ? (!allDone ? 'Running Tools' : 'Tools Complete')
                            : (!allDone ? 'Analyzing Build' : 'Analysis Complete')}
                      </h3>
                      {/* Right-aligned ETA — only during active analysis variant */}
                      {showHud && !allDone && progress.etaLabel && (
                        <motion.span
                          key={progress.etaLabel}
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className="text-[0.625rem] font-mono tabular-nums flex-shrink-0"
                          style={{
                            color: phaseAccent.solid,
                            opacity: 0.65,
                            textShadow: `0 0 8px ${phaseAccent.glow}`,
                          }}
                        >
                          {progress.etaLabel}
                        </motion.span>
                      )}
                    </div>
                    <p className="text-[0.625rem] text-amber-400/40 mt-0.5 flex items-center gap-2">
                      {!allDone ? (
                        <>
                          <span className="truncate">
                            {runningTool?.displayName
                              ? `Running: ${runningTool.displayName}`
                              : 'Running tools in Path of Building'}
                          </span>
                          {showHud && progress.phaseLabel && (
                            <>
                              <span className="text-slate-700 flex-shrink-0">&bull;</span>
                              <span
                                className="flex-shrink-0 font-medium"
                                style={{ color: phaseAccent.solid, opacity: 0.55 }}
                              >
                                {progress.phaseLabel}
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <span>{`${totalTools} tool${totalTools !== 1 ? 's' : ''} \u2022 ${formatDuration(elapsedMs)}`}</span>
                      )}
                    </p>
                  </div>

                  {/* Collapse button (only when done) */}
                  {allDone && (
                    <button
                      type="button"
                      onClick={() => setIsCollapsed(true)}
                      className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0',
                        'text-slate-500 hover:text-amber-300/80',
                        'border border-transparent hover:border-amber-500/20',
                        'hover:bg-amber-500/[0.06]',
                        'transition-all duration-200',
                      )}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* HUD segmented progress bar — three phases (preflight/analysis/writing) */}
                {showHud && !allDone && (
                  <HudPhaseBar progress={progress} />
                )}
              </div>

              {/* ── Stats strip (single compact row) ─────────────────────── */}
              <div className="px-4 pb-3">
                <div className="flex gap-1.5">
                  {/* Configs tested (hidden for progression — no PoB) */}
                  {totalConfigsTested > 0 && !isProgressionMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05, duration: 0.3, ease: 'easeOut' }}
                      className="relative flex-1 rounded-lg px-2 py-1.5 overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.06) 0%, transparent 100%)',
                        border: '1px solid rgba(52, 211, 153, 0.12)',
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Activity className="w-2.5 h-2.5 text-emerald-400/50" />
                        <span className="text-[0.4375rem] text-emerald-400/45 uppercase tracking-wider font-medium">Tested</span>
                      </div>
                      <div
                        className="text-sm font-display font-semibold text-emerald-200/85 tabular-nums leading-tight"
                        style={totalConfigsTested > 50 ? { textShadow: '0 0 10px rgba(52, 211, 153, 0.2)' } : undefined}
                      >
                        {totalConfigsTested}
                      </div>
                    </motion.div>
                  )}

                  {/* Preflight (hidden for progression — no PoB) */}
                  {!isProgressionMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.3, ease: 'easeOut' }}
                    className="relative flex-1 rounded-lg px-2 py-1.5 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.06) 0%, transparent 100%)',
                      border: '1px solid rgba(56, 189, 248, 0.12)',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Eye className="w-2.5 h-2.5 text-sky-400/50" />
                      <span className="text-[0.4375rem] text-sky-400/45 uppercase tracking-wider font-medium">Preflight</span>
                    </div>
                    <div className="text-sm font-display font-semibold text-sky-200/80 tabular-nums leading-tight">
                      {preflightCount}
                    </div>
                  </motion.div>
                  )}

                  {/* Simulations (hidden for progression — no PoB) */}
                  {!isProgressionMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.11, duration: 0.3, ease: 'easeOut' }}
                    className="relative flex-1 rounded-lg px-2 py-1.5 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, transparent 100%)',
                      border: '1px solid rgba(251, 191, 36, 0.12)',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <FlaskConical className="w-2.5 h-2.5 text-amber-400/50" />
                      <span className="text-[0.4375rem] text-amber-400/45 uppercase tracking-wider font-medium">Sims</span>
                    </div>
                    <div className="text-sm font-display font-semibold text-amber-200/80 tabular-nums leading-tight">
                      {simCount}
                    </div>
                  </motion.div>
                  )}

                  {/* Elapsed — also shows live ETA subtitle during analysis */}
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14, duration: 0.3, ease: 'easeOut' }}
                    className="relative flex-1 rounded-lg px-2 py-1.5 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.05) 0%, transparent 100%)',
                      border: '1px solid rgba(167, 139, 250, 0.1)',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Timer className="w-2.5 h-2.5 text-violet-400/50" />
                      <span className="text-[0.4375rem] text-violet-400/40 uppercase tracking-wider font-medium">Elapsed</span>
                    </div>
                    <div className="text-sm font-display font-semibold text-violet-200/75 tabular-nums leading-tight">
                      {elapsedMs > 0 ? formatDuration(elapsedMs) : '\u2014'}
                    </div>
                    {showHud && !allDone && progress.etaLabel && (
                      <div
                        className="text-[0.5rem] font-mono tabular-nums leading-tight mt-0.5 truncate"
                        style={{ color: phaseAccent.solid, opacity: 0.55 }}
                      >
                        {progress.etaLabel}
                      </div>
                    )}
                  </motion.div>

                  {/* Compute — total PoB time across all containers */}
                  {totalDurationMs > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.17, duration: 0.3, ease: 'easeOut' }}
                      className="relative flex-1 rounded-lg px-2 py-1.5 overflow-hidden cursor-help"
                      style={{
                        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.06) 0%, transparent 100%)',
                        border: '1px solid rgba(52, 211, 153, 0.12)',
                      }}
                      title="Total PoB compute time across all 3 parallel instances"
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Zap className="w-2.5 h-2.5 text-emerald-400/50" />
                        <span className="text-[0.4375rem] text-emerald-400/45 uppercase tracking-wider font-medium">Compute</span>
                        <Info className="w-2.5 h-2.5 text-emerald-400/30 flex-shrink-0" />
                      </div>
                      <div className="text-sm font-display font-semibold text-emerald-200/80 tabular-nums leading-tight" style={{ textShadow: '0 0 8px rgba(52, 211, 153, 0.3)' }}>
                        {formatDuration(totalDurationMs)}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ── Preflight Section ─────────────────────────────────── */}
              {preflightTools.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 mb-2">
                    <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-sky-400/60 to-sky-600/30" />
                    <span className="text-[0.5625rem] font-display font-semibold text-sky-400/50 uppercase tracking-[0.15em]">
                      Preflight
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-700/40 to-transparent" />
                  </div>

                  <div className="relative">
                    {preflightTools.length > 8 && (
                      <div
                        className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none
                                   bg-gradient-to-b from-[rgba(8,5,15,0.98)] to-transparent"
                      />
                    )}
                    <div
                      ref={feedRef}
                      className="px-3 pb-2 space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-fantasy"
                    >
                      {visiblePreflightTools.map((tool) => (
                        <ActivityRow
                          key={tool.id}
                          tool={tool}
                          onClick={
                            hasViewableResult(tool)
                              ? () => setExpandedToolId(tool.id)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Analysis Section — appears when first agentic tool arrives ── */}
              <AnimatePresence>
                {(agenticTools.length > 0 || isThinking) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <div className="flex items-center gap-2 px-4 mb-2 mt-1">
                      <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-amber-400/60 to-amber-600/30" />
                      <span className="text-[0.5625rem] font-display font-semibold text-amber-400/50 uppercase tracking-[0.15em]">
                        Analysis
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-slate-700/40 to-transparent" />
                    </div>

                    <div className="relative">
                      {agenticTools.length > 8 && (
                        <div
                          className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none
                                     bg-gradient-to-b from-[rgba(8,5,15,0.98)] to-transparent"
                        />
                      )}
                      <div
                        ref={agenticFeedRef}
                        className="px-3 pb-2 space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-fantasy"
                      >
                        {visibleAgenticTools.map((tool) => (
                          <ActivityRow
                            key={tool.id}
                            tool={tool}
                            onClick={
                              hasViewableResult(tool)
                                ? () => setExpandedToolId(tool.id)
                                : undefined
                            }
                          />
                        ))}

                        {/* LLM thinking indicator — shown when analyzing but no tool running */}
                        <AnimatePresence>
                          {isThinking && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.25, ease: 'easeOut' }}
                              className="relative rounded-lg overflow-hidden"
                              style={{
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.03) 100%)',
                                border: '1px solid rgba(99, 102, 241, 0.12)',
                              }}
                            >
                              {/* Shimmer sweep */}
                              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    background: 'linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.06) 50%, transparent 100%)',
                                    animation: 'shimmer 2.5s linear infinite',
                                  }}
                                />
                              </div>

                              {/* Left accent bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[3px]"
                                style={{
                                  background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.6) 0%, rgba(139, 92, 246, 0.2) 100%)',
                                }}
                              />

                              <div className="relative flex items-center gap-2.5 px-3 pl-4 py-2">
                                {/* Brain icon with breathing glow */}
                                <motion.div
                                  className="relative flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
                                  animate={{
                                    boxShadow: [
                                      '0 0 6px rgba(99, 102, 241, 0.15), inset 0 0 4px rgba(99, 102, 241, 0.08)',
                                      '0 0 14px rgba(99, 102, 241, 0.35), inset 0 0 8px rgba(99, 102, 241, 0.18)',
                                      '0 0 6px rgba(99, 102, 241, 0.15), inset 0 0 4px rgba(99, 102, 241, 0.08)',
                                    ],
                                  }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                  style={{
                                    background: 'radial-gradient(circle at 40% 40%, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0.06) 60%, transparent 100%)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                  }}
                                >
                                  <Brain className="w-3 h-3 text-indigo-400/80" />
                                  {/* Floating ember dot */}
                                  <motion.div
                                    className="absolute -top-0.5 -right-0.5 w-1 h-1 rounded-full bg-indigo-400/50"
                                    animate={{ y: [0, -2, 0], opacity: [0.3, 0.7, 0.3] }}
                                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{ boxShadow: '0 0 4px rgba(99, 102, 241, 0.5)' }}
                                  />
                                </motion.div>

                                <div className="flex-1 min-w-0">
                                  <span
                                    className="block text-[0.6875rem] leading-tight font-medium text-indigo-300/70"
                                    style={{ textShadow: '0 0 8px rgba(99, 102, 241, 0.2)' }}
                                  >
                                    {totalTools === 0 ? 'Preparing analysis\u2026' : 'Thinking\u2026'}
                                  </span>
                                </div>

                                {/* Animated dots */}
                                <div className="flex items-center gap-[3px] flex-shrink-0">
                                  <motion.div
                                    className="w-[3px] h-[3px] rounded-full bg-indigo-400/60"
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                  />
                                  <motion.div
                                    className="w-[3px] h-[3px] rounded-full bg-indigo-400/50"
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                                  />
                                  <motion.div
                                    className="w-[3px] h-[3px] rounded-full bg-indigo-400/40"
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Running tool description strip */}
                      <AnimatePresence>
                        {runningTool?.description && !runningTool.preflight && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div
                              className="flex items-center gap-2 mx-3 mb-2 px-3 py-1.5 rounded-md"
                              style={{
                                background:
                                  'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, transparent 100%)',
                                border: '1px solid rgba(251, 191, 36, 0.1)',
                              }}
                            >
                              <Zap className="w-3 h-3 text-amber-400/50 flex-shrink-0" />
                              <span className="text-[0.625rem] text-amber-300/60 truncate">
                                {runningTool.description}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Footer ──────────────────────────────────────────────── */}
              <div
                className="px-4 py-2.5"
                style={{
                  borderTop: '1px solid rgba(71, 85, 105, 0.15)',
                  background: 'rgba(2, 6, 23, 0.4)',
                }}
              >
                <p className="text-[0.625rem] text-slate-400/70 leading-relaxed">
                  {isFollowUpVariant ? (
                    <span className="text-slate-500/60">Click a completed tool to inspect its raw results.</span>
                  ) : (
                    <>
                      Tools show <span className="text-sky-400/80 font-medium">intermediate exploration</span> — refer to the <span className="text-amber-400/90 font-medium">final written assessment</span> for actual recommendations.
                      <span className="block mt-0.5 text-slate-500/60">Click a completed tool to inspect its raw results.</span>
                    </>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================================
// Detail Body — renders the tool-specific result
// =============================================================================

function DetailBody({ tool }: { tool: ToolCallPart }) {
  const result = tool.result;

  if (!result || Object.keys(result).length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">No result data available.</p>
    );
  }

  const Renderer = TOOL_RENDERERS[tool.tool] ?? DefaultResult;
  return <Renderer data={result} />;
}
