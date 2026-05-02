/**
 * LevelingTreeModal — level-aware passive tree viewer for a build's leveling path.
 *
 * Wraps the existing `<TreeFullscreenModal>` from the analysis pathway without
 * modifying it. The trick is that `TreeFullscreenModal.allocatedNodes` is a
 * plain `number[]` — the Pixi canvas doesn't care whether those IDs came from
 * a real PoB build or from a synthetic slice of an ordered leveling plan.
 *
 * The user scrubs a level slider; we compute `allocatedCount` via the standard
 * PoE point math (level - 1 + 22 quest points, capped at 121) and feed the
 * first `allocatedCount` entries of `allocationOrder` as the allocated set.
 * The next 3–5 entries are listed in an HTML overlay as "upcoming picks" —
 * we deliberately do NOT render them on the Pixi canvas because the canvas
 * has no third node state (allocated vs not) and adding one would require
 * patches to `InteractiveTreeCanvas` that the `tree-visualization-patterns`
 * skill advises against.
 *
 * Upcoming node names + icons are looked up via the existing `useTreeData()`
 * hook — the same source `<InteractiveTreeCanvas>` uses internally. No new
 * backend route, no new service.
 *
 * @module desktop/src/components/build-library/LevelingTreeModal
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { InteractiveTreeCanvas } from '../visualization/tree/InteractiveTreeCanvas';
import { useTreeData, type TreeNode } from '../visualization/tree/hooks/useTreeData';
import { cn } from '../../lib/utils';

// =============================================================================
// PoE point math
// =============================================================================

/** Fixed number of passive points from quest rewards across the campaign. */
const QUEST_POINTS = 22;
/** Total passive-point cap (99 from L2→L100 + 22 from quests). */
const POINT_CAP = 121;

/**
 * Return how many total passives a character has available at the given level.
 * +1 per level from L2 onward, +22 fixed quest points, capped at 121.
 */
function pointsAvailableAtLevel(level: number): number {
  if (level < 2) return QUEST_POINTS;
  return Math.min(level - 1 + QUEST_POINTS, POINT_CAP);
}

// =============================================================================
// Props
// =============================================================================

export interface LevelingTreeModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the user presses ESC or clicks Close. */
  onClose: () => void;
  /** Ordered list of passive node IDs — the authored leveling plan. */
  allocationOrder: number[];
  /**
   * Optional per-step annotations keyed by index into `allocationOrder`.
   * Shown below the slider when the current index matches.
   */
  waypoints?: Record<number, string>;
  /** Ascendancy name — forwarded to the canvas for portrait rendering. */
  ascendancyName?: string;
  /** The character level this leveling plan targets (slider max). */
  levelTarget: number;
  /** Initial slider level. Default 40 — middle of the act range. */
  initialLevel?: number;
}

// =============================================================================
// Next-picks sidebar — HTML overlay, NOT drawn on the Pixi canvas
// =============================================================================

interface NextPicksSidebarProps {
  nextIds: number[];
  nodeMap: Map<number, TreeNode> | null;
}

