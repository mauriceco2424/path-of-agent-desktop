/**
 * AnalysisHistoryPanel
 *
 * Shows past analysis sessions on the import page. Displays the last 3 by default,
 * with an expandable section to view all. Clicking a snapshot re-imports the build
 * and navigates to the analysis results.
 *
 * Design: Ledger-inspired dark forge aesthetic — status-differentiated cards with
 * pathway glow accents, gradient surfaces, animated progress bars, and Cinzel headers.
 * Matches the Oracle's Ledger panel styling.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Gem,
  Shield,
  TreePine,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Import,
  Coins,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAnalysisHistoryStore, type AnalysisSnapshot, type SnapshotStatus } from '../store/analysisHistoryStore';
import { useDesktopStore } from '../store';
import { useTokenStore } from '../store/tokenSlice';
import { importBuild } from '../services/tauri-api';
import { CREDIT_COST_USD } from '../../../shared/types/Credits';

// ============================================
// Constants
// ============================================

const COLLAPSED_COUNT = 3;

const PATHWAY_ICONS: Record<string, typeof Gem> = {
  skills: Gem,
  gear: Shield,
  tree: TreePine,
};

const PATHWAY_COLORS: Record<string, { text: string; glow: string; bg: string }> = {
  skills: {
    text: 'text-cyan-400',
    glow: 'rgba(103, 232, 249, 0.38)',
    bg: 'rgba(103, 232, 249, 0.08)',
  },
  gear: {
    text: 'text-amber-400',
    glow: 'rgba(251, 191, 36, 0.38)',
    bg: 'rgba(251, 191, 36, 0.08)',
  },
  tree: {
    text: 'text-emerald-400',
    glow: 'rgba(52, 211, 153, 0.38)',
    bg: 'rgba(52, 211, 153, 0.08)',
  },
};

/** Status configuration — drives card accent, icon, and label */
const STATUS_CONFIG: Record<SnapshotStatus, {
  label: string;
  icon: typeof CheckCircle2;
  accentColor: string;
  borderColor: string;
  glowColor: string;
  bgGradient: string;
}> = {
  complete: {
    label: 'Analyzed',
    icon: CheckCircle2,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    glowColor: 'rgba(52, 211, 153, 0.06)',
    bgGradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.04) 0%, transparent 60%)',
  },
  partial: {
    label: 'Interrupted',
    icon: AlertCircle,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    glowColor: 'rgba(251, 191, 36, 0.06)',
    bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, transparent 60%)',
  },
  interrupted: {
    label: 'Interrupted',
    icon: AlertCircle,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    glowColor: 'rgba(251, 191, 36, 0.06)',
    bgGradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, transparent 60%)',
  },
  streaming: {
    label: 'In Progress',
    icon: Loader2,
    accentColor: 'text-violet-400',
    borderColor: 'border-violet-500/20',
    glowColor: 'rgba(167, 139, 250, 0.06)',
    bgGradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.04) 0%, transparent 60%)',
  },
  imported: {
    label: 'Imported',
    icon: Import,
    accentColor: 'text-slate-400',
    borderColor: 'border-slate-600/30',
    glowColor: 'rgba(148, 163, 184, 0.04)',
    bgGradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.02) 0%, transparent 60%)',
  },
};

// ============================================
// Helpers
// ============================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRatingColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  if (score >= 4) return 'text-orange-400';
  return 'text-red-400';
}

function getRatingBarColor(score: number): string {
  if (score >= 8) return 'from-emerald-500 to-emerald-400';
  if (score >= 6) return 'from-amber-500 to-amber-400';
  if (score >= 4) return 'from-orange-500 to-orange-400';
  return 'from-red-500 to-red-400';
}

// ============================================
// Snapshot Card
// ============================================

interface SnapshotCardProps {
  snapshot: AnalysisSnapshot;
  onSelect: (snapshot: AnalysisSnapshot) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  index: number;
}

