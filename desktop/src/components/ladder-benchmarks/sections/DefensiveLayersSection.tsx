/**
 * DefensiveLayersSection Component
 *
 * Compact table showing defensive layers from the ladder: usage percentage
 * (with inline mini-bar), ladder average with range, and user comparison.
 *
 * Designed to sit side-by-side with the Damage Profile section in a
 * two-column layout on the Overview tab.
 *
 * Part of the Ladder Benchmarks Modal - "The Warden's Bulwark"
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefensiveLayer } from '../../../../../shared/types/LadderData';
import type { StatBenchmark } from '../../../../../backend/src/services/ladder-stats/cached-ladder-analyzer';

// =============================================================================
// Types
// =============================================================================

interface DefensiveLayersSectionProps {
  layers: DefensiveLayer[];
  /** Optional user defensive values keyed by layer name */
  userDefenses?: Record<string, number | undefined>;
  /** Optional enriched benchmark ranges keyed by layer name */
  enrichedRanges?: Record<string, StatBenchmark | undefined>;
  /** Animation stagger delay base (ms) */
  staggerBase?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function isPercentStat(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('block') ||
    lower.includes('suppression') ||
    lower.includes('resistance') ||
    lower.includes('damage reduction')
  );
}

function fmtVal(name: string, value: number): string {
  if (isPercentStat(name)) return `${Math.round(value)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(0)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function fmtRange(name: string, min: number, max: number): string {
  return `${fmtVal(name, min)} – ${fmtVal(name, max)}`;
}

// =============================================================================
// Layer Row Sub-Component (compact — inline mini-bar instead of full bar)
// =============================================================================

interface LayerRowProps {
  layer: DefensiveLayer;
  userValue?: number;
  range?: StatBenchmark;
  index: number;
}

function LayerRow({ layer, userValue, range, index }: LayerRowProps) {
  const hasUser = userValue != null && userValue > 0;
  const aboveAvg = hasUser && userValue >= layer.average;
  const usagePct = Math.min(layer.usage, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="grid items-center py-[7px] border-b border-slate-800/30 last:border-b-0"
      style={{ gridTemplateColumns: '1fr 110px 90px 60px' }}
    >
      {/* Layer name */}
      <span className="text-xs text-slate-300 font-medium truncate pr-3">
        {layer.name}
      </span>

      {/* Usage — mini-bar + percentage */}
      <div className="flex items-center gap-1.5">
        <div className="relative h-[3px] flex-1 rounded-full bg-slate-800/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usagePct}%` }}
            transition={{ delay: 0.1 + index * 0.03, duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, rgba(180, 83, 9, ${0.5 + usagePct / 200}) 0%, rgba(251, 191, 36, ${0.6 + usagePct / 200}) 100%)`,
            }}
          />
        </div>
        <span
          className="text-[0.5625rem] font-semibold tabular-nums w-[24px] text-right"
          style={{ color: `rgba(251, 191, 36, ${0.45 + (usagePct / 100) * 0.55})` }}
        >
          {Math.round(layer.usage)}%
        </span>
      </div>

      {/* Ladder average + range */}
      <div className="text-right pr-2">
        <span className="text-[0.6875rem] text-slate-300 font-semibold tabular-nums">
          {fmtVal(layer.name, layer.average)}
        </span>
        {range && range.max > 0 && (
          <span className="text-[0.5625rem] text-slate-600 tabular-nums ml-1">
            {fmtRange(layer.name, range.min, range.max)}
          </span>
        )}
      </div>

      {/* User value */}
      <div className="text-right">
        {hasUser ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold tabular-nums',
              aboveAvg ? 'text-emerald-400' : 'text-amber-400'
            )}
          >
            {fmtVal(layer.name, userValue)}
            {aboveAvg ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </span>
        ) : (
          <Minus className="w-3 h-3 text-slate-700 ml-auto" />
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function DefensiveLayersSectionRaw({
  layers,
  userDefenses,
  enrichedRanges,
  staggerBase = 0,
}: DefensiveLayersSectionProps) {
  if (layers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: staggerBase * 0.001, duration: 0.3 }}
      className="rounded-lg p-3"
      style={{
        background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.12) 0%, rgba(15, 12, 8, 0.8) 100%)',
        border: '1px solid rgba(34, 211, 238, 0.20)',
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck
          className="w-3.5 h-3.5 text-cyan-400"
          style={{ filter: 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.6))' }}
        />
        <span className="text-[0.625rem] font-display font-semibold text-cyan-300 uppercase tracking-wider">
          Defensive Layers
        </span>
      </div>

      {/* Column headers */}
      <div
        className="grid items-center pb-1.5 mb-1 border-b border-slate-700/40"
        style={{ gridTemplateColumns: '1fr 110px 90px 60px' }}
      >
        <span className="text-[0.5625rem] text-slate-600 uppercase tracking-wider">Layer</span>
        <span className="text-[0.5625rem] text-slate-600 uppercase tracking-wider text-right">Usage</span>
        <span className="text-[0.5625rem] text-slate-600 uppercase tracking-wider text-right pr-2">Avg</span>
        <span className="text-[0.5625rem] text-slate-600 uppercase tracking-wider text-right">You</span>
      </div>

      {/* Layer rows */}
      {layers.map((layer, i) => (
        <LayerRow
          key={layer.name}
          layer={layer}
          userValue={userDefenses?.[layer.name]}
          range={enrichedRanges?.[layer.name]}
          index={i}
        />
      ))}
    </motion.div>
  );
}

export const DefensiveLayersSection = memo(DefensiveLayersSectionRaw);
