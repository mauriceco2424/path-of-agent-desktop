/**
 * ItemsBySlotSection Component
 *
 * Accordion-style display of unique items grouped by equipment slot.
 * Each slot header is clickable and expands to reveal usage bars for
 * unique items in that slot.
 *
 * Part of the Ladder Benchmarks Modal - "The Armourer's Archive"
 */

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemUsage } from '../../../../../shared/types/LadderData';

// =============================================================================
// Types
// =============================================================================

interface ItemsBySlotSectionProps {
  items: ItemUsage[];
  /** Animation stagger delay base (ms) */
  staggerBase?: number;
}

// =============================================================================
// Slot Ordering
// =============================================================================

const SLOT_ORDER: Record<string, number> = {
  'Weapon 1': 0,
  'Weapon 2': 1,
  'Helmet': 2,
  'Body Armour': 3,
  'Gloves': 4,
  'Boots': 5,
  'Belt': 6,
  'Amulet': 7,
  'Ring 1': 8,
  'Ring 2': 9,
};

function getSlotOrder(slot: string): number {
  return SLOT_ORDER[slot] ?? 99;
}

function getSlotDisplayName(slot: string): string {
  // Clean up slot names for display
  if (slot === 'Weapon 1') return 'Main Hand';
  if (slot === 'Weapon 2') return 'Off Hand';
  return slot;
}

// =============================================================================
// Slot Group Sub-Component
// =============================================================================

interface SlotGroupProps {
  slot: string;
  items: ItemUsage[];
  index: number;
  defaultOpen?: boolean;
}

function SlotGroup({ slot, items, index, defaultOpen }: SlotGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  // Get the top item for preview in collapsed state
  const topItem = items[0];
  const maxUsage = topItem?.usage ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-lg overflow-hidden"
      style={{
        background: 'rgba(20, 16, 10, 0.4)',
        border: '1px solid rgba(251, 191, 36, 0.06)',
      }}
    >
      {/* Slot header - clickable accordion trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 text-left',
          'hover:bg-amber-500/[0.03] transition-colors duration-200'
        )}
      >
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-600 transition-transform duration-200 flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />

        <span className="text-[0.6875rem] font-display font-medium text-slate-300 flex-1">
          {getSlotDisplayName(slot)}
        </span>

        {/* Preview: top item name + count */}
        {!isOpen && topItem && (
          <span className="text-[0.625rem] text-slate-500 truncate max-w-[140px]">
            {topItem.name} ({Math.round(maxUsage)}%)
          </span>
        )}

        <span className="text-[0.5625rem] text-slate-600 tabular-nums flex-shrink-0">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Expandable items list */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-0.5 space-y-1">
              {items.map((item, i) => (
                <div
                  key={`${item.name}-${item.slot}`}
                  className="flex items-center gap-2"
                >
                  <span className="text-[0.6875rem] text-slate-300 min-w-0 flex-1 truncate">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-20 h-[4px] rounded-full bg-slate-800/70 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(item.usage, 100)}%` }}
                        transition={{ delay: i * 0.04, duration: 0.4, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, rgba(180, 83, 9, 0.7) 0%, rgba(251, 191, 36, 0.9) 100%)',
                        }}
                      />
                    </div>
                    <span className="text-[0.625rem] text-slate-500 w-8 text-right tabular-nums">
                      {Math.round(item.usage)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ItemsBySlotSectionRaw({
  items,
  staggerBase = 0,
}: ItemsBySlotSectionProps) {
  // Group items by slot
  const slotGroups = useMemo(() => {
    const groups = new Map<string, ItemUsage[]>();

    for (const item of items) {
      const slot = item.slot || 'Unknown';
      const existing = groups.get(slot);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(slot, [item]);
      }
    }

    // Sort groups by slot order, then sort items within each group by usage
    return Array.from(groups.entries())
      .sort(([a], [b]) => getSlotOrder(a) - getSlotOrder(b))
      .map(([slot, slotItems]) => ({
        slot,
        items: slotItems.sort((a, b) => b.usage - a.usage),
      }));
  }, [items]);

  if (slotGroups.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.35 }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-3.5 h-3.5 text-amber-400/70" />
        <span className="text-[0.625rem] font-display font-semibold text-amber-400/80 uppercase tracking-wider">
          Unique Items by Slot
        </span>
        <span className="text-[0.5625rem] text-slate-600 ml-auto">
          {items.length} total
        </span>
      </div>

      {/* Slot groups */}
      <div className="space-y-1.5">
        {slotGroups.map((group, i) => (
          <SlotGroup
            key={group.slot}
            slot={group.slot}
            items={group.items}
            index={i}
            defaultOpen={i < 2}
          />
        ))}
      </div>
    </motion.div>
  );
}

export const ItemsBySlotSection = memo(ItemsBySlotSectionRaw);
