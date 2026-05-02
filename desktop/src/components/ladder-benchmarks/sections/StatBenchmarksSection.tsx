/**
 * StatBenchmarksSection Component
 *
 * Displays horizontal range bars comparing user stats against ladder
 * benchmarks. Shows DPS, EHP, Life, ES, Armour, and Evasion with
 * min/avg/max ranges and a gem-like glowing user position marker.
 *
 * Part of the Ladder Benchmarks Modal - "The Alchemist's Gauge"
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Sword, Shield, Heart, Sparkles, Layers, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatBenchmark } from '../../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface StatBenchmarksSectionProps {
  statBenchmarks: {
    life: StatBenchmark;
    energyShield: StatBenchmark;
    ehp: StatBenchmark;
    dps: StatBenchmark;
    armour: StatBenchmark;
    evasion: StatBenchmark;
  };
  userStats?: {
    dps?: number;
    ehp?: number;
    life?: number;
    energyShield?: number;
    armour?: number;
    evasion?: number;
  };
  /** Animation stagger delay base (ms) */
  staggerBase?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function getPositionPercent(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
}

// =============================================================================
// Stat Row Config
// =============================================================================

interface StatRowConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  benchmarkKey: keyof StatBenchmarksSectionProps['statBenchmarks'];
  userKey: keyof NonNullable<StatBenchmarksSectionProps['userStats']>;
}

const STAT_ROWS: StatRowConfig[] = [
  {
    key: 'dps',
    label: 'DPS',
    icon: <Sword className="w-3.5 h-3.5 text-amber-400/80" />,
    benchmarkKey: 'dps',
    userKey: 'dps',
  },
  {
    key: 'ehp',
    label: 'EHP',
    icon: <Shield className="w-3.5 h-3.5 text-amber-400/80" />,
    benchmarkKey: 'ehp',
    userKey: 'ehp',
  },
  {
    key: 'life',
    label: 'Life',
    icon: <Heart className="w-3.5 h-3.5 text-red-400/80" />,
    benchmarkKey: 'life',
    userKey: 'life',
  },
  {
    key: 'energyShield',
    label: 'Energy Shield',
    icon: <Sparkles className="w-3.5 h-3.5 text-blue-400/80" />,
    benchmarkKey: 'energyShield',
    userKey: 'energyShield',
  },
  {
    key: 'armour',
    label: 'Armour',
    icon: <Layers className="w-3.5 h-3.5 text-yellow-600/80" />,
    benchmarkKey: 'armour',
    userKey: 'armour',
  },
  {
    key: 'evasion',
    label: 'Evasion',
    icon: <Wind className="w-3.5 h-3.5 text-green-400/80" />,
    benchmarkKey: 'evasion',
    userKey: 'evasion',
  },
];

// =============================================================================
// BenchmarkBar Sub-Component
// =============================================================================

interface BenchmarkBarProps {
  label: string;
  icon: React.ReactNode;
  benchmark: StatBenchmark;
  userValue: number | undefined;
  index: number;
}

