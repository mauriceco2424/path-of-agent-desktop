/**
 * MapPoolSection — Map tier distribution with horizontal bars.
 * Shows total maps, highest tier, and estimated value.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Map, Mountain } from 'lucide-react';
import type { StashOverviewData } from '../../../../../shared/types/StashOverview';

interface MapPoolSectionProps {
  mapPool: StashOverviewData['mapPool'];
}

/** Tier colors: low=green, mid=yellow, high=red */
function getTierColor(tier: number): string {
  if (tier <= 5) return '#34d399';
  if (tier <= 10) return '#fbbf24';
  if (tier <= 14) return '#f97316';
  return '#ef4444';
}

export const MapPoolSection = memo(function MapPoolSection({ mapPool }: MapPoolSectionProps) {
  const maxCount = useMemo(
    () => Math.max(...mapPool.tiers.map(t => t.count), 1),
    [mapPool.tiers],
  );

  if (mapPool.totalMaps === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-12 text-slate-500"
      >
        <Map className="w-8 h-8 mb-3 text-slate-600" />
        <span className="text-sm">No maps found in stash</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-5"
    >
      {/* Summary row */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(16,185,129,0.08) 100%)',
              border: '1px solid rgba(52,211,153,0.25)',
            }}
          >
            <Map className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-lg font-display font-bold text-emerald-300">{mapPool.totalMaps.toLocaleString()}</div>
            <div className="text-[0.5625rem] text-slate-500 uppercase tracking-wider">Total Maps</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-red-400" />
          <div>
            <div className="text-lg font-display font-bold text-red-300">T{mapPool.highestTier}</div>
            <div className="text-[0.5625rem] text-slate-500 uppercase tracking-wider">Highest</div>
          </div>
        </div>
        <div className="text-right ml-auto">
          <div className="text-sm font-mono text-amber-300 tabular-nums">≈{mapPool.estimatedValueChaos.toLocaleString()}c</div>
          <div className="text-[0.5625rem] text-slate-500">Est. Value</div>
        </div>
      </div>

      {/* Tier distribution bars */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
          <span className="text-[0.6875rem] font-display font-semibold text-emerald-300/80 uppercase tracking-wider">
            Tier Distribution
          </span>
        </div>

        {mapPool.tiers.map((tier, i) => {
          const pct = (tier.count / maxCount) * 100;
          const color = getTierColor(tier.tier);

          return (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.03, duration: 0.25 }}
              className="flex items-center gap-3"
            >
              <span className="text-[0.6875rem] font-mono text-slate-400 w-8 text-right tabular-nums">
                T{tier.tier}
              </span>
              <div className="flex-1 h-3 rounded-full bg-slate-800/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.15 + i * 0.03, duration: 0.4, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${color} 0%, ${color}60 100%)`,
                    boxShadow: `0 0 6px ${color}30`,
                  }}
                />
              </div>
              <span className="text-[0.6875rem] font-mono text-slate-300 w-12 text-right tabular-nums">
                {tier.count}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
});
