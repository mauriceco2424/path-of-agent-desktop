/**
 * TierAnalysisSection Component
 *
 * Expandable cards showing top DPS / top EHP / balanced tier analysis.
 * Each card displays build count, averaged stats, and key differences
 * with delta highlighting (green positive, red negative).
 *
 * Part of the Ladder Benchmarks Modal - "The Crucible Tiers"
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Sword, Shield, Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TierData, KeyDifference } from '../../../../../shared/types/LadderData';

// Re-export for type safety — TierData comes from CachedLadderStats
// via the shared types, not directly from the analyzer

// =============================================================================
// Types
// =============================================================================

interface TierAnalysisSectionProps {
  tierAnalysis: {
    topDps: TierData;
    topEhp: TierData;
    balanced: TierData;
  };
  /** Animation stagger delay base (ms) */
  staggerBase?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${Math.round(delta)}%`;
}

function getCategoryLabel(cat: KeyDifference['category']): string {
  switch (cat) {
    case 'keystone': return 'Keystone';
    case 'unique': return 'Unique';
    case 'mod': return 'Mod';
    case 'aura': return 'Aura';
    default: return cat;
  }
}

// =============================================================================
// Tier Card Config
// =============================================================================

interface TierCardConfig {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  glowColor: string;
  borderColor: string;
}

const TIER_CONFIGS: TierCardConfig[] = [
  {
    key: 'topDps',
    title: 'Top DPS',
    subtitle: 'Top 20% by damage',
    icon: <Sword className="w-4 h-4" />,
    accentColor: 'text-orange-400',
    glowColor: 'rgba(251, 146, 60, 0.15)',
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  {
    key: 'topEhp',
    title: 'Top EHP',
    subtitle: 'Top 20% by survivability',
    icon: <Shield className="w-4 h-4" />,
    accentColor: 'text-cyan-400',
    glowColor: 'rgba(34, 211, 238, 0.15)',
    borderColor: 'rgba(34, 211, 238, 0.2)',
  },
  {
    key: 'balanced',
    title: 'Balanced',
    subtitle: 'Above median DPS + EHP',
    icon: <Scale className="w-4 h-4" />,
    accentColor: 'text-emerald-400',
    glowColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
];

// =============================================================================
// Difference Row Sub-Component
// =============================================================================

interface DifferenceRowProps {
  diff: KeyDifference;
  index: number;
}

function DifferenceRow({ diff, index }: DifferenceRowProps) {
  const isPositive = diff.delta > 0;
  const tierPct = Math.min(Math.round(diff.tierUsage), 100);
  const overallPct = Math.min(Math.round(diff.overallUsage), 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="py-1.5"
    >
      {/* Top row: name + category + usage comparison */}
      <div className="flex items-center gap-2 mb-1">
        {isPositive ? (
          <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" />
        )}
        <span className="text-[0.6875rem] text-slate-300 leading-tight min-w-0 flex-1 truncate">
          {diff.name}
          <span className="text-[0.5625rem] text-slate-600 ml-1.5">
            {getCategoryLabel(diff.category)}
          </span>
        </span>
        {/* Tier vs overall usage text */}
        <span className="text-[0.625rem] tabular-nums flex-shrink-0 flex items-center gap-1">
          <span className={cn(
            'font-semibold',
            isPositive ? 'text-emerald-400' : 'text-red-400'
          )}>
            {tierPct}%
          </span>
          <span className="text-slate-600">vs</span>
          <span className="text-slate-500">{overallPct}%</span>
        </span>
      </div>

      {/* Comparison bar: overall (dim) with tier overlay */}
      <div className="flex items-center gap-2 pl-5">
        <div className="relative h-[4px] flex-1 rounded-full bg-slate-800/70 overflow-hidden">
          {/* Overall usage (dim background bar) */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-slate-600/30"
            style={{ width: `${overallPct}%` }}
          />
          {/* Tier usage (colored foreground bar) */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${tierPct}%` }}
            transition={{ delay: 0.1 + index * 0.03, duration: 0.4, ease: 'easeOut' }}
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              isPositive
                ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-400/80'
                : 'bg-gradient-to-r from-red-500/50 to-red-400/70'
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Tier Card Sub-Component
// =============================================================================

interface TierCardProps {
  config: TierCardConfig;
  data: TierData;
  index: number;
}

function TierCard({ config, data, index }: TierCardProps) {
  if (data.buildCount === 0) return null;

  const maxDifferences = 8;
  const differences = data.keyDifferences.slice(0, maxDifferences);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
      className="rounded-lg overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${config.glowColor} 0%, rgba(15, 12, 8, 0.8) 100%)`,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-3.5">
        {/* Icon */}
        <div
          className={cn('flex-shrink-0', config.accentColor)}
          style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
        >
          {config.icon}
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-display font-semibold', config.accentColor)}>
            {config.title}
          </h4>
          <p className="text-[0.625rem] text-slate-500">{config.subtitle}</p>
        </div>

        {/* Build count badge */}
        <span className="text-[0.625rem] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded tabular-nums">
          {data.buildCount} builds
        </span>
      </div>

      {/* Stat summary */}
      <div className="px-3.5 pb-2 flex items-center gap-4">
        <StatPill label="DPS" value={formatNumber(data.stats.dpsAvg)} />
        <StatPill label="EHP" value={formatNumber(data.stats.ehpAvg)} />
        <StatPill label="Life" value={formatNumber(data.stats.lifeAvg)} />
      </div>

      {/* Differences list (always visible) */}
      {differences.length > 0 && (
        <div className="px-3.5 pb-3.5 border-t border-slate-700/20 pt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[0.5625rem] font-display font-semibold text-slate-500 uppercase tracking-wider">
              Usage in Tier vs Ladder Average
            </span>
          </div>
          <div className="space-y-0">
            {differences.map((diff, i) => (
              <DifferenceRow
                key={`${diff.category}-${diff.name}-${i}`}
                diff={diff}
                index={i}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// Stat Pill Sub-Component
// =============================================================================

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[0.5625rem] text-slate-600 uppercase">{label}</span>
      <span className="text-[0.6875rem] text-slate-300 font-medium tabular-nums">{value}</span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function TierAnalysisSectionRaw({
  tierAnalysis,
  staggerBase = 0,
}: TierAnalysisSectionProps) {
  const tiers: Array<{ config: TierCardConfig; data: TierData }> = [
    { config: TIER_CONFIGS[0], data: tierAnalysis.topDps },
    { config: TIER_CONFIGS[1], data: tierAnalysis.topEhp },
    { config: TIER_CONFIGS[2], data: tierAnalysis.balanced },
  ];

  // Check if any tier has data
  const hasData = tiers.some((t) => t.data.buildCount > 0);
  if (!hasData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.4 }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-orange-400 to-cyan-500" />
        <h3 className="text-sm font-display font-semibold text-amber-200 uppercase tracking-wider">
          Tier Analysis
        </h3>
      </div>

      {/* Tier cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {tiers.map((tier, i) => (
          <TierCard
            key={tier.config.key}
            config={tier.config}
            data={tier.data}
            index={i}
          />
        ))}
      </div>
    </motion.div>
  );
}

export const TierAnalysisSection = memo(TierAnalysisSectionRaw);
