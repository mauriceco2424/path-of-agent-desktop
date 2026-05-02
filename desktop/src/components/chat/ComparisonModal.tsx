/**
 * ComparisonModal Component
 *
 * Side-by-side item comparison modal for trade results.
 * Shows current equipped item vs candidate item with stat deltas.
 *
 * Features:
 * - Two-column layout showing current vs candidate item
 * - Mod comparison with improvement indicators
 * - Net impact summary (DPS, EHP, Grade)
 * - Links to trade site
 */

import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TradeItemDisplay } from '../../../../shared/types/Chat';
import type { TradeGrade } from '../../../../shared/types/TradeComparison';
import { cn } from '../../lib/utils';
import { openExternal } from '../../utils/open-external';

// ============================================================================
// Types
// ============================================================================

export interface CurrentItemInfo {
  /** Item name (e.g., "Agony Grasp") */
  name: string;
  /** Base type (e.g., "Warlock Gloves") */
  baseName: string;
  /** Item mods as formatted strings */
  mods: string[];
}

export interface ComparisonData {
  /** DPS percentage change */
  dpsPercent: number;
  /** EHP percentage change */
  ehpPercent: number;
  /** Composite score delta */
  scoreDelta: number;
  /** Grade classification */
  grade: TradeGrade;
}

export interface ComparisonModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Current equipped item info (null if empty slot) */
  currentItem: CurrentItemInfo | null;
  /** Candidate item from trade search */
  candidateItem: TradeItemDisplay;
  /** Comparison stats */
  comparison: ComparisonData;
  /** URL to view item on trade site */
  tradeUrl?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Grade badge with appropriate styling
 */
function GradeBadge({ grade, size = 'normal' }: { grade: TradeGrade; size?: 'normal' | 'large' }) {
  const getGradeStyles = (g: TradeGrade) => {
    switch (g) {
      case 'S':
        return 'bg-amber-400/20 text-amber-400 border-amber-400/50';
      case 'A':
        return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50';
      case 'B':
        return 'bg-sky-500/20 text-sky-500 border-sky-500/50';
      case 'C':
        return 'bg-slate-400/20 text-slate-400 border-slate-400/50';
      case 'F':
        return 'bg-red-500/20 text-red-500 border-red-500/50';
      default:
        return 'bg-slate-400/20 text-slate-400 border-slate-400/50';
    }
  };

  return (
    <span
      className={cn(
        'rounded font-bold border',
        size === 'large' ? 'px-3 py-1.5 text-lg' : 'px-2 py-0.5 text-sm',
        getGradeStyles(grade)
      )}
    >
      {grade}
    </span>
  );
}

/**
 * Stat change indicator with arrow
 */
function StatChangeIndicator({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) {
    return (
      <span className="flex items-center text-slate-500">
        <Minus className="w-3 h-3" />
      </span>
    );
  }

  const isPositive = value > 0;
  return (
    <span className={cn('flex items-center', isPositive ? 'text-emerald-400' : 'text-red-400')}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
    </span>
  );
}

/**
 * Single mod line with optional comparison indicator
 */
