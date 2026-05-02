/**
 * BuildHeroSection Component - Build Header Display
 *
 * Displays the hero section for a build with:
 * - Ascendancy badge with glow effect
 * - Build name with golden text
 * - Main skill pill
 * - Tags row (league-starter, budget, mapper, etc.)
 * - Difficulty stars and budget tier (right side)
 *
 * @module desktop/src/components/build-library/BuildHeroSection
 */

import { motion } from 'framer-motion';
import { Star, GitBranch } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Ascendancy, BudgetTier, Difficulty, ContentTag } from '../../../../shared/types/builds';

// ============================================
// Types
// ============================================

export interface BuildHeroSectionProps {
  name: string;
  ascendancy: Ascendancy;
  mainSkill: string;
  concept: string;
  tags: ContentTag[];
  difficulty: Difficulty;
  budgetTier: BudgetTier;
  leagueVersion?: string;
  onExploreVariations?: () => void;
}

// ============================================
// Configuration
// ============================================

const ascendancyColors: Record<Ascendancy, { bg: string; text: string; border: string; glow: string }> = {
  Juggernaut: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', glow: 'rgba(239,68,68,0.15)' },
  Berserker: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'rgba(249,115,22,0.15)' },
  Chieftain: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'rgba(245,158,11,0.15)' },
  Deadeye: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', glow: 'rgba(34,197,94,0.15)' },
  Warden: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'rgba(16,185,129,0.15)' },
  Pathfinder: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/30', glow: 'rgba(132,204,22,0.15)' },
  Necromancer: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'rgba(168,85,247,0.15)' },
  Elementalist: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'rgba(139,92,246,0.15)' },
  Occultist: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', glow: 'rgba(217,70,239,0.15)' },
  Slayer: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'rgba(234,179,8,0.15)' },
  Gladiator: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'rgba(245,158,11,0.15)' },
  Champion: { bg: 'bg-gold-500/10', text: 'text-amber-300', border: 'border-amber-400/30', glow: 'rgba(251,191,36,0.15)' },
  Inquisitor: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'rgba(59,130,246,0.15)' },
  Hierophant: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', glow: 'rgba(14,165,233,0.15)' },
  Guardian: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'rgba(6,182,212,0.15)' },
  Assassin: { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-400/30', glow: 'rgba(148,163,184,0.15)' },
  Trickster: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', glow: 'rgba(20,184,166,0.15)' },
  Saboteur: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30', glow: 'rgba(107,114,128,0.15)' },
  Ascendant: { bg: 'bg-white/5', text: 'text-slate-200', border: 'border-slate-300/30', glow: 'rgba(226,232,240,0.15)' },
  Reliquarian: { bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-400/30', glow: 'rgba(251,113,133,0.15)' },
};

const budgetTierLabels: Record<BudgetTier, string> = {
  starter: 'Starter (0c)',
  'entry-maps': 'Entry Maps (10-50c)',
  mapping: 'Mapping (50c-2D)',
  investment: 'Investment (2-10D)',
  endgame: 'Endgame (10D+)',
};

const tagConfig: Record<string, { label: string; color: string }> = {
  'league-starter': { label: 'League Start', color: 'bg-green-500/20 text-green-400' },
  budget: { label: 'Budget', color: 'bg-teal-500/20 text-teal-400' },
  mapper: { label: 'Mapper', color: 'bg-blue-500/20 text-blue-400' },
  'boss-killer': { label: 'Bosser', color: 'bg-red-500/20 text-red-400' },
  'all-rounder': { label: 'All-Round', color: 'bg-purple-500/20 text-purple-400' },
  endgame: { label: 'Endgame', color: 'bg-amber-500/20 text-amber-400' },
  experimental: { label: 'Experimental', color: 'bg-slate-500/20 text-slate-400' },
  crit: { label: 'Crit', color: 'bg-orange-500/20 text-orange-400' },
  'power-charges': { label: 'Power Charges', color: 'bg-cyan-500/20 text-cyan-400' },
  dot: { label: 'DoT', color: 'bg-lime-500/20 text-lime-400' },
  minions: { label: 'Minions', color: 'bg-violet-500/20 text-violet-400' },
  totems: { label: 'Totems', color: 'bg-yellow-500/20 text-yellow-400' },
  auras: { label: 'Auras', color: 'bg-indigo-500/20 text-indigo-400' },
};

const getTagConfig = (tag: string) => tagConfig[tag] ?? {
  label: tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  color: 'bg-slate-500/20 text-slate-400'
};

const difficultyConfig: Record<Difficulty, { label: string; color: string; count: number }> = {
  beginner: { label: 'Beginner', color: 'text-green-400', count: 1 },
  intermediate: { label: 'Intermediate', color: 'text-amber-400', count: 2 },
  advanced: { label: 'Advanced', color: 'text-red-400', count: 3 },
};

// ============================================
// Sub-Components
// ============================================

function DifficultyStars({ difficulty }: { difficulty: Difficulty }) {
  const config = difficultyConfig[difficulty];
  return (
    <div className="flex items-center gap-1" title={config.label}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-4 h-4',
            i < config.count ? config.color : 'text-slate-600'
          )}
          fill={i < config.count ? 'currentColor' : 'none'}
        />
      ))}
      <span className={cn('ml-1 text-sm', config.color)}>{config.label}</span>
    </div>
  );
}

