/**
 * AlternativesSection Component - Build Alternatives Display
 *
 * Displays build alternatives with trade-offs for a milestone:
 * - Collapsible section with count badge
 * - Color-coded label badges (budget, defensive, offensive, recommended)
 * - Trade-off summary (DPS delta, EHP delta, cost delta)
 * - Expandable detailed stat comparison
 *
 * @module desktop/src/components/build-library/AlternativesSection
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { GitBranch, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Shield, Sword, Coins } from 'lucide-react';
import type { BuildAlternative, AlternativeStatComparison } from '../../../../shared/types/builds';

// ============================================
// Types
// ============================================

export interface AlternativesSectionProps {
  alternatives: BuildAlternative[];
}

// ============================================
// Configuration
// ============================================

const labelConfig: Record<BuildAlternative['label'], { bg: string; text: string; border: string }> = {
  budget: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  defensive: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  offensive: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  recommended: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
};

const labelDisplayNames: Record<BuildAlternative['label'], string> = {
  budget: 'Budget',
  defensive: 'Defensive',
  offensive: 'Offensive',
  recommended: 'Recommended',
};

// ============================================
// Utility Functions
// ============================================

function formatDelta(value: number): string {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return '0%';
}

function getDeltaColor(value: number, isPositiveGood: boolean = true): string {
  if (value === 0) return 'text-slate-400';
  const isPositive = value > 0;
  if (isPositiveGood) {
    return isPositive ? 'text-emerald-400' : 'text-red-400';
  }
  return isPositive ? 'text-red-400' : 'text-emerald-400';
}

function getDeltaIcon(value: number) {
  if (value > 0) return <TrendingUp className="w-3.5 h-3.5" />;
  if (value < 0) return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

function getAssessmentColor(assessment: AlternativeStatComparison['assessment']): string {
  switch (assessment) {
    case 'better':
      return 'text-emerald-400';
    case 'worse':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}

function getImportanceBadge(importance: AlternativeStatComparison['importance']): string {
  switch (importance) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'important':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function formatStatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

// ============================================
// Sub-Components
// ============================================

interface AlternativeCardProps {
  alternative: BuildAlternative;
}

function AlternativeCard({ alternative }: AlternativeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = labelConfig[alternative.label];

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200',
        'bg-slate-900/50 border-slate-700/50',
        'hover:border-slate-600/70'
      )}
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Label badge and name */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide',
                'border',
                config.bg,
                config.text,
                config.border
              )}
            >
              {labelDisplayNames[alternative.label]}
            </span>
            <span className="text-sm font-medium text-slate-200">
              {alternative.displayName}
            </span>
          </div>

          {/* Use case pill */}
          <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
            {alternative.useCase}
          </span>
        </div>

        {/* Trade-off summary */}
        <div className="flex items-center gap-4 mb-3">
          {/* DPS Delta */}
          <div className="flex items-center gap-1.5">
            <Sword className="w-4 h-4 text-orange-400" />
            <span className={cn('text-sm font-medium', getDeltaColor(alternative.tradeOff.dpsDelta))}>
              {getDeltaIcon(alternative.tradeOff.dpsDelta)}
            </span>
            <span className={cn('text-sm font-medium', getDeltaColor(alternative.tradeOff.dpsDelta))}>
              {formatDelta(alternative.tradeOff.dpsDelta)} DPS
            </span>
          </div>

          {/* EHP Delta */}
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className={cn('text-sm font-medium', getDeltaColor(alternative.tradeOff.ehpDelta))}>
              {getDeltaIcon(alternative.tradeOff.ehpDelta)}
            </span>
            <span className={cn('text-sm font-medium', getDeltaColor(alternative.tradeOff.ehpDelta))}>
              {formatDelta(alternative.tradeOff.ehpDelta)} EHP
            </span>
          </div>

          {/* Cost Delta */}
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-300">
              {alternative.tradeOff.costDelta}
            </span>
          </div>
        </div>

        {/* Reasoning */}
        <p className="text-sm text-slate-400 leading-relaxed">
          {alternative.reasoning}
        </p>

        {/* Changes summary */}
        {alternative.changes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {alternative.changes.map((change, idx) => (
              <span
                key={idx}
                className="text-xs text-slate-500 bg-slate-800/30 px-2 py-1 rounded"
              >
                {change.slot}: {change.fromItem} → {change.toItem}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expandable stat comparison */}
      {alternative.statComparison.length > 0 && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2',
              'border-t border-slate-700/50',
              'text-xs text-slate-500 hover:text-slate-400',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50'
            )}
          >
            <span className="font-medium uppercase tracking-wider">
              {isExpanded ? 'Hide Details' : 'Show Stat Comparison'}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isExpanded && (
            <div className="p-4 border-t border-slate-700/50 bg-slate-950/30">
              <div className="space-y-2">
                {alternative.statComparison.map((stat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-300">{stat.metric}</span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-[0.625rem] font-medium uppercase rounded border',
                          getImportanceBadge(stat.importance)
                        )}
                      >
                        {stat.importance}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-500">
                        {formatStatValue(stat.current)}
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className={cn('text-sm font-medium', getAssessmentColor(stat.assessment))}>
                        {formatStatValue(stat.alternative)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function AlternativesSection({ alternatives }: AlternativesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (alternatives.length === 0) {
    return null;
  }

  return (
    <div className="card-forge rounded-xl overflow-hidden">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-4',
          'hover:bg-slate-800/30 transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/50'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <GitBranch className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-display font-semibold uppercase tracking-wider text-amber-100">
            Build Alternatives
          </h3>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            )}
          >
            {alternatives.length} Available
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-3">
          {alternatives.map((alt, idx) => (
            <AlternativeCard key={idx} alternative={alt} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AlternativesSection;