function ModLine({
  mod,
  indicator,
}: {
  mod: string;
  indicator?: 'better' | 'worse' | 'same' | null;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-sm text-slate-300 flex-1">{mod}</span>
      {indicator && (
        <span className="flex-shrink-0 mt-0.5">
          {indicator === 'better' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
          {indicator === 'worse' && <TrendingDown className="w-3 h-3 text-red-400" />}
          {indicator === 'same' && <Minus className="w-3 h-3 text-slate-500" />}
        </span>
      )}
    </div>
  );
}

/**
 * Item card for displaying current or candidate item
 */
function ItemCard({
  title,
  name,
  baseName,
  mods,
  isEmpty = false,
  isCandidate = false,
}: {
  title: string;
  name: string;
  baseName: string;
  mods: string[];
  isEmpty?: boolean;
  isCandidate?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex-1 rounded-lg border p-4',
        isEmpty ? 'border-slate-700/30 bg-slate-800/30' : 'border-slate-700/50 bg-slate-800/50',
        isCandidate && 'border-amber-500/30 bg-amber-500/5'
      )}
    >
      {/* Header */}
      <div className="mb-3">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wider',
            isEmpty ? 'text-slate-500' : 'text-slate-400'
          )}
        >
          {title}
        </span>
      </div>

      {/* Item name */}
      <div className="mb-3">
        {isEmpty ? (
          <span className="text-sm text-slate-500 italic">Empty slot</span>
        ) : (
          <>
            <div
              className={cn(
                'text-base font-semibold',
                isCandidate ? 'text-amber-400' : 'text-slate-100'
              )}
            >
              {name}
            </div>
            {baseName && baseName !== name && (
              <div className="text-xs text-slate-400 mt-0.5">{baseName}</div>
            )}
          </>
        )}
      </div>

      {/* Mods */}
      {!isEmpty && mods.length > 0 && (
        <div className="border-t border-slate-700/50 pt-3 space-y-0.5">
          {mods.map((mod, idx) => (
            <ModLine key={idx} mod={mod} />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="text-sm text-slate-500 mt-2">No item equipped in this slot</div>
      )}
    </div>
  );
}

/**
 * Stat change display for summary section
 */
function StatChange({
  label,
  value,
  suffix = '%',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = Math.abs(value) < 0.1;

  const colorClass = isNeutral
    ? 'text-slate-400'
    : isPositive
      ? 'text-emerald-400'
      : 'text-red-400';

  const formattedValue = isNeutral
    ? '0'
    : isPositive
      ? `+${value.toFixed(1)}`
      : value.toFixed(1);

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</span>
      <span className={cn('text-lg font-semibold', colorClass)}>
        {formattedValue}
        {suffix}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ComparisonModal({
  isOpen,
  onClose,
  currentItem,
  candidateItem,
  comparison,
  tradeUrl,
}: ComparisonModalProps) {
  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Open trade URL
  const handleViewOnTrade = () => {
    if (tradeUrl) {
      openExternal(tradeUrl);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Item Comparison"
    >
      <div
        className={cn(
          'w-full max-w-3xl mx-4',
          'rounded-2xl border border-slate-700/50',
          'bg-slate-900/95 shadow-2xl',
          'max-h-[90vh] flex flex-col'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Item Comparison</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              See how this upgrade affects your build
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg',
              'text-slate-400 hover:text-slate-200',
              'bg-slate-800/50 hover:bg-slate-700/50',
              'border border-slate-700/50 hover:border-slate-600/50',
              'transition-all duration-150'
            )}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Two-column comparison */}
          <div className="flex items-stretch gap-4 mb-6">
            {/* Current item */}
            <ItemCard
              title="Current Item"
              name={currentItem?.name ?? ''}
              baseName={currentItem?.baseName ?? ''}
              mods={currentItem?.mods ?? []}
              isEmpty={!currentItem}
            />

            {/* Arrow */}
            <div className="flex items-center justify-center px-2">
              <ArrowRight className="w-6 h-6 text-slate-500" />
            </div>

            {/* Candidate item */}
            <ItemCard
              title="Candidate"
              name={candidateItem.name}
              baseName={candidateItem.baseType}
              mods={candidateItem.allMods ?? candidateItem.matchedStats}
              isCandidate
            />
          </div>

          {/* Summary section */}
          <div className="border-t border-slate-700/50 pt-6">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-4 text-center">
              Net Impact
            </div>

            <div className="flex items-center justify-center gap-8">
              <StatChange label="DPS" value={comparison.dpsPercent} />
              <StatChange label="EHP" value={comparison.ehpPercent} />

              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Grade
                </span>
                <GradeBadge grade={comparison.grade} size="large" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
          {tradeUrl && (
            <button
              onClick={handleViewOnTrade}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-slate-800/50 hover:bg-slate-700/50',
                'border border-slate-700/50 hover:border-slate-600/50',
                'text-slate-300 hover:text-slate-100',
                'text-sm font-medium',
                'transition-all duration-200'
              )}
            >
              <ExternalLink className="w-4 h-4" />
              View on Trade
            </button>
          )}
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg',
              'bg-amber-600 hover:bg-amber-500',
              'text-white',
              'text-sm font-medium',
              'transition-all duration-200'
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default ComparisonModal;