function SnapshotCard({ snapshot, onSelect, onDelete, isLoading, index }: SnapshotCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const pathwayFocuses = snapshot.focus.filter(
    (f): f is 'skills' | 'gear' | 'tree' =>
      f === 'skills' || f === 'gear' || f === 'tree'
  );

  const config = STATUS_CONFIG[snapshot.status] || STATUS_CONFIG.imported;
  const StatusIcon = config.icon;
  const overallScore = snapshot.buildRatings?.overall?.score;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04, duration: 0.3 } }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      onClick={() => onSelect(snapshot)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isLoading}
      className={cn(
        'group relative w-full text-left rounded-lg overflow-hidden',
        'border transition-all duration-250',
        config.borderColor,
        'hover:border-slate-500/40',
        'disabled:opacity-50 disabled:cursor-wait',
      )}
      style={{ background: config.bgGradient }}
    >
      {/* Left accent edge */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-[2px]')}
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${config.glowColor.replace(/[\d.]+\)$/, '0.5)')} 30%, ${config.glowColor.replace(/[\d.]+\)$/, '0.5)')} 70%, transparent 100%)`,
        }}
      />

      <div className="p-3 pl-3.5">
        {/* Top row: Status badge + timestamp + delete */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={cn('w-3 h-3', config.accentColor, snapshot.status === 'streaming' && 'animate-spin')} />
            <span className={cn('text-[0.5625rem] font-medium uppercase tracking-wider', config.accentColor)}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.5625rem] text-slate-600 tabular-nums flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatRelativeTime(snapshot.timestamp)}
            </span>
            <AnimatePresence>
              {isHovered && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(snapshot.id);
                  }}
                  className="p-0.5 rounded hover:bg-red-500/15 text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Build identity row */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-display font-semibold text-slate-200 truncate tracking-wide">
              {snapshot.build.ascendancy}
            </span>
            <span className="text-[0.625rem] text-slate-500 tabular-nums">
              Lv{snapshot.build.level}
            </span>
          </div>

          {/* Overall rating badge (analyzed sessions only) */}
          {overallScore != null && (
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-semibold tabular-nums', getRatingColor(overallScore))}>
                {overallScore.toFixed(1)}
              </span>
              <div className="w-8 h-1 rounded-full bg-slate-800/80 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full bg-gradient-to-r', getRatingBarColor(overallScore))}
                  initial={{ width: 0 }}
                  animate={{ width: `${(overallScore / 10) * 100}%` }}
                  transition={{ delay: 0.2 + index * 0.05, duration: 0.4 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Character name */}
        {snapshot.build.characterName && (
          <div className="text-[0.5625rem] text-slate-500 truncate mb-1 -mt-0.5">
            {snapshot.build.characterName}
          </div>
        )}

        {/* Pathway chips / imported state */}
        {snapshot.status === 'imported' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[0.5625rem] text-slate-500 italic">
              Not yet analyzed
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {pathwayFocuses.map((focus) => {
              const Icon = PATHWAY_ICONS[focus];
              const colors = PATHWAY_COLORS[focus];
              const isCompleted = snapshot.completedPathways.includes(focus);
              const label = focus;
              return (
                <div
                  key={focus}
                  className={cn(
                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded',
                    'text-[0.5625rem] font-medium tracking-wide',
                    'transition-colors duration-200',
                    isCompleted
                      ? colors.text
                      : 'text-slate-600',
                  )}
                  style={isCompleted ? {
                    background: colors.bg,
                    boxShadow: `inset 0 0 8px ${colors.bg}`,
                  } : undefined}
                  title={`${label}${isCompleted ? '' : ' (incomplete)'}`}
                >
                  <Icon className="w-2.5 h-2.5" />
                  <span className="capitalize">{label}</span>
                </div>
              );
            })}

            {snapshot.isPartial && pathwayFocuses.length > 0 && (
              <span className="text-[0.5625rem] text-amber-500/60 ml-auto font-medium italic">
                Partial
              </span>
            )}
          </div>
        )}

        {/* Session cost (credit/token spend) */}
        {snapshot.tokenTotals && snapshot.tokenTotals.costUsd > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Coins className="w-2.5 h-2.5 text-amber-500/50" />
            <span className="text-[0.5625rem] text-amber-400/60 tabular-nums">
              {Math.ceil(snapshot.tokenTotals.costUsd / CREDIT_COST_USD)} credits
            </span>
            <span className="text-[0.5625rem] text-slate-600 tabular-nums">
              (${snapshot.tokenTotals.costUsd.toFixed(3)})
            </span>
          </div>
        )}

        {/* Custom prompt preview */}
        {snapshot.customPrompt && (
          <p className="text-[0.5625rem] text-slate-500/70 mt-1.5 truncate italic leading-snug">
            &ldquo;{snapshot.customPrompt}&rdquo;
          </p>
        )}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-950/70 backdrop-blur-[2px]"
        >
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        </motion.div>
      )}
    </motion.button>
  );
}

// ============================================
// Storage Indicator
// ============================================

function StorageIndicator({ usedBytes, budgetBytes }: { usedBytes: number; budgetBytes: number }) {
  const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
  const budgetMB = (budgetBytes / (1024 * 1024)).toFixed(0);
  const pct = Math.min(100, (usedBytes / budgetBytes) * 100);

  const barColor = pct > 95
    ? 'from-red-500/70 to-red-400/50'
    : pct > 80
      ? 'from-amber-500/60 to-amber-400/40'
      : 'from-slate-500/30 to-slate-400/20';

  return (
    <div className="mb-3 px-0.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[0.5625rem] text-slate-600 tabular-nums">
          {usedMB} / {budgetMB} MB
        </span>
        {pct > 80 && (
          <span className={cn(
            'text-[0.5625rem] font-medium',
            pct > 95 ? 'text-red-400/80' : 'text-amber-500/70',
          )}>
            {pct > 95 ? 'Almost full — delete old sessions' : 'Getting full'}
          </span>
        )}
      </div>
      <div className="h-[3px] bg-slate-800/60 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ============================================
// Main Panel
// ============================================

export function AnalysisHistoryPanel() {
  const navigate = useNavigate();
  const snapshots = useAnalysisHistoryStore((s) => s.snapshots);
  const loaded = useAnalysisHistoryStore((s) => s._loaded);
  const deleteSnapshot = useAnalysisHistoryStore((s) => s.deleteSnapshot);
  const setBuild = useDesktopStore((s) => s.setBuild);

  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearAll = useAnalysisHistoryStore((s) => s.clearAll);

  const handleClearAll = useCallback(() => {
    clearAll();
    setShowClearConfirm(false);
    setIsExpanded(false);
    toast.success('All sessions cleared');
  }, [clearAll]);

  const visibleSnapshots = isExpanded ? snapshots : snapshots.slice(0, COLLAPSED_COUNT);
  const hasMore = snapshots.length > COLLAPSED_COUNT;

  const storageStats = useMemo(
    () => useAnalysisHistoryStore.getState().getStorageStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshots],
  );

  const handleSelect = async (snapshot: AnalysisSnapshot) => {
    if (!snapshot.build.pobCode) {
      toast.error('No build code saved — cannot restore this session');
      return;
    }

    const isAnalyzed = snapshot.status !== 'imported';

    // For analyzed sessions: navigate instantly with cached data, reimport PoB in background.
    // For import-only sessions: must await import before navigating (no cached data to show).
    if (isAnalyzed) {
      // 1. Set currentBuild directly (NOT via setBuild which clears vizData/ratings).
      //    restoreSession below will populate all analysis state atomically.
      const placeholderBuildId = `restoring-${Date.now()}`;
      useDesktopStore.setState({
        currentBuild: {
          buildId: placeholderBuildId,
          class: snapshot.build.class,
          ascendancy: snapshot.build.ascendancy,
          level: snapshot.build.level,
          importedAt: new Date().toISOString(),
          pobCode: snapshot.build.pobCode,
        },
      });

      // 2. Restore full analysis state (vizData, pathways, ratings, etc.)
      useAnalysisHistoryStore.getState().setActiveSnapshotId(snapshot.id);
      const restoreSession = useDesktopStore.getState().restoreSession;
      restoreSession({
        focus: snapshot.focus,
        customPrompt: snapshot.customPrompt,
        label: snapshot.label,
        pathwayContent: snapshot.pathwayContent,
        completedPathways: snapshot.completedPathways,
        parts: snapshot.parts,
        pathwayHistories: snapshot.pathwayHistories,
        vizData: snapshot.vizData,
        pathwayCards: snapshot.pathwayCards,
        generalAssessment: snapshot.generalAssessment,
        buildRatings: snapshot.buildRatings,
        gearSlotRatings: snapshot.gearSlotRatings,
        seerContext: snapshot.seerContext,
        topActions: snapshot.topActions,
        pathwayPriorityOrder: snapshot.pathwayPriorityOrder,
        suggestedQuestions: snapshot.suggestedQuestions,
        treeSimulationResults: snapshot.treeSimulationResults,
        treeDiffNodes: snapshot.treeDiffNodes,
        tokenEntries: snapshot.tokenEntries,
        tokenTotals: snapshot.tokenTotals,
        creditsUsed: snapshot.creditsUsed,
      });

      // 3. Navigate immediately — user sees cached results
      navigate('/chat');

      // 4. Re-import into PoB in the background (needed for follow-up chat tools)
      useDesktopStore.getState().setIsPobReimporting(true);
      importBuild(snapshot.build.pobCode!)
        .then((result) => {
          // Patch buildId to the real one from PoB (without full setBuild reset)
          useDesktopStore.setState((s) => ({
            currentBuild: s.currentBuild
              ? { ...s.currentBuild, buildId: result.buildId }
              : s.currentBuild,
            isPobReimporting: false,
          }));
        })
        .catch((err) => {
          console.error('[AnalysisHistory] Background reimport failed:', err);
          useDesktopStore.setState({ isPobReimporting: false });
          toast.error('Build reload failed — follow-up chat may not work');
        });
    } else if (snapshot.vizData) {
      // Import-only session WITH cached vizData: restore like an analyzed session
      // so we skip the visualization pipeline (no config micro-agent call).
      // Restore token ledger from snapshot (config micro-agent usage from original import).
      // Clear first, then restore if snapshot has entries.
      useTokenStore.getState().clearSession();
      if (snapshot.tokenEntries && snapshot.tokenEntries.length > 0) {
        useTokenStore.setState({
          entries: snapshot.tokenEntries,
          totals: snapshot.tokenTotals ?? { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, costUsd: 0, savingsUsd: 0 },
          creditsUsedSession: snapshot.creditsUsed ?? 0,
        });
      }
      const placeholderBuildId = `restoring-${Date.now()}`;
      useDesktopStore.setState({
        currentBuild: {
          buildId: placeholderBuildId,
          class: snapshot.build.class,
          ascendancy: snapshot.build.ascendancy,
          level: snapshot.build.level,
          importedAt: new Date().toISOString(),
          pobCode: snapshot.build.pobCode,
        },
      });

      // Restore vizData (the only enriched data an import-only session has)
      // but land on analyze-config so the user can configure their analysis.
      useDesktopStore.setState({
        vizData: snapshot.vizData,
        activeUIMode: 'analyze-config',
      });

      useAnalysisHistoryStore.getState().setActiveSnapshotId(snapshot.id);
      navigate('/chat');

      // Background reimport for follow-up tools
      useDesktopStore.getState().setIsPobReimporting(true);
      importBuild(snapshot.build.pobCode!)
        .then((result) => {
          useDesktopStore.setState((s) => ({
            currentBuild: s.currentBuild
              ? { ...s.currentBuild, buildId: result.buildId }
              : s.currentBuild,
            isPobReimporting: false,
          }));
        })
        .catch((err) => {
          console.error('[AnalysisHistory] Background reimport failed:', err);
          useDesktopStore.setState({ isPobReimporting: false });
          toast.error('Build reload failed — follow-up chat may not work');
        });
    } else {
      // Import-only session WITHOUT cached vizData (old snapshot): must await full import
      setLoadingId(snapshot.id);
      try {
        const result = await importBuild(snapshot.build.pobCode);
        setBuild({
          buildId: result.buildId,
          class: result.class,
          ascendancy: result.ascendancy,
          level: result.level,
          importedAt: new Date().toISOString(),
          pobCode: snapshot.build.pobCode,
        });
        useAnalysisHistoryStore.getState().setActiveSnapshotId(snapshot.id);
        toast.success('Build restored — configure your analysis');
        navigate('/chat');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import build';
        toast.error(message);
      } finally {
        setLoadingId(null);
      }
    }
  };

  const activeSnapshotId = useAnalysisHistoryStore((s) => s.activeSnapshotId);

  const handleDelete = (id: string) => {
    // Only block deletion if the snapshot is actively streaming right now.
    // Interrupted/completed snapshots should always be deletable.
    if (id === activeSnapshotId) {
      const snap = snapshots.find(s => s.id === id);
      if (snap?.status === 'streaming') {
        toast.error('Cannot delete an analysis that is still in progress');
        return;
      }
      // Clear the active pointer since we're about to delete this snapshot
      useAnalysisHistoryStore.getState().setActiveSnapshotId(null);
    }
    deleteSnapshot(id);
    toast.success('Session removed from history');
  };

  // Don't render until sessions are loaded from disk (prevents flash of empty state)
  if (!loaded) return null;

  return (
    <div className="w-full">
      {/* Section Header — Ledger-style embossed header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-amber-500/60" />
          <span className="text-[0.625rem] font-display font-medium uppercase tracking-[0.15em] text-amber-400/70">
            Recent Sessions
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 via-slate-700/30 to-transparent" />
        <span className="text-[0.625rem] text-slate-500 tabular-nums font-medium">
          {snapshots.length}
        </span>
        {snapshots.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="ml-1 p-0.5 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
            title="Clear all sessions"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Clear All Confirmation */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-3 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
              <p className="text-[0.6875rem] text-slate-300 mb-2">
                Delete all {snapshots.length} sessions? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-1 rounded text-[0.625rem] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 rounded text-[0.625rem] font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage usage */}
      {snapshots.length > 0 && (
        <StorageIndicator usedBytes={storageStats.usedBytes} budgetBytes={storageStats.budgetBytes} />
      )}

      {/* Snapshot List or Empty State */}
      {snapshots.length === 0 ? (
        <div
          className="text-center py-8 px-4 rounded-xl border border-slate-800/40"
          style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%)' }}
        >
          <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center bg-slate-800/40">
            <History className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            No builds yet. Import a build to see your history here.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {visibleSnapshots.map((snapshot, i) => (
              <SnapshotCard
                key={snapshot.id}
                snapshot={snapshot}
                onSelect={handleSelect}
                onDelete={handleDelete}
                isLoading={loadingId === snapshot.id}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Expand/Collapse toggle */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-full mt-2 py-1.5 flex items-center justify-center gap-1',
            'text-[0.625rem] text-slate-500 hover:text-amber-400/80',
            'rounded-md hover:bg-amber-500/5',
            'transition-colors duration-200',
            'font-medium tracking-wide',
          )}
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              {snapshots.length - COLLAPSED_COUNT} more <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
