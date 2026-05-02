/**
 * MetaComparisonPanel Component
 *
 * Displays pre-generated ladder meta analysis inline as a collapsible section.
 * Shows benchmark comparisons, unique items, rare mods, keystones, supports,
 * and auras with usage percentages and reasoning text.
 *
 * @module desktop/src/components/build-detail/MetaComparisonPanel
 */

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Shield,
  Info,
} from 'lucide-react';
import type { MetaReasoning } from '../../../../shared/types/MetaReasoning';
import type { BuildVisualizationResponse } from '../../store';

// ============================================
// Types
// ============================================

interface MetaComparisonPanelProps {
  metaReasoning: MetaReasoning;
  vizData: BuildVisualizationResponse;
}

interface BenchmarkDist {
  p25: number;
  median: number;
  p75: number;
}

// ============================================
// Helpers
// ============================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

// ============================================
// Collapsible Section
// ============================================

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-700/50 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        <span className="text-sm font-display font-semibold text-amber-400/90 uppercase tracking-wide">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs text-slate-500 ml-auto">{count}</span>
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ============================================
// Usage bar + badge
// ============================================

function UsageBar({ usage }: { usage: number }) {
  return (
    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
      <div
        className="h-full bg-amber-500/70 rounded-full"
        style={{ width: `${Math.min(usage, 100)}%` }}
      />
    </div>
  );
}

function UsageBadge({ usage }: { usage: number }) {
  return (
    <span className="text-xs text-slate-400 tabular-nums w-8 text-right shrink-0">
      {Math.round(usage)}%
    </span>
  );
}

// ============================================
// Row with usage bar, name, and "why" tooltip
// ============================================

function ReasonedRow({
  name,
  usage,
  why,
  extra,
}: {
  name: string;
  usage: number;
  why: string;
  extra?: string;
}) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-200 flex-1 truncate">{name}</span>
        {extra && <span className="text-xs text-slate-500 shrink-0">{extra}</span>}
        <UsageBar usage={usage} />
        <UsageBadge usage={usage} />
        <button
          onClick={() => setShowWhy(!showWhy)}
          className="p-0.5 rounded hover:bg-slate-700/50 transition-colors shrink-0"
          title="Show reasoning"
        >
          <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
        </button>
      </div>
      {showWhy && (
        <p className="text-xs text-slate-400 mt-1 ml-0 pl-0 leading-relaxed italic">
          {why}
        </p>
      )}
    </div>
  );
}

// ============================================
// Benchmark row for stats comparison
// ============================================

