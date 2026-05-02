/**
 * LadderBenchmarksModal Component
 *
 * Full-screen modal displaying all 16 categories of ladder benchmark data,
 * organized by pathway tabs (All / Skills / Gear / Tree). The comprehensive
 * view of how a user's build compares to top ladder players.
 *
 * "The Alchemist's Codex" - Dark fantasy forge aesthetic with amber/gold
 * accents, gem-like data markers, and staggered reveal animations.
 *
 * Features:
 * - Fetches full CachedLadderStats from /api/v1/builds/:id/ladder-stats-full
 * - Four pathway tabs with content filtered to relevant categories
 * - Stat benchmarks with user position markers
 * - Usage lists for all 13 usage categories
 * - Tier analysis cards (Top DPS / Top EHP / Balanced)
 * - Defensive layers visualization
 * - Unique items grouped by equipment slot
 * - Skeleton loading states and error handling
 * - Staggered fade-in animations on open
 */

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Layers,
  Sword,
  Shield,
  TreePine,
  Key,
  Sparkles,
  Gem,
  Music,
  Crown,
  Settings2,
  FlaskConical,
  Diamond,
  Loader2,
  AlertCircle,
  Eye,
  Clock,
  Network,
  Droplets,
  Star,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLadderBenchmarks } from './hooks/useLadderBenchmarks';
import { UsageListSection } from './sections/UsageListSection';
import type { UsageItem } from './sections/UsageListSection';
import { GemSetupBySlotSection } from './sections/GemSetupBySlotSection';
import { SynergiesSection } from './sections/SynergiesSection';
import { TierAnalysisSection } from './sections/TierAnalysisSection';
import { DefensiveLayersSection } from './sections/DefensiveLayersSection';
import { GearBySlotSection } from './sections/GearBySlotSection';
import { ProgressionSection } from './sections/ProgressionSection';
import type { CachedLadderStats, EnrichedStatBenchmarks, ItemUsage, ModUsage, MasteryUsage, JewelBreakdown } from '../../../../shared/types/LadderData';
import type { StatBenchmark } from '../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface LadderConfigGapItem {
  label: string;
  key: string;
  usage: number;
  ladderCount: number;
  buildCount: number;
  reason: string;
  category?: string;
  pathway: 'skills' | 'gear' | 'tree';
  sourceSkill: string | null;
  hasSource: boolean;
  status: 'matched' | 'missing' | 'user_only';
}

interface LadderBenchmarksModalProps {
  buildId: string;
  isOpen: boolean;
  onClose: () => void;
  ladderConfigGaps?: LadderConfigGapItem[];
  /** Main skill name — fallback when build not in sidecar memory */
  skill?: string;
  /** Ascendancy name — fallback when build not in sidecar memory */
  ascendancy?: string;
  /** User's character level — used by the Progression tab for "you are here" */
  userLevel?: number;
  userStats?: {
    dps?: number;
    ehp?: number;
    life?: number;
    energyShield?: number;
    armour?: number;
    evasion?: number;
    blockChance?: number;
    spellBlockChance?: number;
  };
}

type PathwayTab = 'all' | 'skills' | 'gear' | 'tree';

// =============================================================================
// Tab Config
// =============================================================================

interface TabConfig {
  id: PathwayTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'all', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
  { id: 'skills', label: 'Skills', icon: <Gem className="w-4 h-4" /> },
  { id: 'gear', label: 'Gear', icon: <Shield className="w-4 h-4" /> },
  { id: 'tree', label: 'Tree', icon: <TreePine className="w-4 h-4" /> },
];

// =============================================================================
// Helpers
// =============================================================================

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
 * Convert ItemUsage[] to UsageItem[] for UsageListSection
 */
function itemsToUsageItems(items: ItemUsage[]): UsageItem[] {
  return items.map((item) => ({
    name: item.name,
    usage: item.usage,
    slot: item.slot,
  }));
}

/**
 * Convert ModUsage[] to UsageItem[] for UsageListSection
 */
function modsToUsageItems(mods: ModUsage[]): UsageItem[] {
  return mods.map((m) => ({
    name: m.mod,
    usage: m.usage,
    slot: m.slot,
    mod: m.mod,
  }));
}

// =============================================================================
// Enriched Benchmark Helpers
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

interface DamageProfileRow {
  label: string;
  benchmark: StatBenchmark;
  isPercent?: boolean;
}

