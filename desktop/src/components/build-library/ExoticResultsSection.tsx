/**
 * ExoticResultsSection Component - Exotic Mechanics Test Results
 *
 * Shows exotic mechanics that were tested during optimization:
 * - Split into adopted (green) and rejected (grey) columns
 * - Each result shows: mechanic name, DPS/EHP impact, reason
 * - Responsive grid layout (stacked on small screens)
 *
 * @module desktop/src/components/build-library/ExoticResultsSection
 */

import { FlaskConical, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ExoticTestResult } from '../../../../shared/types/builds';

// ============================================
// Types
// ============================================

export interface ExoticResultsSectionProps {
  results: ExoticTestResult[];
}

// ============================================
// Utility Functions
// ============================================

function formatPercent(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

// ============================================
// Component
// ============================================

export function ExoticResultsSection({ results }: ExoticResultsSectionProps) {
  if (results.length === 0) return null;

  const adopted = results.filter(r => r.adopted);
  const rejected = results.filter(r => !r.adopted);

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 text-cyan-400">
          <FlaskConical className="w-4 h-4" />
        </div>
        <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
          Exotic Mechanics Tested
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/40 via-cyan-500/20 to-transparent" />
      </div>

      {/* Results grid */}
      <div className="pl-7 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Adopted column */}
        {adopted.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[0.625rem] uppercase tracking-wide text-emerald-400">Adopted</span>
            </div>
            {adopted.map((result, index) => (
              <div
                key={index}
                className={cn(
                  'p-2.5 rounded-lg',
                  'bg-emerald-500/5 border border-emerald-500/20'
                )}
              >
                <div className="text-sm font-medium text-emerald-200 mb-1">
                  {result.mechanic}
                </div>
                <div className="flex gap-2 mb-1">
                  {result.dpsImpact !== 0 && (
                    <span className={cn(
                      'text-[0.625rem] px-1.5 py-0.5 rounded',
                      result.dpsImpact > 0 ? 'bg-orange-500/15 text-orange-300' : 'bg-red-500/15 text-red-300'
                    )}>
                      DPS {result.dpsImpact > 0 ? '+' : ''}{formatPercent(result.dpsImpact)}
                    </span>
                  )}
                  {result.ehpImpact !== 0 && (
                    <span className={cn(
                      'text-[0.625rem] px-1.5 py-0.5 rounded',
                      result.ehpImpact > 0 ? 'bg-cyan-500/15 text-cyan-300' : 'bg-red-500/15 text-red-300'
                    )}>
                      EHP {result.ehpImpact > 0 ? '+' : ''}{formatPercent(result.ehpImpact)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{result.reason}</p>
              </div>
            ))}
          </div>
        )}

        {/* Rejected column */}
        {rejected.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[0.625rem] uppercase tracking-wide text-slate-400">Rejected</span>
            </div>
            {rejected.map((result, index) => (
              <div
                key={index}
                className={cn(
                  'p-2.5 rounded-lg',
                  'bg-slate-800/50 border border-slate-700/30'
                )}
              >
                <div className="text-sm font-medium text-slate-400 mb-1">
                  {result.mechanic}
                </div>
                <p className="text-xs text-slate-500">{result.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
