/**
 * Gem Setup by Slot Section
 *
 * Renders the per-slot consensus gem layout from ladder data.
 * Shows which gems ladder builds socket in each equipment slot,
 * with usage bars and active/support classification.
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gem, ChevronDown, Sword, Shield, Shirt, HardHat, Footprints, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TargetSlotLayout, TargetGem } from '../../../../../shared/types/LadderData';

// =============================================================================
// Constants
// =============================================================================

const SLOT_ORDER: Record<string, number> = {
  'Body Armour': 0,
  'Helmet': 1,
  'Gloves': 2,
  'Boots': 3,
  'Weapon 1': 4,
  'Weapon 2': 5,
};

const SLOT_ICONS: Record<string, typeof Gem> = {
  'Body Armour': Shirt,
  'Helmet': HardHat,
  'Gloves': Hand,
  'Boots': Footprints,
  'Weapon 1': Sword,
  'Weapon 2': Shield,
};

const SLOT_MAX_SOCKETS: Record<string, number> = {
  'Helmet': 4, 'Body Armour': 6, 'Gloves': 4, 'Boots': 4,
  'Weapon 1': 3, 'Weapon 2': 3,
};

// =============================================================================
// Gem Row
// =============================================================================

interface GemRowProps {
  gem: TargetGem;
  index: number;
  baseDelay: number;
}

function GemRow({ gem, index, baseDelay }: GemRowProps) {
  const delay = baseDelay + index * 0.03;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex items-center gap-2 py-[3px]"
    >
      {/* Gem type indicator dot */}
      <div
        className={cn(
          'w-[6px] h-[6px] rounded-full flex-shrink-0',
          gem.isSupport
            ? 'bg-blue-400/60 shadow-[0_0_4px_rgba(96,165,250,0.3)]'
            : 'bg-amber-400/70 shadow-[0_0_4px_rgba(251,191,36,0.3)]'
        )}
      />

      {/* Gem name */}
      <span className="text-[0.6875rem] text-slate-300 min-w-0 flex-1 leading-tight truncate">
        {gem.name}
      </span>

      {/* Usage bar + percentage */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-16 h-[4px] rounded-full bg-slate-800/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(gem.usage, 100)}%` }}
            transition={{ delay: delay + 0.1, duration: 0.4, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: gem.isSupport
                ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.5) 0%, rgba(96, 165, 250, 0.8) 100%)'
                : 'linear-gradient(90deg, rgba(180, 83, 9, 0.7) 0%, rgba(251, 191, 36, 0.9) 100%)',
            }}
          />
        </div>
        <span className="text-[0.5625rem] text-slate-500 w-7 text-right tabular-nums font-medium">
          {gem.usage}%
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Slot Card
// =============================================================================

interface SlotCardProps {
  layout: TargetSlotLayout;
  index: number;
}

function SlotCard({ layout, index }: SlotCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const SlotIcon = SLOT_ICONS[layout.slot] ?? Gem;
  const maxSockets = SLOT_MAX_SOCKETS[layout.slot] ?? 4;
  const activeCount = layout.targetGems.filter(g => !g.isSupport).length;
  const supportCount = layout.targetGems.filter(g => g.isSupport).length;
  const baseDelay = 0.1 + index * 0.06;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-lg overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(2, 6, 23, 0.8) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800/30 transition-colors"
      >
        <SlotIcon className="w-3.5 h-3.5 text-amber-500/60 flex-shrink-0" />
        <span className="text-[0.6875rem] font-display font-semibold text-slate-200 tracking-wide">
          {layout.slot}
        </span>

        {/* Socket count pills */}
        <div className="flex items-center gap-1 ml-auto">
          {activeCount > 0 && (
            <span className="px-1.5 py-[1px] rounded text-[0.5625rem] font-medium text-amber-300/80 bg-amber-500/10 border border-amber-500/15">
              {activeCount} active
            </span>
          )}
          {supportCount > 0 && (
            <span className="px-1.5 py-[1px] rounded text-[0.5625rem] font-medium text-blue-300/80 bg-blue-500/10 border border-blue-500/15">
              {supportCount} support
            </span>
          )}
          <span className="text-[0.5625rem] text-slate-600 ml-1">
            {layout.targetGems.length}/{maxSockets}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-600 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Gem list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-0.5">
              {/* Divider */}
              <div
                className="h-px mb-2"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.08) 20%, rgba(148, 163, 184, 0.08) 80%, transparent 100%)',
                }}
              />
              {layout.targetGems.map((gem, i) => (
                <GemRow key={gem.name} gem={gem} index={i} baseDelay={baseDelay} />
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

interface GemSetupBySlotSectionProps {
  targetGemLayout: TargetSlotLayout[];
}

function GemSetupBySlotSectionRaw({ targetGemLayout }: GemSetupBySlotSectionProps) {
  if (!targetGemLayout || targetGemLayout.length === 0) return null;

  const sorted = [...targetGemLayout].sort(
    (a, b) => (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99)
  );

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.18)',
          }}
        >
          <Gem className="w-3 h-3 text-amber-400/70" />
        </div>
        <span className="text-[0.6875rem] font-display font-semibold text-amber-400/80 uppercase tracking-wider">
          Gem Setup by Slot
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent" />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-amber-400/70" />
          <span className="text-[0.5625rem] text-slate-500">Active skill</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-blue-400/60" />
          <span className="text-[0.5625rem] text-slate-500">Support gem</span>
        </div>
      </div>

      {/* Slot cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.map((layout, i) => (
          <SlotCard key={layout.slot} layout={layout} index={i} />
        ))}
      </div>
    </div>
  );
}

export const GemSetupBySlotSection = memo(GemSetupBySlotSectionRaw);
