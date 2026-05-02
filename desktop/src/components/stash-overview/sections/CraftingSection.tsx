/**
 * CraftingSection — Essences, fossils, catalysts, and fragments.
 * Groups items by type with icons and pricing.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Scroll } from 'lucide-react';
import type { CurrencyEntry } from '../../../../../shared/types/StashOverview';

interface CraftingSectionProps {
  essences: CurrencyEntry[];
  fragments: CurrencyEntry[];
}

function formatValue(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function ItemGroup({
  title,
  icon,
  entries,
  accentColor,
  delay = 0,
}: {
  title: string;
  icon: React.ReactNode;
  entries: CurrencyEntry[];
  accentColor: string;
  delay?: number;
}) {
  if (entries.length === 0) return null;
  const totalValue = entries.reduce((s, e) => s + e.totalChaosValue, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}80 100%)` }} />
          {icon}
          <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-wider" style={{ color: `${accentColor}cc` }}>
            {title}
          </span>
          <span className="text-[0.5625rem] text-slate-600 font-mono">({entries.length})</span>
        </div>
        <span className="text-[0.625rem] text-slate-500 font-mono tabular-nums">
          {formatValue(totalValue)}c
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + i * 0.03, duration: 0.25 }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/40 transition-colors"
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.4) 100%)',
              border: '1px solid rgba(148,163,184,0.08)',
            }}
          >
            {entry.icon ? (
              <img src={entry.icon} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-slate-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[0.75rem] text-slate-200 truncate">{entry.name}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[0.75rem] text-amber-300/90 font-semibold font-mono tabular-nums">
                ×{entry.count.toLocaleString()}
              </div>
              {entry.totalChaosValue > 0 && (
                <div className="text-[0.5625rem] text-slate-500 font-mono tabular-nums">
                  {formatValue(entry.totalChaosValue)}c
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const CraftingSection = memo(function CraftingSection({ essences, fragments }: CraftingSectionProps) {
  if (essences.length === 0 && fragments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 text-slate-500"
      >
        <Sparkles className="w-8 h-8 mb-3 text-slate-600" />
        <span className="text-sm">No crafting materials found</span>
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
      <ItemGroup
        title="Essences"
        icon={<Sparkles className="w-3.5 h-3.5 text-blue-400" />}
        entries={essences}
        accentColor="#3b82f6"
        delay={0.1}
      />
      <ItemGroup
        title="Fragments & Splinters"
        icon={<Scroll className="w-3.5 h-3.5 text-orange-400" />}
        entries={fragments}
        accentColor="#f97316"
        delay={0.2}
      />
    </motion.div>
  );
});