function BenchmarkRow({
  label,
  buildValue,
  dist,
}: {
  label: string;
  buildValue: number;
  dist: BenchmarkDist;
}) {
  // Calculate position of build value relative to p25-p75 range
  const rangeMin = dist.p25 * 0.5; // extend visual range below p25
  const rangeMax = dist.p75 * 1.5; // extend visual range above p75
  const totalRange = rangeMax - rangeMin || 1;

  const buildPct = Math.min(100, Math.max(0, ((buildValue - rangeMin) / totalRange) * 100));
  const p25Pct = ((dist.p25 - rangeMin) / totalRange) * 100;
  const p75Pct = ((dist.p75 - rangeMin) / totalRange) * 100;
  const medianPct = ((dist.median - rangeMin) / totalRange) * 100;

  const isAboveMedian = buildValue >= dist.median;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span
          className={`text-sm font-medium tabular-nums ${
            isAboveMedian ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {formatNumber(buildValue)}
        </span>
      </div>
      {/* Distribution bar */}
      <div className="relative w-full h-2 bg-slate-700/60 rounded-full">
        {/* P25-P75 range */}
        <div
          className="absolute h-full bg-slate-600/80 rounded-full"
          style={{
            left: `${p25Pct}%`,
            width: `${Math.max(0, p75Pct - p25Pct)}%`,
          }}
        />
        {/* Median marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-slate-400"
          style={{ left: `${medianPct}%` }}
        />
        {/* Build value marker */}
        <div
          className={`absolute top-[-2px] w-2.5 h-2.5 rounded-full border-2 ${
            isAboveMedian
              ? 'bg-emerald-500 border-emerald-300'
              : 'bg-amber-500 border-amber-300'
          }`}
          style={{
            left: `${Math.min(buildPct, 98)}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[0.625rem] text-slate-600">p25: {formatNumber(dist.p25)}</span>
        <span className="text-[0.625rem] text-slate-500">median: {formatNumber(dist.median)}</span>
        <span className="text-[0.625rem] text-slate-600">p75: {formatNumber(dist.p75)}</span>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function MetaComparisonPanel({ metaReasoning, vizData }: MetaComparisonPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const benchmarks = metaReasoning.benchmarks;

  // Group unique items by slot
  const uniquesBySlot = useMemo(() => {
    const grouped: Record<string, typeof metaReasoning.uniqueItems> = {};
    for (const item of metaReasoning.uniqueItems) {
      if (!grouped[item.slot]) grouped[item.slot] = [];
      grouped[item.slot].push(item);
    }
    return grouped;
  }, [metaReasoning.uniqueItems]);

  const rareSlots = useMemo(
    () => Object.entries(metaReasoning.rareModsBySlot).filter(([, mods]) => mods.length > 0),
    [metaReasoning.rareModsBySlot]
  );

  return (
    <div className="mt-4 mx-4 border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/40">
      {/* Collapsed header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-display font-semibold text-slate-200">
          Meta Analysis
        </span>
        <span className="text-xs text-slate-500 ml-auto">
          {metaReasoning.sampleSize} builds &middot; {metaReasoning.league}
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-slate-700/50">
          {/* Benchmarks */}
          <Section title="Benchmarks" defaultOpen={true}>
            <div className="space-y-1">
              <BenchmarkRow
                label="DPS"
                buildValue={vizData.stats.dps}
                dist={benchmarks.dps}
              />
              <BenchmarkRow
                label="Life"
                buildValue={vizData.stats.life}
                dist={benchmarks.life}
              />
              <BenchmarkRow
                label="EHP"
                buildValue={vizData.stats.ehp}
                dist={benchmarks.ehp}
              />
            </div>
            {benchmarks.armour && (
              <div className="mt-2 text-xs text-slate-500">
                Ladder median armour: {formatNumber(benchmarks.armour.median)}
              </div>
            )}
            {benchmarks.lifeRegen && (
              <div className="text-xs text-slate-500">
                Ladder median life regen: {formatNumber(benchmarks.lifeRegen.median)}/s
              </div>
            )}
          </Section>

          {/* Defense Priorities */}
          {metaReasoning.archetypeDefensePriorities.length > 0 && (
            <Section title="Defense Priorities" defaultOpen={false}>
              <div className="space-y-2">
                {metaReasoning.archetypeDefensePriorities.map((p, index) => (
                  <div key={`${p.stat}-${index}`} className="flex items-start gap-2">
                    <Shield className="w-3.5 h-3.5 text-amber-400/70 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm text-slate-200 font-medium">{p.stat}</span>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{p.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Keystones */}
          {metaReasoning.keystones.length > 0 && (
            <Section title="Keystones" count={metaReasoning.keystones.length} defaultOpen={false}>
              <div className="space-y-0.5">
                {metaReasoning.keystones.map((k) => (
                  <ReasonedRow key={k.name} name={k.name} usage={k.usage} why={k.why} />
                ))}
              </div>
            </Section>
          )}

          {/* Unique Items */}
          {metaReasoning.uniqueItems.length > 0 && (
            <Section
              title="Popular Uniques"
              count={metaReasoning.uniqueItems.length}
              defaultOpen={false}
            >
              <div className="space-y-0.5">
                {Object.entries(uniquesBySlot).map(([slot, items]) => (
                  <div key={slot}>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mt-2 mb-1 first:mt-0">
                      {slot}
                    </div>
                    {items.map((item) => (
                      <ReasonedRow
                        key={`${item.slot}-${item.name}`}
                        name={item.name}
                        usage={item.usage}
                        why={item.why}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Rare Mods by Slot */}
          {rareSlots.length > 0 && (
            <Section title="Rare Mod Priorities" count={rareSlots.length} defaultOpen={false}>
              <div className="space-y-1">
                {rareSlots.map(([slot, mods]) => (
                  <RareSlotSection key={slot} slot={slot} mods={mods} />
                ))}
              </div>
            </Section>
          )}

          {/* Support Gems */}
          {metaReasoning.supports.length > 0 && (
            <Section title="Support Gems" count={metaReasoning.supports.length} defaultOpen={false}>
              <div className="space-y-0.5">
                {metaReasoning.supports.map((s) => (
                  <ReasonedRow key={s.name} name={s.name} usage={s.usage} why={s.why} />
                ))}
              </div>
            </Section>
          )}

          {/* Auras */}
          {metaReasoning.auras.length > 0 && (
            <Section title="Auras" count={metaReasoning.auras.length} defaultOpen={false}>
              <div className="space-y-0.5">
                {metaReasoning.auras.map((a) => (
                  <ReasonedRow key={a.name} name={a.name} usage={a.usage} why={a.why} />
                ))}
              </div>
            </Section>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-700/50 text-xs text-slate-500">
            Generated {metaReasoning.generatedAt}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Rare Slot Sub-section
// ============================================

function RareSlotSection({
  slot,
  mods,
}: {
  slot: string;
  mods: Array<{ mod: string; usage: number; why: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-1 text-left hover:bg-slate-800/30 transition-colors rounded"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
        )}
        <span className="text-sm text-slate-300">{slot}</span>
        <span className="text-xs text-slate-500 ml-auto">{mods.length} mods</span>
      </button>
      {open && (
        <div className="ml-5 space-y-0.5">
          {mods.map((m) => (
            <ReasonedRow key={m.mod} name={m.mod} usage={m.usage} why={m.why} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MetaComparisonPanel;
