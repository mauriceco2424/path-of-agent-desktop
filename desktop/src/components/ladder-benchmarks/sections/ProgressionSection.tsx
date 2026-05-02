/**
 * ProgressionSection Component
 *
 * Shows how builds of this archetype evolve across three level tiers:
 * Early Mapping (L70-84) → Endgame (L85-94) → Aspirational (L95-100).
 *
 * Renders:
 *   1. Three tier cards with DPS/EHP targets + "you are here" marker
 *   2. Core items (stable across tiers — the build's foundation)
 *   3. Transition cards (key gear/gem/tree changes between tiers)
 *
 * Part of the Ladder Benchmarks Modal — new "Progression" tab.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Anchor, ArrowRight, Plus, Minus } from 'lucide-react';
import type {
  ProgressionData,
  ProgressionTier,
  ProgressionTransition,
  ProgressionChange,
} from '../../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface ProgressionSectionProps {
  progressionData: ProgressionData;
  /** User's current level — determines which tier is highlighted */
  userLevel?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function levelToTier(level: number | undefined): ProgressionTier | null {
  if (!level) return null;
  if (level <= 84) return 'early_mapping';
  if (level <= 94) return 'endgame';
  return 'aspirational';
}

// Tier configuration with Onyx Gold color tokens
const TIER_CONFIG: Record<ProgressionTier, {
  label: string;
  levelRange: string;
  description: string;
  accent: string;
  accentSoft: string;
  borderActive: string;
  bgActive: string;
  glow: string;
}> = {
  early_mapping: {
    label: 'Early Mapping',
    levelRange: 'L70–84',
    description: 'First maps, budget gear',
    accent: '#fbbf24',
    accentSoft: 'rgba(251, 191, 36, 0.8)',
    borderActive: 'rgba(251, 191, 36, 0.45)',
    bgActive: 'rgba(251, 191, 36, 0.08)',
    glow: 'rgba(251, 191, 36, 0.25)',
  },
  endgame: {
    label: 'Endgame',
    levelRange: 'L85–94',
    description: 'Atlas, red maps',
    accent: '#34d399',
    accentSoft: 'rgba(52, 211, 153, 0.8)',
    borderActive: 'rgba(52, 211, 153, 0.45)',
    bgActive: 'rgba(52, 211, 153, 0.08)',
    glow: 'rgba(52, 211, 153, 0.25)',
  },
  aspirational: {
    label: 'Aspirational',
    levelRange: 'L95–100',
    description: 'Min-max, mirror tier',
    accent: '#a78bfa',
    accentSoft: 'rgba(167, 139, 250, 0.8)',
    borderActive: 'rgba(167, 139, 250, 0.45)',
    bgActive: 'rgba(167, 139, 250, 0.08)',
    glow: 'rgba(167, 139, 250, 0.25)',
  },
};

const TIER_ORDER: ProgressionTier[] = ['early_mapping', 'endgame', 'aspirational'];

// =============================================================================
// Sub-Components
// =============================================================================

interface TierCardProps {
  tier: ProgressionTier;
  dps?: number;
  ehp?: number;
  buildCount?: number;
  isCurrent: boolean;
  delay: number;
}

