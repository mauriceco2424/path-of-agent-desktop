/**
 * LadderDataSection Component
 *
 * Renders ladder data controls in the AnalyzeMode config panel.
 *
 * Four states:
 * A) Selection — user picks fetch size (Skip, 10, 20, 30, 50) — shown when no data exists
 * B) Fetching — progress bar with current build info
 * C) Complete — compact summary with benchmarks + "fetch more" controls
 *    - Level staleness warning when user has leveled past cached range
 *    - Incremental fetch size cards (only sizes larger than existing)
 */

import { motion } from 'framer-motion';
import { X, Zap, BarChart3, Trophy, Loader2, Download, AlertTriangle, RefreshCw, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LadderFetchProgressEvent, LadderStatsSummary } from '../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface LadderDataSectionProps {
  selectedSize: 10 | 20 | 30 | 50 | 100 | null;
  onSizeChange: (size: 10 | 20 | 30 | 50 | 100 | null) => void;
  isFetching: boolean;
  progress: LadderFetchProgressEvent | null;
  onStartFetch: (freshFetch?: boolean) => void;
  ninjaAvailableCount?: number;
  stats: LadderStatsSummary | null;
  /** Number of builds already fetched and cached */
  existingBuildCount?: number;
  /** Level range of cached ladder data */
  cachedLevelRange?: { min: number; max: number };
  /** User's current build level */
  userLevel?: number;
  /** Error message from last fetch attempt */
  error?: string | null;
  /** Clear the error state */
  onClearError?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

interface SizeOption {
  id: 10 | 20 | 30 | 50 | null;
  label: string;
  description: string;
  icon: typeof Zap | typeof BarChart3 | typeof Trophy | typeof X;
}

type NonSkipSizeOption = SizeOption & { id: 10 | 20 | 30 | 50 };

const BASE_SIZE_OPTIONS: Omit<SizeOption, 'description'>[] = [
  { id: null, label: 'Skip', icon: X },
  { id: 10, label: '10 builds', icon: Zap },
  { id: 20, label: '20 builds', icon: BarChart3 },
  { id: 30, label: '30 builds', icon: Trophy },
  { id: 50, label: '50 builds', icon: Trophy },
];

/**
 * Per-build fetch time in seconds.
 * The poe.ninja time machine path (primary) uses ~250ms fetch + ~0.5s PoB enrichment ≈ 0.75s/build.
 * The GGG API fallback path is slower (~7s/build) but rarely used.
 * Calibrated for the common (ninja) path since time machine is used for most level ranges.
 */
const SECONDS_PER_BUILD = 0.75;

/**
 * Compute a human-readable time estimate for fetching `buildCount` builds,
 * accounting for already-cached builds that won't be re-fetched.
 */
function estimateFetchTime(targetCount: number | null, existingCount: number): string {
  if (targetCount === null) return 'No ladder data';
  const delta = Math.max(0, targetCount - existingCount);
  if (delta === 0) return 'Already cached';
  const totalSeconds = delta * SECONDS_PER_BUILD;
  if (totalSeconds < 60) return `~${Math.round(totalSeconds / 5) * 5} seconds`;
  const minutes = totalSeconds / 60;
  if (minutes < 2) return `~${Math.round(totalSeconds / 10) * 10} seconds`;
  return `~${minutes.toFixed(1)} minutes`;
}

/** Build SIZE_OPTIONS with dynamic time estimates */
function buildSizeOptions(existingCount: number): SizeOption[] {
  return BASE_SIZE_OPTIONS.map((opt) => ({
    ...opt,
    description: estimateFetchTime(opt.id, existingCount),
  }));
}

/** Build fetch-more options (excludes Skip) with dynamic time estimates */
function buildFetchMoreSizeOptions(existingCount: number): NonSkipSizeOption[] {
  return buildSizeOptions(existingCount).filter(
    (opt): opt is NonSkipSizeOption => opt.id !== null
  );
}

/** Level gap threshold for staleness warning */
const STALENESS_LEVEL_GAP = 5;

// =============================================================================
// Animation Variants
// =============================================================================

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Mirror of backend's computeLevelRange — determines what level range
 * the backend would search on a fresh fetch. Used to detect whether
 * refetching would actually find different builds.
 */
