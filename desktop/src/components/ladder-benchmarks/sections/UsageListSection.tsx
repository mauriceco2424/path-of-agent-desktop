/**
 * UsageListSection Component
 *
 * Generic virtualized usage list with amber gradient bars showing
 * usage percentages. Used for keystones, notables, supports, auras,
 * jewels, flasks, mods, pantheon, and bandit choices.
 *
 * Part of the Ladder Benchmarks Modal - "The Artisan's Ledger"
 */

import { memo, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface UsageItem {
  name: string;
  usage: number;
  /** Optional slot or category suffix (e.g., "Belt", "Flask") */
  slot?: string;
  /** Optional mod text (for ModUsage items) */
  mod?: string;
}

interface UsageListSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ReadonlyArray<UsageItem>;
  /** Max items to show initially before "Show more" */
  maxItems?: number;
  /** Whether to show slot suffix next to names */
  showSlot?: boolean;
  /** Use mod field instead of name for display */
  useMod?: boolean;
  /** Animation stagger delay base (ms) */
  staggerBase?: number;
  /** Compact mode for overview tab - smaller text and spacing */
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_ITEMS = 10;
const EXPANDED_MAX_ITEMS = 50;

// =============================================================================
// UsageBar Sub-Component
// =============================================================================

interface UsageBarProps {
  name: string;
  usage: number;
  suffix?: string;
  index: number;
  compact?: boolean;
}

function UsageBar({ name, usage, suffix, index, compact }: UsageBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.3 }}
      className={cn(
        'flex items-center gap-2.5 group',
        compact ? 'py-0.5' : 'py-1'
      )}
    >
      {/* Name */}
      <span
        className={cn(
          'text-slate-300 min-w-0 flex-1',
          compact ? 'text-[0.625rem]' : 'text-[0.6875rem]',
          'leading-tight'
        )}
        title={name}
      >
        {name}
        {suffix && (
          <span className="text-slate-600 ml-1 text-[0.625rem]">({suffix})</span>
        )}
      </span>

      {/* Bar + percentage */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className={cn(
            'h-[5px] rounded-full bg-slate-800/70 overflow-hidden',
            compact ? 'w-16' : 'w-28'
          )}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(usage, 100)}%` }}
            transition={{ delay: 0.15 + index * 0.03, duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg,
                rgba(180, 83, 9, 0.7) 0%,
                rgba(251, 191, 36, 0.9) 100%
              )`,
            }}
          />
        </div>
        <span className="text-[0.625rem] text-slate-500 w-8 text-right tabular-nums font-medium">
          {Math.round(usage)}%
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function UsageListSectionRaw({
  title,
  icon,
  items,
  maxItems = DEFAULT_MAX_ITEMS,
  showSlot,
  useMod,
  staggerBase = 0,
  compact,
}: UsageListSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayItems = useMemo(() => {
    const limit = isExpanded ? EXPANDED_MAX_ITEMS : maxItems;
    return items.slice(0, limit);
  }, [items, isExpanded, maxItems]);

  const hasMore = items.length > maxItems;
  const showingAll = displayItems.length >= items.length;

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.35 }}
      className={cn(
        'rounded-lg',
        compact ? 'p-2.5' : 'p-3.5'
      )}
      style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.03) 0%, rgba(20, 16, 10, 0.6) 100%)',
        border: '1px solid rgba(251, 191, 36, 0.08)',
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span
          className={cn(
            'font-display font-semibold text-amber-400/80 uppercase tracking-wider',
            compact ? 'text-[0.5625rem]' : 'text-[0.625rem]'
          )}
        >
          {title}
        </span>
        <span className="text-[0.5625rem] text-slate-600 ml-auto tabular-nums">
          {items.length} total
        </span>
      </div>

      {/* Items list */}
      <div className={cn('space-y-0', compact ? 'max-h-[140px]' : 'max-h-[320px]', 'overflow-y-auto scrollbar-fantasy')}>
        {displayItems.map((item, i) => {
          const displayName = useMod && item.mod ? item.mod : item.name;
          return (
            <UsageBar
              key={useMod ? `${item.mod}-${item.slot}` : `${item.name}-${item.slot ?? ''}`}
              name={displayName}
              usage={item.usage}
              suffix={showSlot ? item.slot : undefined}
              index={i}
              compact={compact}
            />
          );
        })}
      </div>

      {/* Show more / Show less toggle */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className={cn(
            'flex items-center gap-1 mt-2 text-[0.625rem] text-amber-500/60',
            'hover:text-amber-400 transition-colors duration-200'
          )}
        >
          <ChevronDown
            className={cn(
              'w-3 h-3 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
          {isExpanded
            ? 'Show less'
            : `Show ${Math.min(items.length - maxItems, EXPANDED_MAX_ITEMS - maxItems)} more`
          }
        </button>
      )}

      {/* Showing all indicator */}
      {showingAll && items.length > maxItems && (
        <span className="text-[0.5625rem] text-slate-600 mt-1 block">
          Showing all {items.length} items
        </span>
      )}
    </motion.div>
  );
}

export const UsageListSection = memo(UsageListSectionRaw);
