/**
 * AnalyzeMode Component
 *
 * Configuration and display interface for AI build analysis.
 * Analysis is OPT-IN - users configure their preferences and explicitly trigger analysis.
 *
 * Design: Dark fantasy aesthetic matching HomeMode cards with forge styling,
 * corner accents, and pathway-specific glow effects.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Gem,
  TreePine,
  Swords,
  Shield,
  Scale,
  Loader2,
  ArrowRight,
  Eye,
  Trophy,
  Coins,
  Download,
  Info,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SemanticMarkdown } from '../../../utils/semantic-markdown';
import { InlineChatInput } from '../InlineChatInput';
import { getActiveTabContent } from '../../../utils/analysis-section-parser';
import { ToolStepCard } from '../ToolStepCard';
import { ToolActivitySummary } from '../ToolActivitySummary';
import { LadderDataSection } from '../LadderDataSection';
import { LiveTradeSearchCard } from '../LiveTradeSearchCard';
import type { LiveTradeSearchState } from '../../../hooks/useDesktopChat';

import type { UseLadderDataResult } from '../../../hooks/useLadderData';
import { useUpdateAvailability } from '../../../hooks/useAutoUpdate';
import { useDesktopStore } from '../../../store';
import { useSettingsStore } from '../../../store/settingsSlice';
import { useTokenStore } from '../../../store/tokenSlice';
import { BuildLoadingSteps } from '../../visualization/BuildLoadingSteps';
import { NeonProgressBar } from '../../ui/NeonProgressBar';
import type { MessagePart, OptimizationFocus } from '../../../../../shared/types/Chat';
import type { ChatMessage } from '../../../store';
import type { AuthAccountState } from '../../../hooks/useAuthAccount';
import { MIN_CREDITS_PER_PATHWAY, MIN_CREDITS_FOLLOW_UP, estimateAnalysisCost } from '../../../../../shared/types/Credits';
import { AnalysisConfirmDialog, isAnalysisConfirmDismissed } from './AnalysisConfirmDialog';
import { FollowUpConfirmDialog, isFollowUpConfirmDismissed } from './FollowUpConfirmDialog';
import type { AnalysisFocus, AnalysisConfig } from '../../../types/chat-modes';
import type { BanditChoice, MajorGod, MinorGod } from '../CompactStatsSidebar';
import { FEATURE_FLAGS } from '../../../feature-flags';

// =============================================================================
// Types
// =============================================================================

// Re-export for consumers that import from here
export type { AnalysisConfig };

/** Focus area type (config selection) */
export type FocusArea = 'unified' | 'qa' | 'progression';

export interface AnalyzeModeProps {
  /** Current build ID */
  buildId: string;
  /** Analysis configuration */
  config: AnalysisConfig;
  /** Callback when config changes */
  onConfigChange: (config: Partial<AnalysisConfig>) => void;
  /** Whether analysis is in progress */
  isAnalyzing: boolean;
  /** Whether any pathway analysis is still running */
  isAnyAnalysisRunning?: boolean;
  /** Completed analysis content */
  analysisContent: string;
  /** Real-time streaming content (shows during analysis) */
  streamingContent?: string;
  /** Callback to start analysis */
  onStartAnalysis: () => void;
  /** Callback to return to configuration view */
  /** Mode: 'config' for configuration view, 'results' for results view */
  mode: 'config' | 'results';
  /** Build name for welcome header */
  buildName?: string;
  /** Ascendancy for welcome header */
  ascendancy?: string;
  /** Character level for welcome header */
  level?: number;
  /** Main skill for welcome header */
  mainSkill?: string;
  /** Currently active pathway tab (for multi-pathway analysis) */
  activePathwayTab?: AnalysisFocus;
  /** Callback when pathway tab changes */
  onPathwayTabChange?: (tab: AnalysisFocus) => void;
  /** Whether there are existing analysis results to view */
  hasExistingResults?: boolean;
  /** Callback to view existing results without re-running analysis */
  onViewResults?: () => void;
  // Inline chat props (for asking follow-up questions within the analysis view)
  /** Callback when user sends a chat message */
  onSendChatMessage?: (message: string) => void;
  /** Whether a chat message is being sent */
  isChatLoading?: boolean;
  /** Suggested follow-up questions */
  suggestedQuestions?: string[];
  /** Message parts for streaming display (reasoning, tool calls) */
  messageParts?: MessagePart[];
  /** Full chat message history for follow-up conversations */
  chatMessages?: ChatMessage[];
  /** Whether visualization data is still loading (for initial render gate) */
  isVizLoading?: boolean;
  /** Auth and credit state for gating analysis */
  authState?: AuthAccountState;
  /** Error code from last SSE error (e.g. 'INSUFFICIENT_CREDITS') */
  errorCode?: string | null;
  /** Pathways that have already been analyzed (for graying out in config) */
  completedPathways?: string[];
  /** Ladder data hook result — lifted to ChatPage so fetch starts during viz loading */
  ladder: UseLadderDataResult;
  /** Current bandit quest selection */
  bandit?: BanditChoice;
  /** Callback when bandit selection changes */
  onBanditChange?: (b: BanditChoice) => void;
  /** Whether a bandit change API call is in progress */
  isBanditLoading?: boolean;
  /** Current pantheon major god selection */
  pantheonMajor?: MajorGod;
  /** Current pantheon minor god selection */
  pantheonMinor?: MinorGod;
  /** Callback when pantheon selection changes */
  onPantheonChange?: (major?: MajorGod, minor?: MinorGod) => void;
  /** Whether a pantheon change API call is in progress */
  isPantheonLoading?: boolean;
  /** Real-time status message from backend (replaces generic "Thinking..." text) */
  streamingStatus?: string | null;
  /** Live trade search state — shown inline in follow-up chat while a search_trade tool runs */
  liveTradeSearch?: LiveTradeSearchState | null;
  /** Callback to queue pathways for later start (when analysis is already running) */
  onQueuePathways?: (pathways: AnalysisFocus[]) => void;
}