const TierCard = memo(function TierCard({ tier, dps, ehp, buildCount, isCurrent, delay }: TierCardProps) {
  const config = TIER_CONFIG[tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className="relative flex-1 min-w-0 rounded-xl overflow-hidden"
      style={{
        background: isCurrent
          ? `linear-gradient(160deg, ${config.bgActive} 0%, rgba(2,6,23,0.94) 40%, rgba(8,15,35,0.96) 100%)`
          : 'linear-gradient(160deg, rgba(2,6,23,0.88) 0%, rgba(15,23,42,0.84) 40%, rgba(8,15,35,0.90) 100%)',
        border: isCurrent
          ? `1px solid ${config.borderActive}`
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isCurrent
          ? `0 12px 32px rgba(0,0,0,0.45), 0 0 32px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
          : '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 8%, ${config.accent}44 25%, ${config.accent}${isCurrent ? 'cc' : '88'} 50%, ${config.accent}44 75%, transparent 92%)`,
        }}
      />

      {/* Radial spotlight (only for current tier) */}
      {isCurrent && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 40% at 50% -5%, ${config.accent}15 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 p-5">
        {/* "You are here" marker */}
        {isCurrent && (
          <div
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-b-md text-[0.5625rem] font-display font-semibold tracking-[0.15em] uppercase"
            style={{
              color: config.accent,
              background: `${config.bgActive}`,
              border: `1px solid ${config.borderActive}`,
              borderTop: 'none',
              textShadow: `0 0 8px ${config.glow}`,
            }}
          >
            You are here
          </div>
        )}

        <div className="flex items-start justify-between mb-4" style={{ marginTop: isCurrent ? 8 : 0 }}>
          <div>
            <div
              className="text-[0.75rem] font-display font-semibold tracking-[0.12em] uppercase"
              style={{
                color: config.accent,
                textShadow: isCurrent ? `0 0 10px ${config.glow}` : undefined,
              }}
            >
              {config.label}
            </div>
            <div className="text-[0.625rem] text-slate-400 font-mono mt-0.5">{config.levelRange}</div>
          </div>
          {buildCount != null && buildCount > 0 && (
            <div className="text-right">
              <div className="text-[0.6875rem] font-mono text-slate-300">{buildCount}</div>
              <div className="text-[0.5rem] text-slate-500 uppercase tracking-wider">builds</div>
            </div>
          )}
        </div>

        <div className="text-[0.625rem] text-slate-500 mb-4">{config.description}</div>

        {/* DPS / EHP trajectory */}
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[0.5625rem] font-display uppercase tracking-[0.1em] text-amber-400/70">DPS Target</span>
            </div>
            <div className="font-mono text-lg text-amber-300" style={{ textShadow: '0 0 8px rgba(251,191,36,0.3)' }}>
              {dps ? formatNumber(dps) : '—'}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[0.5625rem] font-display uppercase tracking-[0.1em] text-emerald-400/70">EHP Target</span>
            </div>
            <div className="font-mono text-lg text-emerald-300" style={{ textShadow: '0 0 8px rgba(52,211,153,0.3)' }}>
              {ehp ? formatNumber(ehp) : '—'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// =============================================================================
// Transition Card
// =============================================================================

interface TransitionCardProps {
  transition: ProgressionTransition;
  delay: number;
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'uniques': return 'Unique';
    case 'supports': return 'Support';
    case 'auras': return 'Aura';
    case 'keystones': return 'Keystone';
    case 'notables': return 'Notable';
    case 'ascNodes': return 'Ascendancy';
    default: return cat;
  }
}

const TransitionCard = memo(function TransitionCard({ transition, delay }: TransitionCardProps) {
  const fromConfig = TIER_CONFIG[transition.from];
  const toConfig = TIER_CONFIG[transition.to];

  // Top 4 items in each direction
  const appearing = transition.appearing.slice(0, 4);
  const fading = transition.fading.slice(0, 3);

  const dpsGrowth = transition.statGrowth.combinedDps?.growthPct;
  const ehpGrowth = transition.statGrowth.ehp?.growthPct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.88) 50%, rgba(8,15,35,0.92) 100%)',
        border: '1px solid rgba(251,191,36,0.10)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Gradient header bar — from tier color to next tier color */}
      <div
        className="h-px"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${fromConfig.accent}aa 25%, ${toConfig.accent}aa 75%, transparent 95%)`,
        }}
      />

      <div className="p-4">
        {/* Header: From → To */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[0.6875rem] font-display font-semibold tracking-[0.1em] uppercase"
            style={{ color: fromConfig.accent }}
          >
            {fromConfig.label}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span
            className="text-[0.6875rem] font-display font-semibold tracking-[0.1em] uppercase"
            style={{ color: toConfig.accent }}
          >
            {toConfig.label}
          </span>

          {/* Stat growth pills */}
          <div className="ml-auto flex items-center gap-2">
            {dpsGrowth != null && dpsGrowth > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[0.5625rem] font-mono font-semibold"
                style={{
                  color: '#fbbf24',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.22)',
                }}
              >
                +{dpsGrowth}% DPS
              </span>
            )}
            {ehpGrowth != null && ehpGrowth > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[0.5625rem] font-mono font-semibold"
                style={{
                  color: '#34d399',
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.22)',
                }}
              >
                +{ehpGrowth}% EHP
              </span>
            )}
          </div>
        </div>

        {/* Two columns: Appearing (+) and Fading (-) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            {appearing.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span className="text-[0.5625rem] font-display uppercase tracking-[0.12em] text-emerald-400/80 font-semibold">
                    Pick up
                  </span>
                </div>
                <div className="space-y-1.5">
                  {appearing.map((item: ProgressionChange) => (
                    <div key={`app-${item.name}`} className="flex items-start gap-2">
                      <div
                        className="w-0.5 self-stretch rounded-full mt-0.5 flex-shrink-0"
                        style={{ background: 'linear-gradient(180deg, #34d399, #10b98144)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] text-slate-100 truncate">{item.name}</div>
                        <div className="text-[0.5625rem] text-slate-500">{categoryLabel(item.category)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            {fading.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Minus className="w-3 h-3 text-red-400" />
                  <span className="text-[0.5625rem] font-display uppercase tracking-[0.12em] text-red-400/80 font-semibold">
                    Drop
                  </span>
                </div>
                <div className="space-y-1.5">
                  {fading.map((item: ProgressionChange) => (
                    <div key={`fade-${item.name}`} className="flex items-start gap-2">
                      <div
                        className="w-0.5 self-stretch rounded-full mt-0.5 flex-shrink-0"
                        style={{ background: 'linear-gradient(180deg, #f87171, #dc262644)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] text-slate-300 truncate">{item.name}</div>
                        <div className="text-[0.5625rem] text-slate-500">{categoryLabel(item.category)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// =============================================================================
// Core Items Strip
// =============================================================================

interface CoreItemsStripProps {
  coreItems: ProgressionData['coreVsTransitional']['core'];
}

const CoreItemsStrip = memo(function CoreItemsStrip({ coreItems }: CoreItemsStripProps) {
  const top = coreItems.slice(0, 10);

  if (top.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25, ease: 'easeOut' }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.88) 50%, rgba(8,15,35,0.92) 100%)',
        border: '1px solid rgba(251,191,36,0.12)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div
        className="h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 10%, rgba(251,191,36,0.35) 50%, transparent 90%)',
        }}
      />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-3.5 h-3.5 text-amber-400/80" />
          <span className="text-[0.6875rem] font-display font-semibold tracking-[0.15em] uppercase text-amber-400/85">
            Build Foundation
          </span>
          <span className="text-[0.5625rem] text-slate-500">— stable across all tiers</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {top.map((item) => (
            <span
              key={item.name}
              className="px-2 py-1 rounded text-[0.6875rem] text-amber-100"
              style={{
                background: 'rgba(251,191,36,0.05)',
                border: '1px solid rgba(251,191,36,0.18)',
              }}
            >
              {item.name}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const ProgressionSection = memo(function ProgressionSection({
  progressionData,
  userLevel,
}: ProgressionSectionProps) {
  const currentTier = levelToTier(userLevel);
  const { tierData, transitions, coreVsTransitional } = progressionData;

  // Guard: need at least one tier of data to render anything meaningful
  const tiersWithData = TIER_ORDER.filter((t) => tierData[t] != null);
  if (tiersWithData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        No progression data available for this build archetype.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-3"
      >
        <TrendingUp className="w-4 h-4 text-amber-400" />
        <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          Build Progression
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-transparent" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="text-[0.75rem] text-slate-400 leading-relaxed max-w-3xl"
      >
        How players of this same build typically scale their character. The three cards below show where the build goes —
        pick up upgrades from the tier ahead of you, plan your transitions, and keep an eye on what the endgame looks like.
      </motion.p>

      {/* Three tier cards side by side */}
      <div className="flex gap-3 items-stretch">
        {TIER_ORDER.map((tier, idx) => {
          const td = tierData[tier];
          return (
            <TierCard
              key={tier}
              tier={tier}
              dps={td?.stats.combinedDps?.median}
              ehp={td?.stats.ehp?.median}
              buildCount={td?.buildCount}
              isCurrent={currentTier === tier}
              delay={0.05 + idx * 0.08}
            />
          );
        })}
      </div>

      {/* Core items strip */}
      {coreVsTransitional.core.length > 0 && (
        <CoreItemsStrip coreItems={coreVsTransitional.core} />
      )}

      {/* Transition cards */}
      {transitions.length > 0 && (
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex items-center gap-2"
          >
            <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.15em] text-slate-300/80">
              Key Transitions
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-500/30 via-slate-500/10 to-transparent" />
          </motion.div>

          {transitions.map((t, idx) => (
            <TransitionCard key={`${t.from}-${t.to}`} transition={t} delay={0.35 + idx * 0.08} />
          ))}
        </div>
      )}
    </div>
  );
});