function NextPicksSidebar({ nextIds, nodeMap }: NextPicksSidebarProps) {
  if (nextIds.length === 0) return null;

  return (
    <div
      className="absolute top-4 right-4 w-64 pointer-events-auto"
      style={{
        background: 'linear-gradient(160deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.88) 100%)',
        border: '1px solid rgba(167, 139, 250, 0.35)',
        borderRadius: '0.75rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 28px rgba(167,139,250,0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'rgba(167, 139, 250, 0.2)' }}
      >
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
        <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.15em] text-violet-200">
          Next Picks
        </span>
      </div>
      <ol className="p-2 space-y-1">
        {nextIds.map((id, idx) => {
          const node = nodeMap?.get(id);
          const label = node?.name ?? `Node ${id}`;
          const type = node?.type ?? 'normal';
          const typeColor =
            type === 'keystone'
              ? '#fbbf24'
              : type === 'notable'
                ? '#c4b5fd'
                : '#94a3b8';
          return (
            <li
              key={`${id}-${idx}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded"
              style={{
                background:
                  idx === 0
                    ? 'linear-gradient(90deg, rgba(167,139,250,0.14) 0%, rgba(167,139,250,0.02) 100%)'
                    : 'rgba(15,23,42,0.35)',
                border:
                  idx === 0
                    ? '1px solid rgba(167,139,250,0.4)'
                    : '1px solid rgba(71,85,105,0.25)',
              }}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[0.5625rem] font-mono font-semibold"
                style={{
                  background: idx === 0 ? 'rgba(167,139,250,0.3)' : 'rgba(71,85,105,0.3)',
                  color: idx === 0 ? '#f3e8ff' : '#cbd5e1',
                }}
              >
                {idx + 1}
              </span>
              <span
                className="text-[0.75rem] flex-1 min-w-0 truncate"
                style={{ color: typeColor }}
                title={label}
              >
                {label}
              </span>
              {type !== 'normal' && (
                <span
                  className="text-[0.5rem] uppercase tracking-wider font-display"
                  style={{ color: `${typeColor}aa` }}
                >
                  {type === 'keystone' ? 'key' : type.slice(0, 3)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

const HEADER_HEIGHT = 56;
const SLIDER_BAR_HEIGHT = 72;

export function LevelingTreeModal({
  isOpen,
  onClose,
  allocationOrder,
  waypoints,
  ascendancyName,
  levelTarget,
  initialLevel = 40,
}: LevelingTreeModalProps) {
  const [level, setLevel] = useState(Math.min(initialLevel, levelTarget));
  const { data: treeData } = useTreeData();

  // Viewport sizing — modal fills the screen minus the header and slider bar.
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height:
      typeof window !== 'undefined'
        ? window.innerHeight - HEADER_HEIGHT - SLIDER_BAR_HEIGHT
        : 1024,
  }));

  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - HEADER_HEIGHT - SLIDER_BAR_HEIGHT,
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // ESC to close.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Synthesize the allocated node set for the current slider position.
  const { allocatedNodes, nextIds, allocatedCount } = useMemo(() => {
    const available = pointsAvailableAtLevel(level);
    const count = Math.min(available, allocationOrder.length);
    return {
      allocatedCount: count,
      allocatedNodes: allocationOrder.slice(0, count),
      nextIds: allocationOrder.slice(count, count + 5),
    };
  }, [level, allocationOrder]);

  // Map node id → TreeNode for the next-picks sidebar.
  const nodeMap = useMemo(() => {
    if (!treeData) return null;
    const map = new Map<number, TreeNode>();
    for (const n of treeData.nodes) map.set(n.id, n);
    return map;
  }, [treeData]);

  // Active waypoint annotation — either at the current allocatedCount or the
  // highest waypoint index we've passed (last-passed takes precedence).
  const activeWaypoint = useMemo<string | null>(() => {
    if (!waypoints) return null;
    const keys = Object.keys(waypoints)
      .map((k) => Number(k))
      .filter((k) => !Number.isNaN(k))
      .sort((a, b) => a - b);
    let active: string | null = null;
    for (const k of keys) {
      if (k <= allocatedCount) active = waypoints[k];
      else break;
    }
    return active;
  }, [waypoints, allocatedCount]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={cn('fixed inset-0 z-[9999]', 'bg-black/95', 'flex flex-col')}
      role="dialog"
      aria-modal="true"
      aria-label="Leveling Passive Tree"
    >
      {/* Header */}
      <header
        className={cn(
          'flex items-center justify-between px-4 sm:px-6',
          'bg-slate-900/95 border-b border-slate-700/60',
        )}
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Leveling Tree</h2>
          {ascendancyName && (
            <span
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium',
                'bg-violet-500/15 text-violet-300',
                'border border-violet-500/30',
              )}
            >
              {ascendancyName}
            </span>
          )}
          <span className="text-[0.6875rem] text-slate-500 font-display uppercase tracking-widest">
            Drag the slider to see the path
          </span>
        </div>
        <button
          onClick={onClose}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-md',
            'text-slate-400 hover:text-slate-100',
            'bg-slate-800/60 border border-slate-700/50',
            'hover:bg-slate-700/60 hover:border-slate-500',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
          )}
          title="Close (ESC)"
          aria-label="Close leveling tree view"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Slider bar */}
      <div
        className="flex items-center gap-5 px-6 border-b border-slate-800/60"
        style={{
          height: SLIDER_BAR_HEIGHT,
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.92) 100%)',
        }}
      >
        <div className="flex flex-col items-start min-w-[120px]">
          <span className="text-[0.5625rem] font-display uppercase tracking-[0.15em] text-violet-300/80">
            Character Level
          </span>
          <span className="text-xl font-mono font-bold text-slate-100 tabular-nums">
            L{level}
          </span>
        </div>
        <input
          type="range"
          min={2}
          max={levelTarget}
          step={1}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="flex-1 accent-violet-400 h-1.5 cursor-pointer"
          style={{ maxWidth: 640 }}
        />
        <div className="flex flex-col items-end min-w-[160px]">
          <span className="text-[0.5625rem] font-display uppercase tracking-[0.15em] text-slate-500">
            Points Allocated
          </span>
          <span className="text-sm font-mono font-semibold text-slate-200 tabular-nums">
            {allocatedCount} <span className="text-slate-500">/ {allocationOrder.length}</span>
          </span>
        </div>
        {activeWaypoint && (
          <div
            className="hidden xl:flex items-center gap-2 pl-5 ml-2 border-l border-slate-800/70 flex-1 min-w-0"
            title={activeWaypoint}
          >
            <ChevronRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[0.75rem] text-amber-200/90 truncate">{activeWaypoint}</span>
          </div>
        )}
      </div>

      {/* Main: canvas + next-picks overlay */}
      <main className="relative flex-1 overflow-hidden">
        <InteractiveTreeCanvas
          width={dimensions.width}
          height={dimensions.height}
          allocatedNodes={allocatedNodes}
          ascendancyName={ascendancyName}
          showControls={true}
          controlsPosition="bottom-right"
        />
        <NextPicksSidebar nextIds={nextIds} nodeMap={nodeMap} />
      </main>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default LevelingTreeModal;