// =============================================================================
// Animation Variants (matching HomeMode)
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: 'easeOut',
    },
  },
};

function formatUpdateBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ANALYSIS_RAIL_CLASS = 'w-full max-w-[1080px] mx-auto';
const DEPTH_GRID_CLASS =
  'grid grid-cols-3 gap-2';

// =============================================================================
// Configuration
// =============================================================================

// =============================================================================
// Sub-Components
// =============================================================================

// =============================================================================
// OptimizationFocusSelector Sub-Component
// =============================================================================

const PRIORITY_OPTIONS: { id: OptimizationFocus; label: string; description: string; icon: typeof Shield }[] = [
  { id: 'defensive', label: 'Defensive', description: 'Prioritize survivability', icon: Shield },
  { id: 'balanced', label: 'Balanced', description: 'Equal offense & defense', icon: Scale },
  { id: 'offensive', label: 'Offensive', description: 'Prioritize damage output', icon: Swords },
];

function OptimizationFocusSelector() {
  const optimizationFocus = useDesktopStore((s) => s.optimizationFocus);
  const setOptimizationFocus = useDesktopStore((s) => s.setOptimizationFocus);

  return (
    <div className="space-y-3">
      <motion.label
        variants={itemVariants}
        className="block text-xs font-display font-semibold text-slate-400 uppercase tracking-wider"
      >
        Optimization Priority
      </motion.label>

      <motion.div variants={itemVariants} className={DEPTH_GRID_CLASS}>
        {PRIORITY_OPTIONS.map((option) => {
          const isSelected = optimizationFocus === option.id;
          const Icon = option.icon;

          return (
            <motion.button
              key={option.id}
              onClick={() => setOptimizationFocus(option.id)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'w-full relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg',
                'card-forge transition-all duration-300',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
                isSelected && 'ring-1 ring-amber-500/40',
              )}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `
                  0 4px 16px rgba(0, 0, 0, 0.4),
                  0 0 20px rgba(251, 191, 36, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.05)
                `;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '';
              }}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-amber-700/50 bg-gradient-to-br from-slate-900/80 to-black/80 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
                <Icon
                  className={cn(
                    'w-3.5 h-3.5 transition-colors duration-200',
                    isSelected
                      ? 'text-amber-300'
                      : 'text-amber-400/60 group-hover:text-amber-300',
                  )}
                />
              </span>
              <span
                className={cn(
                  'text-xs font-display font-medium transition-colors duration-200',
                  isSelected ? 'text-amber-300' : 'text-slate-400',
                )}
              >
                {option.label}
              </span>
              <span className="text-[0.625rem] text-slate-400">
                {option.description}
              </span>

              {isSelected && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.5) 50%, transparent 100%)',
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

// =============================================================================
// WelcomeHeader Sub-Component
// =============================================================================

interface WelcomeHeaderProps {
  buildName?: string;
  ascendancy?: string;
  level?: number;
  mainSkill?: string;
  /** Optional subtitle text below build info */
  subtitle?: string;
}

const headerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

function WelcomeHeader({
  buildName,
  ascendancy,
  level,
  mainSkill,
  subtitle,
}: WelcomeHeaderProps) {
  return (
    <motion.div variants={headerVariants} className="text-center mb-6 relative">
      {/* Decorative frame above title */}
      <div className="divider-ornate w-48 mx-auto mb-4" />

      {/* Welcome text with Cinzel font */}
      <h1 className="font-display text-2xl font-semibold text-slate-100 mb-3 tracking-wide text-glow-amber">
        Welcome back, Exile
      </h1>

      {/* Build summary with badges */}
      <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
        {ascendancy && (
          <span className="px-3 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
            {ascendancy}
          </span>
        )}
        {level && (
          <>
            {ascendancy && <span className="text-slate-600">|</span>}
            <span className="text-slate-400">
              Level <span className="text-slate-200 font-bold">{level}</span>
            </span>
          </>
        )}
        {mainSkill && (
          <>
            {(ascendancy || level) && <span className="text-slate-600">|</span>}
            <span className="text-slate-300">{mainSkill}</span>
          </>
        )}
      </div>

      {/* Build name (subtle) */}
      {buildName && (
        <p className="text-xs text-slate-400 mt-3 truncate max-w-md mx-auto">
          {buildName}
        </p>
      )}

      {/* Subtitle instruction text */}
      {subtitle && <p className="text-sm text-slate-400 mt-4">{subtitle}</p>}

      {/* Decorative divider below header */}
      <div className="divider-ornate w-48 mx-auto mt-4" />
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AnalyzeMode({
  buildId,
  config,
  onConfigChange,
  isAnalyzing,
  isAnyAnalysisRunning,
  analysisContent,
  streamingContent,
  onStartAnalysis,
  mode,
  buildName,
  ascendancy,
  level,
  mainSkill,
  activePathwayTab,
  onPathwayTabChange,
  hasExistingResults,
  onViewResults,
  // Inline chat props
  onSendChatMessage,
  isChatLoading,
  suggestedQuestions,
  // Streaming display props
  messageParts,
  // Follow-up chat history
  chatMessages,
  // Loading gate
  isVizLoading,
  // Auth & credit gating
  authState,
  errorCode,
  completedPathways: completedPathwaysProp,
  ladder,
  bandit,
  onBanditChange,
  isBanditLoading,
  pantheonMajor,
  pantheonMinor,
  onPantheonChange,
  isPantheonLoading,
  streamingStatus,
  liveTradeSearch,
  onQueuePathways,
}: AnalyzeModeProps) {
  const completedPathways = completedPathwaysProp ?? [];
  // Viz loading steps from store for progress display
  const vizLoadingSteps = useDesktopStore((s) => s.vizLoadingSteps);
  const vizStreamError = useDesktopStore((s) => s.vizStreamError);

  // Update availability (from useAutoUpdate in App.tsx)
  const updateAvailableVersion = useUpdateAvailability((s) => s.availableVersion);
  const isUpdateBlocking = useUpdateAvailability((s) => s.isUpdateBlocking);
  const updateStatus = useUpdateAvailability((s) => s.status);
  const updateProgress = useUpdateAvailability((s) => s.progress);

  // Gate: don't render config until both viz and ladder status have resolved.
  // This prevents the flash of intermediate states (zero stats, promotional card
  // appearing then disappearing, missing skill name, etc.)
  const isInitialLoading =
    mode === 'config' && (isVizLoading || ladder.isLoading);

  // Local state for inline chat expanded/collapsed
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  // Confirmation dialog state (for credit-consuming analysis)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // Follow-up confirmation dialog state
  const [isFollowUpConfirmOpen, setIsFollowUpConfirmOpen] = useState(false);
  const [pendingFollowUpMessage, setPendingFollowUpMessage] = useState<string | null>(null);
  // Don't show streaming content during analysis - wait until complete
  // This provides better UX: user sees loading state, then full content appears
  const displayContent = isAnalyzing ? '' : analysisContent;

  // Track if analysis has completed (content present and not analyzing)
  const isAnalysisComplete = analysisContent.length > 0 && !isAnalyzing;
  // Analysis has started if we're currently analyzing OR if we have completed content
  const hasStartedAnalysis = isAnalyzing || analysisContent.length > 0;

  // Follow-up chat: intercept send to show confirmation dialog on first use
  const handleFollowUpSend = useCallback((message: string) => {
    if (isFollowUpConfirmDismissed()) {
      onSendChatMessage?.(message);
      return;
    }
    setPendingFollowUpMessage(message);
    setIsFollowUpConfirmOpen(true);
  }, [onSendChatMessage]);

  const handleFollowUpConfirm = useCallback(() => {
    setIsFollowUpConfirmOpen(false);
    if (pendingFollowUpMessage) {
      onSendChatMessage?.(pendingFollowUpMessage);
      setPendingFollowUpMessage(null);
    }
  }, [pendingFollowUpMessage, onSendChatMessage]);

  const handleFollowUpCancel = useCallback(() => {
    setIsFollowUpConfirmOpen(false);
    setPendingFollowUpMessage(null);
  }, []);

  // Auto-select unified — it's the only analysis mode
  useEffect(() => {
    if (!config.focus.includes('unified')) {
      onConfigChange({ focus: ['unified'] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter out completed pathways
  const effectiveFocus = config.focus.filter(
    (f) => !completedPathways.includes(f),
  );

  // Auth gating: determine if billing blocks analysis
  // Use token store for live credit balance (updated by SSE credit_deduction events),
  // falling back to authState for initial load before any SSE events arrive
  const billingEnabled = authState?.billingEnabled ?? false;
  const needsAuth = billingEnabled && !authState?.isAuthenticated;
  const liveCreditBalance = useTokenStore((s) => s.creditBalance);
  const currentCredits = liveCreditBalance ?? authState?.creditBalance ?? null;
  const requiredCredits = estimateAnalysisCost(Math.max(effectiveFocus.length, 1));
  const needsCredits = billingEnabled && authState?.isAuthenticated &&
    currentCredits !== null && currentCredits < requiredCredits;
  const isInsufficientCreditsError = errorCode === 'INSUFFICIENT_CREDITS';
  const followUpNeedsCredits = billingEnabled && authState?.isAuthenticated &&
    currentCredits !== null && currentCredits < MIN_CREDITS_FOLLOW_UP;
  const isPobReimporting = useDesktopStore((s) => s.isPobReimporting);

  // Ladder build count — must have 30 builds before analysis can start
  const existingCount =
    ladder.status?.buildCount ?? ladder.stats?.buildCount ?? 0;
  const hasAllBuilds = existingCount >= 30;

  // Check if analysis can be started (blocked by ladder count, config, billing, or update)
  const canStartAnalysis =
    (effectiveFocus.length > 0 || config.customPrompt.trim().length > 0) &&
    hasAllBuilds &&
    !needsAuth &&
    !needsCredits &&
    !isAnalyzing &&
    !isPobReimporting &&
    !isUpdateBlocking;

  // Determine if ladder section should show, and in what form
  const cachedRange = ladder.status?.levelRange;
  const levelStale =
    level != null && cachedRange != null && level > cachedRange.max + 5;
  const showLadderSection =
    !ladder.status?.exists || !hasAllBuilds || levelStale || ladder.isFetching;
  const showPromotionalCard = !ladder.status?.exists && !ladder.stats;

  // Start analysis (ladder fetch must be complete — button is disabled during fetch)
  const handleAnalyzeClick = () => {
    // Skip confirmation if user has previously dismissed it
    if (isAnalysisConfirmDismissed()) {
      onStartAnalysis();
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmAnalysis = () => {
    setIsConfirmOpen(false);
    onStartAnalysis();
  };

  // Configuration view (before analysis) - shown in config mode
  if (mode === 'config' && (!hasStartedAnalysis || isAnalyzing)) {
    // Show loading state until both viz and ladder status have resolved
    if (isInitialLoading) {
      return (
        <BuildLoadingSteps steps={vizLoadingSteps} variant="full" error={vizStreamError} />
      );
    }

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col h-full"
      >
        <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-fantasy">
          <div className={cn(ANALYSIS_RAIL_CLASS, 'space-y-6')}>
            {/* Welcome Header with build info and analysis instruction */}
            <WelcomeHeader
              buildName={buildName}
              ascendancy={ascendancy}
              level={level}
              mainSkill={mainSkill}
              subtitle="Analyze your build"
            />

            {/* Update In Progress Banner — blocks analysis during download/install */}
            {isUpdateBlocking && updateAvailableVersion && (
              <motion.div
                variants={itemVariants}
                className="relative card-forge corner-accent overflow-hidden"
                style={{
                  ['--corner-color' as string]: 'rgba(251, 191, 36, 0.4)',
                  borderColor: 'rgba(251, 191, 36, 0.3)',
                  background:
                    'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(180, 83, 9, 0.06) 100%)',
                  boxShadow:
                    '0 2px 16px rgba(0, 0, 0, 0.3), 0 0 30px rgba(251, 191, 36, 0.06), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                <div className="relative px-5 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {updateStatus === 'downloading' ? (
                        <>
                          <Download className="w-4 h-4 text-amber-400 relative z-10 animate-bounce" />
                          <div className="absolute inset-0 blur-md bg-amber-500/40 rounded-full" />
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 text-amber-400 relative z-10 animate-spin" />
                          <div className="absolute inset-0 blur-md bg-amber-500/30 rounded-full" />
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <span className="text-amber-300 font-semibold">
                          {updateStatus === 'downloading'
                            ? `Updating to v${updateAvailableVersion}...`
                            : `Installing v${updateAvailableVersion}...`}
                        </span>
                        {' '}Analysis will be available once the update completes.
                        You can still import builds while updating.
                      </p>
                    </div>
                  </div>

                  {/* Progress bar for download */}
                  {updateStatus === 'downloading' && updateProgress && (
                    <div className="space-y-1">
                      <NeonProgressBar
                        value={updateProgress.downloaded}
                        max={updateProgress.total ?? 100}
                        color="amber"
                        size="sm"
                        showValue={false}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[0.625rem] text-slate-500">
                          {updateProgress.total
                            ? `${Math.round((updateProgress.downloaded / updateProgress.total) * 100)}%`
                            : 'Downloading...'}
                        </span>
                        <span className="text-[0.625rem] text-slate-500 tabular-nums">
                          {formatUpdateBytes(updateProgress.downloaded)}
                          {updateProgress.total ? ` / ${formatUpdateBytes(updateProgress.total)}` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" />
              </motion.div>
            )}

            {/* Ladder Benchmarks */}
            {showLadderSection &&
              (showPromotionalCard ? (
                <motion.div
                  variants={itemVariants}
                  className="relative card-forge corner-accent overflow-hidden"
                  style={{
                    ['--corner-color' as string]: 'rgba(251, 191, 36, 0.4)',
                    borderColor: 'rgba(251, 191, 36, 0.3)',
                    background:
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(180, 83, 9, 0.05) 100%)',
                    boxShadow:
                      '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
                  }}
                >
                  {/* Decorative top gradient line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

                  {/* Radial glow at top */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, transparent 70%)',
                    }}
                  />

                  {/* Content */}
                  <div className="relative px-5 pt-5 pb-4">
                    {/* Header with icon */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        <Trophy className="w-5 h-5 text-amber-400 relative z-10" />
                        <div className="absolute inset-0 blur-md bg-amber-500/40 rounded-full" />
                      </div>
                      <h3 className="text-sm font-display font-bold text-amber-200 uppercase tracking-wider">
                        {ladder.isFetching ? 'Fetching Ladder Data' : 'Ladder Benchmarks'}
                      </h3>
                    </div>

                    {/* Helper text */}
                    <p className="text-xs text-slate-300 leading-relaxed mb-4 pl-8">
                      {ladder.isFetching ? (
                        <>
                          Fetching top player builds so the agent can compare your build
                          {' '}against the{' '}
                          <span className="text-emerald-300 font-medium">top players on the ladder</span>.
                        </>
                      ) : (
                        <>
                          Ladder data lets the agent compare your build against top players
                          {' '}and provide{' '}
                          <span className="text-emerald-300 font-medium">
                            significantly better recommendations
                          </span>
                          .
                        </>
                      )}
                    </p>

                    {/* LadderDataSection component */}
                    <div className="pl-8">
                      <LadderDataSection
                        selectedSize={ladder.selectedSize}
                        onSizeChange={ladder.setSelectedSize}
                        isFetching={ladder.isFetching}
                        progress={ladder.progress}
                        onStartFetch={ladder.startFetch}
                        ninjaAvailableCount={ladder.status?.ninjaAvailableCount}
                        stats={ladder.stats}
                        existingBuildCount={ladder.status?.buildCount}
                        cachedLevelRange={ladder.status?.levelRange}
                        userLevel={level}
                        error={ladder.error}
                        onClearError={ladder.clearError}
                      />
                    </div>
                  </div>

                  {/* Decorative bottom accent line */}
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                </motion.div>
              ) : (
                /* Compact card for existing data -- fetch more or level-stale refetch */
                <motion.div
                  variants={itemVariants}
                  className="relative card-forge corner-accent overflow-hidden"
                  style={{
                    ['--corner-color' as string]: 'rgba(52, 211, 153, 0.3)',
                    borderColor: 'rgba(52, 211, 153, 0.2)',
                    background:
                      'linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(52, 211, 153, 0.03) 100%)',
                    boxShadow:
                      '0 2px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(52, 211, 153, 0.08)',
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                  <div className="relative px-5 pt-4 pb-3">
                    <LadderDataSection
                      selectedSize={ladder.selectedSize}
                      onSizeChange={ladder.setSelectedSize}
                      isFetching={ladder.isFetching}
                      progress={ladder.progress}
                      onStartFetch={ladder.startFetch}
                      ninjaAvailableCount={ladder.status?.ninjaAvailableCount}
                      stats={ladder.stats}
                      existingBuildCount={ladder.status?.buildCount}
                      cachedLevelRange={ladder.status?.levelRange}
                      userLevel={level}
                      error={ladder.error}
                      onClearError={ladder.clearError}
                    />
                  </div>
                </motion.div>
              ))}

            {/* ========== Analysis HUD ========== */}
            <motion.div
              variants={itemVariants}
              className="relative overflow-hidden rounded-xl"
              style={{
                background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.92) 40%, rgba(8,15,35,0.96) 100%)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 40px rgba(251,191,36,0.03), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.3)',
              }}
            >
              {/* Top edge highlight */}
              <div className="absolute top-0 left-0 right-0 h-px" style={{
                background: 'linear-gradient(90deg, transparent 5%, rgba(251,191,36,0.15) 20%, rgba(253,224,71,0.4) 50%, rgba(251,191,36,0.15) 80%, transparent 95%)',
              }} />

              {/* Radial spotlight */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(251,191,36,0.04) 0%, transparent 60%)',
              }} />

              <div className="relative z-10 px-5 pt-5 pb-4">
                {/* === Domain Analysis Section === */}
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                  <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-[0.15em]">
                    Analysis Domains
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-amber-500/25 to-transparent" />
                </div>

                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  {/* Gear */}
                  <div
                    className="relative rounded-lg px-3 py-3 overflow-hidden"
                    style={{
                      background: 'linear-gradient(145deg, rgba(20,184,166,0.08) 0%, rgba(2,6,23,0.6) 100%)',
                      border: '1px solid rgba(20,184,166,0.18)',
                    }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.3) 50%, transparent)',
                    }} />
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0.08) 70%)',
                          border: '1px solid rgba(20,184,166,0.3)',
                          boxShadow: '0 0 8px rgba(20,184,166,0.1)',
                        }}
                      >
                        <Shield className="w-3 h-3 text-teal-400" />
                      </div>
                      <span className="text-[0.6875rem] font-display font-semibold text-teal-300 uppercase tracking-wider">Gear</span>
                    </div>
                    <p className="text-[0.625rem] text-slate-400/90 leading-relaxed">
                      Item upgrades, trade searches, crafting strategies
                    </p>
                  </div>

                  {/* Skills */}
                  <div
                    className="relative rounded-lg px-3 py-3 overflow-hidden"
                    style={{
                      background: 'linear-gradient(145deg, rgba(59,130,246,0.08) 0%, rgba(2,6,23,0.6) 100%)',
                      border: '1px solid rgba(59,130,246,0.18)',
                    }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3) 50%, transparent)',
                    }} />
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.08) 70%)',
                          border: '1px solid rgba(59,130,246,0.3)',
                          boxShadow: '0 0 8px rgba(59,130,246,0.1)',
                        }}
                      >
                        <Gem className="w-3 h-3 text-blue-400" />
                      </div>
                      <span className="text-[0.6875rem] font-display font-semibold text-blue-300 uppercase tracking-wider">Skills</span>
                    </div>
                    <p className="text-[0.625rem] text-slate-400/90 leading-relaxed">
                      Gem links, support swaps, aura &amp; curse optimization
                    </p>
                  </div>

                  {/* Tree */}
                  <div
                    className="relative rounded-lg px-3 py-3 overflow-hidden"
                    style={{
                      background: 'linear-gradient(145deg, rgba(168,85,247,0.08) 0%, rgba(2,6,23,0.6) 100%)',
                      border: '1px solid rgba(168,85,247,0.18)',
                    }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-px" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3) 50%, transparent)',
                    }} />
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, rgba(168,85,247,0.25) 0%, rgba(168,85,247,0.08) 70%)',
                          border: '1px solid rgba(168,85,247,0.3)',
                          boxShadow: '0 0 8px rgba(168,85,247,0.1)',
                        }}
                      >
                        <TreePine className="w-3 h-3 text-purple-400" />
                      </div>
                      <span className="text-[0.6875rem] font-display font-semibold text-purple-300 uppercase tracking-wider">Tree</span>
                    </div>
                    <p className="text-[0.625rem] text-slate-400/90 leading-relaxed">
                      Repathing, keystones, jewels, cluster jewels, ascendancy
                    </p>
                  </div>
                </div>

                {/* === Divider === */}
                <div className="h-px mb-4" style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.12) 20%, rgba(251,191,36,0.12) 80%, transparent 100%)',
                }} />

                {/* === How It Works Section === */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-500/60 to-amber-700/40" />
                  <span className="text-[0.6875rem] font-display font-semibold text-amber-400/60 uppercase tracking-[0.15em]">
                    How It Works
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-amber-500/15 to-transparent" />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    { label: 'PoB Verified', desc: 'Every suggestion tested against your actual build in Path of Building' },
                    { label: 'Ladder Benchmarked', desc: 'Compared against top players running your skill and ascendancy' },
                    { label: 'Trade Aware', desc: 'Searches live trade listings with budget-aware pricing and availability' },
                    { label: 'Cross-Domain', desc: 'Finds synergies across gear, skills, and tree that single-focus analysis misses' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <div
                        className="w-1 h-1 rounded-full mt-[5px] flex-shrink-0"
                        style={{ backgroundColor: 'rgba(251,191,36,0.5)', boxShadow: '0 0 4px rgba(251,191,36,0.3)' }}
                      />
                      <div>
                        <span className="text-[0.6875rem] font-semibold text-amber-200/70">{item.label}</span>
                        <p className="text-[0.625rem] text-slate-400/80 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom edge */}
              <div className="absolute bottom-0 left-0 right-0 h-px" style={{
                background: 'linear-gradient(90deg, transparent 10%, rgba(251,191,36,0.1) 50%, transparent 90%)',
              }} />
            </motion.div>


          </div>
        </div>

        {/* Action Buttons */}
        <motion.div
          variants={itemVariants}
          className="px-4 py-4 border-t border-slate-800/50 bg-slate-900/30"
        >
          <div className={ANALYSIS_RAIL_CLASS}>
            {/* Two-button layout when existing results available */}
            <div
              className={cn(
                'flex flex-col gap-3',
                (hasExistingResults || isAnalyzing) && 'sm:flex-row',
              )}
            >
              {/* View Results button - shown when there are existing results or analysis is running */}
              {(hasExistingResults || isAnalyzing) && onViewResults && (
                <motion.button
                  onClick={onViewResults}
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
                    'font-display font-semibold text-sm tracking-wide',
                    'transition-all duration-200',
                    'border border-slate-600/50 hover:border-slate-500/60',
                    'text-slate-300 hover:text-slate-100',
                    'bg-slate-800/50 hover:bg-slate-700/50',
                  )}
                >
                  <Eye className="w-4 h-4" />
                  <span>View Results</span>
                </motion.button>
              )}

              {/* Analyzing indicator (non-cancellable) or Analyze Build / Re-Analyze */}
              {isAnalyzing ? (
                <motion.div
                  className={cn(
                    'flex items-center justify-center gap-3 px-6 py-4 rounded-lg',
                    'font-display font-semibold text-base tracking-wide',
                    'corner-accent border flex-1',
                    'border-amber-500/30 text-amber-200/80',
                  )}
                  style={{
                    ['--corner-color' as string]: 'rgba(217, 119, 6, 0.3)',
                    background:
                      'linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(120, 53, 15, 0.15) 50%, rgba(217, 119, 6, 0.08) 100%)',
                    boxShadow:
                      '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(217, 119, 6, 0.1)',
                  }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing...</span>
                </motion.div>
              ) : (
                <motion.button
                  onClick={handleAnalyzeClick}
                  disabled={!canStartAnalysis}
                  whileHover={canStartAnalysis ? { scale: 1.01, y: -2 } : {}}
                  whileTap={canStartAnalysis ? { scale: 0.99 } : {}}
                  className={cn(
                    'flex items-center justify-center gap-3 px-6 py-4 rounded-lg',
                    'font-display font-semibold text-base tracking-wide',
                    'transition-all duration-300',
                    'corner-accent border',
                    hasExistingResults ? 'flex-1' : 'w-full',
                    canStartAnalysis
                      ? 'border-amber-500/40 text-amber-200 hover:text-amber-100 hover:border-amber-500/60'
                      : 'bg-slate-800/50 text-slate-400 cursor-not-allowed border-slate-700/50',
                  )}
                  style={
                    canStartAnalysis
                      ? {
                          ['--corner-color' as string]: 'rgba(251, 191, 36, 0.4)',
                          background:
                            'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.2) 50%, rgba(251, 191, 36, 0.1) 100%)',
                          boxShadow:
                            '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
                        }
                      : {
                          ['--corner-color' as string]: 'rgba(71, 85, 105, 0.3)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (canStartAnalysis) {
                      e.currentTarget.style.background =
                        'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(180, 83, 9, 0.3) 50%, rgba(251, 191, 36, 0.2) 100%)';
                      e.currentTarget.style.boxShadow =
                        '0 6px 25px rgba(0, 0, 0, 0.4), 0 0 30px rgba(251, 191, 36, 0.15), inset 0 1px 0 rgba(251, 191, 36, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canStartAnalysis) {
                      e.currentTarget.style.background =
                        'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.2) 50%, rgba(251, 191, 36, 0.1) 100%)';
                      e.currentTarget.style.boxShadow =
                        '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(251, 191, 36, 0.1)';
                    }
                  }}
                >
                  <Swords className="w-5 h-5" />
                  <span>Analyze Build</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </motion.button>
              )}
            </div>

            {/* Auth / credit gating banners */}
            {(needsAuth || needsCredits || isInsufficientCreditsError) && (
              <div className={cn(
                'mt-3 px-4 py-3 rounded-lg border text-center',
                'bg-amber-500/5 border-amber-500/20',
              )}>
                {needsAuth && (
                  <p className="text-sm text-amber-300/80">
                    <Coins className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    Sign in to analyze your build.{' '}
                    <a
                      href="https://pathofagent.com/account"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Create an account
                    </a>
                  </p>
                )}
                {(needsCredits || isInsufficientCreditsError) && !needsAuth && (
                  <p className="text-sm text-amber-300/80">
                    <Coins className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    {currentCredits !== null
                      ? `You have ${currentCredits} credits (${requiredCredits} required for analysis).`
                      : 'Insufficient credits.'}{' '}
                    <a
                      href="https://pathofagent.com/account"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Buy more credits
                    </a>
                  </p>
                )}
              </div>
            )}

            {!canStartAnalysis && !hasExistingResults && !needsAuth && !needsCredits && (
              <p className="mt-2 text-center text-xs text-slate-400">
                {isUpdateBlocking
                  ? `Updating to v${updateAvailableVersion ?? ''}... Analysis will resume after update.`
                  : !hasAllBuilds
                    ? ladder.isFetching
                      ? `Fetching ladder data (${ladder.progress?.current ?? existingCount}/${ladder.progress?.total ?? 30} builds)...`
                      : `30 ladder builds required to start analysis (${existingCount} fetched)`
                    : 'Select at least one focus area or enter a question'}
              </p>
            )}
          </div>
        </motion.div>

        {/* Credit confirmation dialog (portal — renders above everything) */}
        <AnalysisConfirmDialog
          isOpen={isConfirmOpen}
          onConfirm={handleConfirmAnalysis}
          onCancel={() => setIsConfirmOpen(false)}
          selectedPathways={effectiveFocus}
          totalCost={requiredCredits}
          currentBalance={currentCredits}
          bandit={bandit ?? 'None'}
          onBanditChange={onBanditChange ?? (() => {})}
          isBanditLoading={isBanditLoading}
          pantheonMajor={pantheonMajor ?? 'None'}
          pantheonMinor={pantheonMinor ?? 'None'}
          onPantheonChange={onPantheonChange ?? (() => {})}
          isPantheonLoading={isPantheonLoading}
        />

        {/* Follow-up chat confirmation dialog (portal — renders above everything) */}
        <FollowUpConfirmDialog
          isOpen={isFollowUpConfirmOpen}
          onConfirm={handleFollowUpConfirm}
          onCancel={handleFollowUpCancel}
        />

      </motion.div>
    );
  }

  // Determine active pathway tab (default to first analyzed pathway)
  const effectiveActiveTab = activePathwayTab || config.focus[0] || 'gear';

  // Filter message parts to only show steps belonging to the active pathway tab.
  // Parts without a pathway (e.g. global events) are always shown.
  const activePathwayParts =
    messageParts?.filter((part) => {
      const pathway = 'pathway' in part ? part.pathway : undefined;
      return !pathway || pathway === effectiveActiveTab;
    }) ?? [];

  // Get content for the active tab (parsed from section markers)
  // Always try to extract section content first; if that section exists in content, use it
  // Otherwise fall back to full content (for single-pathway analyses or content without markers)
  const sectionContent = getActiveTabContent(
    displayContent,
    effectiveActiveTab,
  );
  const activeTabContent = sectionContent || displayContent;

  // Analysis in progress or complete
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Analysis Content - Back button and pathway tabs are in ChatPage above this component */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-fantasy">
        <div className={ANALYSIS_RAIL_CLASS}>
          {/* Activity indicator when analysis is starting but no parts yet */}
          {isAnalyzing && activePathwayParts.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-amber-500/20">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="text-stone-300">Starting analysis...</span>
            </div>
          )}

          {/* Tool steps - unified analysis monitor card */}
          {activePathwayParts.length > 0 && (
            <ToolActivitySummary
              parts={activePathwayParts}
              isAnalyzing={isAnalyzing}
            />
          )}

          {/* Analysis result for active tab - shown when complete */}
          {!isAnalyzing && activeTabContent && (
            <div className="rounded-lg px-4 py-3 card-forge">
              <SemanticMarkdown
                content={activeTabContent}
                className="prose prose-invert max-w-none leading-relaxed"
                pathway={effectiveActiveTab}
              />
            </div>
          )}

          {/* Empty state if no content and not analyzing */}
          {!isAnalyzing && !activeTabContent && displayContent && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p>No analysis content for this section.</p>
            </div>
          )}

          {/* Follow-up conversation history */}
          {/* Filter out seeded analysis messages (id starts with "analysis-") — those are context
            seeds for the LLM, not actual follow-up responses. They're already shown above as
            the main analysis result. */}
          {chatMessages &&
            chatMessages.filter((m) => !m.id?.startsWith('analysis-')).length >
              0 && (
              <div className="mt-6 pt-4 border-t border-slate-700/50 space-y-4">
                {chatMessages
                  .filter((m) => !m.id?.startsWith('analysis-'))
                  .map((msg, msgIdx, filteredMsgs) => {
                    const isLastMessage = msgIdx === filteredMsgs.length - 1;
                    const isStreaming = isLastMessage && isChatLoading;

                    if (msg.role === 'user') {
                      return (
                        <div
                          key={msg.id}
                          className={
                            msgIdx > 0
                              ? 'mt-4 pt-4 border-t border-slate-700/30'
                              : ''
                          }
                        >
                          <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-display mb-3">
                            <span>Your Question</span>
                          </div>
                          <div className="relative max-w-[85%]">
                            <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-amber-600/40" />
                            <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-amber-600/40" />
                            <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-amber-600/40" />
                            <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-amber-600/40" />
                            <div className="relative px-4 py-3 rounded bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 border border-amber-900/30 shadow-[inset_0_1px_0_rgba(251,191,36,0.05)]">
                              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-amber-600/20 to-transparent" />
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 font-body">
                                {msg.content}
                              </p>
                              <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-amber-600/20 to-transparent" />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Assistant message
                    const hasParts = msg.parts && msg.parts.length > 0;
                    const hasContent = !!msg.content;
                    if (!hasParts && !hasContent && !isStreaming) return null;

                    return (
                      <div key={msg.id} className="mt-3 space-y-3">
                        {/* Section header */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-display mb-2">
                          <span>Follow-up Response</span>
                        </div>

                        {/*
                          Tool-steps rendering for follow-up responses.

                          `search_trade` ALWAYS routes to LiveTradeSearchCard
                          for its entire lifecycle (running → complete →
                          history replay). The card renders live progress
                          while the search runs and a PoB-verified items
                          list once the final tool_result arrives. We
                          suppress `search_trade` from ToolActivitySummary
                          so it doesn't double-render as a generic card.

                          Other tools continue to use the standard
                          ToolActivitySummary follow-up variant.
                        */}
                        {(() => {
                          const searchTradePart = msg.parts?.find(
                            (p) => p.type === 'tool_call' && p.tool === 'search_trade',
                          );
                          const searchTradeResult =
                            searchTradePart?.type === 'tool_call' && searchTradePart.status === 'complete'
                              ? searchTradePart.result
                              : null;

                          const otherToolParts = msg.parts?.filter(
                            (p) => !(p.type === 'tool_call' && p.tool === 'search_trade'),
                          );
                          const hasOtherTools = otherToolParts?.some((p) => p.type === 'tool_call');

                          return (
                            <>
                              {searchTradePart && (
                                <LiveTradeSearchCard
                                  search={liveTradeSearch}
                                  finalResult={searchTradeResult}
                                />
                              )}
                              {hasOtherTools && otherToolParts && (
                                <ToolActivitySummary
                                  parts={otherToolParts}
                                  isAnalyzing={isStreaming ?? false}
                                  variant="follow-up"
                                />
                              )}
                            </>
                          );
                        })()}

                        {/* Text parts (shown alongside tool calls or standalone) */}
                        {msg.parts &&
                          msg.parts.map((part, i) => {
                            if (part.type !== 'text') return null;
                            if (hasContent && !isStreaming) return null;
                            return (
                              <div key={i} className="rounded-lg px-4 py-3 card-forge">
                                <SemanticMarkdown
                                  content={part.content}
                                  className="prose prose-invert max-w-none leading-relaxed"
                                  pathway={effectiveActiveTab}
                                />
                              </div>
                            );
                          })
                        }

                        {/* Streaming indicator for messages without tool calls */}
                        {isStreaming && msg.parts && !msg.parts.some((p) => p.type === 'tool_call') && (
                          <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{streamingStatus || 'Thinking...'}</span>
                          </div>
                        )}

                        {/* Final text response */}
                        {hasContent && !isStreaming && (
                          <div className="rounded-lg px-4 py-3 card-forge">
                            <SemanticMarkdown
                              content={msg.content}
                              className="prose prose-invert max-w-none leading-relaxed"
                              pathway={effectiveActiveTab}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

        </div>
      </div>

      {/* Chat Input at bottom (shown in results mode for pathway tabs, hidden on Q&A) */}
      {mode === 'results' && onSendChatMessage && activePathwayTab !== 'qa' && (
        <div className="flex-shrink-0 border-t border-slate-800/50 bg-slate-900/30">
          <InlineChatInput
            isLoading={isChatLoading || false}
            onSendMessage={(msg) => handleFollowUpSend(msg)}
            suggestedQuestions={suggestedQuestions}
            placeholder={isPobReimporting ? 'Loading build data...' : activePathwayTab === 'unified' ? 'Ask about the build analysis or request a trade search...' : `Ask about ${activePathwayTab} optimization...`}
            disabled={followUpNeedsCredits || isPobReimporting || false}
            disabledMessage={isPobReimporting ? 'Loading build data...' : `${MIN_CREDITS_FOLLOW_UP} credits required for follow-up`}
          />
        </div>
      )}

      {/* Follow-up chat confirmation dialog (portal — renders above everything) */}
      <FollowUpConfirmDialog
        isOpen={isFollowUpConfirmOpen}
        onConfirm={handleFollowUpConfirm}
        onCancel={handleFollowUpCancel}
      />
    </motion.div>
  );
}

export default AnalyzeMode;
