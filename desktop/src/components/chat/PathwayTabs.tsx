/**
 * PathwayTabs Component
 *
 * Tab bar for switching between analyzed pathways (Gear, Skills, Tree, Unified, Q&A).
 * Pill-style tabs with animated underline, matching the ladder benchmarks pattern.
 *
 * Pathway tab states:
 * - queued: Pathway confirmed but waiting for current analysis to finish (clock badge)
 * - analyzing/complete: Standard active states
 */

import { Shield, Gem, TreePine, MessageCircle, Loader2, XCircle, Clock, Compass } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AnalysisFocus } from '../../types/chat-modes';

export type PathwayTab = AnalysisFocus;

/** Status for each pathway during multi-pathway analysis */
export type PathwayStatus = 'idle' | 'analyzing' | 'complete' | 'error' | 'queued';

interface PathwayTabsProps {
  /** Which pathways were analyzed (determines which tabs to show) */
  analyzedPathways: PathwayTab[];
  /** Currently active tab */
  activeTab: PathwayTab;
  /** Callback when tab changes */
  onTabChange: (tab: PathwayTab) => void;
  /** Optional className for additional styling */
  className?: string;
  /** Per-pathway status for showing streaming badges */
  pathwayStatuses?: Partial<Record<PathwayTab, PathwayStatus>>;
}

interface TabConfig {
  id: PathwayTab;
  label: string;
  icon: React.ReactNode;
}

const CORE_TABS: TabConfig[] = [
  { id: 'qa', label: 'Q&A', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'unified', label: 'Unified', icon: <Compass className="w-4 h-4" /> },
  { id: 'gear', label: 'Gear', icon: <Shield className="w-4 h-4" /> },
  { id: 'skills', label: 'Skills', icon: <Gem className="w-4 h-4" /> },
  { id: 'tree', label: 'Tree', icon: <TreePine className="w-4 h-4" /> },
];

/** Status badge component for pathway tabs */
function StatusBadge({ status }: { status: PathwayStatus }) {
  if (status === 'idle' || status === 'complete') return null;

  if (status === 'analyzing') {
    return (
      <span className="ml-1 flex items-center text-amber-400">
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    );
  }

  if (status === 'queued') {
    return (
      <span className="ml-1 inline-flex items-center text-amber-500/60">
        <Clock className="w-3 h-3" />
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="ml-1 flex items-center text-red-400">
        <XCircle className="w-3 h-3" />
      </span>
    );
  }

  return null;
}

export function PathwayTabs({
  analyzedPathways,
  activeTab,
  onTabChange,
  className,
  pathwayStatuses,
}: PathwayTabsProps) {
  const visibleTabs = CORE_TABS.filter((tab) => {
    return analyzedPathways.includes(tab.id);
  });

  // Don't render if only one pathway
  if (visibleTabs.length <= 1) {
    return null;
  }

  return (
    <div className={cn('flex gap-1 px-4 py-2 border-b border-slate-700/50', className)}>
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const status = pathwayStatuses?.[tab.id] || 'idle';
        const isQueued = status === 'queued';

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-medium',
              'transition-all duration-200',
              // Queued pathway tab styling (waiting for current analysis to finish)
              isQueued && !isActive
                ? 'text-slate-400 ring-1 ring-amber-500/15'
                : undefined,
              // Standard active/inactive styling
              !(isQueued && !isActive) && isActive
                ? 'text-amber-200 bg-amber-500/10'
                : !(isQueued && !isActive) && !isActive
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                  : undefined,
              // Subtle analyzing ring for background tabs
              status === 'analyzing' && !isActive && 'ring-1 ring-amber-500/25',
            )}
          >
            <span className={cn(
              'transition-colors',
              isActive ? 'text-amber-400' : 'text-slate-600',
            )}>
              {tab.icon}
            </span>
            {tab.label}
            <StatusBadge status={status} />

            {/* Animated underline indicator */}
            {isActive && (
              <motion.div
                layoutId="pathway-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.5) 50%, transparent 100%)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PathwayTabs;
