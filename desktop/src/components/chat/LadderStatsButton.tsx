/**
 * LadderStatsButton Component
 *
 * Small icon button shown in the WelcomeHeader when ladder data EXISTS.
 * Toggles an expandable panel showing ladder benchmarks and popular choices.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LadderStatsSummary } from '../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface LadderStatsButtonProps {
  buildCount: number;
  stats: LadderStatsSummary;
  userDps?: number;
  userEhp?: number;
  userLife?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function getComparisonText(userValue: number, benchmark: { avg: number; min: number; max: number }): string {
  if (userValue >= benchmark.max) return 'top of ladder';
  if (userValue >= benchmark.avg) return 'above average';
  if (userValue >= benchmark.min) return 'below average';
  return 'below ladder minimum';
}

function getComparisonColor(userValue: number, benchmark: { avg: number; min: number; max: number }): string {
  if (userValue >= benchmark.avg) return 'text-emerald-400';
  return 'text-amber-400';
}

// =============================================================================
// Sub-Components
// =============================================================================

function BenchmarkRow({
  label,
  benchmark,
  userValue,
}: {
  label: string;
  benchmark?: { avg: number; min: number; max: number };
  userValue?: number;
}) {
  if (!benchmark) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <div className="flex items-center gap-3 text-slate-300">
          <span>
            <span className="text-slate-400 mr-1">avg</span>
            {formatNumber(benchmark.avg)}
          </span>
          <span>
            <span className="text-slate-400 mr-1">min</span>
            {formatNumber(benchmark.min)}
          </span>
          <span>
            <span className="text-slate-400 mr-1">max</span>
            {formatNumber(benchmark.max)}
          </span>
        </div>
      </div>
      {userValue != null && (
        <p className="text-[0.6875rem]">
          <span className="text-slate-400">Your build: </span>
          <span className={getComparisonColor(userValue, benchmark)}>
            {formatNumber(userValue)} — {getComparisonText(userValue, benchmark)}
          </span>
        </p>
      )}
    </div>
  );
}

function UsageBar({ name, usage, suffix }: { name: string; usage: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.6875rem] text-slate-300 truncate min-w-0 flex-1">
        {name}
        {suffix && <span className="text-slate-500 ml-1">({suffix})</span>}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-16 h-[3px] rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(usage, 100)}%`,
              background: 'linear-gradient(90deg, rgba(180, 83, 9, 0.6) 0%, rgba(251, 191, 36, 0.8) 100%)',
            }}
          />
        </div>
        <span className="text-[0.625rem] text-slate-400 w-8 text-right">{Math.round(usage)}%</span>
      </div>
    </div>
  );
}

function UsageSection({
  title,
  items,
  getKey,
  getName,
  getUsage,
  getSuffix,
}: {
  title: string;
  items: Array<{ name: string; usage: number; slot?: string }>;
  getKey: (item: { name: string; usage: number; slot?: string }) => string;
  getName: (item: { name: string; usage: number; slot?: string }) => string;
  getUsage: (item: { name: string; usage: number; slot?: string }) => number;
  getSuffix?: (item: { name: string; usage: number; slot?: string }) => string | undefined;
}) {
  const displayed = items.slice(0, 5);
  if (displayed.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-[0.625rem] font-display font-semibold text-slate-400 uppercase tracking-wider">
        {title}
      </span>
      {displayed.map((item) => (
        <UsageBar
          key={getKey(item)}
          name={getName(item)}
          usage={getUsage(item)}
          suffix={getSuffix?.(item)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LadderStatsButton({
  buildCount,
  stats,
  userDps,
  userEhp,
  userLife,
}: LadderStatsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'group flex items-center gap-1.5 px-2.5 py-1 rounded',
          'bg-amber-500/10 border border-amber-500/30',
          'hover:bg-amber-500/20 hover:border-amber-500/40',
          'transition-all duration-200'
        )}
        title={`View Ladder Stats (${buildCount} builds)`}
      >
        <Trophy className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs text-amber-300 font-medium">{buildCount}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-amber-400/60 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Expandable panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[360px] overflow-hidden"
          >
            <div className="card-forge rounded-lg border border-slate-700/50 p-4 space-y-4 shadow-2xl shadow-black/60">
              {/* Header */}
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-display font-semibold text-slate-300 uppercase tracking-wider">
                  Ladder Benchmarks
                </span>
                <span className="text-[0.625rem] text-slate-400 ml-auto">
                  {buildCount} builds
                </span>
              </div>

              {/* Benchmarks */}
              <div className="space-y-3">
                <BenchmarkRow
                  label="DPS"
                  benchmark={stats.benchmarks?.dps}
                  userValue={userDps}
                />
                <BenchmarkRow
                  label="EHP"
                  benchmark={stats.benchmarks?.ehp}
                  userValue={userEhp}
                />
                <BenchmarkRow
                  label="Life"
                  benchmark={stats.benchmarks?.life}
                  userValue={userLife}
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

              {/* Popular Choices */}
              <div className="space-y-3">
                <span className="text-[0.625rem] font-display font-semibold text-slate-400 uppercase tracking-wider">
                  Popular Choices
                </span>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <UsageSection
                    title="Keystones"
                    items={stats.topKeystones}
                    getKey={(item) => item.name}
                    getName={(item) => item.name}
                    getUsage={(item) => item.usage}
                  />
                  <UsageSection
                    title="Uniques"
                    items={stats.topUniques}
                    getKey={(item) => `${item.name}-${item.slot ?? ''}`}
                    getName={(item) => item.name}
                    getUsage={(item) => item.usage}
                    getSuffix={(item) => item.slot}
                  />
                  <UsageSection
                    title="Supports"
                    items={stats.topSupports}
                    getKey={(item) => item.name}
                    getName={(item) => item.name}
                    getUsage={(item) => item.usage}
                  />
                  <UsageSection
                    title="Auras"
                    items={stats.topAuras}
                    getKey={(item) => item.name}
                    getName={(item) => item.name}
                    getUsage={(item) => item.usage}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