function computeSearchRange(userLevel: number): { min: number; max: number } {
  if (userLevel >= 90) return { min: userLevel - 3, max: 100 };
  if (userLevel >= 75) return { min: userLevel - 5, max: Math.min(userLevel + 10, 100) };
  if (userLevel >= 50) return { min: userLevel - 10, max: Math.min(userLevel + 15, 100) };
  return { min: 1, max: 70 };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

// =============================================================================
// Sub-Components
// =============================================================================

interface SizeCardProps {
  option: SizeOption;
  isSelected: boolean;
  onSelect: () => void;
  /** When true, card appears grayed out and is not interactive */
  disabled?: boolean;
}

function SizeCard({ option, isSelected, onSelect, disabled = false }: SizeCardProps) {
  const Icon = option.icon;

  return (
    <motion.button
      onClick={disabled ? undefined : onSelect}
      whileHover={disabled ? {} : { scale: 1.02, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      disabled={disabled}
      className={cn(
        'flex-1 relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg',
        'card-forge transition-all duration-300',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
        isSelected && !disabled && 'ring-1 ring-amber-500/40',
        disabled && 'opacity-35 cursor-not-allowed'
      )}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.boxShadow = `
          0 4px 16px rgba(0, 0, 0, 0.4),
          0 0 20px rgba(251, 191, 36, 0.15),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <Icon
        className={cn(
          'w-4 h-4 transition-colors duration-200',
          disabled
            ? 'text-slate-500'
            : isSelected
              ? 'text-amber-400'
              : 'text-slate-400 group-hover:text-slate-300'
        )}
      />
      <span
        className={cn(
          'text-xs font-display font-medium transition-colors duration-200',
          disabled
            ? 'text-slate-500'
            : isSelected
              ? 'text-amber-300'
              : 'text-slate-300'
        )}
      >
        {option.label}
      </span>
      <span className={cn('text-[0.625rem]', disabled ? 'text-slate-600' : 'text-slate-400')}>
        {option.description}
      </span>

      {/* Selection indicator line */}
      {isSelected && !disabled && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.5) 50%, transparent 100%)',
          }}
        />
      )}
    </motion.button>
  );
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'finishing up...';
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m === 0) return `${s}s remaining`;
  return `${m}m ${s.toString().padStart(2, '0')}s remaining`;
}

function ProgressDisplay({
  progress,
}: {
  progress: LadderFetchProgressEvent | null;
}) {
  const current = progress?.current ?? 0;
  const total = progress?.total ?? 1;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  // Countdown timer: estimate remaining seconds based on phase
  const remainingSeconds = (() => {
    if (progress?.phase === 'searching') {
      // Search phase is quick (~5s), then fetching will start.
      // Show full estimate based on expected total.
      return total * SECONDS_PER_BUILD;
    }
    if (progress?.phase === 'fetching') {
      return (total - current) * SECONDS_PER_BUILD;
    }
    if (progress?.phase === 'analyzing') {
      return 5; // Analysis is fast
    }
    return total * SECONDS_PER_BUILD; // Default: full estimate
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {/* Status text + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
          <span className="text-sm text-slate-300">
            {progress?.phase === 'searching' && 'Searching poe.ninja ladder...'}
            {progress?.phase === 'fetching' && `Fetching build ${current}/${total}...`}
            {progress?.phase === 'analyzing' && 'Analyzing ladder data...'}
            {!progress?.phase && 'Starting fetch...'}
          </span>
        </div>
        <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">
          {formatTimeRemaining(remainingSeconds)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-slate-800/80 border border-slate-700/40 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            background: 'linear-gradient(90deg, rgba(180, 83, 9, 0.8) 0%, rgba(251, 191, 36, 0.9) 100%)',
            boxShadow: '0 0 8px rgba(251, 191, 36, 0.4)',
          }}
        />
      </div>

      {/* Character name */}
      <div className="flex items-center">
        <span className="text-[0.6875rem] text-slate-400 truncate max-w-[300px]">
          {progress?.characterName || progress?.message || ''}
        </span>
      </div>
    </motion.div>
  );
}

interface CompleteSummaryProps {
  stats: LadderStatsSummary;
  levelRange?: { min: number; max: number };
}

function CompleteSummary({ stats, levelRange }: CompleteSummaryProps) {
  if (!stats?.benchmarks?.dps || !stats?.benchmarks?.ehp) {
    return <span className="text-slate-400 text-sm">Stats processing...</span>;
  }

  // Derive display-ready level range: prefer explicit prop, fall back to stats
  const effectiveRange = levelRange ?? stats.levelRange;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 text-sm flex-wrap"
    >
      <span className="text-emerald-400 font-medium flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {stats.buildCount} builds fetched
      </span>
      {effectiveRange && (
        <>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            L<span className="text-slate-200">{effectiveRange.min}</span>
            -
            <span className="text-slate-200">{effectiveRange.max}</span>
          </span>
        </>
      )}
      <span className="text-slate-600">|</span>
      <span className="text-slate-400">
        Median DPS: <span className="text-slate-200">{formatNumber(stats.benchmarks.dps.avg)}</span>
      </span>
      <span className="text-slate-600">&middot;</span>
      <span className="text-slate-400">
        Median EHP: <span className="text-slate-200">{formatNumber(stats.benchmarks.ehp.avg)}</span>
      </span>
    </motion.div>
  );
}

// =============================================================================
// Staleness Warning Sub-Component
// =============================================================================

interface StalenessWarningProps {
  userLevel: number;
  cachedLevelRange: { min: number; max: number };
  /** Whether a fresh fetch would actually find different builds */
  isActionable: boolean;
}

function StalenessWarning({ userLevel, cachedLevelRange, isActionable }: StalenessWarningProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-2 mt-2"
    >
      {isActionable ? (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
          <span className="text-[0.6875rem] text-amber-400/70 leading-relaxed">
            Your build is now level {userLevel} — ladder data covers L{cachedLevelRange.min}-{cachedLevelRange.max}.
            Consider refetching for your level range.
          </span>
        </>
      ) : (
        <>
          <Info className="w-3.5 h-3.5 text-slate-400/70 flex-shrink-0 mt-0.5" />
          <span className="text-[0.6875rem] text-slate-400/70 leading-relaxed">
            Your build is level {userLevel} — all available ladder builds are L{cachedLevelRange.min}-{cachedLevelRange.max}.
            Data is still useful for optimization targets.
          </span>
        </>
      )}
    </motion.div>
  );
}

// =============================================================================
// Error / Warning Banners
// =============================================================================

function FetchErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  // Partial success messages use amber (warning), full errors use red
  const isWarning = message.startsWith('Fetched ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex items-start gap-2 py-2 px-3 rounded-lg',
        isWarning
          ? 'bg-amber-950/20 border border-amber-500/20'
          : 'bg-red-950/30 border border-red-500/20',
      )}
    >
      {isWarning ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <span className={cn('text-xs', isWarning ? 'text-amber-200/80' : 'text-red-200')}>
          {message}
        </span>
        {(!isWarning || onRetry) && (
          <div className="flex items-center gap-3 mt-1.5">
            {onRetry && (
              <button
                onClick={onRetry}
                className={cn(
                  'flex items-center gap-1 text-[0.625rem] transition-colors',
                  isWarning
                    ? 'text-amber-400/70 hover:text-amber-300'
                    : 'text-red-400 hover:text-red-300',
                )}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-[0.625rem] text-slate-500 hover:text-slate-400 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Fetch More Controls Sub-Component
// =============================================================================

interface FetchMoreControlsProps {
  existingBuildCount: number;
  selectedSize: 10 | 20 | 30 | 50 | 100 | null;
  onSizeChange: (size: 10 | 20 | 30 | 50 | 100 | null) => void;
  onStartFetch: (freshFetch?: boolean) => void;
  isLevelStale: boolean;
}

function FetchMoreControls({
  existingBuildCount,
  selectedSize,
  onSizeChange,
  onStartFetch,
  isLevelStale,
}: FetchMoreControlsProps) {
  // Build options with dynamic time estimates based on existing cache
  const fetchMoreOptions = buildFetchMoreSizeOptions(existingBuildCount);

  // Determine which size is selectable (only sizes > existingBuildCount)
  const selectableOptions = fetchMoreOptions.filter(
    (opt) => opt.id !== null && opt.id > existingBuildCount
  );

  // If all tiers are already reached or exceeded, nothing to show
  if (selectableOptions.length === 0 && !isLevelStale) {
    return null;
  }

  // Compute the delta for the button label
  const delta = selectedSize !== null ? selectedSize - existingBuildCount : 0;

  // Build the button label
  const fetchButtonLabel = isLevelStale && selectedSize !== null
    ? `Fetch ${selectedSize} Builds (Fresh Fetch)`
    : delta > 0
      ? `Fetch ${delta} More Builds`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="space-y-3 mt-3 pt-3 border-t border-slate-700/30"
    >
      {/* Size cards */}
      <div className="flex gap-2">
        {fetchMoreOptions.map((option) => {
          const isDisabled = option.id <= existingBuildCount && !isLevelStale;
          return (
            <SizeCard
              key={String(option.id)}
              option={option}
              isSelected={selectedSize === option.id}
              onSelect={() => onSizeChange(option.id)}
              disabled={isDisabled}
            />
          );
        })}
      </div>

      {/* Fresh fetch note when level-stale */}
      {isLevelStale && (
        <div className="flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-amber-400/50" />
          <span className="text-[0.625rem] text-amber-400/50">
            Fresh fetch for current level range
          </span>
        </div>
      )}

      {/* Fetch button */}
      {selectedSize !== null && fetchButtonLabel && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            onClick={() => onStartFetch(isLevelStale)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg',
              'bg-gradient-to-r from-amber-600/20 to-amber-500/10',
              'border border-amber-500/30 hover:border-amber-400/50',
              'text-sm font-display font-medium text-amber-300',
              'hover:from-amber-600/30 hover:to-amber-500/20',
              'shadow-[0_0_12px_rgba(251,191,36,0.1)]',
              'hover:shadow-[0_0_20px_rgba(251,191,36,0.2)]',
              'transition-all duration-300',
            )}
          >
            <Download className="w-4 h-4" />
            {fetchButtonLabel}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LadderDataSection({
  selectedSize,
  onSizeChange,
  isFetching,
  progress,
  onStartFetch,
  ninjaAvailableCount,
  stats,
  existingBuildCount,
  cachedLevelRange,
  userLevel,
  error,
  onClearError,
}: LadderDataSectionProps) {
  // Derive staleness: user has leveled significantly past cached range
  const effectiveLevelRange = cachedLevelRange ?? stats?.levelRange;
  const isLevelMismatch =
    userLevel != null &&
    effectiveLevelRange != null &&
    (userLevel > effectiveLevelRange.max + STALENESS_LEVEL_GAP ||
     userLevel < effectiveLevelRange.min - STALENESS_LEVEL_GAP);

  // Would a fresh fetch actually find different builds?
  // Compute what level range the backend would search, then check if the
  // cached builds already fall within that window. If so, refetching won't help —
  // the ladder simply doesn't have builds at the user's level.
  const searchRange = userLevel != null ? computeSearchRange(userLevel) : null;
  const isRefetchActionable =
    isLevelMismatch &&
    !(searchRange != null &&
      effectiveLevelRange != null &&
      effectiveLevelRange.min >= searchRange.min &&
      effectiveLevelRange.max <= searchRange.max);

  const effectiveExistingCount = existingBuildCount ?? stats?.buildCount ?? 0;

  // State C: Complete — stats are available and not currently fetching
  if (stats && !isFetching) {
    return (
      <motion.div variants={itemVariants} className="space-y-3">
        <label className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider">
          Ladder Benchmarks
        </label>

        {/* Summary line with level range */}
        <CompleteSummary stats={stats} levelRange={effectiveLevelRange} />

        {/* Level mismatch notice (informational or actionable) */}
        {isLevelMismatch && effectiveLevelRange && userLevel != null && (
          <StalenessWarning
            userLevel={userLevel}
            cachedLevelRange={effectiveLevelRange}
            isActionable={isRefetchActionable}
          />
        )}

        {/* Partial success warning (e.g. "Fetched 18 of 30") */}
        {error && (
          <FetchErrorBanner message={error} onDismiss={onClearError} />
        )}

        {/* Fetch more controls — only use fresh-fetch mode when refetching would actually help */}
        <FetchMoreControls
          existingBuildCount={effectiveExistingCount}
          selectedSize={selectedSize}
          onSizeChange={onSizeChange}
          onStartFetch={onStartFetch}
          isLevelStale={isRefetchActionable}
        />
      </motion.div>
    );
  }

  // State D: Error — fetch failed before any data was obtained
  if (!isFetching && !stats && error) {
    return (
      <motion.div variants={itemVariants} className="space-y-3">
        <label className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider">
          Ladder Benchmarks
        </label>
        <FetchErrorBanner
          message={error}
          onRetry={() => onStartFetch()}
          onDismiss={onClearError}
        />
      </motion.div>
    );
  }

  // State E: Idle — not fetching, no stats, no error (cancelled or not yet started)
  if (!isFetching) {
    return (
      <motion.div variants={itemVariants} className="space-y-3">
        <label className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider">
          Ladder Benchmarks
        </label>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            onClick={() => onStartFetch()}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg',
              'bg-gradient-to-r from-amber-600/20 to-amber-500/10',
              'border border-amber-500/30 hover:border-amber-400/50',
              'text-sm font-display font-medium text-amber-300',
              'hover:from-amber-600/30 hover:to-amber-500/20',
              'shadow-[0_0_12px_rgba(251,191,36,0.1)]',
              'hover:shadow-[0_0_20px_rgba(251,191,36,0.2)]',
              'transition-all duration-300',
            )}
          >
            <Download className="w-4 h-4" />
            Fetch 30 Ladder Builds
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // State F: Fetching — progress display with cancel button
  return (
    <motion.div variants={itemVariants} className="space-y-3">
      <label className="text-xs font-display font-semibold text-slate-400 uppercase tracking-wider">
        Ladder Benchmarks
      </label>

      <ProgressDisplay progress={progress} />
    </motion.div>
  );
}