function BenchmarkBar({ label, icon, benchmark, userValue, index }: BenchmarkBarProps) {
  // Skip rendering if the benchmark has no meaningful data
  if (benchmark.max <= 0) return null;

  const avgPercent = getPositionPercent(benchmark.avg, benchmark.min, benchmark.max);
  const hasUser = userValue != null && userValue > 0;
  const isAboveAvg = hasUser && userValue >= benchmark.avg;

  // Position user marker: allow going to edges (0%/100%) when out of range
  const userDisplayPercent = hasUser
    ? getPositionPercent(userValue, benchmark.min, benchmark.max)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
      className="space-y-1.5"
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-display font-semibold text-slate-200 uppercase tracking-wider">
            {label}
          </span>
        </div>
        {hasUser && (
          <span
            className={cn(
              'text-[0.625rem] font-semibold px-1.5 py-0.5 rounded',
              isAboveAvg
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-amber-400 bg-amber-500/10'
            )}
          >
            {isAboveAvg ? 'Above Avg' : 'Below Avg'}
          </span>
        )}
      </div>

      {/* "You" label above the bar */}
      {hasUser && userDisplayPercent != null && (
        <div className="relative h-3.5">
          <span
            className={cn(
              'absolute -translate-x-1/2 text-[0.625rem] font-semibold tabular-nums',
              isAboveAvg ? 'text-emerald-400' : 'text-amber-400'
            )}
            style={{
              left: `${Math.max(5, Math.min(95, userDisplayPercent))}%`,
            }}
          >
            You: {formatNumber(userValue)}
          </span>
        </div>
      )}

      {/* Range bar */}
      <div className="relative h-7 rounded-md overflow-hidden bg-slate-900/80 border border-slate-700/30">
        {/* Dark texture background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(90deg,
                rgba(30, 25, 15, 0.6) 0%,
                rgba(50, 40, 20, 0.3) 50%,
                rgba(30, 25, 15, 0.6) 100%
              )
            `,
          }}
        />

        {/* Fill bar from 0 to avg */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${avgPercent}%` }}
          transition={{ delay: 0.2 + index * 0.06, duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0"
          style={{
            background: 'linear-gradient(90deg, rgba(180, 83, 9, 0.15) 0%, rgba(251, 191, 36, 0.12) 100%)',
          }}
        />

        {/* Average marker - vertical line */}
        <div
          className="absolute top-0 bottom-0 w-px z-10"
          style={{
            left: `${avgPercent}%`,
            background: 'rgba(148, 163, 184, 0.5)',
          }}
        />

        {/* User value marker - glowing vertical line */}
        {userDisplayPercent != null && hasUser && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{
              delay: 0.4 + index * 0.08,
              duration: 0.4,
              ease: 'easeOut',
            }}
            className="absolute top-0 bottom-0 z-20"
            style={{
              left: `${userDisplayPercent}%`,
              width: '2px',
              transform: 'translateX(-50%)',
              background: isAboveAvg ? '#34d399' : '#fbbf24',
              boxShadow: isAboveAvg
                ? '0 0 6px rgba(52, 211, 153, 0.8), 0 0 12px rgba(52, 211, 153, 0.4)'
                : '0 0 6px rgba(251, 191, 36, 0.8), 0 0 12px rgba(251, 191, 36, 0.4)',
            }}
          />
        )}
      </div>

      {/* Numbers row - min / avg / max below the bar */}
      <div className="relative h-4 text-[0.625rem]">
        <span className="absolute left-0 text-slate-500 tabular-nums">
          min {formatNumber(benchmark.min)}
        </span>
        <span
          className="absolute -translate-x-1/2 text-slate-400 tabular-nums"
          style={{ left: `${Math.max(8, Math.min(92, avgPercent))}%` }}
        >
          avg {formatNumber(benchmark.avg)}
        </span>
        <span className="absolute right-0 text-slate-500 tabular-nums">
          max {formatNumber(benchmark.max)}
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function StatBenchmarksSectionRaw({
  statBenchmarks,
  userStats,
  staggerBase = 0,
}: StatBenchmarksSectionProps) {
  // Filter to only stats with meaningful data
  const visibleStats = STAT_ROWS.filter(
    (row) => statBenchmarks[row.benchmarkKey].max > 0
  );

  if (visibleStats.length === 0) return null;

  // Split into two columns for desktop layout
  const midpoint = Math.ceil(visibleStats.length / 2);
  const leftColumn = visibleStats.slice(0, midpoint);
  const rightColumn = visibleStats.slice(midpoint);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.4 }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
        <h3 className="text-sm font-display font-semibold text-amber-200 uppercase tracking-wider">
          Stat Benchmarks
        </h3>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-4">
          {leftColumn.map((row, i) => (
            <BenchmarkBar
              key={row.key}
              label={row.label}
              icon={row.icon}
              benchmark={statBenchmarks[row.benchmarkKey]}
              userValue={userStats?.[row.userKey]}
              index={i}
            />
          ))}
        </div>
        <div className="space-y-4">
          {rightColumn.map((row, i) => (
            <BenchmarkBar
              key={row.key}
              label={row.label}
              icon={row.icon}
              benchmark={statBenchmarks[row.benchmarkKey]}
              userValue={userStats?.[row.userKey]}
              index={midpoint + i}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export const StatBenchmarksSection = memo(StatBenchmarksSectionRaw);
