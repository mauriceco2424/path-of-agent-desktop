/**
 * LadderStatsDrawer Component
 *
 * "The Ladder Codex" - A sacred tome of competitive benchmark data.
 * Sliding drawer that displays ladder statistics with a warm amber/gold
 * dark fantasy aesthetic, comparing the user's build against top players.
 *
 * Features:
 * - Range bars showing user position against ladder min/avg/max
 * - Popular choices grid (keystones, uniques, supports, auras)
 * - Staggered reveal animations matching TokenUsageDrawer pattern
 * - Empty state when no ladder data is available
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  X,
  Sword,
  Shield,
  Heart,
  Key,
  Gem,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDesktopStore } from '../../store';
import type { LadderStatsSummary } from '../../../../shared/types/LadderData';

// =============================================================================
// Props
// =============================================================================

interface LadderStatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a number with K/M suffixes for compact display
 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

/**
 * Convert an ISO date string to a human-readable relative time
 */
function formatRelativeTime(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/**
 * Calculate the percentage position of a value within a range, clamped 0-100.
 * Returns 0 if range is degenerate.
 */
function getPositionPercent(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
}

// =============================================================================
// Animation Variants (matching TokenUsageDrawer)
// =============================================================================

const drawerVariants = {
  hidden: { x: '100%', opacity: 0.8 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 280, damping: 28 },
  },
  exit: {
    x: '100%',
    opacity: 0.8,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

// =============================================================================
// Sub-Components
// =============================================================================

interface BenchmarkRangeBarProps {
  label: string;
  icon: React.ReactNode;
  benchmark: { avg: number; min: number; max: number };
  userValue: number | undefined;
  index: number;
}

/**
 * A horizontal range bar showing min/max with average and user position markers.
 * Color-coded: emerald if user >= avg, amber if below.
 */
function BenchmarkRangeBar({ label, icon, benchmark, userValue, index }: BenchmarkRangeBarProps) {
  const avgPercent = getPositionPercent(benchmark.avg, benchmark.min, benchmark.max);
  const userPercent = userValue != null
    ? getPositionPercent(userValue, benchmark.min, benchmark.max)
    : null;
  const isAboveAvg = userValue != null && userValue >= benchmark.avg;

  // Extend visual range slightly beyond min/max for user values outside the range
  const userBeyondMax = userValue != null && userValue > benchmark.max;
  const userBelowMin = userValue != null && userValue < benchmark.min;

  // Compute a display percent that can go beyond the bar for out-of-range values
  const userDisplayPercent = userValue != null
    ? userBeyondMax
      ? 98
      : userBelowMin
        ? 2
        : userPercent ?? 50
    : null;

  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-display font-semibold text-slate-200 uppercase tracking-wider">
            {label}
          </span>
        </div>
        {userValue != null && (
          <span
            className={cn(
              'text-xs font-semibold',
              isAboveAvg ? 'text-emerald-400' : 'text-amber-400'
            )}
          >
            {isAboveAvg ? 'Above Avg' : 'Below Avg'}
          </span>
        )}
      </div>

      {/* Range bar */}
      <div className="relative h-6 rounded-md overflow-hidden bg-slate-900/80 border border-slate-700/40">
        {/* Gradient fill from min to max (background bar) */}
        <div
          className="absolute inset-0 rounded-md"
          style={{
            background: 'linear-gradient(90deg, rgba(30, 25, 15, 0.6) 0%, rgba(50, 40, 20, 0.4) 50%, rgba(30, 25, 15, 0.6) 100%)',
          }}
        />

        {/* Average marker line */}
        <div
          className="absolute top-0 bottom-0 w-px z-10"
          style={{
            left: `${avgPercent}%`,
            background: 'rgba(148, 163, 184, 0.5)',
          }}
        />
        <div
          className="absolute top-0 z-10 -translate-x-1/2"
          style={{ left: `${avgPercent}%` }}
        >
          <div
            className="w-2 h-2 rotate-45"
            style={{
              background: 'rgba(148, 163, 184, 0.6)',
            }}
          />
        </div>

        {/* User value marker */}
        {userDisplayPercent != null && userValue != null && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + index * 0.1, duration: 0.4, type: 'spring', stiffness: 300 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
            style={{ left: `${userDisplayPercent}%` }}
          >
            {/* Glow behind the dot */}
            <div
              className="absolute inset-0 -m-2 rounded-full"
              style={{
                background: isAboveAvg
                  ? 'radial-gradient(circle, rgba(52, 211, 153, 0.4) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, transparent 70%)',
                width: '20px',
                height: '20px',
              }}
            />
            {/* The dot */}
            <div
              className="relative w-3 h-3 rounded-full border-2"
              style={{
                backgroundColor: isAboveAvg ? '#34d399' : '#fbbf24',
                borderColor: isAboveAvg ? '#6ee7b7' : '#fcd34d',
                boxShadow: isAboveAvg
                  ? '0 0 8px rgba(52, 211, 153, 0.6)'
                  : '0 0 8px rgba(251, 191, 36, 0.6)',
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Numbers row */}
      <div className="flex items-center justify-between text-[0.625rem]">
        <span className="text-slate-500">
          min {formatNumber(benchmark.min)}
        </span>
        {userValue != null && (
          <span
            className={cn(
              'font-semibold',
              isAboveAvg ? 'text-emerald-400' : 'text-amber-400'
            )}
          >
            You: {formatNumber(userValue)}
          </span>
        )}
        <span className="text-slate-400">
          avg {formatNumber(benchmark.avg)}
        </span>
        <span className="text-slate-500">
          max {formatNumber(benchmark.max)}
        </span>
      </div>
    </motion.div>
  );
}

interface UsageBarProps {
  name: string;
  usage: number;
  suffix?: string;
  index: number;
}

/**
 * A single usage item with name, amber gradient bar, and percentage.
 */
function UsageBar({ name, usage, suffix, index }: UsageBarProps) {
  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-2.5"
    >
      <span className="text-[0.6875rem] text-slate-300 min-w-0 flex-1 truncate">
        {name}
        {suffix && (
          <span className="text-slate-600 ml-1 text-[0.625rem]">({suffix})</span>
        )}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-24 h-[5px] rounded-full bg-slate-800/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(usage, 100)}%` }}
            transition={{ delay: 0.2 + index * 0.04, duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(180, 83, 9, 0.7) 0%, rgba(251, 191, 36, 0.9) 100%)',
            }}
          />
        </div>
        <span className="text-[0.625rem] text-slate-500 w-8 text-right tabular-nums">
          {Math.round(usage)}%
        </span>
      </div>
    </motion.div>
  );
}

interface UsageSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ReadonlyArray<{ name: string; usage: number; slot?: string }>;
  showSlot?: boolean;
  baseIndex: number;
}

/**
 * A titled section with up to 5 usage bars.
 */
function UsageSection({ title, icon, items, showSlot, baseIndex }: UsageSectionProps) {
  const displayed = items.slice(0, 5);
  if (displayed.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[0.625rem] font-display font-semibold text-amber-400/70 uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="space-y-1.5">
        {displayed.map((item, i) => (
          <UsageBar
            key={showSlot ? `${item.name}-${item.slot ?? ''}` : item.name}
            name={item.name}
            usage={item.usage}
            suffix={showSlot ? item.slot : undefined}
            index={baseIndex + i}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LadderStatsDrawer({ isOpen, onClose }: LadderStatsDrawerProps) {
  const ladderStats = useDesktopStore((state) => state.ladderStats);
  const ladderStatus = useDesktopStore((state) => state.ladderStatus);
  const vizStats = useDesktopStore((state) => state.vizData?.stats);

  // Derive user comparison values
  const userDps = vizStats?.totalBuildDps;
  const userEhp = vizStats?.ehp;
  const userLife = vizStats?.life;

  // Derive subtitle from ladder status
  const subtitle = useMemo(() => {
    if (!ladderStatus) return null;
    const parts: string[] = [];
    if (ladderStatus.skill) parts.push(ladderStatus.skill);
    if (ladderStatus.ascendancy) parts.push(ladderStatus.ascendancy);
    return parts.length > 0 ? parts.join(' \u2022 ') : null;
  }, [ladderStatus]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with amber-tinted blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-40"
            style={{
              background: 'radial-gradient(ellipse at 80% 50%, rgba(251, 191, 36, 0.06) 0%, rgba(0, 0, 0, 0.75) 70%)',
            }}
          />

          {/* Drawer */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed right-0 top-0 h-full w-full max-w-[460px] z-50',
              'overflow-hidden'
            )}
          >
            {/* Background with warm dark gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(180deg,
                    rgba(20, 14, 8, 0.98) 0%,
                    rgba(12, 8, 4, 0.99) 100%
                  )
                `,
              }}
            />

            {/* Decorative border glow - amber */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(251, 191, 36, 0.3) 20%, rgba(251, 191, 36, 0.3) 80%, transparent 100%)',
              }}
            />

            {/* Content wrapper */}
            <div className="relative flex h-full flex-col">
              {/* Header - The Ladder Codex */}
              <div className="flex-shrink-0 border-b border-amber-900/30 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Trophy orb icon */}
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.3) 0%, rgba(180, 83, 9, 0.15) 50%, transparent 70%)',
                          border: '1px solid rgba(251, 191, 36, 0.3)',
                          boxShadow: '0 0 20px rgba(180, 83, 9, 0.2), inset 0 0 15px rgba(251, 191, 36, 0.1)',
                        }}
                      >
                        <Trophy className="w-5 h-5 text-amber-300" />
                      </div>
                      {/* Floating particle */}
                      <motion.div
                        animate={{
                          y: [0, -4, 0],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400/60"
                        style={{ boxShadow: '0 0 6px rgba(251, 191, 36, 0.6)' }}
                      />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-semibold text-amber-100 tracking-wider uppercase">
                        Ladder Benchmarks
                      </h2>
                      {subtitle && (
                        <p className="text-[0.6875rem] text-amber-400/70">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      'rounded-lg p-2 transition-all duration-200',
                      'text-amber-400/60 hover:text-amber-300',
                      'hover:bg-amber-500/10'
                    )}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-fantasy">
                {!ladderStats ? (
                  /* Empty State */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl p-8 text-center mt-12"
                    style={{
                      background: 'linear-gradient(135deg, rgba(180, 83, 9, 0.05) 0%, transparent 100%)',
                      border: '1px solid rgba(180, 83, 9, 0.15)',
                    }}
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-amber-500/10">
                      <Trophy className="w-8 h-8 text-amber-400/40" />
                    </div>
                    <p className="text-sm font-display font-semibold text-amber-300/60">
                      No Ladder Data
                    </p>
                    <p className="text-xs text-amber-400/40 mt-2 max-w-[280px] mx-auto leading-relaxed">
                      Fetch ladder data from the analysis screen to see how your build compares to top players.
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    {/* STAT BENCHMARKS - Range bars */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                        <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
                          Your Build vs Ladder
                        </span>
                      </div>

                      <div className="space-y-5">
                        {ladderStats.benchmarks?.dps && (
                          <BenchmarkRangeBar
                            label="DPS"
                            icon={<Sword className="w-3.5 h-3.5 text-amber-400/70" />}
                            benchmark={ladderStats.benchmarks.dps}
                            userValue={userDps}
                            index={0}
                          />
                        )}
                        {ladderStats.benchmarks?.ehp && (
                          <BenchmarkRangeBar
                            label="EHP"
                            icon={<Shield className="w-3.5 h-3.5 text-amber-400/70" />}
                            benchmark={ladderStats.benchmarks.ehp}
                            userValue={userEhp}
                            index={1}
                          />
                        )}
                        {ladderStats.benchmarks?.life && (
                          <BenchmarkRangeBar
                            label="Life"
                            icon={<Heart className="w-3.5 h-3.5 text-amber-400/70" />}
                            benchmark={ladderStats.benchmarks.life}
                            userValue={userLife}
                            index={2}
                          />
                        )}
                      </div>
                    </motion.div>

                    {/* Ornamental divider */}
                    <div className="relative py-1">
                      <div className="h-px bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />
                      <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(20, 14, 8, 1)',
                          border: '1px solid rgba(180, 83, 9, 0.25)',
                        }}
                      >
                        <BarChart3 className="w-3 h-3 text-amber-500/50" />
                      </div>
                    </div>

                    {/* POPULAR CHOICES - 2x2 Grid */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                        <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
                          Popular Choices
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className="rounded-lg p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, transparent 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.1)',
                          }}
                        >
                          <UsageSection
                            title="Keystones"
                            icon={<Key className="w-3 h-3 text-amber-500/60" />}
                            items={ladderStats.topKeystones ?? []}
                            baseIndex={0}
                          />
                        </div>

                        <div
                          className="rounded-lg p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, transparent 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.1)',
                          }}
                        >
                          <UsageSection
                            title="Uniques"
                            icon={<Sparkles className="w-3 h-3 text-amber-500/60" />}
                            items={ladderStats.topUniques ?? []}
                            showSlot
                            baseIndex={5}
                          />
                        </div>

                        <div
                          className="rounded-lg p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, transparent 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.1)',
                          }}
                        >
                          <UsageSection
                            title="Supports"
                            icon={<Gem className="w-3 h-3 text-amber-500/60" />}
                            items={ladderStats.topSupports ?? []}
                            baseIndex={10}
                          />
                        </div>

                        <div
                          className="rounded-lg p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, transparent 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.1)',
                          }}
                        >
                          <UsageSection
                            title="Auras"
                            icon={<Sparkles className="w-3 h-3 text-amber-500/60" />}
                            items={ladderStats.topAuras ?? []}
                            baseIndex={15}
                          />
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>

              {/* Footer - Data attribution */}
              {ladderStats && (
                <div className="flex-shrink-0 border-t border-amber-900/30 px-5 py-3">
                  <div className="flex items-center justify-between text-[0.625rem] text-slate-500">
                    <span>
                      Data from{' '}
                      <span className="text-amber-400/70 font-medium">
                        {ladderStats.buildCount}
                      </span>
                      {' '}build{ladderStats.buildCount !== 1 ? 's' : ''}
                      {ladderStats.levelRange && (
                        <span className="text-slate-600">
                          {' '}(L{ladderStats.levelRange.min}-{ladderStats.levelRange.max})
                        </span>
                      )}
                      {ladderStatus?.league && (
                        <>
                          {' '}<span className="text-slate-600">|</span>{' '}
                          <span className="text-slate-400">{ladderStatus.league}</span>
                        </>
                      )}
                    </span>
                    {ladderStatus?.fetchedAt && (
                      <span className="text-slate-600">
                        Fetched {formatRelativeTime(ladderStatus.fetchedAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LadderStatsDrawer;
