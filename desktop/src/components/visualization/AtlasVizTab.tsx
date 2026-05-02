/**
 * AtlasVizTab Component
 *
 * Displays atlas passive tree summary in the right sidebar.
 * Follows the Onyx Gold design system — section-embossed headers,
 * card-forge bodies, font-display typography, matching TreeVizTab patterns.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  MapIcon, Key, Star, Compass, TreeDeciduous, Maximize2, ChevronDown,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';
import type { AtlasTreeSummary, AtlasNamedTree, AtlasCategoryStat } from '../../../../shared/types/atlas';
import { AtlasTreeFullscreenModal } from './atlas/AtlasTreeFullscreenModal';
import { useDesktopStore } from '../../store';

// ============================================================================
// Sub-components
// ============================================================================

function KeystoneCard({ name, stats }: { name: string; stats?: string[] }) {
  const card = (
    <div className={cn(
      'flex items-center gap-2.5 px-2 py-1.5 rounded-md group/ks',
      'hover:bg-amber-500/5 transition-colors duration-200',
    )}>
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
        'border border-amber-500/25 group-hover/ks:border-amber-400/50',
        'shadow-[0_0_8px_rgba(251,191,36,0.1)] group-hover/ks:shadow-[0_0_14px_rgba(251,191,36,0.25)]',
        'transition-all duration-200',
      )} style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)',
      }}>
        <Key className="w-3.5 h-3.5 text-amber-400/80" />
      </div>
      <span className="text-xs text-amber-200/90 font-medium truncate group-hover/ks:text-amber-100">{name}</span>
    </div>
  );

  if (!stats?.length) return card;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{card}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="left"
          sideOffset={8}
          className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
          collisionPadding={12}
        >
          <NodeTooltip name={name} stats={stats} variant="keystone" />
          <Tooltip.Arrow className="fill-[#0c0c0e]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NotablePill({ name, stats }: { name: string; stats?: string[] }) {
  const pill = (
    <span className={cn(
      'px-2 py-[3px] rounded text-[0.6875rem] font-medium',
      'text-amber-200/70 bg-amber-500/8 border border-amber-500/15',
      'hover:text-amber-200 hover:bg-amber-500/12 hover:border-amber-500/30',
      'transition-all duration-200 cursor-default',
    )}>
      {name}
    </span>
  );

  if (!stats?.length) return pill;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{pill}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={8}
          className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
          collisionPadding={12}
        >
          <NodeTooltip name={name} stats={stats} variant="notable" />
          <Tooltip.Arrow className="fill-[#0c0c0e]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NodeTooltip({ name, stats, variant }: { name: string; stats: string[]; variant: 'keystone' | 'notable' }) {
  const isKeystone = variant === 'keystone';
  return (
    <div
      className="card-forge-opaque rounded-lg p-3 max-w-[280px]"
      style={{
        border: `1px solid ${isKeystone ? 'rgba(251,191,36,0.25)' : 'rgba(100,116,139,0.3)'}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${isKeystone ? 'rgba(251,191,36,0.06)' : 'rgba(0,0,0,0.2)'}`,
      }}
    >
      <div className={cn(
        'text-[0.6875rem] font-display font-semibold mb-1.5 leading-snug',
        isKeystone ? 'text-amber-200' : 'text-slate-200',
      )} style={isKeystone ? { textShadow: '0 0 8px rgba(251,191,36,0.3)' } : undefined}>
        {name}
      </div>
      <div className="space-y-0.5">
        {stats.map((stat, i) => (
          <div key={i} className="text-[0.625rem] text-slate-400 leading-relaxed">
            {stat}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Expandable category section with stat lines */