function getDamageProfileRows(
  enriched: EnrichedStatBenchmarks
): DamageProfileRow[] {
  const dominant = enriched.damageTypeDistribution?.dominant ?? 'mixed';
  const rows: DamageProfileRow[] = [];

  // Full DPS always first
  rows.push({ label: 'Full DPS', benchmark: enriched.dpsBreakdown.fullDps });

  // Adaptive rows based on dominant damage type
  if (dominant === 'chaos' || dominant === 'dot') {
    if (enriched.ailmentDps?.withPoisonDps) {
      rows.push({ label: 'Poison DPS', benchmark: enriched.ailmentDps.withPoisonDps });
    }
    if (enriched.elementalBreakdown?.chaosDotDps) {
      rows.push({ label: 'Chaos DoT', benchmark: enriched.elementalBreakdown.chaosDotDps });
    }
    rows.push({ label: 'DoT DPS', benchmark: enriched.dpsBreakdown.dotDps });
  } else if (dominant === 'fire') {
    if (enriched.ailmentDps?.withIgniteDps) {
      rows.push({ label: 'Ignite DPS', benchmark: enriched.ailmentDps.withIgniteDps });
    }
    if (enriched.elementalBreakdown?.fireDps) {
      rows.push({ label: 'Fire Hit DPS', benchmark: enriched.elementalBreakdown.fireDps });
    }
    if (enriched.elementalBreakdown?.fireDotDps) {
      rows.push({ label: 'Fire DoT', benchmark: enriched.elementalBreakdown.fireDotDps });
    }
  } else if (dominant === 'physical') {
    if (enriched.ailmentDps?.withBleedDps) {
      rows.push({ label: 'Bleed DPS', benchmark: enriched.ailmentDps.withBleedDps });
    }
    if (enriched.elementalBreakdown?.physicalDps) {
      rows.push({ label: 'Phys Hit DPS', benchmark: enriched.elementalBreakdown.physicalDps });
    }
    if (enriched.dpsBreakdown.dotDps.avg > 0) {
      rows.push({ label: 'DoT DPS', benchmark: enriched.dpsBreakdown.dotDps });
    }
  } else if (dominant === 'cold') {
    rows.push({ label: 'Hit DPS', benchmark: enriched.dpsBreakdown.combinedDps });
    if (enriched.elementalBreakdown?.coldDps) {
      rows.push({ label: 'Cold DPS', benchmark: enriched.elementalBreakdown.coldDps });
    }
    if (enriched.dpsBreakdown.dotDps.avg > 0) {
      rows.push({ label: 'DoT DPS', benchmark: enriched.dpsBreakdown.dotDps });
    }
  } else if (dominant === 'lightning') {
    rows.push({ label: 'Hit DPS', benchmark: enriched.dpsBreakdown.combinedDps });
    if (enriched.elementalBreakdown?.lightningDps) {
      rows.push({ label: 'Lightning DPS', benchmark: enriched.elementalBreakdown.lightningDps });
    }
    if (enriched.dpsBreakdown.dotDps.avg > 0) {
      rows.push({ label: 'DoT DPS', benchmark: enriched.dpsBreakdown.dotDps });
    }
  } else {
    // mixed — show generic breakdown
    rows.push({ label: 'Hit DPS', benchmark: enriched.dpsBreakdown.combinedDps });
    if (enriched.dpsBreakdown.dotDps.avg > 0) {
      rows.push({ label: 'DoT DPS', benchmark: enriched.dpsBreakdown.dotDps });
    }
  }

  // Combat stats always at the end
  rows.push(
    { label: 'Crit Chance', benchmark: enriched.offense.critChance, isPercent: true },
    { label: 'Crit Multi', benchmark: enriched.offense.critMultiplier, isPercent: true },
    { label: 'Attack/Cast Speed', benchmark: enriched.offense.speed },
  );

  return rows;
}

interface EnrichedStatRowProps {
  label: string;
  benchmark: StatBenchmark;
  /** Format values as percentage instead of number */
  isPercent?: boolean;
  index: number;
}

function EnrichedStatRow({ label, benchmark, isPercent = false, index }: EnrichedStatRowProps) {
  if (benchmark.max <= 0 && benchmark.avg <= 0) return null;

  const fmt = isPercent ? formatPercent : formatNumber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-baseline justify-between py-1.5 border-b border-slate-800/40 last:border-b-0"
    >
      <span className="text-[0.6875rem] text-slate-400 font-medium">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-amber-200 tabular-nums">
          {fmt(benchmark.avg)}
        </span>
        <span className="text-[0.5625rem] text-slate-600 tabular-nums">
          {fmt(benchmark.min)} - {fmt(benchmark.max)}
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Skeleton Loader
// =============================================================================

function SkeletonBar({ width, delay }: { width: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="h-4 rounded bg-slate-800/60"
      style={{ width }}
    >
      <div
        className="h-full rounded animate-pulse"
        style={{
          background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.05) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(251, 191, 36, 0.05) 100%)',
        }}
      />
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 p-6">
      {/* Stat benchmarks skeleton */}
      <div className="space-y-4">
        <SkeletonBar width="140px" delay={0} />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <SkeletonBar width="80px" delay={0.1 * i} />
                <SkeletonBar width="100%" delay={0.1 * i + 0.05} />
                <div className="flex justify-between">
                  <SkeletonBar width="50px" delay={0.1 * i + 0.1} />
                  <SkeletonBar width="50px" delay={0.1 * i + 0.1} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            {[3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <SkeletonBar width="80px" delay={0.1 * i} />
                <SkeletonBar width="100%" delay={0.1 * i + 0.05} />
                <div className="flex justify-between">
                  <SkeletonBar width="50px" delay={0.1 * i + 0.1} />
                  <SkeletonBar width="50px" delay={0.1 * i + 0.1} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage lists skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((col) => (
          <div
            key={col}
            className="rounded-lg p-4 space-y-3"
            style={{ background: 'rgba(20, 16, 10, 0.3)', border: '1px solid rgba(251, 191, 36, 0.06)' }}
          >
            <SkeletonBar width="100px" delay={0.3 + col * 0.1} />
            {[0, 1, 2, 3, 4].map((row) => (
              <SkeletonBar key={row} width="100%" delay={0.4 + col * 0.1 + row * 0.04} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <div
          className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%)',
            border: '1px solid rgba(251, 191, 36, 0.15)',
          }}
        >
          <Trophy className="w-10 h-10 text-amber-400/30" />
        </div>
        <h3 className="text-base font-display font-semibold text-amber-300/60 mb-2">
          No Ladder Data Available
        </h3>
        <p className="text-sm text-slate-500 max-w-[360px] leading-relaxed">
          Run an analysis with ladder data fetching enabled to see how your build
          compares against top players on the ladder.
        </p>
      </motion.div>
    </div>
  );
}

// =============================================================================
// Error State
// =============================================================================

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-400/60" />
        </div>
        <h3 className="text-sm font-display font-semibold text-red-300/80 mb-2">
          Failed to Load Ladder Data
        </h3>
        <p className="text-xs text-slate-500 max-w-[300px] mb-4">{message}</p>
        <button
          onClick={onRetry}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-medium',
            'bg-amber-500/10 border border-amber-500/30',
            'text-amber-300 hover:bg-amber-500/20',
            'transition-all duration-200'
          )}
        >
          Retry
        </button>
      </motion.div>
    </div>
  );
}

