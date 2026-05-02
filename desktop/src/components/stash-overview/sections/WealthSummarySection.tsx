/**
 * WealthSummarySection — Hero wealth display with category breakdown.
 * Shows total wealth in divine + chaos, breakdown bars, and top valuable stacks.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Coins, Gem, Map, Scroll, Sparkles, Package } from 'lucide-react';
import type { StashOverviewData, CurrencyEntry } from '../../../../../shared/types/StashOverview';

interface WealthSummarySectionProps {
  data: StashOverviewData;
}

interface WealthCategory {
  label: string;
  value: number;
  color: string;
  glowColor: string;
  icon: React.ReactNode;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function sumEntries(entries: CurrencyEntry[]): number {
  return entries.reduce((sum, e) => sum + e.totalChaosValue, 0);
}

export const WealthSummarySection = memo(function WealthSummarySection({ data }: WealthSummarySectionProps) {
  const categories = useMemo((): WealthCategory[] => {
    const cats: WealthCategory[] = [
      { label: 'Liquid Currency', value: sumEntries(data.liquidCurrency), color: '#fbbf24', glowColor: 'rgba(251, 191, 36, 0.38)', icon: <Coins className="w-3.5 h-3.5" /> },
      { label: 'Crafting Materials', value: sumEntries(data.craftingMaterials), color: '#a78bfa', glowColor: 'rgba(167, 139, 250, 0.38)', icon: <Gem className="w-3.5 h-3.5" /> },
      { label: 'Map Pool', value: data.mapPool.estimatedValueChaos, color: '#34d399', glowColor: 'rgba(52, 211, 153, 0.38)', icon: <Map className="w-3.5 h-3.5" /> },
      { label: 'Fragments', value: sumEntries(data.fragments), color: '#f97316', glowColor: 'rgba(249, 115, 22, 0.38)', icon: <Scroll className="w-3.5 h-3.5" /> },
      { label: 'Essences', value: sumEntries(data.essences), color: '#3b82f6', glowColor: 'rgba(59, 130, 246, 0.38)', icon: <Sparkles className="w-3.5 h-3.5" /> },
      { label: 'Divination Cards', value: sumEntries(data.divinationCards), color: '#14b8a6', glowColor: 'rgba(20, 184, 166, 0.38)', icon: <Scroll className="w-3.5 h-3.5" /> },
      { label: 'Valuable Items', value: data.valuableItems.reduce((s, i) => s + i.chaosValue, 0), color: '#ef4444', glowColor: 'rgba(239, 68, 68, 0.38)', icon: <Package className="w-3.5 h-3.5" /> },
    ];
    return cats.filter(c => c.value > 0).sort((a, b) => b.value - a.value);
  }, [data]);

  // Top 5 most valuable single items/stacks
  const topItems = useMemo(() => {
    const items: Array<{ name: string; value: number; icon?: string }> = [];

    // Add currency stacks
    for (const entry of data.liquidCurrency) {
      if (entry.totalChaosValue > 0) items.push({ name: entry.name, value: entry.totalChaosValue, icon: entry.icon });
    }
    // Add valuable uniques
    for (const item of data.valuableItems) {
      items.push({ name: item.name || item.typeLine, value: item.chaosValue, icon: item.icon });
    }

    return items.sort((a, b) => b.value - a.value).slice(0, 5);
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Hero wealth display */}
      <div
        className="relative overflow-hidden rounded-xl p-6"
        style={{
          background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.92) 40%, rgba(8,15,35,0.96) 100%)',
          border: '1px solid rgba(251,191,36,0.2)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5), 0 0 60px rgba(251,191,36,0.03), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{
          background: 'linear-gradient(90deg, transparent 8%, rgba(251,191,36,0.15) 25%, rgba(253,230,138,0.45) 50%, rgba(251,191,36,0.15) 75%, transparent 92%)',
        }} />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
                Total Wealth
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-display font-bold text-amber-200" style={{ textShadow: '0 0 20px rgba(251,191,36,0.3)' }}>
                {data.divineRate ? `${data.totalWealthDivine.toFixed(1)} div` : `${formatNumber(data.totalWealthChaos)}c`}
              </span>
              {data.divineRate && (
                <span className="text-sm text-slate-400 font-mono">
                  ≈ {formatNumber(data.totalWealthChaos)}c
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-[0.625rem] text-slate-500">
            <div>{data.tabsScanned} tabs scanned</div>
            {data.divineRate && <div>1 div = {Math.round(data.divineRate)}c</div>}
          </div>
        </div>
      </div>

      {/* Category breakdown bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
            Wealth Breakdown
          </span>
        </div>

        {categories.map((cat, i) => {
          const pct = data.totalWealthChaos > 0 ? (cat.value / data.totalWealthChaos) * 100 : 0;
          return (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${cat.color}20 0%, ${cat.color}08 100%)`,
                  border: `1px solid ${cat.color}40`,
                }}
              >
                <div style={{ color: cat.color }}>{cat.icon}</div>
              </div>
              <span className="text-[0.75rem] text-slate-300 w-32 flex-shrink-0">{cat.label}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${cat.color} 0%, ${cat.glowColor} 100%)`,
                  }}
                />
              </div>
              <span className="text-[0.6875rem] text-slate-400 font-mono w-16 text-right tabular-nums">
                {formatNumber(cat.value)}c
              </span>
              <span className="text-[0.5625rem] text-slate-600 font-mono w-10 text-right tabular-nums">
                {pct.toFixed(0)}%
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Top valuable stacks */}
      {topItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
            <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
              Most Valuable
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {topItems.map((item, i) => (
              <motion.div
                key={`${item.name}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(2,6,23,0.6) 100%)',
                  border: '1px solid rgba(148,163,184,0.1)',
                }}
              >
                {item.icon && (
                  <img src={item.icon} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.75rem] text-slate-200 truncate">{item.name}</div>
                </div>
                <span className="text-[0.6875rem] text-amber-300 font-mono font-semibold tabular-nums flex-shrink-0">
                  {formatNumber(item.value)}c
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});
