/**
 * SynergiesSection Component - Build Synergies Display
 *
 * Shows synergies between build components identified during optimization:
 * - Connected item pills showing which items/nodes synergize
 * - Explanation of the synergy
 * - Optional DPS/EHP impact badges
 *
 * @module desktop/src/components/build-library/SynergiesSection
 */

import { Link2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GuideSynergy } from '../../../../shared/types/builds';

// ============================================
// Types
// ============================================

export interface SynergiesSectionProps {
  synergies: GuideSynergy[];
}

// ============================================
// Component
// ============================================

export function SynergiesSection({ synergies }: SynergiesSectionProps) {
  if (synergies.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 text-amber-400">
          <Link2 className="w-4 h-4" />
        </div>
        <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em] text-amber-400/90">
          Synergies
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/20 to-transparent" />
      </div>

      {/* Synergy cards */}
      <div className="pl-7 space-y-3">
        {synergies.map((synergy, index) => (
          <div
            key={index}
            className={cn(
              'p-3 rounded-lg',
              'bg-gradient-to-r from-amber-500/5 to-transparent',
              'border border-amber-500/20'
            )}
          >
            {/* Item pills */}
            <div className="flex items-center flex-wrap gap-2 mb-2">
              {synergy.items.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-amber-500/50 text-xs">+</span>
                  )}
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    'bg-amber-500/15 border border-amber-500/30',
                    'text-amber-200'
                  )}>
                    {item}
                  </span>
                </span>
              ))}
            </div>

            {/* Explanation */}
            <p className="text-sm text-slate-300">{synergy.explanation}</p>

            {/* Impact badges */}
            {(synergy.dpsImpact || synergy.ehpImpact) && (
              <div className="flex gap-2 mt-2">
                {synergy.dpsImpact && (
                  <span className="text-[0.625rem] px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">
                    DPS: {synergy.dpsImpact}
                  </span>
                )}
                {synergy.ehpImpact && (
                  <span className="text-[0.625rem] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                    EHP: {synergy.ehpImpact}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
