/**
 * TradeResultCard Component
 *
 * Displays a single trade item listing in compact row format.
 * Port of frontend/src/components/chat/TradeResultCard.tsx for desktop.
 *
 * Features:
 * - Rank badge for positioning (gold/silver/bronze for top 3)
 * - Grade badge (S/A/B/C/F) based on DPS x EHP score
 * - DPS and EHP change badges with color coding
 * - Item name and base type display
 * - Price with currency styling
 * - Attribute warning if item cannot be equipped
 * - Compare button for detailed comparison modal
 */

import { AlertTriangle, GitCompare } from 'lucide-react';
import type { TradeItemDisplay } from '../../../../shared/types/Chat';
import type { TradeGrade } from '../../../../shared/types/TradeComparison';
import { cn } from '../../lib/utils';

export interface TradeResultCardProps {
  item: TradeItemDisplay;
  className?: string;
  /** Rank position in results (1-based) - overrides item.comparison.rank if provided */
  rank?: number;
  /** Callback when compare button is clicked */
  onCompare?: (item: TradeItemDisplay) => void;
}

/**
 * Format currency display with appropriate icon/text
 */
function formatCurrency(amount: number, currency: string): string {
  const currencyLabels: Record<string, string> = {
    chaos: 'c',
    divine: 'div',
    exalted: 'ex',
    alch: 'alch',
    fusing: 'fus',
    vaal: 'vaal',
  };

  const label = currencyLabels[currency.toLowerCase()] || currency;
  return `${amount} ${label}`;
}

/**
 * Get currency color class based on type
 */
function getCurrencyColorClass(currency: string): string {
  switch (currency.toLowerCase()) {
    case 'divine':
      return 'text-yellow-300';
    case 'exalted':
      return 'text-yellow-400';
    case 'chaos':
      return 'text-amber-400';
    default:
      return 'text-amber-300';
  }
}

/**
 * Rank badge component for trade result positioning.
 * Top 3 get special styling (gold, silver, bronze) with background.
 */
function RankBadge({ rank }: { rank: number }) {
  const getBadgeStyles = (r: number) => {
    switch (r) {
      case 1:
        return 'bg-amber-500 text-slate-900';
      case 2:
        return 'bg-slate-400 text-slate-900';
      case 3:
        return 'bg-amber-700 text-slate-100';
      default:
        return 'bg-slate-600 text-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
        getBadgeStyles(rank)
      )}
    >
      {rank}
    </span>
  );
}

/**
 * Grade badge component for item quality assessment.
 * S/A/B/C/F grades with color coding.
 */
function GradeBadge({ grade }: { grade: TradeGrade }) {
  const getGradeStyles = (g: TradeGrade) => {
    switch (g) {
      case 'S':
        return 'bg-amber-400/20 text-amber-400 border-amber-400/40';
      case 'A':
        return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40';
      case 'B':
        return 'bg-sky-500/20 text-sky-500 border-sky-500/40';
      case 'C':
        return 'bg-slate-400/20 text-slate-400 border-slate-400/40';
      case 'F':
        return 'bg-red-500/20 text-red-500 border-red-500/40';
      default:
        return 'bg-slate-400/20 text-slate-400 border-slate-400/40';
    }
  };

  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[0.625rem] font-bold border flex-shrink-0',
        getGradeStyles(grade)
      )}
    >
      {grade}
    </span>
  );
}

/**
 * Improvement badge for DPS/EHP percentage changes.
 */
function ImprovementBadge({
  value,
  label,
}: {
  value: number;
  label: 'DPS' | 'EHP';
}) {
  // Skip rendering for very small changes (less than 0.1%)
  if (Math.abs(value) < 0.1) {
    return null;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;

  const colorClass = isPositive
    ? 'text-emerald-400'
    : isNegative
      ? 'text-red-400'
      : 'text-slate-400';

  const formattedValue = isPositive ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  return (
    <span className={cn('text-[0.625rem] font-medium flex-shrink-0', colorClass)}>
      {formattedValue} {label}
    </span>
  );
}

/**
 * Individual trade item row component (compact display).
 * Shows rank, grade, name, price, DPS/EHP changes, and compare button.
 * Includes attribute warning banner if item cannot be equipped.
 */
export function TradeResultCard({ item, className, rank, onCompare }: TradeResultCardProps) {
  const { name, baseType, price, validation, comparison } = item;

  // Use rank from prop or from comparison data
  const displayRank = rank ?? comparison?.rank;

  // Get comparison data
  const grade = comparison?.grade;
  const dpsPercent = comparison?.dpsPercent;
  const ehpPercent = comparison?.ehpPercent;
  const canEquip = comparison?.canEquip;
  const equipWarning = comparison?.equipWarning;

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-700/50 overflow-hidden',
        'hover:border-slate-600/70 transition-colors',
        !canEquip && canEquip !== undefined && 'border-red-500/30',
        className
      )}
    >
      {/* Main content row */}
      <div className="flex items-center gap-2 py-2 px-3">
        {/* Rank badge */}
        {displayRank && <RankBadge rank={displayRank} />}

        {/* Grade badge */}
        {grade && <GradeBadge grade={grade} />}

        {/* Item name and base type */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-slate-100 truncate block">{name}</span>
          {baseType && baseType !== name && (
            <span className="text-xs text-slate-400">({baseType})</span>
          )}
        </div>

        {/* Improvement badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {dpsPercent !== undefined && (
            <ImprovementBadge value={dpsPercent} label="DPS" />
          )}
          {ehpPercent !== undefined && (
            <ImprovementBadge value={ehpPercent} label="EHP" />
          )}
        </div>

        {/* Price */}
        <span
          className={cn(
            'text-sm font-semibold flex-shrink-0',
            getCurrencyColorClass(price.currency)
          )}
        >
          {formatCurrency(price.amount, price.currency)}
        </span>

        {/* Compare button */}
        {onCompare && (
          <button
            onClick={() => onCompare(item)}
            className={cn(
              'p-1.5 rounded-md flex-shrink-0',
              'bg-slate-700/50 hover:bg-slate-600/70',
              'text-slate-400 hover:text-slate-200',
              'transition-colors'
            )}
            title="Compare stats"
          >
            <GitCompare className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Fallback to legacy validation DPS if no comparison data */}
      {!dpsPercent &&
        validation?.dps?.percentChange !== undefined &&
        validation.dps.percentChange !== 0 && (
          <div className="flex items-center gap-2 px-3 pb-2">
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                validation.dps.percentChange > 0
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-red-900/50 text-red-400'
              )}
            >
              {validation.dps.percentChange > 0 ? '+' : ''}
              {validation.dps.percentChange.toFixed(1)}% DPS
            </span>
          </div>
        )}

      {/* Attribute warning banner */}
      {canEquip === false && equipWarning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-t border-red-500/30">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{equipWarning}</span>
        </div>
      )}
    </div>
  );
}

export default TradeResultCard;
