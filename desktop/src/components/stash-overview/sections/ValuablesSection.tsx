/**
 * ValuablesSection — Valuable unique items and divination cards.
 * Shows items sorted by value with GGG icons, rarity borders, and tab location.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Scroll } from 'lucide-react';
import type { ValuableItem, CurrencyEntry } from '../../../../../shared/types/StashOverview';

interface ValuablesSectionProps {
  valuableItems: ValuableItem[];
  divinationCards: CurrencyEntry[];
}

function formatValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

/** PoE rarity border colors */
function getRarityBorder(rarity: number): string {
  switch (rarity) {
    case 3: return 'rgba(175, 96, 37, 0.6)';  // Unique
    case 2: return 'rgba(255, 255, 119, 0.4)'; // Rare
    case 1: return 'rgba(136, 136, 255, 0.4)'; // Magic
    default: return 'rgba(148, 163, 184, 0.15)';
  }
}

function getRarityGlow(rarity: number): string {
  switch (rarity) {
    case 3: return '0 0 8px rgba(249,115,22,0.2)';
    case 2: return '0 0 6px rgba(234,179,8,0.15)';
    default: return 'none';
  }
}

export const ValuablesSection = memo(function ValuablesSection({ valuableItems, divinationCards }: ValuablesSectionProps) {
  if (valuableItems.length === 0 && divinationCards.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 text-slate-500"
      >
        <Crown className="w-8 h-8 mb-3 text-slate-600" />
        <span className="text-sm">No valuable items found</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Unique items */}
      {valuableItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-gradient-to-b from-orange-400 to-orange-600" />
              <Crown className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[0.6875rem] font-display font-semibold text-orange-300/80 uppercase tracking-wider">
                Valuable Items
              </span>
              <span className="text-[0.5625rem] text-slate-600 font-mono">({valuableItems.length})</span>
            </div>
            <span className="text-[0.625rem] text-slate-500 font-mono tabular-nums">
              {formatValue(valuableItems.reduce((s, i) => s + i.chaosValue, 0))}c
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {valuableItems.map((item, i) => (
              <motion.div
                key={`${item.name}-${item.tabName}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/30 transition-colors"
                style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(2,6,23,0.5) 100%)',
                  border: `1px solid ${getRarityBorder(item.rarity)}`,
                  boxShadow: getRarityGlow(item.rarity),
                }}
              >
                {item.icon ? (
                  <img src={item.icon} alt="" className="w-9 h-9 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-4 h-4 text-orange-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.8125rem] font-semibold truncate" style={{
                    color: item.rarity === 3 ? '#af6025' : item.rarity === 2 ? '#ffff77' : '#c8c8c8',
                  }}>
                    {item.name || item.typeLine}
                  </div>
                  {item.name && item.typeLine && item.name !== item.typeLine && (
                    <div className="text-[0.625rem] text-slate-500 truncate">{item.typeLine}</div>
                  )}
                  <div className="text-[0.5625rem] text-slate-600 truncate">Tab: {item.tabName}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[0.8125rem] text-amber-300 font-bold font-mono tabular-nums">
                    {formatValue(item.chaosValue)}c
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Divination cards */}
      {divinationCards.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
              <Scroll className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
                Divination Cards
              </span>
              <span className="text-[0.5625rem] text-slate-600 font-mono">({divinationCards.length})</span>
            </div>
            <span className="text-[0.625rem] text-slate-500 font-mono tabular-nums">
              {formatValue(divinationCards.reduce((s, e) => s + e.totalChaosValue, 0))}c
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {divinationCards.map((card, i) => (
              <motion.div
                key={card.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.03, duration: 0.25 }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/40 transition-colors"
                style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.4) 100%)',
                  border: '1px solid rgba(20,184,166,0.12)',
                }}
              >
                {card.icon ? (
                  <img src={card.icon} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                    <Scroll className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.75rem] text-slate-200 truncate">{card.name}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[0.75rem] text-amber-300/90 font-semibold font-mono tabular-nums">
                    ×{card.count}
                  </div>
                  {card.totalChaosValue > 0 && (
                    <div className="text-[0.5625rem] text-slate-500 font-mono tabular-nums">
                      {formatValue(card.totalChaosValue)}c
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});
