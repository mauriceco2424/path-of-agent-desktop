/**
 * KeyDecisionsSection Component - Build Key Decisions Display
 *
 * Shows key decisions made during build optimization:
 * - Decision name/question
 * - Chosen option highlighted with emerald badge
 * - Alternative shown with strikethrough (if provided)
 * - Ladder usage percentage (if available)
 * - Reasoning text
 *
 * @module desktop/src/components/build-library/KeyDecisionsSection
 */

import { Scale } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GuideDecision } from '../../../../shared/types/builds';

// ============================================
// Types
// ============================================

export interface KeyDecisionsSectionProps {
  decisions: GuideDecision[];
}

// ============================================
// Component
// ============================================

export function KeyDecisionsSection({ decisions }: KeyDecisionsSectionProps) {
  if (decisions.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 text-violet-400">
          <Scale className="w-4 h-4" />
        </div>
        <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em] text-violet-400/90">
          Key Decisions
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-violet-500/40 via-violet-500/20 to-transparent" />
      </div>

      {/* Decision cards */}
      <div className="pl-7 space-y-3">
        {decisions.map((decision, index) => (
          <div
            key={index}
            className={cn(
              'p-3 rounded-lg',
              'bg-gradient-to-r from-violet-500/5 to-transparent',
              'border border-violet-500/20'
            )}
          >
            {/* Decision header with ladder usage */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs text-slate-400 uppercase tracking-wide">
                {decision.decision}
              </span>
              {decision.ladderUsage !== undefined && (
                <span className="text-[0.625rem] px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/20">
                  {decision.ladderUsage}% of ladder
                </span>
              )}
            </div>

            {/* Chosen option */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn(
                'text-sm font-medium px-2 py-0.5 rounded',
                'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              )}>
                {decision.chosen}
              </span>
              {decision.alternative && (
                <>
                  <span className="text-xs text-slate-600">vs</span>
                  <span className="text-sm text-slate-500 line-through">
                    {decision.alternative}
                  </span>
                </>
              )}
            </div>

            {/* Reasoning */}
            <p className="text-sm text-slate-400">{decision.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
