/**
 * Synergies Section
 *
 * Renders pairwise co-occurrence data from ladder analysis.
 * Shows which build choices (keystones, uniques, auras) appear together
 * far more often than random chance — true mechanical synergies.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Link2, Key, Gem, Shield, Star, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoOccurrenceEntry } from '../../../../../shared/types/LadderData';

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_ICONS: Record<string, typeof Gem> = {
  keystone: Key,
  unique: Star,
  aura: Gem,
  notable: Shield,
  mod: Wrench,
};

const CATEGORY_COLORS: Record<string, string> = {
  keystone: 'text-amber-400/80 bg-amber-500/10 border-amber-500/15',
  unique: 'text-orange-300/80 bg-orange-500/10 border-orange-500/15',
  aura: 'text-blue-300/80 bg-blue-500/10 border-blue-500/15',
  notable: 'text-emerald-300/80 bg-emerald-500/10 border-emerald-500/15',
  mod: 'text-violet-300/80 bg-violet-500/10 border-violet-500/15',
};

// =============================================================================
// Synergy Row
// =============================================================================

interface SynergyRowProps {
  entry: CoOccurrenceEntry;
  index: number;
}

function SynergyRow({ entry, index }: SynergyRowProps) {
  const delay = 0.05 + index * 0.04;
  const IconA = CATEGORY_ICONS[entry.categoryA] ?? Gem;
  const IconB = CATEGORY_ICONS[entry.categoryB] ?? Gem;
  const colorA = CATEGORY_COLORS[entry.categoryA] ?? CATEGORY_COLORS.notable;
  const colorB = CATEGORY_COLORS[entry.categoryB] ?? CATEGORY_COLORS.notable;

  // Lift strength for visual emphasis
  const liftStrength = entry.lift >= 5 ? 'strong' : entry.lift >= 3 ? 'moderate' : 'mild';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-800/20 transition-colors"
    >
      {/* Item A */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className={cn('px-1.5 py-[1px] rounded text-[0.5625rem] font-medium border flex items-center gap-1 flex-shrink-0', colorA)}>
          <IconA className="w-2.5 h-2.5" />
          {entry.categoryA}
        </span>
        <span className="text-[0.6875rem] text-slate-200 truncate">{entry.itemA}</span>
      </div>

      {/* Link icon */}
      <Link2 className="w-3 h-3 text-slate-600 flex-shrink-0" />

      {/* Item B */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className={cn('px-1.5 py-[1px] rounded text-[0.5625rem] font-medium border flex items-center gap-1 flex-shrink-0', colorB)}>
          <IconB className="w-2.5 h-2.5" />
          {entry.categoryB}
        </span>
        <span className="text-[0.6875rem] text-slate-200 truncate">{entry.itemB}</span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[0.5625rem] text-slate-400 tabular-nums">
          {entry.coUsage}%
        </span>
        <span
          className={cn(
            'px-1.5 py-[1px] rounded text-[0.5625rem] font-semibold tabular-nums',
            liftStrength === 'strong'
              ? 'text-amber-300 bg-amber-500/15 border border-amber-500/20'
              : liftStrength === 'moderate'
              ? 'text-slate-300 bg-slate-500/15 border border-slate-500/20'
              : 'text-slate-400 bg-slate-700/30 border border-slate-600/20',
          )}
        >
          {entry.lift}×
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Section
// =============================================================================

interface SynergiesSectionProps {
  coOccurrence: CoOccurrenceEntry[];
}

export const SynergiesSection = memo(function SynergiesSection({ coOccurrence }: SynergiesSectionProps) {
  if (!coOccurrence || coOccurrence.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-amber-500/60" />
        <h3 className="text-[0.8125rem] font-display font-semibold text-slate-200 tracking-wide uppercase">
          Common Synergies
        </h3>
        <span className="text-[0.625rem] text-slate-500">{coOccurrence.length} pairs</span>
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(2, 6, 23, 0.8) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700/20">
          <span className="text-[0.5625rem] text-slate-500 flex-1">Choice A</span>
          <span className="w-3" />
          <span className="text-[0.5625rem] text-slate-500 flex-1">Choice B</span>
          <span className="text-[0.5625rem] text-slate-500 w-8 text-right">Use</span>
          <span className="text-[0.5625rem] text-slate-500 w-10 text-right">Lift</span>
        </div>

        {/* Rows */}
        <div className="px-1 py-1">
          {coOccurrence.map((entry, i) => (
            <SynergyRow
              key={`${entry.itemA}-${entry.itemB}`}
              entry={entry}
              index={i}
            />
          ))}
        </div>
      </div>

      <p className="text-[0.5625rem] text-slate-600 mt-1.5 px-1">
        Lift measures how much more often choices appear together vs independently. Higher = stronger synergy.
      </p>
    </motion.div>
  );
});