function getAscendancyBadgeGlow(textClass: string): string {
  if (textClass.includes('red')) return 'rgba(239,68,68,0.3)';
  if (textClass.includes('orange')) return 'rgba(249,115,22,0.3)';
  if (textClass.includes('amber')) return 'rgba(245,158,11,0.3)';
  if (textClass.includes('green')) return 'rgba(34,197,94,0.3)';
  if (textClass.includes('emerald')) return 'rgba(16,185,129,0.3)';
  if (textClass.includes('lime')) return 'rgba(132,204,22,0.3)';
  if (textClass.includes('purple')) return 'rgba(168,85,247,0.3)';
  if (textClass.includes('violet')) return 'rgba(139,92,246,0.3)';
  if (textClass.includes('fuchsia')) return 'rgba(217,70,239,0.3)';
  if (textClass.includes('yellow')) return 'rgba(234,179,8,0.3)';
  if (textClass.includes('blue')) return 'rgba(59,130,246,0.3)';
  if (textClass.includes('sky')) return 'rgba(14,165,233,0.3)';
  if (textClass.includes('cyan')) return 'rgba(6,182,212,0.3)';
  if (textClass.includes('teal')) return 'rgba(20,184,166,0.3)';
  return 'rgba(148,163,184,0.3)';
}

function getTagBorderClass(colorClass: string): string {
  if (colorClass.includes('green')) return 'border-green-500/30';
  if (colorClass.includes('teal')) return 'border-teal-500/30';
  if (colorClass.includes('blue')) return 'border-blue-500/30';
  if (colorClass.includes('red')) return 'border-red-500/30';
  if (colorClass.includes('purple')) return 'border-purple-500/30';
  if (colorClass.includes('amber')) return 'border-amber-500/30';
  if (colorClass.includes('orange')) return 'border-orange-500/30';
  if (colorClass.includes('cyan')) return 'border-cyan-500/30';
  if (colorClass.includes('lime')) return 'border-lime-500/30';
  if (colorClass.includes('violet')) return 'border-violet-500/30';
  if (colorClass.includes('yellow')) return 'border-yellow-500/30';
  if (colorClass.includes('indigo')) return 'border-indigo-500/30';
  return 'border-slate-500/30';
}

// ============================================
// Main Component
// ============================================

export function BuildHeroSection({
  name,
  ascendancy,
  mainSkill,
  concept,
  tags,
  difficulty,
  budgetTier,
  leagueVersion,
  onExploreVariations,
}: BuildHeroSectionProps) {
  const ascColors = ascendancyColors[ascendancy];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="frame-metallic-translucent rounded-xl p-5 sm:p-6 corner-accent mx-4 mt-4"
      style={{ boxShadow: `0 0 40px ${ascColors.glow}` }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-5">
        <div className="space-y-4">
          {/* Ascendancy badge - Large and prominent */}
          <div
            className={cn(
              'inline-flex items-center gap-2.5 px-4 py-2 rounded-lg',
              ascColors.bg,
              'border-2',
              ascColors.border,
              'shadow-lg'
            )}
            style={{ boxShadow: `0 0 20px ${getAscendancyBadgeGlow(ascColors.text)}` }}
          >
            <span className={cn('text-base font-display font-bold uppercase tracking-wider', ascColors.text)}>
              {ascendancy}
            </span>
          </div>

          {/* Build name */}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-amber-100 text-glow-amber">
            {name}
          </h1>

          {/* Main skill — Cinzel-cap label in metallic pill */}
          <div className="rounded-sm border border-amber-700/50 bg-slate-950/70 px-2 py-1 w-fit shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
            <span className="font-display uppercase tracking-wider text-amber-300 text-sm">
              {mainSkill}
            </span>
          </div>

          {/* Concept */}
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">{concept}</p>

          {/* Tags - Premium styled pills */}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const config = getTagConfig(tag);
              return (
                <span
                  key={tag}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide',
                    'border',
                    config.color,
                    getTagBorderClass(config.color)
                  )}
                >
                  {config.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:items-end">
          {/* Difficulty */}
          <DifficultyStars difficulty={difficulty} />

          {/* Budget tier — Cinzel-cap label in metallic pill */}
          <div className="rounded-sm border border-amber-700/50 bg-slate-950/70 px-2 py-1 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
            <span className="font-display uppercase tracking-wider text-amber-300 text-xs">
              {budgetTierLabels[budgetTier]}
            </span>
          </div>

          {/* League version */}
          {leagueVersion && (
            <span className="text-xs text-slate-500 font-display">
              League: {leagueVersion}
            </span>
          )}

          {/* Explore Variations button */}
          {onExploreVariations && (
            <button
              onClick={onExploreVariations}
              className={cn(
                'flex items-center justify-center gap-2.5 px-5 py-3 mt-2 rounded-lg',
                'bg-gradient-to-r from-amber-500 to-amber-600',
                'hover:from-amber-400 hover:to-amber-500',
                'shadow-lg shadow-amber-500/25',
                'text-slate-900 font-display font-semibold text-sm',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-amber-400/50',
                'min-h-[44px] w-full lg:w-auto'
              )}
            >
              <GitBranch className="w-4 h-4" />
              Explore Variations
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default BuildHeroSection;