function CategorySection({
  name,
  stats,
  nodeCount,
  defaultOpen = false,
}: {
  name: string;
  stats: AtlasCategoryStat[];
  nodeCount: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md',
          'hover:bg-slate-800/40 transition-colors duration-150',
          'group/cat',
        )}
      >
        <ChevronDown className={cn(
          'w-2.5 h-2.5 text-slate-600 transition-transform duration-200',
          !isOpen && '-rotate-90',
        )} />
        <span className="font-display uppercase tracking-wider text-[0.6875rem] text-amber-300/80 px-1.5 py-[2px] rounded-sm border border-amber-700/40 bg-slate-950/60 flex-1 truncate">
          {name}
        </span>
        <span className="text-[0.5625rem] text-slate-600 tabular-nums">{nodeCount}</span>
      </button>
      {isOpen && (
        <div className="ml-5 mr-1 mt-0.5 mb-1 space-y-0.5">
          {stats.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 px-2 py-0.5">
              <div className="text-[0.625rem] text-slate-400 leading-relaxed flex-1">
                {highlightNumbers(s.stat)}
              </div>
              {(s.isNotable || s.isKeystone) && (
                <span className={cn(
                  'shrink-0 w-1.5 h-1.5 rounded-full mt-1',
                  s.isKeystone ? 'bg-amber-400/60' : 'bg-sky-400/50',
                )} title={s.source} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Highlight numeric values in stat text (like poeplanner's colored numbers) */
function highlightNumbers(text: string): React.ReactNode {
  const parts = text.split(/(\+?\d+%?)/g);
  return parts.map((part, i) => {
    if (/^\+?\d+%?$/.test(part)) {
      return <span key={i} className="text-sky-300 font-medium">{part}</span>;
    }
    return part;
  });
}

// ============================================================================
// Main Component
// ============================================================================

interface AtlasVizTabProps {
  summary: AtlasTreeSummary;
  namedTrees?: AtlasNamedTree[];
  onSelectTree?: (tree: AtlasNamedTree) => void;
}

export function AtlasVizTab({ summary, namedTrees, onSelectTree }: AtlasVizTabProps) {
  const [selectedTreeName, setSelectedTreeName] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const atlasDiffNodes = useDesktopStore((s) => s.atlasDiffNodes);

  // Auto-open fullscreen when an AtlasPill is clicked
  useEffect(() => {
    const handler = () => setIsFullscreenOpen(true);
    window.addEventListener('open-atlas-fullscreen', handler);
    return () => window.removeEventListener('open-atlas-fullscreen', handler);
  }, []);

  const allocatedHashes = useMemo(
    () => summary.allocatedNodes.map((n) => n.id),
    [summary.allocatedNodes]
  );

  const sortedCategories = useMemo(() => {
    return Object.entries(summary.contentCategories)
      .sort(([, a], [, b]) => b - a);
  }, [summary.contentCategories]);

  const nodeStatsByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of summary.allocatedNodes) {
      if (node.stats.length > 0) {
        map.set(node.name, node.stats);
      }
    }
    return map;
  }, [summary.allocatedNodes]);

  const handleTreeSelect = (tree: AtlasNamedTree) => {
    setSelectedTreeName(tree.name);
    onSelectTree?.(tree);
  };

  return (
    <>
    <Tooltip.Provider delayDuration={200}>
    <div className="flex flex-col h-full">

      {/* ─── Hero Header ─── */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-display font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-sky-200 to-sky-400 leading-tight">
            Atlas Tree
          </h2>
          <button
            onClick={() => setIsFullscreenOpen(true)}
            className={cn(
              'flex-shrink-0 h-7 px-2.5 rounded-lg flex items-center gap-1.5',
              'bg-gradient-to-br from-sky-500/15 to-sky-600/5',
              'border border-sky-500/30 hover:border-sky-400/60',
              'text-sky-400/70 hover:text-sky-300',
              'shadow-[0_0_12px_rgba(56,189,248,0.08)] hover:shadow-[0_0_20px_rgba(56,189,248,0.25)]',
              'transition-all duration-300',
              'group'
            )}
            title="View full atlas tree"
          >
            <Maximize2 className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[0.625rem] font-display font-semibold tracking-wide uppercase">Show Tree</span>
          </button>
        </div>

        {/* Inline stat bar */}
        <div className="flex items-center gap-3 mt-2 px-1 text-[0.6875rem] tabular-nums">
          <span className="text-slate-500">
            <span className="text-sky-300 font-medium">{summary.allocatedPoints}</span> / {summary.totalPoints} pts
          </span>
          {summary.keystones.length > 0 && (
            <>
              <span className="w-px h-3 bg-slate-700/60" />
              <span className="text-slate-500">
                <span className="text-amber-400 font-medium">{summary.keystones.length}</span> keystone{summary.keystones.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
          <span className="w-px h-3 bg-slate-700/60" />
          <span className="text-slate-500">
            <span className="text-slate-300 font-medium">{summary.notables.length}</span> notable{summary.notables.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Points progress bar */}
        <div className="mt-2 px-1">
          <div className="h-1 rounded-full bg-slate-800/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${summary.totalPoints > 0 ? Math.min((summary.allocatedPoints / summary.totalPoints) * 100, 100) : 0}%`,
                background: 'linear-gradient(90deg, rgba(56,189,248,0.6) 0%, rgba(14,165,233,0.9) 100%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Named tree selector (if multiple trees) */}
      {namedTrees && namedTrees.length > 1 && (
        <div className="flex-shrink-0 mb-3">
          <div className="flex items-center gap-1.5 text-[0.625rem] text-slate-500 mb-1.5 px-1">
            <Compass className="w-3 h-3" />
            <span className="font-display uppercase tracking-widest">Saved Trees</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {namedTrees.map((tree) => (
              <button
                key={tree.name}
                onClick={() => handleTreeSelect(tree)}
                className={cn(
                  'px-2 py-1 rounded text-[0.6875rem] transition-all duration-200',
                  (selectedTreeName ?? namedTrees[0].name) === tree.name
                    ? 'bg-sky-900/50 text-sky-300 border border-sky-600/40'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:text-slate-200 hover:border-slate-600/50'
                )}
              >
                {tree.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Scrollable content ─── */}
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto scrollbar-fantasy pr-1">

        {/* ─── Keystones ─── */}
        {summary.keystones.length > 0 && (
          <div>
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2">
                <Key className="w-3 h-3 text-amber-400 icon-glow-gold" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/90">
                  Keystones
                </span>
                <span className="text-[0.625rem] text-slate-600">({summary.keystones.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none px-2 py-2.5">
              <div className="flex flex-col gap-1">
                {summary.keystones.map((name) => (
                  <KeystoneCard key={name} name={name} stats={nodeStatsByName.get(name)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Content Focus (expandable category stats) ─── */}
        {sortedCategories.length > 0 && (
          <div>
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2">
                <MapIcon className="w-3 h-3 text-sky-400" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-sky-400/80">
                  Content Focus
                </span>
                <span className="text-[0.625rem] text-slate-600">({sortedCategories.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
              <div className="flex flex-col">
                {sortedCategories.map(([name, count], idx) => (
                  <CategorySection
                    key={name}
                    name={name}
                    stats={summary.categoryStats?.[name] ?? []}
                    nodeCount={count}
                    defaultOpen={idx === 0}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Notables ─── */}
        {summary.notables.length > 0 && (
          <div>
            <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
              <div className="flex items-center gap-2">
                <Star className="w-3 h-3 text-amber-400/80" />
                <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80">
                  Notables
                </span>
                <span className="text-[0.625rem] text-slate-600">({summary.notables.length})</span>
              </div>
            </div>
            <div className="card-forge rounded-b rounded-t-none px-2 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {summary.notables.map((name) => (
                  <NotablePill key={name} name={name} stats={nodeStatsByName.get(name)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {summary.allocatedPoints === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <TreeDeciduous className="w-8 h-8 mb-2 text-slate-600" />
          <span className="text-sm font-display">No atlas points allocated</span>
        </div>
      )}
    </div>
    </Tooltip.Provider>

    {/* Atlas tree fullscreen modal */}
    <AtlasTreeFullscreenModal
      isOpen={isFullscreenOpen}
      onClose={() => setIsFullscreenOpen(false)}
      allocatedNodes={allocatedHashes}
      categoryStats={summary.categoryStats}
      contentCategories={summary.contentCategories}
      diffNodes={atlasDiffNodes}
    />
    </>
  );
}