// =============================================================================
// Overview Tab Content
// =============================================================================

interface OverviewTabProps {
  stats: CachedLadderStats;
  userStats?: LadderBenchmarksModalProps['userStats'];
}

const OverviewTab = memo(function OverviewTab({ stats, userStats }: OverviewTabProps) {
  const userDefenses = useMemo(() => {
    if (!userStats) return undefined;
    const map: Record<string, number | undefined> = {};
    if (userStats.armour != null) map['Armour'] = userStats.armour;
    if (userStats.evasion != null) map['Evasion'] = userStats.evasion;
    if (userStats.energyShield != null) map['Energy Shield'] = userStats.energyShield;
    if (userStats.blockChance != null) map['Block'] = userStats.blockChance;
    if (userStats.spellBlockChance != null) map['Spell Block'] = userStats.spellBlockChance;
    return Object.keys(map).length > 0 ? map : undefined;
  }, [userStats]);

  // Build enriched ranges map (min-max from PoB data) keyed by defensive layer name
  const enrichedRanges = useMemo(() => {
    const eb = stats.enrichedBenchmarks;
    if (!eb) return undefined;
    const map: Record<string, StatBenchmark | undefined> = {
      'Block': eb.defenses.blockChance,
      'Spell Block': eb.defenses.spellBlockChance,
      'Spell Suppression': eb.defenses.spellSuppressionChance,
      'Life Regeneration': eb.defenses.lifeRegen,
      'Armour': eb.defenses.armour,
      'Evasion': eb.defenses.evasion,
    };
    return map;
  }, [stats.enrichedBenchmarks]);

  const filteredKeystones = useMemo(() => stats.keystones.filter(k => k.usage > 50), [stats.keystones]);
  const filteredSupports = useMemo(() => stats.supports.filter(s => s.usage > 50), [stats.supports]);
  const filteredAuras = useMemo(() => stats.auras.filter(a => a.usage > 50), [stats.auras]);
  const filteredUniqueItems = useMemo(() => itemsToUsageItems(stats.uniqueItems).filter(i => i.usage > 50), [stats.uniqueItems]);
  const filteredUniqueFlasks = useMemo(() => stats.uniqueFlasks.filter(f => f.usage > 50), [stats.uniqueFlasks]);
  const filteredNotables = useMemo(() => stats.notables.filter(n => n.usage > 50), [stats.notables]);
  const filteredAscendancyNodes = useMemo(() => (stats.ascendancyNodes ?? []).filter(n => n.usage > 50), [stats.ascendancyNodes]);
  const filteredOtherSkills = useMemo(() => (stats.otherSkills ?? []).filter(s => s.usage > 50), [stats.otherSkills]);
  const filteredBloodlines = useMemo(() => (stats.bloodlines ?? []).filter(b => b.usage > 50), [stats.bloodlines]);
  const filteredRareMods = useMemo(() => modsToUsageItems(stats.rareMods ?? []).filter(m => m.usage > 20), [stats.rareMods]);

  const hasAnyPopularChoices = filteredKeystones.length > 0
    || filteredSupports.length > 0
    || filteredAuras.length > 0
    || filteredUniqueItems.length > 0
    || filteredUniqueFlasks.length > 0
    || filteredNotables.length > 0
    || filteredAscendancyNodes.length > 0
    || filteredOtherSkills.length > 0
    || filteredBloodlines.length > 0
    || filteredRareMods.length > 0;

  return (
    <div className="space-y-8">
      {/* Tier Analysis - top of overview for immediate insight */}
      <TierAnalysisSection tierAnalysis={stats.tierAnalysis} staggerBase={0} />

      {/* Co-occurrence synergies — what goes together */}
      {stats.coOccurrence && stats.coOccurrence.length > 0 && (
        <>
          <OrnamentalDivider />
          <SynergiesSection coOccurrence={stats.coOccurrence} />
        </>
      )}

      {/* Popular Choices — items with >50% usage across the ladder */}
      {hasAnyPopularChoices && (
        <>
          <OrnamentalDivider />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
              <h3 className="text-sm font-display font-semibold text-amber-200 uppercase tracking-wider">
                Popular Choices
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAscendancyNodes.length > 0 && (
                <UsageListSection
                  title="Ascendancy"
                  icon={<Star className="w-3 h-3 text-amber-400/60" />}
                  items={filteredAscendancyNodes}
                  maxItems={5}
                  compact
                  staggerBase={50}
                />
              )}
              {filteredKeystones.length > 0 && (
                <UsageListSection
                  title="Keystones"
                  icon={<Key className="w-3 h-3 text-amber-500/60" />}
                  items={filteredKeystones}
                  maxItems={5}
                  compact
                  staggerBase={100}
                />
              )}
              {filteredSupports.length > 0 && (
                <UsageListSection
                  title="Supports"
                  icon={<Gem className="w-3 h-3 text-blue-400/60" />}
                  items={filteredSupports}
                  maxItems={5}
                  compact
                  staggerBase={150}
                />
              )}
              {filteredAuras.length > 0 && (
                <UsageListSection
                  title="Auras"
                  icon={<Music className="w-3 h-3 text-purple-400/60" />}
                  items={filteredAuras}
                  maxItems={5}
                  compact
                  staggerBase={200}
                />
              )}
              {filteredOtherSkills.length > 0 && (
                <UsageListSection
                  title="Other Skills"
                  icon={<Sparkles className="w-3 h-3 text-orange-400/60" />}
                  items={filteredOtherSkills}
                  maxItems={5}
                  compact
                  staggerBase={225}
                />
              )}
              {filteredUniqueItems.length > 0 && (
                <UsageListSection
                  title="Unique Items"
                  icon={<Sparkles className="w-3 h-3 text-amber-400/60" />}
                  items={filteredUniqueItems}
                  maxItems={5}
                  showSlot
                  compact
                  staggerBase={250}
                />
              )}
              {filteredUniqueFlasks.length > 0 && (
                <UsageListSection
                  title="Unique Flasks"
                  icon={<FlaskConical className="w-3 h-3 text-green-400/60" />}
                  items={filteredUniqueFlasks}
                  maxItems={5}
                  compact
                  staggerBase={300}
                />
              )}
              {filteredNotables.length > 0 && (
                <UsageListSection
                  title="Notables"
                  icon={<Diamond className="w-3 h-3 text-yellow-400/60" />}
                  items={filteredNotables}
                  maxItems={5}
                  compact
                  staggerBase={350}
                />
              )}
              {filteredBloodlines.length > 0 && (
                <UsageListSection
                  title="Bloodlines"
                  icon={<Droplets className="w-3 h-3 text-red-400/60" />}
                  items={filteredBloodlines}
                  maxItems={5}
                  compact
                  staggerBase={375}
                />
              )}
              {filteredRareMods.length > 0 && (
                <UsageListSection
                  title="Popular Rare Mods"
                  icon={<Settings2 className="w-3 h-3 text-cyan-400/60" />}
                  items={filteredRareMods}
                  maxItems={5}
                  useMod
                  showSlot
                  compact
                  staggerBase={400}
                />
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Defensive Layers + Damage Profile — side-by-side */}
      <OrnamentalDivider />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Left: Defensive Layers (only show layers used by >30% of builds) */}
        <DefensiveLayersSection
          layers={stats.defensiveLayers.filter(l => l.usage > 30)}
          userDefenses={userDefenses}
          enrichedRanges={enrichedRanges}
          staggerBase={100}
        />

        {/* Right: Damage Profile */}
        {stats.enrichedBenchmarks && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="rounded-lg p-3"
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(15, 12, 8, 0.8) 100%)',
              border: '1px solid rgba(251, 191, 36, 0.18)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sword
                className="w-3.5 h-3.5 text-amber-400"
                style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))' }}
              />
              <span className="text-[0.625rem] font-display font-semibold text-amber-200 uppercase tracking-wider">
                Damage Profile
              </span>
              {stats.enrichedBenchmarks.damageTypeDistribution?.dominant && (
                <span className="ml-auto text-[0.5625rem] text-slate-500 capitalize tabular-nums">
                  {stats.enrichedBenchmarks.damageTypeDistribution.dominant}
                </span>
              )}
            </div>

            <div className="space-y-0">
              {getDamageProfileRows(stats.enrichedBenchmarks).map((row, i) => (
                <EnrichedStatRow
                  key={row.label}
                  label={row.label}
                  benchmark={row.benchmark}
                  isPercent={row.isPercent}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

    </div>
  );
});

// =============================================================================
// Skills Tab Content
// =============================================================================

interface SkillsTabProps {
  stats: CachedLadderStats;
}

const SkillsTab = memo(function SkillsTab({ stats }: SkillsTabProps) {
  const hasOtherSkills = stats.otherSkills && stats.otherSkills.length > 0;
  const hasGemSetup = stats.targetGemLayout && stats.targetGemLayout.length > 0;

  return (
    <div className="space-y-8">
      <div className={cn(
        'grid grid-cols-1 gap-4',
        hasOtherSkills ? 'md:grid-cols-3' : 'md:grid-cols-2'
      )}>
        <UsageListSection
          title="Support Gems"
          icon={<Gem className="w-3 h-3 text-blue-400/60" />}
          items={stats.supports}
          maxItems={15}
          staggerBase={100}
        />
        <UsageListSection
          title="Auras & Reservations"
          icon={<Music className="w-3 h-3 text-purple-400/60" />}
          items={stats.auras}
          maxItems={15}
          staggerBase={150}
        />
        {hasOtherSkills && (
          <UsageListSection
            title="Other Skills"
            icon={<Sparkles className="w-3.5 h-3.5 text-orange-400/60" />}
            items={stats.otherSkills}
            maxItems={15}
            staggerBase={200}
          />
        )}
      </div>

      {hasGemSetup && (
        <GemSetupBySlotSection targetGemLayout={stats.targetGemLayout!} />
      )}
    </div>
  );
});

// =============================================================================
// Jewel Breakdown Section
// =============================================================================

interface JewelBreakdownSectionProps {
  jewelBreakdown: JewelBreakdown;
  flatJewels: ReadonlyArray<UsageItem>;
}

/**
 * Renders categorized jewel data: Watcher's Eye, Timeless, Cluster, and Regular unique jewels.
 * Each category shows conditionally based on usage > 0.
 */
function JewelBreakdownSection({ jewelBreakdown, flatJewels }: JewelBreakdownSectionProps) {
  const { watchersEye, timelessJewels, clusterJewels, regularJewels } = jewelBreakdown;
  const rareJewelMods = jewelBreakdown.rareJewelMods ?? [];
  const abyssJewelMods = jewelBreakdown.abyssJewelMods ?? [];

  // Use regularJewels from breakdown if available, fall back to flat list
  const regularItems: ReadonlyArray<UsageItem> = regularJewels.length > 0
    ? regularJewels
    : flatJewels;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
        <h3 className="text-sm font-display font-semibold text-amber-200 uppercase tracking-wider">
          Jewel Analysis
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Watcher's Eye */}
        {watchersEye.usage > 0 && (
          <UsageListSection
            title="Watcher's Eye"
            icon={
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-sky-400/60" />
                <span className="text-[0.5625rem] text-sky-400/50 tabular-nums font-medium">
                  {Math.round(watchersEye.usage)}%
                </span>
              </div>
            }
            items={modsToUsageItems(watchersEye.mods)}
            maxItems={8}
            useMod
            staggerBase={300}
          />
        )}

        {/* Timeless Jewels */}
        {timelessJewels.usage > 0 && (
          <UsageListSection
            title="Timeless Jewels"
            icon={
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-violet-400/60" />
                <span className="text-[0.5625rem] text-violet-400/50 tabular-nums font-medium">
                  {Math.round(timelessJewels.usage)}%
                </span>
              </div>
            }
            items={timelessJewels.names}
            maxItems={8}
            staggerBase={350}
          />
        )}

        {/* Cluster Jewels */}
        {clusterJewels.usage > 0 && (
          <UsageListSection
            title="Cluster Jewels"
            icon={
              <div className="flex items-center gap-1">
                <Network className="w-3 h-3 text-teal-400/60" />
                <span className="text-[0.5625rem] text-teal-400/50 tabular-nums font-medium">
                  {Math.round(clusterJewels.usage)}%
                </span>
              </div>
            }
            items={clusterJewels.notables}
            maxItems={10}
            staggerBase={400}
          />
        )}

        {/* Regular Unique Jewels */}
        {regularItems.length > 0 && (
          <UsageListSection
            title="Unique Jewels"
            icon={<Gem className="w-3 h-3 text-amber-400/60" />}
            items={regularItems}
            maxItems={10}
            staggerBase={450}
          />
        )}

        {/* Rare Jewel Mods (by base type) */}
        {rareJewelMods.map((entry) => (
          <UsageListSection
            key={`rare-${entry.baseType}`}
            title={entry.baseType}
            icon={
              <div className="flex items-center gap-1">
                <Diamond className="w-3 h-3 text-yellow-400/60" />
                <span className="text-[0.5625rem] text-yellow-400/50 tabular-nums font-medium">
                  {Math.round(entry.usage)}%
                </span>
              </div>
            }
            items={modsToUsageItems(entry.mods)}
            maxItems={8}
            useMod
            staggerBase={500}
          />
        ))}

        {/* Abyss Jewel Mods (by base type) */}
        {abyssJewelMods.map((entry) => (
          <UsageListSection
            key={`abyss-${entry.baseType}`}
            title={entry.baseType}
            icon={
              <div className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-rose-400/60" />
                <span className="text-[0.5625rem] text-rose-400/50 tabular-nums font-medium">
                  {Math.round(entry.usage)}%
                </span>
              </div>
            }
            items={modsToUsageItems(entry.mods)}
            maxItems={8}
            useMod
            staggerBase={550}
          />
        ))}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Gear Tab Content
// =============================================================================

interface GearTabProps {
  stats: CachedLadderStats;
}

const GearTab = memo(function GearTab({ stats }: GearTabProps) {
  return (
    <div className="space-y-8">
      {/* Per-slot gear breakdown: uniques + base types + rare mods */}
      <GearBySlotSection
        uniqueItems={stats.uniqueItems}
        rareMods={stats.rareMods}
        rareBaseTypes={stats.rareBaseTypes}
        buildCount={stats.buildCount}
        slotRarityBreakdown={stats.slotRarityBreakdown}
        uniqueFlasks={stats.uniqueFlasks}
        flaskBaseTypes={stats.flaskBaseTypes}
        flaskMods={stats.flaskMods}
        flaskEnchants={stats.flaskEnchants}
        staggerBase={100}
      />
    </div>
  );
});

// =============================================================================
// Mastery List Section
// =============================================================================

interface MasteryListSectionProps {
  masteries: MasteryUsage[];
  maxItems?: number;
  staggerBase?: number;
}

/**
 * Renders mastery selections with nodeGroup labels and effect descriptions.
 * Different from UsageListSection because masteries have a two-line format
 * (nodeGroup category + effect text) rather than a simple name.
 */
function MasteryListSection({ masteries, maxItems = 15, staggerBase = 0 }: MasteryListSectionProps) {
  const displayItems = useMemo(() => masteries.slice(0, maxItems), [masteries, maxItems]);

  if (masteries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.35 }}
      className="rounded-lg p-3.5"
      style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.03) 0%, rgba(20, 16, 10, 0.6) 100%)',
        border: '1px solid rgba(251, 191, 36, 0.08)',
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-amber-400/60" />
        <span className="font-display font-semibold text-amber-400/80 uppercase tracking-wider text-[0.625rem]">
          Masteries
        </span>
        <span className="text-[0.5625rem] text-slate-600 ml-auto tabular-nums">
          {masteries.length} total
        </span>
      </div>

      {/* Mastery items */}
      <div className="space-y-0 max-h-[380px] overflow-y-auto scrollbar-fantasy">
        {displayItems.map((mastery, i) => (
          <motion.div
            key={`${mastery.nodeGroup}-${mastery.effect}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.025, duration: 0.3 }}
            className="flex items-start gap-2.5 py-1.5"
          >
            {/* Effect text + node group label */}
            <div className="min-w-0 flex-1">
              <span className="text-[0.6875rem] text-slate-300 leading-tight block">
                {mastery.effect}
              </span>
              <span className="text-[0.5625rem] text-slate-600 leading-tight">
                {mastery.nodeGroup}
              </span>
            </div>

            {/* Bar + percentage */}
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <div className="h-[5px] w-28 rounded-full bg-slate-800/70 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(mastery.usage, 100)}%` }}
                  transition={{ delay: 0.15 + i * 0.03, duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, rgba(180, 83, 9, 0.7) 0%, rgba(251, 191, 36, 0.9) 100%)',
                  }}
                />
              </div>
              <span className="text-[0.625rem] text-slate-500 w-8 text-right tabular-nums font-medium">
                {Math.round(mastery.usage)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Tree Tab Content
// =============================================================================

interface TreeTabProps {
  stats: CachedLadderStats;
}

const TreeTab = memo(function TreeTab({ stats }: TreeTabProps) {
  const hasAscendancyNodes = stats.ascendancyNodes != null && stats.ascendancyNodes.length > 0;
  const hasMasteries = stats.masteries != null && stats.masteries.length > 0;
  const hasBloodlines = stats.bloodlines != null && stats.bloodlines.length > 0;
  const jb = stats.jewelBreakdown;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UsageListSection
          title="Keystones"
          icon={<Key className="w-3.5 h-3.5 text-amber-500/60" />}
          items={stats.keystones}
          maxItems={15}
          staggerBase={100}
        />
        {hasAscendancyNodes && (
          <UsageListSection
            title="Ascendancy Nodes"
            icon={<Star className="w-3 h-3 text-amber-400/60" />}
            items={stats.ascendancyNodes}
            maxItems={15}
            staggerBase={120}
          />
        )}
      </div>

      <OrnamentalDivider />

      <div className={cn(
        'grid grid-cols-1 gap-4',
        hasMasteries ? 'md:grid-cols-2' : 'md:grid-cols-1'
      )}>
        <UsageListSection
          title="Notables"
          icon={<Diamond className="w-3 h-3 text-yellow-400/60" />}
          items={stats.notables}
          maxItems={20}
          staggerBase={150}
        />
        {hasMasteries && (
          <MasteryListSection
            masteries={stats.masteries}
            maxItems={15}
            staggerBase={180}
          />
        )}
      </div>

      <OrnamentalDivider />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UsageListSection
          title="Pantheon Major"
          icon={<Crown className="w-3 h-3 text-amber-400/60" />}
          items={stats.pantheonMajor}
          maxItems={8}
          staggerBase={300}
        />
        <UsageListSection
          title="Pantheon Minor"
          icon={<Crown className="w-3 h-3 text-slate-400/60" />}
          items={stats.pantheonMinor}
          maxItems={8}
          staggerBase={350}
        />
        <UsageListSection
          title="Bandit Choice"
          icon={<Sword className="w-3 h-3 text-red-400/60" />}
          items={stats.bandit}
          maxItems={4}
          staggerBase={400}
        />
      </div>

      {hasBloodlines && (
        <>
          <OrnamentalDivider />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UsageListSection
              title="Bloodlines"
              icon={<Droplets className="w-3 h-3 text-red-400/60" />}
              items={stats.bloodlines}
              maxItems={10}
              staggerBase={450}
            />
          </div>
        </>
      )}

      {/* Jewel Breakdown */}
      {jb && (
        <>
          <OrnamentalDivider />
          <JewelBreakdownSection jewelBreakdown={jb} flatJewels={[]} />
        </>
      )}
    </div>
  );
});

// =============================================================================
// Configs Tab Content
// =============================================================================

/** Human-readable category labels and icons */
const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  enemy_condition: { label: 'Enemy Conditions', icon: <Sword className="w-3 h-3 text-red-400/60" /> },
  exposure: { label: 'Exposure', icon: <Sparkles className="w-3 h-3 text-cyan-400/60" /> },
  alt_ailment: { label: 'Alt Ailments', icon: <Sparkles className="w-3 h-3 text-purple-400/60" /> },
  buff: { label: 'Buffs', icon: <Shield className="w-3 h-3 text-blue-400/60" /> },
  charge: { label: 'Charges', icon: <Diamond className="w-3 h-3 text-amber-400/60" /> },
  player_condition: { label: 'Player Conditions', icon: <Crown className="w-3 h-3 text-emerald-400/60" /> },
  multiplier: { label: 'Multipliers', icon: <Layers className="w-3 h-3 text-orange-400/60" /> },
  recently: { label: 'Recently', icon: <Clock className="w-3 h-3 text-slate-400/60" /> },
};

/** Compact config row — shows status indicator + name + usage bar */
function ConfigRow({ item, index }: {
  item: LadderConfigGapItem;
  index: number;
}) {
  const pct = item.buildCount > 0 ? (item.ladderCount / item.buildCount) * 100 : 0;
  const isMatched = item.status === 'matched';
  const isMissing = item.status === 'missing';

  // Bar gradient: emerald for matched, amber for gaps with source, muted for gaps without
  const barGradient = isMatched
    ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.5) 0%, rgba(52, 211, 153, 0.8) 100%)'
    : item.hasSource
      ? 'linear-gradient(90deg, rgba(180, 83, 9, 0.7) 0%, rgba(251, 191, 36, 0.9) 100%)'
      : 'linear-gradient(90deg, rgba(100, 116, 139, 0.4) 0%, rgba(100, 116, 139, 0.6) 100%)';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.3 }}
      className="flex items-center gap-2 py-[3px]"
    >
      {/* Status dot */}
      <div className={cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        isMatched && 'bg-emerald-400/70',
        isMissing && item.hasSource && 'bg-amber-400/70',
        isMissing && !item.hasSource && 'bg-slate-500/50',
      )} />

      {/* Label */}
      <span className={cn(
        'text-[0.625rem] min-w-0 flex-1 leading-tight truncate',
        isMatched ? 'text-slate-300' : 'text-slate-400',
      )} title={item.label}>
        {item.label}
        {item.sourceSkill && (
          <span className="text-slate-600 ml-1 text-[0.5625rem]">
            {isMatched ? 'via' : 'needs'} {item.sourceSkill}
          </span>
        )}
      </span>

      {/* Usage bar + percent */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-14 h-[4px] rounded-full bg-slate-800/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pct, 100)}%` }}
            transition={{ delay: 0.15 + index * 0.03, duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: barGradient }}
          />
        </div>
        <span className="text-[0.5625rem] text-slate-600 w-7 text-right tabular-nums">
          {Math.round(pct)}%
        </span>
      </div>
    </motion.div>
  );
}

interface ConfigsTabProps {
  ladderConfigGaps?: LadderConfigGapItem[];
}

const ConfigsTab = memo(function ConfigsTab({ ladderConfigGaps }: ConfigsTabProps) {
  // Group items by category, keeping matched and missing together
  const { categories, matched, missing, userOnly } = useMemo(() => {
    if (!ladderConfigGaps?.length) return { categories: [], matched: [], missing: [], userOnly: [] as LadderConfigGapItem[] };

    const m: LadderConfigGapItem[] = [];
    const gap: LadderConfigGapItem[] = [];
    const uo: LadderConfigGapItem[] = [];
    const catMap = new Map<string, LadderConfigGapItem[]>();

    for (const item of ladderConfigGaps) {
      if (item.status === 'user_only') {
        uo.push(item);
        continue;
      }
      if (item.status === 'matched') m.push(item);
      else gap.push(item);

      const cat = item.category || 'other';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(item);
    }

    // Sort items within each category: matched first, then by usage desc
    for (const items of catMap.values()) {
      items.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'matched' ? -1 : 1;
        return b.ladderCount - a.ladderCount;
      });
    }

    // Sort categories: those with gaps first, then by total item count
    const cats = [...catMap.entries()]
      .sort(([, a], [, b]) => {
        const aHasGaps = a.some(i => i.status === 'missing');
        const bHasGaps = b.some(i => i.status === 'missing');
        if (aHasGaps !== bHasGaps) return aHasGaps ? -1 : 1;
        return b.length - a.length;
      })
      .map(([key, items]) => ({ key, items }));

    return { categories: cats, matched: m, missing: gap, userOnly: uo };
  }, [ladderConfigGaps]);

  const hasAny = matched.length > 0 || missing.length > 0 || userOnly.length > 0;

  if (!hasAny) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <Settings2 className="w-8 h-8 text-slate-600/40 mb-3" />
        <p className="text-sm text-slate-400 font-medium">Config comparison not yet available</p>
        <p className="text-[0.6875rem] text-slate-600 mt-1 max-w-xs">
          Ladder builds from poe.ninja don't include combat config data. Config alignment analysis is a planned feature.
        </p>
      </motion.div>
    );
  }

  const total = matched.length + missing.length;
  const alignedPct = total > 0 ? (matched.length / total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary strip — alignment ratio + legend */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.04) 0%, rgba(15, 12, 8, 0.5) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.06)',
          }}
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              <span className="text-[0.5625rem] text-slate-500">Active</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              <span className="text-[0.5625rem] text-slate-500">Missing</span>
            </div>
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800/70 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${alignedPct}%` }}
              transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, rgba(52, 211, 153, 0.6) 0%, rgba(52, 211, 153, 0.9) 100%)',
              }}
            />
          </div>
          <span className="text-[0.625rem] tabular-nums font-medium" style={{
            color: alignedPct >= 75 ? 'rgba(52, 211, 153, 0.8)' : alignedPct >= 50 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(248, 113, 113, 0.8)',
          }}>
            {matched.length}/{total}
          </span>
        </motion.div>
      )}

      {/* Info note about config detection */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-[0.5625rem] text-slate-600 leading-relaxed px-1"
      >
        Configs are inferred from skills and gear in each build. Ladder builds
        with the same source skill are assumed to benefit from the same conditions.
      </motion.p>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(({ key, items }, catIdx) => {
          const meta = CATEGORY_META[key] || { label: key, icon: <Settings2 className="w-3 h-3 text-slate-400/60" /> };
          const catMatched = items.filter(i => i.status === 'matched').length;
          const catTotal = items.length;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.05, duration: 0.35 }}
              className="rounded-lg p-2.5"
              style={{
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.03) 0%, rgba(20, 16, 10, 0.6) 100%)',
                border: '1px solid rgba(251, 191, 36, 0.08)',
              }}
            >
              {/* Card header */}
              <div className="flex items-center gap-1.5 mb-1.5">
                {meta.icon}
                <span className="text-[0.5625rem] font-display font-semibold text-amber-400/80 uppercase tracking-wider">
                  {meta.label}
                </span>
                <span className="text-[0.5625rem] tabular-nums ml-auto" style={{
                  color: catMatched === catTotal
                    ? 'rgba(52, 211, 153, 0.6)'
                    : 'rgba(100, 116, 139, 0.5)',
                }}>
                  {catMatched}/{catTotal}
                </span>
              </div>

              {/* Config rows */}
              <div className="space-y-0">
                {items.map((item, i) => (
                  <ConfigRow key={item.key} item={item} index={i} />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* User-only configs — subtle strip below */}
      {userOnly.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="rounded-lg px-2.5 py-2"
          style={{
            background: 'linear-gradient(135deg, rgba(100, 116, 139, 0.04) 0%, rgba(15, 12, 8, 0.3) 100%)',
            border: '1px solid rgba(100, 116, 139, 0.08)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Eye className="w-3 h-3 text-slate-500/60" />
            <span className="text-[0.5625rem] font-display font-semibold text-slate-500/80 uppercase tracking-wider">
              Only in Your Build
            </span>
            <span className="text-[0.5625rem] text-slate-700 ml-auto tabular-nums">
              {userOnly.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {userOnly.map((item, i) => (
              <motion.span
                key={item.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.03, duration: 0.25 }}
                className="text-[0.625rem] text-slate-500 leading-relaxed"
              >
                {item.label}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
});

// =============================================================================
// Ornamental Divider
// =============================================================================

function OrnamentalDivider() {
  return (
    <div className="relative py-2">
      <div className="h-px bg-gradient-to-r from-transparent via-amber-700/25 to-transparent" />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45"
        style={{
          background: 'rgba(251, 191, 36, 0.2)',
          border: '1px solid rgba(251, 191, 36, 0.15)',
        }}
      />
    </div>
  );
}

// =============================================================================
// Main Modal Component
// =============================================================================

function LadderBenchmarksModalRaw({
  buildId,
  isOpen,
  onClose,
  ladderConfigGaps,
  skill,
  ascendancy,
  userLevel,
  userStats,
}: LadderBenchmarksModalProps) {
  const [activeTab, setActiveTab] = useState<PathwayTab>('all');

  // Fetch full ladder data when modal opens
  // Pass skill/ascendancy as fallback when build not in sidecar memory
  const { data, isLoading, error, refetch } = useLadderBenchmarks(buildId, isOpen, { skill, ascendancy });

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('all');
    }
  }, [isOpen]);

  // Derive the stats object
  const stats = data?.stats ?? null;

  // Tab content renderer
  const renderTabContent = useCallback(() => {
    if (isLoading) return <LoadingSkeleton />;
    if (error) return <ErrorState message={error} onRetry={refetch} />;
    if (!stats || !data?.exists) return <EmptyState />;

    switch (activeTab) {
      case 'all':
        return <OverviewTab stats={stats} userStats={userStats} />;
      case 'skills':
        return <SkillsTab stats={stats} />;
      case 'gear':
        return <GearTab stats={stats} />;
      case 'tree':
        return <TreeTab stats={stats} />;
      default:
        return null;
    }
  }, [activeTab, stats, data, userStats, userLevel, ladderConfigGaps, isLoading, error, refetch]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        className="fixed inset-0 z-[60]"
        style={{
          background: `
            radial-gradient(ellipse at 50% 30%, rgba(251, 191, 36, 0.04) 0%, transparent 60%),
            rgba(0, 0, 0, 0.85)
          `,
          backdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed inset-4 md:inset-8 lg:inset-12 z-[61]',
              'flex flex-col overflow-hidden rounded-xl'
            )}
            style={{
              background: `
                linear-gradient(180deg,
                  rgba(18, 14, 10, 0.98) 0%,
                  rgba(12, 9, 6, 0.99) 100%
                )
              `,
              border: '1px solid rgba(251, 191, 36, 0.12)',
              boxShadow: `
                0 0 80px rgba(0, 0, 0, 0.8),
                0 0 40px rgba(251, 191, 36, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.03)
              `,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Ladder Benchmarks"
          >
            {/* ===== Header ===== */}
            <div className="flex-shrink-0 border-b border-amber-900/25 px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Left: title + metadata */}
                <div className="flex items-center gap-4">
                  {/* Trophy orb */}
                  <div className="relative">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.25) 0%, rgba(180, 83, 9, 0.12) 50%, transparent 70%)',
                        border: '1px solid rgba(251, 191, 36, 0.25)',
                        boxShadow: '0 0 24px rgba(180, 83, 9, 0.2), inset 0 0 15px rgba(251, 191, 36, 0.08)',
                      }}
                    >
                      <Trophy className="w-5 h-5 text-amber-300" />
                    </div>
                    {/* Floating particle — CSS animation to avoid blocking AnimatePresence exit */}
                    <div
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400/50 animate-pulse"
                      style={{ boxShadow: '0 0 6px rgba(251, 191, 36, 0.5)' }}
                    />
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-semibold text-amber-100 tracking-wider uppercase">
                      Ladder Benchmarks
                    </h2>
                    {data && (
                      <p className="text-[0.6875rem] text-amber-400/60 mt-0.5">
                        {data.skill && data.ascendancy
                          ? `${data.skill} \u2022 ${data.ascendancy}`
                          : 'Loading...'}
                        {data.league && (
                          <span className="text-slate-600 ml-2">{data.league}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: metadata + close */}
                <div className="flex items-center gap-4">
                  {data?.buildCount != null && (
                    <span className="text-xs text-slate-500">
                      <span className="text-amber-400/70 font-medium">{data.buildCount}</span>
                      {' '}builds analyzed
                      {data.levelRange && (
                        <span className="text-slate-600">
                          {' '}(L{data.levelRange.min}-{data.levelRange.max})
                        </span>
                      )}
                    </span>
                  )}
                  {data?.fetchedAt && (
                    <span className="text-[0.625rem] text-slate-600">
                      {formatRelativeTime(data.fetchedAt)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      'rounded-lg p-2.5 transition-all duration-200',
                      'text-amber-400/50 hover:text-amber-300',
                      'hover:bg-amber-500/10'
                    )}
                    aria-label="Close ladder benchmarks"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* ===== Tab Bar ===== */}
              <div className="flex gap-1 mt-4">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-medium',
                      'transition-all duration-200',
                      activeTab === tab.id
                        ? 'text-amber-200 bg-amber-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                    )}
                  >
                    <span className={cn(
                      'transition-colors',
                      activeTab === tab.id ? 'text-amber-400' : 'text-slate-600'
                    )}>
                      {tab.icon}
                    </span>
                    {tab.label}

                    {/* Active tab indicator */}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="ladder-tab-indicator"
                        className="absolute bottom-0 left-2 right-2 h-0.5"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.5) 50%, transparent 100%)',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ===== Scrollable Content ===== */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-fantasy">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderTabContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ===== Footer ===== */}
            {stats && (
              <div className="flex-shrink-0 border-t border-amber-900/20 px-6 py-3">
                <div className="flex items-center justify-between text-[0.625rem] text-slate-600">
                  <span>
                    Data from{' '}
                    <span className="text-amber-400/60 font-medium">{stats.buildCount}</span>
                    {' '}ladder builds
                    {data?.levelRange && (
                      <span className="text-slate-600">
                        {' '}(L{data.levelRange.min}-{data.levelRange.max})
                      </span>
                    )}
                    {data?.league && (
                      <>
                        {' '}<span className="text-slate-700">|</span>{' '}
                        <span className="text-slate-500">{data.league}</span>
                      </>
                    )}
                  </span>
                  <a
                    href={
                      data?.league
                        ? `https://poe.ninja/poe1/builds?league=${encodeURIComponent(data.league)}`
                        : 'https://poe.ninja/poe1/builds'
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ladder data sourced from poe.ninja"
                    className="text-slate-600 hover:text-amber-400/70 transition-colors underline decoration-dotted underline-offset-2"
                  >
                    Source: poe.ninja
                  </a>
                </div>
              </div>
            )}
      </motion.div>
    </>
  );
}

export const LadderBenchmarksModal = memo(LadderBenchmarksModalRaw);
