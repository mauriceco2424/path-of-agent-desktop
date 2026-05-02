/**
 * ToolStepCard Component
 *
 * Renders a LangChain agent tool call inline in chat messages.
 * Shows tool status (running/complete/error), input summary,
 * and structured result with tool-specific renderers.
 *
 * Visual sync: Uses amber theme to match chat prose h2 sections
 * (amber left border, warm tones instead of cold emerald/slate).
 */

import { useState, useEffect, useMemo, useRef, Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Layers,
  Gem,
  Settings2,
  Star,
  Key,
  CircleDot,
  Sparkles,
  BarChart3,
  Check,
  Package,
  ShoppingBag,
  CircleSlash,
  Network,
  Filter,
  Link2,
  GitBranch,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDesktopStore } from '../../store';
import type { StructuredMods } from '../../store';
import { ItemTooltip } from '../visualization/ItemTooltip';
import { GemTooltip } from '../visualization/GemTooltip';
import { openExternal } from '../../utils/open-external';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { formatDps } from '../../utils/format';
import type { ToolDiagnostics } from '../../../../shared/types/ToolDiagnostics';
import { TreeNodeIcon } from '../visualization/tree/ui/TreeNodeIcon';
import { navigateToRef, navigateToRefCrossTab, inferPathwayFromRef } from '../../utils/navigate-to-ref';
import { useGearPackage } from '../../store/gearPackageStore';
import { useSidebarSpriteData } from '../visualization/tree/hooks/useSidebarSpriteData';
import { useTreeNodeEnrichment } from '../../hooks/useTreeNodeEnrichment';
import { useGemLookup, type GemTooltipPayload } from '../../hooks/useGemLookup';

// =============================================================================
// Types
// =============================================================================

interface ToolStepCardProps {
  tool: string;
  displayName: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  defaultExpanded?: boolean;
  /** Human-readable description of what the tool is doing */
  description?: string;
  /** Whether this tool call was run deterministically by preflight (no LLM involved) */
  preflight?: boolean;
  /** Sequential index for DOM identification (used by simresult pill scroll) */
  stepIndex?: number;
}

// =============================================================================
// Utility helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

/** Render config overrides as individual subtle pills */
function ConfigPills({ configApplied }: { configApplied: string }) {
  const items = configApplied.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[0.5625rem]
          bg-violet-500/8 text-violet-400/50 font-medium whitespace-nowrap">
          {i === 0 && <Settings2 className="w-2 h-2" />}
          {item}
        </span>
      ))}
    </>
  );
}

/** Strip XML-like tags and LLM-added number prefixes from tool labels
 *  e.g., "<notable>Toxic Strikes</notable>" -> "Toxic Strikes"
 *  e.g., "3) Suppression package" -> "Suppression package"
 *  e.g., "12. Helmet upgrade" -> "Helmet upgrade"
 */
export function stripToolTags(text: string): string {
  return text
    .replace(/<\/?[a-z][a-z0-9-]*[^>]*>/gi, '')
    .replace(/^(?:C\d+-\d+\)\s*|\d+[.)]\s*)/, '');
}

/** Format a significantExtras pill based on its displayMode */
function formatExtraPill(extra: { label: string; value: number; percent: number; displayMode?: string }): string {
  const sign = extra.value >= 0 ? '+' : '';
  switch (extra.displayMode) {
    case 'flat':
      return `${sign}${Math.round(extra.value)} ${extra.label}`;
    case 'points':
      return `${sign}${extra.value.toFixed(1)}% ${extra.label}`;
    case 'percent':
    default:
      return `${sign}${extra.percent.toFixed(1)}% ${extra.label}`;
  }
}

// =============================================================================
// Result Renderers
// =============================================================================

/** Resistance status icon/color */
function resDisplay(value: number, cap = 75) {
  const capped = value >= cap;
  return {
    text: `${value}%`,
    color: capped ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-amber-400',
    icon: capped ? '\u2713' : '\u26A0',
  };
}

export function FullCalcsResult({ data }: { data: Record<string, unknown> }) {
  const res = (data.resistances ?? data) as Record<string, number>;
  const fire = resDisplay(Number(res.fire ?? res.fireRes ?? 0));
  const cold = resDisplay(Number(res.cold ?? res.coldRes ?? 0));
  const lightning = resDisplay(Number(res.lightning ?? res.lightningRes ?? 0));
  const chaos = resDisplay(Number(res.chaos ?? res.chaosRes ?? 0), 0);

  const life = Number(data.life ?? data.totalLife ?? 0);
  const es = Number(data.energyShield ?? data.es ?? 0);
  const dps = Number(data.dps ?? data.fullDps ?? data.totalDps ?? 0);

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-sm font-mono px-1">
      <span>Fire: <span className={fire.color}>{fire.text} {fire.icon}</span></span>
      <span>Cold: <span className={cold.color}>{cold.text} {cold.icon}</span></span>
      <span>Ltng: <span className={lightning.color}>{lightning.text} {lightning.icon}</span></span>
      <span>Chaos: <span className={chaos.color}>{chaos.text} {chaos.icon}</span></span>

      <span className="text-slate-300">Life: {formatNumber(life)}</span>
      <span className="text-slate-300">ES: {formatNumber(es)}</span>
      <span className="col-span-2 text-slate-300">DPS: {formatNumber(dps)}</span>
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

export function ConstructItemResult({ data }: { data: Record<string, unknown> }) {
  const baseName = String(data.baseName ?? data.name ?? 'Unknown Item');
  const ilvl = data.itemLevel ?? data.ilvl;
  const mods = (data.mods ?? data.affixes ?? []) as Array<{
    text?: string;
    tier?: number | string;
    [k: string]: unknown;
  }>;
  const warnings = (data.warnings ?? []) as string[];

  const tierColors: Record<string, string> = {
    '1': 'text-emerald-400',
    '2': 'text-teal-400',
    '3': 'text-blue-400',
    '4': 'text-slate-400',
    '5': 'text-slate-500',
  };

  return (
    <div className="text-sm space-y-1 px-1">
      <div className="text-slate-200 font-medium">
        {baseName}{ilvl ? ` (ilvl ${ilvl})` : ''}
      </div>
      {mods.map((mod, i) => {
        const tierStr = String(mod.tier ?? '');
        const tierColor = tierColors[tierStr] ?? 'text-slate-500';
        return (
          <div key={i} className="text-slate-400 font-mono text-xs">
            {String(mod.text ?? mod)}
            {tierStr && (
              <span className={cn('ml-2', tierColor)}>T{tierStr}</span>
            )}
          </div>
        );
      })}
      {warnings.map((w, i) => (
        <div key={i} className="text-amber-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {w}
        </div>
      ))}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

export function EquipTestResult({ data }: { data: Record<string, unknown> }) {
  const changes = (data.changes ?? data.comparison ?? data.deltas ?? []) as Array<{
    stat?: string;
    before?: number;
    after?: number;
    change?: string | number;
    label?: string;
    [k: string]: unknown;
  }>;
  const warnings = (data.warnings ?? []) as string[];

  if (changes.length === 0) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-sm px-1 space-y-2">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="pr-4 font-normal">Stat</th>
            <th className="pr-4 font-normal">Before</th>
            <th className="pr-4 font-normal">After</th>
            <th className="font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((row, i) => {
            const before = Number(row.before ?? 0);
            const after = Number(row.after ?? 0);
            const diff = after - before;
            const isPositive = diff > 0;
            const diffColor = diff === 0
              ? 'text-slate-500'
              : isPositive ? 'text-emerald-400' : 'text-red-400';
            const arrow = diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '';

            return (
              <tr key={i} className="text-slate-300">
                <td className="pr-4">{String(row.stat ?? row.label ?? '')}</td>
                <td className="pr-4">{formatNumber(before)}</td>
                <td className="pr-4">{formatNumber(after)}</td>
                <td className={diffColor}>
                  {row.change != null ? String(row.change) : `${diff > 0 ? '+' : ''}${formatNumber(diff)}`} {arrow}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {warnings.map((w, i) => (
        <div key={i} className="text-amber-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {w}
        </div>
      ))}
    </div>
  );
}

function QueryModPoolResult({ data }: { data: Record<string, unknown> }) {
  const stat = String(data.stat ?? data.query ?? '');
  const slot = String(data.slot ?? '');
  const available = Boolean(data.available ?? data.found);
  const bestTier = data.bestTier as { tier?: number | string; name?: string; min?: number; max?: number } | undefined;
  const tradeStatId = String(data.tradeStatId ?? data.trade_stat_id ?? '');
  const mods = (data.mods ?? []) as Array<{
    name?: string;
    tier?: number | string;
    min?: number;
    max?: number;
    type?: string;
    [k: string]: unknown;
  }>;

  return (
    <div className="text-sm px-1 space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
        {stat && <span className="text-slate-300">Stat: <span className="text-slate-200">{stat}</span></span>}
        {slot && <span className="text-slate-300">Slot: <span className="text-slate-200">{slot}</span></span>}
        <span className={available ? 'text-emerald-400' : 'text-red-400'}>
          {available ? 'Available' : 'Not Available'}
        </span>
        {tradeStatId && <span className="text-slate-500">ID: {tradeStatId}</span>}
      </div>
      {bestTier && (
        <div className="text-xs text-slate-400">
          Best: T{String(bestTier.tier ?? '?')}
          {bestTier.name ? ` (${bestTier.name})` : ''}
          {bestTier.min != null && bestTier.max != null ? ` [${bestTier.min}-${bestTier.max}]` : ''}
        </div>
      )}
      {mods.length > 0 && (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="pr-3 font-normal">Mod</th>
              <th className="pr-3 font-normal">Tier</th>
              <th className="pr-3 font-normal">Range</th>
              <th className="font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {mods.map((mod, i) => (
              <tr key={i} className="text-slate-400">
                <td className="pr-3">{String(mod.name ?? '')}</td>
                <td className="pr-3">T{String(mod.tier ?? '?')}</td>
                <td className="pr-3">
                  {mod.min != null && mod.max != null ? `${mod.min}-${mod.max}` : '-'}
                </td>
                <td className="text-slate-500">{String(mod.type ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

function EquipAndTestResult({ data }: { data: Record<string, unknown> }) {
  const verdict = String(data.verdict ?? '');
  const verdictReasons = (data.verdictReasons ?? data.reasons ?? []) as string[];
  const changes = (data.changes ?? data.statChanges ?? []) as Array<{
    stat?: string;
    label?: string;
    before?: number;
    after?: number;
    change?: string | number;
    status?: string;
    [k: string]: unknown;
  }>;

  const verdictColor = verdict.toUpperCase() === 'UPGRADE'
    ? 'text-emerald-400'
    : verdict.toUpperCase() === 'SIDEGRADE'
      ? 'text-amber-400'
      : verdict.toUpperCase() === 'REJECTED'
        ? 'text-red-400'
        : 'text-slate-300';

  const statusColor = (status: string) => {
    switch (status) {
      case 'warning': return 'text-amber-400';
      case 'rejected': return 'text-red-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="text-sm px-1 space-y-2">
      <div className={cn('text-base font-semibold', verdictColor)}>
        {verdict.toUpperCase() || 'UNKNOWN'}
      </div>
      {verdictReasons.length > 0 && (
        <div className="space-y-0.5">
          {verdictReasons.map((r, i) => (
            <div key={i} className="text-xs text-slate-400">{r}</div>
          ))}
        </div>
      )}
      {changes.length > 0 && (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="pr-4 font-normal">Stat</th>
              <th className="pr-4 font-normal">Before</th>
              <th className="pr-4 font-normal">After</th>
              <th className="font-normal">Change</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((row, i) => {
              const before = Number(row.before ?? 0);
              const after = Number(row.after ?? 0);
              const diff = after - before;
              const rowColor = row.status ? statusColor(row.status) : (
                diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-400' : 'text-red-400'
              );
              return (
                <tr key={i} className={rowColor}>
                  <td className="pr-4">{String(row.stat ?? row.label ?? '')}</td>
                  <td className="pr-4">{formatNumber(before)}</td>
                  <td className="pr-4">{formatNumber(after)}</td>
                  <td>
                    {row.change != null
                      ? String(row.change)
                      : `${diff > 0 ? '+' : ''}${formatNumber(diff)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

function SearchTradeResult({ data }: { data: Record<string, unknown> }) {
  const slots = Array.isArray(data.slots)
    ? data.slots as Array<{
        slot?: string;
        totalResults?: number;
        tradeUrl?: string;
        selectedProbeLabel?: string;
        probes?: Array<{
          selected?: boolean;
          cheapestPrice?: { amount?: number; currency?: string };
          thirdPrice?: { amount?: number; currency?: string };
          fifthPrice?: { amount?: number; currency?: string };
        }>;
      }>
    : [];
  const formatSlotLabel = (slot: string | undefined): string => {
    if (!slot) return 'Unknown Slot';
    return slot
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };
  const formatProbePrice = (price: { amount?: number; currency?: string } | undefined): string | null => {
    if (!price || typeof price.amount !== 'number') return null;
    const suffix = price.currency === 'divine' ? 'd' : price.currency === 'chaos' ? 'c' : ` ${price.currency ?? ''}`.trim();
    return `${price.amount}${suffix}`;
  };

  if (slots.length > 0) {
    const matchedSlots = slots.filter((slot) => Number(slot.totalResults ?? 0) > 0).length;
    const totalResults = slots.reduce((sum, slot) => sum + Number(slot.totalResults ?? 0), 0);

    return (
      <div className="text-sm px-1 space-y-2">
        <div className="text-slate-300">
          Matched {matchedSlots}/{slots.length} slots
          {totalResults > 0 ? ` • ${totalResults} total result${totalResults !== 1 ? 's' : ''}` : ''}
        </div>
        <div className="space-y-1.5">
          {slots.map((slot, index) => {
            const count = Number(slot.totalResults ?? 0);
            const tradeUrl = typeof slot.tradeUrl === 'string' ? slot.tradeUrl : '';
            const selectedProbe = Array.isArray(slot.probes)
              ? slot.probes.find((probe) => probe?.selected) ?? slot.probes[slot.probes.length - 1]
              : undefined;
            const cheapest = formatProbePrice(selectedProbe?.cheapestPrice);
            const third = formatProbePrice(selectedProbe?.thirdPrice);
            const fifth = formatProbePrice(selectedProbe?.fifthPrice);

            return (
              <div key={`${slot.slot ?? 'slot'}-${index}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-stone-200 text-xs font-medium">
                    {formatSlotLabel(slot.slot)}
                  </div>
                  <div className="text-[0.6875rem] text-slate-400">
                    {count} result{count !== 1 ? 's' : ''}
                    {cheapest ? ` • floor ${cheapest}` : ''}
                    {third ? ` • #3 ${third}` : fifth ? ` • #5 ${fifth}` : ''}
                  </div>
                  {typeof slot.selectedProbeLabel === 'string' && slot.selectedProbeLabel.length > 0 ? (
                    <div className="text-[0.625rem] text-slate-500 truncate">
                      {slot.selectedProbeLabel}
                    </div>
                  ) : null}
                </div>
                {tradeUrl ? (
                  <button
                    onClick={() => { openExternal(tradeUrl); }}
                    className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  const count = data.totalResults ?? data.count ?? data.total ?? '?';
  const budget = data.budget ?? data.maxPrice;
  const url = data.tradeUrl ?? data.url;
  const hasUrl = typeof url === 'string' && url.length > 0;

  return (
    <div className="text-sm px-1 space-y-1">
      <span className="text-slate-300">
        Found {String(count)} items{budget ? ` within ${String(budget)} budget` : ''}
      </span>
      {hasUrl && (
        <button
          onClick={() => { openExternal(url); }}
          className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
        >
          <ExternalLink className="w-3 h-3" />
          Open on Trade Site
        </button>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

function ValidateItemsResult({ data }: { data: Record<string, unknown> }) {
  const items = (data.items ?? data.results ?? []) as Array<{
    name?: string;
    dpsChange?: string;
    ehpChange?: string;
    price?: string | number;
    verdict?: string;
    [k: string]: unknown;
  }>;

  if (items.length === 0) return <DefaultResult data={data} />;

  return (
    <div className="text-sm px-1 space-y-1">
      {items.map((item, i) => {
        const verdictColor = item.verdict === 'Upgrade'
          ? 'text-emerald-400'
          : item.verdict === 'Downgrade' ? 'text-red-400' : 'text-slate-400';
        return (
          <div key={i} className="text-xs text-slate-300 font-mono">
            <span className="text-slate-500">{i + 1}.</span>{' '}
            {item.name ?? 'Item'}{' '}
            {item.dpsChange && <span className="text-slate-400">— {item.dpsChange} DPS</span>}
            {item.ehpChange && <span className="text-slate-400">, {item.ehpChange} EHP</span>}
            {item.price != null && <span className="text-amber-400"> — {String(item.price)}c</span>}
            {item.verdict && <span className={cn('ml-1', verdictColor)}>{item.verdict}</span>}
          </div>
        );
      })}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/**
 * GemSwapsResult - Custom renderer for test_gem_swaps tool
 *
 * Shows baseline setup and comparison of each gem swap result
 * with visual DPS change indicators.
 */
function GemSwapsResult({ data }: { data: Record<string, unknown> }) {
  const { gemMap, ready } = useGemLookup();
  const callNumber = data.callNumber as number | undefined;
  const baseline = data.baseline as {
    groupLabel?: string;
    gems?: string[];
    gemDetails?: ToolGemRef[];
    dps?: number;
    ehp?: number;
    life?: number;
  } | undefined;

  const results = (data.results ?? []) as Array<{
    swap?: {
      removed?: string;
      added?: string;
      removedLevel?: number;
      addedLevel?: number;
    };
    success?: boolean;
    dps?: number;
    change?: { absolute?: number; percent?: number };
    ehp?: number;
    ehpChange?: { absolute?: number; percent?: number };
    life?: number;
    lifeChange?: { absolute?: number; percent?: number };
    significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
    configApplied?: string;
    error?: string;
    ref?: string;
  }>;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;
  const summary = data.summary as string | undefined;

  if (!baseline || !results.length) {
    return <DefaultResult data={data} />;
  }

  // Sort results by percent change (best first)
  const sortedResults = [...results].sort((a, b) => {
    const aPercent = a.change?.percent ?? -Infinity;
    const bPercent = b.change?.percent ?? -Infinity;
    return bPercent - aPercent;
  });

  return (
    <div className="text-sm px-1 space-y-3">
      <div className="card-forge rounded-xl px-3 py-3 border border-amber-500/15 shadow-[0_0_32px_rgba(251,191,36,0.06)] space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="text-stone-200 font-medium not-italic normal-case font-sans">
            {baseline.groupLabel || 'Socket Group'}
          </span>
          <span className="text-stone-500">{baseline.gems?.length ?? 0} links</span>
          <span className="text-amber-300">{formatNumber(baseline.dps ?? 0)} DPS</span>
          {baseline.ehp != null && baseline.ehp > 0 && (
            <span className="text-blue-300">{formatNumber(baseline.ehp)} EHP</span>
          )}
          {baseline.life != null && baseline.life > 0 && (
            <span className="text-green-300">{formatNumber(baseline.life)} Life</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(baseline.gemDetails && baseline.gemDetails.length > 0 ? baseline.gemDetails : (baseline.gems ?? []).map((name) => ({ name, level: undefined as number | undefined }))).map((gem, index) => (
            <GemTooltipTrigger
              key={`${gem.name}-${gem.level ?? 'na'}-${index}`}
              gem={gem}
              gemMap={gemMap}
              ready={ready}
            >
              <span className="cursor-help">
                <ToolGemOrb
                  gem={gem}
                  gemMap={gemMap}
                  ready={ready}
                  size="xs"
                />
              </span>
            </GemTooltipTrigger>
          ))}
        </div>
        {baselineConfig && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[0.625rem] text-slate-500 uppercase tracking-wider">Config:</span>
            <span className="text-[0.625rem] text-slate-400 font-mono">{baselineConfig}</span>
          </div>
        )}
      </div>

      {/* Swap results */}
      <div className="space-y-1.5">
        <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
          Tested Swaps
        </div>
        <div className="space-y-1">
          {sortedResults.map((result, i) => {
            const percent = result.change?.percent ?? 0;
            const isPositive = percent > 0;
            const isNegative = percent < 0;
            const isNeutral = percent === 0;

            const ehpPercent = result.ehpChange?.percent ?? 0;
            const lifePercent = result.lifeChange?.percent ?? 0;

            return (
              <div
                key={i}
                id={`skill-setup-c${callNumber ?? 0}-${i + 1}`}
                data-ref={result.ref?.toLowerCase()}
                className={cn(
                  'relative py-1.5 px-2 rounded-md font-mono text-xs',
                  'bg-slate-900/40 border-l-2 transition-[box-shadow] duration-300',
                  isPositive && 'border-emerald-500/60',
                  isNegative && 'border-red-500/60',
                  isNeutral && 'border-stone-500/40',
                  !result.success && 'border-red-500/40 opacity-60'
                )}
              >
                {result.configApplied && (
                  <div className="absolute top-1.5 right-2 flex items-center gap-1">
                    <ConfigPills configApplied={result.configApplied} />
                  </div>
                )}
                {/* Row 1: Icon bundle - removed orb -> arrow -> added orb */}
                <div className="flex items-center gap-1.5 mb-1">
                  {result.swap?.removed && (
                    <GemTooltipTrigger
                      gem={{ name: result.swap.removed, level: result.swap.removedLevel }}
                      gemMap={gemMap}
                      ready={ready}
                    >
                      <div className="cursor-help">
                        <ToolGemOrb
                          gem={{ name: result.swap.removed, level: result.swap.removedLevel }}
                          gemMap={gemMap}
                          ready={ready}
                          size="xs"
                          marker="remove"
                          dimmed
                        />
                      </div>
                    </GemTooltipTrigger>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  {result.swap?.added && (
                    <GemTooltipTrigger
                      gem={{ name: result.swap.added, level: result.swap.addedLevel }}
                      gemMap={gemMap}
                      ready={ready}
                    >
                      <div className="cursor-help">
                        <ToolGemOrb
                          gem={{ name: result.swap.added, level: result.swap.addedLevel }}
                          gemMap={gemMap}
                          ready={ready}
                          size="xs"
                          marker="add"
                        />
                      </div>
                    </GemTooltipTrigger>
                  )}
                </div>

                {/* Row 2: Label + DPS delta */}
                <div className="flex items-center gap-2">
                  <span className="text-stone-400 text-xs flex-1 min-w-0 truncate">
                    {result.swap?.removed} → {result.swap?.added}
                  </span>
                  {result.success ? (
                    <span
                      className={cn(
                        'flex items-center gap-0.5 font-semibold flex-shrink-0',
                        isPositive && 'text-emerald-400',
                        isNegative && 'text-red-400',
                        isNeutral && 'text-stone-400'
                      )}
                    >
                      {isPositive && <TrendingUp className="w-3 h-3" />}
                      {isNegative && <TrendingDown className="w-3 h-3" />}
                      {isPositive ? '+' : ''}{percent.toFixed(1)}% DPS
                    </span>
                  ) : (
                    <span className="text-red-400 text-xs">
                      {result.error || 'Failed'}
                    </span>
                  )}
                </div>

                {/* Row 3: EHP + Life changes (secondary) */}
                {result.success && (ehpPercent !== 0 || lifePercent !== 0) && (
                  <div className="flex items-center gap-2 mt-0.5 text-[0.625rem]">
                    {ehpPercent !== 0 && (
                      <span className={ehpPercent > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {ehpPercent > 0 ? '+' : ''}{ehpPercent.toFixed(1)}% EHP
                      </span>
                    )}
                    {lifePercent !== 0 && (
                      <span className={lifePercent > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {lifePercent > 0 ? '+' : ''}{lifePercent.toFixed(1)}% Life
                      </span>
                    )}
                  </div>
                )}

                {/* Row 4: Significant extras pills */}
                {result.significantExtras && result.significantExtras.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.significantExtras.map((extra, ei) => (
                      <span
                        key={ei}
                        className={`text-[0.625rem] px-1 py-0.5 rounded ${
                          extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {formatExtraPill(extra)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary if available */}
      {summary && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
          {stripToolTags(summary)}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Types for Tool Output
// =============================================================================

/** Basic gem info with optional metadata */
interface SimpleGemInfo {
  name: string;
  tags?: string[];
  types?: string[];
  damageTypes?: string[];
  reservationPercent?: number;
  cooldown?: string;
}

/** Grouped supports for find_support_suggestions (new format) */
interface GroupedSupports {
  /** Tag-compatible AND matches build damage type */
  recommended: (string | SimpleGemInfo)[];
  /** Tag-compatible but different/no damage type */
  compatible: (string | SimpleGemInfo)[];
}

/** Ladder reference entry for a gem (support or setup) */
interface LadderGemEntry {
  name: string;
  usagePercent: number;
  discoveryGroup?: 'recommended' | 'compatible';
  inBuild?: boolean;
}

/** Ladder reference data for support suggestions */
interface SupportLadderReference {
  buildCount?: number;
  topSupports: LadderGemEntry[];
}

/** Ladder reference data for setup suggestions */
interface SetupLadderReference {
  buildCount?: number;
  auras?: LadderGemEntry[];
  otherSkills?: {
    guards?: LadderGemEntry[];
    curses?: LadderGemEntry[];
    heralds?: LadderGemEntry[];
    movement?: LadderGemEntry[];
    utility?: LadderGemEntry[];
  };
}

/** New grouped format for find_support_suggestions */
interface GroupedSupportSuggestionsResult {
  success: boolean;
  activeSkill: { name: string; tags: string[]; damageTypes: string[] };
  grouped: GroupedSupports;
  currentBuildSupports?: string[];
  ladderReference?: SupportLadderReference;
  hint?: string;
}

/** Legacy flat format for find_support_suggestions (backward compatibility) */
interface LegacySupportSuggestionsResult {
  success: boolean;
  activeSkill: { name: string; tags: string[]; damageTypes: string[] };
  compatible: SimpleGemInfo[];
  hint?: string;
}

/** Grouped category for setup suggestions (auras, curses, guards, heralds) */
interface GroupedCategory {
  /** Gems with damage tags matching the build's damage types */
  matchingDamageType: (string | SimpleGemInfo)[];
  /** Generic utility gems (no damage type or purely defensive) */
  utility: (string | SimpleGemInfo)[];
  /** Core gems essential for the build archetype */
  core?: (string | SimpleGemInfo)[];
  /** Relevant gems that synergize with the build */
  relevant?: (string | SimpleGemInfo)[];
  /** Situational gems for specific encounters */
  situational?: (string | SimpleGemInfo)[];
}

/** New grouped format for find_setup_suggestions */
interface GroupedSetupSuggestionsResult {
  success: boolean;
  buildContext: {
    damageTypes?: string[];
    defenseProfile?: string;
    isSpellBuild?: boolean;
    isMinion?: boolean;
    isDoT?: boolean;
    isCrit?: boolean;
    isAttack?: boolean;
    isLowLife?: boolean;
    isChaosInoculation?: boolean;
    tags?: string[];
  };
  suggestions: {
    auras?: GroupedCategory;
    curses?: GroupedCategory;
    guards?: GroupedCategory;
    heralds?: GroupedCategory;
  };
  currentBuildSetup?: {
    auras: string[];
    curses: string[];
    guards: string[];
    heralds: string[];
    other: string[];
  };
  ladderReference?: SetupLadderReference;
  hint?: string;
}

/** Legacy flat format for find_setup_suggestions (backward compatibility) */
interface LegacySetupSuggestionsResult {
  success: boolean;
  buildContext: {
    damageTypes?: string[];
    defenseProfile?: string;
    manaTotal?: number;
    manaReserved?: number;
    manaUnreservedPercent?: number;
    currentAuras?: string[];
  };
  suggestions: {
    auras?: Array<{ name: string; types?: string[]; damageTypes?: string[]; reservationPercent?: number }>;
    curses?: Array<{ name: string; types?: string[]; damageTypes?: string[] }>;
    guards?: Array<{ name: string; types?: string[] }>;
    heralds?: Array<{ name: string; types?: string[]; damageTypes?: string[] }>;
  };
  hint?: string;
}

/** Legacy format types (for backward compatibility) */
interface LegacySuggestion {
  name?: string;
  matchScore?: number;
  tags?: string[];
  reason?: string;
  reservationPercent?: number;
  cooldown?: string;
}

// =============================================================================
// Shared UI Components for Suggestions
// =============================================================================

/** Label and color mapping for build profile tags */
const BUILD_TAG_CONFIG: Record<string, { label: string; category: 'element' | 'mechanic' | 'defense' | 'special' }> = {
  fire:         { label: 'Fire',      category: 'element' },
  cold:         { label: 'Cold',      category: 'element' },
  lightning:    { label: 'Lightning', category: 'element' },
  physical:     { label: 'Physical',  category: 'element' },
  chaos:        { label: 'Chaos',     category: 'element' },
  dot:          { label: 'DoT',       category: 'mechanic' },
  crit:         { label: 'Crit',      category: 'mechanic' },
  spell:        { label: 'Spell',     category: 'mechanic' },
  attack:       { label: 'Attack',    category: 'mechanic' },
  minion:       { label: 'Minion',    category: 'mechanic' },
  armour:       { label: 'Armour',    category: 'defense' },
  evasion:      { label: 'Evasion',   category: 'defense' },
  energyShield: { label: 'ES',        category: 'defense' },
  hybrid:       { label: 'Hybrid',    category: 'defense' },
  low_life:     { label: 'Low Life',  category: 'special' },
  ci:           { label: 'CI',        category: 'special' },
};

const TAG_CATEGORY_STYLES: Record<string, string> = {
  element:  'bg-red-900/30 text-red-300 border-red-500/20',
  mechanic: 'bg-teal-900/30 text-teal-300 border-teal-500/20',
  defense:  'bg-blue-900/30 text-blue-300 border-blue-500/20',
  special:  'bg-amber-900/30 text-amber-300 border-amber-500/20',
};

function BuildProfileTag({ tag }: { tag: string }) {
  const config = BUILD_TAG_CONFIG[tag];
  const label = config?.label ?? tag.charAt(0).toUpperCase() + tag.slice(1);
  const style = TAG_CATEGORY_STYLES[config?.category ?? 'mechanic'];
  return (
    <span className={cn('text-xs px-1.5 py-0.5 rounded border', style)}>
      {label}
    </span>
  );
}

/** Small badge for gem types/tags */
function TypeBadge({ type, variant = 'default' }: { type: string; variant?: 'default' | 'highlight' }) {
  const baseClasses = 'text-[0.625rem] px-1 py-0.5 rounded border';
  const variantClasses = variant === 'highlight'
    ? 'bg-amber-900/30 text-amber-300 border-amber-500/30'
    : 'bg-slate-800/60 text-stone-400 border-stone-600/30';

  return (
    <span className={cn(baseClasses, variantClasses)}>
      {type}
    </span>
  );
}

/** Normalize gem data that may be string or {name: string} from backend */
function normalizeGemName(gem: string | SimpleGemInfo): string {
  return typeof gem === 'string' ? gem : gem.name;
}

type GemAccentTone = 'amber' | 'stone' | 'purple' | 'orange' | 'emerald' | 'red';

interface ToolGemRef {
  name: string;
  level?: number;
  quality?: number;
}

interface ResolvedToolGem extends ToolGemRef {
  resolvedName: string;
  payload?: GemTooltipPayload;
  gemColor: 'red' | 'green' | 'blue' | 'white';
  isSupport: boolean;
  isAwakened: boolean;
  isVaal: boolean;
}

const GEM_COLOR_TO_TOOLTIP: Record<string, 'red' | 'green' | 'blue' | 'white'> = {
  r: 'red',
  g: 'green',
  b: 'blue',
  d: 'white',
};

const GEM_ORB_STYLES = {
  red: {
    rim: 'from-red-200 via-red-500 to-red-950',
    shell: 'bg-red-950/75',
    glow: 'shadow-[0_0_18px_rgba(248,113,113,0.18)]',
    text: 'text-red-100',
  },
  green: {
    rim: 'from-emerald-200 via-emerald-500 to-emerald-950',
    shell: 'bg-emerald-950/75',
    glow: 'shadow-[0_0_18px_rgba(52,211,153,0.18)]',
    text: 'text-emerald-100',
  },
  blue: {
    rim: 'from-sky-200 via-blue-500 to-blue-950',
    shell: 'bg-blue-950/75',
    glow: 'shadow-[0_0_18px_rgba(96,165,250,0.18)]',
    text: 'text-sky-100',
  },
  white: {
    rim: 'from-slate-100 via-slate-300 to-slate-700',
    shell: 'bg-slate-950/80',
    glow: 'shadow-[0_0_16px_rgba(226,232,240,0.14)]',
    text: 'text-slate-100',
  },
} as const;

const GEM_SECTION_STYLES: Record<GemAccentTone, {
  shell: string;
  frame: string;
  title: string;
  subtitle: string;
  divider: string;
  dividerHalf: string;
}> = {
  amber: {
    shell: 'from-amber-950/14 via-slate-950/92 to-slate-950/98',
    frame: 'border-amber-500/18 shadow-[0_0_28px_rgba(251,191,36,0.08)]',
    title: 'text-amber-300/95',
    subtitle: 'text-amber-400/55',
    divider: 'from-transparent via-amber-500/28 to-transparent',
    dividerHalf: 'from-amber-500/28',
  },
  stone: {
    shell: 'from-stone-900/12 via-slate-950/92 to-slate-950/98',
    frame: 'border-stone-500/16 shadow-[0_0_24px_rgba(168,162,158,0.06)]',
    title: 'text-stone-200/95',
    subtitle: 'text-stone-400/55',
    divider: 'from-transparent via-stone-500/22 to-transparent',
    dividerHalf: 'from-stone-500/22',
  },
  purple: {
    shell: 'from-purple-950/14 via-slate-950/92 to-slate-950/98',
    frame: 'border-purple-500/18 shadow-[0_0_28px_rgba(168,85,247,0.08)]',
    title: 'text-purple-200/95',
    subtitle: 'text-purple-400/55',
    divider: 'from-transparent via-purple-500/26 to-transparent',
    dividerHalf: 'from-purple-500/26',
  },
  orange: {
    shell: 'from-orange-950/14 via-slate-950/92 to-slate-950/98',
    frame: 'border-orange-500/18 shadow-[0_0_28px_rgba(249,115,22,0.08)]',
    title: 'text-orange-200/95',
    subtitle: 'text-orange-400/55',
    divider: 'from-transparent via-orange-500/26 to-transparent',
    dividerHalf: 'from-orange-500/26',
  },
  emerald: {
    shell: 'from-emerald-950/14 via-slate-950/92 to-slate-950/98',
    frame: 'border-emerald-500/18 shadow-[0_0_28px_rgba(16,185,129,0.08)]',
    title: 'text-emerald-200/95',
    subtitle: 'text-emerald-400/55',
    divider: 'from-transparent via-emerald-500/26 to-transparent',
    dividerHalf: 'from-emerald-500/26',
  },
  red: {
    shell: 'from-red-950/14 via-slate-950/92 to-slate-950/98',
    frame: 'border-red-500/18 shadow-[0_0_28px_rgba(239,68,68,0.08)]',
    title: 'text-red-200/95',
    subtitle: 'text-red-400/55',
    divider: 'from-transparent via-red-500/26 to-transparent',
    dividerHalf: 'from-red-500/26',
  },
};

/** Construct a PoE Wiki icon URL from a gem name (fallback when gem-lookup unavailable) */
function gemIconUrl(name: string): string {
  const wikiName = name.trim().replace(/ /g, '_');
  return `https://www.poewiki.net/wiki/Special:Redirect/file/${encodeURIComponent(wikiName)}_inventory_icon.png`;
}

function normalizeGemLookupCandidates(name: string): string[] {
  const base = name.trim();
  const withoutSupport = base.replace(/\s+Support$/i, '');
  const withoutVaal = base.replace(/^Vaal\s+/i, '');
  const withoutAwakened = base.replace(/^Awakened\s+/i, '');

  return Array.from(new Set([
    base,
    `${withoutSupport} Support`,
    withoutSupport,
    withoutVaal,
    `${withoutVaal.replace(/\s+Support$/i, '')} Support`,
    withoutAwakened,
    `${withoutAwakened.replace(/\s+Support$/i, '')} Support`,
  ].filter(Boolean)));
}

function resolveGemData(
  gem: ToolGemRef,
  gemMap: Map<string, GemTooltipPayload>,
  ready: boolean,
): ResolvedToolGem {
  const candidates = ready ? normalizeGemLookupCandidates(gem.name) : [gem.name];
  let payload: GemTooltipPayload | undefined;
  let resolvedName = gem.name;

  for (const candidate of candidates) {
    const found = gemMap.get(candidate);
    if (found) {
      payload = found;
      resolvedName = candidate;
      break;
    }
  }

  return {
    ...gem,
    resolvedName,
    payload,
    gemColor: payload ? GEM_COLOR_TO_TOOLTIP[payload.color] ?? 'white' : 'white',
    isSupport: payload?.isSupport ?? /support$/i.test(gem.name),
    isAwakened: /^Awakened\s+/i.test(gem.name),
    isVaal: /^Vaal\s+/i.test(gem.name),
  };
}

function buildToolGem(gem: string | SimpleGemInfo, overrides?: Partial<ToolGemRef>): ToolGemRef {
  return {
    name: normalizeGemName(gem),
    ...(overrides?.level !== undefined ? { level: overrides.level } : {}),
    ...(overrides?.quality !== undefined ? { quality: overrides.quality } : {}),
  };
}

interface NormalizedGemSwapEntry {
  group: number;
  op: 'swap' | 'add' | 'remove' | 'adjust';
  removed: string;
  added: string;
  level?: number;
  quality?: number;
}

/**
 * Normalize a combined-package gem swap entry to the new shape.
 * Heals legacy in-memory data where adjust ops were encoded as
 * `added: "Precision (adjusted L19)"` with no explicit `op` field —
 * that decorated name breaks gem-lookup and wiki icon fallback.
 */
function normalizeGemSwapEntry(swap: {
  group: number;
  op?: 'swap' | 'add' | 'remove' | 'adjust';
  removed: string;
  added: string;
  level?: number;
  quality?: number;
}): NormalizedGemSwapEntry {
  if (swap.op) {
    return { group: swap.group, op: swap.op, removed: swap.removed, added: swap.added, level: swap.level, quality: swap.quality };
  }
  const adjustMatch = swap.added.match(/^(.+?)\s*\(adjusted L(\d+)\)\s*$/i);
  if (adjustMatch) {
    return {
      group: swap.group,
      op: 'adjust',
      removed: '',
      added: adjustMatch[1].trim(),
      level: parseInt(adjustMatch[2], 10),
      quality: swap.quality,
    };
  }
  const op: 'swap' | 'add' | 'remove' = swap.removed && swap.added ? 'swap' : swap.added ? 'add' : 'remove';
  return { group: swap.group, op, removed: swap.removed, added: swap.added, level: swap.level, quality: swap.quality };
}

function GemTooltipTrigger({
  gem,
  gemMap,
  ready,
  children,
  side = 'top',
}: {
  gem: ToolGemRef;
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const resolved = resolveGemData(gem, gemMap, ready);

  if (!resolved.payload) {
    return <>{children}</>;
  }

  return (
    <Tooltip.Provider delayDuration={120}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={8}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={8}
          >
            <GemTooltip
              name={resolved.resolvedName}
              gemColor={resolved.gemColor}
              isSupport={resolved.isSupport}
              isVaal={resolved.isVaal}
              isAwakened={resolved.isAwakened}
              level={gem.level}
              quality={gem.quality}
              description={resolved.payload.description}
              statText={resolved.payload.statText}
              requirements={resolved.payload.requirements}
              gemTags={resolved.payload.gemTags}
              manaCost={resolved.payload.manaCost}
              manaReservation={resolved.payload.manaReservation}
              lifeReservation={resolved.payload.lifeReservation}
              costMultiplier={resolved.payload.costMultiplier}
              damageEffectiveness={resolved.payload.damageEffectiveness}
            />
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function ToolGemOrb({
  gem,
  gemMap,
  ready,
  size = 'md',
  marker,
  dimmed = false,
}: {
  gem: ToolGemRef;
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  marker?: 'add' | 'remove' | 'adjust';
  dimmed?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const resolved = resolveGemData(gem, gemMap, ready);
  const orbStyle = GEM_ORB_STYLES[resolved.gemColor];
  const sizeStyles = size === 'lg'
    ? { frame: 'w-16 h-16', shell: 'w-14 h-14', icon: 'w-10 h-10', badge: 'text-[0.5625rem] px-1.5', marker: 'w-5 h-5 text-[0.6875rem]' }
    : size === 'md'
      ? { frame: 'w-12 h-12', shell: 'w-10 h-10', icon: 'w-7 h-7', badge: 'text-[0.5rem] px-1.5', marker: 'w-[18px] h-[18px] text-[0.625rem]' }
      : size === 'sm'
        ? { frame: 'w-9 h-9', shell: 'w-7 h-7', icon: 'w-5 h-5', badge: 'text-[0.5rem] px-1', marker: 'w-4 h-4 text-[0.625rem]' }
        : { frame: 'w-[26px] h-[26px]', shell: 'w-[22px] h-[22px]', icon: 'w-4 h-4', badge: 'hidden', marker: 'w-3.5 h-3.5 text-[0.5rem]' };

  const iconSrc = resolved.payload?.iconUrl || gemIconUrl(resolved.resolvedName);

  return (
    <div className={cn('relative shrink-0', dimmed && 'opacity-60')}>
      <div className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center',
        orbStyle.rim,
        orbStyle.glow,
        'border border-white/10',
        sizeStyles.frame,
      )}>
        <div className={cn(
          'rounded-full flex items-center justify-center overflow-hidden',
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_-1px_2px_rgba(255,255,255,0.08)]',
          orbStyle.shell,
          sizeStyles.shell,
        )}>
          {!imgError ? (
            <img
              src={iconSrc}
              alt={resolved.resolvedName}
              className={cn(sizeStyles.icon, 'object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.35)]')}
              onError={() => setImgError(true)}
            />
          ) : (
            <Gem className={cn(sizeStyles.icon, orbStyle.text, 'opacity-80')} />
          )}
        </div>
      </div>
      {gem.level !== undefined && sizeStyles.badge !== 'hidden' && (
        <span className={cn(
          'absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-slate-700/70',
          'bg-slate-950/95 text-slate-100 font-mono shadow-[0_2px_8px_rgba(0,0,0,0.4)]',
          sizeStyles.badge,
        )}>
          L{gem.level}
        </span>
      )}
      {marker && (
        <span className={cn(
          'absolute -top-1 -right-1 rounded-full flex items-center justify-center text-white font-semibold shadow-sm',
          marker === 'add' ? 'bg-emerald-500/95'
            : marker === 'remove' ? 'bg-red-500/95'
              : 'bg-amber-500/95',
          sizeStyles.marker,
        )}>
          {marker === 'add' ? '+' : marker === 'remove' ? '-' : '~'}
        </span>
      )}
    </div>
  );
}

function ToolGemToken({
  gem,
  gemMap,
  ready,
  layout = 'stacked',
  accent = 'amber',
  marker,
  dimmed = false,
}: {
  gem: ToolGemRef;
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  layout?: 'stacked' | 'inline';
  accent?: GemAccentTone;
  marker?: 'add' | 'remove' | 'adjust';
  dimmed?: boolean;
}) {
  const resolved = resolveGemData(gem, gemMap, ready);
  const sectionStyle = GEM_SECTION_STYLES[accent];
  const isInline = layout === 'inline';

  return (
    <GemTooltipTrigger gem={gem} gemMap={gemMap} ready={ready}>
      <div
        className={cn(
          'group cursor-help rounded-2xl border bg-gradient-to-br transition-all duration-200',
          sectionStyle.shell,
          sectionStyle.frame,
          isInline ? 'px-2.5 py-2 flex items-center gap-2.5 min-w-0' : 'px-2.5 py-2.5 flex flex-col items-center gap-2 text-center min-w-[96px]',
          dimmed && 'opacity-70',
        )}
      >
        <ToolGemOrb
          gem={gem}
          gemMap={gemMap}
          ready={ready}
          size={isInline ? 'sm' : 'md'}
          marker={marker}
          dimmed={dimmed}
        />
        <div className={cn('min-w-0', isInline && 'flex-1')}>
          <div className={cn(
            'leading-tight',
            isInline ? 'text-[0.6875rem] text-stone-100' : 'text-[0.6875rem] text-stone-100/95',
          )}>
            {resolved.resolvedName}
          </div>
          {gem.level !== undefined && isInline && (
            <div className="mt-0.5 text-[0.625rem] text-slate-500 font-mono">
              Level {gem.level}
            </div>
          )}
        </div>
      </div>
    </GemTooltipTrigger>
  );
}

const GEM_SHOWCASE_INITIAL_COUNT = 10;

/** Icon grid with optional ladder percentage badges — used for support gem suggestions */
function SupportGemShowcase({
  title,
  gems,
  ladderUsage,
  gemMap,
  ready,
  accent = 'amber',
}: {
  title: string;
  gems: ToolGemRef[];
  ladderUsage: Map<string, { usagePercent: number; inBuild?: boolean }>;
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  accent?: GemAccentTone;
}) {
  const dedupedGems = useMemo(() => {
    const seen = new Set<string>();
    return gems.filter((gem) => {
      const key = gem.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [gems]);

  if (dedupedGems.length === 0) return null;

  const accentStyle = GEM_SECTION_STYLES[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className={cn('h-px flex-1 bg-gradient-to-r to-transparent', accentStyle.dividerHalf)} />
        <span className="flex items-center gap-1.5">
          <span className={cn('text-[0.5625rem] font-display font-semibold uppercase tracking-[0.15em]', accentStyle.title)}>
            {title}
          </span>
          <span className="text-[0.5625rem] text-slate-600 tabular-nums">{dedupedGems.length}</span>
        </span>
        <div className={cn('h-px flex-1 bg-gradient-to-l to-transparent', accentStyle.dividerHalf)} />
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-2 justify-center">
        {dedupedGems.map((gem, i) => {
          const ladder = ladderUsage.get(gem.name.toLowerCase());
          return (
            <GemTooltipTrigger key={`${gem.name.toLowerCase()}-${i}`} gem={gem} gemMap={gemMap} ready={ready}>
              <div className="group flex flex-col items-center gap-1 cursor-help">
                <div className="relative">
                  <ToolGemOrb gem={gem} gemMap={gemMap} ready={ready} size="xs" />
                  {ladder && (
                    <span className="absolute -top-1 -right-1.5 text-[0.4375rem] px-1 py-px rounded-full bg-cyan-900/80 text-cyan-400/90 border border-cyan-500/25 font-medium leading-none">
                      {ladder.usagePercent}%
                    </span>
                  )}
                  {ladder?.inBuild && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                  )}
                </div>
                <span className="text-[0.5rem] text-stone-500 group-hover:text-stone-300 text-center leading-tight max-w-[52px] truncate transition-colors duration-200">
                  {gem.name}
                </span>
              </div>
            </GemTooltipTrigger>
          );
        })}
      </div>
    </motion.div>
  );
}

function GemShowcaseSection({
  title,
  gems,
  gemMap,
  ready,
  accent = 'amber',
  compact = false,
  initialCount = GEM_SHOWCASE_INITIAL_COUNT,
}: {
  title: string;
  gems: ToolGemRef[];
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  accent?: GemAccentTone;
  compact?: boolean;
  initialCount?: number;
}) {
  const dedupedGems = useMemo(() => {
    const seen = new Set<string>();
    return gems.filter((gem) => {
      const key = `${gem.name.toLowerCase()}::${gem.level ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [gems]);

  const accentStyle = GEM_SECTION_STYLES[accent];

  if (dedupedGems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      {/* Category divider label — matches tree notables style */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className={cn('h-px flex-1 bg-gradient-to-r to-transparent', accentStyle.dividerHalf)} />
        <span className="flex items-center gap-1.5">
          <span className={cn('text-[0.5625rem] font-display font-semibold uppercase tracking-[0.15em]', accentStyle.title)}>
            {title}
          </span>
          <span className="text-[0.5625rem] text-slate-600 tabular-nums">{dedupedGems.length}</span>
        </span>
        <div className={cn('h-px flex-1 bg-gradient-to-l to-transparent', accentStyle.dividerHalf)} />
      </div>
      {/* Icon grid — compact, centered, matches tree notables gallery */}
      <div className="flex flex-wrap gap-2 px-3 pb-2 justify-center">
        {dedupedGems.map((gem, index) => (
          <GemTooltipTrigger
            key={`${gem.name}-${gem.level ?? 'na'}-${index}`}
            gem={gem}
            gemMap={gemMap}
            ready={ready}
          >
            <div className="group flex flex-col items-center gap-1 cursor-help">
              <ToolGemOrb gem={gem} gemMap={gemMap} ready={ready} size="xs" />
              <span className="text-[0.5rem] text-stone-500 group-hover:text-stone-300 text-center leading-tight max-w-[52px] truncate transition-colors duration-200">
                {gem.name}
              </span>
            </div>
          </GemTooltipTrigger>
        ))}
      </div>
    </motion.div>
  );
}

function ActiveSkillShowcase({
  gem,
  tags,
  damageTypes,
  gemMap,
  ready,
}: {
  gem: ToolGemRef;
  tags?: string[];
  damageTypes?: string[];
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <GemTooltipTrigger gem={gem} gemMap={gemMap} ready={ready}>
        <div className="cursor-help flex-shrink-0">
          <ToolGemOrb gem={gem} gemMap={gemMap} ready={ready} size="sm" />
        </div>
      </GemTooltipTrigger>
      <span className="text-[0.6875rem] text-stone-100 font-medium leading-tight">{gem.name}</span>
      <div className="flex flex-wrap gap-1 min-w-0">
        {tags?.slice(0, 6).map((tag, i) => (
          <TypeBadge key={i} type={tag} />
        ))}
        {damageTypes?.map((damageType, i) => (
          <TypeBadge key={`damage-${i}`} type={damageType} variant="highlight" />
        ))}
      </div>
    </div>
  );
}

/** Min usage% to show a ladder gem (hides noise below this threshold) */
const SETUP_LADDER_MIN_PERCENT = 3;

function SetupCategoryShowcase({
  title,
  matching,
  utility,
  ladderGems,
  gemMap,
  ready,
  accent,
}: {
  title: string;
  matching: ToolGemRef[];
  utility: ToolGemRef[];
  ladderGems?: LadderGemEntry[];
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  accent: GemAccentTone;
}) {
  // Deduplicate and filter ladder gems by min percentage
  const sortedLadder = useMemo(() => {
    if (!ladderGems) return [];
    const seen = new Set<string>();
    return [...ladderGems]
      .sort((a, b) => b.usagePercent - a.usagePercent)
      .filter((g) => {
        const key = g.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return g.usagePercent >= SETUP_LADDER_MIN_PERCENT;
      });
  }, [ladderGems]);

  // Build a lookup of ladder usage percentages
  const ladderUsage = useMemo(() => {
    const map = new Map<string, { usagePercent: number; inBuild?: boolean }>();
    for (const g of sortedLadder) map.set(g.name.toLowerCase(), g);
    return map;
  }, [sortedLadder]);

  // Collect all gem names from ladder to avoid duplicating in discovery sections
  const ladderNames = useMemo(() => new Set(sortedLadder.map(g => g.name.toLowerCase())), [sortedLadder]);
  const allDiscovery = useMemo(() => [
    ...matching.filter(g => !ladderNames.has(g.name.toLowerCase())),
    ...utility.filter(g => !ladderNames.has(g.name.toLowerCase())),
  ], [matching, utility, ladderNames]);

  // Merge ladder + discovery into a unified list (ladder first, sorted by usage)
  const allGems = useMemo(() => {
    const ladderAsToolGems = sortedLadder.map(g => buildToolGem(g.name));
    return [...ladderAsToolGems, ...allDiscovery];
  }, [sortedLadder, allDiscovery]);

  if (allGems.length === 0) return null;

  const accentStyle = GEM_SECTION_STYLES[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      {/* Category divider label — matches tree notables style */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className={cn('h-px flex-1 bg-gradient-to-r to-transparent', accentStyle.dividerHalf)} />
        <span className="flex items-center gap-1.5">
          <span className={cn('text-[0.5625rem] font-display font-semibold uppercase tracking-[0.15em]', accentStyle.title)}>
            {title}
          </span>
          <span className="text-[0.5625rem] text-slate-600 tabular-nums">{allGems.length}</span>
        </span>
        <div className={cn('h-px flex-1 bg-gradient-to-l to-transparent', accentStyle.dividerHalf)} />
      </div>
      {/* Unified icon grid — ladder gems show usage badge, all same compact size */}
      <div className="flex flex-wrap gap-2 px-3 pb-2 justify-center">
        {allGems.map((gem, i) => {
          const ladder = ladderUsage.get(gem.name.toLowerCase());
          return (
            <GemTooltipTrigger key={`${gem.name.toLowerCase()}-${i}`} gem={gem} gemMap={gemMap} ready={ready}>
              <div className="group flex flex-col items-center gap-1 cursor-help">
                <div className="relative">
                  <ToolGemOrb gem={gem} gemMap={gemMap} ready={ready} size="xs" />
                  {ladder && (
                    <span className="absolute -top-1 -right-1.5 text-[0.4375rem] px-1 py-px rounded-full bg-cyan-900/80 text-cyan-400/90 border border-cyan-500/25 font-medium leading-none">
                      {ladder.usagePercent}%
                    </span>
                  )}
                  {ladder?.inBuild && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                  )}
                </div>
                <span className="text-[0.5rem] text-stone-500 group-hover:text-stone-300 text-center leading-tight max-w-[52px] truncate transition-colors duration-200">
                  {gem.name}
                </span>
              </div>
            </GemTooltipTrigger>
          );
        })}
      </div>
    </motion.div>
  );
}

interface SkillToolOperation {
  action?: string;
  gem?: string;
  result?: string;
  fromGem?: string;
  toGem?: string;
  fromLevel?: number;
  toLevel?: number;
}

function SkillSetupOperationRow({
  operations,
  gemMap,
  ready,
  accent,
}: {
  operations: SkillToolOperation[];
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
  accent: GemAccentTone;
}) {
  const visibleOperations = operations.filter((operation) => {
    if (operation.action === 'swap') return Boolean(operation.fromGem && operation.toGem);
    if (operation.action === 'add') return Boolean(operation.toGem || operation.gem);
    if (operation.action === 'remove') return Boolean(operation.fromGem || operation.gem);
    return false;
  });

  if (visibleOperations.length === 0) return null;

  // Collect all removed and added gems across all operations
  const removed: { name: string; level?: number }[] = [];
  const added: { name: string; level?: number }[] = [];

  for (const op of visibleOperations) {
    if (op.action === 'swap') {
      if (op.fromGem) removed.push({ name: op.fromGem, level: op.fromLevel });
      if (op.toGem) added.push({ name: op.toGem, level: op.toLevel });
    } else if (op.action === 'remove') {
      const name = op.fromGem ?? op.gem ?? 'Unknown';
      removed.push({ name, level: op.fromLevel });
    } else if (op.action === 'add') {
      const name = op.toGem ?? op.gem ?? 'Unknown';
      added.push({ name, level: op.toLevel });
    }
  }

  const hasSwap = removed.length > 0 && added.length > 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Removed gems */}
      {removed.map((gem, i) => (
        <GemTooltipTrigger key={`rem-${i}`} gem={gem} gemMap={gemMap} ready={ready}>
          <div className="relative opacity-60 cursor-help">
            <ToolGemOrb gem={gem} gemMap={gemMap} ready={ready} size="xs" marker="remove" dimmed />
          </div>
        </GemTooltipTrigger>
      ))}
      {/* Arrow */}
      {hasSwap && (
        <ArrowRight className="w-3.5 h-3.5 text-slate-500 mx-0.5 flex-shrink-0" />
      )}
      {/* Added gems */}
      {added.map((gem, i) => (
        <GemTooltipTrigger key={`add-${i}`} gem={gem} gemMap={gemMap} ready={ready}>
          <div className="relative cursor-help">
            <ToolGemOrb gem={gem} gemMap={gemMap} ready={ready} size="xs" marker="add" />
          </div>
        </GemTooltipTrigger>
      ))}
    </div>
  );
}

/**
 * GroupedSupportSuggestions - Extracted component for grouped format rendering.
 * All hooks are called unconditionally at the top level.
 */
function GroupedSupportSuggestions({
  data,
  gemMap,
  ready,
}: {
  data: Record<string, unknown>;
  gemMap: Map<string, GemTooltipPayload>;
  ready: boolean;
}) {
  const result = data as unknown as GroupedSupportSuggestionsResult;
  const { activeSkill, grouped, ladderReference, hint } = result;

  const recommended = grouped?.recommended || [];
  const compatible = grouped?.compatible || [];
  const hasLadder = ladderReference && ladderReference.topSupports && ladderReference.topSupports.length > 0;

  // Build ladder usage lookup for percentage badges
  const ladderUsage = useMemo(() => {
    const map = new Map<string, { usagePercent: number; inBuild?: boolean }>();
    if (!hasLadder) return map;
    for (const g of ladderReference.topSupports) {
      map.set(g.name.toLowerCase(), g);
    }
    return map;
  }, [hasLadder, ladderReference]);

  // Merge ladder + recommended into a unified list (ladder first, sorted by usage)
  const mergedRecommended = useMemo(() => {
    const ladderNames = new Set(
      hasLadder ? ladderReference.topSupports.map(s => s.name.toLowerCase()) : []
    );
    const sortedLadder = hasLadder
      ? [...ladderReference.topSupports]
            .sort((a, b) => b.usagePercent - a.usagePercent)
            .filter(g => g.usagePercent >= 3)
      : [];
    const ladderAsToolGems = sortedLadder.map(g => buildToolGem(g.name));
    const filteredRecommended = recommended
      .map(gem => buildToolGem(gem))
      .filter(g => !ladderNames.has(g.name.toLowerCase()));
    return [...ladderAsToolGems, ...filteredRecommended];
  }, [hasLadder, ladderReference, recommended]);

  const filteredCompatible = useMemo(() => {
    const ladderNames = new Set(
      hasLadder ? ladderReference.topSupports.map(s => s.name.toLowerCase()) : []
    );
    return compatible
      .map(gem => buildToolGem(gem))
      .filter(g => !ladderNames.has(g.name.toLowerCase()));
  }, [hasLadder, ladderReference, compatible]);

  if (!activeSkill || (recommended.length === 0 && compatible.length === 0 && !hasLadder)) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-sm px-1 space-y-2">
      <ActiveSkillShowcase
        gem={buildToolGem(activeSkill.name)}
        tags={activeSkill.tags}
        damageTypes={activeSkill.damageTypes}
        gemMap={gemMap}
        ready={ready}
      />

      {mergedRecommended.length > 0 && (
        <SupportGemShowcase
          title="Recommended"
          gems={mergedRecommended}
          ladderUsage={ladderUsage}
          gemMap={gemMap}
          ready={ready}
          accent="amber"
        />
      )}

      {filteredCompatible.length > 0 && (
        <GemShowcaseSection
          title="Compatible"
          gems={filteredCompatible}
          gemMap={gemMap}
          ready={ready}
          accent="stone"
          compact
          initialCount={12}
        />
      )}

      {hint && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
          {hint}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/**
 * SupportSuggestionsResult - Custom renderer for find_support_suggestions tool
 *
 * Shows the active skill with type badges and grouped support gems.
 * Ladder reference shown first when available, then recommended/compatible discovery gems.
 *
 * Handles new grouped format (grouped: { recommended, compatible }) and legacy formats.
 */
function SupportSuggestionsResult({ data }: { data: Record<string, unknown> }) {
  const { gemMap, ready } = useGemLookup();

  // Check for new grouped format first (grouped.recommended, grouped.compatible)
  const isGroupedFormat = 'grouped' in data &&
    typeof data.grouped === 'object' &&
    data.grouped !== null &&
    ('recommended' in (data.grouped as object) || 'compatible' in (data.grouped as object));

  if (isGroupedFormat) {
    return <GroupedSupportSuggestions data={data} gemMap={gemMap} ready={ready} />;
  }

  // Check for legacy flat format (compatible[] at top level)
  const isLegacyFlatFormat = 'compatible' in data && Array.isArray(data.compatible);

  if (isLegacyFlatFormat) {
    const result = data as unknown as LegacySupportSuggestionsResult;
    const { activeSkill, compatible, hint } = result;

    if (!activeSkill || compatible.length === 0) {
      return <DefaultResult data={data} />;
    }

    return (
      <div className="text-sm px-1 space-y-2">
        <ActiveSkillShowcase
          gem={buildToolGem(activeSkill.name)}
          tags={activeSkill.tags}
          damageTypes={activeSkill.damageTypes}
          gemMap={gemMap}
          ready={ready}
        />

        <GemShowcaseSection
          title="Compatible Supports"
          gems={compatible.map(gem => buildToolGem(gem))}
          gemMap={gemMap}
          ready={ready}
          accent="stone"
          compact
          initialCount={12}
        />

        {hint && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
            {hint}
          </div>
        )}
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  // Legacy format handling (suggestions array)
  const activeSkill = data.activeSkill as {
    name?: string;
    tags?: string[];
    damageType?: string;
  } | undefined;

  const legacySuggestions = (Array.isArray(data.suggestions) ? data.suggestions : []) as LegacySuggestion[];

  if (!activeSkill || legacySuggestions.length === 0) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-sm px-1 space-y-2">
      <ActiveSkillShowcase
        gem={buildToolGem(activeSkill.name ?? 'Unknown')}
        tags={activeSkill.tags}
        damageTypes={activeSkill.damageType ? [activeSkill.damageType] : undefined}
        gemMap={gemMap}
        ready={ready}
      />

      <GemShowcaseSection
        title="Suggested Supports"
        gems={legacySuggestions
          .filter((suggestion): suggestion is LegacySuggestion & { name: string } => typeof suggestion.name === 'string' && suggestion.name.length > 0)
          .map((suggestion) => buildToolGem(suggestion.name))}
        gemMap={gemMap}
        ready={ready}
        accent="amber"
        compact
        initialCount={12}
      />
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}


/**
 * SetupSuggestionsResult - Custom renderer for find_setup_suggestions tool
 *
 * Shows build context and categorized gems (auras, curses, guards, heralds).
 * Ladder reference gems shown first within each category with usage% and inBuild indicators.
 * Discovery gems (matching + utility) shown after ladder entries.
 *
 * Handles new grouped format (matchingDamageType/utility) and legacy formats.
 */
function SetupSuggestionsResult({ data }: { data: Record<string, unknown> }) {
  const { gemMap, ready } = useGemLookup();

  // Check for new grouped format (suggestions.auras.matchingDamageType / utility)
  const suggestions = data.suggestions as Record<string, unknown> | undefined;
  const isGroupedFormat = suggestions &&
    typeof suggestions === 'object' &&
    (
      (suggestions.auras && typeof suggestions.auras === 'object' && 'matchingDamageType' in (suggestions.auras as object)) ||
      (suggestions.curses && typeof suggestions.curses === 'object' && 'matchingDamageType' in (suggestions.curses as object)) ||
      (suggestions.guards && typeof suggestions.guards === 'object' && 'matchingDamageType' in (suggestions.guards as object)) ||
      (suggestions.heralds && typeof suggestions.heralds === 'object' && 'matchingDamageType' in (suggestions.heralds as object))
    );

  if (isGroupedFormat) {
    const result = data as unknown as GroupedSetupSuggestionsResult;
    const { buildContext, ladderReference, hint } = result;
    const groupedSuggestions = result.suggestions;

    // Check if there are any gems in any category
    const hasAnySuggestions = ['auras', 'curses', 'guards', 'heralds'].some(cat => {
      const category = groupedSuggestions[cat as keyof typeof groupedSuggestions] as GroupedCategory | undefined;
      return category && (category.matchingDamageType?.length > 0 || category.utility?.length > 0);
    });
    const hasLadder = ladderReference && (
      (ladderReference.auras && ladderReference.auras.length > 0) ||
      (ladderReference.otherSkills && (
        (ladderReference.otherSkills.curses && ladderReference.otherSkills.curses.length > 0) ||
        (ladderReference.otherSkills.guards && ladderReference.otherSkills.guards.length > 0) ||
        (ladderReference.otherSkills.heralds && ladderReference.otherSkills.heralds.length > 0)
      ))
    );

    if (!hasAnySuggestions && !hasLadder) {
      return <DefaultResult data={data} />;
    }

    return (
      <div className="text-sm px-1 space-y-2">
        {buildContext && (
          <div className="card-forge rounded-xl px-3 py-2.5 border border-slate-700/40">
            <div className="flex flex-wrap gap-2 text-xs">
            {buildContext.tags && buildContext.tags.length > 0 ? (
              buildContext.tags.map((tag) => (
                <BuildProfileTag key={tag} tag={tag} />
              ))
            ) : (
              <>
                {buildContext.damageTypes && buildContext.damageTypes.length > 0 && (
                  buildContext.damageTypes.map((dtype, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/20">
                      {dtype}
                    </span>
                  ))
                )}
                {buildContext.defenseProfile && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/20">
                    {buildContext.defenseProfile}
                  </span>
                )}
              </>
            )}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <SetupCategoryShowcase
            title="Auras"
            matching={(groupedSuggestions.auras?.matchingDamageType ?? []).map(gem => buildToolGem(gem))}
            utility={(groupedSuggestions.auras?.utility ?? []).map(gem => buildToolGem(gem))}
            ladderGems={ladderReference?.auras}
            gemMap={gemMap}
            ready={ready}
            accent="amber"
          />
          <SetupCategoryShowcase
            title="Curses"
            matching={(groupedSuggestions.curses?.matchingDamageType ?? []).map(gem => buildToolGem(gem))}
            utility={(groupedSuggestions.curses?.utility ?? []).map(gem => buildToolGem(gem))}
            ladderGems={ladderReference?.otherSkills?.curses}
            gemMap={gemMap}
            ready={ready}
            accent="purple"
          />
          <SetupCategoryShowcase
            title="Guards"
            matching={(groupedSuggestions.guards?.matchingDamageType ?? []).map(gem => buildToolGem(gem))}
            utility={(groupedSuggestions.guards?.utility ?? []).map(gem => buildToolGem(gem))}
            ladderGems={ladderReference?.otherSkills?.guards}
            gemMap={gemMap}
            ready={ready}
            accent="stone"
          />
          <SetupCategoryShowcase
            title="Heralds"
            matching={(groupedSuggestions.heralds?.matchingDamageType ?? []).map(gem => buildToolGem(gem))}
            utility={(groupedSuggestions.heralds?.utility ?? []).map(gem => buildToolGem(gem))}
            ladderGems={ladderReference?.otherSkills?.heralds}
            gemMap={gemMap}
            ready={ready}
            accent="orange"
          />
        </div>

        {hint && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
            {hint}
          </div>
        )}
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  // Check for legacy flat format (suggestions.auras as array)
  const isLegacyFlatFormat = 'buildContext' in data && 'suggestions' in data &&
    suggestions && typeof suggestions === 'object' &&
    ('auras' in suggestions || 'curses' in suggestions) &&
    (Array.isArray(suggestions.auras) || Array.isArray(suggestions.curses));

  if (isLegacyFlatFormat) {
    const result = data as unknown as LegacySetupSuggestionsResult;
    const { buildContext, hint } = result;
    const legacySuggestions = result.suggestions;

    const hasAnySuggestions =
      (legacySuggestions.auras && legacySuggestions.auras.length > 0) ||
      (legacySuggestions.curses && legacySuggestions.curses.length > 0) ||
      (legacySuggestions.guards && legacySuggestions.guards.length > 0) ||
      (legacySuggestions.heralds && legacySuggestions.heralds.length > 0);

    if (!hasAnySuggestions) {
      return <DefaultResult data={data} />;
    }

    return (
      <div className="text-sm px-1 space-y-2">
        {buildContext && (
          <div className="card-forge rounded-xl px-3 py-2.5 border border-slate-700/40">
            <div className="flex flex-wrap gap-2 text-xs">
            {buildContext.damageTypes && buildContext.damageTypes.length > 0 && (
              buildContext.damageTypes.map((dtype, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/20">
                  {dtype}
                </span>
              ))
            )}
            {buildContext.defenseProfile && (
              <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/20">
                {buildContext.defenseProfile}
              </span>
            )}
            {buildContext.manaUnreservedPercent != null && (
              <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-stone-300 border border-stone-600/30">
                {buildContext.manaUnreservedPercent.toFixed(0)}% mana free
              </span>
            )}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <SetupCategoryShowcase
            title="Auras"
            matching={(legacySuggestions.auras ?? []).map(gem => buildToolGem(gem))}
            utility={[]}
            gemMap={gemMap}
            ready={ready}
            accent="amber"
          />
          <SetupCategoryShowcase
            title="Curses"
            matching={(legacySuggestions.curses ?? []).map(gem => buildToolGem(gem))}
            utility={[]}
            gemMap={gemMap}
            ready={ready}
            accent="purple"
          />
          <SetupCategoryShowcase
            title="Guards"
            matching={(legacySuggestions.guards ?? []).map(gem => buildToolGem(gem))}
            utility={[]}
            gemMap={gemMap}
            ready={ready}
            accent="stone"
          />
          <SetupCategoryShowcase
            title="Heralds"
            matching={(legacySuggestions.heralds ?? []).map(gem => buildToolGem(gem))}
            utility={[]}
            gemMap={gemMap}
            ready={ready}
            accent="orange"
          />
        </div>

        {hint && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
            {hint}
          </div>
        )}
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  // Legacy format handling (offensiveAuras/defensiveAuras structure)
  const legacyFormatSuggestions = data.suggestions as {
    offensiveAuras?: LegacySuggestion[];
    defensiveAuras?: LegacySuggestion[];
    curses?: LegacySuggestion[];
    guards?: LegacySuggestion[];
    heralds?: LegacySuggestion[];
  } | undefined;

  const buildProfile = data.buildProfile as {
    damageTypes?: string[];
    defenseProfile?: string;
    isSpellBuild?: boolean;
    isMinion?: boolean;
  } | undefined;

  if (!legacyFormatSuggestions) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-sm px-1 space-y-2">
      {buildProfile && (
        <div className="card-forge rounded-xl px-3 py-2.5 border border-slate-700/40">
          <div className="flex flex-wrap gap-2 text-xs">
          {buildProfile.damageTypes && buildProfile.damageTypes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/20">
              {buildProfile.damageTypes.join(', ')}
            </span>
          )}
          {buildProfile.defenseProfile && (
            <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/20">
              {buildProfile.defenseProfile}
            </span>
          )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <SetupCategoryShowcase
          title="Offensive Auras"
          matching={(legacyFormatSuggestions.offensiveAuras ?? [])
            .filter((item): item is LegacySuggestion & { name: string } => typeof item.name === 'string' && item.name.length > 0)
            .map(item => buildToolGem(item.name))}
          utility={[]}
          gemMap={gemMap}
          ready={ready}
          accent="amber"
        />
        <SetupCategoryShowcase
          title="Defensive Auras"
          matching={(legacyFormatSuggestions.defensiveAuras ?? [])
            .filter((item): item is LegacySuggestion & { name: string } => typeof item.name === 'string' && item.name.length > 0)
            .map(item => buildToolGem(item.name))}
          utility={[]}
          gemMap={gemMap}
          ready={ready}
          accent="emerald"
        />
        <SetupCategoryShowcase
          title="Curses"
          matching={(legacyFormatSuggestions.curses ?? [])
            .filter((item): item is LegacySuggestion & { name: string } => typeof item.name === 'string' && item.name.length > 0)
            .map(item => buildToolGem(item.name))}
          utility={[]}
          gemMap={gemMap}
          ready={ready}
          accent="purple"
        />
        <SetupCategoryShowcase
          title="Guards"
          matching={(legacyFormatSuggestions.guards ?? [])
            .filter((item): item is LegacySuggestion & { name: string } => typeof item.name === 'string' && item.name.length > 0)
            .map(item => buildToolGem(item.name))}
          utility={[]}
          gemMap={gemMap}
          ready={ready}
          accent="stone"
        />
        <SetupCategoryShowcase
          title="Heralds"
          matching={(legacyFormatSuggestions.heralds ?? [])
            .filter((item): item is LegacySuggestion & { name: string } => typeof item.name === 'string' && item.name.length > 0)
            .map(item => buildToolGem(item.name))}
          utility={[]}
          gemMap={gemMap}
          ready={ready}
          accent="orange"
        />
      </div>
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/**
 * ExploreSkillOptionsResult - Custom renderer for explore_skill_options tool
 *
 * Bundles the output of find_support_suggestions and find_setup_suggestions
 * into a single card. Reuses SupportSuggestionsResult and SetupSuggestionsResult
 * compositionally by passing their respective sub-objects.
 */
function ExploreSkillOptionsResult({ data }: { data: Record<string, unknown> }) {
  const mainSkill = data.mainSkill as string | undefined;
  const currentSupports = (data.currentSupports ?? []) as string[];
  const supports = data.supports as Record<string, unknown> | undefined;
  const setups = data.setups as Record<string, unknown> | undefined;
  const buildProfile = data.buildProfile as Record<string, boolean> | undefined;
  const hasSupports = supports && typeof supports === 'object' && supports.success !== false;
  const hasSetups = setups && typeof setups === 'object' && setups.success !== false;

  if (!hasSupports && !hasSetups) {
    return <DefaultResult data={data} />;
  }

  // Build profile tags from the boolean map
  const activeTags = buildProfile
    ? Object.entries(buildProfile).filter(([, v]) => v).map(([k]) => k)
    : [];

  return (
    <div className="text-sm space-y-3">
      {/* Header: main skill + current supports count */}
      <div className="card-forge rounded-xl px-3 py-2.5 border border-amber-500/15 shadow-[0_0_32px_rgba(251,191,36,0.06)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.6875rem] font-display font-semibold text-amber-300/90 uppercase tracking-wider">
            {mainSkill ?? 'Skill Options'}
          </span>
          {currentSupports.length > 0 && (
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-slate-800/60 text-stone-400 border border-stone-600/30">
              {currentSupports.length} linked supports
            </span>
          )}
          {activeTags.map((tag) => (
            <BuildProfileTag key={tag} tag={tag} />
          ))}
        </div>
      </div>

      {/* Support suggestions section */}
      {hasSupports && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
            <span className="text-[0.625rem] font-display font-semibold text-amber-400/80 uppercase tracking-widest">
              Support Gems
            </span>
          </div>
          <SupportSuggestionsResult data={supports as Record<string, unknown>} />
        </div>
      )}

      {/* Setup suggestions section */}
      {hasSetups && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-blue-400 to-blue-600" />
            <span className="text-[0.625rem] font-display font-semibold text-blue-400/80 uppercase tracking-widest">
              Skill Setups
            </span>
          </div>
          <SetupSuggestionsResult data={setups as Record<string, unknown>} />
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/**
 * SkillSetupResult - Custom renderer for test_skill_setup tool
 *
 * Shows baseline stats and tested variants with DPS/EHP deltas.
 */
function SkillSetupResult({ data }: { data: Record<string, unknown> }) {
  const { gemMap, ready } = useGemLookup();
  const callNumber = data.callNumber as number | undefined;
  const baseline = data.baseline as {
    stats?: {
      dps?: number;
      totalEhp?: number;
      manaUnreserved?: number;
      lifeUnreserved?: number;
    };
    activeSkills?: {
      auras?: string[];
      curses?: string[];
      guards?: string[];
      heralds?: string[];
    };
    activeSkillDetails?: {
      auras?: ToolGemRef[];
      curses?: ToolGemRef[];
      guards?: ToolGemRef[];
      heralds?: ToolGemRef[];
    };
  } | undefined;

  const results = (data.results ?? []) as Array<{
    label?: string;
    success?: boolean;
    operations?: Array<{
      action?: string;
      gem?: string;
      result?: string;
      fromGem?: string;
      toGem?: string;
      fromLevel?: number;
      toLevel?: number;
    }>;
    deltas?: {
      dps?: { absolute?: number; percent?: number };
      totalEhp?: { absolute?: number; percent?: number };
      manaUnreserved?: { absolute?: number; percent?: number };
    };
    feasible?: boolean;
    infeasibleReason?: string;
    error?: string;
    operationWarnings?: string[];
    allOperationsFailed?: boolean;
    significantExtras?: Array<{ label: string; value: number; percent: number; displayMode: string }>;
    configApplied?: string;
    ref?: string;
  }>;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;
  const summary = data.summary as string | undefined;

  if (!baseline || results.length === 0) {
    return <DefaultResult data={data} />;
  }

  // Sort by combined DPS + EHP improvement
  const sortedResults = [...results].sort((a, b) => {
    const aScore = (a.deltas?.dps?.percent ?? 0) + (a.deltas?.totalEhp?.percent ?? 0);
    const bScore = (b.deltas?.dps?.percent ?? 0) + (b.deltas?.totalEhp?.percent ?? 0);
    return bScore - aScore;
  });

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Variant results */}
      <div className="space-y-1.5">
        <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
          Tested Variants
        </div>
        <div className="space-y-1.5">
          {sortedResults.map((result, i) => {
            const dpsPercent = result.deltas?.dps?.percent ?? 0;
            const ehpPercent = result.deltas?.totalEhp?.percent ?? 0;
            const manaChange = result.deltas?.manaUnreserved?.absolute ?? 0;
            const baselineMana = baseline.stats?.manaUnreserved ?? 0;
            const newMana = baselineMana + manaChange;
            const isPositive = dpsPercent > 0 || ehpPercent > 0;
            const isNegative = dpsPercent < 0 && ehpPercent < 0;
            const isFeasible = result.feasible !== false;

            return (
              <div
                key={i}
                id={`skill-setup-c${callNumber ?? 0}-${i + 1}`}
                data-ref={result.ref?.toLowerCase()}
                className={cn(
                  'relative py-1.5 px-2 rounded bg-slate-900/40 border-l-2 transition-[box-shadow] duration-300',
                  !result.success && 'border-red-500/40 opacity-60',
                  result.success && isPositive && isFeasible && 'border-emerald-500/60',
                  result.success && isNegative && 'border-red-500/60',
                  result.success && !isPositive && !isNegative && 'border-stone-500/40',
                  result.success && !isFeasible && 'border-amber-500/60'
                )}
              >
                {result.configApplied && (
                  <div className="absolute top-1.5 right-2 flex items-center gap-1">
                    <ConfigPills configApplied={result.configApplied} />
                  </div>
                )}
                {result.operations && result.operations.length > 0 && (
                  <div className="mb-2">
                    <SkillSetupOperationRow
                      operations={result.operations}
                      gemMap={gemMap}
                      ready={ready}
                      accent={isPositive ? 'emerald' : isNegative ? 'red' : 'amber'}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-stone-200 text-xs font-medium flex-1">
                    {stripToolTags(result.label ?? '')}
                  </span>
                  {result.success ? (
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span
                        className={cn(
                          'flex items-center gap-0.5',
                          dpsPercent > 0 ? 'text-emerald-400' : dpsPercent < 0 ? 'text-red-400' : 'text-stone-400'
                        )}
                      >
                        {dpsPercent > 0 && <TrendingUp className="w-3 h-3" />}
                        {dpsPercent < 0 && <TrendingDown className="w-3 h-3" />}
                        {dpsPercent > 0 ? '+' : ''}{dpsPercent.toFixed(1)}% DPS
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-0.5',
                          ehpPercent > 0 ? 'text-emerald-400' : ehpPercent < 0 ? 'text-red-400' : 'text-stone-400'
                        )}
                      >
                        {ehpPercent > 0 && <TrendingUp className="w-3 h-3" />}
                        {ehpPercent < 0 && <TrendingDown className="w-3 h-3" />}
                        {ehpPercent > 0 ? '+' : ''}{ehpPercent.toFixed(1)}% EHP
                      </span>
                      {manaChange !== 0 && (
                        <span className="flex items-center gap-0.5 text-stone-400">
                          {baselineMana}→{newMana} mana
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-red-400 text-xs">{result.error || 'Failed'}</span>
                  )}
                </div>
                {result.significantExtras && result.significantExtras.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.significantExtras.map((extra, ei) => (
                      <span key={ei} className={`text-[0.625rem] px-1 py-0.5 rounded ${
                        extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {formatExtraPill(extra)}
                      </span>
                    ))}
                  </div>
                )}
                {!isFeasible && result.infeasibleReason && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    {result.infeasibleReason}
                  </div>
                )}
                {result.operationWarnings && result.operationWarnings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {result.operationWarnings.map((warn, wi) => (
                      <div key={wi} className="flex items-center gap-1 text-xs text-amber-400/80">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
          {stripToolTags(summary)}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Verdict priority for sorting gear setup results
// =============================================================================

const VERDICT_PRIORITY: Record<string, number> = {
  UPGRADE: 0,
  SIDEGRADE: 1,
  REJECTED: 2,
};

/**
 * TestGearSetupsResult - Custom renderer for test_gear_setups tool
 *
 * Shows baseline stats and tested gear setups with DPS/EHP deltas,
 * resistance warnings, and item visualizations.
 */

/** Display data from backend for item visualization */
interface GearDisplayMod {
  text: string;
  type: 'implicit' | 'explicit' | 'crafted' | 'enchant';
  affixType?: 'prefix' | 'suffix';
  tier?: number;
  tierRange?: { min: number; max: number };
  rollRange?: { min: number; max: number };
  /** Source of implicit mods — base item, Searing Exarch, or Eater of Worlds */
  implicitSource?: 'base' | 'searing_exarch' | 'eater_of_worlds';
}

interface GearDisplayData {
  name: string;
  baseName: string;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  mods: GearDisplayMod[];
  influence?: string;
  baseStats?: { armour?: number; evasion?: number; energyShield?: number; ward?: number; block?: number };
  weaponStats?: {
    physicalMin?: number;
    physicalMax?: number;
    physicalDPS?: number;
    elementalDPS?: number;
    chaosDPS?: number;
    totalDPS?: number;
    critChance?: number;
    attackRate?: number;
    range?: number;
    fireMin?: number;
    fireMax?: number;
    coldMin?: number;
    coldMax?: number;
    lightningMin?: number;
    lightningMax?: number;
    chaosMin?: number;
    chaosMax?: number;
  };
  requirements?: { level?: number; str?: number; dex?: number; int?: number };
  raw?: string;
}

interface GearItemDetail {
  slot?: string;
  itemText?: string;
  tradeStatIds?: Record<string, string>;
  display?: GearDisplayData;
  iconUrl?: string;
  fallbackIconUrl?: string;
}

/**
 * Lightweight parse of PoB item text into display fields when backend
 * display data is missing. Extracts name, baseName, rarity, and mod lines.
 */
function parseRawItemText(itemText: string): {
  name: string;
  baseName: string;
  rarity: string;
  mods: {
    implicits: Array<{ text: string; affixType: string; type: string; implicitSource?: 'base' | 'searing_exarch' | 'eater_of_worlds' }>;
    explicits: Array<{ text: string; affixType: string; type: string }>;
    crafted: Array<{ text: string; affixType: string; type: string }>;
    enchants: Array<{ text: string; affixType: string; type: string }>;
  };
} {
  const lines = itemText.split('\n').map(l => l.trim()).filter(Boolean);

  // Parse rarity
  let rarity = 'RARE';
  const rarityLine = lines.find(l => l.toLowerCase().startsWith('rarity:'));
  if (rarityLine) {
    const r = rarityLine.split(':')[1]?.trim().toUpperCase() ?? 'RARE';
    if (['NORMAL', 'MAGIC', 'RARE', 'UNIQUE'].includes(r)) rarity = r;
  }

  const rarityIdx = lines.findIndex(l => l.toLowerCase().startsWith('rarity:'));
  const extractHeader = () => {
    if (rarityIdx < 0) return { name: '', baseName: '', headerEndIdx: rarityIdx };
    const headers: Array<{ text: string; idx: number }> = [];
    for (let i = rarityIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (
        !line
        || line === '--------'
        || /^Prefix:\s*\d+/.test(line)
        || /^Suffix:\s*\d+/.test(line)
        || line.startsWith('Implicits:')
        || line.startsWith('Quality:')
        || line.startsWith('Requirements:')
        || line.startsWith('Item Level:')
        || line.startsWith('{')
      ) {
        break;
      }
      headers.push({ text: line, idx: i });
      if (headers.length >= 2) break;
    }
    const name = headers[0]?.text ?? '';
    const baseName = headers[1]?.text ?? name;
    const headerEndIdx = headers[headers.length - 1]?.idx ?? rarityIdx;
    return { name, baseName, headerEndIdx };
  };
  const { name, baseName, headerEndIdx } = extractHeader();

  // Parse mods
  const implicitMods: Array<{ text: string; affixType: string; type: string; implicitSource?: 'base' | 'searing_exarch' | 'eater_of_worlds' }> = [];
  const explicitMods: Array<{ text: string; affixType: string; type: string }> = [];
  const craftedMods: Array<{ text: string; affixType: string; type: string }> = [];
  const enchantMods: Array<{ text: string; affixType: string; type: string }> = [];

  const skipSet = new Set([
    'Shaper Item', 'Elder Item', 'Crusader Item',
    'Hunter Item', 'Redeemer Item', 'Warlord Item', 'Corrupted',
  ]);
  const flaskMetaRe = /^(Quality:|Lasts |Consumes |Currently has |--------)/;

  const implicitCountLine = lines.find(l => l.startsWith('Implicits:'));
  const hasPrefixSuffix = lines.some(l => /^Prefix:\s*\d+/.test(l) || /^Suffix:\s*\d+/.test(l));

  if (implicitCountLine) {
    const count = parseInt(implicitCountLine.replace('Implicits:', '').trim(), 10) || 0;
    const idx = lines.indexOf(implicitCountLine);
    for (let j = 1; j <= count && idx + j < lines.length; j++) {
      const rawLine = lines[idx + j];
      const implicitSource: 'base' | 'searing_exarch' | 'eater_of_worlds' =
        rawLine.includes('{tags:exarch_mod}') ? 'searing_exarch'
          : rawLine.includes('{tags:eater_mod}') ? 'eater_of_worlds'
            : 'base';
      const cleanText = rawLine.replace(/\{tags:[^}]+\}/g, '').trim();
      implicitMods.push({ text: cleanText, affixType: 'unknown', type: 'implicit', implicitSource });
    }
    // Explicits come after implicits
    const explicitStart = idx + 1 + count;
    for (let j = explicitStart; j < lines.length; j++) {
      const line = lines[j];
      if (skipSet.has(line)) continue;
      if (line.startsWith('Item Level:') || line.startsWith('Quality:') || line.startsWith('LevelReq:') || line.startsWith('Sockets:')) continue;
      if (line.startsWith('{enchant}')) {
        enchantMods.push({ text: line.replace('{enchant}', '').trim(), affixType: 'unknown', type: 'enchant' });
      } else if (line.startsWith('{crafted}')) {
        craftedMods.push({ text: line.replace('{crafted}', '').trim(), affixType: 'unknown', type: 'crafted' });
      } else if (line.startsWith('{')) {
        // Skip tag lines like {range:...} etc
        continue;
      } else {
        explicitMods.push({ text: line, affixType: 'unknown', type: 'explicit' });
      }
    }
  } else if (hasPrefixSuffix) {
    // Flask format: base effect lines, then Prefix: N / Suffix: N sections
    for (let j = headerEndIdx + 1; j < lines.length; j++) {
      const line = lines[j];
      if (/^Prefix:\s*\d+/.test(line) || /^Suffix:\s*\d+/.test(line)) break;
      if (flaskMetaRe.test(line)) continue;
      implicitMods.push({ text: line, affixType: 'unknown', type: 'implicit' });
    }
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (/^Prefix:\s*\d+/.test(line) || /^Suffix:\s*\d+/.test(line)) {
        const aType = line.startsWith('Prefix') ? 'prefix' : 'suffix';
        const count = parseInt(line.replace(/^(Prefix|Suffix):\s*/, ''), 10) || 0;
        for (let k = 1; k <= count && j + k < lines.length; k++) {
          const modLine = lines[j + k];
          if (/^(Prefix|Suffix):\s*\d+/.test(modLine)) break;
          const cleanText = modLine.replace(/\{range:[^}]+\}/g, '').trim();
          if (!cleanText) continue;
          if (cleanText.startsWith('{enchant}')) {
            enchantMods.push({ text: cleanText.replace(/^\{enchant\}/, '').trim(), affixType: 'unknown', type: 'enchant' });
          } else {
            explicitMods.push({ text: cleanText, affixType: aType, type: 'explicit' });
          }
        }
      }
    }
  }

  return {
    name,
    baseName,
    rarity,
    mods: { implicits: implicitMods, explicits: explicitMods, crafted: craftedMods, enchants: enchantMods },
  };
}

/** Convert backend display data to ItemTooltip props */
function gearDisplayToTooltipProps(detail: GearItemDetail): {
  name: string;
  baseName: string;
  rarity: string;
  mods?: StructuredMods;
  displayInfo?: {
    itemName: string;
    baseName: string;
    isCorrupted: boolean;
    influences: string[];
    isFractured: boolean;
    baseStats?: GearDisplayData['baseStats'];
    weaponStats?: GearDisplayData['weaponStats'];
  };
  requirements?: GearDisplayData['requirements'];
  raw?: string;
} {
  const d = detail.display;
  if (!d) {
    // Fallback: parse raw item text into structured fields for proper tooltip rendering
    if (detail.itemText) {
      const parsed = parseRawItemText(detail.itemText);
      return { ...parsed, raw: detail.itemText };
    }
    return { name: '', baseName: '', rarity: 'RARE', raw: detail.itemText };
  }

  const rawMods = d.mods ?? [];

  const implicits = rawMods
    .filter(m => m.type === 'implicit')
    .map(m => ({
      text: m.text,
      affixType: 'unknown',
      type: 'implicit',
      tier: m.tier,
      tierRange: m.tierRange,
      rollRange: m.rollRange,
      implicitSource: m.implicitSource,
    }));

  const explicits = rawMods
    .filter(m => m.type === 'explicit')
    .map(m => ({
      text: m.text,
      affixType: m.affixType ?? 'unknown',
      type: 'explicit',
      tier: m.tier,
      tierRange: m.tierRange,
      rollRange: m.rollRange,
    }));

  const crafted = rawMods
    .filter(m => m.type === 'crafted')
    .map(m => ({
      text: m.text,
      affixType: m.affixType ?? 'unknown',
      type: 'crafted',
    }));

  const enchants = rawMods
    .filter(m => m.type === 'enchant')
    .map(m => ({
      text: m.text,
      affixType: 'unknown',
      type: 'enchant',
    }));

  const mods: StructuredMods = { implicits, explicits, crafted, enchants };

  return {
    name: d.name,
    baseName: d.baseName,
    rarity: d.rarity.toUpperCase(),
    mods,
    displayInfo: {
      itemName: d.name,
      baseName: d.baseName,
      isCorrupted: false,
      influences: d.influence ? [d.influence] : [],
      isFractured: false,
      baseStats: d.baseStats,
      weaponStats: d.weaponStats,
    },
    requirements: d.requirements,
    raw: detail.itemText,
  };
}

/** Parse a pct string like "+5.2%" or "-3.1%" to a numeric value (module-level for use in useState initializer) */
function parsePct(pct: string | undefined): number {
  if (!pct) return 0;
  const cleaned = pct.replace(/[^-+.\d]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function TestGearSetupsResult({ data }: { data: Record<string, unknown> }) {
  const baseline = data.baseline as {
    dps?: number;
    ehp?: number;
    life?: number;
    energyShield?: number;
    resistances?: { fire?: number; cold?: number; lightning?: number; chaos?: number };
  } | undefined;

  const results = (data.results ?? []) as Array<{
    label?: string;
    verdict?: 'UPGRADE' | 'SIDEGRADE' | 'REJECTED';
    verdictReasons?: string[];
    hardConstraintViolations?: string[];
    dps?: { before?: number; after?: number; change?: number; pct?: string };
    ehp?: { before?: number; after?: number; change?: number; pct?: string };
    life?: { before?: number; after?: number; change?: number; pct?: string };
    resistances?: { fire?: number; cold?: number; lightning?: number; chaos?: number };
    warnings?: string[];
    constructionWarnings?: string[];
    significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
    configApplied?: string;
    unconstrainedImpact?: {
      dps?: { before?: number; after?: number; change?: number; pct?: string };
      ehp?: { before?: number; after?: number; change?: number; pct?: string };
      note?: string;
    };
    itemDetails?: GearItemDetail[];
    ref?: string;
  }>;
  const packageCatalog = (data.packageCatalog ?? []) as Array<{
    label?: string;
    dps?: { before?: number; after?: number; change?: number; pct?: string };
    ehp?: { before?: number; after?: number; change?: number; pct?: string };
    itemDetails?: GearItemDetail[];
    ref?: string;
  }>;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;

  const callNumber = data.callNumber as number | undefined;

  // Auto-expand top 3 results (backend already sorts by quality)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => {
    return new Set(results.slice(0, 3).map((_, i) => i));
  });

  // Listen for expand-items custom events dispatched by package pill clicks
  useEffect(() => {
    const handlers = new Map<HTMLElement, () => void>();
    results.forEach((_, i) => {
      const el = document.getElementById(`gear-setup-c${callNumber ?? 0}-${i + 1}`);
      if (el) {
        const handler = () => setExpandedItems(prev => new Set(prev).add(i));
        el.addEventListener('expand-items', handler);
        handlers.set(el, handler);
      }
    });
    return () => {
      handlers.forEach((handler, el) => el.removeEventListener('expand-items', handler));
    };
  }, [callNumber, results.length]);

  // Package registration is now handled at SSE receive time in useDesktopChat
  // via hydrateGearPackagesFromToolResult(), so tooltips work even when this
  // component hasn't mounted (e.g. inside ToolActivitySummary overview mode).

  if (!baseline || results.length === 0) {
    return <DefaultResult data={data} />;
  }

  // Check baseline resistances for cap warnings
  const baselineResCapped = baseline.resistances
    ? [baseline.resistances.fire, baseline.resistances.cold, baseline.resistances.lightning].every(
        (r) => (r ?? 75) >= 75
      )
    : true;

  /** Color class for a delta value */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Check if any elemental resistance is uncapped */
  const hasUncappedRes = (res: { fire?: number; cold?: number; lightning?: number; chaos?: number } | undefined) => {
    if (!res) return false;
    return [res.fire, res.cold, res.lightning].some((r) => r != null && r < 75);
  };

  /** Format uncapped resistances */
  const uncappedResText = (res: { fire?: number; cold?: number; lightning?: number; chaos?: number }) => {
    const uncapped: string[] = [];
    if (res.fire != null && res.fire < 75) uncapped.push(`Fire ${res.fire}%`);
    if (res.cold != null && res.cold < 75) uncapped.push(`Cold ${res.cold}%`);
    if (res.lightning != null && res.lightning < 75) uncapped.push(`Ltng ${res.lightning}%`);
    return uncapped.join(', ');
  };

  /** Toggle item details visibility for a setup */
  const toggleItemExpansion = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  /** Check if setup has items with display data or raw text */
  const hasRenderableItems = (details: GearItemDetail[] | undefined): boolean => {
    if (!details || details.length === 0) return false;
    return details.some(d => d.display || d.itemText);
  };

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Tested setups */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-amber-400/80 uppercase tracking-wide font-medium">
            Tested Setups
          </span>
          {callNumber && callNumber > 1 && (
            <span className="text-[0.625rem] text-slate-500 normal-case tracking-normal">
              call {callNumber}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {results.map((result, i) => {
            const dpsPct = parsePct(result.dps?.pct);
            const ehpPct = parsePct(result.ehp?.pct);
            const itemDetails = result.itemDetails ?? [];
            const isMultiSlot = itemDetails.length > 1;
            const isExpanded = expandedItems.has(i);
            const hasItems = hasRenderableItems(itemDetails);

            return (
              <div
                key={i}
                id={`gear-setup-c${callNumber ?? 0}-${i + 1}`}
                data-ref={result.ref?.toLowerCase()}
                className="py-1.5 px-2 rounded bg-slate-900/40 border-l-2 border-slate-600/40 transition-[box-shadow] duration-300"
              >
                {/* Label row */}
                <div className="flex items-center gap-2">
                  <span className="text-stone-200 text-xs font-medium flex-1">
                    {stripToolTags(result.label ?? '')}
                  </span>
                  {result.configApplied && <ConfigPills configApplied={result.configApplied} />}
                  {isMultiSlot && (
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded border bg-slate-800/60 text-amber-400/80 border-amber-500/20 font-medium flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5" />
                      {itemDetails.length}-Slot
                    </span>
                  )}
                </div>

                {/* DPS + EHP deltas */}
                <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                  <span
                    className={cn(
                      'flex items-center gap-0.5',
                      deltaColor(dpsPct)
                    )}
                  >
                    {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                    {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                    {result.dps?.pct ?? '0%'} DPS
                    {result.dps?.before != null && result.dps?.after != null && result.dps.before !== result.dps.after && (
                      <span className="text-stone-500 text-[0.625rem] ml-0.5">
                        ({formatCompactNumber(result.dps.before)}{'\u2192'}{formatCompactNumber(result.dps.after)})
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-0.5',
                      deltaColor(ehpPct)
                    )}
                  >
                    {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                    {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                    {result.ehp?.pct ?? '0%'} EHP
                    {result.ehp?.before != null && result.ehp?.after != null && result.ehp.before !== result.ehp.after && (
                      <span className="text-stone-500 text-[0.625rem] ml-0.5">
                        ({formatCompactNumber(result.ehp.before)}{'\u2192'}{formatCompactNumber(result.ehp.after)})
                      </span>
                    )}
                  </span>
                </div>

                {/* Resistance warning */}
                {hasUncappedRes(result.resistances) && result.resistances && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    Uncapped: {uncappedResText(result.resistances)}
                  </div>
                )}

                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {result.warnings.map((w, wi) => (
                      <div key={wi} className="text-[0.6875rem] text-stone-500 italic">
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Significant extras pills */}
                {result.significantExtras && result.significantExtras.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.significantExtras.map((extra, ei) => (
                      <span
                        key={ei}
                        className={`text-[0.625rem] px-1 py-0.5 rounded ${
                          extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {formatExtraPill(extra)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Hard constraint violations */}
                {result.hardConstraintViolations && result.hardConstraintViolations.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {result.hardConstraintViolations.slice(0, 3).map((v, vi) => (
                      <div key={vi} className="text-[0.6875rem] text-red-400/90">
                        {v}
                      </div>
                    ))}
                  </div>
                )}

                {/* Unconstrained impact — true potential if constraints fixed */}
                {result.unconstrainedImpact && (
                  <div className="mt-1.5 flex items-center gap-2 px-2 py-1 rounded bg-blue-500/8 border border-blue-500/15 text-xs">
                    <span className="text-blue-400/70 text-[0.625rem] uppercase tracking-wider font-medium shrink-0">
                      If fixed:
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      {result.unconstrainedImpact.dps?.pct && (
                        <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(result.unconstrainedImpact.dps.pct)))}>
                          {parsePct(result.unconstrainedImpact.dps.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                          {result.unconstrainedImpact.dps.pct} DPS
                        </span>
                      )}
                      {result.unconstrainedImpact.ehp?.pct && (
                        <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(result.unconstrainedImpact.ehp.pct)))}>
                          {parsePct(result.unconstrainedImpact.ehp.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                          {result.unconstrainedImpact.ehp.pct} EHP
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Item visualization toggle */}
                {hasItems && (
                  <button
                    type="button"
                    onClick={() => toggleItemExpansion(i)}
                    className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-amber-400/60 hover:text-amber-400/90 transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                    {isExpanded ? 'Hide items' : 'Show items'}
                  </button>
                )}

                {/* Item tooltips - visible when expanded or UPGRADE */}
                <AnimatePresence>
                  {hasItems && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        'mt-2 pt-2 border-t border-[#3a3530]/30',
                        'flex flex-wrap gap-2 justify-center',
                      )}>
                        {itemDetails.filter(d => d.display || d.itemText).map((detail, di) => {
                          const tooltipProps = gearDisplayToTooltipProps(detail);
                          return (
                            <div key={di} className="flex flex-col items-center gap-1">
                              {/* Slot label */}
                              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400/70 border border-amber-500/15 font-medium uppercase tracking-wider">
                                {detail.slot ?? 'Unknown'}
                              </span>
                              {/* Item tooltip - match sidebar presentation */}
                              <ItemTooltip
                                {...tooltipProps}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Hidden anchors for non-top results so package pills can still resolve
            to the correct tool call even when the referenced package is not one
            of the rendered top setups. */}
        {packageCatalog
          .filter((entry) => entry.ref && !results.some((result) => result.ref === entry.ref))
          .map((entry) => (
            <div
              key={`pkg-anchor-${entry.ref}`}
              data-ref={entry.ref?.toLowerCase()}
              data-package-anchor="true"
              className="h-0 overflow-hidden pointer-events-none"
              aria-hidden="true"
            />
          ))}
      </div>
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

function FindGearUpgradesResult({ data }: { data: Record<string, unknown> }) {
  const tradeUrl = typeof data.tradeUrl === 'string' ? data.tradeUrl : '';
  const totalResults = Number(data.totalResults ?? 0);
  const relaxation = typeof data.relaxation === 'string' ? data.relaxation : undefined;
  const items = (data.items ?? []) as Array<{
    slot?: string;
    name?: string;
    baseType?: string;
    price?: { amount?: number; currency?: string };
    keyMods?: string[];
    itemText?: string;
    verdict?: 'UPGRADE' | 'SIDEGRADE' | 'DOWNGRADE';
    dps?: { pctChange?: number };
    ehp?: { pctChange?: number };
    configApplied?: string;
  }>;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

  if (!tradeUrl && items.length === 0) {
    return <DefaultResult data={data} />;
  }

  const verdictBadge = (verdict?: string) => {
    switch (verdict) {
      case 'UPGRADE':
        return 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30';
      case 'SIDEGRADE':
        return 'bg-amber-900/30 text-amber-300 border-amber-500/30';
      case 'DOWNGRADE':
        return 'bg-red-900/30 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-800/60 text-stone-400 border-stone-600/30';
    }
  };

  const verdictBorder = (verdict?: string) => {
    switch (verdict) {
      case 'UPGRADE':
        return 'border-emerald-500/60';
      case 'SIDEGRADE':
        return 'border-amber-500/60';
      case 'DOWNGRADE':
        return 'border-red-500/60';
      default:
        return 'border-stone-500/40';
    }
  };

  const toggleItemExpansion = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="text-sm px-1 space-y-3">
      <div className="space-y-1">
        <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
          Trade Results
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-300">
          <span>{totalResults} results found</span>
          {tradeUrl && (
            <button
              className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300"
              onClick={(e) => { e.stopPropagation(); openExternal(tradeUrl); }}
            >
              Open Trade <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        {relaxation && (
          <div className="text-[0.6875rem] text-amber-400/90">
            Relaxation: {relaxation}
          </div>
        )}
        {baselineConfig && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <span className="text-[0.625rem] text-slate-500 uppercase tracking-wider">Config:</span>
            <span className="text-[0.625rem] text-slate-400 font-mono">{baselineConfig}</span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.slice(0, 8).map((item, i) => {
            const verdict = item.verdict;
            const priceAmount = item.price?.amount;
            const priceCurrency = item.price?.currency;
            const dpsPct = Number(item.dps?.pctChange ?? 0);
            const ehpPct = Number(item.ehp?.pctChange ?? 0);
            const isExpanded = expandedItems.has(i);
            const hasTooltip = typeof item.itemText === 'string' && item.itemText.trim().length > 0;

            return (
              <div
                key={i}
                className={cn(
                  'py-1.5 px-2 rounded bg-slate-900/40 border-l-2',
                  verdictBorder(verdict),
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-stone-200 text-xs font-medium flex-1">
                    {stripToolTags(item.name ?? 'Unknown Item')}
                    {item.baseType && (
                      <span className="text-stone-500 font-normal ml-1">
                        ({item.baseType})
                      </span>
                    )}
                  </span>
                  {priceAmount != null && priceCurrency && (
                    <span className="text-[0.6875rem] text-amber-300 font-mono">
                      {priceAmount} {priceCurrency}
                    </span>
                  )}
                  {item.configApplied && <ConfigPills configApplied={item.configApplied} />}
                </div>

                {(item.dps || item.ehp) && (
                  <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                    {item.dps && (
                      <span className={cn(
                        'flex items-center gap-0.5',
                        dpsPct > 0 ? 'text-emerald-400' : dpsPct < 0 ? 'text-red-400' : 'text-stone-400',
                      )}>
                        {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                        {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                        {dpsPct > 0 ? '+' : ''}{dpsPct.toFixed(1)}% DPS
                      </span>
                    )}
                    {item.ehp && (
                      <span className={cn(
                        'flex items-center gap-0.5',
                        ehpPct > 0 ? 'text-emerald-400' : ehpPct < 0 ? 'text-red-400' : 'text-stone-400',
                      )}>
                        {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                        {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                        {ehpPct > 0 ? '+' : ''}{ehpPct.toFixed(1)}% EHP
                      </span>
                    )}
                  </div>
                )}

                {Array.isArray(item.keyMods) && item.keyMods.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.keyMods.slice(0, 4).map((mod, mi) => (
                      <span key={mi} className="text-[0.625rem] px-1 py-0.5 rounded bg-slate-800/70 text-stone-300">
                        {mod}
                      </span>
                    ))}
                  </div>
                )}

                {hasTooltip && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleItemExpansion(i)}
                      className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-amber-400/70 hover:text-amber-400/95 transition-colors"
                    >
                      <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', isExpanded && 'rotate-180')} />
                      {isExpanded ? 'Hide item' : 'Show item'}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 border-t border-[#3a3530]/30 flex justify-center">
                            <ItemTooltip
                              {...gearDisplayToTooltipProps({
                                slot: item.slot,
                                itemText: item.itemText,
                              })}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/** Mod entry in a BuildModMenus response */
interface ModMenuItem {
  stat: string;
  statId: string;
  type: 'prefix' | 'suffix';
  relevance: 'offensive' | 'defensive' | 'utility';
  tier: number;
  range: string;
  ladderUsage?: number;
  tag?: string;
  /** Mod group for mutual exclusion — mods in same group cannot coexist on an item */
  group?: string;
}

/** Eldritch implicit entry with stat, relevance, and top tier info */
interface EldritchImplicitEntry {
  stat?: string;
  statId?: string;
  relevance?: string;
  topTier?: { tier?: number; range?: string };
}

/** Ladder usage entry */
interface LadderUsageEntry {
  mod?: string;
  name?: string;
  usage: number;
  defenseLabel?: string;
  implicits?: string[];
  chaosPrice?: number;
  divinePrice?: number;
}

/** Enriched ladder mod with affix type, tier, and source info */
interface EnrichedLadderModEntry {
  mod: string;
  displayText?: string;
  range?: string;
  statId?: string;
  usage: number;
  affixType?: 'prefix' | 'suffix';
  tier?: number;
  /** Source type matching analyzer's enriched categories */
  source?: 'regular' | 'exarch' | 'eater' | 'crafted' | 'enchant' | 'essence' | 'fractured' | 'shaper' | 'elder' | 'crusader' | 'redeemer' | 'hunter';
}

interface AvailableBase {
  name: string;
  implicits: string[];
}

/** Base type delta showing additional/missing mods for alternate defense types */
interface BaseTypeDeltaUI {
  defenseTag: string;
  defenseLabel: string;
  baseNames: string[];
  additionalPrefixes: ModMenuItem[];
  additionalSuffixes: ModMenuItem[];
  missingPrefixIds: string[];
  missingSuffixIds: string[];
}

interface SlotModMenu {
  slot: string;
  itemClass?: string;
  baseName: string;
  baseAlternatives?: string[];
  availableBases?: AvailableBase[];
  ladderUniques?: LadderUsageEntry[];
  ladderBases?: LadderUsageEntry[];
  ladderMods?: EnrichedLadderModEntry[];
  ladderStats?: {
    prefixes?: EnrichedLadderModEntry[];
    suffixes?: EnrichedLadderModEntry[];
    exarch?: EnrichedLadderModEntry[];
    eater?: EnrichedLadderModEntry[];
    crafted?: EnrichedLadderModEntry[];
    essence?: EnrichedLadderModEntry[];
    enchant?: EnrichedLadderModEntry[];
    fractured?: EnrichedLadderModEntry[];
    shaper?: EnrichedLadderModEntry[];
    elder?: EnrichedLadderModEntry[];
    crusader?: EnrichedLadderModEntry[];
    redeemer?: EnrichedLadderModEntry[];
    hunter?: EnrichedLadderModEntry[];
  };
  prefixes?: ModMenuItem[];
  suffixes?: ModMenuItem[];
  influenceMods?: Record<string, { prefixes?: ModMenuItem[]; suffixes?: ModMenuItem[] }>;
  essenceMods?: ModMenuItem[];
  craftedMods?: ModMenuItem[];
  defenseLabel?: string;
  baseTypeDeltas?: BaseTypeDeltaUI[];
  flaskEnchants?: Array<string | { text: string; usage?: number }>;
  eldritchImplicits?: {
    searingExarch?: EldritchImplicitEntry[];
    eaterOfWorlds?: EldritchImplicitEntry[];
  };
}

/** Tier badge color */
function tierBadgeColor(tier: number): string {
  if (tier === 1) return 'bg-amber-900/40 text-amber-300 border-amber-500/30';
  if (tier === 2) return 'bg-yellow-900/30 text-yellow-300 border-yellow-500/25';
  if (tier === 3) return 'bg-stone-800/60 text-stone-300 border-stone-500/30';
  return 'bg-slate-800/50 text-stone-400 border-stone-600/20';
}

/** Render a group of mods with a colored section header */
function ModGroup({ label, mods, headerColor }: {
  label: string;
  mods: ModMenuItem[];
  headerColor: string;
}) {
  if (mods.length === 0) return null;

  // Build group conflict index: group name → count of mods sharing it
  const groupCounts = new Map<string, number>();
  for (const mod of mods) {
    if (mod.group) {
      groupCounts.set(mod.group, (groupCounts.get(mod.group) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-0.5">
      <div className={cn('text-[0.625rem] uppercase tracking-wider font-semibold', headerColor)}>
        {label} ({mods.length})
      </div>
      <div className="space-y-px">
        {mods.map((mod, i) => {
          const hasConflict = mod.group != null && (groupCounts.get(mod.group) ?? 0) > 1;
          return (
            <div key={i} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span className={cn(
                  'text-[0.5625rem] font-bold uppercase flex-shrink-0 w-3',
                  mod.type === 'prefix' ? 'text-emerald-400/70' : 'text-violet-400/70',
                )}>
                  {mod.type === 'prefix' ? 'P' : 'S'}
                </span>
                <span className="text-blue-400 truncate">{mod.stat || mod.statId}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {mod.group && (
                  <span
                    className={cn(
                      'text-[0.5rem] px-1 py-px rounded font-mono truncate max-w-[7rem]',
                      hasConflict
                        ? 'bg-orange-900/30 text-orange-400/70 border border-orange-600/20'
                        : 'bg-stone-800/40 text-stone-500 border border-stone-700/20',
                    )}
                    title={hasConflict
                      ? `Mod group "${mod.group}" — only ONE mod from this group can exist on an item`
                      : `Mod group: ${mod.group}`}
                  >
                    {mod.group}
                  </span>
                )}
                {mod.ladderUsage != null && (
                  <span className="text-[0.5625rem] text-sky-400/60 font-mono">
                    {Math.round(mod.ladderUsage)}%
                  </span>
                )}
                {mod.tier != null && (
                  <span className={cn(
                    'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                    tierBadgeColor(mod.tier),
                  )}>
                    T{mod.tier}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Render a group of eldritch implicits with themed section header */
function EldritchGroup({ label, implicits, accentClasses }: {
  label: string;
  implicits: EldritchImplicitEntry[];
  accentClasses: { header: string; rowBg: string; tierBg: string; tierText: string; tierBorder: string };
}) {
  if (implicits.length === 0) return null;

  return (
    <div className="space-y-0.5">
      <div className={cn('text-[0.625rem] uppercase tracking-wider font-semibold', accentClasses.header)}>
        {label} ({implicits.length})
      </div>
      <div className="space-y-px">
        {implicits.map((impl, i) => (
          <div key={i} className={cn('flex items-center justify-between gap-2 py-0.5 px-1.5 rounded text-xs', accentClasses.rowBg)}>
            <span className="text-stone-300 truncate">{impl.stat || impl.statId}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {impl.topTier?.tier != null && (
                <span className={cn(
                  'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                  accentClasses.tierBg, accentClasses.tierText, accentClasses.tierBorder,
                )}>
                  T{impl.topTier.tier}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Accent classes for Searing Exarch (fire-orange tones) */
const EXARCH_ACCENTS = {
  header: 'text-orange-400/80',
  rowBg: 'bg-orange-950/20',
  tierBg: 'bg-orange-900/40',
  tierText: 'text-orange-300',
  tierBorder: 'border-orange-500/30',
} as const;

/** Accent classes for Eater of Worlds (ice-blue tones) */
const EATER_ACCENTS = {
  header: 'text-cyan-400/80',
  rowBg: 'bg-cyan-950/20',
  tierBg: 'bg-cyan-900/40',
  tierText: 'text-cyan-300',
  tierBorder: 'border-cyan-500/30',
} as const;

/** Accent colors for influence mod sections */
const INFLUENCE_COLORS: Record<string, { header: string; rowBg: string }> = {
  shaper: { header: 'text-blue-300/80', rowBg: 'bg-blue-950/15' },
  elder: { header: 'text-gray-300/80', rowBg: 'bg-gray-900/20' },
  crusader: { header: 'text-yellow-200/80', rowBg: 'bg-yellow-950/10' },
  hunter: { header: 'text-green-300/80', rowBg: 'bg-green-950/15' },
  redeemer: { header: 'text-blue-200/80', rowBg: 'bg-blue-950/10' },
  warlord: { header: 'text-red-300/80', rowBg: 'bg-red-950/15' },
};

function BuildModMenusResult({ data }: { data: Record<string, unknown> }) {
  const menusBuilt = Number(data.menusBuilt ?? 0);
  const menus = (data.menus ?? []) as SlotModMenu[];
  const filterStats = data.filterStats as { totalBefore?: number; totalAfter?: number; totalRemoved?: number; perSlot?: string } | undefined;
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(() => new Set());

  if (menusBuilt === 0 && menus.length === 0) {
    return <DefaultResult data={data} />;
  }

  const toggleSlot = (idx: number) => {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // No fallback - if menus are empty but menusBuilt > 0, surface the error
  if (menus.length === 0) {
    return (
      <div className="text-sm px-1 space-y-1.5">
        <div className="text-xs text-red-400/80 uppercase tracking-wide font-medium">
          Curated Mod Menus - Error
        </div>
        <div className="text-xs text-red-300/70">
          Built {menusBuilt} menus but no detailed data received. Check backend tool event emission.
        </div>
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  return (
    <div className="text-sm px-1 space-y-2">
      <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
        Curated Mod Menus ({menus.length} slots)
      </div>

      {filterStats && filterStats.totalRemoved != null && filterStats.totalRemoved > 0 && (
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-stone-400">
          <Filter className="w-3 h-3 text-amber-500/60 flex-shrink-0" />
          <span>
            {filterStats.totalRemoved} irrelevant mods filtered
            {filterStats.totalBefore != null && filterStats.totalAfter != null && (
              <span className="text-stone-500 ml-1">
                ({filterStats.totalBefore} &rarr; {filterStats.totalAfter})
              </span>
            )}
          </span>
        </div>
      )}

      <div className="space-y-1">
        {menus.map((menu, i) => {
          const prefixCount = menu.prefixes?.length ?? 0;
          const suffixCount = menu.suffixes?.length ?? 0;
          const exarchImplicits = menu.eldritchImplicits?.searingExarch ?? [];
          const eaterImplicits = menu.eldritchImplicits?.eaterOfWorlds ?? [];
          const eldritchCount = exarchImplicits.length + eaterImplicits.length;
          const ladderModCount = menu.ladderStats
            ? Object.values(menu.ladderStats).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
            : (menu.ladderMods?.length ?? 0);
          const ladderBaseCount = menu.ladderBases?.length ?? 0;
          const ladderUniqueCount = menu.ladderUniques?.length ?? 0;
          const influenceModCount = menu.influenceMods
            ? Object.values(menu.influenceMods).reduce((sum, d) => sum + (d.prefixes?.length ?? 0) + (d.suffixes?.length ?? 0), 0)
            : 0;
          const craftedModCount = menu.craftedMods?.length ?? 0;
          const essenceModCount = menu.essenceMods?.length ?? 0;
          const flaskEnchantCount = menu.flaskEnchants?.length ?? 0;
          const isExpanded = expandedSlots.has(i);

          return (
            <div key={i} className="rounded bg-slate-900/30 border border-stone-700/20 overflow-hidden">
              {/* Collapsed row - always visible */}
              <button
                type="button"
                onClick={() => toggleSlot(i)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <ChevronDown className={cn(
                  'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
                  isExpanded && 'rotate-180',
                )} />

                {/* Slot name — show item class for weapon slots (e.g. "Shields" instead of "Weapon 2") */}
                <span className="text-xs text-stone-200 font-medium flex-shrink-0">
                  {menu.itemClass ?? menu.slot ?? 'Unknown'}
                </span>

                {/* Base type (hidden for Flasks — many base types, no single representative) */}
                {menu.slot !== 'Flasks' && (
                  <span className="text-[0.6875rem] text-stone-500 truncate">
                    {menu.baseName ?? ''}
                    {menu.baseAlternatives && menu.baseAlternatives.length > 0 && (
                      <> (+{menu.baseAlternatives.length} alt)</>
                    )}
                  </span>
                )}

                {/* Spacer */}
                <span className="flex-1" />

                {/* Mod count pills */}
                {prefixCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-emerald-900/25 text-emerald-400/80 font-mono tabular-nums">
                    {prefixCount}P
                  </span>
                )}
                {suffixCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-violet-900/25 text-violet-400/80 font-mono tabular-nums">
                    {suffixCount}S
                  </span>
                )}
                {essenceModCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-amber-900/25 text-amber-400/80 font-mono tabular-nums">
                    {essenceModCount} essence
                  </span>
                )}
                {eldritchCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-gradient-to-r from-orange-900/25 to-cyan-900/25 text-orange-300/80 font-mono tabular-nums">
                    {eldritchCount} eldritch
                  </span>
                )}
                {ladderModCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-sky-900/25 text-sky-400/70 font-mono tabular-nums">
                    {ladderModCount} ladder
                  </span>
                )}
                {influenceModCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-rose-900/25 text-rose-400/80 font-mono tabular-nums">
                    {influenceModCount} influenced
                  </span>
                )}
                {craftedModCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-blue-900/25 text-blue-400/80 font-mono tabular-nums">
                    {craftedModCount} crafted
                  </span>
                )}
                {flaskEnchantCount > 0 && (
                  <span className="text-[0.625rem] px-1 py-px rounded bg-amber-900/25 text-amber-400/80 font-mono tabular-nums">
                    {flaskEnchantCount} enchant
                  </span>
                )}
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-stone-700/20">
                      {/* Ladder unique usage for this slot */}
                      {ladderUniqueCount > 0 && (
                        <div className="space-y-0.5">
                          <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-yellow-400/70">
                            Ladder Uniques
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {menu.ladderUniques!.map((u, j) => (
                              <span key={j} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-yellow-950/20 text-yellow-300/80 border border-yellow-800/20">
                                {u.name ?? 'Unknown'} <span className="text-yellow-500/60">{Math.round(u.usage)}%</span>
                                {u.chaosPrice != null && (
                                  <span className="text-stone-500 text-[0.625rem] ml-0.5">
                                    {u.chaosPrice >= 200 && u.divinePrice != null
                                      ? `~${Math.round(u.divinePrice)}div`
                                      : `~${Math.round(u.chaosPrice)}c`}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available bases with implicits (non-armor slots) */}
                      {menu.availableBases && menu.availableBases.length > 0 ? (
                        <div className="space-y-0.5">
                          <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-amber-400/70">
                            Available Bases
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {menu.availableBases.map((b, j) => (
                              <span
                                key={j}
                                className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-950/15 text-stone-300 border border-amber-800/15"
                                title={b.implicits.length > 0 ? b.implicits.join(', ') : 'No implicit'}
                              >
                                {b.name}
                                {b.implicits.length > 0 && (
                                  <span className="text-amber-400/50 ml-1">
                                    {b.implicits[0].length > 30 ? b.implicits[0].slice(0, 28) + '...' : b.implicits[0]}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                          {ladderBaseCount > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-[0.5625rem] text-sky-500/50 uppercase tracking-wider">Ladder:</span>
                              {menu.ladderBases!.map((b, j) => (
                                <span key={j} className="text-[0.625rem] px-1 py-px rounded bg-sky-950/20 text-sky-300/70 border border-sky-800/15" title={b.implicits?.join(', ')}>
                                  {b.name ?? b.mod ?? 'Unknown'}
                                  {b.implicits && b.implicits.length > 0 && (
                                    <span className="text-sky-400/40 ml-1">
                                      {b.implicits[0].length > 25 ? b.implicits[0].slice(0, 23) + '...' : b.implicits[0]}
                                    </span>
                                  )}
                                  {b.defenseLabel && (
                                    <span className="ml-1 text-[0.5625rem] px-1 py-px rounded bg-stone-800/60 text-stone-400 border border-stone-600/20 font-medium">
                                      {b.defenseLabel}
                                    </span>
                                  )}
                                  {' '}<span className="text-sky-500/50">{Math.round(b.usage)}%</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Simple base info for armor slots */}
                          {menu.baseName && (
                            <div className="text-[0.6875rem] text-stone-400">
                              Base: <span className="text-stone-300">{menu.baseName}</span>
                              {menu.baseAlternatives && menu.baseAlternatives.length > 0 && (
                                <span className="text-stone-500"> (also: {menu.baseAlternatives.join(', ')})</span>
                              )}
                            </div>
                          )}
                          {ladderBaseCount > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-sky-400/70">
                                Ladder Bases
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {menu.ladderBases!.map((b, j) => (
                                  <span key={j} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-sky-950/20 text-sky-300/80 border border-sky-800/20" title={b.implicits?.join(', ')}>
                                    {b.name}
                                    {b.implicits && b.implicits.length > 0 && (
                                      <span className="text-sky-400/40 ml-1">
                                        {b.implicits[0].length > 25 ? b.implicits[0].slice(0, 23) + '...' : b.implicits[0]}
                                      </span>
                                    )}
                                    {b.defenseLabel && (
                                      <span className="ml-1 text-[0.5625rem] px-1 py-px rounded bg-stone-800/60 text-stone-400 border border-stone-600/20 font-medium">
                                        {b.defenseLabel}
                                      </span>
                                    )}
                                    {' '}<span className="text-sky-500/60">{Math.round(b.usage)}%</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Ladder mods — structured subcategories or flat fallback */}
                      {ladderModCount > 0 && (() => {
                        const LADDER_CATEGORIES = [
                          { key: 'prefixes' as const, label: 'Ladder Prefixes', color: 'text-emerald-400/70', rowBg: 'bg-emerald-950/10' },
                          { key: 'suffixes' as const, label: 'Ladder Suffixes', color: 'text-violet-400/70', rowBg: 'bg-violet-950/10' },
                          { key: 'exarch' as const, label: 'Ladder Searing Exarch', color: 'text-orange-400/70', rowBg: 'bg-orange-950/10' },
                          { key: 'eater' as const, label: 'Ladder Eater of Worlds', color: 'text-cyan-400/70', rowBg: 'bg-cyan-950/10' },
                          { key: 'shaper' as const, label: 'Ladder Shaper', color: 'text-sky-300/70', rowBg: 'bg-sky-950/10' },
                          { key: 'elder' as const, label: 'Ladder Elder', color: 'text-slate-300/70', rowBg: 'bg-slate-800/10' },
                          { key: 'crusader' as const, label: 'Ladder Crusader', color: 'text-yellow-200/70', rowBg: 'bg-yellow-950/10' },
                          { key: 'redeemer' as const, label: 'Ladder Redeemer', color: 'text-teal-300/70', rowBg: 'bg-teal-950/10' },
                          { key: 'hunter' as const, label: 'Ladder Hunter', color: 'text-green-300/70', rowBg: 'bg-green-950/10' },
                          { key: 'crafted' as const, label: 'Ladder Crafted', color: 'text-blue-400/70', rowBg: 'bg-blue-950/10' },
                          { key: 'essence' as const, label: 'Ladder Essence', color: 'text-amber-400/70', rowBg: 'bg-amber-950/10' },
                          { key: 'enchant' as const, label: 'Ladder Enchants', color: 'text-stone-400/70', rowBg: 'bg-stone-950/10' },
                          { key: 'fractured' as const, label: 'Ladder Fractured', color: 'text-purple-400/70', rowBg: 'bg-purple-950/10' },
                        ];

                        if (menu.ladderStats) {
                          return (
                            <div className="space-y-1">
                              {LADDER_CATEGORIES.map(cat => {
                                const entries = menu.ladderStats?.[cat.key];
                                if (!entries || entries.length === 0) return null;
                                return (
                                  <div key={cat.key} className="space-y-0.5">
                                    <div className={cn('text-[0.625rem] uppercase tracking-wider font-semibold', cat.color)}>
                                      {cat.label} ({entries.length})
                                    </div>
                                    <div className="space-y-px">
                                      {entries.map((m, j) => (
                                        <div key={j} className={cn('flex items-center justify-between gap-2 py-0.5 px-1.5 rounded text-xs', cat.rowBg)}>
                                          <div className="flex items-center gap-1.5 truncate">
                                            {m.affixType ? (
                                              <span className={cn(
                                                'text-[0.5625rem] font-bold uppercase flex-shrink-0 w-3',
                                                m.affixType === 'prefix' ? 'text-emerald-400/70' : 'text-violet-400/70',
                                              )}>
                                                {m.affixType === 'prefix' ? 'P' : 'S'}
                                              </span>
                                            ) : null}
                                            <span className="text-stone-300 truncate">{m.displayText || m.mod}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {m.tier != null && (
                                              <span className={cn(
                                                'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                                                tierBadgeColor(m.tier),
                                              )}>
                                                T{m.tier}
                                              </span>
                                            )}
                                            <span className="text-[0.625rem] text-sky-500/60 font-mono">{Math.round(m.usage)}%</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        // Fallback: flat ladderMods rendering (backwards compat)
                        return (
                          <div className="space-y-0.5">
                            <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-sky-400/70">
                              Ladder Mods
                            </div>
                            <div className="space-y-px">
                              {menu.ladderMods!.map((m, j) => (
                                <div key={j} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-sky-950/10 text-xs">
                                  <div className="flex items-center gap-1.5 truncate">
                                    {m.affixType ? (
                                      <span className={cn(
                                        'text-[0.5625rem] font-bold uppercase flex-shrink-0 w-3',
                                        m.affixType === 'prefix' ? 'text-emerald-400/70' : 'text-violet-400/70',
                                      )}>
                                        {m.affixType === 'prefix' ? 'P' : 'S'}
                                      </span>
                                    ) : null}
                                    {m.source && m.source !== 'regular' ? (
                                      <span className={cn(
                                        'text-[0.5625rem] font-bold uppercase flex-shrink-0',
                                        m.source === 'exarch' ? 'text-orange-400/70' :
                                        m.source === 'eater' ? 'text-cyan-400/70' :
                                        m.source === 'crafted' ? 'text-blue-400/70' :
                                        m.source === 'essence' ? 'text-amber-400/70' :
                                        'text-stone-400/70',
                                      )}>
                                        {m.source === 'exarch' ? 'SE' :
                                         m.source === 'eater' ? 'EW' :
                                         m.source === 'crafted' ? 'C' :
                                         m.source === 'enchant' ? 'ENH' :
                                         m.source === 'essence' ? 'ES' : ''}
                                      </span>
                                    ) : null}
                                    <span className="text-stone-300 truncate">{m.displayText || m.mod}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {m.tier != null && (
                                      <span className={cn(
                                        'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                                        tierBadgeColor(m.tier),
                                      )}>
                                        T{m.tier}
                                      </span>
                                    )}
                                    <span className="text-[0.625rem] text-sky-500/60 font-mono">{Math.round(m.usage)}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Separator between ladder stats and mod pool */}
                      {ladderModCount > 0 && (menu.prefixes?.length ?? 0) + (menu.suffixes?.length ?? 0) > 0 && (
                        <div className="border-t border-dashed border-stone-700/20 pt-1 mt-1">
                          <span className="text-[0.5625rem] text-stone-600 italic">Additional mods not in ladder data:</span>
                        </div>
                      )}

                      {/* Prefix mods */}
                      <ModGroup
                        label="Prefixes"
                        mods={menu.prefixes ?? []}
                        headerColor="text-emerald-400/80"
                      />

                      {/* Suffix mods */}
                      <ModGroup
                        label="Suffixes"
                        mods={menu.suffixes ?? []}
                        headerColor="text-violet-400/80"
                      />

                      {/* Flask enchantments — trigger conditions + utility enchants */}
                      {menu.flaskEnchants && menu.flaskEnchants.length > 0 && (
                        <div className="space-y-0.5">
                          <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-amber-400/70">
                            Flask Enchants ({menu.flaskEnchants.length})
                          </div>
                          <div className="space-y-px">
                            {menu.flaskEnchants.map((enchant, j) => {
                              const text = typeof enchant === 'string' ? enchant : enchant.text;
                              const usage = typeof enchant === 'object' ? enchant.usage : undefined;
                              return (
                                <div key={j} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-amber-950/10 text-xs">
                                  <span className="text-stone-300 truncate">{text}</span>
                                  {usage != null && (
                                    <span className="text-[0.625rem] text-amber-500/60 font-mono flex-shrink-0">{Math.round(usage)}%</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Base type delta sections — additional/missing mods for alternate defense types */}
                      {(menu.baseTypeDeltas?.length ?? 0) > 0 && menu.baseTypeDeltas!.map((delta, di) => (
                        <div key={di} className="space-y-1.5 mt-2 pt-2 border-t border-dashed border-stone-700/30">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[0.625rem] uppercase tracking-wider font-semibold text-amber-400/70">
                              {delta.defenseLabel} Base Mods
                            </span>
                            <span className="text-[0.625rem] text-stone-500">
                              ({delta.baseNames.join(', ')})
                            </span>
                          </div>

                          {/* Additional prefixes for alternate defense type */}
                          {delta.additionalPrefixes.length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-emerald-400/50">
                                +Prefixes ({delta.additionalPrefixes.length})
                              </div>
                              <div className="space-y-px">
                                {delta.additionalPrefixes.map((m, mi) => (
                                  <div key={mi} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30 text-xs">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="text-[0.5625rem] font-bold uppercase flex-shrink-0 w-3 text-emerald-400/70">
                                        P
                                      </span>
                                      <span className="text-stone-300 truncate">{m.stat || m.statId}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {m.ladderUsage != null && (
                                        <span className="text-[0.5625rem] text-sky-400/60 font-mono">
                                          {Math.round(m.ladderUsage)}%
                                        </span>
                                      )}
                                      {m.tier != null && (
                                        <span className={cn(
                                          'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                                          tierBadgeColor(m.tier),
                                        )}>
                                          T{m.tier}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Additional suffixes for alternate defense type */}
                          {delta.additionalSuffixes.length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-violet-400/50">
                                +Suffixes ({delta.additionalSuffixes.length})
                              </div>
                              <div className="space-y-px">
                                {delta.additionalSuffixes.map((m, mi) => (
                                  <div key={mi} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30 text-xs">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="text-[0.5625rem] font-bold uppercase flex-shrink-0 w-3 text-violet-400/70">
                                        S
                                      </span>
                                      <span className="text-stone-300 truncate">{m.stat || m.statId}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {m.ladderUsage != null && (
                                        <span className="text-[0.5625rem] text-sky-400/60 font-mono">
                                          {Math.round(m.ladderUsage)}%
                                        </span>
                                      )}
                                      {m.tier != null && (
                                        <span className={cn(
                                          'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                                          tierBadgeColor(m.tier),
                                        )}>
                                          T{m.tier}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Missing mods note */}
                          {(delta.missingPrefixIds.length > 0 || delta.missingSuffixIds.length > 0) && (
                            <div className="text-[0.625rem] text-red-400/40 italic">
                              Not on {delta.defenseLabel}: {[...delta.missingPrefixIds, ...delta.missingSuffixIds].join(', ')}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Essence mods */}
                      {(menu.essenceMods?.length ?? 0) > 0 && (
                        <div className="space-y-1">
                          <div className="text-[0.6875rem] font-semibold text-amber-400/80 uppercase tracking-wider">
                            Essence Mods ({menu.essenceMods!.length})
                          </div>
                          <p className="text-[0.5625rem] text-stone-500 -mt-0.5">Require a specific Essence to apply — not rollable with Chaos/Fossils</p>
                          <ModGroup label="Essence" mods={menu.essenceMods!} headerColor="text-amber-400/70" />
                        </div>
                      )}

                      {/* Influence mods */}
                      {menu.influenceMods && Object.entries(menu.influenceMods).map(([infType, infData]) => {
                        const colors = INFLUENCE_COLORS[infType] || INFLUENCE_COLORS.shaper;
                        const infName = infType.charAt(0).toUpperCase() + infType.slice(1);
                        return (
                          <div key={infType} className="space-y-1">
                            {(infData.prefixes?.length ?? 0) > 0 && (
                              <ModGroup label={`${infName} Prefixes`} mods={infData.prefixes!} headerColor={colors.header} />
                            )}
                            {(infData.suffixes?.length ?? 0) > 0 && (
                              <ModGroup label={`${infName} Suffixes`} mods={infData.suffixes!} headerColor={colors.header} />
                            )}
                          </div>
                        );
                      })}

                      {/* Crafted mods */}
                      {(menu.craftedMods?.length ?? 0) > 0 && (
                        <ModGroup label="Crafted" mods={menu.craftedMods!} headerColor="text-blue-400/70" />
                      )}

                      {/* Eldritch implicits */}
                      {eldritchCount > 0 && (
                        <div className="space-y-2 pt-1 border-t border-stone-700/10">
                          <EldritchGroup
                            label="Searing Exarch"
                            implicits={exarchImplicits}
                            accentClasses={EXARCH_ACCENTS}
                          />
                          <EldritchGroup
                            label="Eater of Worlds"
                            implicits={eaterImplicits}
                            accentClasses={EATER_ACCENTS}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}


// =============================================================================
// Jewel Preflight Types
// =============================================================================

interface JewelSocketSummary {
  totalAllocated: number;
  equipped: number;
  empty: number;
  hasCluster: boolean;
}

interface JewelCuratedMod {
  stat: string;
  statId: string;
  displayText: string;
  relevance: 'offensive' | 'defensive' | 'utility';
  topTier: { tier: number; range: string };
  generationType: 'prefix' | 'suffix';
  weight: number;
  tag?: string;
  ladderUsage?: number;
}

interface JewelModMenu {
  recommendedBase: string;
  prefixes: JewelCuratedMod[];
  suffixes: JewelCuratedMod[];
}

interface ClusterBase {
  enchantName: string;
  baseTag: string;
  smallPassiveStats?: string[];
  topNotables: Array<{ name: string; ladderUsage?: number }>;
}

interface ClusterMenu {
  largeBases: ClusterBase[];
  mediumBases: ClusterBase[];
  ladderNotables: Array<{ name: string; usage: number }>;
  ladderClusterUsage?: Array<{
    size: 'Large' | 'Medium' | 'Small';
    enchantment: string;
    usage: number;
    topNotables: Array<{ name: string; usage: number }>;
  }>;
}

interface WatchersEyeMenu {
  activeAuras: string[];
  modsPerAura: Array<{
    aura: string;
    mods: Array<{ text: string; category: string; ladderUsage?: number }>;
  }>;
}

interface UniqueSuggestion {
  name: string;
  usage: number;
  variant?: string;
  iconUrl?: string;
  baseType?: string;
}

/** Relevance-to-color mapping for Watcher's Eye mod categories */
const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  offensive: 'bg-amber-900/30 text-amber-400/80 border-amber-500/20',
  defensive: 'bg-blue-900/30 text-blue-400/80 border-blue-500/20',
  utility: 'bg-stone-800/40 text-stone-400/80 border-stone-600/20',
};

function BuildJewelMenusResult({ data }: { data: Record<string, unknown> }) {
  const socketSummary = (data.socketSummary ?? {}) as Partial<JewelSocketSummary>;
  const regularJewelMenu = (data.regularJewelMenu ?? null) as JewelModMenu | null;
  const abyssJewelMenu = (data.abyssJewelMenu ?? null) as JewelModMenu | null;
  const clusterMenu = (data.clusterMenu ?? null) as ClusterMenu | null;
  const watchersEyeMenu = (data.watchersEyeMenu ?? null) as WatchersEyeMenu | null;
  const timelessJewels = (data.timelessJewels ?? []) as UniqueSuggestion[];
  const uniqueSuggestions = (data.uniqueSuggestions ?? []) as UniqueSuggestion[];

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [ladderJewelExpanded, setLadderJewelExpanded] = useState(true);

  const hasLadderJewelData = timelessJewels.length > 0 || uniqueSuggestions.length > 0
    || (clusterMenu?.ladderNotables?.length ?? 0) > 0
    || (clusterMenu?.ladderClusterUsage?.length ?? 0) > 0
    || watchersEyeMenu?.modsPerAura?.some(a => a.mods?.some(m => m.ladderUsage != null));

  // Count how many jewel type sections we have (timeless/unique shown in ladder meta, not separate)
  const sectionCount = [
    regularJewelMenu,
    abyssJewelMenu,
    clusterMenu,
    watchersEyeMenu,
  ].filter(Boolean).length;

  if (sectionCount === 0) {
    return <DefaultResult data={data} />;
  }

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalAllocated = Number(socketSummary.totalAllocated ?? 0);
  const equipped = Number(socketSummary.equipped ?? 0);
  const empty = Number(socketSummary.empty ?? 0);
  const hasCluster = Boolean(socketSummary.hasCluster);

  return (
    <div className="text-sm px-1 space-y-2">
      <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
        Curated Jewel Menus ({sectionCount} types)
      </div>

      {/* Socket summary bar */}
      {totalAllocated > 0 && (
        <div className="flex items-center gap-2 text-[0.6875rem] text-stone-400 px-2 py-1 rounded bg-slate-900/40 border border-stone-700/15">
          <span className="uppercase tracking-wider text-stone-500 font-semibold text-[0.625rem]">Sockets</span>
          <span className="text-stone-300 font-mono">{totalAllocated}</span>
          <span className="text-stone-600">allocated</span>
          <span className="text-stone-700">&middot;</span>
          <span className="text-emerald-400/70 font-mono">{equipped}</span>
          <span className="text-stone-600">equipped</span>
          <span className="text-stone-700">&middot;</span>
          <span className="text-amber-400/70 font-mono">{empty}</span>
          <span className="text-stone-600">empty</span>
          <span className="text-stone-700">&middot;</span>
          <span className="text-stone-600">Cluster:</span>
          <span className={hasCluster ? 'text-emerald-400/70' : 'text-stone-500'}>{hasCluster ? 'yes' : 'no'}</span>
        </div>
      )}

      {/* Ladder Jewel Meta — consolidated ladder data overview */}
      {hasLadderJewelData && (
        <div className="rounded overflow-hidden">
          <button
            type="button"
            onClick={() => setLadderJewelExpanded(prev => !prev)}
            className="section-embossed-cyan rounded flex items-center gap-2 w-full px-2.5 py-1.5 text-left"
          >
            <BarChart3 className="w-3 h-3 text-cyan-400/70 flex-shrink-0" />
            <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-cyan-400/90">
              Ladder Jewel Meta
            </span>
            <span className="flex-1" />
            <ChevronDown className={cn(
              'w-3 h-3 text-cyan-500/50 transition-transform duration-200 flex-shrink-0',
              ladderJewelExpanded && 'rotate-180',
            )} />
          </button>

          <AnimatePresence>
            {ladderJewelExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="card-forge rounded-b rounded-t-none px-2.5 pb-2 pt-1.5 space-y-2">
                  {/* Unique Jewels */}
                  {uniqueSuggestions.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium">
                        Unique Jewels
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {uniqueSuggestions.map((j, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-yellow-950/20 border border-yellow-500/15"
                            style={{ minWidth: '180px', maxWidth: '220px' }}
                          >
                            {j.iconUrl && (
                              <div className="w-[22px] h-[22px] rounded bg-yellow-950/40 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                <img
                                  src={j.iconUrl}
                                  alt=""
                                  className="w-[22px] h-[22px] object-contain"
                                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[0.625rem] text-yellow-300/80 font-medium truncate">
                                  {j.name}
                                  {j.variant && (
                                    <span className="text-yellow-400/50"> ({j.variant})</span>
                                  )}
                                </span>
                              </div>
                              {j.baseType && (
                                <div className="text-[0.5rem] text-yellow-500/30 leading-tight truncate">{j.baseType}</div>
                              )}
                            </div>
                            <span className="text-[0.5625rem] text-yellow-400/60 font-mono flex-shrink-0">{j.usage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeless Jewels */}
                  {timelessJewels.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium">
                        Timeless Jewels
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {timelessJewels.map((j, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-violet-950/20 border border-violet-500/15"
                            style={{ minWidth: '180px', maxWidth: '220px' }}
                          >
                            {j.iconUrl && (
                              <div className="w-[22px] h-[22px] rounded bg-violet-950/40 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                <img
                                  src={j.iconUrl}
                                  alt=""
                                  className="w-[22px] h-[22px] object-contain"
                                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[0.625rem] text-violet-300/80 font-medium truncate">
                                  {j.name}
                                  {j.variant && (
                                    <span className="text-violet-400/50"> ({j.variant})</span>
                                  )}
                                </span>
                              </div>
                              {j.baseType && (
                                <div className="text-[0.5rem] text-violet-500/30 leading-tight truncate">{j.baseType}</div>
                              )}
                            </div>
                            <span className="text-[0.5625rem] text-violet-400/60 font-mono flex-shrink-0">{j.usage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cluster Jewel Usage — structured by size, or flat notable fallback */}
                  {(clusterMenu?.ladderClusterUsage?.length ?? 0) > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium">
                        Cluster Usage
                      </div>
                      {(['Large', 'Medium', 'Small'] as const).map(size => {
                        const entries = clusterMenu!.ladderClusterUsage!.filter(e => e.size === size);
                        if (entries.length === 0) return null;
                        return (
                          <div key={size} className="space-y-1">
                            <div className="text-[0.625rem] font-semibold text-amber-400/70 uppercase tracking-wider">
                              {size}
                            </div>
                            {entries.map((entry, i) => (
                              <div key={i} className="rounded bg-slate-900/40 border border-stone-700/15 px-2 py-1.5 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[0.6875rem] text-stone-200 font-medium truncate">{entry.enchantment}</span>
                                  <span className="text-[0.5625rem] text-stone-500 font-mono flex-shrink-0">{Math.round(entry.usage)}%</span>
                                </div>
                                {entry.topNotables.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {entry.topNotables.map((n, j) => (
                                      <span
                                        key={j}
                                        className="text-[0.625rem] px-1.5 py-0.5 rounded bg-teal-950/25 text-teal-400/70 border border-teal-500/15"
                                      >
                                        {n.name} <span className="text-teal-500/50">{Math.min(Math.round(n.usage), 100)}%</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : (clusterMenu?.ladderNotables?.length ?? 0) > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium">
                        Cluster Notables
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {clusterMenu!.ladderNotables.map((n, i) => (
                          <span
                            key={i}
                            className="text-[0.625rem] px-1.5 py-0.5 rounded bg-cyan-900/15 text-cyan-400/70 border border-cyan-500/15"
                          >
                            {n.name} {n.usage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Watcher's Eye Top Mods */}
                  {(() => {
                    const topWatcherMods = (watchersEyeMenu?.modsPerAura ?? [])
                      .flatMap(a => a.mods
                        .filter(m => m.ladderUsage != null)
                        .map(m => ({ aura: a.aura, text: m.text, usage: m.ladderUsage! }))
                      )
                      .sort((a, b) => b.usage - a.usage)
                      .slice(0, 5);

                    if (topWatcherMods.length === 0) return null;

                    return (
                      <div className="space-y-1">
                        <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium">
                          Watcher&apos;s Eye
                        </div>
                        <div className="space-y-px">
                          {topWatcherMods.map((m, i) => (
                            <div key={i} className="flex items-baseline gap-1.5 text-[0.625rem] px-1 py-0.5">
                              <span className="text-cyan-500/60 font-medium flex-shrink-0">{m.aura}:</span>
                              <span className="text-stone-400 truncate">{m.text}</span>
                              <span className="flex-shrink-0 ml-auto text-stone-500 font-mono tabular-nums">{m.usage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="space-y-1">
        {/* Regular Jewel Menu */}
        {regularJewelMenu && (
          <JewelMenuSection
            sectionKey="regular"
            label="Regular Jewel"
            baseName={regularJewelMenu.recommendedBase}
            prefixes={regularJewelMenu.prefixes}
            suffixes={regularJewelMenu.suffixes}
            isExpanded={expandedSections.has('regular')}
            onToggle={() => toggleSection('regular')}
          />
        )}

        {/* Abyss Jewel Menu */}
        {abyssJewelMenu && (
          <JewelMenuSection
            sectionKey="abyss"
            label="Abyss Jewel"
            baseName={abyssJewelMenu.recommendedBase}
            prefixes={abyssJewelMenu.prefixes}
            suffixes={abyssJewelMenu.suffixes}
            isExpanded={expandedSections.has('abyss')}
            onToggle={() => toggleSection('abyss')}
          />
        )}

        {/* Cluster Jewels */}
        {clusterMenu && (
          <ClusterJewelSection
            clusterMenu={clusterMenu}
            isExpanded={expandedSections.has('cluster')}
            onToggle={() => toggleSection('cluster')}
          />
        )}

        {/* Watcher's Eye */}
        {watchersEyeMenu && (
          <WatchersEyeSection
            menu={watchersEyeMenu}
            isExpanded={expandedSections.has('watchers')}
            onToggle={() => toggleSection('watchers')}
          />
        )}

        {/* Timeless & Unique Jewels shown in Ladder Jewel Meta section above */}
      </div>

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/** Collapsible section for Regular / Abyss jewel menus (prefix+suffix mods) */
function JewelMenuSection({ sectionKey: _sectionKey, label, baseName, prefixes, suffixes, isExpanded, onToggle }: {
  sectionKey: string;
  label: string;
  baseName: string;
  prefixes: JewelCuratedMod[];
  suffixes: JewelCuratedMod[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ladderCount = [...prefixes, ...suffixes].filter(m => m.ladderUsage != null).length;

  return (
    <div className="rounded bg-slate-900/30 border border-stone-700/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown className={cn(
          'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
          isExpanded && 'rotate-180',
        )} />
        <span className="text-xs text-stone-200 font-medium flex-shrink-0">{label}</span>
        {baseName !== label && baseName !== 'Regular Jewel' && (
          <span className="text-[0.6875rem] text-stone-500 truncate">{baseName}</span>
        )}
        <span className="flex-1" />
        {prefixes.length > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-emerald-900/25 text-emerald-400/80 font-mono tabular-nums">
            {prefixes.length}P
          </span>
        )}
        {suffixes.length > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-violet-900/25 text-violet-400/80 font-mono tabular-nums">
            {suffixes.length}S
          </span>
        )}
        {ladderCount > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-sky-900/25 text-sky-400/70 font-mono tabular-nums">
            {ladderCount} ladder
          </span>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-stone-700/20">
              <JewelModGroup label="Prefixes" mods={prefixes} headerColor="text-emerald-400/80" />
              <JewelModGroup label="Suffixes" mods={suffixes} headerColor="text-violet-400/80" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Render a group of jewel mods with section header — mirrors ModGroup for gear */
function JewelModGroup({ label, mods, headerColor }: {
  label: string;
  mods: JewelCuratedMod[];
  headerColor: string;
}) {
  if (mods.length === 0) return null;

  return (
    <div className="space-y-0.5">
      <div className={cn('text-[0.625rem] uppercase tracking-wider font-semibold', headerColor)}>
        {label} ({mods.length})
      </div>
      <div className="space-y-px">
        {mods.map((mod, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30 text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <span className={cn(
                'text-[0.5625rem] font-bold uppercase flex-shrink-0 w-3',
                mod.generationType === 'prefix' ? 'text-emerald-400/70' : 'text-violet-400/70',
              )}>
                {mod.generationType === 'prefix' ? 'P' : 'S'}
              </span>
              <span className="text-blue-400 truncate">{mod.displayText || mod.stat || mod.statId}</span>
              {mod.tag && (
                <span className="text-[0.5rem] px-1 py-px rounded bg-amber-900/25 text-amber-400/70 font-medium flex-shrink-0">
                  {mod.tag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {mod.ladderUsage != null && (
                <span className="text-[0.5625rem] text-sky-400/60 font-mono">
                  {Math.round(mod.ladderUsage)}%
                </span>
              )}
              {mod.topTier?.tier != null && (
                <span className={cn(
                  'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                  tierBadgeColor(mod.topTier.tier),
                )}>
                  T{mod.topTier.tier}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Collapsible section for Cluster Jewels */
function ClusterJewelSection({ clusterMenu, isExpanded, onToggle }: {
  clusterMenu: ClusterMenu;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const totalNotables = [
    ...clusterMenu.largeBases.flatMap(b => b.topNotables),
    ...clusterMenu.mediumBases.flatMap(b => b.topNotables),
  ].length;
  const largeNames = clusterMenu.largeBases.map(b => b.enchantName).join(' + ');
  const mediumNames = clusterMenu.mediumBases.map(b => b.enchantName).join(' + ');
  const summaryText = [largeNames, mediumNames].filter(Boolean).join(', ');

  return (
    <div className="rounded bg-slate-900/30 border border-stone-700/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown className={cn(
          'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
          isExpanded && 'rotate-180',
        )} />
        <span className="text-xs text-stone-200 font-medium flex-shrink-0">Cluster Jewels</span>
        <span className="text-[0.6875rem] text-stone-500 truncate">{summaryText}</span>
        <span className="flex-1" />
        {totalNotables > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-teal-900/25 text-teal-400/80 font-mono tabular-nums">
            {totalNotables} notables
          </span>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-stone-700/20">
              {/* Ladder Usage shown in Ladder Jewel Meta section above */}

              {/* Large Bases */}
              {clusterMenu.largeBases.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-amber-400/70">
                    Large Clusters ({clusterMenu.largeBases.length})
                  </div>
                  {clusterMenu.largeBases.map((base, i) => (
                    <ClusterBaseCard key={i} base={base} />
                  ))}
                </div>
              )}

              {/* Medium Bases */}
              {clusterMenu.mediumBases.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-amber-400/70">
                    Medium Clusters ({clusterMenu.mediumBases.length})
                  </div>
                  {clusterMenu.mediumBases.map((base, i) => (
                    <ClusterBaseCard key={i} base={base} />
                  ))}
                </div>
              )}

              {/* Ladder Notables */}
              {clusterMenu.ladderNotables.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-sky-400/70">
                    Ladder Notables
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {clusterMenu.ladderNotables.map((n, i) => (
                      <span key={i} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-sky-950/20 text-sky-300/80 border border-sky-800/20">
                        {n.name} <span className="text-sky-500/60">{Math.round(n.usage)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Card for a single cluster jewel base showing enchantment, small passives, and notables */
function ClusterBaseCard({ base }: { base: ClusterBase }) {
  return (
    <div className="rounded bg-slate-900/40 border border-stone-700/15 overflow-hidden">
      {/* Enchantment header with small passive stats */}
      <div className="px-2 py-1.5 border-b border-stone-700/15">
        <div className="text-[0.6875rem] text-stone-200 font-medium">{base.enchantName}</div>
        {base.smallPassiveStats && base.smallPassiveStats.length > 0 && (
          <div className="mt-0.5 space-y-px">
            {base.smallPassiveStats.map((stat, i) => (
              <div key={i} className="text-[0.625rem] text-blue-400/70">{stat}</div>
            ))}
          </div>
        )}
      </div>
      {/* Notables as structured list */}
      <div className="px-2 py-1.5 space-y-1">
        <div className="text-[0.5625rem] uppercase tracking-wider font-semibold text-teal-400/60">
          Notables ({base.topNotables.length})
        </div>
        <div className="space-y-px">
          {base.topNotables.map((n, j) => (
            <div key={j} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30 text-xs">
              <span className="text-[0.6875rem] text-teal-300 font-medium truncate">{n.name}</span>
              {n.ladderUsage != null && (
                <span className="text-[0.5625rem] text-sky-400/60 font-mono flex-shrink-0">
                  {Math.round(n.ladderUsage)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Collapsible section for Watcher's Eye mods grouped by aura */
function WatchersEyeSection({ menu, isExpanded, onToggle }: {
  menu: WatchersEyeMenu;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const totalMods = menu.modsPerAura.reduce((sum, a) => sum + a.mods.length, 0);
  const auraSummary = menu.activeAuras.join(' + ');

  return (
    <div className="rounded bg-slate-900/30 border border-stone-700/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown className={cn(
          'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
          isExpanded && 'rotate-180',
        )} />
        <span className="text-xs text-stone-200 font-medium flex-shrink-0">{"Watcher's Eye"}</span>
        <span className="text-[0.6875rem] text-stone-500 truncate">{auraSummary}</span>
        <span className="flex-1" />
        {totalMods > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-purple-900/25 text-purple-400/80 font-mono tabular-nums">
            {totalMods} mods
          </span>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-stone-700/20">
              {menu.modsPerAura.map((auraGroup, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-purple-400/80">
                    {auraGroup.aura} ({auraGroup.mods.length})
                  </div>
                  <div className="space-y-px">
                    {auraGroup.mods.map((mod, j) => (
                      <div key={j} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30 text-xs">
                        <span className="text-stone-300 truncate">{mod.text}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {mod.category && (
                            <span className={cn(
                              'text-[0.5625rem] px-1 py-px rounded border font-medium',
                              CATEGORY_BADGE_CLASSES[mod.category] ?? CATEGORY_BADGE_CLASSES.utility,
                            )}>
                              {mod.category}
                            </span>
                          )}
                          {mod.ladderUsage != null && (
                            <span className="text-[0.5625rem] text-sky-400/60 font-mono">
                              {Math.round(mod.ladderUsage)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AssessProgressionResult({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  const tier = String(data.tier ?? 'unknown');
  const tierLabel = typeof data.tierLabel === 'string' ? data.tierLabel : tier;
  const baseDps = Number(data.baseDPS ?? 0);
  const baseEhp = Number(data.baseEHP ?? 0);
  const modTierRange = data.modTierRange as { min?: number; max?: number } | undefined;
  const targetTier = typeof data.targetTier === 'number' ? data.targetTier : undefined;
  const averageModTier = typeof data.averageModTier === 'number' ? data.averageModTier : undefined;
  const modCount = typeof data.modCount === 'number' ? data.modCount : undefined;
  const characterLevel = typeof data.characterLevel === 'number' ? data.characterLevel : undefined;

  /** Tier badge color */
  const tierStyle = (t: string): string => {
    switch (t) {
      case 'league-start':
        return 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30';
      case 'mid-game':
        return 'bg-amber-900/40 text-amber-300 border-amber-500/30';
      case 'endgame':
        return 'bg-purple-900/40 text-purple-300 border-purple-500/30';
      default:
        return 'bg-slate-800/60 text-stone-300 border-stone-600/30';
    }
  };

  const isGearBased = averageModTier != null;

  return (
    <div className="text-sm px-1 space-y-2">
      <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
        Progression Assessment
      </div>

      {/* Collapsed summary — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-3 py-1.5 px-2.5 rounded bg-slate-900/40 w-full text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Tier badge */}
        <span className={cn(
          'text-xs px-2 py-0.5 rounded border font-semibold uppercase tracking-wide',
          tierStyle(tier),
        )}>
          {tierLabel}
        </span>

        {/* Target tier */}
        <span className="text-xs font-mono text-stone-400">
          Target T{targetTier ?? modTierRange?.min ?? '?'}
        </span>

        {/* Separator */}
        <span className="text-stone-700">|</span>

        {/* DPS */}
        <span className="text-xs font-mono text-amber-300 font-medium">
          {formatDps(baseDps)} DPS
        </span>

        {/* EHP */}
        <span className="text-xs font-mono text-blue-300 font-medium">
          {formatDps(baseEhp)} EHP
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Expand chevron */}
        <ChevronDown className={cn(
          'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
          expanded && 'rotate-180',
        )} />
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 space-y-1 rounded bg-slate-900/20 border border-stone-700/15 text-xs text-stone-400">
              {isGearBased ? (
                <>
                  <div>
                    <span className="text-stone-500">Method:</span>{' '}
                    <span className="text-stone-300">Gear-based</span>
                    {modCount != null && (
                      <span className="text-stone-500"> ({modCount} mods analyzed)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-stone-500">Avg Equipped:</span>{' '}
                    <span className="font-mono text-stone-300">T{averageModTier.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Target:</span>{' '}
                    <span className="font-mono text-stone-300">T{targetTier ?? '?'}</span>
                    <span className="text-stone-600 ml-1">
                      (round({averageModTier.toFixed(1)}) - 2 = {targetTier ?? '?'})
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-stone-500">Method:</span>{' '}
                    <span className="text-stone-300">Level-based estimate</span>
                  </div>
                  {characterLevel != null && (
                    <div>
                      <span className="text-stone-500">Character Level:</span>{' '}
                      <span className="font-mono text-stone-300">{characterLevel}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-stone-500">Target:</span>{' '}
                    <span className="font-mono text-stone-300">T{targetTier ?? '?'}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}


function PreflightMarkdownResult({ data }: { data: Record<string, unknown> }) {
  const markdown = typeof data.markdown === 'string' ? data.markdown.trim() : '';
  if (!markdown) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-xs px-1">
      <pre className="text-stone-300 bg-slate-900/50 rounded p-2 whitespace-pre-wrap max-h-72 overflow-auto">
        {markdown}
      </pre>
    </div>
  );
}

/**
 * GetSlotModsResult - Custom renderer for get_slot_mods tool
 *
 * Shows available prefixes and suffixes for gear slots with tier badges
 * and stat ranges in a compact, scannable layout.
 */
function GetSlotModsResult({ data }: { data: Record<string, unknown> }) {
  const MAX_MODS_SHOWN = 8;

  // The backend returns modMenuText as a plain string (not JSON), which the SSE
  // asRecord() wrapper stores as { value: "..." }. Detect and render as formatted text.
  const modMenuText = (data.modMenuText as string | undefined)
    ?? (typeof data.value === 'string' ? data.value : undefined);

  if (modMenuText) {
    return (
      <div className="text-sm px-1 space-y-2">
        <div className="rounded border border-amber-500/20 bg-amber-950/10 px-3 py-2">
          <div className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80 mb-1.5">
            Mod Menu
          </div>
          <pre className="text-xs font-mono text-stone-300 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-80 overflow-y-auto">
            {modMenuText}
          </pre>
        </div>
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  const slots = (data.slots ?? []) as Array<{
    slot?: string;
    baseName?: string | null;
    itemClass?: string;
    prefixes?: Array<{ group?: string; stat?: string; bestTier?: number; range?: string; requiredLevel?: number }>;
    suffixes?: Array<{ group?: string; stat?: string; bestTier?: number; range?: string; requiredLevel?: number }>;
  }>;

  if (slots.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Tier badge color: T1 amber, T2-T3 slate tones, T4+ dim */
  const tierBadgeClass = (tier: number): string => {
    if (tier === 1) return 'bg-amber-900/30 text-amber-300 border-amber-500/30';
    if (tier <= 3) return 'bg-slate-800/60 text-stone-300 border-stone-600/30';
    return 'bg-slate-800/40 text-stone-500 border-stone-700/30';
  };

  const renderModList = (
    mods: Array<{ group?: string; stat?: string; bestTier?: number; range?: string; requiredLevel?: number }>,
    accentColor: string,
    label: string
  ) => {
    if (mods.length === 0) return null;
    const visible = mods.slice(0, MAX_MODS_SHOWN);
    const remaining = mods.length - MAX_MODS_SHOWN;

    return (
      <div className="space-y-1">
        <div className={cn('text-xs uppercase tracking-wide font-medium', accentColor)}>
          {label} ({mods.length})
        </div>
        <div className="space-y-0.5">
          {visible.map((mod, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-stone-300 flex-1 truncate">
                {mod.stat ?? mod.group ?? 'Unknown'}
              </span>
              {mod.bestTier != null && (
                <span
                  className={cn(
                    'text-[0.625rem] px-1 py-0.5 rounded border flex-shrink-0',
                    tierBadgeClass(mod.bestTier)
                  )}
                >
                  T{mod.bestTier}
                </span>
              )}
              {mod.range && (
                <span className="text-stone-400 flex-shrink-0">
                  {mod.range}
                </span>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <div className="text-[0.6875rem] text-stone-500 italic">
              (+{remaining} more)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="text-sm px-1 space-y-3">
      {slots.map((slot, si) => (
        <div key={si} className="space-y-2">
          {/* Slot header */}
          <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
            {slot.slot ?? 'Unknown Slot'}
            {slot.baseName && (
              <span className="text-stone-400 normal-case tracking-normal font-normal ml-1.5">
                ({slot.baseName})
              </span>
            )}
          </div>

          {/* Prefixes + Suffixes */}
          <div className="grid grid-cols-2 gap-3">
            {renderModList(slot.prefixes ?? [], 'text-amber-400/80', 'Prefixes')}
            {renderModList(slot.suffixes ?? [], 'text-blue-400/80', 'Suffixes')}
          </div>

          {/* Separator between slots (not after the last one) */}
          {si < slots.length - 1 && (
            <div className="border-t border-stone-700/50" />
          )}
        </div>
      ))}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Search & Validate Result Types
// =============================================================================

interface ValidatedItem {
  name: string;
  baseType: string;
  price: { amount: number; currency: string };
  dps: { before: number; after: number; pct: string };
  ehp: { before: number; after: number; pct: string };
  verdict: 'UPGRADE' | 'SIDEGRADE' | 'DOWNGRADE';
  keyMods: string[];
}

interface SearchEntry {
  label: string;
  slot: string;
  tradeUrl: string;
  totalResults: number;
  validatedItems: ValidatedItem[];
  error?: string;
}

interface SearchAndValidateData {
  baseline: { dps: number; ehp: number; life: number };
  searches: SearchEntry[];
}

/** Abbreviate currency for compact display */
const formatPrice = (amount: number, currency: string): string => {
  if (currency === 'divine' || currency === 'div') return `${amount}div`;
  return `${Math.round(amount)}c`;
};

/**
 * SearchAndValidateResult - Custom renderer for search_and_validate tool
 *
 * Shows baseline stats and per-search sections with validated items,
 * verdict-colored borders, DPS/EHP deltas, prices, and key mods.
 */
function SearchAndValidateResult({ data }: { data: Record<string, unknown> }) {
  const typed = data as unknown as SearchAndValidateData;

  // Guard: fall back if data shape is unexpected
  if (!typed.baseline || !Array.isArray(typed.searches)) {
    return <DefaultResult data={data} />;
  }

  const { baseline, searches } = typed;

  /** Parse a pct string like "+5.2%" or "-3.1%" to a numeric value */
  const parsePct = (pct: string | undefined): number => {
    if (!pct) return 0;
    const cleaned = pct.replace(/[^-+.\d]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  /** Color class for a delta value */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Verdict badge styling */
  const verdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'UPGRADE':
        return 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30';
      case 'SIDEGRADE':
        return 'bg-amber-900/30 text-amber-300 border-amber-500/30';
      case 'DOWNGRADE':
        return 'bg-red-900/30 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-800/60 text-stone-400 border-stone-600/30';
    }
  };

  /** Border color for verdict */
  const verdictBorder = (verdict: string) => {
    switch (verdict) {
      case 'UPGRADE':
        return 'border-emerald-500/60';
      case 'SIDEGRADE':
        return 'border-amber-500/60';
      case 'DOWNGRADE':
        return 'border-red-500/60';
      default:
        return 'border-stone-500/40';
    }
  };

  /** Sort items: UPGRADE first, then SIDEGRADE, then DOWNGRADE */
  const sortItems = (items: ValidatedItem[]): ValidatedItem[] => {
    const priority: Record<string, number> = { UPGRADE: 0, SIDEGRADE: 1, DOWNGRADE: 2 };
    return [...items].sort(
      (a, b) => (priority[a.verdict] ?? 3) - (priority[b.verdict] ?? 3)
    );
  };

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Per-search sections */}
      {searches.map((search, si) => (
        <div key={si} className="space-y-1.5">
          {/* Search header */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium flex-1">
              {search.label}
              <span className="ml-1.5 text-stone-500 normal-case tracking-normal font-normal">
                {search.totalResults} result{search.totalResults !== 1 ? 's' : ''}
              </span>
            </div>
            {search.tradeUrl && (
              <button
                className="flex items-center gap-1 text-[0.6875rem] text-teal-400 hover:text-teal-300 transition-colors flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); openExternal(search.tradeUrl); }}
              >
                <ExternalLink className="w-3 h-3" />
                View on Trade
              </button>
            )}
          </div>

          {/* Error state */}
          {search.error ? (
            <div className="flex items-center gap-1.5 py-1.5 px-2 rounded bg-red-950/30 border border-red-500/20 text-xs text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {search.error}
            </div>
          ) : (
            /* Validated items */
            <div className="space-y-1.5">
              {sortItems(search.validatedItems).map((item, ii) => {
                const dpsPct = parsePct(item.dps.pct);
                const ehpPct = parsePct(item.ehp.pct);

                return (
                  <div
                    key={ii}
                    className={cn(
                      'py-1.5 px-2 rounded bg-slate-900/40 border-l-2',
                      verdictBorder(item.verdict)
                    )}
                  >
                    {/* Row 1: Name + base type | price + verdict */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-stone-200 text-xs font-medium">
                          {item.name}
                        </span>
                        <span className="text-stone-500 text-xs ml-1.5">
                          {item.baseType}
                        </span>
                      </div>
                      <span className="text-amber-300 text-xs font-mono flex-shrink-0">
                        {formatPrice(item.price.amount, item.price.currency)}
                      </span>
                    </div>

                    {/* Row 2: DPS + EHP deltas */}
                    <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                      <span
                        className={cn(
                          'flex items-center gap-0.5',
                          deltaColor(dpsPct)
                        )}
                      >
                        {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                        {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                        {item.dps.pct} DPS
                        {item.dps.before !== item.dps.after && (
                          <span className="text-stone-500 text-[0.625rem] ml-0.5">
                            ({formatCompactNumber(item.dps.before)}{'\u2192'}{formatCompactNumber(item.dps.after)})
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-0.5',
                          deltaColor(ehpPct)
                        )}
                      >
                        {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                        {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                        {item.ehp.pct} EHP
                        {item.ehp.before !== item.ehp.after && (
                          <span className="text-stone-500 text-[0.625rem] ml-0.5">
                            ({formatCompactNumber(item.ehp.before)}{'\u2192'}{formatCompactNumber(item.ehp.after)})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Row 3: Key mods as tags */}
                    {item.keyMods.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.keyMods.map((mod, mi) => (
                          <span
                            key={mi}
                            className="text-[0.625rem] px-1 py-0.5 rounded bg-slate-800/60 text-stone-400 border border-stone-600/30"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Separator between searches (not after the last one) */}
          {si < searches.length - 1 && (
            <div className="border-t border-stone-700/50" />
          )}
        </div>
      ))}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Tree Optimization Tool Renderers
// =============================================================================

/** Tooltip state for tree tool card portal tooltips */
interface TreeToolTooltipState {
  x: number;
  y: number;
  name: string;
  stats: string[];
  headerColor: string;
}


/**
 * Renders a tree node sprite icon in a styled container with type-specific
 * border colors and glow effects. Matches the TreeVizTab sidebar style.
 */
function TreeNodeBadge({
  name,
  nodeType,
  nodeIconMap,
  spriteConfig,
  zoomLevel,
  size = 24,
}: {
  name: string;
  nodeType?: string;
  nodeIconMap: Map<string, { iconPath: string; spriteCategory: string }>;
  spriteConfig: ReturnType<typeof useSidebarSpriteData>['spriteConfig'];
  zoomLevel: string;
  size?: number;
}) {
  const iconInfo = nodeIconMap.get(name);
  const isKeystone = nodeType === 'keystone';
  const isMastery = nodeType === 'mastery';
  const isAscendancy = nodeType === 'ascendancy';

  const borderClass = isMastery
    ? 'border-violet-500/30 group-hover:border-violet-400/55'
    : 'border-amber-500/30 group-hover:border-amber-400/55';
  const glowClass = isMastery
    ? 'shadow-[0_0_6px_rgba(167,139,250,0.1)] group-hover:shadow-[0_0_12px_rgba(167,139,250,0.25)]'
    : 'shadow-[0_0_6px_rgba(251,191,36,0.1)] group-hover:shadow-[0_0_12px_rgba(251,191,36,0.25)]';

  const FallbackIcon = isAscendancy ? Star : isKeystone ? Key : isMastery ? CircleDot : Sparkles;
  const fallbackColor = isMastery ? 'text-violet-400/50' : 'text-amber-400/50';

  return (
    <div className="flex-shrink-0">
      <div className={cn(
        isKeystone ? 'rounded-md' : 'rounded-full',
        'overflow-hidden border',
        borderClass,
        'bg-gradient-to-br from-slate-900 to-slate-950',
        glowClass,
        'transition-all duration-300',
        'flex items-center justify-center',
      )} style={{ width: size + 4, height: size + 4 }}>
        {iconInfo && spriteConfig ? (
          <TreeNodeIcon
            iconPath={iconInfo.iconPath}
            spriteCategory={iconInfo.spriteCategory}
            spriteConfig={spriteConfig}
            zoomLevel={zoomLevel}
            size={size}
          />
        ) : (
          <FallbackIcon className={cn('w-3 h-3', fallbackColor)} />
        )}
      </div>
    </div>
  );
}

/** Portal-rendered tooltip for tree node stat previews */
function TreeToolTooltip({ tooltip }: { tooltip: TreeToolTooltipState | null }) {
  if (!tooltip || tooltip.stats.length === 0) return null;
  return createPortal(
    <div style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999 }} className="pointer-events-none">
      <div className="card-forge card-forge-opaque rounded-lg p-3 w-72 text-sm shadow-xl shadow-black/60">
        <div className={cn('font-display font-medium mb-1.5 border-b border-slate-700/40 pb-1.5', tooltip.headerColor)}>
          {tooltip.name}
        </div>
        {tooltip.stats.map((stat, i) => (
          <div key={i} className="text-slate-400 text-xs leading-relaxed">{stat}</div>
        ))}
      </div>
    </div>,
    document.body
  );
}

/**
 * DiscoverTreeNodesResult - Custom renderer for discover_tree_nodes tool
 *
 * Shows point budget, available notables and keystones with point cost badges,
 * and jewel socket summary.
 */
function DiscoverTreeNodesResult({ data }: { data: Record<string, unknown> }) {
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap, nodeMasteryMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (stats && stats.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
      return;
    }
    // Fallback for mastery nodes: show all available effects
    const effects = nodeMasteryMap.get(name);
    if (effects && effects.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const allStats = effects.flatMap(eff => eff.stats);
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats: allStats, headerColor });
    }
  };
  const hideTooltip = () => setTooltip(null);

  const pointBudget = data.pointBudget as {
    allocated?: number;
    remaining?: number;
    total?: number;
    warning?: string;
  } | undefined;

  const notables = (data.notables ?? []) as Array<{
    id?: number;
    name?: string;
    stats?: string[];
    pointCost?: number;
    ladderUsage?: number;
    wheelStats?: string;
    highwayNodes?: number;
    respecSuggestion?: {
      freeNodeIds: number[];
      freedPoints: number;
      names: string[];
    };
    affordable?: boolean;
  }>;

  const keystones = (data.keystones ?? []) as Array<{
    id?: number;
    name?: string;
    stats?: string[];
    pointCost?: number;
    ladderUsage?: number;
  }>;

  const masteryAlternatives = (data.masteryAlternatives ?? []) as Array<{
    nodeId?: number;
    name?: string;
    currentStats?: string;
    alternatives?: Array<{ effectId?: number; stats?: string }>;
  }>;

  const jewelSockets = data.jewelSockets as {
    allocated?: Array<{ nodeId?: number; slotName?: string; equippedJewel?: { name?: string } | null }>;
    empty?: Array<{ nodeId?: number; slotName?: string }>;
  } | undefined;

  const summary = data.summary as string | undefined;

  const ladderInsights = data.ladderInsights as {
    buildCount: number;
    allocatedPopular: Array<{ name: string; usage: number }>;
    missingPopular: Array<{ name: string; usage: number }>;
    keystones: Array<{ name: string; usage: number; allocated: boolean }>;
    ascendancyNodes: Array<{ name: string; usage: number }>;
    masteries: Array<{ group: string; effect: string; usage: number }>;
    benchmarks: { dps: number; ehp: number; life: number };
    bloodlines?: Array<{ name: string; usage: number }>;
    ladderClusters?: Array<{
      notables: Array<{ name: string; usage: number; individualCost: number; incrementalCost?: number; allocated: boolean }>;
      totalCost: number;
      sumIndividualCosts: number;
      savings: number;
      entryNode: string;
      avgCoOccurrence: number;
    }>;
  } | undefined;

  const farClusters = (data.farClusters ?? []) as Array<{
    notables: Array<{ name: string; usage: number; individualCost: number; incrementalCost?: number; allocated: boolean }>;
    totalCost: number;
    sumIndividualCosts: number;
    savings: number;
    entryNode: string;
    avgCoOccurrence: number;
  }>;

  const [ladderExpanded, setLadderExpanded] = useState(true);

  if (!pointBudget && notables.length === 0 && keystones.length === 0) {
    return <DefaultResult data={data} />;
  }

  const MAX_NOTABLES = 15;
  const MAX_KEYSTONES = 8;

  const remainingPts = pointBudget?.remaining ?? Infinity;

  return (
    <div className="text-sm space-y-2">
      {/* Point budget header */}
      {pointBudget && (
        <div className="px-2 py-1.5">
          <div className="text-xs font-mono text-amber-300">
            {pointBudget.remaining ?? 0} of {pointBudget.total ?? 0} points remaining
          </div>
          {pointBudget.warning && (
            <div className="text-[0.6875rem] text-amber-400/80 italic mt-0.5">
              {pointBudget.warning}
            </div>
          )}
        </div>
      )}

      {/* Ladder Meta section */}
      {ladderInsights && ladderInsights.buildCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
        >
          <div
            className="section-embossed-cyan rounded-t px-2 py-1.5 mb-0 cursor-pointer select-none"
            onClick={() => setLadderExpanded(prev => !prev)}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3 h-3 text-cyan-400" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-cyan-400/90">
                Ladder Meta
              </span>
              <span className="text-[0.625rem] text-slate-600">
                ({ladderInsights.buildCount} builds)
              </span>
              <ChevronDown className={cn(
                'w-3 h-3 text-cyan-500/60 ml-auto transition-transform duration-200',
                !ladderExpanded && '-rotate-90'
              )} />
            </div>
          </div>
          <AnimatePresence>
            {ladderExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="card-forge rounded-b rounded-t-none px-2 py-2 space-y-2.5">

                  {/* Gaps — reachable gaps and cluster packages */}
                  {(ladderInsights.missingPopular.length > 0 || (ladderInsights.ladderClusters && ladderInsights.ladderClusters.length > 0)) && (() => {
                    // Lookup point cost from discovery notables by name
                    const notableCostMap = new Map<string, number>();
                    for (const n of notables) {
                      if (n.name && n.pointCost != null) notableCostMap.set(n.name, n.pointCost);
                    }

                    const sorted = [...ladderInsights.missingPopular].sort((a, b) => b.usage - a.usage);

                    return (<>
                      {/* Reachable Gaps */}
                      {sorted.length > 0 && (
                        <div>
                          <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium mb-1">
                            Gaps
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {sorted.slice(0, 10).map((node, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'flex items-center gap-1.5 px-1 py-0.5 rounded group',
                                  'hover:bg-cyan-500/5 transition-colors duration-150',
                                  nodeStatsMap.has(node.name) ? 'cursor-help' : 'cursor-default'
                                )}
                                onMouseEnter={(e) => showTooltip(e, node.name, 'text-cyan-300')}
                                onMouseLeave={hideTooltip}
                              >
                                <TreeNodeBadge
                                  name={node.name}
                                  nodeType="notable"
                                  nodeIconMap={nodeIconMap}
                                  spriteConfig={spriteConfig}
                                  zoomLevel={zoomLevel}
                                  size={16}
                                />
                                <span className="text-[0.6875rem] text-cyan-300/80 min-w-0 truncate flex-1">
                                  {node.name}
                                </span>
                                <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20">
                                  {node.usage}%
                                </span>
                                {notableCostMap.has(node.name) && (
                                  <span className="text-[0.5625rem] text-emerald-400/70 font-medium flex-shrink-0">
                                    {notableCostMap.get(node.name)}pt
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ladder Clusters — popular far gap notables that are close to each other */}
                      {ladderInsights.ladderClusters && ladderInsights.ladderClusters.length > 0 && (
                        <div>
                          <div className="text-[0.5625rem] uppercase tracking-widest text-amber-500/60 font-medium mb-1">
                            Ladder Notable Clusters <span className="text-stone-600 normal-case">(popular far gaps near each other)</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {ladderInsights.ladderClusters.map((cluster, ci) => (
                              <div
                                key={ci}
                                className="rounded border border-amber-500/20 bg-amber-950/10 px-2 py-1.5"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[0.625rem] font-medium text-amber-300/90">
                                    {cluster.totalCost} pts together
                                  </span>
                                  <span className="text-[0.5625rem] px-1 py-0.5 rounded bg-emerald-900/30 text-emerald-400/80 border border-emerald-500/20">
                                    saves {cluster.savings} pts
                                  </span>
                                  {cluster.avgCoOccurrence > 0 && (
                                    <span className="text-[0.5625rem] text-stone-600 ml-auto">
                                      {cluster.avgCoOccurrence}% co-occur
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  {cluster.notables.filter(n => !n.allocated).map((node, ni) => {
                                    const isEntry = node.name === cluster.entryNode;
                                    return (
                                      <div
                                        key={ni}
                                        className={cn(
                                          'flex items-center gap-1.5 px-1 py-0.5 rounded group',
                                          'hover:bg-amber-500/5 transition-colors duration-150',
                                          nodeStatsMap.has(node.name) ? 'cursor-help' : 'cursor-default'
                                        )}
                                        onMouseEnter={(e) => showTooltip(e, node.name, 'text-amber-300')}
                                        onMouseLeave={hideTooltip}
                                      >
                                        <TreeNodeBadge
                                          name={node.name}
                                          nodeType="notable"
                                          nodeIconMap={nodeIconMap}
                                          spriteConfig={spriteConfig}
                                          zoomLevel={zoomLevel}
                                          size={14}
                                        />
                                        <span className={cn(
                                          'text-[0.625rem] min-w-0 truncate flex-1',
                                          isEntry ? 'text-amber-300 font-medium' : 'text-amber-300/70'
                                        )}>
                                          {node.name}
                                        </span>
                                        {node.usage > 0 && (
                                          <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20">
                                            {node.usage}%
                                          </span>
                                        )}
                                        {node.incrementalCost != null ? (
                                          <span className={cn(
                                            'text-[0.5625rem] flex-shrink-0 font-medium',
                                            isEntry ? 'text-amber-400/80' : 'text-emerald-400/70'
                                          )}>
                                            {isEntry ? `${node.incrementalCost}pt` : `+${node.incrementalCost}pt`}
                                          </span>
                                        ) : (
                                          <span className="text-[0.5625rem] text-stone-500 flex-shrink-0">
                                            {node.individualCost}pt
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </>);
                  })()}

                  {/* Keystones */}
                  {ladderInsights.keystones.length > 0 && (
                    <div>
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium mb-1">
                        Keystones
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        {ladderInsights.keystones.map((ks, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center gap-1.5 px-1 py-0.5 rounded group',
                              'hover:bg-cyan-500/5 transition-colors duration-150',
                              nodeStatsMap.has(ks.name) ? 'cursor-help' : 'cursor-default'
                            )}
                            onMouseEnter={(e) => showTooltip(e, ks.name, 'text-cyan-300')}
                            onMouseLeave={hideTooltip}
                          >
                            <TreeNodeBadge
                              name={ks.name}
                              nodeType="keystone"
                              nodeIconMap={nodeIconMap}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={16}
                            />
                            <span className="text-[0.6875rem] text-cyan-300/80 min-w-0 truncate flex-1">
                              {ks.name}
                            </span>
                            <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20">
                              {ks.usage}%
                            </span>
                            {ks.allocated && (
                              <Check className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ascendancy + Bloodlines */}
                  {(ladderInsights.ascendancyNodes.length > 0 || (ladderInsights.bloodlines && ladderInsights.bloodlines.length > 0)) && (
                    <div>
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium mb-1">
                        Ascendancy{ladderInsights.bloodlines && ladderInsights.bloodlines.length > 0 ? ' & Bloodlines' : ''}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ladderInsights.ascendancyNodes.map((node, i) => (
                          <span
                            key={`asc-${i}`}
                            className={cn(
                              'inline-flex items-center gap-1 text-[0.5625rem] px-1 py-0.5 rounded border font-medium bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20',
                              nodeStatsMap.has(node.name) && 'cursor-help'
                            )}
                            onMouseEnter={(e) => showTooltip(e, node.name, 'text-cyan-300')}
                            onMouseLeave={hideTooltip}
                          >
                            <TreeNodeBadge
                              name={node.name}
                              nodeType="ascendancy"
                              nodeIconMap={nodeIconMap}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={14}
                            />
                            {node.name} {node.usage}%
                          </span>
                        ))}
                        {(ladderInsights.bloodlines ?? []).map((bl, i) => (
                          <span
                            key={`bl-${i}`}
                            className={cn(
                              'inline-flex items-center gap-1 text-[0.5625rem] px-1 py-0.5 rounded border font-medium bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20',
                              nodeStatsMap.has(bl.name) && 'cursor-help'
                            )}
                            onMouseEnter={(e) => showTooltip(e, bl.name, 'text-cyan-300')}
                            onMouseLeave={hideTooltip}
                          >
                            <TreeNodeBadge
                              name={bl.name}
                              nodeType="ascendancy"
                              nodeIconMap={nodeIconMap}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={14}
                            />
                            {bl.name} {bl.usage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Masteries */}
                  {ladderInsights.masteries.length > 0 && (
                    <div>
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium mb-1">
                        Masteries
                      </div>
                      <div className="flex flex-col gap-0">
                        {ladderInsights.masteries.slice(0, 8).map((m, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center gap-1.5 px-1 py-0.5 rounded group',
                              'hover:bg-violet-500/5 transition-colors duration-150',
                              (nodeStatsMap.has(m.group) || nodeMasteryMap.has(m.group)) ? 'cursor-help' : 'cursor-default'
                            )}
                            onMouseEnter={(e) => showTooltip(e, m.group, 'text-violet-300')}
                            onMouseLeave={hideTooltip}
                          >
                            <TreeNodeBadge
                              name={m.group}
                              nodeType="mastery"
                              nodeIconMap={nodeIconMap}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={16}
                            />
                            <span className="text-[0.625rem] text-cyan-500/60 flex-shrink-0">{m.group}:</span>
                            <span className="text-[0.625rem] text-stone-400 min-w-0 truncate flex-1">{m.effect}</span>
                            <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20">
                              {m.usage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Already Allocated (allocatedPopular) */}
                  {ladderInsights.allocatedPopular.length > 0 && (
                    <div>
                      <div className="text-[0.5625rem] uppercase tracking-widest text-cyan-500/60 font-medium mb-1">
                        Already Allocated
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ladderInsights.allocatedPopular.map((node, i) => (
                          <span
                            key={i}
                            className={cn(
                              'inline-flex items-center gap-1 text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-900/10 text-emerald-400/50 border border-emerald-500/10',
                              nodeStatsMap.has(node.name) && 'cursor-help'
                            )}
                            onMouseEnter={(e) => showTooltip(e, node.name, 'text-emerald-300')}
                            onMouseLeave={hideTooltip}
                          >
                            <TreeNodeBadge
                              name={node.name}
                              nodeType="notable"
                              nodeIconMap={nodeIconMap}
                              spriteConfig={spriteConfig}
                              zoomLevel={zoomLevel}
                              size={14}
                            />
                            {node.name} {node.usage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clusters section removed — now rendered inline with gaps above */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Deduplicate: nodes already shown in Ladder Meta don't repeat below */}
      {(() => {
        const ladderShownNames = new Set<string>();
        if (ladderInsights && ladderInsights.buildCount > 0) {
          ladderInsights.missingPopular.forEach(n => ladderShownNames.add(n.name));
          ladderInsights.allocatedPopular.forEach(n => ladderShownNames.add(n.name));
          ladderInsights.keystones.forEach(n => ladderShownNames.add(n.name));
          ladderInsights.ladderClusters?.forEach(c => c.notables.forEach(n => ladderShownNames.add(n.name)));
        }
        const filteredNotables = notables.filter(n => !ladderShownNames.has(n.name ?? ''));
        const filteredKeystones = keystones.filter(n => !ladderShownNames.has(n.name ?? ''));

        return (<>
      {/* Notables section */}
      {filteredNotables.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/90">
                Notables
              </span>
              <span className="text-[0.625rem] text-slate-600">({filteredNotables.length})</span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            <div className="flex flex-col gap-0.5">
              {filteredNotables.slice(0, MAX_NOTABLES).map((node, i) => {
                const cost = node.pointCost ?? 0;
                const nodeName = node.name ?? 'Unknown';
                const previewStat = nodeStatsMap.get(nodeName)?.[0] ?? (Array.isArray(node.stats) ? node.stats[0] : undefined);
                const respec = 'respecSuggestion' in node ? node.respecSuggestion : undefined;
                const ladderPct = node.ladderUsage;

                return (
                  <div key={i}>
                    <div
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md group',
                        'hover:bg-amber-500/5',
                        'transition-all duration-200',
                        nodeStatsMap.has(nodeName) ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, nodeName, 'text-amber-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={nodeName}
                        nodeType={nodeTypeMap.get(nodeName) ?? 'notable'}
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={24}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-amber-300/90 group-hover:text-amber-200 truncate transition-colors">
                          {nodeName}
                        </div>
                        {previewStat && (
                          <div className="text-[0.625rem] text-slate-500 truncate mt-0.5 leading-tight">
                            {previewStat}
                          </div>
                        )}
                        {node.wheelStats && (
                          <div className="text-[0.625rem] text-teal-500/60 truncate mt-0.5 leading-tight">
                            +path: {node.wheelStats}
                          </div>
                        )}
                      </div>
                      {ladderPct !== undefined && (
                        <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20" title="Ladder usage">
                          {ladderPct}%
                        </span>
                      )}
                      {(() => {
                        const badge = getNetPointCostBadge(cost, remainingPts);
                        return (
                          <span className={cn('text-[0.625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0', badge.className)}>
                            {badge.text}
                          </span>
                        );
                      })()}
                    </div>
                    {respec && (
                      <div className="text-[0.6875rem] text-cyan-400/80 ml-10 mb-1 pl-1">
                        <span className="text-cyan-500/60">{'\u21B3'}</span> Respec: {respec.freedPoints} freed by removing {respec.names.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredNotables.length > MAX_NOTABLES && (
                <div className="text-[0.6875rem] text-stone-500 italic px-2 py-1">
                  +{filteredNotables.length - MAX_NOTABLES} more
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Keystones section */}
      {filteredKeystones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <Key className="w-3 h-3 text-amber-400/80" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80">
                Keystones
              </span>
              <span className="text-[0.625rem] text-slate-600">({filteredKeystones.length})</span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            <div className="flex flex-col gap-0.5">
              {filteredKeystones.slice(0, MAX_KEYSTONES).map((node, i) => {
                const cost = node.pointCost ?? 0;
                const nodeName = node.name ?? 'Unknown';
                const previewStat = nodeStatsMap.get(nodeName)?.[0] ?? (Array.isArray(node.stats) ? node.stats[0] : undefined);
                const ladderPct = node.ladderUsage;

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md group',
                      'hover:bg-amber-500/5',
                      'transition-all duration-200',
                      nodeStatsMap.has(nodeName) ? 'cursor-help' : 'cursor-default'
                    )}
                    onMouseEnter={(e) => showTooltip(e, nodeName, 'text-amber-300')}
                    onMouseLeave={hideTooltip}
                  >
                    <TreeNodeBadge
                      name={nodeName}
                      nodeType="keystone"
                      nodeIconMap={nodeIconMap}
                      spriteConfig={spriteConfig}
                      zoomLevel={zoomLevel}
                      size={24}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-amber-300/90 group-hover:text-amber-200 truncate transition-colors">
                        {nodeName}
                      </div>
                      {previewStat && (
                        <div className="text-[0.625rem] text-slate-500 truncate mt-0.5 leading-tight">
                          {previewStat}
                        </div>
                      )}
                    </div>
                    {ladderPct !== undefined && (
                      <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20" title="Ladder usage">
                        {ladderPct}%
                      </span>
                    )}
                    {(() => {
                      const badge = getNetPointCostBadge(cost, remainingPts);
                      return (
                        <span className={cn('text-[0.625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0', badge.className)}>
                          {badge.text}
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Far clusters (proximity-based, when no ladder data) */}
      {farClusters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-teal-400/80" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-teal-400/80">
                Far Notable Clusters
              </span>
              <span className="text-[0.625rem] text-slate-600">(shared travel paths)</span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-2 py-1.5">
            <div className="flex flex-col gap-1.5">
              {farClusters.map((cluster, ci) => (
                <div
                  key={ci}
                  className="rounded border border-teal-500/20 bg-teal-950/10 px-2 py-1.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[0.625rem] font-medium text-teal-300/90">
                      {cluster.totalCost} pts together
                    </span>
                    <span className="text-[0.5625rem] px-1 py-0.5 rounded bg-emerald-900/30 text-emerald-400/80 border border-emerald-500/20">
                      saves {cluster.savings} pts
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {cluster.notables.filter(n => !n.allocated).map((node, ni) => {
                      const isEntry = node.name === cluster.entryNode;
                      return (
                        <div
                          key={ni}
                          className={cn(
                            'flex items-center gap-1.5 px-1 py-0.5 rounded group',
                            'hover:bg-teal-500/5 transition-colors duration-150',
                            nodeStatsMap.has(node.name) ? 'cursor-help' : 'cursor-default'
                          )}
                          onMouseEnter={(e) => showTooltip(e, node.name, 'text-teal-300')}
                          onMouseLeave={hideTooltip}
                        >
                          <TreeNodeBadge
                            name={node.name}
                            nodeType="notable"
                            nodeIconMap={nodeIconMap}
                            spriteConfig={spriteConfig}
                            zoomLevel={zoomLevel}
                            size={14}
                          />
                          <span className={cn(
                            'text-[0.625rem] min-w-0 truncate flex-1',
                            isEntry ? 'text-teal-300 font-medium' : 'text-teal-300/70'
                          )}>
                            {node.name}
                          </span>
                          {node.incrementalCost != null ? (
                            <span className={cn(
                              'text-[0.5625rem] flex-shrink-0 font-medium',
                              isEntry ? 'text-teal-400/80' : 'text-emerald-400/70'
                            )}>
                              {isEntry ? `${node.incrementalCost}pt` : `+${node.incrementalCost}pt`}
                            </span>
                          ) : (
                            <span className="text-[0.5625rem] text-stone-500 flex-shrink-0">
                              {node.individualCost}pt
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
      </>);
      })()}

      {/* Mastery alternatives section */}
      {masteryAlternatives.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <CircleDot className="w-3 h-3 text-violet-400/80" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-violet-400/80">
                Mastery Alternatives
              </span>
              <span className="text-[0.625rem] text-slate-600">
                ({masteryAlternatives.reduce((sum, m) => sum + (m.alternatives?.length ?? 0), 0)})
              </span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            <div className="flex flex-col gap-1.5">
              {masteryAlternatives.map((mastery, mi) => {
                const masteryName = mastery.name ?? 'Unknown Mastery';
                return (
                  <div key={mi} className="px-1">
                    <div
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-md group',
                        'hover:bg-violet-500/5',
                        'transition-colors duration-150',
                        (nodeStatsMap.has(masteryName) || nodeMasteryMap.has(masteryName)) ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, masteryName, 'text-violet-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={masteryName}
                        nodeType="mastery"
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={20}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.625rem] text-violet-400/70 font-medium">
                          {masteryName}
                        </div>
                        {mastery.currentStats && (
                          <div className="text-[0.625rem] text-slate-500 truncate leading-tight">
                            current: {mastery.currentStats}
                          </div>
                        )}
                      </div>
                    </div>
                    {(mastery.alternatives ?? []).length > 0 && (
                      <div className="ml-9 mt-0.5 space-y-0.5">
                        {(mastery.alternatives ?? []).map((alt, ai) => (
                          <div
                            key={ai}
                            className="py-1 px-2 rounded bg-slate-900/40 text-[0.6875rem] text-slate-400 leading-snug"
                          >
                            {alt.stats || 'Unknown stats'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Jewel sockets summary */}
      {jewelSockets && (
        <div className="text-xs text-stone-400 px-2">
          {(jewelSockets.allocated?.length ?? 0)} allocated socket{(jewelSockets.allocated?.length ?? 0) !== 1 ? 's' : ''}
          {(jewelSockets.empty?.length ?? 0) > 0 && (
            <span>, {jewelSockets.empty?.length ?? 0} empty</span>
          )}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2 px-2">
          {stripToolTags(summary)}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

/**
 * SimulateTreeChangesResult - Custom renderer for simulate_tree_changes tool
 *
 * Shows before/after stat comparison for a single tree simulation,
 * including DPS, EHP, Life deltas and significant extras pills.
 */
function SimulateTreeChangesResult({ data }: { data: Record<string, unknown> }) {
  const callNumber = data.callNumber as number | undefined;
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeIdMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (!stats || stats.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
  };
  const hideTooltip = () => setTooltip(null);

  const comparison = data.comparison as Record<string, {
    before?: number;
    after?: number;
    delta?: { value?: number; percent?: number };
  }> | undefined;

  const simulation = data.simulation as {
    nodesAdded?: number[];
    nodesRemoved?: number[];
    pointCost?: number;
  } | undefined;

  const significantExtras = (data.significantExtras ?? []) as Array<{
    label: string;
    value: number;
    percent: number;
    displayMode?: string;
  }>;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;
  const configApplied = typeof data.configApplied === 'string' ? data.configApplied : undefined;
  const summary = data.summary as string | undefined;
  const recommendation = data.recommendation as string | undefined;
  const safety = data.safety as {
    recommendation?: string;
    isBlocked?: boolean;
    warnings?: string[];
  } | undefined;

  if (!comparison) {
    return <DefaultResult data={data} />;
  }

  const dpsDelta = comparison.dps?.delta;
  const ehpDelta = comparison.ehp?.delta;
  const lifeDelta = comparison.life?.delta;

  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  const formatDelta = (delta: { value?: number; percent?: number } | undefined, label: string) => {
    if (!delta) return null;
    const pct = delta.percent ?? 0;
    const val = delta.value ?? 0;
    if (pct === 0 && val === 0) return null;
    return { pct, val, label };
  };

  const deltas = [
    formatDelta(dpsDelta, 'DPS'),
    formatDelta(ehpDelta, 'EHP'),
    formatDelta(lifeDelta, 'Life'),
  ].filter(Boolean) as Array<{ pct: number; val: number; label: string }>;

  const isBlocked = safety?.isBlocked === true;
  const pointCost = simulation?.pointCost ?? 0;

  /** Significant node types worth showing as icons */
  const SIGNIFICANT_TYPES = new Set(['notable', 'keystone', 'mastery', 'ascendancy']);

  const addedSignificant = (simulation?.nodesAdded ?? [])
    .map(id => nodeIdMap.get(id))
    .filter((n): n is { name: string; type: string; stats?: string[] } =>
      n != null && n.name !== '' && SIGNIFICANT_TYPES.has(n.type)
    );

  const removedSignificant = (simulation?.nodesRemoved ?? [])
    .map(id => nodeIdMap.get(id))
    .filter((n): n is { name: string; type: string; stats?: string[] } =>
      n != null && n.name !== '' && SIGNIFICANT_TYPES.has(n.type)
    );

  const hasSwap = removedSignificant.length > 0;
  const hasIconBundle = addedSignificant.length > 0 || removedSignificant.length > 0;

  return (
    <div id={`tree-setup-c${callNumber ?? 0}-1`} data-ref={typeof data.ref === 'string' ? data.ref.toLowerCase() : undefined} className="text-sm space-y-2 transition-[box-shadow] duration-300">
      {/* Point cost + safety header */}
      <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80">
            Simulation
          </span>
          {(() => {
            const badge = getNetPointCostBadge(pointCost);
            return (
              <span className={cn('text-[0.625rem] px-1.5 py-0.5 rounded border font-medium', badge.className)}>
                {badge.text}
              </span>
            );
          })()}
          {configApplied && <ConfigPills configApplied={configApplied} />}
          {isBlocked && (
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded border bg-red-900/30 text-red-300 border-red-500/30 font-medium">
              BLOCKED
            </span>
          )}
          {safety?.recommendation === 'caution' && !isBlocked && (
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded border bg-amber-900/30 text-amber-300 border-amber-500/30 font-medium">
              CAUTION
            </span>
          )}
        </div>
      </div>
      <div className="card-forge rounded-b rounded-t-none px-2 py-2 space-y-2">
        {/* Icon bundle for removed → added nodes */}
        {hasIconBundle && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {removedSignificant.map((node, ni) => (
              <div
                key={`rem-${ni}`}
                className={cn(
                  'relative opacity-60',
                  nodeStatsMap.has(node.name) ? 'cursor-help' : 'cursor-default'
                )}
                onMouseEnter={(e) => showTooltip(e, node.name, 'text-red-300')}
                onMouseLeave={hideTooltip}
              >
                <TreeNodeBadge
                  name={node.name}
                  nodeType={node.type}
                  nodeIconMap={nodeIconMap}
                  spriteConfig={spriteConfig}
                  zoomLevel={zoomLevel}
                  size={22}
                />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">
                  &minus;
                </div>
              </div>
            ))}
            {hasSwap && (
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 mx-0.5 flex-shrink-0" />
            )}
            {addedSignificant.map((node, ni) => (
              <div
                key={`add-${ni}`}
                className={cn(
                  'relative',
                  nodeStatsMap.has(node.name) ? 'cursor-help' : 'cursor-default'
                )}
                onMouseEnter={(e) => showTooltip(e, node.name, 'text-emerald-300')}
                onMouseLeave={hideTooltip}
              >
                <TreeNodeBadge
                  name={node.name}
                  nodeType={node.type}
                  nodeIconMap={nodeIconMap}
                  spriteConfig={spriteConfig}
                  zoomLevel={zoomLevel}
                  size={22}
                />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">
                  +
                </div>
              </div>
            ))}
          </div>
        )}

        {baselineConfig && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[0.625rem] text-slate-500 uppercase tracking-wider">Config:</span>
            <span className="text-[0.625rem] text-slate-400 font-mono">{baselineConfig}</span>
          </div>
        )}

        {/* Stat deltas */}
        {deltas.length > 0 && (
          <div className="flex items-center gap-3 font-mono text-xs">
            {deltas.map((d, i) => (
              <span
                key={i}
                className={cn('flex items-center gap-0.5', deltaColor(d.pct))}
              >
                {d.pct > 0 && <TrendingUp className="w-3 h-3" />}
                {d.pct < 0 && <TrendingDown className="w-3 h-3" />}
                {d.pct > 0 ? '+' : ''}{d.pct.toFixed(1)}% {d.label}
              </span>
            ))}
          </div>
        )}

        {/* Significant extras pills */}
        {significantExtras.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {significantExtras.map((extra, i) => (
              <span
                key={i}
                className={`text-[0.625rem] px-1.5 py-0.5 rounded ${
                  extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}
              >
                {formatExtraPill(extra)}
              </span>
            ))}
          </div>
        )}

        {/* Safety warnings */}
        {safety?.warnings && safety.warnings.length > 0 && (
          <div className="space-y-0.5">
            {safety.warnings.map((w, i) => (
              <div key={i} className="text-[0.6875rem] text-amber-400/80 italic">
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Recommendation */}
        {recommendation && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-1.5">
            {stripToolTags(recommendation)}
          </div>
        )}

        {/* Summary */}
        {summary && !recommendation && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-1.5">
            {stripToolTags(summary)}
          </div>
        )}
      </div>
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

/**
 * SimulateAscendancySwapResult - Custom renderer for simulate_ascendancy_swap tool
 *
 * Shows before/after ascendancy comparison with DPS/EHP/Life deltas,
 * selected notables, skipped notables, and significant extras.
 * Follows the same visual pattern as SimulateTreeChangesResult.
 */
function SimulateAscendancySwapResult({ data }: { data: Record<string, unknown> }) {
  const currentAscendancy = data.currentAscendancy as string | undefined;
  const targetAscendancy = data.targetAscendancy as string | undefined;
  const currentAscendancyPoints = data.currentAscendancyPoints as number | undefined;
  const targetAscendancyPointsUsed = data.targetAscendancyPointsUsed as number | undefined;
  const selectedNotables = (data.selectedNotables ?? []) as string[];
  const skippedNotables = (data.skippedNotables ?? []) as string[];
  const configApplied = typeof data.configApplied === 'string' ? data.configApplied : undefined;
  const summary = data.summary as string | undefined;
  const warnings = (data.warnings ?? []) as string[];
  const error = data.error as string | undefined;
  const hint = data.hint as string | undefined;

  const dps = data.dps as { before: number; after: number; change: number; pct: string; pctNum: number } | undefined;
  const ehp = data.ehp as { before: number; after: number; change: number; pct: string; pctNum: number } | undefined;
  const life = data.life as { before: number; after: number; change: number; pct: string; pctNum: number } | undefined;
  const significantExtras = (data.significantExtras ?? []) as Array<{
    label: string; value: number; percent: number; displayMode?: string;
  }>;

  if (!currentAscendancy || !targetAscendancy) {
    return <DefaultResult data={data} />;
  }

  if (error) {
    return (
      <div className="text-sm px-1">
        <div className="text-red-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  const deltas = [dps, ehp, life]
    .map((stat, i) => {
      if (!stat) return null;
      const pctNum = stat.pctNum ?? 0;
      if (pctNum === 0 && stat.change === 0) return null;
      return { pct: pctNum, val: stat.change, label: ['DPS', 'EHP', 'Life'][i] };
    })
    .filter(Boolean) as Array<{ pct: number; val: number; label: string }>;

  return (
    <div className="text-sm space-y-2">
      {/* Header: current -> target ascendancy */}
      <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80">
            Ascendancy Swap
          </span>
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-red-900/20 text-red-300 border border-red-500/25">
            {currentAscendancy}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-900/20 text-emerald-300 border border-emerald-500/25">
            {targetAscendancy}
          </span>
          {targetAscendancyPointsUsed != null && currentAscendancyPoints != null && (
            <span className="text-[0.625rem] text-stone-500 font-mono">
              {targetAscendancyPointsUsed}/{currentAscendancyPoints} pts
            </span>
          )}
          {configApplied && <ConfigPills configApplied={configApplied} />}
        </div>
      </div>

      <div className="card-forge rounded-b rounded-t-none px-2 py-2 space-y-2">
        {/* Stat deltas */}
        {deltas.length > 0 && (
          <div className="flex items-center gap-3 font-mono text-xs">
            {deltas.map((d, i) => (
              <span key={i} className={cn('flex items-center gap-0.5', deltaColor(d.pct))}>
                {d.pct > 0 && <TrendingUp className="w-3 h-3" />}
                {d.pct < 0 && <TrendingDown className="w-3 h-3" />}
                {d.pct > 0 ? '+' : ''}{d.pct.toFixed(1)}% {d.label}
              </span>
            ))}
          </div>
        )}

        {/* Selected notables */}
        {selectedNotables.length > 0 && (
          <div className="space-y-1">
            <span className="text-[0.625rem] text-emerald-400/70 uppercase tracking-wider font-medium">Selected Notables</span>
            <div className="flex flex-wrap gap-1">
              {selectedNotables.map((notable, i) => (
                <span key={i} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-900/20 text-emerald-300 border border-emerald-500/20">
                  {notable}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Skipped notables */}
        {skippedNotables.length > 0 && (
          <div className="space-y-1">
            <span className="text-[0.625rem] text-amber-400/70 uppercase tracking-wider font-medium">Skipped</span>
            <div className="flex flex-wrap gap-1">
              {skippedNotables.map((notable, i) => (
                <span key={i} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/15 text-amber-400/70 border border-amber-500/20 line-through decoration-amber-500/30">
                  {notable}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Significant extras pills */}
        {significantExtras.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {significantExtras.map((extra, i) => (
              <span
                key={i}
                className={`text-[0.625rem] px-1.5 py-0.5 rounded ${
                  extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}
              >
                {formatExtraPill(extra)}
              </span>
            ))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-0.5">
            {warnings.map((w, i) => (
              <div key={i} className="text-[0.6875rem] text-amber-400/80 italic flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Summary / hint */}
        {summary && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-1.5">
            {stripToolTags(summary)}
          </div>
        )}
        {hint && !summary && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-1.5">
            {hint}
          </div>
        )}
      </div>
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/**
 * BatchSimulateTreeResult - Custom renderer for batch_simulate_tree tool
 *
 * Shows baseline stats, point budget, and tested tree changes with
 * verdict badges, DPS/EHP/Life deltas, and "Show on Tree" buttons.
 */
function getNetPointCostBadge(
  pointCost: number,
  remainingPoints: number = Infinity,
): { text: string; className: string } {
  const overBudget = pointCost > 0 && pointCost > remainingPoints;
  const overBy = overBudget ? pointCost - remainingPoints : 0;

  const text = pointCost < 0
    ? `${Math.abs(pointCost)} freed`
    : pointCost === 0
      ? '0 net'
      : overBudget
        ? `+${pointCost} cost (${overBy} over)`
        : `+${pointCost} cost`;

  const className = pointCost < 0
    ? 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30'
    : pointCost === 0
      ? 'bg-stone-800/50 text-stone-400 border-stone-600/30'
      : overBudget
        ? 'bg-red-900/30 text-red-300 border-red-500/30'
        : 'bg-amber-900/30 text-amber-300 border-amber-500/30';

  return { text, className };
}

function formatTreeTravelBreakdown(
  breakdown?: { total: number; travelCount: number; destinationCount: number },
): string | null {
  if (!breakdown || breakdown.travelCount <= 0) return null;
  return `(${breakdown.destinationCount} notable + ${breakdown.travelCount} travel)`;
}

function BatchSimulateTreeResult({ data }: { data: Record<string, unknown> }) {
  const callNumber = data.callNumber as number | undefined;
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap, nodeIdMap, nodeMasteryMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (stats && stats.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
      return;
    }
    // Fallback for mastery nodes: show all available effects
    const effects = nodeMasteryMap.get(name);
    if (effects && effects.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const allStats = effects.flatMap(eff => eff.stats);
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats: allStats, headerColor });
    }
  };
  const showMasteryTooltip = (e: React.MouseEvent, name: string, effectId: number | undefined, headerColor: string) => {
    const effects = nodeMasteryMap.get(name);
    if (!effects || effects.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (effectId != null) {
      const selected = effects.find(eff => eff.effect === effectId);
      if (selected) {
        setTooltip({ x: rect.right + 8, y: rect.top, name: `${name} — New Effect`, stats: selected.stats, headerColor });
        return;
      }
    }
    // Fallback: show all available effects
    const allStats = effects.flatMap(eff => eff.stats);
    setTooltip({ x: rect.right + 8, y: rect.top, name, stats: allStats, headerColor });
  };
  const hideTooltip = () => setTooltip(null);

  const baseline = data.baseline as {
    dps?: number;
    ehp?: number;
    life?: number;
  } | undefined;

  const pointBudget = data.pointBudget as {
    remaining?: number;
    warning?: string;
  } | undefined;

  const results = (data.results ?? []) as Array<{
    rank?: number;
    label?: string;
    addNodes?: number[];
    removeNodes?: number[];
    dps?: { before?: number; after?: number; change?: number; pct?: string };
    ehp?: { before?: number; after?: number; change?: number; pct?: string };
    life?: { before?: number; after?: number; change?: number; pct?: string };
    pointCost?: number;
    remainingPoints?: number;
    travelBreakdown?: { total: number; travelCount: number; destinationCount: number };
    warnings?: string[];
    significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
    configApplied?: string;
    verdict?: 'UPGRADE' | 'SIDEGRADE' | 'REJECTED';
    masteryOverrides?: Record<string, number>;
    ref?: string;
  }>;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;
  const summary = data.summary as string | undefined;
  const totalTested = typeof data.totalTested === 'number' ? data.totalTested : results.length;

  if (!baseline || results.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Parse a pct string like "+5.2%" or "-3.1%" to a numeric value */
  const parsePct = (pct: string | undefined): number => {
    if (!pct) return 0;
    const cleaned = pct.replace(/[^-+.\d]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  /** Color class for a delta value */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Verdict-colored left border */
  const verdictBorder = (verdict: string | undefined): string => {
    switch (verdict) {
      case 'UPGRADE': return 'border-emerald-500/60';
      case 'SIDEGRADE': return 'border-amber-500/60';
      case 'REJECTED': return 'border-red-500/60';
      default: return 'border-slate-600/40';
    }
  };

  /** Significant node types worth showing as icons */
  const SIGNIFICANT_TYPES = new Set(['notable', 'keystone', 'mastery', 'ascendancy']);

  /** Resolve an array of node IDs to significant (non-travel) nodes */
  const resolveSignificant = (ids: number[] | undefined) =>
    (ids ?? [])
      .map(id => nodeIdMap.get(id))
      .filter((n): n is { name: string; type: string; stats?: string[] } =>
        n != null && n.name !== '' && SIGNIFICANT_TYPES.has(n.type)
      );

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Tested tree changes */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-amber-400/80 uppercase tracking-wide font-medium">
          Tested Changes
          <span className="text-[0.625rem] text-slate-500 normal-case tracking-normal">
            tested {totalTested} candidate{totalTested !== 1 ? 's' : ''}{totalTested > results.length ? ` — showing top ${results.length}` : ''}
          </span>
        </div>
        <div className="space-y-1.5">
            {results.map((result, i) => {
              const dpsPct = parsePct(result.dps?.pct);
              const ehpPct = parsePct(result.ehp?.pct);
              const lifePct = parsePct(result.life?.pct);
              const pointCost = result.pointCost ?? 0;
              const label = stripToolTags(result.label ?? '');
              const remaining = result.remainingPoints ?? Infinity;
              const pointCostBadge = getNetPointCostBadge(pointCost, remaining);
              const travelBreakdownText = formatTreeTravelBreakdown(result.travelBreakdown);

              const allAdded = resolveSignificant(result.addNodes);
              const allRemoved = resolveSignificant(result.removeNodes);

              // Pull mastery nodes out of added/removed — they get dedicated rendering with violet badges + mastery tooltips
              const addedSignificant = allAdded.filter(n => n.type !== 'mastery');
              const removedSignificant = allRemoved.filter(n => n.type !== 'mastery');
              const hasSwap = removedSignificant.length > 0;

              // Resolve mastery overrides to displayable nodes (with target effect ID for tooltip)
              const masteryOverrideNodes: Array<{ name: string; type: string; effectId?: number }> = [];
              // Masteries from addNodes (newly allocated — no specific effectId)
              for (const node of allAdded.filter(n => n.type === 'mastery')) {
                masteryOverrideNodes.push({ name: node.name, type: 'mastery' });
              }
              // Masteries from explicit masteryOverrides (with target effectId)
              if (result.masteryOverrides) {
                for (const [nodeIdStr, effectId] of Object.entries(result.masteryOverrides)) {
                  const node = nodeIdMap.get(Number(nodeIdStr));
                  if (node && node.name && !masteryOverrideNodes.some(m => m.name === node.name)) {
                    masteryOverrideNodes.push({ name: node.name, type: node.type ?? 'mastery', effectId: typeof effectId === 'number' ? effectId : undefined });
                  }
                }
              }

              const hasIconBundle = addedSignificant.length > 0 || removedSignificant.length > 0 || masteryOverrideNodes.length > 0;

              return (
                <div
                  key={i}
                  id={`tree-setup-c${callNumber ?? 0}-${i + 1}`}
                  data-ref={result.ref?.toLowerCase()}
                  className={cn(
                    'py-1.5 px-2 rounded bg-slate-900/40 border-l-2 group transition-[box-shadow] duration-300',
                    verdictBorder(result.verdict),
                  )}
                >
                  {/* Icon bundle row: removed → added */}
                  {hasIconBundle && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {/* Removed nodes */}
                      {removedSignificant.map((node, ni) => (
                        <div
                          key={`rem-${ni}`}
                          className={cn(
                            'relative opacity-60',
                            (nodeStatsMap.has(node.name) || nodeMasteryMap.has(node.name)) ? 'cursor-help' : 'cursor-default'
                          )}
                          onMouseEnter={(e) => showTooltip(e, node.name, 'text-red-300')}
                          onMouseLeave={hideTooltip}
                        >
                          <TreeNodeBadge
                            name={node.name}
                            nodeType={node.type}
                            nodeIconMap={nodeIconMap}
                            spriteConfig={spriteConfig}
                            zoomLevel={zoomLevel}
                            size={22}
                          />
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">
                            &minus;
                          </div>
                        </div>
                      ))}
                      {/* Swap arrow */}
                      {hasSwap && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 mx-0.5 flex-shrink-0" />
                      )}
                      {/* Added nodes */}
                      {addedSignificant.map((node, ni) => (
                        <div
                          key={`add-${ni}`}
                          className={cn(
                            'relative',
                            (nodeStatsMap.has(node.name) || nodeMasteryMap.has(node.name)) ? 'cursor-help' : 'cursor-default'
                          )}
                          onMouseEnter={(e) => showTooltip(e, node.name, 'text-emerald-300')}
                          onMouseLeave={hideTooltip}
                        >
                          <TreeNodeBadge
                            name={node.name}
                            nodeType={node.type}
                            nodeIconMap={nodeIconMap}
                            spriteConfig={spriteConfig}
                            zoomLevel={zoomLevel}
                            size={22}
                          />
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">
                            +
                          </div>
                        </div>
                      ))}
                      {/* Mastery overrides */}
                      {masteryOverrideNodes.length > 0 && (
                        <>
                          <ArrowRightLeft className="w-3 h-3 text-violet-400/60 mx-0.5 flex-shrink-0" />
                          {masteryOverrideNodes.map((node, ni) => (
                            <div
                              key={`mas-${ni}`}
                              className={cn(
                                'relative',
                                nodeMasteryMap.has(node.name) ? 'cursor-help' : 'cursor-default'
                              )}
                              onMouseEnter={(e) => showMasteryTooltip(e, node.name, node.effectId, 'text-violet-300')}
                              onMouseLeave={hideTooltip}
                            >
                              <TreeNodeBadge
                                name={node.name}
                                nodeType="mastery"
                                nodeIconMap={nodeIconMap}
                                spriteConfig={spriteConfig}
                                zoomLevel={zoomLevel}
                                size={22}
                              />
                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500/90 flex items-center justify-center text-[0.4375rem] text-white font-bold shadow-sm">
                                ~
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {/* Label + badges row */}
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400 text-xs flex-1 min-w-0 truncate">
                      {label}
                    </span>
                    {result.configApplied && <ConfigPills configApplied={result.configApplied} />}
                    {travelBreakdownText && (
                      <span className="text-[0.5625rem] text-stone-500 font-mono">
                        {travelBreakdownText}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[0.625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0',
                        pointCostBadge.className
                      )}
                    >
                      {pointCostBadge.text}
                    </span>
                  </div>

                  {/* DPS + EHP + Life deltas */}
                  <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                    <span className={cn('flex items-center gap-0.5', deltaColor(dpsPct))}>
                      {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                      {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                      {result.dps?.pct ?? '0%'} DPS
                    </span>
                    <span className={cn('flex items-center gap-0.5', deltaColor(ehpPct))}>
                      {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                      {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                      {result.ehp?.pct ?? '0%'} EHP
                    </span>
                    <span className={cn('flex items-center gap-0.5', deltaColor(lifePct))}>
                      {lifePct > 0 && <TrendingUp className="w-3 h-3" />}
                      {lifePct < 0 && <TrendingDown className="w-3 h-3" />}
                      {result.life?.pct ?? '0%'} Life
                    </span>
                  </div>

                  {/* Significant extras + Show on Tree */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {result.significantExtras && result.significantExtras.length > 0 && result.significantExtras.map((extra: { label: string; value: number; percent: number; displayMode?: string }, ei: number) => (
                      <span
                        key={ei}
                        className={`text-[0.625rem] px-1.5 py-0.5 rounded ${
                          extra.value > 0
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {formatExtraPill(extra)}
                      </span>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const store = useDesktopStore.getState();
                        store.setTreeDiffNodes({
                          added: result.addNodes ?? [],
                          removed: result.removeNodes ?? [],
                        });
                        store.setActiveUnifiedTab('tree');
                      }}
                      className="inline-flex items-center gap-1 text-[0.625rem] px-2 py-0.5 rounded
                        bg-sky-500/8 border border-sky-500/20 text-sky-400/90
                        hover:bg-sky-500/15 hover:border-sky-500/40 hover:text-sky-300
                        transition-all duration-150 cursor-pointer"
                    >
                      <Network className="w-2.5 h-2.5" />
                      Show on Tree
                    </button>
                  </div>

                  {/* Warnings (budget warning is now in the badge, filter it out) */}
                  {(() => {
                    const filtered = (result.warnings ?? []).filter(w => !w.startsWith('Exceeds remaining point budget'));
                    return filtered.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {filtered.map((w, wi) => (
                          <div key={wi} className="text-[0.6875rem] text-amber-400/80 italic">
                            {w}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
      </div>

      {/* Only show summary if no structured results (fallback) */}
      {summary && results.length === 0 && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2 px-2">
          {stripToolTags(summary)}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

/**
 * AnalyzeAllocatedTreeResult - Custom renderer for analyze_allocated_tree tool
 *
 * Shows respec candidates ranked by efficiency score. Nodes with low
 * contribution are good targets for respeccing to free points.
 */
function AnalyzeAllocatedTreeResult({ data }: { data: Record<string, unknown> }) {
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (!stats || stats.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
  };
  const hideTooltip = () => setTooltip(null);

  const baseline = data.baseline as {
    dps?: number;
    ehp?: number;
    life?: number;
  } | undefined;

  const candidates = (data.candidates ?? []) as Array<{
    id?: number;
    name?: string;
    ref?: string;
    dpsPercent?: string;
    ehpPercent?: string;
    efficiencyScore?: number;
    pointCost?: number;
    safety?: 'safe' | 'caution' | 'blocked';
    significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
  }>;

  const summary = data.summary as string | undefined;

  const weakClusters = (data.weakClusters ?? []) as Array<{
    notables: Array<{ id: number; name: string; efficiencyScore: number }>;
    totalPointsFreed: number;
    travelPointsFreed: number;
    combinedDpsPercent: number;
    combinedEhpPercent: number;
  }>;

  if (!baseline || candidates.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Parse a pct string like "-0.3%" to a numeric value */
  const parsePct = (pct: string | undefined): number => {
    if (!pct) return 0;
    const cleaned = pct.replace(/[^-+.\d]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  /** Color class for a delta value */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Safety badge dot color */
  const safetyDot = (safety: string) => {
    switch (safety) {
      case 'safe':
        return 'bg-emerald-400';
      case 'caution':
        return 'bg-amber-400';
      case 'blocked':
        return 'bg-red-400';
      default:
        return 'bg-stone-500';
    }
  };

  return (
    <div className="text-sm space-y-2">
      {/* Summary line */}
      {summary && (
        <div className="text-xs text-stone-300 italic px-2">
          {stripToolTags(summary)}
        </div>
      )}

      {/* Respec candidates */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/90">
              Respec Candidates
            </span>
            <span className="text-[0.625rem] text-slate-600">({candidates.length})</span>
          </div>
        </div>
        <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-2 pb-1 text-[0.625rem] text-stone-500 uppercase tracking-wider font-medium">
            <span className="flex-1 pl-7">Node</span>
            <span className="w-14 text-right">DPS</span>
            <span className="w-14 text-right">EHP</span>
            <span className="w-8 text-right">Pts</span>
            <span className="w-10 text-right">Eff/pt</span>
            <span className="w-6" />
          </div>

          <div className="space-y-0.5">
            {candidates.map((c, i) => {
              const dpsPct = parsePct(c.dpsPercent);
              const ehpPct = parsePct(c.ehpPercent);
              const safety = c.safety ?? 'safe';
              const score = c.efficiencyScore ?? 0;
              const pts = c.pointCost ?? 1;
              const nodeName = c.name ?? 'Unknown';

              return (
                <div
                  key={i}
                  data-ref={c.ref}
                  className="py-1 px-2 rounded-md bg-slate-900/30 group"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        nodeStatsMap.has(nodeName) ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, nodeName, 'text-amber-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={nodeName}
                        nodeType={nodeTypeMap.get(nodeName)}
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={20}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-amber-300/90 text-xs font-medium truncate group-hover:text-amber-200 transition-colors">
                        {c.ref && <span className="text-xs font-mono text-amber-400/80 mr-1">{c.ref}</span>}
                        {nodeName}
                      </div>
                      {nodeStatsMap.has(nodeName) && (
                        <div className="text-[0.625rem] text-slate-500 truncate leading-tight">
                          {nodeStatsMap.get(nodeName)![0]}
                        </div>
                      )}
                    </div>
                    <span className={cn('w-14 text-right text-xs font-mono', deltaColor(dpsPct))}>
                      {c.dpsPercent ?? '0%'}
                    </span>
                    <span className={cn('w-14 text-right text-xs font-mono', deltaColor(ehpPct))}>
                      {c.ehpPercent ?? '0%'}
                    </span>
                    <span className="w-8 text-right text-xs font-mono text-stone-500">
                      {pts}
                    </span>
                    <span className="w-10 text-right text-xs font-mono text-stone-400">
                      {score.toFixed(1)}
                    </span>
                    <span className="w-6 flex justify-center">
                      <span
                        className={cn('inline-block w-2 h-2 rounded-full', safetyDot(safety))}
                        title={safety}
                      />
                    </span>
                  </div>
                  {c.significantExtras && c.significantExtras.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5 ml-7">
                      {c.significantExtras.map((extra, ei) => (
                        <span
                          key={ei}
                          className={`text-[0.625rem] px-1 py-0.5 rounded ${
                            extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {formatExtraPill(extra)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Weak Clusters */}
      {weakClusters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/90">
                Weak Clusters
              </span>
              <span className="text-[0.625rem] text-stone-600">(remove together)</span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            <div className="flex flex-col gap-1.5">
              {weakClusters.map((wc, wi) => (
                <div
                  key={wi}
                  className="rounded border border-amber-500/15 bg-amber-950/15 px-2 py-1.5"
                >
                  {/* Cluster header: points freed + impact */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[0.625rem] font-medium text-amber-300/90">
                      frees {wc.totalPointsFreed} pts
                    </span>
                    {wc.travelPointsFreed > 0 && (
                      <span className="text-[0.5625rem] px-1 py-0.5 rounded bg-emerald-900/30 text-emerald-400/80 border border-emerald-500/20">
                        +{wc.travelPointsFreed} travel bonus
                      </span>
                    )}
                    <span className="text-[0.5625rem] text-stone-600 ml-auto flex items-center gap-1.5">
                      <span className={wc.combinedDpsPercent <= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}>
                        DPS {wc.combinedDpsPercent > 0 ? '-' : ''}{Math.abs(wc.combinedDpsPercent).toFixed(1)}%
                      </span>
                      <span className={wc.combinedEhpPercent <= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}>
                        EHP {wc.combinedEhpPercent > 0 ? '-' : ''}{Math.abs(wc.combinedEhpPercent).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  {/* Cluster members */}
                  <div className="flex flex-wrap gap-1">
                    {wc.notables.map((node, ni) => (
                      <span
                        key={ni}
                        className={cn(
                          'inline-flex items-center gap-1 text-[0.625rem] px-1.5 py-0.5 rounded',
                          'bg-amber-900/15 text-amber-300/80 border border-amber-500/15',
                          nodeStatsMap.has(node.name) && 'cursor-help'
                        )}
                        onMouseEnter={(e) => showTooltip(e, node.name, 'text-amber-300')}
                        onMouseLeave={hideTooltip}
                      >
                        <TreeNodeBadge
                          name={node.name}
                          nodeType="notable"
                          nodeIconMap={nodeIconMap}
                          spriteConfig={spriteConfig}
                          zoomLevel={zoomLevel}
                          size={14}
                        />
                        {node.name}
                        <span className="text-stone-500">
                          eff:{node.efficiencyScore.toFixed(1)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}


/**
 * BatchTestJewelsResult - Custom renderer for batch_test_jewels tool
 *
 * Shows baseline stats and tested jewel setups with verdict badges,
 * DPS/EHP/Life deltas, and socket node IDs.
 */

/**
 * Renderer for get_cluster_jewel_options — shows recommended cluster bases,
 * notables, and ladder combos in a compact discovery view.
 */
function GetClusterJewelOptionsResult({ data }: { data: Record<string, unknown> }) {
  const currentSetup = (data.currentSetup ?? {}) as {
    equippedClusters?: Array<{ size?: string; enchantment?: string; notables?: Array<{ name?: string; isAllocated?: boolean }> }>;
    availableSockets?: Array<{ nodeId?: number; slotName?: string; currentJewel?: string | null }>;
  };
  const recommendedBases = (data.recommendedBases ?? {}) as {
    large?: Array<{ enchantment?: string; tag?: string; notables?: Array<{ name?: string; ladderUsage?: number }> }>;
    medium?: Array<{ enchantment?: string; tag?: string; notables?: Array<{ name?: string; ladderUsage?: number }> }>;
  };
  const ladderCombos = (data.ladderCombos ?? []) as Array<{
    size?: string; enchantment?: string; usage?: number;
    topNotables?: Array<{ name?: string; usage?: number }>;
  }>;

  const largeCount = recommendedBases.large?.length ?? 0;
  const mediumCount = recommendedBases.medium?.length ?? 0;
  const equippedCount = currentSetup.equippedClusters?.length ?? 0;
  const availableCount = currentSetup.availableSockets?.length ?? 0;

  if (largeCount === 0 && mediumCount === 0 && ladderCombos.length === 0) {
    return <DefaultResult data={data} />;
  }

  const renderBaseSection = (label: string, bases: typeof recommendedBases.large) => {
    if (!bases || bases.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="text-[0.625rem] text-stone-500 uppercase tracking-wider font-semibold">{label}</div>
        <div className="space-y-1">
          {bases.map((base, i) => (
            <div key={i} className="py-1 px-2 rounded bg-slate-900/40 border border-stone-700/15">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-amber-400 flex-1 truncate">{base.enchantment}</span>
                {base.tag && (
                  <span className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400/70 border border-cyan-500/20 flex-shrink-0">
                    {base.tag}
                  </span>
                )}
              </div>
              {base.notables && base.notables.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {base.notables.slice(0, 4).map((n, ni) => (
                    <span key={ni} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-slate-800/60 text-stone-300 border border-stone-600/20">
                      {n.name}{n.ladderUsage != null ? <span className="text-stone-500 ml-1">{n.ladderUsage}%</span> : null}
                    </span>
                  ))}
                  {base.notables.length > 4 && (
                    <span className="text-[0.625rem] text-stone-500 italic self-center">+{base.notables.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="text-sm px-1 space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-2 text-[0.6875rem] text-stone-400 px-2 py-1 rounded bg-slate-900/40 border border-stone-700/15">
        <span className="text-amber-400/80 font-mono">{largeCount}</span>
        <span className="text-stone-600">large</span>
        <span className="text-stone-700">&middot;</span>
        <span className="text-amber-400/80 font-mono">{mediumCount}</span>
        <span className="text-stone-600">medium bases</span>
        {ladderCombos.length > 0 && (
          <>
            <span className="text-stone-700">&middot;</span>
            <span className="text-cyan-400/70 font-mono">{ladderCombos.length}</span>
            <span className="text-stone-600">ladder combos</span>
          </>
        )}
        {equippedCount > 0 && (
          <>
            <span className="text-stone-700">&middot;</span>
            <span className="text-emerald-400/70 font-mono">{equippedCount}</span>
            <span className="text-stone-600">equipped</span>
          </>
        )}
        {availableCount > 0 && (
          <>
            <span className="text-stone-700">&middot;</span>
            <span className="text-stone-300 font-mono">{availableCount}</span>
            <span className="text-stone-600">open sockets</span>
          </>
        )}
      </div>

      {/* Recommended bases */}
      {renderBaseSection('Large Cluster Bases', recommendedBases.large)}
      {renderBaseSection('Medium Cluster Bases', recommendedBases.medium)}

      {/* Ladder combos */}
      {ladderCombos.length > 0 && (
        <div className="space-y-1">
          <div className="text-[0.625rem] text-stone-500 uppercase tracking-wider font-semibold">Ladder Popular Combos</div>
          <div className="space-y-1">
            {ladderCombos.slice(0, 5).map((combo, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-slate-900/40 border border-stone-700/15">
                <span className="text-[0.5625rem] px-1 py-0.5 rounded bg-slate-800/80 text-stone-500 border border-stone-600/20 flex-shrink-0">
                  {combo.size}
                </span>
                <span className="text-xs text-stone-300 flex-1 truncate">{combo.enchantment}</span>
                {combo.usage != null && (
                  <span className="text-[0.625rem] text-cyan-400/70 flex-shrink-0">{combo.usage}%</span>
                )}
                {combo.topNotables && combo.topNotables.length > 0 && (
                  <span className="text-[0.625rem] text-stone-500 flex-shrink-0 truncate max-w-[120px]">
                    {combo.topNotables.map(n => n.name).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BatchTestJewelsResult({ data }: { data: Record<string, unknown> }) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set());

  const baseline = data.baseline as {
    dps?: number;
    ehp?: number;
    life?: number;
  } | undefined;

  const results = (data.results ?? []) as Array<{
    rank?: number;
    label?: string;
    dps?: { before?: number; after?: number; change?: number; pct?: string };
    ehp?: { before?: number; after?: number; change?: number; pct?: string };
    life?: { before?: number; after?: number; change?: number; pct?: string };
    socketNodeId?: number;
    warnings?: string[];
    unconstrainedImpact?: {
      dps?: { before?: number; after?: number; change?: number; pct?: string };
      ehp?: { before?: number; after?: number; change?: number; pct?: string };
      note?: string;
    };
    verdict?: 'UPGRADE' | 'SIDEGRADE' | 'REJECTED';
    hardConstraintViolations?: string[];
    softConstraintWarnings?: string[];
    jewelDisplay?: {
      name?: string;
      baseName?: string;
      rarity?: string;
      mods?: Array<{
        text?: string;
        type?: string;
        affixType?: 'prefix' | 'suffix';
        tier?: number;
        tierRange?: { min: number; max: number };
        rollRange?: { min: number; max: number };
      }>;
    };
    jewelText?: string;
    displacedJewel?: {
      name?: string;
      baseName?: string;
      rarity?: string;
      itemText?: string;
    };
  }>;

  const summary = data.summary as string | undefined;

  if (!baseline || results.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Parse a pct string like "+5.2%" or "-3.1%" to a numeric value */
  const parsePct = (pct: string | undefined): number => {
    if (!pct) return 0;
    const cleaned = pct.replace(/[^-+.\d]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  /** Color class for a delta value */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Toggle jewel item visibility */
  const toggleItemExpansion = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  /** Check if a result has renderable jewel item data */
  const hasJewelDisplay = (result: (typeof results)[0]): boolean =>
    !!(result.jewelDisplay || result.jewelText);

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Tested jewels */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Gem className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400/80 uppercase tracking-wide font-medium">
            Tested Jewels
          </span>
          <span className="text-[0.625rem] text-slate-500 normal-case tracking-normal">
            ({results.length})
          </span>
        </div>
        <div className="space-y-1.5">
          {results.map((result, i) => {
            const dpsPct = parsePct(result.dps?.pct);
            const ehpPct = parsePct(result.ehp?.pct);
            const lifePct = parsePct(result.life?.pct);
            const isExpanded = expandedItems.has(i);
            const hasItems = hasJewelDisplay(result);

            return (
              <div
                key={i}
                className={cn(
                  'py-1.5 px-2 rounded bg-slate-900/40 border-l-2',
                  result.verdict === 'UPGRADE' ? 'border-emerald-500/50' :
                  result.verdict === 'SIDEGRADE' ? 'border-amber-500/40' :
                  'border-slate-600/40',
                )}
              >
                {/* Label + socket node row */}
                <div className="flex items-center gap-2">
                  <span className="text-stone-200 text-xs font-medium flex-1">
                    {stripToolTags(result.label ?? '')}
                  </span>
                  {result.socketNodeId != null && (
                    <span className="text-[0.625rem] text-stone-500 font-mono flex-shrink-0">
                      Socket #{result.socketNodeId}
                    </span>
                  )}
                </div>

                  {/* Displaced jewel indicator */}
                  {result.displacedJewel?.name && (
                    <div className="flex items-center gap-1.5 mt-1 text-[0.6875rem]">
                      <ArrowRightLeft className="w-3 h-3 text-amber-500/40 shrink-0" />
                      <span className="text-stone-500">Replaces</span>
                      <span className="text-amber-400/70 font-medium">{result.displacedJewel.name}</span>
                    </div>
                  )}

                  {/* DPS + EHP + Life deltas */}
                  <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                    <span className={cn('flex items-center gap-0.5', deltaColor(dpsPct))}>
                      {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                      {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                      {result.dps?.pct ?? '0%'} DPS
                    </span>
                    <span className={cn('flex items-center gap-0.5', deltaColor(ehpPct))}>
                      {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                      {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                      {result.ehp?.pct ?? '0%'} EHP
                    </span>
                    <span className={cn('flex items-center gap-0.5', deltaColor(lifePct))}>
                      {lifePct > 0 && <TrendingUp className="w-3 h-3" />}
                      {lifePct < 0 && <TrendingDown className="w-3 h-3" />}
                      {result.life?.pct ?? '0%'} Life
                    </span>
                  </div>

                  {/* Hard constraint violations (red) */}
                  {result.hardConstraintViolations && result.hardConstraintViolations.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {result.hardConstraintViolations.map((v, vi) => (
                        <div key={`hard-${vi}`} className="text-[0.6875rem] text-red-400/80 italic">
                          {v}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Soft constraint warnings (amber) */}
                  {result.softConstraintWarnings && result.softConstraintWarnings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {result.softConstraintWarnings.map((w, wi) => (
                        <div key={`soft-${wi}`} className="text-[0.6875rem] text-amber-400/80 italic">
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Unconstrained impact — true potential if constraints fixed */}
                  {result.unconstrainedImpact && (
                    <div className="mt-1.5 flex items-center gap-2 px-2 py-1 rounded bg-blue-500/8 border border-blue-500/15 text-xs">
                      <span className="text-blue-400/70 text-[0.625rem] uppercase tracking-wider font-medium shrink-0">
                        If fixed:
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        {result.unconstrainedImpact.dps?.pct && (
                          <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(result.unconstrainedImpact.dps.pct)))}>
                            {parsePct(result.unconstrainedImpact.dps.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                            {result.unconstrainedImpact.dps.pct} DPS
                          </span>
                        )}
                        {result.unconstrainedImpact.ehp?.pct && (
                          <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(result.unconstrainedImpact.ehp.pct)))}>
                            {parsePct(result.unconstrainedImpact.ehp.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                            {result.unconstrainedImpact.ehp.pct} EHP
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Legacy warnings fallback */}
                  {result.warnings && result.warnings.length > 0 && !result.hardConstraintViolations && (
                    <div className="mt-1 space-y-0.5">
                      {result.warnings.map((w, wi) => (
                        <div key={`warn-${wi}`} className="text-[0.6875rem] text-amber-400/80 italic">
                          {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Show items toggle */}
                  {hasItems && (
                    <button
                      type="button"
                      onClick={() => toggleItemExpansion(i)}
                      className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-amber-400/60 hover:text-amber-400/90 transition-colors"
                    >
                      <ChevronDown
                        className={cn(
                          'w-3 h-3 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                      />
                      {isExpanded ? 'Hide items' : 'Show items'}
                    </button>
                  )}

                  {/* Expanded jewel item tooltips */}
                  <AnimatePresence>
                    {hasItems && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 pt-2 border-t border-[#3a3530]/30 flex flex-wrap gap-3 justify-center">
                          {/* New jewel being tested */}
                          {(() => {
                            const tooltipProps = (() => {
                              // Prefer enriched jewelDisplay from backend (has tier/affix data)
                              const jd = result.jewelDisplay;
                              if (jd?.name && jd.mods?.length) {
                                const implicits = (jd.mods ?? [])
                                  .filter(m => m.type === 'implicit')
                                  .map(m => ({
                                    text: m.text ?? '',
                                    affixType: 'unknown',
                                    type: 'implicit',
                                    rollRange: m.rollRange,
                                  }));
                                const explicits = (jd.mods ?? [])
                                  .filter(m => m.type === 'explicit')
                                  .map(m => ({
                                    text: m.text ?? '',
                                    affixType: m.affixType ?? 'unknown',
                                    type: 'explicit',
                                    tier: m.tier,
                                    tierRange: m.tierRange,
                                    rollRange: m.rollRange,
                                  }));
                                return {
                                  name: jd.name ?? '',
                                  baseName: jd.baseName ?? '',
                                  rarity: (jd.rarity ?? 'rare').toUpperCase(),
                                  mods: { implicits, explicits, crafted: [] as Array<{ text: string; affixType: string; type: string }>, enchants: [] as Array<{ text: string; affixType: string; type: string }> },
                                  raw: result.jewelText,
                                };
                              }
                              // Fallback: parse raw item text
                              if (result.jewelText) {
                                const parsed = parseRawItemText(result.jewelText);
                                return { ...parsed, raw: result.jewelText };
                              }
                              return null;
                            })();
                            if (!tooltipProps) return null;
                            return (
                              <div className="flex flex-col items-center gap-1.5">
                                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 font-display font-semibold uppercase tracking-widest">
                                  Testing
                                </span>
                                <ItemTooltip
                                  name={tooltipProps.name}
                                  baseName={tooltipProps.baseName}
                                  rarity={tooltipProps.rarity}
                                  mods={tooltipProps.mods}
                                  raw={tooltipProps.raw}
                                />
                              </div>
                            );
                          })()}

                          {/* Arrow between items when displaced */}
                          {result.displacedJewel?.itemText && (
                            <div className="flex items-center self-center">
                              <ArrowRightLeft className="w-4 h-4 text-stone-600" />
                            </div>
                          )}

                          {/* Displaced jewel (if any) */}
                          {result.displacedJewel?.itemText && (() => {
                            const parsed = parseRawItemText(result.displacedJewel!.itemText!);
                            return (
                              <div className="flex flex-col items-center gap-1.5">
                                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/70 border border-red-500/20 font-display font-semibold uppercase tracking-widest">
                                  Displaced
                                </span>
                                <ItemTooltip
                                  name={parsed.name}
                                  baseName={parsed.baseName}
                                  rarity={parsed.rarity}
                                  mods={parsed.mods}
                                  raw={result.displacedJewel!.itemText}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2 px-2">
          {stripToolTags(summary)}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Unified Tree Test Renderer (batch_test_tree) — handles tree_change,
// jewel_equip, and cluster_chain types in a single ranked list
// =============================================================================

/** Type badge for unified tree results */
function TreeTestTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'tree_change':
      return (
        <span className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[0.5625rem] font-medium bg-purple-500/10 text-purple-400/80 border border-purple-500/20">
          <Network className="w-2 h-2" /> Tree
        </span>
      );
    case 'jewel_equip':
      return (
        <span className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[0.5625rem] font-medium bg-cyan-500/10 text-cyan-400/80 border border-cyan-500/20">
          <Gem className="w-2 h-2" /> Jewel
        </span>
      );
    case 'cluster_chain':
      return (
        <span className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[0.5625rem] font-medium bg-teal-500/10 text-teal-400/80 border border-teal-500/20">
          <Link2 className="w-2 h-2" /> Cluster
        </span>
      );
    default:
      return null;
  }
}

/** Shared DPS/EHP/Life delta row used by all three types */
function StatDeltaRow({ dps, ehp, life }: {
  dps?: { pct?: string };
  ehp?: { pct?: string };
  life?: { pct?: string };
}) {
  const parsePct = (pct: string | undefined): number => {
    if (!pct) return 0;
    const val = parseFloat(pct.replace(/[^-+.\d]/g, ''));
    return isNaN(val) ? 0 : val;
  };
  const deltaColor = (val: number) =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  const dpsPct = parsePct(dps?.pct);
  const ehpPct = parsePct(ehp?.pct);
  const lifePct = parsePct(life?.pct);

  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className={cn('flex items-center gap-0.5', deltaColor(dpsPct))}>
        {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
        {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
        {dps?.pct ?? '0%'} DPS
      </span>
      <span className={cn('flex items-center gap-0.5', deltaColor(ehpPct))}>
        {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
        {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
        {ehp?.pct ?? '0%'} EHP
      </span>
      <span className={cn('flex items-center gap-0.5', deltaColor(lifePct))}>
        {lifePct > 0 && <TrendingUp className="w-3 h-3" />}
        {lifePct < 0 && <TrendingDown className="w-3 h-3" />}
        {life?.pct ?? '0%'} Life
      </span>
    </div>
  );
}

/** Verdict + constraint display for jewel/cluster results */
function VerdictSection({ result }: { result: UnifiedTreeResultEntry }) {
  const parsePct = (pct: string | undefined): number => {
    if (!pct) return 0;
    const val = parseFloat(pct.replace(/[^-+.\d]/g, ''));
    return isNaN(val) ? 0 : val;
  };
  const deltaColor = (val: number) =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  return (
    <>
      {result.hardConstraintViolations && result.hardConstraintViolations.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {result.hardConstraintViolations.map((v, vi) => (
            <div key={`hard-${vi}`} className="text-[0.6875rem] text-red-400/80 italic">{v}</div>
          ))}
        </div>
      )}
      {result.softConstraintWarnings && result.softConstraintWarnings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {result.softConstraintWarnings.map((w, wi) => (
            <div key={`soft-${wi}`} className="text-[0.6875rem] text-amber-400/80 italic">{w}</div>
          ))}
        </div>
      )}
      {result.unconstrainedImpact && (
        <div className="mt-1.5 flex items-center gap-2 px-2 py-1 rounded bg-blue-500/8 border border-blue-500/15 text-xs">
          <span className="text-blue-400/70 text-[0.625rem] uppercase tracking-wider font-medium shrink-0">
            If fixed:
          </span>
          <div className="flex items-center gap-2 font-mono">
            {result.unconstrainedImpact.dps?.pct && (
              <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(result.unconstrainedImpact.dps.pct)))}>
                {parsePct(result.unconstrainedImpact.dps.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                {result.unconstrainedImpact.dps.pct} DPS
              </span>
            )}
            {result.unconstrainedImpact.ehp?.pct && (
              <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(result.unconstrainedImpact.ehp.pct)))}>
                {parsePct(result.unconstrainedImpact.ehp.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                {result.unconstrainedImpact.ehp.pct} EHP
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Tree change row — node icons, add/remove badges, mastery overrides, point cost, "Show on Tree" */
function TreeChangeRow({ result, callNumber, enrichment }: {
  result: UnifiedTreeResultEntry;
  callNumber: number | undefined;
  enrichment: ReturnType<typeof useTreeNodeEnrichment>;
}) {
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeIdMap, nodeMasteryMap } = enrichment;
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (stats && stats.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
      return;
    }
    const effects = nodeMasteryMap.get(name);
    if (effects && effects.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats: effects.flatMap(eff => eff.stats), headerColor });
    }
  };
  const showMasteryTooltip = (e: React.MouseEvent, name: string, effectId: number | undefined, headerColor: string) => {
    const effects = nodeMasteryMap.get(name);
    if (!effects || effects.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (effectId != null) {
      const selected = effects.find(eff => eff.effect === effectId);
      if (selected) {
        setTooltip({ x: rect.right + 8, y: rect.top, name: `${name} — New Effect`, stats: selected.stats, headerColor });
        return;
      }
    }
    setTooltip({ x: rect.right + 8, y: rect.top, name, stats: effects.flatMap(eff => eff.stats), headerColor });
  };
  const hideTooltip = () => setTooltip(null);

  const SIGNIFICANT_TYPES = new Set(['notable', 'keystone', 'mastery', 'ascendancy']);
  const resolveSignificant = (ids: number[] | undefined) =>
    (ids ?? [])
      .map(id => nodeIdMap.get(id))
      .filter((n): n is { name: string; type: string; stats?: string[] } =>
        n != null && n.name !== '' && SIGNIFICANT_TYPES.has(n.type)
      );

  const allAdded = resolveSignificant(result.addNodes);
  const allRemoved = resolveSignificant(result.removeNodes);
  const addedSignificant = allAdded.filter(n => n.type !== 'mastery');
  const removedSignificant = allRemoved.filter(n => n.type !== 'mastery');
  const hasSwap = removedSignificant.length > 0;

  const masteryOverrideNodes: Array<{ name: string; type: string; effectId?: number }> = [];
  for (const node of allAdded.filter(n => n.type === 'mastery')) {
    masteryOverrideNodes.push({ name: node.name, type: 'mastery' });
  }
  if (result.masteryOverrides) {
    for (const [nodeIdStr, effectId] of Object.entries(result.masteryOverrides)) {
      const node = nodeIdMap.get(Number(nodeIdStr));
      if (node && node.name && !masteryOverrideNodes.some(m => m.name === node.name)) {
        masteryOverrideNodes.push({ name: node.name, type: node.type ?? 'mastery', effectId: typeof effectId === 'number' ? effectId : undefined });
      }
    }
  }

  const hasIconBundle = addedSignificant.length > 0 || removedSignificant.length > 0 || masteryOverrideNodes.length > 0;
  const pointCost = result.pointCost ?? 0;
  const remaining = result.remainingPoints ?? Infinity;
  const pointCostBadge = getNetPointCostBadge(pointCost, remaining);
  const travelBreakdownText = formatTreeTravelBreakdown(result.travelBreakdown);
  const label = stripToolTags(result.label ?? '');

  return (
    <>
      {/* Icon bundle: removed → added → mastery */}
      {hasIconBundle && (
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {removedSignificant.map((node, ni) => (
            <div key={`rem-${ni}`} className={cn('relative opacity-60', (nodeStatsMap.has(node.name) || nodeMasteryMap.has(node.name)) ? 'cursor-help' : 'cursor-default')}
              onMouseEnter={(e) => showTooltip(e, node.name, 'text-red-300')} onMouseLeave={hideTooltip}>
              <TreeNodeBadge name={node.name} nodeType={node.type} nodeIconMap={nodeIconMap} spriteConfig={spriteConfig} zoomLevel={zoomLevel} size={22} />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">&minus;</div>
            </div>
          ))}
          {hasSwap && <ArrowRight className="w-3.5 h-3.5 text-slate-500 mx-0.5 flex-shrink-0" />}
          {addedSignificant.map((node, ni) => (
            <div key={`add-${ni}`} className={cn('relative', (nodeStatsMap.has(node.name) || nodeMasteryMap.has(node.name)) ? 'cursor-help' : 'cursor-default')}
              onMouseEnter={(e) => showTooltip(e, node.name, 'text-emerald-300')} onMouseLeave={hideTooltip}>
              <TreeNodeBadge name={node.name} nodeType={node.type} nodeIconMap={nodeIconMap} spriteConfig={spriteConfig} zoomLevel={zoomLevel} size={22} />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">+</div>
            </div>
          ))}
          {masteryOverrideNodes.length > 0 && (
            <>
              <ArrowRightLeft className="w-3 h-3 text-violet-400/60 mx-0.5 flex-shrink-0" />
              {masteryOverrideNodes.map((node, ni) => (
                <div key={`mas-${ni}`} className={cn('relative', nodeMasteryMap.has(node.name) ? 'cursor-help' : 'cursor-default')}
                  onMouseEnter={(e) => showMasteryTooltip(e, node.name, node.effectId, 'text-violet-300')} onMouseLeave={hideTooltip}>
                  <TreeNodeBadge name={node.name} nodeType="mastery" nodeIconMap={nodeIconMap} spriteConfig={spriteConfig} zoomLevel={zoomLevel} size={22} />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500/90 flex items-center justify-center text-[0.4375rem] text-white font-bold shadow-sm">~</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Label + badges */}
      <div className="flex items-center gap-2">
        <span className="text-stone-400 text-xs flex-1 min-w-0 truncate">{label}</span>
        {result.configApplied && <ConfigPills configApplied={result.configApplied} />}
        {travelBreakdownText && <span className="text-[0.5625rem] text-stone-500 font-mono">{travelBreakdownText}</span>}
        <span className={cn('text-[0.625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0', pointCostBadge.className)}>
          {pointCostBadge.text}
        </span>
      </div>

      {/* Stat deltas */}
      <div className="mt-1">
        <StatDeltaRow dps={result.dps} ehp={result.ehp} life={result.life} />
      </div>

      {/* Extras + Show on Tree */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        {result.significantExtras?.map((extra, ei) => (
          <span key={ei} className={`text-[0.625rem] px-1.5 py-0.5 rounded ${extra.value > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {formatExtraPill(extra)}
          </span>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const store = useDesktopStore.getState();
            store.setTreeDiffNodes({ added: result.addNodes ?? [], removed: result.removeNodes ?? [] });
            store.setActiveUnifiedTab('tree');
          }}
          className="inline-flex items-center gap-1 text-[0.625rem] px-2 py-0.5 rounded bg-sky-500/8 border border-sky-500/20 text-sky-400/90 hover:bg-sky-500/15 hover:border-sky-500/40 hover:text-sky-300 transition-all duration-150 cursor-pointer"
        >
          <Network className="w-2.5 h-2.5" /> Show on Tree
        </button>
      </div>

      {/* Attribute breach warnings */}
      {result.attributeBreaches && result.attributeBreaches.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {result.attributeBreaches.map((breach, bi) => (
            <div key={bi} className="text-[0.6875rem] text-red-400/80 italic">
              {breach.attr}: {breach.current} / {breach.required} (deficit {breach.deficit})
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {(() => {
        const filtered = (result.warnings ?? []).filter(w => !w.startsWith('Exceeds remaining point budget'));
        return filtered.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {filtered.map((w, wi) => (
              <div key={wi} className="text-[0.6875rem] text-amber-400/80 italic">{w}</div>
            ))}
          </div>
        ) : null;
      })()}

      <TreeToolTooltip tooltip={tooltip} />
    </>
  );
}

/** Jewel equip row — jewel display, displaced jewel, verdict, constraints */
function JewelEquipRow({ result, index }: {
  result: UnifiedTreeResultEntry;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = stripToolTags(result.label ?? '');

  const hasItems = !!(result.jewelDisplay || result.jewelText);

  return (
    <>
      {/* Label + socket */}
      <div className="flex items-center gap-2">
        <span className="text-stone-200 text-xs font-medium flex-1 min-w-0 truncate">{label}</span>
        {result.socketNodeId != null && (
          <span className="text-[0.625rem] text-stone-500 font-mono flex-shrink-0">Socket #{result.socketNodeId}</span>
        )}
      </div>

      {/* Displaced jewel */}
      {result.displacedJewel?.name && (
        <div className="flex items-center gap-1.5 mt-1 text-[0.6875rem]">
          <ArrowRightLeft className="w-3 h-3 text-amber-500/40 shrink-0" />
          <span className="text-stone-500">Replaces</span>
          <span className="text-amber-400/70 font-medium">{result.displacedJewel.name}</span>
        </div>
      )}

      {/* Stat deltas */}
      <div className="mt-1">
        <StatDeltaRow dps={result.dps} ehp={result.ehp} life={result.life} />
      </div>

      {/* Verdict + constraints */}
      <VerdictSection result={result} />

      {/* Significant extras */}
      {result.significantExtras && result.significantExtras.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {result.significantExtras.map((extra, ei) => (
            <span key={ei} className={`text-[0.625rem] px-1.5 py-0.5 rounded ${extra.value > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {formatExtraPill(extra)}
            </span>
          ))}
        </div>
      )}

      {/* Legacy warnings fallback */}
      {result.warnings && result.warnings.length > 0 && !result.hardConstraintViolations && (
        <div className="mt-1 space-y-0.5">
          {result.warnings.map((w, wi) => (
            <div key={`warn-${wi}`} className="text-[0.6875rem] text-amber-400/80 italic">{w}</div>
          ))}
        </div>
      )}

      {/* Show items toggle */}
      {hasItems && (
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-amber-400/60 hover:text-amber-400/90 transition-colors">
          <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', expanded && 'rotate-180')} />
          {expanded ? 'Hide items' : 'Show items'}
        </button>
      )}

      {/* Expanded jewel tooltip */}
      <AnimatePresence>
        {hasItems && expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="mt-2 pt-2 border-t border-[#3a3530]/30 flex flex-wrap gap-3 justify-center">
              {(() => {
                const jd = result.jewelDisplay;
                const tooltipProps = (() => {
                  if (jd?.name && jd.mods?.length) {
                    const implicits = (jd.mods ?? []).filter(m => m.type === 'implicit').map(m => ({
                      text: m.text ?? '', affixType: 'unknown', type: 'implicit', rollRange: m.rollRange,
                    }));
                    const explicits = (jd.mods ?? []).filter(m => m.type === 'explicit').map(m => ({
                      text: m.text ?? '', affixType: m.affixType ?? 'unknown', type: 'explicit', tier: m.tier, tierRange: m.tierRange, rollRange: m.rollRange,
                    }));
                    return {
                      name: jd.name ?? '', baseName: jd.baseName ?? '', rarity: (jd.rarity ?? 'rare').toUpperCase(),
                      mods: { implicits, explicits, crafted: [] as Array<{ text: string; affixType: string; type: string }>, enchants: [] as Array<{ text: string; affixType: string; type: string }> },
                      raw: result.jewelText,
                    };
                  }
                  if (result.jewelText) {
                    const parsed = parseRawItemText(result.jewelText);
                    return { ...parsed, raw: result.jewelText };
                  }
                  return null;
                })();
                if (!tooltipProps) return null;
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 font-display font-semibold uppercase tracking-widest">Testing</span>
                    <ItemTooltip name={tooltipProps.name} baseName={tooltipProps.baseName} rarity={tooltipProps.rarity} mods={tooltipProps.mods} raw={tooltipProps.raw} />
                  </div>
                );
              })()}
              {result.displacedJewel?.itemText && (
                <div className="flex items-center self-center"><ArrowRightLeft className="w-4 h-4 text-stone-600" /></div>
              )}
              {result.displacedJewel?.itemText && (() => {
                const parsed = parseRawItemText(result.displacedJewel!.itemText!);
                return (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/70 border border-red-500/20 font-display font-semibold uppercase tracking-widest">Displaced</span>
                    <ItemTooltip name={parsed.name} baseName={parsed.baseName} rarity={parsed.rarity} mods={parsed.mods} raw={result.displacedJewel!.itemText} />
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Cluster chain row — chain visualization, notable count, point cost */
function ClusterChainRow({ result }: { result: UnifiedTreeResultEntry }) {
  const label = stripToolTags(result.label ?? '');
  const notableCount = result.allocatedNotables?.length ?? 0;
  const nestedCount = result.nestedSocketsUsed ?? 0;
  const pointCost = result.pointCost ?? 0;

  return (
    <>
      {/* Chain visualization header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <GitBranch className="w-3 h-3 text-teal-400/60 flex-shrink-0" />
          <span className="text-stone-200 text-xs font-medium truncate">{label}</span>
        </div>
        {result.socketNodeId != null && (
          <span className="text-[0.625rem] text-stone-500 font-mono flex-shrink-0">Socket #{result.socketNodeId}</span>
        )}
      </div>

      {/* Chain info badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {notableCount > 0 && (
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/20 font-medium">
            {notableCount} notable{notableCount !== 1 ? 's' : ''} allocated
          </span>
        )}
        {nestedCount > 0 && (
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400/70 border border-teal-500/20 font-medium">
            {nestedCount} nested socket{nestedCount !== 1 ? 's' : ''}
          </span>
        )}
        {pointCost > 0 && (
          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-stone-800/50 text-stone-400 border border-stone-600/30 font-medium">
            {pointCost} points
          </span>
        )}
      </div>

      {/* Displaced jewel */}
      {result.displacedJewel?.name && (
        <div className="flex items-center gap-1.5 text-[0.6875rem]">
          <ArrowRightLeft className="w-3 h-3 text-amber-500/40 shrink-0" />
          <span className="text-stone-500">Replaces</span>
          <span className="text-amber-400/70 font-medium">{result.displacedJewel.name}</span>
        </div>
      )}

      {/* Stat deltas */}
      <div className="mt-1">
        <StatDeltaRow dps={result.dps} ehp={result.ehp} life={result.life} />
      </div>

      {/* Verdict + constraints */}
      <VerdictSection result={result} />

      {/* Significant extras */}
      {result.significantExtras && result.significantExtras.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {result.significantExtras.map((extra, ei) => (
            <span key={ei} className={`text-[0.625rem] px-1.5 py-0.5 rounded ${extra.value > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {formatExtraPill(extra)}
            </span>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {result.warnings.map((w, wi) => (
            <div key={wi} className="text-[0.6875rem] text-amber-400/80 italic">{w}</div>
          ))}
        </div>
      )}
    </>
  );
}

/** Shared type for parsed result entries from the unified batch_test_tree tool */
interface UnifiedTreeResultEntry {
  rank?: number;
  type?: 'tree_change' | 'jewel_equip' | 'cluster_chain';
  label?: string;
  compositeScore?: number;
  dps?: { before?: number; after?: number; change?: number; pct?: string };
  ehp?: { before?: number; after?: number; change?: number; pct?: string };
  life?: { before?: number; after?: number; change?: number; pct?: string };
  significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
  warnings?: string[];
  // tree_change
  addNodes?: number[];
  removeNodes?: number[];
  pointCost?: number;
  remainingPoints?: number;
  travelBreakdown?: { total: number; travelCount: number; destinationCount: number };
  masteryOverrides?: Record<string, number>;
  configApplied?: string;
  attributeBreaches?: Array<{ attr: string; current: number; required: number; deficit: number }>;
  // jewel_equip + cluster_chain
  socketNodeId?: number;
  jewelDisplay?: { name?: string; baseName?: string; rarity?: string; mods?: Array<{ text?: string; type?: string; affixType?: string; tier?: number; tierRange?: { min: number; max: number }; rollRange?: { min: number; max: number } }> };
  jewelText?: string;
  displacedJewel?: { name?: string; baseName?: string; rarity?: string; itemText?: string };
  allocatedNotables?: number[];
  verdict?: 'UPGRADE' | 'SIDEGRADE' | 'REJECTED';
  hardConstraintViolations?: string[];
  softConstraintWarnings?: string[];
  unconstrainedImpact?: { dps?: { change?: number; pct?: string }; ehp?: { change?: number; pct?: string }; note?: string };
  // cluster_chain
  nestedSocketsUsed?: number;
  ref?: string;
}

/**
 * BatchTestTreeResult — Unified renderer for batch_test_tree tool.
 * Handles tree_change, jewel_equip, and cluster_chain results in one ranked list.
 */
function BatchTestTreeResult({ data }: { data: Record<string, unknown> }) {
  const callNumber = data.callNumber as number | undefined;
  const enrichment = useTreeNodeEnrichment();

  const baseline = data.baseline as { dps?: number; ehp?: number; life?: number } | undefined;
  const results = (data.results ?? []) as UnifiedTreeResultEntry[];
  const summary = data.summary as string | undefined;
  const totalTested = typeof data.totalTested === 'number' ? data.totalTested : results.length;

  // Detect if any result has a type field (unified mode) — if not, fall back to tree-only rendering
  const isUnified = results.some(r => r.type != null);

  if (!baseline || results.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Verdict-colored left border */
  const verdictBorder = (r: UnifiedTreeResultEntry): string => {
    if (r.verdict === 'UPGRADE') return 'border-emerald-500/60';
    if (r.verdict === 'SIDEGRADE') return 'border-amber-500/60';
    if (r.verdict === 'REJECTED') return 'border-red-500/60';
    // For tree_change without verdict, infer from DPS change
    const dpsPct = parseFloat((r.dps?.pct ?? '0').replace(/[^-+.\d]/g, ''));
    if (dpsPct > 0.5) return 'border-emerald-500/60';
    if (dpsPct < -0.5) return 'border-red-500/60';
    return 'border-slate-600/40';
  };

  // Count types for header
  const typeCounts = { tree_change: 0, jewel_equip: 0, cluster_chain: 0 };
  for (const r of results) {
    if (r.type && r.type in typeCounts) typeCounts[r.type as keyof typeof typeCounts]++;
  }

  return (
    <div className="text-sm px-1 space-y-3">
      <div className="space-y-1.5">
        {/* Header with type counts */}
        <div className="flex items-center gap-2 text-xs text-amber-400/80 uppercase tracking-wide font-medium">
          Tested Changes
          <span className="text-[0.625rem] text-slate-500 normal-case tracking-normal">
            tested {totalTested} candidate{totalTested !== 1 ? 's' : ''}{totalTested > results.length ? ` — showing top ${results.length}` : ''}
          </span>
          {isUnified && (
            <span className="text-[0.5625rem] text-slate-600 normal-case tracking-normal ml-auto flex items-center gap-1.5">
              {typeCounts.tree_change > 0 && <span className="text-purple-400/60">{typeCounts.tree_change} tree</span>}
              {typeCounts.jewel_equip > 0 && <span className="text-cyan-400/60">{typeCounts.jewel_equip} jewel</span>}
              {typeCounts.cluster_chain > 0 && <span className="text-teal-400/60">{typeCounts.cluster_chain} cluster</span>}
            </span>
          )}
        </div>

        {/* Ranked result rows */}
        <div className="space-y-1.5">
          {results.map((result, i) => (
            <div
              key={i}
              id={`tree-setup-c${callNumber ?? 0}-${i + 1}`}
              data-ref={result.ref?.toLowerCase()}
              className={cn(
                'py-1.5 px-2 rounded bg-slate-900/40 border-l-2 group transition-[box-shadow] duration-300',
                verdictBorder(result),
              )}
            >
              {/* Rank + type badge row */}
              {isUnified && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[0.625rem] font-mono text-stone-600 font-bold w-4 text-right">
                    #{result.rank ?? i + 1}
                  </span>
                  <TreeTestTypeBadge type={result.type ?? 'tree_change'} />
                  {result.verdict && (
                    <span className={cn(
                      'text-[0.5625rem] px-1 py-px rounded font-bold uppercase tracking-wider',
                      result.verdict === 'UPGRADE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                      result.verdict === 'SIDEGRADE' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                      'bg-red-500/15 text-red-400 border border-red-500/25',
                    )}>
                      {result.verdict}
                    </span>
                  )}
                </div>
              )}

              {/* Type-specific content */}
              {(result.type === 'jewel_equip') ? (
                <JewelEquipRow result={result} index={i} />
              ) : (result.type === 'cluster_chain') ? (
                <ClusterChainRow result={result} />
              ) : (
                <TreeChangeRow result={result} callNumber={callNumber} enrichment={enrichment} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary fallback */}
      {summary && results.length === 0 && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2 px-2">
          {stripToolTags(summary)}
        </div>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Preflight Jewel Tool Renderer (test_popular_jewels)
// =============================================================================

interface JewelTestEntry {
  label: string;
  category: 'watchers-eye' | 'cluster' | 'unique';
  socketNodeId: number;
  dpsPct: number;
  ehpPct: number;
  lifePct: number;
  lifeDelta: number;
  extras: string[];
  warnings: string[];
  ladderUsage?: number;
  verdict: 'UPGRADE' | 'SIDEGRADE' | 'NEUTRAL';
  injectedMods?: string[];
  jewelText: string;
  pointCost?: number;
  allocatedNotables?: string[];
  significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
  clusterNotableStats?: Array<{ name: string; stats: string[] }>;
  clusterEnchantment?: string;
}

/**
 * TestPopularJewelsResult - Custom renderer for test_popular_jewels tool
 *
 * Shows jewel preflight test results grouped by category (Watcher's Eye,
 * Cluster Jewels, Unique Jewels) with DPS/EHP deltas and verdict badges.
 */
function TestPopularJewelsResult({ data }: { data: Record<string, unknown> }) {
  const watchersEyeTests = (data.watchersEyeTests ?? []) as JewelTestEntry[];
  const clusterJewelTests = (data.clusterJewelTests ?? []) as JewelTestEntry[];
  const uniqueJewelTests = (data.uniqueJewelTests ?? []) as JewelTestEntry[];
  const forbiddenJewelTests = (data.forbiddenJewelTests ?? []) as JewelTestEntry[];
  const skippedJewels = (data.skippedJewels ?? []) as Array<{ name: string; usage: number; reason: string }>;
  const totalTestedCount = Number(data.totalTestedCount ?? 0);
  const durationMs = Number(data.durationMs ?? 0);

  const allTests = [...watchersEyeTests, ...clusterJewelTests, ...uniqueJewelTests, ...forbiddenJewelTests];
  if (allTests.length === 0 && skippedJewels.length === 0) {
    return <DefaultResult data={data} />;
  }

  const durationSec = (durationMs / 1000).toFixed(1);

  /** Color class for a delta percentage */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Format a percentage delta with sign */
  const fmtPct = (val: number): string =>
    val > 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;

  /** Verdict badge styling */
  const verdictClasses = (v: string): string => {
    switch (v) {
      case 'UPGRADE': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
      case 'SIDEGRADE': return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
      case 'NEUTRAL': return 'bg-stone-700/20 text-stone-500 border-stone-600/20';
      default: return 'bg-stone-700/20 text-stone-500 border-stone-600/20';
    }
  };

  /** Left border accent by verdict */
  const verdictBorder = (v: string): string => {
    switch (v) {
      case 'UPGRADE': return 'border-emerald-500/50';
      case 'SIDEGRADE': return 'border-amber-500/40';
      case 'NEUTRAL': return 'border-slate-600/40';
      default: return 'border-slate-600/40';
    }
  };

  /** Render a group of jewel test entries */
  const renderGroup = (title: string, entries: JewelTestEntry[]) => {
    if (entries.length === 0) return null;
    const upgrades = entries.filter(e => e.verdict === 'UPGRADE').length;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] uppercase tracking-widest text-stone-400 font-semibold">
            {title}
          </span>
          <span className="text-[0.625rem] text-stone-600">({entries.length})</span>
          {upgrades > 0 && (
            <span className="text-[0.5625rem] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 font-mono">
              {upgrades} upgrade{upgrades !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {entries.map((entry, i) => (
            <div
              key={`${entry.category}-${i}`}
              className={cn(
                'py-1.5 px-2 rounded bg-slate-900/40 border-l-2',
                verdictBorder(entry.verdict),
              )}
            >
              {/* Label + verdict row */}
              {entry.category === 'watchers-eye' ? (
                <>
                  {/* WE: badges + verdict on first row, mods as separate lines below */}
                  <div className="flex items-center gap-2 mb-1">
                    {entry.ladderUsage != null && (
                      <span className="text-[0.5625rem] px-1.5 py-px rounded bg-cyan-900/25 text-cyan-400/70 border border-cyan-500/15 font-mono flex-shrink-0">
                        {Math.round(entry.ladderUsage)}%
                      </span>
                    )}
                    {entry.pointCost != null && (
                      <span className="text-[0.5625rem] px-1.5 py-px rounded bg-violet-900/25 text-violet-400/70 border border-violet-500/15 font-mono flex-shrink-0">
                        ~{entry.pointCost} pts
                      </span>
                    )}
                    <span className={cn(
                      'text-[0.5625rem] px-1.5 py-px rounded border font-semibold uppercase tracking-wider flex-shrink-0 ml-auto',
                      verdictClasses(entry.verdict),
                    )}>
                      {entry.verdict}
                    </span>
                  </div>
                  {/* Each aura mod on its own line */}
                  <div className="space-y-0.5">
                    {entry.label.split(' + ').map((modPart, mi) => {
                      const colonIdx = modPart.indexOf(': ');
                      const aura = colonIdx > 0 ? modPart.slice(0, colonIdx) : '';
                      const modText = colonIdx > 0 ? modPart.slice(colonIdx + 2) : modPart;
                      return (
                        <div key={mi} className="flex items-start gap-1.5 text-[0.6875rem]">
                          {aura && (
                            <span className="px-1 py-px rounded bg-teal-900/30 text-teal-400/80 border border-teal-500/20 font-medium flex-shrink-0 text-[0.5625rem] mt-px">
                              {aura}
                            </span>
                          )}
                          <span className="text-stone-300">{stripToolTags(modText)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : entry.category === 'cluster' ? (
                <>
                  {/* Cluster: badges row — mirrors WE layout */}
                  <div className="flex items-center gap-2 mb-1">
                    {entry.pointCost != null && (
                      <span className="text-[0.5625rem] px-1.5 py-px rounded bg-violet-900/25 text-violet-400/70 border border-violet-500/15 font-mono flex-shrink-0">
                        ~{entry.pointCost} pts
                      </span>
                    )}
                    {entry.ladderUsage != null && (
                      <span className="text-[0.5625rem] px-1.5 py-px rounded bg-cyan-900/25 text-cyan-400/70 border border-cyan-500/15 font-mono flex-shrink-0">
                        {Math.round(entry.ladderUsage)}%
                      </span>
                    )}
                    <span className={cn(
                      'text-[0.5625rem] px-1.5 py-px rounded border font-semibold uppercase tracking-wider flex-shrink-0 ml-auto',
                      verdictClasses(entry.verdict),
                    )}>
                      {entry.verdict}
                    </span>
                  </div>
                  {/* Enchantment line — the small passive grant */}
                  {entry.clusterEnchantment && (
                    <div className="text-[0.625rem] text-stone-500 mb-1">
                      Small passives: {entry.clusterEnchantment}
                    </div>
                  )}
                  {/* Notable badges + stat descriptions — mirrors WE aura badge pattern */}
                  {entry.clusterNotableStats && entry.clusterNotableStats.length > 0 ? (
                    <div className="space-y-1">
                      {entry.clusterNotableStats.map((notable, ni) => (
                        <div key={ni}>
                          <div className="flex items-start gap-1.5 text-[0.6875rem]">
                            <span className="px-1 py-px rounded bg-amber-900/30 text-amber-400/80 border border-amber-500/20 font-medium flex-shrink-0 text-[0.5625rem] mt-px">
                              {notable.name}
                            </span>
                          </div>
                          {notable.stats.length > 0 && (
                            <div className="pl-1 mt-0.5 space-y-px">
                              {notable.stats.map((stat, si) => (
                                <div key={si} className="text-[0.625rem] text-stone-400/80 leading-snug">
                                  {stat}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-stone-200 text-xs font-medium truncate">
                      {stripToolTags(entry.label)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-200 text-xs font-medium flex-1 truncate">
                      {stripToolTags(entry.label)}
                    </span>
                    {entry.pointCost != null && (
                      <span className="text-[0.5625rem] px-1.5 py-px rounded bg-violet-900/25 text-violet-400/70 border border-violet-500/15 font-mono flex-shrink-0">
                        ~{entry.pointCost} pts
                      </span>
                    )}
                    {entry.ladderUsage != null && (
                      <span className="text-[0.5625rem] px-1.5 py-px rounded bg-cyan-900/25 text-cyan-400/70 border border-cyan-500/15 font-mono flex-shrink-0">
                        {Math.round(entry.ladderUsage)}%
                      </span>
                    )}
                    <span className={cn(
                      'text-[0.5625rem] px-1.5 py-px rounded border font-semibold uppercase tracking-wider flex-shrink-0',
                      verdictClasses(entry.verdict),
                    )}>
                      {entry.verdict}
                    </span>
                  </div>
                  {/* Unique jewel mod lines — show what the jewel actually does */}
                  {entry.category === 'unique' && entry.injectedMods && entry.injectedMods.length > 0 && (
                    <div className="mt-1 space-y-px pl-0.5">
                      {entry.injectedMods.map((mod, mi) => (
                        <div key={mi} className="text-[0.625rem] text-stone-400/80 leading-snug">
                          {mod}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* DPS + EHP deltas */}
              <div className="flex items-center gap-3 mt-1 font-mono text-xs">
                <span className={cn('flex items-center gap-0.5', deltaColor(entry.dpsPct))}>
                  {entry.dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                  {entry.dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                  {fmtPct(entry.dpsPct)} DPS
                </span>
                <span className={cn('flex items-center gap-0.5', deltaColor(entry.ehpPct))}>
                  {entry.ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                  {entry.ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                  {fmtPct(entry.ehpPct)} EHP
                </span>
                {entry.lifePct !== 0 && (
                  <span className={cn('flex items-center gap-0.5', deltaColor(entry.lifePct))}>
                    {fmtPct(entry.lifePct)} Life
                  </span>
                )}
              </div>

              {/* Significant stat extras (resistances, armour, evasion, etc.) */}
              {entry.significantExtras && entry.significantExtras.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.significantExtras.map((extra, ei) => (
                    <span
                      key={ei}
                      className={`text-[0.625rem] px-1 py-0.5 rounded ${
                        extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {formatExtraPill(extra)}
                    </span>
                  ))}
                </div>
              )}

              {/* Extras */}
              {entry.extras.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.extras.map((ex, ei) => (
                    <span key={ei} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-blue-950/20 text-blue-300/70 border border-blue-500/15">
                      {ex}
                    </span>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {entry.warnings.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {entry.warnings.map((w, wi) => (
                    <div key={wi} className="text-[0.6875rem] text-amber-400/80 italic">{w}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <Gem className="w-3 h-3 text-amber-400" />
        <span className="text-amber-400/80 uppercase tracking-wide font-medium">
          Testing Popular Jewels
        </span>
        <span className="text-[0.625rem] text-slate-500 normal-case tracking-normal">
          ({totalTestedCount})
        </span>
        {durationMs > 0 && (
          <span className="text-[0.625rem] text-stone-600 ml-auto font-mono">{durationSec}s</span>
        )}
      </div>

      {/* Result groups */}
      {renderGroup("Watcher's Eye", watchersEyeTests)}
      {renderGroup('Cluster Jewels', clusterJewelTests)}
      {renderGroup('Unique Jewels', uniqueJewelTests)}
      {renderGroup('Forbidden Flame/Flesh', forbiddenJewelTests)}

      {/* Skipped jewels */}
      {skippedJewels.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] uppercase tracking-widest text-stone-500 font-semibold">
              Skipped
            </span>
            <span className="text-[0.625rem] text-stone-600">({skippedJewels.length})</span>
          </div>
          <div className="space-y-px">
            {skippedJewels.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5 px-2 text-[0.6875rem]">
                <span className="text-stone-500 truncate">{s.name}</span>
                {s.usage > 0 && (
                  <span className="text-[0.5625rem] text-stone-600 font-mono flex-shrink-0">{Math.round(s.usage)}%</span>
                )}
                <span className="text-stone-600 italic ml-auto flex-shrink-0">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Preflight Tree Tool Renderers (test_obvious_candidates)
// =============================================================================

/**
 * Structured node candidate from test_obvious_candidates tool output (new format).
 */
interface NodeTestCandidate {
  label: string;
  pointCost: number;
  dpsPct: number;
  ehpPct: number;
  dpsPerPoint: number;
  ehpPerPoint: number;
  compositeScore: number;
  extras: string[];
  /** Semicolon-delimited stat description from the passive tree node */
  stats?: string;
  /** Destination node ID for this candidate */
  destinationId?: number;
  travelBreakdown?: { total: number; travelCount: number; destinationCount: number };
  warnings?: string[];
}

/**
 * Legacy parsed node candidate from old markdown format (backward compat).
 */
interface ParsedNodeCandidate {
  label: string;
  dpsPct: number;
  ehpPct: number;
  verdict: 'UPGRADE' | 'SIDEGRADE' | 'REJECTED';
}

/**
 * Parse the legacy markdown output from test_obvious_candidates into structured data.
 * Only used for backward compatibility with old format.
 */
function parseNodeCandidatesMarkdown(markdown: string): ParsedNodeCandidate[] {
  const candidates: ParsedNodeCandidate[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(
      /^-\s+(.+?):\s+DPS\s+([+-]?\d+\.?\d*)%,\s+EHP\s+([+-]?\d+\.?\d*)%\s+\[(UPGRADE|SIDEGRADE|REJECTED)\]/
    );
    if (match) {
      candidates.push({
        label: match[1],
        dpsPct: parseFloat(match[2]),
        ehpPct: parseFloat(match[3]),
        verdict: match[4] as 'UPGRADE' | 'SIDEGRADE' | 'REJECTED',
      });
    }
  }

  return candidates;
}

/** Border color based on composite score (zero-guarded) */
function candidateBorderColor(score: number): string {
  if (score > 0.5) return 'border-emerald-500/60';
  if (score > 0.05) return 'border-amber-500/60';
  return 'border-stone-500/40';
}

/** Color class for a delta value (zero-guarded: values that round to 0.0 are neutral) */
function candidateDeltaColor(val: number): string {
  if (Math.abs(val) < 0.05) return 'text-stone-400';
  return val > 0 ? 'text-emerald-400' : 'text-red-400';
}

/** Format a delta with appropriate prefix: + for positive, ~ for zero-ish, raw for negative */
function candidateDeltaPrefix(val: number): string {
  if (Math.abs(val) < 0.05) return '~';
  return val >= 0 ? '+' : '';
}

/**
 * TestObviousCandidatesResult - Custom renderer for test_obvious_candidates tool
 *
 * Supports both new structured format (data.candidates array) and legacy
 * markdown format (data.markdown string) for backward compatibility.
 * Shows per-point efficiency, DPS/EHP deltas, and extras per candidate.
 */
function TestObviousCandidatesResult({ data }: { data: Record<string, unknown> }) {
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (!stats || stats.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
  };
  const hideTooltip = () => setTooltip(null);

  const structuredCandidates = Array.isArray(data.candidates)
    ? (data.candidates as NodeTestCandidate[])
    : null;
  const summary = typeof data.summary === 'string' ? data.summary : '';
  const remainingPoints = typeof data.remainingPoints === 'number' ? data.remainingPoints : Infinity;

  /** Parse swap/add labels into removed + added node names */
  const parseSwapLabel = (label: string): { removed?: string; added?: string } => {
    const swapMatch = label.match(/^Swap\s+(.+?)\s*->\s*(.+?)(?:\s*\(\d+pt\))?$/i);
    if (swapMatch) {
      return { removed: swapMatch[1].trim(), added: swapMatch[2].trim() };
    }
    const addMatch = label.match(/^Add\s+(.+?)(?:\s*\(\d+pt\))?$/i);
    if (addMatch) {
      return { added: addMatch[1].trim() };
    }
    return {};
  };

  // New structured format
  if (structuredCandidates) {
    if (structuredCandidates.length === 0) {
      return (
        <div className="text-sm px-1">
          <span className="text-stone-400 text-xs italic">No obvious candidates to test.</span>
        </div>
      );
    }

    /** Whether a delta is effectively zero after rounding to 1 decimal */
    const isZeroish = (val: number): boolean => Math.abs(val) < 0.05;

    return (
      <div className="text-sm space-y-2">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/90">
                Node Candidates
              </span>
              <span className="text-[0.625rem] text-slate-600">
                ({summary || `${structuredCandidates.length} tested`})
              </span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            {/* Candidate list - already sorted by backend (best composite score first) */}
            <div className="flex flex-col gap-0.5">
              {structuredCandidates.map((cand, i) => {
                const statsArr = cand.stats ? cand.stats.split('; ').slice(0, 3) : [];
                const parsed = parseSwapLabel(cand.label);
                const displayLabel = cand.label.replace(/\s*\(\d+pt\)$/i, '');
                const pointCostBadge = getNetPointCostBadge(cand.pointCost, remainingPoints);
                const travelBreakdownText = formatTreeTravelBreakdown(cand.travelBreakdown);

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.03 }}
                    className={cn(
                      'py-2 px-2.5 rounded-md bg-slate-900/40 border-l-2',
                      candidateBorderColor(cand.compositeScore)
                    )}
                  >
                    {/* Row 1: Icon bundle + label + point cost badge */}
                    <div className="flex items-center gap-2">
                      {/* Node icon bundle */}
                      {(parsed.removed || parsed.added) && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {parsed.removed && (
                            <div
                              className={cn(
                                'relative opacity-60',
                                nodeStatsMap.has(parsed.removed) ? 'cursor-help' : 'cursor-default'
                              )}
                              onMouseEnter={(e) => showTooltip(e, parsed.removed!, 'text-red-300')}
                              onMouseLeave={hideTooltip}
                            >
                              <TreeNodeBadge
                                name={parsed.removed}
                                nodeType={nodeTypeMap.get(parsed.removed) ?? 'notable'}
                                nodeIconMap={nodeIconMap}
                                spriteConfig={spriteConfig}
                                zoomLevel={zoomLevel}
                                size={20}
                              />
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500/90 flex items-center justify-center text-[0.4375rem] text-white font-bold shadow-sm">
                                &minus;
                              </div>
                            </div>
                          )}
                          {parsed.removed && parsed.added && (
                            <ArrowRight className="w-3 h-3 text-slate-500 mx-0.5 flex-shrink-0" />
                          )}
                          {parsed.added && (
                            <div
                              className={cn(
                                'relative',
                                nodeStatsMap.has(parsed.added) ? 'cursor-help' : 'cursor-default'
                              )}
                              onMouseEnter={(e) => showTooltip(e, parsed.added!, 'text-emerald-300')}
                              onMouseLeave={hideTooltip}
                            >
                              <TreeNodeBadge
                                name={parsed.added}
                                nodeType={nodeTypeMap.get(parsed.added) ?? 'notable'}
                                nodeIconMap={nodeIconMap}
                                spriteConfig={spriteConfig}
                                zoomLevel={zoomLevel}
                                size={20}
                              />
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500/90 flex items-center justify-center text-[0.4375rem] text-white font-bold shadow-sm">
                                +
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <span className="text-stone-400 text-xs font-medium flex-1 min-w-0 truncate">
                        {displayLabel}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {travelBreakdownText && (
                          <span className="text-[0.5625rem] text-stone-500 font-mono">
                            {travelBreakdownText}
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-[0.625rem] px-1.5 py-0.5 rounded border font-medium',
                            pointCostBadge.className
                          )}
                        >
                          {pointCostBadge.text}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: DPS + EHP deltas (focal point) */}
                    <div className="flex items-center gap-3 mt-1.5 font-mono text-xs">
                      <span className={cn('flex items-center gap-0.5', candidateDeltaColor(cand.dpsPct))}>
                        {!isZeroish(cand.dpsPct) && cand.dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                        {!isZeroish(cand.dpsPct) && cand.dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                        {candidateDeltaPrefix(cand.dpsPct)}{cand.dpsPct.toFixed(1)}% DPS
                      </span>
                      <span className={cn('flex items-center gap-0.5', candidateDeltaColor(cand.ehpPct))}>
                        {!isZeroish(cand.ehpPct) && cand.ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                        {!isZeroish(cand.ehpPct) && cand.ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                        {candidateDeltaPrefix(cand.ehpPct)}{cand.ehpPct.toFixed(1)}% EHP
                      </span>
                    </div>

                    {/* Row 3: Efficiency or free/freed-point summary */}
                    <div className="flex items-center gap-3 mt-0.5 text-[0.625rem] text-stone-500 font-mono">
                      {cand.pointCost > 0 ? (
                        <>
                          <span>
                            {candidateDeltaPrefix(cand.dpsPerPoint)}{cand.dpsPerPoint.toFixed(1)}% DPS/pt
                          </span>
                          <span>
                            {candidateDeltaPrefix(cand.ehpPerPoint)}{cand.ehpPerPoint.toFixed(1)}% EHP/pt
                          </span>
                        </>
                      ) : (
                        <span className={cand.pointCost < 0 ? 'text-emerald-400' : 'text-stone-400'}>
                          {cand.pointCost < 0
                            ? `Frees ${Math.abs(cand.pointCost)} pt${Math.abs(cand.pointCost) !== 1 ? 's' : ''} net`
                            : 'No net point cost'}
                        </span>
                      )}
                    </div>

                    {/* Row 4: Extras as colored pills */}
                    {cand.extras.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {cand.extras.map((extra, ei) => {
                          const isNeg = extra.startsWith('-');
                          const isPos = extra.startsWith('+');
                          const pillColor = isNeg
                            ? 'bg-red-500/10 text-red-400'
                            : isPos
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800/60 text-stone-400';
                          return (
                            <span
                              key={ei}
                              className={cn('text-[0.625rem] px-1.5 py-0.5 rounded', pillColor)}
                            >
                              {extra}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Row 5: Node stat descriptions (tertiary, max 3) */}
                    {statsArr.length > 0 && (
                      <div className="mt-1.5 text-[0.625rem] text-stone-500 leading-relaxed">
                        {statsArr.map((stat, si) => (
                          <span key={si}>
                            {si > 0 && <span className="text-stone-600"> · </span>}
                            {stat}
                          </span>
                        ))}
                      </div>
                    )}

                    {cand.warnings && cand.warnings.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {cand.warnings.map((warning, wi) => (
                          <div key={wi} className="text-[0.625rem] text-amber-400/80 italic">
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
        <TreeToolTooltip tooltip={tooltip} />
      </div>
    );
  }

  // Legacy markdown format fallback
  const markdown = (data.markdown ?? '') as string;

  if (markdown.includes('No obvious candidates to test')) {
    return (
      <div className="text-sm px-1">
        <span className="text-stone-400 text-xs italic">No obvious candidates to test.</span>
      </div>
    );
  }

  const legacyCandidates = parseNodeCandidatesMarkdown(markdown);
  if (legacyCandidates.length === 0) {
    return <DefaultResult data={data} />;
  }

  const sortedCandidates = [...legacyCandidates].sort((a, b) => {
    const aPriority = VERDICT_PRIORITY[a.verdict] ?? 2;
    const bPriority = VERDICT_PRIORITY[b.verdict] ?? 2;
    return aPriority - bPriority;
  });

  const upgradeCount = legacyCandidates.filter(c => c.verdict === 'UPGRADE').length;
  const sidegradeCount = legacyCandidates.filter(c => c.verdict === 'SIDEGRADE').length;

  /** Legacy verdict badge styling */
  const verdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'UPGRADE':
        return 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30';
      case 'SIDEGRADE':
        return 'bg-amber-900/30 text-amber-300 border-amber-500/30';
      case 'REJECTED':
        return 'bg-red-900/30 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-800/60 text-stone-400 border-stone-600/30';
    }
  };

  /** Legacy border color for verdict */
  const verdictBorder = (verdict: string) => {
    switch (verdict) {
      case 'UPGRADE':
        return 'border-emerald-500/60';
      case 'SIDEGRADE':
        return 'border-amber-500/60';
      case 'REJECTED':
        return 'border-red-500/60';
      default:
        return 'border-stone-500/40';
    }
  };

  /** Legacy delta color */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Summary header */}
      <div className="space-y-1">
        <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
          Node Candidates
        </div>
        <div className="text-xs text-stone-400">
          Tested {legacyCandidates.length} candidate{legacyCandidates.length !== 1 ? 's' : ''}
          {upgradeCount > 0 && (
            <span className="text-emerald-400 ml-1">
              ({upgradeCount} upgrade{upgradeCount !== 1 ? 's' : ''})
            </span>
          )}
          {sidegradeCount > 0 && upgradeCount === 0 && (
            <span className="text-amber-400 ml-1">
              ({sidegradeCount} sidegrade{sidegradeCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>

      {/* Candidate list */}
      <div className="space-y-1.5">
        {sortedCandidates.map((cand, i) => (
          <div
            key={i}
            className={cn(
              'py-1.5 px-2 rounded bg-slate-900/40 border-l-2',
              verdictBorder(cand.verdict)
            )}
          >
            {/* Label + verdict badge */}
            <div className="flex items-center gap-2">
              <span className="text-stone-200 text-xs font-medium flex-1 min-w-0 truncate">
                {cand.label}
              </span>
              <span
                className={cn(
                  'text-[0.625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0',
                  verdictBadge(cand.verdict)
                )}
              >
                {cand.verdict}
              </span>
            </div>

            {/* DPS + EHP deltas */}
            <div className="flex items-center gap-2 mt-1 font-mono text-xs">
              <span
                className={cn(
                  'flex items-center gap-0.5',
                  deltaColor(cand.dpsPct)
                )}
              >
                {cand.dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                {cand.dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                {cand.dpsPct >= 0 ? '+' : ''}{cand.dpsPct.toFixed(1)}% DPS
              </span>
              <span
                className={cn(
                  'flex items-center gap-0.5',
                  deltaColor(cand.ehpPct)
                )}
              >
                {cand.ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                {cand.ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                {cand.ehpPct >= 0 ? '+' : ''}{cand.ehpPct.toFixed(1)}% EHP
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// TestLadderClustersResult
// =============================================================================

interface LadderClusterMember {
  name: string;
  usage: number;
  individualCost: number;
  allocated: boolean;
}

interface LadderCluster {
  label: string;
  members: LadderClusterMember[];
  totalCost: number;
  savings: number;
  avgCoOccurrence: number;
  dpsPct: number;
  ehpPct: number;
  dpsPerPoint: number;
  ehpPerPoint: number;
  extras: string[];
  addNodes: number[];
  warnings?: string[];
}

/** Border color for ladder cluster cards based on DPS impact */
function clusterBorderColor(dpsPct: number, ehpPct: number): string {
  if (dpsPct > 2 || ehpPct > 3) return 'border-teal-400/60';
  if (dpsPct > 0.5 || ehpPct > 1) return 'border-teal-500/45';
  if (dpsPct > 0 || ehpPct > 0) return 'border-cyan-600/40';
  return 'border-stone-500/40';
}

/**
 * TestLadderClustersResult - Custom renderer for test_ladder_clusters tool
 *
 * Displays ladder cluster combos - groups of popular notables that ladder
 * builds frequently allocate together. Each cluster shows member notables
 * with usage %, combined stat deltas, per-point efficiency, and savings.
 */
function TestLadderClustersResult({ data }: { data: Record<string, unknown> }) {
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (!stats || stats.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
  };
  const hideTooltip = () => setTooltip(null);

  const clusters = Array.isArray(data.clusters) ? (data.clusters as LadderCluster[]) : [];
  const summary = typeof data.summary === 'string' ? data.summary : '';

  if (clusters.length === 0) {
    return (
      <div className="text-sm px-1">
        <span className="text-stone-400 text-xs italic">No ladder clusters to test.</span>
      </div>
    );
  }

  const isZeroish = (val: number): boolean => Math.abs(val) < 0.05;

  return (
    <div className="text-sm space-y-2">
      {/* Section header - teal accent to differentiate from amber Node Candidates */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
          <div className="flex items-center gap-2">
            <Network className="w-3 h-3 text-teal-400" />
            <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-teal-400/90">
              Ladder Notable Clusters
            </span>
            <span className="text-[0.625rem] text-slate-600">
              ({summary || `${clusters.length} tested`})
            </span>
          </div>
        </div>
        <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
          <div className="flex flex-col gap-1.5">
            {clusters.map((cluster, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.04 }}
                className={cn(
                  'py-2.5 px-2.5 rounded-md bg-slate-900/40 border-l-2',
                  clusterBorderColor(cluster.dpsPct, cluster.ehpPct)
                )}
              >
                {/* Row 1: Member notables (vertical stack) */}
                <div className="flex flex-col gap-1">
                  {cluster.members.map((member, mi) => (
                    <div
                      key={mi}
                      className={cn(
                        'flex items-center gap-2',
                        member.allocated && 'opacity-50'
                      )}
                    >
                      {/* Node icon */}
                      <div
                        className={cn(
                          'relative flex-shrink-0',
                          nodeStatsMap.has(member.name) ? 'cursor-help' : 'cursor-default'
                        )}
                        onMouseEnter={(e) => showTooltip(e, member.name, 'text-teal-300')}
                        onMouseLeave={hideTooltip}
                      >
                        <TreeNodeBadge
                          name={member.name}
                          nodeType={nodeTypeMap.get(member.name) ?? 'notable'}
                          nodeIconMap={nodeIconMap}
                          spriteConfig={spriteConfig}
                          zoomLevel={zoomLevel}
                          size={18}
                        />
                        {member.allocated && (
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-500/90 flex items-center justify-center shadow-sm">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Notable name */}
                      <span className={cn(
                        'text-xs font-medium flex-1 min-w-0 truncate',
                        member.allocated ? 'text-stone-500' : 'text-stone-300'
                      )}>
                        {member.name}
                      </span>

                      {/* Usage % badge */}
                      <span className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400/80 font-mono flex-shrink-0">
                        {member.usage.toFixed(0)}%
                      </span>

                      {/* Individual point cost */}
                      <span className="text-[0.5625rem] text-stone-500 font-mono flex-shrink-0">
                        {member.allocated ? 'alloc' : `+${member.individualCost}pt`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Row 2: DPS + EHP deltas */}
                <div className="flex items-center gap-3 mt-2 font-mono text-xs">
                  <span className={cn('flex items-center gap-0.5', candidateDeltaColor(cluster.dpsPct))}>
                    {!isZeroish(cluster.dpsPct) && cluster.dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                    {!isZeroish(cluster.dpsPct) && cluster.dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                    {candidateDeltaPrefix(cluster.dpsPct)}{cluster.dpsPct.toFixed(1)}% DPS
                  </span>
                  <span className={cn('flex items-center gap-0.5', candidateDeltaColor(cluster.ehpPct))}>
                    {!isZeroish(cluster.ehpPct) && cluster.ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                    {!isZeroish(cluster.ehpPct) && cluster.ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                    {candidateDeltaPrefix(cluster.ehpPct)}{cluster.ehpPct.toFixed(1)}% EHP
                  </span>
                </div>

                {/* Row 3: Per-point efficiency */}
                <div className="flex items-center gap-3 mt-0.5 text-[0.625rem] text-stone-500 font-mono">
                  <span>
                    {candidateDeltaPrefix(cluster.dpsPerPoint)}{cluster.dpsPerPoint.toFixed(1)}% DPS/pt
                  </span>
                  <span>
                    {candidateDeltaPrefix(cluster.ehpPerPoint)}{cluster.ehpPerPoint.toFixed(1)}% EHP/pt
                  </span>
                </div>

                {/* Row 4: Cost + savings badges */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={cn(
                    'text-[0.625rem] px-1.5 py-0.5 rounded border font-medium',
                    'bg-amber-900/30 text-amber-300 border-amber-500/30'
                  )}>
                    {cluster.totalCost}pt total
                  </span>
                  {cluster.savings > 0 && (
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded border font-medium
                      bg-emerald-900/30 text-emerald-300 border-emerald-500/30">
                      saves {cluster.savings}pt
                    </span>
                  )}
                  {cluster.avgCoOccurrence > 0 && (
                    <span className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-teal-500/8 text-teal-400/60 font-mono">
                      {cluster.avgCoOccurrence.toFixed(0)}% co-occur
                    </span>
                  )}
                </div>

                {/* Row 5: Extras pills */}
                {cluster.extras.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {cluster.extras.map((extra, ei) => {
                      const isNeg = extra.startsWith('-');
                      const isPos = extra.startsWith('+');
                      const pillColor = isNeg
                        ? 'bg-red-500/10 text-red-400'
                        : isPos
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800/60 text-stone-400';
                      return (
                        <span
                          key={ei}
                          className={cn('text-[0.625rem] px-1.5 py-0.5 rounded', pillColor)}
                        >
                          {extra}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Row 6: Show on Tree button */}
                {cluster.addNodes.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const store = useDesktopStore.getState();
                        store.setTreeDiffNodes({
                          added: cluster.addNodes,
                          removed: [],
                        });
                        store.setActiveUnifiedTab('tree');
                      }}
                      className="inline-flex items-center gap-1 text-[0.625rem] px-2 py-0.5 rounded
                        bg-sky-500/8 border border-sky-500/20 text-sky-400/90
                        hover:bg-sky-500/15 hover:border-sky-500/40 hover:text-sky-300
                        transition-all duration-150 cursor-pointer"
                    >
                      <Network className="w-2.5 h-2.5" />
                      Show on Tree
                    </button>
                  </div>
                )}

                {/* Warnings */}
                {cluster.warnings && cluster.warnings.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {cluster.warnings.map((warning, wi) => (
                      <div key={wi} className="text-[0.625rem] text-amber-400/80 italic">
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

// =============================================================================
// TestMasteryAlternativesResult
// =============================================================================

interface MasteryAlternative {
  masteryName: string;
  nodeId: number;
  currentStats: string;
  effectId: number;
  alternativeStats: string;
  dpsPct: number;
  ehpPct: number;
  extras: string[];
  pointCost?: number;
  source?: 'swap' | 'accessible' | 'ladder';
}

/** Border color based on mastery alternative impact */
function masteryBorderColor(dpsPct: number, ehpPct: number): string {
  if (dpsPct > 0.5 || ehpPct > 1) return 'border-emerald-500/60';
  if (dpsPct > 0 || ehpPct > 0) return 'border-amber-500/60';
  return 'border-stone-500/40';
}

/**
 * TestMasteryAlternativesResult - Custom renderer for test_mastery_alternatives tool
 *
 * Shows mastery alternatives grouped by mastery name, with current -> alternative
 * stat text, DPS/EHP deltas, and extras. Sorted by impact within each group.
 */
function TestMasteryAlternativesResult({ data }: { data: Record<string, unknown> }) {
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap, nodeMasteryMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (stats && stats.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
      return;
    }
    // Fallback for mastery nodes: show all available effects
    const effects = nodeMasteryMap.get(name);
    if (effects && effects.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const allStats = effects.flatMap(eff => eff.stats);
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats: allStats, headerColor });
    }
  };
  const hideTooltip = () => setTooltip(null);

  const ladderMasteries = Array.isArray(data.ladderMasteries)
    ? (data.ladderMasteries as MasteryAlternative[])
    : Array.isArray(data.masteries)  // backwards compat with cached results
      ? (data.masteries as MasteryAlternative[])
      : [];
  const unallocatedMasteries = Array.isArray(data.unallocatedMasteries)
    ? (data.unallocatedMasteries as MasteryAlternative[])
    : [];
  const summary = typeof data.summary === 'string' ? data.summary : '';

  if (ladderMasteries.length === 0 && unallocatedMasteries.length === 0) {
    return (
      <div className="text-sm px-1">
        <span className="text-stone-400 text-xs italic">No mastery alternatives to test.</span>
      </div>
    );
  }

  const isZeroish = (val: number): boolean => Math.abs(val) < 0.05;

  // Group ladder-missing masteries by masteryName
  const grouped = new Map<string, MasteryAlternative[]>();
  for (const m of ladderMasteries) {
    const key = m.masteryName;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(m);
    } else {
      grouped.set(key, [m]);
    }
  }

  // Group unallocated masteries by masteryName
  const unallocatedGrouped = new Map<string, MasteryAlternative[]>();
  for (const m of unallocatedMasteries) {
    const key = m.masteryName;
    const existing = unallocatedGrouped.get(key);
    if (existing) {
      existing.push(m);
    } else {
      unallocatedGrouped.set(key, [m]);
    }
  }

  return (
    <div className="text-sm space-y-2">
      {/* Section 1: Ladder-Popular Masteries (Missing) */}
      {ladderMasteries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <CircleDot className="w-3 h-3 text-violet-400" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-violet-400/90">
                Ladder-Popular Masteries
              </span>
              <span className="text-[0.625rem] text-slate-600">
                ({summary || `${ladderMasteries.length} tested`})
              </span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            {/* Grouped mastery list */}
            <div className="flex flex-col gap-2">
              {[...grouped.entries()].map(([masteryName, alts], gi) => (
                <motion.div
                  key={masteryName}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + gi * 0.05 }}
                  className="space-y-0.5"
                >
                  {/* Group sub-header with mastery icon */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div
                      className={cn(
                        (nodeStatsMap.has(masteryName) || nodeMasteryMap.has(masteryName)) ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, masteryName, 'text-violet-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={masteryName}
                        nodeType={nodeTypeMap.get(masteryName) ?? 'mastery'}
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={20}
                      />
                    </div>
                    <span className="text-[0.625rem] font-display font-medium uppercase tracking-wider text-violet-400/80">
                      {masteryName}
                    </span>
                  </div>

                  {/* Alternatives within this group */}
                  {alts.map((alt, i) => (
                    <div
                      key={`${alt.nodeId}-${alt.effectId}-${i}`}
                      className={cn(
                        'py-2 px-2.5 rounded-md bg-slate-900/40 border-l-2',
                        masteryBorderColor(alt.dpsPct, alt.ehpPct)
                      )}
                    >
                      {/* Row 1: Current stat -> Alternative stat with mastery icon */}
                      <div className="flex items-start gap-1.5 text-xs">
                        <div
                          className={cn(
                            'flex-shrink-0 mt-0.5',
                            (nodeStatsMap.has(masteryName) || nodeMasteryMap.has(masteryName)) ? 'cursor-help' : 'cursor-default'
                          )}
                          onMouseEnter={(e) => showTooltip(e, masteryName, 'text-violet-300')}
                          onMouseLeave={hideTooltip}
                        >
                          <TreeNodeBadge
                            name={masteryName}
                            nodeType="mastery"
                            nodeIconMap={nodeIconMap}
                            spriteConfig={spriteConfig}
                            zoomLevel={zoomLevel}
                            size={18}
                          />
                        </div>
                        <span className="text-stone-300 min-w-0 flex-1 leading-snug">
                          {alt.alternativeStats.replace(/;/g, ' · ')}
                        </span>
                        {/* Point cost badge */}
                        <span className="text-[0.5625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 bg-violet-900/25 text-violet-400/80 border-violet-500/20">
                          {alt.pointCost ?? 1}pt
                        </span>
                      </div>

                      {/* Row 2: DPS + EHP deltas */}
                      <div className="flex items-center gap-3 mt-1.5 font-mono text-xs">
                        <span className={cn('flex items-center gap-0.5', candidateDeltaColor(alt.dpsPct))}>
                          {!isZeroish(alt.dpsPct) && alt.dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                          {!isZeroish(alt.dpsPct) && alt.dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                          {candidateDeltaPrefix(alt.dpsPct)}{alt.dpsPct.toFixed(1)}% DPS
                        </span>
                        <span className={cn('flex items-center gap-0.5', candidateDeltaColor(alt.ehpPct))}>
                          {!isZeroish(alt.ehpPct) && alt.ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                          {!isZeroish(alt.ehpPct) && alt.ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                          {candidateDeltaPrefix(alt.ehpPct)}{alt.ehpPct.toFixed(1)}% EHP
                        </span>
                      </div>

                      {/* Row 3: Extras as colored pills */}
                      {alt.extras.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {alt.extras.map((extra, ei) => {
                            const isNeg = extra.startsWith('-');
                            const isPos = extra.startsWith('+');
                            const pillColor = isNeg
                              ? 'bg-red-500/10 text-red-400'
                              : isPos
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-slate-800/60 text-stone-400';
                            return (
                              <span
                                key={ei}
                                className={cn('text-[0.625rem] px-1.5 py-0.5 rounded italic', pillColor)}
                              >
                                {extra}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Section 2: Masteries unlocked by top notables */}
      {unallocatedMasteries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ladderMasteries.length > 0 ? 0.15 : 0.05 }}
        >
          <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
            <div className="flex items-center gap-2">
              <CircleDot className="w-3 h-3 text-teal-400" />
              <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-teal-400/90">
                Notable-Unlocked Masteries
              </span>
              <span className="text-[0.625rem] text-slate-600">
                ({unallocatedMasteries.length} tested)
              </span>
            </div>
          </div>
          <div className="card-forge rounded-b rounded-t-none px-1 py-1.5">
            <div className="flex flex-col gap-2">
              {[...unallocatedGrouped.entries()].map(([masteryName, alts], gi) => (
                <motion.div
                  key={masteryName}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + gi * 0.05 }}
                  className="space-y-0.5"
                >
                  {/* Group sub-header with mastery icon */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div
                      className={cn(
                        (nodeStatsMap.has(masteryName) || nodeMasteryMap.has(masteryName)) ? 'cursor-help' : 'cursor-default'
                      )}
                      onMouseEnter={(e) => showTooltip(e, masteryName, 'text-teal-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={masteryName}
                        nodeType={nodeTypeMap.get(masteryName) ?? 'mastery'}
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={20}
                      />
                    </div>
                    <span className="text-[0.625rem] font-display font-medium uppercase tracking-wider text-teal-400/80">
                      {masteryName}
                    </span>
                  </div>

                  {/* Unallocated mastery entries */}
                  {alts.map((alt, i) => (
                    <div
                      key={`${alt.nodeId}-${alt.effectId}-${i}`}
                      className={cn(
                        'py-2 px-2.5 rounded-md bg-slate-900/40 border-l-2',
                        masteryBorderColor(alt.dpsPct, alt.ehpPct)
                      )}
                    >
                      {/* Row 1: Effect text with mastery icon + cost badge */}
                      <div className="flex items-start gap-1.5 text-xs">
                        <div
                          className={cn(
                            'flex-shrink-0 mt-0.5',
                            (nodeStatsMap.has(masteryName) || nodeMasteryMap.has(masteryName)) ? 'cursor-help' : 'cursor-default'
                          )}
                          onMouseEnter={(e) => showTooltip(e, masteryName, 'text-teal-300')}
                          onMouseLeave={hideTooltip}
                        >
                          <TreeNodeBadge
                            name={masteryName}
                            nodeType="mastery"
                            nodeIconMap={nodeIconMap}
                            spriteConfig={spriteConfig}
                            zoomLevel={zoomLevel}
                            size={18}
                          />
                        </div>
                        <span className="text-stone-300 min-w-0 flex-1 leading-snug">
                          {alt.alternativeStats.replace(/;/g, ' · ')}
                        </span>
                        {/* Point cost badge */}
                        <span className="text-[0.5625rem] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 bg-violet-900/25 text-violet-400/80 border-violet-500/20">
                          {alt.pointCost ?? 1}pt
                        </span>
                        {/* Source badge for ladder picks */}
                        {alt.source === 'ladder' && (
                          <span className="text-[0.5625rem] px-1 py-0.5 rounded border font-medium flex-shrink-0 bg-cyan-900/20 text-cyan-400/80 border-cyan-500/20" title="Popular on ladder">
                            ladder
                          </span>
                        )}
                      </div>

                      {/* Row 2: DPS + EHP deltas */}
                      <div className="flex items-center gap-3 mt-1.5 font-mono text-xs">
                        <span className={cn('flex items-center gap-0.5', candidateDeltaColor(alt.dpsPct))}>
                          {!isZeroish(alt.dpsPct) && alt.dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
                          {!isZeroish(alt.dpsPct) && alt.dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
                          {candidateDeltaPrefix(alt.dpsPct)}{alt.dpsPct.toFixed(1)}% DPS
                        </span>
                        <span className={cn('flex items-center gap-0.5', candidateDeltaColor(alt.ehpPct))}>
                          {!isZeroish(alt.ehpPct) && alt.ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
                          {!isZeroish(alt.ehpPct) && alt.ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
                          {candidateDeltaPrefix(alt.ehpPct)}{alt.ehpPct.toFixed(1)}% EHP
                        </span>
                      </div>

                      {/* Row 3: Extras as colored pills */}
                      {alt.extras.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {alt.extras.map((extra, ei) => {
                            const isNeg = extra.startsWith('-');
                            const isPos = extra.startsWith('+');
                            const pillColor = isNeg
                              ? 'bg-red-500/10 text-red-400'
                              : isPos
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-slate-800/60 text-stone-400';
                            return (
                              <span
                                key={ei}
                                className={cn('text-[0.625rem] px-1.5 py-0.5 rounded italic', pillColor)}
                              >
                                {extra}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

// =============================================================================
// Gear Analysis Tool Renderers (discover_uniques, get_mod_pool)
// =============================================================================

/**
 * DiscoverUniquesResult - Custom renderer for discover_uniques tool
 *
 * Shows per-slot unique item candidates in a compact 2-column grid with
 * name, base type, level requirement, and key mods.
 */
function DiscoverUniquesResult({ data }: { data: Record<string, unknown> }) {
  const MAX_MODS_SHOWN = 3;

  const slots = (data.slots ?? []) as Array<{
    slot?: string;
    uniques?: Array<{
      name?: string;
      baseType?: string;
      requiresLevel?: number;
      keyMods?: string[];
    }>;
  }>;

  // Filter to slots that actually have uniques
  const slotsWithUniques = slots.filter(s => s.uniques && s.uniques.length > 0);

  if (slotsWithUniques.length === 0) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-sm px-1 space-y-3">
      {slotsWithUniques.map((slot, si) => (
        <div key={si} className="space-y-1.5">
          {/* Slot header */}
          <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
            {slot.slot ?? 'Unknown Slot'}
            <span className="text-stone-500 normal-case tracking-normal font-normal ml-1.5">
              ({slot.uniques?.length ?? 0} unique{(slot.uniques?.length ?? 0) !== 1 ? 's' : ''})
            </span>
          </div>

          {/* Uniques grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {slot.uniques?.map((unique, ui) => {
              const mods = unique.keyMods ?? [];
              const visibleMods = mods.slice(0, MAX_MODS_SHOWN);
              const remainingMods = mods.length - MAX_MODS_SHOWN;

              return (
                <div
                  key={ui}
                  className="py-1.5 px-2 rounded bg-slate-900/40 space-y-0.5"
                >
                  {/* Unique name + level */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-amber-400 flex-1 truncate">
                      {unique.name ?? 'Unknown'}
                    </span>
                    {unique.requiresLevel != null && (
                      <span className="text-[0.625rem] px-1 py-0.5 rounded border bg-slate-800/60 text-stone-400 border-stone-600/30 flex-shrink-0">
                        L{unique.requiresLevel}
                      </span>
                    )}
                  </div>

                  {/* Base type */}
                  {unique.baseType && (
                    <div className="text-[0.6875rem] text-stone-500 truncate">
                      {unique.baseType}
                    </div>
                  )}

                  {/* Key mods */}
                  {visibleMods.length > 0 && (
                    <div className="space-y-0.5 mt-0.5">
                      {visibleMods.map((mod, mi) => (
                        <div key={mi} className="text-[0.625rem] text-stone-400 truncate">
                          {mod}
                        </div>
                      ))}
                      {remainingMods > 0 && (
                        <div className="text-[0.625rem] text-stone-500 italic">
                          +{remainingMods} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Separator between slots */}
          {si < slotsWithUniques.length - 1 && (
            <div className="border-t border-stone-700/50" />
          )}
        </div>
      ))}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

/**
 * GetModPoolResult - Custom renderer for get_mod_pool tool
 *
 * Shows prefixes and suffixes for each slot with mod group names,
 * stat text, and tier badges (T1 gold, T2 silver, T3+ gray) with value ranges.
 */
function GetModPoolResult({ data }: { data: Record<string, unknown> }) {
  const MAX_MODS_SHOWN = 8;

  const slots = (data.slots ?? []) as Array<{
    slot?: string;
    baseName?: string;
    itemClass?: string;
    recommendedBases?: Array<{
      name?: string;
      defenseType?: string;
      dropLevel?: number;
    }>;
    prefixes?: Array<{
      group?: string;
      stat?: string;
      statId?: string;
      displayText?: string;
      tiers?: Array<{ tier?: number; range?: string; requiredLevel?: number }>;
    }>;
    suffixes?: Array<{
      group?: string;
      stat?: string;
      statId?: string;
      displayText?: string;
      tiers?: Array<{ tier?: number; range?: string; requiredLevel?: number }>;
    }>;
  }>;

  if (slots.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Tier badge color: T1 amber/gold, T2 slate-light, T3+ dim */
  const tierBadgeClass = (tier: number): string => {
    if (tier === 1) return 'bg-amber-900/30 text-amber-300 border-amber-500/30';
    if (tier <= 3) return 'bg-slate-800/60 text-stone-300 border-stone-600/30';
    return 'bg-slate-800/40 text-stone-500 border-stone-700/30';
  };

  const renderModSection = (
    mods: Array<{
      group?: string;
      stat?: string;
      statId?: string;
      displayText?: string;
      tiers?: Array<{ tier?: number; range?: string; requiredLevel?: number }>;
    }>,
    accentColor: string,
    label: string
  ) => {
    if (mods.length === 0) return null;
    const visible = mods.slice(0, MAX_MODS_SHOWN);
    const remaining = mods.length - MAX_MODS_SHOWN;

    return (
      <div className="space-y-1">
        <div className={cn('text-xs uppercase tracking-wide font-medium', accentColor)}>
          {label} ({mods.length})
        </div>
        <div className="space-y-1">
          {visible.map((mod, i) => {
            const tiers = mod.tiers ?? [];
            const bestTier = tiers[0];
            return (
              <div key={i} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded bg-slate-900/30">
                <span className="text-xs text-blue-400 truncate">
                  {mod.displayText ?? mod.stat ?? mod.group ?? 'Unknown'}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {bestTier && (
                    <span className={cn(
                      'text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums',
                      tierBadgeClass(bestTier.tier ?? 99)
                    )}>
                      T{bestTier.tier ?? '?'}
                    </span>
                  )}
                  {tiers.length > 1 && (
                    <span className="text-[0.625rem] text-stone-500 font-mono">
                      +{tiers.length - 1}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {remaining > 0 && (
            <div className="text-[0.6875rem] text-stone-500 italic">
              (+{remaining} more)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="text-sm px-1 space-y-3">
      {slots.map((slot, si) => (
        <div key={si} className="space-y-2">
          {/* Slot header with base name */}
          <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">
            {slot.slot ?? 'Unknown Slot'}
            {slot.baseName && (
              <span className="text-stone-400 normal-case tracking-normal font-normal ml-1.5">
                ({slot.baseName})
              </span>
            )}
            {slot.itemClass && (
              <span className="text-stone-500 normal-case tracking-normal font-normal ml-1">
                {'\u2014'} {slot.itemClass}
              </span>
            )}
          </div>

          {/* Recommended bases (when includeBases: true) */}
          {slot.recommendedBases && slot.recommendedBases.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-stone-400/80 uppercase tracking-wide font-medium">
                Recommended Bases
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slot.recommendedBases.map((base, bi) => (
                  <span
                    key={bi}
                    className="text-[0.625rem] px-1.5 py-0.5 rounded border bg-slate-800/60 text-stone-300 border-stone-600/30 font-mono"
                  >
                    {base.name ?? 'Unknown'}
                    {base.defenseType && (
                      <span className="text-stone-500 ml-1">{base.defenseType}</span>
                    )}
                    {base.dropLevel != null && (
                      <span className="text-stone-500 ml-1">{'\u2022'} ilvl {base.dropLevel}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prefixes + Suffixes side by side */}
          <div className="grid grid-cols-2 gap-3">
            {renderModSection(slot.prefixes ?? [], 'text-amber-400/80', 'Prefixes')}
            {renderModSection(slot.suffixes ?? [], 'text-blue-400/80', 'Suffixes')}
          </div>

          {/* Separator between slots */}
          {si < slots.length - 1 && (
            <div className="border-t border-stone-700/50" />
          )}
        </div>
      ))}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Detect Build Config
// =============================================================================

/** Map camelCase config keys to human-readable labels */
const CONFIG_LABELS: Record<string, string> = {
  usePowerCharges: 'Power Charges',
  useFrenzyCharges: 'Frenzy Charges',
  useEnduranceCharges: 'Endurance Charges',
  conditionUsingFlask: 'Flask Uptime',
  enemyIsShocked: 'Enemy Shocked',
  enemyIsChilled: 'Enemy Chilled',
  enemyIsIgnited: 'Enemy Ignited',
  enemyIsFrozen: 'Enemy Frozen',
  buffOnslaught: 'Onslaught',
  buffUnholyMight: 'Unholy Might',
  buffPhasing: 'Phasing',
  conditionFocused: 'Focused',
  conditionLeeching: 'Leeching',
  conditionFullLife: 'Full Life',
  conditionLowLife: 'Low Life',
  conditionEnemyIntimidated: 'Intimidated',
  conditionEnemyUnnerved: 'Unnerved',
  conditionEnemyCoveredInAsh: 'Covered in Ash',
  conditionEnemyCoveredInFrost: 'Covered in Frost',
  enemyIsCrushed: 'Crushed',
  enemyIsBlinded: 'Blinded',
  conditionEnemyMaimed: 'Maimed',
  conditionEnemyBleeding: 'Bleeding',
  conditionEnemyPoisoned: 'Poisoned',
  conditionEnemyHindered: 'Hindered',
  conditionEnemyBurning: 'Burning',
  conditionEnemyFireExposure: 'Fire Exposure',
  conditionEnemyColdExposure: 'Cold Exposure',
  conditionEnemyLightningExposure: 'Lightning Exposure',
  conditionEnemyScorched: 'Scorched',
  conditionEnemyBrittle: 'Brittle',
  conditionEnemySapped: 'Sapped',
  multiplierWitheredStackCount: 'Wither Stacks',
  conditionShockEffect: 'Shock Effect',
  conditionEnemyChilledEffect: 'Chill Effect',
  conditionScorchedEffect: 'Scorch Effect',
  conditionBrittleEffect: 'Brittle Effect',
  conditionSapEffect: 'Sap Effect',
  multiplierPoisonOnEnemy: 'Poison Stacks',
  buffFortification: 'Fortification',
  buffTailwind: 'Tailwind',
  buffAdrenaline: 'Adrenaline',
};

/** Readable label for a source group */
const SOURCE_LABELS: Record<string, string> = {
  ascendancy: 'From Ascendancy',
  skill: 'From Skills',
  item: 'From Items',
  tree: 'From Tree',
  default: 'Default Assumptions',
};

function readableConfigLabel(key: string): string {
  if (CONFIG_LABELS[key]) return CONFIG_LABELS[key];
  // Fallback: strip "use"/"condition"/"enemy"/"buff" prefix and add spaces before capitals
  return key
    .replace(/^(use|condition|enemy|buff)/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^Is\s/, '')
    .trim();
}

function DetectBuildConfigResult({ data }: { data: Record<string, unknown> }) {
  const reasoning = (data.reasoning ?? []) as Array<{
    setting: string;
    value: boolean;
    reason: string;
    source: string;
  }>;
  const warnings = (data.warnings ?? []) as string[];

  if (reasoning.length === 0) {
    return (
      <div className="text-sm px-1">
        <span className="text-stone-400 text-xs italic">No config changes detected.</span>
      </div>
    );
  }

  // Group reasoning entries by source
  const grouped = new Map<string, typeof reasoning>();
  for (const entry of reasoning) {
    const key = entry.source ?? 'default';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  // Order: ascendancy, skill, item, tree, default, then any others
  const sourceOrder = ['ascendancy', 'skill', 'item', 'tree', 'default'];
  const sortedSources = [...grouped.keys()].sort((a, b) => {
    const ai = sourceOrder.indexOf(a);
    const bi = sourceOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="text-sm px-1 space-y-2">
      {/* Grouped config settings */}
      {sortedSources.map((source) => {
        const entries = grouped.get(source)!;
        const label = SOURCE_LABELS[source] ?? source.charAt(0).toUpperCase() + source.slice(1);

        return (
          <div key={source} className="space-y-0.5">
            <div className="text-[0.625rem] text-stone-500 uppercase tracking-wider font-medium">
              {label}
            </div>
            {entries.map((entry, i) => (
              <div key={i} className="flex items-baseline gap-2 pl-1">
                <span className={cn(
                  'text-xs font-medium',
                  entry.value ? 'text-emerald-400' : 'text-stone-500',
                )}>
                  {entry.value ? '\u2713' : '\u2717'} {readableConfigLabel(entry.setting)}
                </span>
                <span className="text-[0.6875rem] text-stone-500 leading-tight">
                  {entry.reason}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-0.5 pt-0.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400/90">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// GemPricingResult - Custom renderer for price_skill_gems tool
//
// Shows gem prices across all level/quality variants with trade links.
// Fully transparent: every variant row is shown so users can compare prices
// at different gem levels without relying on the LLM to summarize.
// =============================================================================

/** Fallback divine rate if backend doesn't provide one */
const DIVINE_VALUE_CHAOS_FALLBACK = 200;

interface GemVariant {
  level?: number;
  quality?: number;
  corrupted?: boolean;
  avgPrice?: number;
  avgPriceDivine?: number | null;
  medianPrice?: number;
  minPrice?: number;
  primaryCurrency?: 'chaos' | 'divine';
  listings?: number;
  tradeUrl?: string;
}

interface GemPricingEntry {
  gem?: string;
  vendorAvailable?: boolean;
  variants?: GemVariant[];
  error?: string;
}

function formatGemPrice(v: GemVariant, divineRate: number): string {
  const chaos = v.avgPrice ?? 0;
  // Use divine as primary when listings are in divine
  if (v.primaryCurrency === 'divine' && v.avgPriceDivine != null) {
    return `${v.avgPriceDivine} div (~${formatNumber(Math.round(chaos))}c)`;
  }
  // Chaos-listed but expensive enough for divine equivalent
  if (v.avgPriceDivine != null && v.avgPriceDivine >= 1) {
    return `${formatNumber(Math.round(chaos))}c (~${v.avgPriceDivine} div)`;
  }
  return `${formatNumber(Math.round(chaos))}c`;
}

function GemPricingResult({ data }: { data: Record<string, unknown> }) {
  const results = (data.results ?? []) as GemPricingEntry[];
  const summary = data.summary as string | undefined;
  const topError = data.error as string | undefined;
  const divineRate = (data.divineRate as number | null) ?? DIVINE_VALUE_CHAOS_FALLBACK;

  if (results.length === 0 && !topError) {
    return <DefaultResult data={data} />;
  }

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Top-level error */}
      {topError && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      {results.map((entry, gi) => {
        const variants = entry.variants ?? [];
        const hasError = Boolean(entry.error);

        return (
          <div key={gi} className="space-y-1.5">
            {/* Gem header */}
            <div className="flex items-center gap-2">
              <Gem className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
              <span className="text-xs text-amber-400/80 uppercase tracking-wide font-medium truncate">
                {entry.gem ?? 'Unknown Gem'}
              </span>
              {entry.vendorAvailable && (
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                  Vendor available
                </span>
              )}
            </div>

            {/* Error state */}
            {hasError && (
              <div className="flex items-start gap-1.5 text-xs text-red-400 ml-5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{entry.error}</span>
              </div>
            )}

            {/* No listings state */}
            {!hasError && !entry.vendorAvailable && variants.length === 0 && (
              <div className="text-xs text-stone-500 ml-5 italic">
                No listings found on trade
              </div>
            )}

            {/* Variant table */}
            {variants.length > 0 && (
              <div className="ml-1 rounded overflow-hidden border border-stone-700/30">
                {/* Table header */}
                <div className="grid grid-cols-[3rem_3rem_1fr_4.5rem_4.5rem_3.5rem_2rem] gap-x-2 px-2 py-1 bg-slate-800/40 text-[0.625rem] text-stone-500 uppercase tracking-wider font-medium">
                  <span>Lvl</span>
                  <span>Qual</span>
                  <span>Avg Price</span>
                  <span>Median</span>
                  <span>Min</span>
                  <span>Listed</span>
                  <span />
                </div>

                {/* Variant rows */}
                {variants.map((v, vi) => (
                  <div
                    key={vi}
                    className={cn(
                      'grid grid-cols-[3rem_3rem_1fr_4.5rem_4.5rem_3.5rem_2rem] gap-x-2 px-2 py-1 text-xs font-mono',
                      'border-t border-stone-700/20',
                      vi % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10',
                      'hover:bg-slate-800/40 transition-colors'
                    )}
                  >
                    {/* Level */}
                    <span className="text-stone-300">
                      {v.level ?? '?'}
                      {v.corrupted && (
                        <span className="text-red-400 ml-0.5" title="Corrupted">*</span>
                      )}
                    </span>

                    {/* Quality */}
                    <span className="text-stone-400">
                      {v.quality != null ? `${v.quality}%` : '-'}
                    </span>

                    {/* Avg Price - primary column, prominent */}
                    <span className="text-amber-300 font-semibold">
                      {v.avgPrice != null ? formatGemPrice(v, divineRate) : '-'}
                    </span>

                    {/* Median */}
                    <span className="text-stone-400">
                      {v.medianPrice != null ? `${formatNumber(Math.round(v.medianPrice))}c` : '-'}
                    </span>

                    {/* Min */}
                    <span className="text-stone-500">
                      {v.minPrice != null ? `${formatNumber(Math.round(v.minPrice))}c` : '-'}
                    </span>

                    {/* Listings count */}
                    <span className="text-stone-500">
                      {v.listings != null ? formatCompactNumber(v.listings) : '-'}
                    </span>

                    {/* Trade link */}
                    {v.tradeUrl ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openExternal(v.tradeUrl!);
                        }}
                        className="flex items-center justify-center text-teal-400 hover:text-teal-300 transition-colors"
                        title="Open on Trade Site"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      {summary && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
          {stripToolTags(summary)}
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

function ConfigureCombatResult({ data }: { data: Record<string, unknown> }) {
  // Detect format: new format has hasSource (or legacy baselineEnabled), old format has configDeltas
  const isNewFormat = Array.isArray(data.hasSource) || Array.isArray(data.baselineEnabled);

  if (isNewFormat) {
    return <ConfigureCombatResultNew data={data} />;
  }
  return <ConfigureCombatResultLegacy data={data} />;
}

// ---------------------------------------------------------------------------
// New format (config-preflight): hasSource, alreadyActive, highImpactAvailable, lowImpact
// ---------------------------------------------------------------------------

interface PreflightDelta {
  key: string;
  label?: string;
  reason?: string;
  category?: string;
  testValue?: boolean | number;
  realisticValue?: number;
  dpsDelta?: number;
  dpsPercent: number;
  ehpDelta?: number;
  ehpPercent?: number;
}

interface AlreadyActiveEntry {
  key: string;
  label?: string;
  reason?: string;
}

interface LowImpactEntry {
  key: string;
  label?: string;
  dpsPercent: number;
}

function ConfigureCombatResultNew({ data }: { data: Record<string, unknown> }) {
  const l1Config = (data.l1Config ?? []) as Array<{
    setting: string;
    value: boolean | number | string;
    reason: string;
    source: string;
  }>;
  // Support both new (hasSource) and legacy (baselineEnabled) field names
  const hasSourceItems = (data.hasSource ?? data.baselineEnabled ?? []) as PreflightDelta[];
  const alreadyActive = (data.alreadyActive ?? []) as AlreadyActiveEntry[];
  const highImpactAvailable = (data.highImpactAvailable ?? []) as PreflightDelta[];
  const lowImpact = (data.lowImpact ?? []) as LowImpactEntry[];

  const COMBAT_SOURCE_LABELS: Record<string, string> = {
    ascendancy: 'Ascendancy',
    skill: 'Skills',
    aura: 'Auras',
    keystone: 'Keystones',
    item: 'Equipment',
    default: 'Mapping Defaults',
    content_tier: 'Content Tier',
  };

  // Group L1 entries by source (only active ones)
  const activeL1 = l1Config.filter(r => r.value);
  const l1BySource = new Map<string, typeof activeL1>();
  for (const entry of activeL1) {
    const group = l1BySource.get(entry.source) ?? [];
    group.push(entry);
    l1BySource.set(entry.source, group);
  }

  // DPS formatting helper
  function formatDps(value: number): string {
    const abs = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    if (abs < 10 && abs > 0) return `${sign}${abs.toFixed(1)}`;
    return `${sign}${abs.toFixed(0)}`;
  }

  function configLabelWithValue(key: string, testValue?: boolean | number): string {
    const label = readableConfigLabel(key);
    if (typeof testValue === 'number') return `${label} \u00d7${testValue}`;
    return label;
  }

  // Sort impact items by combined DPS + EHP percent descending (so EHP-only configs don't sink)
  const combinedImpact = (d: PreflightDelta) =>
    Math.abs(d.dpsPercent) + Math.abs(d.ehpPercent ?? 0);
  const sortedHasSource = [...hasSourceItems].sort(
    (a, b) => combinedImpact(b) - combinedImpact(a),
  );
  const sortedHighImpact = [...highImpactAvailable].sort(
    (a, b) => combinedImpact(b) - combinedImpact(a),
  );

  const allDeltas = [...sortedHasSource, ...sortedHighImpact];
  const maxDpsPercent = Math.max(
    ...allDeltas.map(d => Math.abs(d.dpsPercent)),
    1,
  );
  const maxEhpPercent = Math.max(
    ...allDeltas.map(d => Math.abs(d.ehpPercent ?? 0)),
    1,
  );

  const hasImpactData = hasSourceItems.length > 0 || highImpactAvailable.length > 0;

  return (
    <div className="text-sm space-y-3">
      {/* A) Active Baseline — L1 pills grouped by source */}
      {l1BySource.size > 0 && (
        <div className="space-y-1.5">
          {[...l1BySource.entries()].map(([source, entries]) => (
            <div key={source} className="flex items-start gap-2">
              <span className="text-[0.625rem] text-stone-500/80 uppercase tracking-wider font-medium w-[85px] flex-shrink-0 pt-0.5 text-right">
                {COMBAT_SOURCE_LABELS[source] ?? source}
              </span>
              <div className="flex flex-wrap gap-1">
                {entries.map((entry) => (
                  <span
                    key={entry.setting}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] border bg-emerald-500/10 border-emerald-500/20 text-emerald-400/90"
                    title={entry.reason}
                  >
                    <span className="opacity-60">{'\u2713'}</span>
                    {readableConfigLabel(entry.setting)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* B) Config Impact — baseline enabled + high impact available */}
      {hasImpactData && (
        <div className="space-y-2.5 border-t border-stone-700/20 pt-2.5">
          {/* Has Source — build can sustain this (not auto-applied, agent uses testConfig) */}
          {sortedHasSource.length > 0 && (
            <div className="space-y-2">
              <div className="text-[0.625rem] text-stone-500/80 uppercase tracking-wider font-medium">
                Config Impact
              </div>
              {sortedHasSource.map((delta) => {
                const dpsBarWidth = maxDpsPercent > 0
                  ? Math.min(100, (Math.abs(delta.dpsPercent) / maxDpsPercent) * 100)
                  : 0;
                const dpsBarColor = Math.abs(delta.dpsPercent) > 20
                  ? 'bg-emerald-500/40'
                  : Math.abs(delta.dpsPercent) > 5
                    ? 'bg-emerald-500/25'
                    : 'bg-emerald-500/15';
                const ehpPct = Math.abs(delta.ehpPercent ?? 0);
                const ehpBarWidth = maxEhpPercent > 0
                  ? Math.min(100, (ehpPct / maxEhpPercent) * 100)
                  : 0;
                const ehpBarColor = ehpPct > 20
                  ? 'bg-sky-500/40'
                  : ehpPct > 5
                    ? 'bg-sky-500/25'
                    : 'bg-sky-500/15';

                const showDps = Math.abs(delta.dpsPercent) > 0.1;
                const showEhp = ehpPct > 0.5;
                const hasMeasuredEhp = typeof delta.ehpDelta === 'number' && Number.isFinite(delta.ehpDelta);
                const isEhpLeading = showEhp && (!showDps || ehpPct > Math.abs(delta.dpsPercent));
                const rawNote = delta.label ?? delta.reason;
                const noteParts = rawNote?.split('|').map(part => part.trim()).filter(Boolean) ?? [];
                const primaryNote = noteParts[0];
                const referenceNote = noteParts.slice(1).join(' | ');

                // Show realistic value if different from test value
                const displayValue = delta.realisticValue != null && delta.realisticValue !== delta.testValue
                  ? delta.realisticValue
                  : delta.testValue;

                // Icon color: sky for EHP-only, emerald for DPS-impacting
                const iconColor = showDps ? 'text-emerald-400/70' : 'text-sky-400/70';

                return (
                  <div
                    key={delta.key}
                    className={cn(
                      'space-y-1 rounded border px-2 py-1.5',
                      isEhpLeading ? 'border-sky-500/20 bg-sky-500/[0.04]' : 'border-transparent',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[0.6875rem] text-stone-300 font-medium pt-0.5">
                        <span className={cn(iconColor, 'mr-1')}>{'\u2713'}</span>
                        {configLabelWithValue(delta.key, displayValue)}
                      </span>
                      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                        {showDps && (
                          <div className="flex items-baseline gap-1.5">
                            {delta.dpsDelta != null && (
                              <span className="text-[0.6875rem] text-emerald-400 font-semibold tabular-nums">
                                {formatDps(delta.dpsDelta)}
                              </span>
                            )}
                            <span className="text-[0.625rem] text-emerald-400/40 tabular-nums">
                              {delta.dpsPercent > 0 ? '+' : ''}{delta.dpsPercent.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {showEhp && (
                          <div className="flex items-baseline gap-1.5">
                            {hasMeasuredEhp && (
                              <span className="text-[0.6875rem] text-sky-400 font-semibold tabular-nums">
                                {formatDps(delta.ehpDelta!)}
                              </span>
                            )}
                            <span className="text-[0.625rem] text-sky-400/40 tabular-nums">
                              {(delta.ehpPercent ?? 0) > 0 ? '+' : ''}{(delta.ehpPercent ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Dual bars with metric labels */}
                    <div className="space-y-0.5">
                      {showDps && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.5rem] text-emerald-500/40 uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium">dps</span>
                          <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                            <div
                              className={cn('h-full rounded-full transition-all', dpsBarColor)}
                              style={{ width: `${dpsBarWidth}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {showEhp && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.5rem] text-sky-500/40 uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium">ehp</span>
                          <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                            <div
                              className={cn('h-full rounded-full transition-all', ehpBarColor)}
                              style={{ width: `${ehpBarWidth}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {rawNote && (
                      <div className="text-[0.625rem] text-stone-500/60 leading-snug">
                        {primaryNote}
                        {referenceNote && (
                          <span className="text-sky-400/50 ml-1.5">Ref: {referenceNote}</span>
                        )}
                        {delta.realisticValue != null && delta.realisticValue !== delta.testValue && (
                          <span className="text-stone-500/40"> (tested at {delta.testValue})</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* High impact available (amber — not yet applied, biggest levers) */}
          {sortedHighImpact.length > 0 && (
            <div className="space-y-2">
              <div className="text-[0.625rem] text-amber-400/70 uppercase tracking-wider font-medium">
                Available (Not Applied)
              </div>
              {sortedHighImpact.map((delta) => {
                const dpsBarWidth = maxDpsPercent > 0
                  ? Math.min(100, (Math.abs(delta.dpsPercent) / maxDpsPercent) * 100)
                  : 0;
                const ehpPct = Math.abs(delta.ehpPercent ?? 0);
                const ehpBarWidth = maxEhpPercent > 0
                  ? Math.min(100, (ehpPct / maxEhpPercent) * 100)
                  : 0;

                const showDps = Math.abs(delta.dpsPercent) > 0.1;
                const showEhp = ehpPct > 0.5;
                const hasMeasuredEhp = typeof delta.ehpDelta === 'number' && Number.isFinite(delta.ehpDelta);
                const isEhpLeading = showEhp && (!showDps || ehpPct > Math.abs(delta.dpsPercent));
                const rawNote = delta.label ?? delta.reason;
                const noteParts = rawNote?.split('|').map(part => part.trim()).filter(Boolean) ?? [];
                const primaryNote = noteParts[0];
                const referenceNote = noteParts.slice(1).join(' | ');

                // Icon color: sky for EHP-only, amber for DPS-impacting
                const iconColor = showDps ? 'text-amber-400/70' : 'text-sky-400/70';

                return (
                  <div
                    key={delta.key}
                    className={cn(
                      'space-y-1 rounded border px-2 py-1.5',
                      isEhpLeading ? 'border-sky-500/20 bg-sky-500/[0.04]' : 'border-transparent',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[0.6875rem] text-stone-300 font-medium pt-0.5">
                        <span className={cn(iconColor, 'mr-1')}>{'\u25c7'}</span>
                        {configLabelWithValue(delta.key, delta.testValue)}
                      </span>
                      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                        {showDps && (
                          <div className="flex items-baseline gap-1.5">
                            {delta.dpsDelta != null && (
                              <span className="text-[0.6875rem] text-amber-400 font-semibold tabular-nums">
                                {formatDps(delta.dpsDelta)}
                              </span>
                            )}
                            <span className="text-[0.625rem] text-amber-400/40 tabular-nums">
                              {delta.dpsPercent > 0 ? '+' : ''}{delta.dpsPercent.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {showEhp && (
                          <div className="flex items-baseline gap-1.5">
                            {hasMeasuredEhp && (
                              <span className="text-[0.6875rem] text-sky-400 font-semibold tabular-nums">
                                {formatDps(delta.ehpDelta!)}
                              </span>
                            )}
                            <span className="text-[0.625rem] text-sky-400/40 tabular-nums">
                              {(delta.ehpPercent ?? 0) > 0 ? '+' : ''}{(delta.ehpPercent ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Dual bars with metric labels */}
                    <div className="space-y-0.5">
                      {showDps && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.5rem] text-amber-500/40 uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium">dps</span>
                          <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                            <div
                              className="h-full rounded-full transition-all bg-amber-500/30"
                              style={{ width: `${dpsBarWidth}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {showEhp && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.5rem] text-sky-500/40 uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium">ehp</span>
                          <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                            <div
                              className="h-full rounded-full transition-all bg-sky-500/25"
                              style={{ width: `${ehpBarWidth}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {rawNote && (
                      <div className="text-[0.625rem] text-stone-500/60 leading-snug">
                        {primaryNote}
                        {referenceNote && (
                          <span className="text-sky-400/50 ml-1.5">Ref: {referenceNote}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* C) Already Active */}
      {alreadyActive.length > 0 && (
        <div className="space-y-1 border-t border-stone-700/20 pt-2.5">
          <div className="text-[0.625rem] text-stone-600/60 uppercase tracking-wider font-medium">
            Already Active
          </div>
          {alreadyActive.map((entry) => (
            <div key={entry.key} className="text-[0.6875rem] text-stone-500/50 leading-snug pl-1">
              <span className="text-stone-600/50 mr-1.5">{'\u25cb'}</span>
              {readableConfigLabel(entry.key)}
              {(entry.label ?? entry.reason) && (
                <span className="text-stone-600/40 ml-1">-- {entry.label ?? entry.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* D) Low Impact (compact, collapsible-style) */}
      {lowImpact.length > 0 && (
        <div className="border-t border-stone-700/20 pt-2">
          <div className="text-[0.625rem] text-stone-600/40">
            {lowImpact.length} low-impact config{lowImpact.length > 1 ? 's' : ''} skipped
            <span className="text-stone-700/40 ml-1">
              ({lowImpact.map(d => d.label ?? readableConfigLabel(d.key)).join(', ')})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy format (config-micro-agent): configDeltas, overrides, l3Guidance
// ---------------------------------------------------------------------------

function ConfigureCombatResultLegacy({ data }: { data: Record<string, unknown> }) {
  const reasoning = data.reasoning as string | undefined;
  const overrides = data.overrides as Record<string, unknown> | undefined;
  const l3Guidance = data.l3Guidance as Record<string, string[]> | undefined;
  const l1Config = (data.l1Config ?? []) as Array<{
    setting: string;
    value: boolean | number | string;
    reason: string;
    source: string;
  }>;
  const configDeltas = (data.configDeltas ?? []) as Array<{
    key: string;
    reason: string;
    category: 'ailment' | 'exposure' | 'debuff' | 'effect';
    testValue: boolean | number;
    dpsDelta: number;
    dpsPercent: number;
    alreadyActive: boolean;
    significant: boolean;
  }>;

  const overrideEntries = overrides ? Object.entries(overrides) : [];
  const hasOverrides = overrideEntries.length > 0;
  const overrideKeys = new Set(overrideEntries.map(([k]) => k));

  // Group L1 entries by source, excluding any overridden by L2
  const activeL1 = l1Config.filter(r => r.value && !overrideKeys.has(r.setting));
  const l1BySource = new Map<string, typeof activeL1>();
  for (const entry of activeL1) {
    const group = l1BySource.get(entry.source) ?? [];
    group.push(entry);
    l1BySource.set(entry.source, group);
  }

  const COMBAT_SOURCE_LABELS: Record<string, string> = {
    ascendancy: 'Ascendancy',
    skill: 'Skills',
    aura: 'Auras',
    keystone: 'Keystones',
    item: 'Equipment',
    default: 'Mapping Defaults',
    content_tier: 'Content Tier',
    L2: 'Corrections',
  };

  // Build pathway hint entries
  const PATHWAY_LABELS: Record<string, string> = { gear: 'Gear', skills: 'Skills', tree: 'Tree' };
  const PATHWAY_COLORS: Record<string, string> = {
    gear: 'text-amber-400/70',
    skills: 'text-blue-400/70',
    tree: 'text-emerald-400/70',
  };
  const pathwayHints = l3Guidance
    ? Object.entries(l3Guidance)
        .filter(([, hints]) => hints.length > 0)
        .map(([pw, hints]) => ({ pathway: pw, label: PATHWAY_LABELS[pw] ?? pw, hints }))
    : [];

  const error = data.error as string | undefined;

  // DPS formatting helper
  function formatDps(value: number): string {
    const abs = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return `${sign}${abs.toFixed(0)}`;
  }

  // Config label with numeric value inline
  function configLabelWithValue(key: string, testValue: boolean | number): string {
    const label = readableConfigLabel(key);
    if (typeof testValue === 'number') return `${label} \u00d7${testValue}`;
    return label;
  }

  // Split configDeltas into significant vs already-active
  const significantDeltas = configDeltas
    .filter(d => d.significant && !d.alreadyActive)
    .sort((a, b) => Math.abs(b.dpsDelta) - Math.abs(a.dpsDelta));
  const alreadyActiveDeltas = configDeltas.filter(d => d.alreadyActive);
  const maxDpsPercent = significantDeltas.length > 0
    ? Math.max(...significantDeltas.map(d => Math.abs(d.dpsPercent)))
    : 1;
  const hasConfigDeltas = configDeltas.length > 0;

  // Merge L1 + L2 overrides into unified pill groups
  const allSourceGroups: Array<{ source: string; pills: Array<{ key: string; value: boolean | number | string; reason: string }> }> = [];
  for (const [source, entries] of l1BySource) {
    allSourceGroups.push({
      source,
      pills: entries.map(e => ({ key: e.setting, value: e.value, reason: e.reason })),
    });
  }
  if (hasOverrides) {
    allSourceGroups.push({
      source: 'L2',
      pills: overrideEntries.map(([key, val]) => ({
        key,
        value: val as boolean | number | string,
        reason: reasoning ?? '',
      })),
    });
  }

  return (
    <div className="text-sm space-y-3">
      {/* A) Error warning */}
      {error && (
        <div className="flex items-start gap-2 rounded bg-amber-500/8 border border-amber-500/20 px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[0.6875rem] text-amber-300">{error}</div>
            <div className="text-[0.625rem] text-stone-500 mt-0.5">Using deterministic config only</div>
          </div>
        </div>
      )}

      {/* B) Active Baseline — unified L1 + L2 pills grouped by source */}
      {allSourceGroups.length > 0 && (
        <div className="space-y-1.5">
          {allSourceGroups.map(({ source, pills }) => (
            <div key={source} className="flex items-start gap-2">
              <span className="text-[0.625rem] text-stone-500/80 uppercase tracking-wider font-medium w-[85px] flex-shrink-0 pt-0.5 text-right">
                {COMBAT_SOURCE_LABELS[source] ?? source}
              </span>
              <div className="flex flex-wrap gap-1">
                {pills.map((pill) => {
                  const isEnabled = Boolean(pill.value);
                  const isL2 = source === 'L2';
                  return (
                    <span
                      key={pill.key}
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] border',
                        isL2 && !isEnabled
                          ? 'bg-red-500/10 border-red-500/20 text-red-400/80'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/90',
                      )}
                      title={pill.reason}
                    >
                      <span className="opacity-60">{isEnabled ? '\u2713' : '\u2717'}</span>
                      {readableConfigLabel(pill.key)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}

          {/* L2 reasoning note */}
          {hasOverrides && reasoning && reasoning !== 'No changes needed' && (
            <div className="text-[0.6875rem] text-stone-400 leading-snug pl-[93px]">
              {reasoning}
            </div>
          )}

          {/* No corrections note */}
          {!hasOverrides && !hasConfigDeltas && (
            <div className="text-[0.6875rem] text-stone-500/70 italic pl-[93px]">
              No additional corrections -- L1 config verified.
            </div>
          )}
        </div>
      )}

      {/* C) Config Impact (Measured) */}
      {hasConfigDeltas && (
        <div className="space-y-2.5 border-t border-stone-700/20 pt-2.5">
          <div className="text-[0.625rem] text-stone-500/80 uppercase tracking-wider font-medium">
            Config Impact
          </div>

          {/* Significant deltas */}
          {significantDeltas.length > 0 && (
            <div className="space-y-2">
              {significantDeltas.map((delta) => {
                const barWidth = maxDpsPercent > 0
                  ? Math.min(100, (Math.abs(delta.dpsPercent) / maxDpsPercent) * 100)
                  : 0;
                const barColor = Math.abs(delta.dpsPercent) > 20
                  ? 'bg-emerald-500/40'
                  : Math.abs(delta.dpsPercent) > 5
                    ? 'bg-emerald-500/25'
                    : 'bg-emerald-500/15';

                return (
                  <div key={delta.key} className="space-y-1">
                    {/* Label row */}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[0.6875rem] text-stone-300 font-medium">
                        {configLabelWithValue(delta.key, delta.testValue)}
                      </span>
                      <div className="flex items-baseline gap-2 flex-shrink-0">
                        <span className="text-[0.6875rem] text-emerald-400 font-semibold tabular-nums">
                          {formatDps(delta.dpsDelta)}
                        </span>
                        <span className="text-[0.625rem] text-stone-500 tabular-nums">
                          {delta.dpsPercent > 0 ? '+' : ''}{delta.dpsPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Impact bar */}
                    <div className="h-1 rounded-full bg-slate-800/60 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor)}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Reason text */}
                    {delta.reason && (
                      <div className="text-[0.625rem] text-stone-500/60 leading-snug">
                        {delta.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Already active entries */}
          {alreadyActiveDeltas.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-[0.625rem] text-stone-600/60 uppercase tracking-wider font-medium">
                Already Active
              </div>
              {alreadyActiveDeltas.map((delta) => (
                <div key={delta.key} className="text-[0.6875rem] text-stone-500/50 leading-snug pl-1">
                  <span className="text-stone-600/50 mr-1.5">{'\u25cb'}</span>
                  {readableConfigLabel(delta.key)}
                  <span className="text-stone-600/40 ml-1">-- PoB auto-detects from skills</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* D) Config notes for pathway agents */}
      {pathwayHints.length > 0 && (
        <div className="space-y-2 border-t border-stone-700/20 pt-2.5">
          <div className="text-[0.625rem] text-stone-500/80 uppercase tracking-wider font-medium">
            Config Notes
          </div>
          {pathwayHints.map(({ pathway, label, hints }) => (
            <div key={pathway} className="space-y-1">
              <div className={cn('text-[0.6875rem] font-medium', PATHWAY_COLORS[pathway] ?? 'text-stone-400')}>
                {label}
              </div>
              {hints.map((hint, i) => {
                const text = typeof hint === 'string' ? hint : (hint as Record<string, unknown>).hint as string ?? JSON.stringify(hint);
                return (
                  <div key={i} className="flex items-start gap-1.5 text-[0.6875rem] text-stone-500/80 leading-snug pl-2">
                    <span className="text-stone-600 mt-px">{'\u203a'}</span>
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PriceGearPackagesResult — renders pricing results for gear package search
// =============================================================================

interface PriceGearPackageSearchHistory {
  iterations: Array<{
    step: number;
    minValues: Record<string, number>;
    resultCount: number;
    cheapestPrice: number;
    budgetUtilization: number;
  }>;
  finalIteration: number;
  startedAt: Record<string, number>;
  convergedAt: Record<string, number>;
  tierAchieved: Record<string, string>;
  stopReason: 'budget_reached' | 'market_scarcity' | 'max_iterations' | 'target_reached' | 'no_results';
}

interface PriceGearPackageItem {
  slot: string;
  found: boolean;
  itemType?: 'rare' | 'unique';
  price?: { amount: number; currency: string };
  totalListings: number;
  tradeUrl?: string;
  keyMods?: string[];
  tierCompromises?: string[];
  relaxationNotes?: string;
  searchedMods?: string[];
  failureReason?: string;
  searchHistory?: PriceGearPackageSearchHistory;
}

interface PriceGearPackage {
  label: string;
  totalCost: { amount: number; currency: string };
  withinBudget: boolean | null;
  items: PriceGearPackageItem[];
}

const STOP_REASON_CONFIG: Record<string, { label: string; color: string }> = {
  budget_reached: { label: 'Budget Reached', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  market_scarcity: { label: 'Market Scarcity', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  max_iterations: { label: 'Max Iterations', color: 'bg-stone-500/10 text-stone-400 border-stone-500/20' },
  target_reached: { label: 'Target Reached', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  no_results: { label: 'No Results', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function SearchHistoryDetails({ history }: { history: PriceGearPackageSearchHistory }) {
  const [expanded, setExpanded] = useState(false);

  const statNames = Object.keys(history.startedAt);
  const stopCfg = STOP_REASON_CONFIG[history.stopReason] ?? STOP_REASON_CONFIG.max_iterations;

  // Compute summary: lowest and highest tier achieved
  const tiers = Object.values(history.tierAchieved);
  const tierNums = tiers.map((t) => parseInt(t.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
  const minTier = tierNums.length > 0 ? Math.min(...tierNums) : null;
  const maxTier = tierNums.length > 0 ? Math.max(...tierNums) : null;
  const tierRange = minTier != null && maxTier != null
    ? minTier === maxTier ? `T${minTier}` : `T${maxTier}\u2192T${minTier}`
    : null;

  // Final iteration budget utilization
  const lastIter = history.iterations[history.iterations.length - 1];
  const budgetPct = lastIter ? Math.round(lastIter.budgetUtilization * 100) : null;
  const listingCount = lastIter?.resultCount ?? 0;

  return (
    <div className="mt-0.5">
      {/* Summary line + toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev); }}
        className="flex items-center gap-1.5 text-[0.625rem] text-stone-500 hover:text-stone-400 transition-colors w-full group"
      >
        <ChevronDown className={cn('w-2.5 h-2.5 transition-transform flex-shrink-0', expanded && 'rotate-180')} />
        <span className="font-mono tabular-nums">
          {history.finalIteration} iter
        </span>
        {tierRange && (
          <>
            <span className="text-stone-600">&middot;</span>
            <span className="font-mono">{tierRange}</span>
          </>
        )}
        <span className="text-stone-600">&middot;</span>
        <span className="font-mono">{listingCount} listed</span>
        {budgetPct != null && (
          <>
            <span className="text-stone-600">&middot;</span>
            <span className={cn(
              'font-mono',
              budgetPct >= 80 ? 'text-amber-500/70' : 'text-stone-500'
            )}>
              Budget {budgetPct}%
            </span>
          </>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-1.5 ml-3 space-y-2 border-l border-stone-700/30 pl-2.5">
          {/* Stop reason badge */}
          <div>
            <span className={cn(
              'text-[0.625rem] px-1.5 py-0.5 rounded border font-medium inline-block',
              stopCfg.color,
            )}>
              {stopCfg.label}
            </span>
          </div>

          {/* Mod convergence table */}
          {statNames.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[0.5625rem] text-stone-600 uppercase tracking-wider font-medium">
                Mod Convergence
              </div>
              <div className="space-y-px">
                {statNames.map((stat, index) => {
                  const startVal = history.startedAt[stat];
                  const endVal = history.convergedAt[stat];
                  const tier = history.tierAchieved[stat];
                  const tierNum = tier ? parseInt(tier.replace(/\D/g, ''), 10) : null;
                  const changed = startVal !== endVal;

                  return (
                    <div
                      key={`${stat}-${index}`}
                      className="flex items-center gap-1.5 text-[0.625rem] font-mono"
                    >
                      {/* Stat name — truncated */}
                      <span className="text-stone-400 truncate min-w-0 flex-1" title={stat}>
                        {stat}
                      </span>
                      {/* Start -> End values */}
                      <span className="text-stone-600 flex-shrink-0 tabular-nums">
                        {startVal}
                      </span>
                      {changed && (
                        <>
                          <ArrowRight className="w-2 h-2 text-stone-600 flex-shrink-0" />
                          <span className="text-stone-300 flex-shrink-0 tabular-nums font-semibold">
                            {endVal}
                          </span>
                        </>
                      )}
                      {/* Tier badge */}
                      {tier && (
                        <span className={cn(
                          'text-[0.5625rem] px-1 py-px rounded border font-semibold flex-shrink-0',
                          tierNum != null && tierNum <= 2
                            ? 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20'
                            : tierNum != null && tierNum <= 4
                              ? 'bg-sky-500/10 text-sky-400/80 border-sky-500/20'
                              : 'bg-stone-500/10 text-stone-400/70 border-stone-500/20'
                        )}>
                          {tier}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Iteration steps */}
          {history.iterations.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[0.5625rem] text-stone-600 uppercase tracking-wider font-medium">
                Iterations
              </div>
              <div className="flex items-center gap-0.5 flex-wrap">
                {history.iterations.map((iter) => {
                  const utilPct = Math.round(iter.budgetUtilization * 100);
                  return (
                    <Tooltip.Provider key={iter.step} delayDuration={150}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <div
                            className={cn(
                              'rounded-full transition-colors cursor-default',
                              iter.resultCount === 0
                                ? 'bg-red-500/30'
                                : utilPct >= 80
                                  ? 'bg-amber-400/50'
                                  : utilPct >= 50
                                    ? 'bg-teal-400/40'
                                    : 'bg-stone-500/30',
                              // Size scales with budget utilization
                              utilPct >= 70 ? 'w-2.5 h-2.5' : utilPct >= 40 ? 'w-2 h-2' : 'w-1.5 h-1.5',
                            )}
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="top"
                            sideOffset={4}
                            className="z-[9999] rounded px-2 py-1.5 bg-slate-800 border border-stone-700/50 shadow-lg"
                          >
                            <div className="text-[0.625rem] font-mono space-y-0.5">
                              <div className="text-stone-300 font-semibold">Step {iter.step}</div>
                              <div className="text-stone-400">
                                {iter.resultCount} result{iter.resultCount !== 1 ? 's' : ''}
                                {' \u00b7 '}
                                {iter.cheapestPrice > 0 ? `${formatNumber(Math.round(iter.cheapestPrice))}c` : '-'}
                              </div>
                              <div className="text-stone-500">Budget: {utilPct}%</div>
                              {Object.keys(iter.minValues).length > 0 && (
                                <div className="text-stone-500 border-t border-stone-700/30 pt-0.5 mt-0.5">
                                  {Object.entries(iter.minValues).map(([k, v]) => (
                                    <div key={k}>{k}: {v}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Tooltip.Arrow className="fill-slate-800" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PriceGearPackagesResult({ data }: { data: Record<string, unknown> }) {
  const packages = (data.packages ?? []) as PriceGearPackage[];
  const summary = data.summary as string | undefined;
  const divineRate = data.divineRate as number | undefined;
  const diagnostics = data.diagnostics as ToolDiagnostics | undefined;

  if (packages.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Format a currency amount with optional divine conversion */
  const formatCost = (cost: { amount: number; currency: string }): string => {
    if (cost.currency === 'divine') {
      const chaosEquiv = divineRate ? Math.round(cost.amount * divineRate) : null;
      return chaosEquiv != null
        ? `${cost.amount.toFixed(1)} div (~${formatNumber(chaosEquiv)}c)`
        : `${cost.amount.toFixed(1)} div`;
    }
    if (cost.currency === 'chaos' && divineRate && cost.amount >= divineRate) {
      const divEquiv = (cost.amount / divineRate).toFixed(1);
      return `${formatNumber(Math.round(cost.amount))}c (~${divEquiv} div)`;
    }
    return `${formatNumber(Math.round(cost.amount))}c`;
  };

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Divine rate callout */}
      {divineRate != null && (
        <div className="text-[0.625rem] text-stone-500 font-mono">
          Divine rate: {formatNumber(Math.round(divineRate))}c
        </div>
      )}

      {packages.map((pkg, pi) => {
        const foundItems = pkg.items.filter((it) => it.found);
        const missingItems = pkg.items.filter((it) => !it.found);

        return (
          <div key={pi} className="space-y-1.5">
            {/* Package header */}
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
              <span className="text-xs text-amber-400/80 uppercase tracking-wide font-medium truncate">
                {pkg.label}
              </span>
              {/* Total cost badge */}
              <span className="ml-auto text-xs font-mono text-amber-300 font-semibold">
                {formatCost(pkg.totalCost)}
              </span>
              {/* Budget indicator */}
              {pkg.withinBudget != null && (
                <span
                  className={cn(
                    'text-[0.625rem] px-1.5 py-0.5 rounded border flex-shrink-0 font-medium',
                    pkg.withinBudget
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  )}
                >
                  {pkg.withinBudget ? 'Within Budget' : 'Over Budget'}
                </span>
              )}
            </div>

            {/* Items table */}
            {pkg.items.length > 0 && (
              <div className="ml-1 rounded overflow-hidden border border-stone-700/30">
                {/* Table header */}
                <div className="grid grid-cols-[6rem_4rem_5.5rem_3.5rem_2rem] gap-x-2 px-2 py-1 bg-slate-800/40 text-[0.625rem] text-stone-500 uppercase tracking-wider font-medium">
                  <span>Slot</span>
                  <span>Type</span>
                  <span>Price</span>
                  <span>Listed</span>
                  <span />
                </div>

                {/* Item rows */}
                {pkg.items.map((item, ii) => (
                  <div key={ii} className="border-t border-stone-700/20">
                    {/* Main row */}
                    <div
                      className={cn(
                        'grid grid-cols-[6rem_4rem_5.5rem_3.5rem_2rem] gap-x-2 px-2 py-1 text-xs font-mono',
                        ii % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10',
                        'hover:bg-slate-800/40 transition-colors'
                      )}
                    >
                      {/* Slot name */}
                      <span className={cn('truncate', item.found ? 'text-stone-200' : 'text-stone-500')}>
                        {item.slot}
                      </span>

                      {/* Item type badge */}
                      <span>
                        {item.found ? (
                          <span
                            className={cn(
                              'text-[0.625rem] px-1 py-px rounded border font-medium',
                              item.itemType === 'unique'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            )}
                          >
                            {item.itemType === 'unique' ? 'Unique' : 'Rare'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[0.625rem] text-stone-500">
                            <CircleSlash className="w-2.5 h-2.5" />
                            None
                          </span>
                        )}
                      </span>

                      {/* Price */}
                      <span className={cn('font-semibold', item.found ? 'text-amber-300' : 'text-stone-600')}>
                        {item.found && item.price ? formatCost(item.price) : '-'}
                      </span>

                      {/* Listings */}
                      <span className="text-stone-500">
                        {item.totalListings > 0 ? formatCompactNumber(item.totalListings) : '-'}
                      </span>

                      {/* Trade link */}
                      {item.tradeUrl ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openExternal(item.tradeUrl!);
                          }}
                          className="flex items-center justify-center text-teal-400 hover:text-teal-300 transition-colors"
                          title="Open on Trade Site"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>

                    {/* Sub-details: key mods, tier compromises, relaxation notes, search details for failures */}
                    {((item.found && (item.keyMods?.length || item.tierCompromises?.length || item.relaxationNotes)) ||
                      (!item.found && (item.searchedMods?.length || item.failureReason))) && (
                      <div className="px-3 pb-1.5 space-y-0.5">
                        {item.keyMods && item.keyMods.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.keyMods.map((mod, mi) => (
                              <span
                                key={mi}
                                className="text-[0.625rem] px-1.5 py-px rounded bg-slate-800/60 text-stone-400 border border-stone-700/30"
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.tierCompromises && item.tierCompromises.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tierCompromises.map((comp, ci) => (
                              <span
                                key={ci}
                                className="text-[0.625rem] px-1.5 py-px rounded bg-amber-500/8 text-amber-400/70 border border-amber-500/15"
                              >
                                {comp}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.relaxationNotes && (
                          <div className="text-[0.625rem] text-stone-500 italic pl-0.5">
                            {item.relaxationNotes}
                          </div>
                        )}
                        {!item.found && item.searchedMods && item.searchedMods.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[0.625rem] text-stone-500 font-medium">Searched:</span>
                            {item.searchedMods.map((mod, si) => (
                              <span
                                key={si}
                                className="text-[0.625rem] px-1.5 py-px rounded bg-slate-800/30 text-stone-500 border border-stone-700/20"
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        )}
                        {!item.found && item.failureReason && (
                          <div className="text-[0.625rem] text-red-400/60 italic pl-0.5">
                            {item.failureReason}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Search history details — rare items only */}
                    {item.searchHistory && item.itemType !== 'unique' && (
                      <div className="px-3 pb-1.5">
                        <SearchHistoryDetails history={item.searchHistory} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Missing items warning */}
            {missingItems.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-amber-400/70 ml-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  {missingItems.length} item{missingItems.length > 1 ? 's' : ''} not found:{' '}
                  {missingItems.map((it) => it.slot).join(', ')}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      {summary && (
        <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-2">
          {stripToolTags(summary)}
        </div>
      )}

      <DiagnosticsPanel diagnostics={diagnostics} />
    </div>
  );
}

export function DefaultResult({ data }: { data: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false);

  // Extract summary if available for outcome display
  const summary = data.summary as string | undefined;
  const hasOutcome = Boolean(summary);

  return (
    <div className="text-sm px-1 space-y-1">
      {hasOutcome ? (
        <span className="text-stone-300">{stripToolTags(summary ?? '')}</span>
      ) : (
        <span className="text-stone-400">Tool completed successfully.</span>
      )}
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <button
        onClick={(e) => { e.stopPropagation(); setShowRaw(!showRaw); }}
        className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 transition-colors"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', showRaw && 'rotate-180')} />
        {showRaw ? 'Hide' : 'Show'} raw output
      </button>
      {showRaw && (
        <pre className="text-xs text-stone-500 bg-slate-900/60 rounded p-2 overflow-x-auto max-h-48">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// =============================================================================
// TestCombatConfigResult — test_combat_config tool renderer
// =============================================================================

function TestCombatConfigResult({ data }: { data: Record<string, unknown> }) {
  const baseline = data.baseline as { dps: number; ehp: number; life: number; config?: string } | undefined;
  const results = (data.results ?? []) as Array<{
    label: string;
    dps: number;
    ehp: number;
    life: number;
    dpsChange: { absolute: number; percent: number };
    ehpChange: { absolute: number; percent: number };
    configApplied?: string;
  }>;
  const error = data.error as string | undefined;

  if (error) {
    return (
      <div className="text-sm px-1">
        <div className="text-red-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return <DefaultResult data={data} />;
  }

  // Find max percent for bar scaling
  const maxDpsPercent = Math.max(...results.map(r => Math.abs(r.dpsChange.percent)), 1);
  const maxEhpPercent = Math.max(...results.map(r => Math.abs(r.ehpChange.percent)), 1);

  // Sort by DPS impact descending
  const sorted = [...results].sort((a, b) => b.dpsChange.percent - a.dpsChange.percent);

  // DPS formatting helper (same as ConfigureCombatResultNew)
  function formatDps(value: number): string {
    const abs = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    if (abs < 10 && abs > 0) return `${sign}${abs.toFixed(1)}`;
    return `${sign}${abs.toFixed(0)}`;
  }

  // Suppress unused variable warning — baseline is available for future use (e.g. header row)
  void baseline;

  return (
    <div className="text-sm space-y-2.5">
      {sorted.map((result, idx) => {
        const dpsBarWidth = maxDpsPercent > 0
          ? Math.min(100, (Math.abs(result.dpsChange.percent) / maxDpsPercent) * 100)
          : 0;
        const ehpPct = Math.abs(result.ehpChange.percent);
        const ehpBarWidth = maxEhpPercent > 0
          ? Math.min(100, (ehpPct / maxEhpPercent) * 100)
          : 0;

        const showDps = Math.abs(result.dpsChange.percent) > 0.1;
        const showEhp = ehpPct > 0.5;
        const isPositiveDps = result.dpsChange.percent > 0;
        const isPositiveEhp = result.ehpChange.percent > 0;

        // Color scheme: positive = emerald, negative = red, EHP = sky
        const dpsColor = isPositiveDps ? 'text-emerald-400' : 'text-red-400';
        const dpsBarColor = isPositiveDps
          ? (Math.abs(result.dpsChange.percent) > 20 ? 'bg-emerald-500/40' : Math.abs(result.dpsChange.percent) > 5 ? 'bg-emerald-500/25' : 'bg-emerald-500/15')
          : (Math.abs(result.dpsChange.percent) > 20 ? 'bg-red-500/40' : Math.abs(result.dpsChange.percent) > 5 ? 'bg-red-500/25' : 'bg-red-500/15');
        const ehpColor = isPositiveEhp ? 'text-sky-400' : 'text-red-400';
        const ehpBarColor = isPositiveEhp
          ? (ehpPct > 20 ? 'bg-sky-500/40' : ehpPct > 5 ? 'bg-sky-500/25' : 'bg-sky-500/15')
          : (ehpPct > 20 ? 'bg-red-500/30' : 'bg-red-500/15');

        // Best result indicator
        const isBest = idx === 0 && sorted.length > 1 && result.dpsChange.percent > 0;

        return (
          <div
            key={idx}
            className={cn(
              'space-y-1 rounded border px-2 py-1.5',
              isBest ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-transparent',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[0.6875rem] text-stone-300 font-medium pt-0.5">
                <span className={cn(isPositiveDps ? 'text-emerald-400/70' : 'text-red-400/70', 'mr-1')}>
                  {isPositiveDps ? '\u25c6' : '\u25c7'}
                </span>
                {result.label}
              </span>
              <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                {showDps && (
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-[0.6875rem] font-semibold tabular-nums', dpsColor)}>
                      {formatDps(result.dpsChange.absolute)}
                    </span>
                    <span className={cn('text-[0.625rem] tabular-nums', dpsColor.replace('400', '400/40'))}>
                      {result.dpsChange.percent > 0 ? '+' : ''}{result.dpsChange.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
                {showEhp && (
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-[0.6875rem] font-semibold tabular-nums', ehpColor)}>
                      {formatDps(result.ehpChange.absolute)}
                    </span>
                    <span className={cn('text-[0.625rem] tabular-nums', ehpColor.replace('400', '400/40'))}>
                      {result.ehpChange.percent > 0 ? '+' : ''}{result.ehpChange.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Dual bars */}
            <div className="space-y-0.5">
              {showDps && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[0.5rem] uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium', isPositiveDps ? 'text-emerald-500/40' : 'text-red-500/40')}>dps</span>
                  <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                    <div
                      className={cn('h-full rounded-full transition-all', dpsBarColor)}
                      style={{ width: `${dpsBarWidth}%` }}
                    />
                  </div>
                </div>
              )}
              {showEhp && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[0.5rem] uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium', isPositiveEhp ? 'text-sky-500/40' : 'text-red-500/40')}>ehp</span>
                  <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                    <div
                      className={cn('h-full rounded-full transition-all', ehpBarColor)}
                      style={{ width: `${ehpBarWidth}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Config pills if present */}
            {result.configApplied && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                <ConfigPills configApplied={result.configApplied} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// AnalyzeFlasksResult — shows flask analysis with uptime and DPS/EHP impact
// =============================================================================

function AnalyzeFlasksResult({ data }: { data: Record<string, unknown> }) {
  const baseline = data.baseline as { dps: number; ehp: number; config?: string } | undefined;
  const flasks = (data.flasks ?? []) as Array<{
    slot: number; name: string; duration?: number; charges?: string;
  }>;
  const uptimeData = (data.uptimeData ?? []) as Array<{
    slot: number; name: string; type: 'life' | 'mana' | 'utility';
    duration: number; charges: string; maxUses: number;
    chargeGenPerSec?: number; chanceNoConsume?: number; effectMod?: number;
    uptimeMin?: number | null; uptimeAvg?: number | null; error?: string;
  }>;
  const results = (data.results ?? []) as Array<{
    label: string;
    dpsChange: { change: number; pct: number };
    ehpChange: { change: number; pct: number };
    significantExtras?: Array<{ label: string; pct: number }>;
  }>;
  const totalFlaskDependency = data.totalFlaskDependency as { dpsPct: number; ehpPct: number } | undefined;
  const error = data.error as string | undefined;
  const hint = data.hint as string | undefined;

  if (error && results.length === 0) {
    return (
      <div className="text-sm px-1">
        <div className="text-red-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
        <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      </div>
    );
  }

  if (flasks.length === 0 && results.length === 0) {
    return <DefaultResult data={data} />;
  }

  // Build uptime lookup by slot
  const uptimeBySlot = new Map(uptimeData.map(u => [u.slot, u]));

  // Find max DPS percent for bar scaling
  const maxDpsPct = Math.max(...results.map(r => Math.abs(r.dpsChange.pct)), 1);

  // Flask type pill colors
  const typeStyle = (type: string): string => {
    switch (type) {
      case 'life': return 'bg-red-900/30 text-red-300 border-red-500/25';
      case 'mana': return 'bg-blue-900/30 text-blue-300 border-blue-500/25';
      default: return 'bg-teal-900/30 text-teal-300 border-teal-500/25';
    }
  };

  // Uptime color
  const uptimeColor = (pct: number): string =>
    pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="text-sm space-y-2">
      {/* Header: baseline stats */}
      <div className="section-embossed rounded-t px-2 py-1.5 mb-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[0.625rem] font-display font-semibold uppercase tracking-widest text-amber-400/80">
            Flask Analysis
          </span>
          {baseline && (
            <span className="text-[0.625rem] font-mono text-stone-400">
              {formatCompactNumber(baseline.dps)} DPS · {formatCompactNumber(baseline.ehp)} EHP
            </span>
          )}
        </div>
      </div>

      <div className="card-forge rounded-b rounded-t-none px-2 py-2 space-y-2">
        {/* Total flask dependency */}
        {totalFlaskDependency && (totalFlaskDependency.dpsPct > 1 || totalFlaskDependency.ehpPct > 1) && (
          <div className="space-y-1">
            <span className="text-[0.625rem] text-stone-500 uppercase tracking-wider">Flask Dependency</span>
            <div className="flex items-center gap-3">
              {[
                { label: 'dps', pct: totalFlaskDependency.dpsPct, labelColor: 'text-amber-500/40', barColor: totalFlaskDependency.dpsPct > 50 ? 'bg-red-500/50' : totalFlaskDependency.dpsPct > 25 ? 'bg-amber-500/40' : 'bg-emerald-500/30', textColor: totalFlaskDependency.dpsPct > 50 ? 'text-red-400' : totalFlaskDependency.dpsPct > 25 ? 'text-amber-400' : 'text-emerald-400' },
                ...(totalFlaskDependency.ehpPct > 1 ? [{ label: 'ehp', pct: totalFlaskDependency.ehpPct, labelColor: 'text-sky-500/40', barColor: 'bg-sky-500/30', textColor: 'text-sky-400' }] : []),
              ].map((dep) => (
                <div key={dep.label} className="flex items-center gap-1.5 flex-1">
                  <span className={cn('text-[0.5rem] uppercase tracking-widest w-[22px] flex-shrink-0 text-right font-medium', dep.labelColor)}>{dep.label}</span>
                  <div className="h-[5px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                    <div className={cn('h-full rounded-full', dep.barColor)} style={{ width: `${Math.min(100, dep.pct)}%` }} />
                  </div>
                  <span className={cn('text-[0.625rem] font-mono tabular-nums', dep.textColor)}>{dep.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-flask rows */}
        {results.length > 0 && (
          <div className="space-y-1">
            {results.map((result, idx) => {
              const flask = flasks[idx];
              const uptime = flask ? uptimeBySlot.get(flask.slot) : undefined;
              const dpsPct = result.dpsChange.pct;
              const isPositive = dpsPct > 0;
              const isNegative = dpsPct < 0;
              const dpsBarWidth = maxDpsPct > 0 ? Math.min(100, (Math.abs(dpsPct) / maxDpsPct) * 100) : 0;

              return (
                <div
                  key={idx}
                  className={cn(
                    'relative py-1.5 px-2 rounded-md text-xs',
                    'bg-slate-900/40 border-l-2',
                    isPositive && 'border-emerald-500/60',
                    isNegative && 'border-red-500/60',
                    !isPositive && !isNegative && 'border-stone-500/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[0.6875rem] text-stone-200 font-medium truncate">
                        {result.label}
                      </span>
                      {uptime && (
                        <span className={cn('text-[0.5625rem] px-1 py-px rounded border', typeStyle(uptime.type))}>
                          {uptime.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {dpsPct !== 0 && (
                        <span className={cn('text-[0.6875rem] font-mono tabular-nums font-semibold', isPositive ? 'text-emerald-400' : 'text-red-400')}>
                          {isPositive ? '+' : ''}{dpsPct.toFixed(1)}%
                        </span>
                      )}
                      {Math.abs(result.ehpChange.pct) > 0.5 && (
                        <span className={cn('text-[0.625rem] font-mono tabular-nums', result.ehpChange.pct > 0 ? 'text-sky-400/70' : 'text-red-400/70')}>
                          {result.ehpChange.pct > 0 ? '+' : ''}{result.ehpChange.pct.toFixed(0)}% ehp
                        </span>
                      )}
                    </div>
                  </div>
                  {/* DPS impact bar */}
                  {dpsPct !== 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                        <div
                          className={cn('h-full rounded-full', isPositive ? 'bg-emerald-500/30' : 'bg-red-500/30')}
                          style={{ width: `${dpsBarWidth}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Uptime indicator */}
                  {uptime && uptime.uptimeAvg != null && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[0.5rem] uppercase tracking-widest text-stone-600 w-[38px] flex-shrink-0 text-right">uptime</span>
                      <div className="h-[3px] rounded-full bg-slate-800/60 overflow-hidden flex-1">
                        <div
                          className={cn('h-full rounded-full', uptimeColor(uptime.uptimeAvg))}
                          style={{ width: `${Math.min(100, uptime.uptimeAvg)}%`, opacity: 0.5 }}
                        />
                      </div>
                      <span className="text-[0.5625rem] font-mono tabular-nums text-stone-500">
                        {uptime.uptimeAvg.toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {/* Charge info */}
                  {uptime && (
                    <div className="flex items-center gap-2 mt-0.5 text-[0.5625rem] text-stone-600">
                      <span>{uptime.charges} charges · {uptime.duration > 0 ? `${uptime.duration.toFixed(1)}s` : ''}{uptime.chargeGenPerSec != null && uptime.chargeGenPerSec > 0 ? ` · +${uptime.chargeGenPerSec.toFixed(1)}/s gen` : ''}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hint && (
          <div className="text-xs text-stone-400 italic border-t border-stone-700/50 pt-1.5">
            {hint}
          </div>
        )}
      </div>
      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Combined Changes (Cross-Pathway Synthesis) Renderer
// =============================================================================

interface CombinedChangeResult {
  label: string;
  success: boolean;
  error?: string;
  dps: { change: number; pct: number };
  ehp: { change: number; pct: number };
  life: { change: number; pct: number };
  resistances?: { fire: number; cold: number; lightning: number; chaos: number };
  hardConstraintViolations: string[];
  attributeBreaches: Array<{ attr: string; current: number; required: number; deficit: number }>;
  significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
  compositeScore: number;
  warnings: string[];
  appliedChanges: { treeNodesAdded: number; treeNodesRemoved: number; gearSlotsChanged: number; gemSwaps: number };
  changeDetail: {
    treeNodes?: { add: number[]; remove: number[] };
    gearItems: Array<{ slot: string; itemText: string; iconUrl?: string; fallbackIconUrl?: string; display?: GearDisplayData }>;
    gemSwaps: Array<{
      group: number;
      op?: 'swap' | 'add' | 'remove' | 'adjust';
      removed: string;
      added: string;
      level?: number;
      quality?: number;
    }>;
    jewelItems?: Array<{ socketNodeId: number; jewelText: string }>;
  };
}

function CombinedChangesResult({ data }: { data: Record<string, unknown> }) {
  const { gemMap, ready: gemReady } = useGemLookup();
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap, nodeIdMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);

  const baseline = data.baseline as {
    dps: number; ehp: number; life: number;
    resistances?: { fire: number; cold: number; lightning: number; chaos: number };
  } | undefined;

  const baselineConfig = typeof data.baselineConfig === 'string' ? data.baselineConfig : undefined;
  const callNumber = data.callNumber as number | undefined;
  const totalTested = data.totalTested as number | undefined;
  const results = (data.results ?? []) as CombinedChangeResult[];
  const crossCallSkipped = data.crossCallSkipped as { count: number; labels: string[] } | undefined;

  // Auto-expand top 3 by compositeScore
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => {
    const autoExpand = new Set<number>();
    const scored = results
      .map((r, i) => ({ i, score: r.compositeScore }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    for (const s of scored) autoExpand.add(s.i);
    return autoExpand;
  });

  // Listen for expand-items custom events dispatched by package pill clicks
  useEffect(() => {
    const handlers = new Map<HTMLElement, () => void>();
    results.forEach((_, i) => {
      const el = document.getElementById(`combined-setup-c${callNumber ?? 0}-${i + 1}`);
      if (el) {
        const handler = () => setExpandedItems(prev => new Set(prev).add(i));
        el.addEventListener('expand-items', handler);
        handlers.set(el, handler);
      }
    });
    return () => {
      handlers.forEach((handler, el) => el.removeEventListener('expand-items', handler));
    };
  }, [callNumber, results.length]);

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (stats && stats.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
    }
  };
  const hideTooltip = () => setTooltip(null);

  if (!baseline || results.length === 0) {
    return <DefaultResult data={data} />;
  }

  /** Color class for a delta value */
  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  /** Verdict border color based on score + constraints */
  const verdictBorder = (r: CombinedChangeResult): string => {
    if (!r.success || r.error) return 'border-stone-600/40';
    if (r.compositeScore <= 0 || r.hardConstraintViolations.length > 0) return 'border-red-500/50';
    if (r.warnings.length > 0 || r.attributeBreaches.length > 0) return 'border-amber-500/50';
    return 'border-emerald-500/50';
  };

  const toggleExpansion = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Build a nodeId -> name lookup from the enrichment hook's nodeIdMap
  const nodeIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const [id, info] of nodeIdMap.entries()) {
      if (info.name) map.set(id, info.name);
    }
    return map;
  }, [nodeIdMap]);

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-amber-400/80 uppercase tracking-wide font-medium">
          {callNumber ? `Call ${callNumber}` : 'Combined Changes'}
        </span>
        {totalTested != null && (
          <span className="text-stone-500 font-mono">{totalTested} tested</span>
        )}
        {baselineConfig && <ConfigPills configApplied={baselineConfig} />}
      </div>

      {/* Baseline summary */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono px-2 py-1.5 rounded bg-slate-900/30">
        <span className="text-amber-300">{formatCompactNumber(baseline.dps)} DPS</span>
        <span className="text-blue-300">{formatCompactNumber(baseline.ehp)} EHP</span>
        <span className="text-green-300">{formatCompactNumber(baseline.life)} Life</span>
        {baseline.resistances && (
          <span className="text-stone-400 text-[0.625rem]">
            Res: {baseline.resistances.fire}/{baseline.resistances.cold}/{baseline.resistances.lightning}/{baseline.resistances.chaos}
          </span>
        )}
      </div>

      {/* Cross-call skipped */}
      {crossCallSkipped && crossCallSkipped.count > 0 && (
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-stone-500 italic px-1">
          <Filter className="w-3 h-3" />
          {crossCallSkipped.count} duplicate{crossCallSkipped.count > 1 ? 's' : ''} skipped
        </div>
      )}

      {/* Results */}
      <div className="space-y-1.5">
        {results.map((result, i) => {
          const isExpanded = expandedItems.has(i);
          const hasTreeChanges = result.appliedChanges.treeNodesAdded > 0 || result.appliedChanges.treeNodesRemoved > 0;
          const hasGearChanges = result.appliedChanges.gearSlotsChanged > 0;
          const hasSkillChanges = result.appliedChanges.gemSwaps > 0;
          const hasExpandableDetail =
            (result.changeDetail.treeNodes && (result.changeDetail.treeNodes.add.length > 0 || result.changeDetail.treeNodes.remove.length > 0)) ||
            result.changeDetail.gearItems.length > 0 ||
            result.changeDetail.gemSwaps.length > 0;

          return (
            <div
              key={i}
              id={`combined-setup-c${callNumber ?? 0}-${i + 1}`}
              className={cn(
                'py-1.5 px-2 rounded bg-slate-900/40 border-l-2 transition-[box-shadow] duration-300',
                verdictBorder(result),
              )}
            >
              {/* Header: Label + Score */}
              <div className="flex items-center gap-2">
                <span className="text-stone-200 text-xs font-medium flex-1 min-w-0">
                  {stripToolTags(result.label)}
                </span>
                <span className={cn(
                  'text-[0.625rem] px-1.5 py-0.5 rounded border font-mono font-medium shrink-0',
                  'bg-amber-500/15 text-amber-400 border-amber-500/20',
                )}>
                  {result.compositeScore.toFixed(1)}
                </span>
              </div>

              {/* Three-column change summary */}
              <div className="flex flex-wrap gap-3 mt-1.5">
                {/* Tree column */}
                {hasTreeChanges && (
                  <div className="flex items-center gap-1.5 text-[0.625rem]">
                    <Network className="w-3 h-3 text-amber-400/60" />
                    <span className="text-stone-400">Tree</span>
                    {result.appliedChanges.treeNodesAdded > 0 && (
                      <span className="text-emerald-400/80">+{result.appliedChanges.treeNodesAdded}</span>
                    )}
                    {result.appliedChanges.treeNodesRemoved > 0 && (
                      <span className="text-red-400/80">{'\u2212'}{result.appliedChanges.treeNodesRemoved}</span>
                    )}
                  </div>
                )}

                {/* Gear column */}
                {hasGearChanges && (
                  <div className="flex items-center gap-1.5 text-[0.625rem]">
                    <Layers className="w-3 h-3 text-amber-400/60" />
                    <span className="text-stone-400">Gear</span>
                    <div className="flex flex-wrap gap-0.5">
                      {result.changeDetail.gearItems.map((gi, gi_idx) => (
                        <span key={gi_idx} className="px-1 py-px rounded bg-amber-900/20 text-amber-400/70 text-[0.5625rem] font-medium">
                          {gi.slot}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills column */}
                {hasSkillChanges && (
                  <div className="flex items-center gap-1.5 text-[0.625rem]">
                    <Gem className="w-3 h-3 text-amber-400/60" />
                    <span className="text-stone-400">Skills</span>
                    <div className="flex flex-wrap gap-0.5">
                      {result.changeDetail.gemSwaps.map((gs, gs_idx) => {
                        const ns = normalizeGemSwapEntry(gs);
                        const label = ns.op === 'adjust'
                          ? `\u223C ${ns.added}${ns.level !== undefined ? ` L${ns.level}` : ''}`
                          : ns.removed && ns.added
                            ? `${ns.removed} \u2192 ${ns.added}`
                            : ns.added
                              ? `+ ${ns.added}`
                              : ns.removed
                                ? `- ${ns.removed}`
                                : 'Gem change';
                        return (
                          <span key={gs_idx} className="text-stone-400/80 text-[0.5625rem]">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Stat deltas */}
              <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                <span className={cn('flex items-center gap-0.5', deltaColor(result.dps.pct))}>
                  {result.dps.pct > 0 && <TrendingUp className="w-3 h-3" />}
                  {result.dps.pct < 0 && <TrendingDown className="w-3 h-3" />}
                  {result.dps.pct > 0 ? '+' : ''}{result.dps.pct.toFixed(1)}% DPS
                </span>
                <span className={cn('flex items-center gap-0.5', deltaColor(result.ehp.pct))}>
                  {result.ehp.pct > 0 && <TrendingUp className="w-3 h-3" />}
                  {result.ehp.pct < 0 && <TrendingDown className="w-3 h-3" />}
                  {result.ehp.pct > 0 ? '+' : ''}{result.ehp.pct.toFixed(1)}% EHP
                </span>
                {result.life.pct !== 0 && (
                  <span className={cn('flex items-center gap-0.5', deltaColor(result.life.pct))}>
                    {result.life.pct > 0 ? '+' : ''}{result.life.pct.toFixed(1)}% Life
                  </span>
                )}
              </div>

              {/* Significant extras pills */}
              {result.significantExtras && result.significantExtras.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.significantExtras.map((extra, ei) => (
                    <span
                      key={ei}
                      className={`text-[0.625rem] px-1 py-0.5 rounded ${
                        extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {formatExtraPill(extra)}
                    </span>
                  ))}
                </div>
              )}

              {/* Hard constraint violations */}
              {result.hardConstraintViolations.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {result.hardConstraintViolations.slice(0, 3).map((v, vi) => (
                    <div key={vi} className="text-[0.6875rem] text-red-400/90">
                      {v}
                    </div>
                  ))}
                </div>
              )}

              {/* Attribute breaches */}
              {result.attributeBreaches.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {result.attributeBreaches.map((ab, abi) => (
                    <div key={abi} className="flex items-center gap-1 text-[0.6875rem] text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {ab.attr} breach: {ab.current}/{ab.required} ({'\u2212'}{ab.deficit})
                    </div>
                  ))}
                </div>
              )}

              {/* Resistance warnings */}
              {result.resistances && (
                (() => {
                  const uncapped: string[] = [];
                  if (result.resistances.fire < 75) uncapped.push(`Fire ${result.resistances.fire}%`);
                  if (result.resistances.cold < 75) uncapped.push(`Cold ${result.resistances.cold}%`);
                  if (result.resistances.lightning < 75) uncapped.push(`Ltng ${result.resistances.lightning}%`);
                  if (uncapped.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      Uncapped: {uncapped.join(', ')}
                    </div>
                  );
                })()
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {result.warnings.map((w, wi) => (
                    <div key={wi} className="text-[0.6875rem] text-stone-500 italic">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {result.error && (
                <div className="text-[0.6875rem] text-red-400 mt-1">
                  {result.error}
                </div>
              )}

              {/* Expand/collapse toggle for details */}
              {hasExpandableDetail && (
                <button
                  type="button"
                  onClick={() => toggleExpansion(i)}
                  className="mt-1.5 flex items-center gap-1 text-[0.6875rem] text-amber-400/60 hover:text-amber-400/90 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 transition-transform duration-200',
                      isExpanded && 'rotate-180',
                    )}
                  />
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>
              )}

              {/* Expanded detail section */}
              <AnimatePresence>
                {isExpanded && hasExpandableDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 pt-2 border-t border-[#3a3530]/30 space-y-3">
                      {/* Tree nodes detail */}
                      {result.changeDetail.treeNodes && (result.changeDetail.treeNodes.add.length > 0 || result.changeDetail.treeNodes.remove.length > 0) && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[0.625rem] text-amber-400/80 uppercase tracking-wider font-medium">
                            <Network className="w-3 h-3" />
                            Tree Nodes
                          </div>
                          {/* Added nodes */}
                          {result.changeDetail.treeNodes.add.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[0.5625rem] text-emerald-400/70 uppercase tracking-wider">Added</span>
                              <div className="flex flex-wrap gap-1.5">
                                {result.changeDetail.treeNodes.add.map((nodeId) => {
                                  const nodeName = nodeIdToName.get(nodeId) ?? `Node ${nodeId}`;
                                  const nodeType = nodeTypeMap.get(nodeName);
                                  return (
                                    <div
                                      key={nodeId}
                                      className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/8 border border-emerald-500/15"
                                      onMouseEnter={(e) => showTooltip(e, nodeName, 'text-emerald-400')}
                                      onMouseLeave={hideTooltip}
                                    >
                                      <TreeNodeBadge
                                        name={nodeName}
                                        nodeType={nodeType}
                                        nodeIconMap={nodeIconMap}
                                        spriteConfig={spriteConfig}
                                        zoomLevel={zoomLevel}
                                        size={18}
                                      />
                                      <span className="text-[0.625rem] text-emerald-300/80">{nodeName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Removed nodes */}
                          {result.changeDetail.treeNodes.remove.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[0.5625rem] text-red-400/70 uppercase tracking-wider">Removed</span>
                              <div className="flex flex-wrap gap-1.5">
                                {result.changeDetail.treeNodes.remove.map((nodeId) => {
                                  const nodeName = nodeIdToName.get(nodeId) ?? `Node ${nodeId}`;
                                  const nodeType = nodeTypeMap.get(nodeName);
                                  return (
                                    <div
                                      key={nodeId}
                                      className="group flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-red-500/8 border border-red-500/15 opacity-70"
                                      onMouseEnter={(e) => showTooltip(e, nodeName, 'text-red-400')}
                                      onMouseLeave={hideTooltip}
                                    >
                                      <TreeNodeBadge
                                        name={nodeName}
                                        nodeType={nodeType}
                                        nodeIconMap={nodeIconMap}
                                        spriteConfig={spriteConfig}
                                        zoomLevel={zoomLevel}
                                        size={18}
                                      />
                                      <span className="text-[0.625rem] text-red-300/80">{nodeName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Gear items detail */}
                      {result.changeDetail.gearItems.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[0.625rem] text-amber-400/80 uppercase tracking-wider font-medium">
                            <Layers className="w-3 h-3" />
                            Gear Changes
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {result.changeDetail.gearItems.map((gi, gi_idx) => {
                              const tooltipProps = gi.display
                                ? gearDisplayToTooltipProps({ display: gi.display, itemText: gi.itemText, slot: gi.slot })
                                : (() => { const p = parseRawItemText(gi.itemText); return { ...p, raw: gi.itemText }; })();
                              return (
                                <div key={gi_idx} className="flex flex-col items-center gap-1">
                                  <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400/70 border border-amber-500/15 font-medium uppercase tracking-wider">
                                    {gi.slot}
                                  </span>
                                  <ItemTooltip
                                    {...tooltipProps}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Gem swaps detail */}
                      {result.changeDetail.gemSwaps.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[0.625rem] text-amber-400/80 uppercase tracking-wider font-medium">
                            <Gem className="w-3 h-3" />
                            Skill Changes
                          </div>
                          <div className="space-y-1.5">
                            {result.changeDetail.gemSwaps.map((gs, gs_idx) => {
                              const ns = normalizeGemSwapEntry(gs);
                              return (
                                <div key={gs_idx} className="flex items-center gap-1.5">
                                  {ns.op === 'adjust' ? (
                                    <GemTooltipTrigger
                                      gem={{ name: ns.added, level: ns.level, quality: ns.quality }}
                                      gemMap={gemMap}
                                      ready={gemReady}
                                    >
                                      <div className="cursor-help">
                                        <ToolGemOrb
                                          gem={{ name: ns.added, level: ns.level, quality: ns.quality }}
                                          gemMap={gemMap}
                                          ready={gemReady}
                                          size="xs"
                                          marker="adjust"
                                        />
                                      </div>
                                    </GemTooltipTrigger>
                                  ) : (
                                    <>
                                      {ns.removed && (
                                        <GemTooltipTrigger
                                          gem={{ name: ns.removed }}
                                          gemMap={gemMap}
                                          ready={gemReady}
                                        >
                                          <div className="cursor-help">
                                            <ToolGemOrb
                                              gem={{ name: ns.removed }}
                                              gemMap={gemMap}
                                              ready={gemReady}
                                              size="xs"
                                              marker="remove"
                                              dimmed
                                            />
                                          </div>
                                        </GemTooltipTrigger>
                                      )}
                                      {ns.removed && ns.added && (
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                      )}
                                      {ns.added && (
                                        <GemTooltipTrigger
                                          gem={{ name: ns.added }}
                                          gemMap={gemMap}
                                          ready={gemReady}
                                        >
                                          <div className="cursor-help">
                                            <ToolGemOrb
                                              gem={{ name: ns.added }}
                                              gemMap={gemMap}
                                              ready={gemReady}
                                              size="xs"
                                              marker="add"
                                            />
                                          </div>
                                        </GemTooltipTrigger>
                                      )}
                                    </>
                                  )}
                                  <span className="text-stone-500 text-[0.625rem] ml-1">Group {ns.group}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

// =============================================================================
// Synthesis tool renderers
// =============================================================================

const NOMINEE_PATHWAY_COLORS: Record<string, { bg: string; text: string }> = {
  gear: { bg: 'bg-amber-500/15', text: 'text-amber-300' },
  skills: { bg: 'bg-blue-500/15', text: 'text-blue-300' },
  tree: { bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
};

const DEFAULT_NOMINEE_COLOR = { bg: 'bg-stone-500/15', text: 'text-stone-300' };

/** Single nominee row with optional gear tooltip on hover. */
function NomineeRow({ nom, pillColor }: {
  nom: { ref: string; label: string; dpsPct: number; ehpPct: number; compositeScore: number; status: string };
  pillColor: { bg: string; text: string };
}) {
  const pkg = useGearPackage(nom.ref);
  const isClean = nom.status === 'CLEAN';

  const row = (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md bg-slate-900/40 text-xs font-mono">
      {/* Label pill — clickable, scrolls to matching tested package */}
      <span
        role="link"
        tabIndex={0}
        onClick={() => {
          const found = navigateToRef(nom.ref);
          if (!found) navigateToRefCrossTab(nom.ref);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (e.target as HTMLElement).click();
          }
        }}
        className={cn(
          'px-1.5 py-0.5 rounded text-[0.625rem] font-semibold cursor-pointer truncate flex-1 min-w-0',
          'hover:brightness-125 transition-all duration-200',
          pillColor.bg, pillColor.text,
        )}
      >
        {stripToolTags(nom.label)}
      </span>

      {/* DPS% */}
      <span className={cn(
        'flex-shrink-0',
        nom.dpsPct > 0 ? 'text-emerald-400' : nom.dpsPct < 0 ? 'text-red-400' : 'text-stone-500',
      )}>
        {nom.dpsPct > 0 ? '+' : ''}{nom.dpsPct.toFixed(1)}% DPS
      </span>

      {/* EHP% */}
      <span className={cn(
        'flex-shrink-0',
        nom.ehpPct > 0 ? 'text-emerald-400' : nom.ehpPct < 0 ? 'text-red-400' : 'text-stone-500',
      )}>
        {nom.ehpPct > 0 ? '+' : ''}{nom.ehpPct.toFixed(1)}% EHP
      </span>

      {/* Composite score */}
      <span className="text-amber-300/80 flex-shrink-0">
        {nom.compositeScore.toFixed(1)}
      </span>

      {/* Status badge */}
      <span className={cn(
        'text-[0.625rem] px-1.5 py-0.5 rounded border flex-shrink-0',
        isClean
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      )}>
        {isClean ? 'CLEAN' : nom.status}
      </span>
    </div>
  );

  // No gear data — render plain row
  if (!pkg || pkg.items.length === 0) return row;

  const visibleItems = pkg.items.slice(0, 5);
  const scale = visibleItems.length <= 3 ? 1 : visibleItems.length === 4 ? 0.9 : 0.8;

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{row}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            className="z-[9999] animate-in fade-in-0 zoom-in-95 duration-150"
            collisionPadding={12}
          >
            <div
              className="bg-[#0c0c0e] border border-[#3a3530]/60 rounded-lg p-2.5 shadow-xl origin-bottom"
              style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
            >
              <div className="flex gap-2 justify-center">
                {visibleItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400/70 border border-amber-500/15 font-medium uppercase tracking-wider">
                      {item.slot}
                    </span>
                    <ItemTooltip
                      name={item.name}
                      baseName={item.baseName}
                      rarity={item.rarity}
                      mods={item.mods}
                      raw={item.raw}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Tooltip.Arrow className="fill-[#0c0c0e]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function NominateForSynthesisResult({ data }: { data: Record<string, unknown> }) {
  const pathway = data.pathway as string | undefined;
  const nominees = (data.nominees ?? []) as Array<{
    ref: string;
    label: string;
    dpsPct: number;
    ehpPct: number;
    compositeScore: number;
    status: string;
  }>;
  const invalidRefs = (data.invalidRefs ?? []) as string[];

  if (nominees.length === 0) {
    return <DefaultResult data={data} />;
  }

  const pillColor = NOMINEE_PATHWAY_COLORS[pathway ?? ''] ?? DEFAULT_NOMINEE_COLOR;

  return (
    <div className="text-sm px-1 space-y-2">
      <div className="text-xs text-stone-400">
        Nominated {nominees.length} package{nominees.length !== 1 ? 's' : ''}
      </div>

      <div className="space-y-1">
        {nominees.map((nom, i) => (
          <NomineeRow key={i} nom={nom} pillColor={pillColor} />
        ))}
      </div>

      {invalidRefs.length > 0 && (
        <div className="text-xs text-amber-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Invalid refs skipped: {invalidRefs.join(', ')}
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

function SynthesisPreflightResult({ data }: { data: Record<string, unknown> }) {
  const { gemMap, ready: gemReady } = useGemLookup();
  const { nodeIconMap, spriteConfig, zoomLevel, nodeStatsMap, nodeTypeMap, nodeIdMap } = useTreeNodeEnrichment();
  const [tooltip, setTooltip] = useState<TreeToolTooltipState | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const showTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
    const stats = nodeStatsMap.get(name);
    if (stats && stats.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
    }
  };
  const hideTooltip = () => setTooltip(null);

  const SIGNIFICANT_TYPES = new Set(['notable', 'keystone', 'mastery', 'ascendancy']);
  const resolveSignificant = (ids: number[] | undefined) =>
    (ids ?? [])
      .map(id => nodeIdMap.get(id))
      .filter((n): n is { name: string; type: string; stats?: string[] } =>
        n != null && n.name !== '' && SIGNIFICANT_TYPES.has(n.type)
      );

  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  const toggleExpansion = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const combosTested = data.combosTested as number | undefined;
  const showingTop = data.showingTop as number | undefined;
  const top3 = (data.top3 ?? []) as Array<{
    label: string;
    fromRefs?: string[];
    dps: { change: number; pct: number } | number;
    ehp: { change: number; pct: number } | number;
    life: { change: number; pct: number } | number;
    dpsPct?: number;
    ehpPct?: number;
    compositeScore: number;
    status?: string;
    hardConstraintViolations?: string[];
    attributeBreaches?: Array<{ attr: string; current: number; required: number; deficit: number }>;
    resistances?: { fire: number; cold: number; lightning: number; chaos: number };
    significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
    warnings?: string[];
    appliedChanges?: { treeNodesAdded: number; treeNodesRemoved: number; gearSlotsChanged: number; gemSwaps: number };
    changeDetail?: {
      treeNodes?: { add: number[]; remove: number[] };
      gearItems: Array<{ slot: string; itemText: string }>;
      gemSwaps: Array<{
      group: number;
      op?: 'swap' | 'add' | 'remove' | 'adjust';
      removed: string;
      added: string;
      level?: number;
      quality?: number;
    }>;
    };
  }>;

  if (top3.length === 0) {
    const noNominations = data.noNominations as boolean | undefined;
    return (
      <div className="text-sm text-amber-400/70 px-1">
        {noNominations
          ? 'No pathway nominations available \u2014 pathway agents may not have called nominate_for_synthesis.'
          : 'No combos tested.'}
      </div>
    );
  }

  return (
    <div className="text-sm px-1 space-y-2">
      <div className="text-xs text-stone-400">
        Tested {combosTested != null ? formatNumber(combosTested) : '?'} combos
        {showingTop != null ? `, showing top ${showingTop}` : ''}
      </div>

      <div className="space-y-1.5">
        {top3.map((combo, i) => {
          // Backward compat: normalize old flat dpsPct/ehpPct to object shape
          const dps = typeof combo.dps === 'object' ? combo.dps : { change: 0, pct: combo.dpsPct ?? 0 };
          const ehp = typeof combo.ehp === 'object' ? combo.ehp : { change: 0, pct: combo.ehpPct ?? 0 };
          const life = typeof combo.life === 'object' ? combo.life : { change: 0, pct: 0 };

          const hardViolations = combo.hardConstraintViolations ?? [];
          const attrBreaches = combo.attributeBreaches ?? [];
          const warnings = combo.warnings ?? [];
          const extras = combo.significantExtras ?? [];

          const treeNodes = combo.changeDetail?.treeNodes;
          const hasTreeNodes = treeNodes && (treeNodes.add.length > 0 || treeNodes.remove.length > 0);
          const gemSwaps = combo.changeDetail?.gemSwaps ?? [];
          const gearItems = combo.changeDetail?.gearItems ?? [];

          const removedSignificant = hasTreeNodes ? resolveSignificant(treeNodes.remove) : [];
          const addedSignificant = hasTreeNodes ? resolveSignificant(treeNodes.add) : [];
          const hasSwap = removedSignificant.length > 0;

          const hasExpandableGear = gearItems.length > 0;
          const isExpanded = expandedItems.has(i);

          // Border color: best combo gets amber, constraint issues get red/amber, rest muted
          const comboBorder = (): string => {
            if (hardViolations.length > 0) return 'border-red-500/50';
            if (attrBreaches.length > 0 || warnings.length > 0) return 'border-amber-500/50';
            if (i === 0) return 'border-amber-500/60';
            return 'border-stone-600/40';
          };

          return (
            <div
              key={i}
              className={cn(
                'py-1.5 px-2 rounded-md bg-slate-900/40 text-xs',
                'border-l-2',
                comboBorder(),
              )}
            >
              {/* Row 1: Rank + combo pills */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-stone-500 flex-shrink-0 w-4 text-center font-mono">
                  #{i + 1}
                </span>
                {combo.fromRefs && combo.fromRefs.length > 0 ? (
                  <span className="flex items-center gap-0.5 flex-wrap">
                    {combo.fromRefs.map((ref, si) => {
                      const pathway = inferPathwayFromRef(ref);
                      const color = pathway
                        ? (NOMINEE_PATHWAY_COLORS[pathway] ?? DEFAULT_NOMINEE_COLOR)
                        : DEFAULT_NOMINEE_COLOR;
                      const segments = combo.label.split(' + ');
                      const segLabel = segments[si] ?? ref;
                      return (
                        <Fragment key={si}>
                          <span
                            role="link"
                            tabIndex={0}
                            onClick={() => {
                              const found = navigateToRef(ref);
                              if (!found) navigateToRefCrossTab(ref);
                            }}
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[0.625rem] font-semibold cursor-pointer',
                              'hover:brightness-125 transition-all duration-200',
                              color.bg, color.text,
                            )}
                          >
                            {segLabel}
                          </span>
                          {si < combo.fromRefs!.length - 1 && (
                            <span className="text-stone-600 text-[0.625rem]">+</span>
                          )}
                        </Fragment>
                      );
                    })}
                  </span>
                ) : (
                  <span className="text-stone-200 font-medium truncate">
                    {combo.label}
                  </span>
                )}
                {/* Composite score badge */}
                <span className={cn(
                  'ml-auto text-[0.625rem] px-1.5 py-0.5 rounded border font-mono font-medium shrink-0',
                  'bg-amber-500/15 text-amber-400 border-amber-500/20',
                )}>
                  {combo.compositeScore.toFixed(1)}
                </span>
              </div>

              {/* Row 2: Inline tree node visualization */}
              {(addedSignificant.length > 0 || removedSignificant.length > 0) && (
                <div className="flex items-center gap-1 flex-wrap mb-1 pl-5">
                  {removedSignificant.map((node, ni) => (
                    <div
                      key={`rem-${ni}`}
                      className={cn(
                        'relative opacity-60',
                        (nodeStatsMap.has(node.name)) ? 'cursor-help' : 'cursor-default',
                      )}
                      onMouseEnter={(e) => showTooltip(e, node.name, 'text-red-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={node.name}
                        nodeType={node.type}
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={18}
                      />
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500/90 flex items-center justify-center text-[0.4375rem] text-white font-bold shadow-sm">
                        &minus;
                      </div>
                    </div>
                  ))}
                  {hasSwap && (
                    <ArrowRight className="w-3 h-3 text-slate-500 mx-0.5 flex-shrink-0" />
                  )}
                  {addedSignificant.map((node, ni) => (
                    <div
                      key={`add-${ni}`}
                      className={cn(
                        'relative',
                        (nodeStatsMap.has(node.name)) ? 'cursor-help' : 'cursor-default',
                      )}
                      onMouseEnter={(e) => showTooltip(e, node.name, 'text-emerald-300')}
                      onMouseLeave={hideTooltip}
                    >
                      <TreeNodeBadge
                        name={node.name}
                        nodeType={node.type}
                        nodeIconMap={nodeIconMap}
                        spriteConfig={spriteConfig}
                        zoomLevel={zoomLevel}
                        size={18}
                      />
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500/90 flex items-center justify-center text-[0.4375rem] text-white font-bold shadow-sm">
                        +
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Row 3: Inline gem swap visualization */}
              {gemSwaps.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-1 pl-5">
                  {gemSwaps.map((gs, gs_idx) => {
                    const ns = normalizeGemSwapEntry(gs);
                    return (
                      <div key={gs_idx} className="flex items-center gap-1">
                        {ns.op === 'adjust' ? (
                          <GemTooltipTrigger
                            gem={{ name: ns.added, level: ns.level, quality: ns.quality }}
                            gemMap={gemMap}
                            ready={gemReady}
                          >
                            <div className="cursor-help">
                              <ToolGemOrb
                                gem={{ name: ns.added, level: ns.level, quality: ns.quality }}
                                gemMap={gemMap}
                                ready={gemReady}
                                size="xs"
                                marker="adjust"
                              />
                            </div>
                          </GemTooltipTrigger>
                        ) : (
                          <>
                            {ns.removed && (
                              <GemTooltipTrigger
                                gem={{ name: ns.removed }}
                                gemMap={gemMap}
                                ready={gemReady}
                              >
                                <div className="cursor-help">
                                  <ToolGemOrb
                                    gem={{ name: ns.removed }}
                                    gemMap={gemMap}
                                    ready={gemReady}
                                    size="xs"
                                    marker="remove"
                                    dimmed
                                  />
                                </div>
                              </GemTooltipTrigger>
                            )}
                            {ns.removed && ns.added && (
                              <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            )}
                            {ns.added && (
                              <GemTooltipTrigger
                                gem={{ name: ns.added }}
                                gemMap={gemMap}
                                ready={gemReady}
                              >
                                <div className="cursor-help">
                                  <ToolGemOrb
                                    gem={{ name: ns.added }}
                                    gemMap={gemMap}
                                    ready={gemReady}
                                    size="xs"
                                    marker="add"
                                  />
                                </div>
                              </GemTooltipTrigger>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Row 4: Inline gear slot pills */}
              {gearItems.length > 0 && (
                <div className="flex items-center gap-1.5 mb-1 pl-5 text-[0.625rem]">
                  <Layers className="w-3 h-3 text-amber-400/60" />
                  <span className="text-stone-400">Gear</span>
                  <div className="flex flex-wrap gap-0.5">
                    {gearItems.map((gi, gi_idx) => (
                      <span key={gi_idx} className="px-1 py-px rounded bg-amber-900/20 text-amber-400/70 text-[0.5625rem] font-medium">
                        {gi.slot}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 5: Stat deltas with trend icons */}
              <div className="flex items-center gap-2 pl-5 font-mono text-xs">
                <span className={cn('flex items-center gap-0.5', deltaColor(dps.pct))}>
                  {dps.pct > 0 && <TrendingUp className="w-3 h-3" />}
                  {dps.pct < 0 && <TrendingDown className="w-3 h-3" />}
                  {dps.pct > 0 ? '+' : ''}{dps.pct.toFixed(1)}% DPS
                </span>
                <span className={cn('flex items-center gap-0.5', deltaColor(ehp.pct))}>
                  {ehp.pct > 0 && <TrendingUp className="w-3 h-3" />}
                  {ehp.pct < 0 && <TrendingDown className="w-3 h-3" />}
                  {ehp.pct > 0 ? '+' : ''}{ehp.pct.toFixed(1)}% EHP
                </span>
                {life.pct !== 0 && (
                  <span className={cn('flex items-center gap-0.5', deltaColor(life.pct))}>
                    {life.pct > 0 ? '+' : ''}{life.pct.toFixed(1)}% Life
                  </span>
                )}
              </div>

              {/* Row 6: Significant extras pills */}
              {extras.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 pl-5">
                  {extras.map((extra, ei) => (
                    <span
                      key={ei}
                      className={`text-[0.625rem] px-1 py-0.5 rounded ${
                        extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {formatExtraPill(extra)}
                    </span>
                  ))}
                </div>
              )}

              {/* Row 7: Constraint warnings */}
              {hardViolations.length > 0 && (
                <div className="mt-1 pl-5 space-y-0.5">
                  {hardViolations.slice(0, 3).map((v, vi) => (
                    <div key={vi} className="text-[0.6875rem] text-red-400/90">
                      {v}
                    </div>
                  ))}
                </div>
              )}
              {attrBreaches.length > 0 && (
                <div className="mt-1 pl-5 space-y-0.5">
                  {attrBreaches.map((ab, abi) => (
                    <div key={abi} className="flex items-center gap-1 text-[0.6875rem] text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {ab.attr} breach: {ab.current}/{ab.required} ({'\u2212'}{ab.deficit})
                    </div>
                  ))}
                </div>
              )}
              {combo.resistances && (() => {
                const uncapped: string[] = [];
                if (combo.resistances.fire < 75) uncapped.push(`Fire ${combo.resistances.fire}%`);
                if (combo.resistances.cold < 75) uncapped.push(`Cold ${combo.resistances.cold}%`);
                if (combo.resistances.lightning < 75) uncapped.push(`Ltng ${combo.resistances.lightning}%`);
                if (uncapped.length === 0) return null;
                return (
                  <div className="flex items-center gap-1 mt-1 pl-5 text-xs text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    Uncapped: {uncapped.join(', ')}
                  </div>
                );
              })()}
              {warnings.length > 0 && (
                <div className="mt-1 pl-5 space-y-0.5">
                  {warnings.map((w, wi) => (
                    <div key={wi} className="text-[0.6875rem] text-stone-500 italic">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Row 8: Expand/collapse for gear item tooltips */}
              {hasExpandableGear && (
                <button
                  type="button"
                  onClick={() => toggleExpansion(i)}
                  className="mt-1.5 pl-5 flex items-center gap-1 text-[0.6875rem] text-amber-400/60 hover:text-amber-400/90 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 transition-transform duration-200',
                      isExpanded && 'rotate-180',
                    )}
                  />
                  {isExpanded ? 'Hide gear details' : 'Show gear details'}
                </button>
              )}
              <AnimatePresence>
                {isExpanded && hasExpandableGear && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 pt-2 border-t border-[#3a3530]/30 pl-5">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {gearItems.map((gi, gi_idx) => {
                          const parsed = parseRawItemText(gi.itemText);
                          return (
                            <div key={gi_idx} className="flex flex-col items-center gap-1">
                              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400/70 border border-amber-500/15 font-medium uppercase tracking-wider">
                                {gi.slot}
                              </span>
                              <ItemTooltip
                                name={parsed.name}
                                baseName={parsed.baseName}
                                rarity={parsed.rarity}
                                mods={parsed.mods}
                                raw={gi.itemText}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
      <TreeToolTooltip tooltip={tooltip} />
    </div>
  );
}

// =============================================================================
// LoadCraftingRecipeResult — load_crafting_recipe tool renderer
// =============================================================================

function LoadCraftingRecipeResult({ data }: { data: Record<string, unknown> }) {
  const recipes = data.recipes as Array<{
    recipeId?: string;
    metadata?: { name?: string; slot?: string; archetype?: string; budgetTiers?: string[]; recipeCount?: number };
    error?: string;
    hint?: string;
  }> | undefined;
  const loaded = data.loaded as number | undefined;
  const error = data.error as string | undefined;

  if (error && !recipes) {
    return (
      <div className="text-sm px-1">
        <div className="text-red-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return <div className="text-xs text-stone-500 px-1">No recipes loaded</div>;
  }

  return (
    <div className="text-sm px-1 space-y-1">
      {loaded != null && loaded > 1 && (
        <div className="text-[0.625rem] text-stone-500">{loaded} recipes loaded</div>
      )}
      {recipes.map((r, i) => {
        if (r.error) {
          return (
            <div key={i} className="text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {r.error}
            </div>
          );
        }
        const meta = r.metadata;
        return (
          <div key={i} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded bg-slate-900/40">
            <Package className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
            <span className="text-xs text-amber-300 font-medium">
              {meta?.name ?? r.recipeId ?? '?'}
            </span>
            {meta?.slot && (
              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-slate-800/60 text-stone-400 border border-stone-700/30">
                {meta.slot}
              </span>
            )}
            {meta?.archetype && (
              <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400/70 border border-amber-500/20">
                {meta.archetype}
              </span>
            )}
            {meta?.recipeCount != null && (
              <span className="text-[0.625rem] text-stone-500">
                {meta.recipeCount} tier{meta.recipeCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// CraftItemResult — craft_item tool renderer
// =============================================================================

function CraftItemResult({ data }: { data: Record<string, unknown> }) {
  const [expandedProtocol, setExpandedProtocol] = useState<number | null>(null);
  const results = (data.results ?? []) as Array<{
    protocolName?: string;
    successRate?: number;
    cost?: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number; mean?: number };
    baseCost?: number;
    baseCostDivine?: number;
    totalMedianCost?: number;
    totalMedianCostDivine?: number;
    baseCostNote?: string;
    baseTradeUrl?: string;
    craftingSteps?: Array<{
      step?: number;
      action?: string;
      method?: string;
      currency?: string;
      costPerAttempt?: number;
      medianAttempts?: number;
      medianStepCost?: number;
      checkCondition?: string;
      onSuccess?: string;
      onFailure?: string;
    }>;
    currencyBreakdown?: Record<string, number>;
    exampleItems?: Array<{ mods?: string[] }>;
    trials?: number;
    executionTimeMs?: number;
    warning?: string;
    error?: string;
  }>;
  const totalMedianCost = Number(data.totalMedianCost ?? 0);
  const totalMedianCostDivine = data.totalMedianCostDivine as number | undefined;
  const divineRate = data.divineRate as number | undefined;
  const topError = data.error as string | undefined;

  if (results.length === 0 && !topError) {
    return <DefaultResult data={data} />;
  }

  /** Success rate badge color */
  const rateBadge = (rate: number): string => {
    if (rate >= 50) return 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30';
    if (rate >= 20) return 'bg-amber-900/40 text-amber-300 border-amber-500/30';
    return 'bg-red-900/40 text-red-300 border-red-500/30';
  };

  /** Format chaos value compactly */
  const fmtChaos = (v: number): string => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return Math.round(v).toLocaleString();
  };

  return (
    <div className="text-sm px-1 space-y-2">
      {/* Top-level error */}
      {topError && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      {/* Header with total budget */}
      {results.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <span className="text-[0.6875rem] font-display font-semibold text-amber-400/90 uppercase tracking-wider">
            Crafting Simulation
          </span>
          {totalMedianCost > 0 && (
            <>
              <div className="flex-1 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
              <span className="text-[0.6875rem] font-mono text-stone-300">
                <span className="text-amber-300 font-semibold" style={{ textShadow: '0 0 8px rgba(251, 191, 36, 0.3)' }}>
                  {fmtChaos(totalMedianCost)}c
                </span>
                {totalMedianCostDivine && (
                  <span className="text-amber-200/60"> ({totalMedianCostDivine} div)</span>
                )}
              </span>
            </>
          )}
        </div>
      )}

      {/* Per-protocol results */}
      {results.map((r, idx) => {
        const isExpanded = expandedProtocol === idx;
        const rate = r.successRate ?? 0;
        const p50 = r.cost?.p50 ?? 0;
        const p10 = r.cost?.p10 ?? 0;
        const p90 = r.cost?.p90 ?? 0;
        const hasBreakdown = r.currencyBreakdown && Object.keys(r.currencyBreakdown).length > 0;

        return (
          <div key={idx} className="space-y-1">
            {/* Protocol row */}
            <button
              type="button"
              onClick={() => setExpandedProtocol(isExpanded ? null : idx)}
              className="relative flex items-center gap-2 w-full text-left py-1.5 px-2.5 rounded transition-colors overflow-hidden"
              style={{
                background: isExpanded
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)'
                  : 'rgba(15, 23, 42, 0.4)',
                border: `1px solid ${isExpanded ? 'rgba(251, 191, 36, 0.15)' : 'rgba(100, 116, 139, 0.15)'}`,
              }}
            >
              {/* Protocol name */}
              <span className="text-xs text-stone-200 font-medium truncate flex-1">
                {r.protocolName ?? `Protocol ${idx + 1}`}
              </span>

              {/* Error state */}
              {r.error && (
                <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-500/30">
                  Error
                </span>
              )}

              {/* Success rate badge */}
              {!r.error && (
                <span className={cn(
                  'text-[0.625rem] px-1.5 py-0.5 rounded border font-semibold tabular-nums flex-shrink-0',
                  rateBadge(rate),
                )}>
                  {rate.toFixed(1)}%
                </span>
              )}

              {/* Cost range with inline distribution bar */}
              {!r.error && p50 > 0 && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[0.625rem] font-mono text-stone-500 w-[3rem] text-right">{fmtChaos(p10)}c</span>
                  <div className="relative w-16 h-3 rounded-full bg-slate-800/60 overflow-hidden border border-stone-700/30">
                    {/* p10–p90 range bar */}
                    <div
                      className="absolute top-0 bottom-0 bg-amber-500/20 rounded-full"
                      style={{
                        left: `${p90 > 0 ? Math.round((p10 / p90) * 100) : 0}%`,
                        right: '0%',
                      }}
                    />
                    {/* p50 marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80"
                      style={{ left: `${p90 > 0 ? Math.round((p50 / p90) * 100) : 50}%` }}
                    />
                  </div>
                  <span className="text-[0.625rem] font-mono text-stone-500 w-[3rem]">{fmtChaos(p90)}c</span>
                  <span className="text-xs font-mono text-amber-300 font-semibold">{fmtChaos(p50)}c</span>
                </div>
              )}

              {/* Expand chevron — always show since we have steps/URL/breakdown */}
              {(hasBreakdown || r.craftingSteps?.length || r.baseTradeUrl) && (
                <ChevronDown className={cn(
                  'w-3 h-3 text-stone-500 transition-transform flex-shrink-0',
                  isExpanded && 'rotate-180',
                )} />
              )}
            </button>

            {/* Warning */}
            {r.warning && (
              <div className="flex items-start gap-1.5 text-xs text-amber-400/80 ml-2.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{r.warning}</span>
              </div>
            )}

            {/* Error detail */}
            {r.error && (
              <div className="flex items-start gap-1.5 text-xs text-red-400 ml-2.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{r.error}</span>
              </div>
            )}

            {/* Expanded: base trade link + crafting steps + currency breakdown */}
            {isExpanded && (hasBreakdown || r.craftingSteps?.length || r.baseTradeUrl) && (
              <div className="ml-2.5 space-y-2">
                {/* Base item trade link — teal trade pill style */}
                {r.baseTradeUrl && (
                  <div
                    className="px-2.5 py-2 rounded-lg flex items-center gap-2.5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.06) 0%, rgba(15, 23, 42, 0.5) 100%)',
                      border: '1px solid rgba(20, 184, 166, 0.2)',
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(13, 148, 136, 0.08) 100%)',
                        border: '1px solid rgba(20, 184, 166, 0.25)',
                      }}
                    >
                      <ShoppingBag className="w-3 h-3 text-teal-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[0.625rem] text-teal-300/70 uppercase tracking-wider font-medium">Buy Base</span>
                      <a
                        href={r.baseTradeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-300 hover:text-teal-200 truncate transition-colors"
                        style={{ textShadow: '0 0 6px rgba(45, 212, 191, 0.2)' }}
                      >
                        Open trade search
                        <ExternalLink className="w-2.5 h-2.5 inline ml-1 -mt-0.5" />
                      </a>
                    </div>
                    {r.baseCost != null && r.baseCost > 0 && (
                      <span className="text-xs font-mono text-teal-300 font-semibold flex-shrink-0">
                        ~{fmtChaos(r.baseCost)}c
                        {r.baseCostDivine && <span className="text-teal-400/60 font-normal"> ({r.baseCostDivine} div)</span>}
                      </span>
                    )}
                  </div>
                )}

                {/* Crafting steps */}
                {r.craftingSteps && r.craftingSteps.length > 0 && (
                  <div
                    className="relative px-2.5 py-2 rounded-lg space-y-1.5 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.03) 0%, rgba(15, 23, 42, 0.5) 100%)',
                      border: '1px solid rgba(251, 191, 36, 0.1)',
                    }}
                  >
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[2px]"
                      style={{ background: 'linear-gradient(180deg, rgba(251, 191, 36, 0.5) 0%, rgba(251, 191, 36, 0.1) 100%)' }}
                    />
                    <div className="flex items-center gap-1.5 mb-1">
                      <GitBranch className="w-3 h-3 text-amber-400/70" />
                      <span className="text-[0.625rem] font-display text-amber-400/80 uppercase tracking-wider font-semibold">
                        Crafting Steps
                      </span>
                    </div>
                    {r.craftingSteps.map((step, si) => (
                      <div key={si} className="space-y-0.5">
                        <div className="flex items-start gap-1.5 text-xs">
                          <span
                            className="text-[0.625rem] font-mono flex-shrink-0 w-4 text-right font-bold"
                            style={{ color: 'rgba(251, 191, 36, 0.7)' }}
                          >
                            {step.step}.
                          </span>
                          <span className="text-stone-200">{step.action}</span>
                          {step.medianStepCost != null && step.medianStepCost > 0 && (
                            <span className="text-amber-300/70 font-mono ml-auto flex-shrink-0 text-[0.625rem]">
                              ~{fmtChaos(step.medianStepCost)}c
                            </span>
                          )}
                        </div>
                        {step.costPerAttempt != null && step.medianAttempts != null && step.method !== 'bench' && (
                          <div className="text-[0.5625rem] text-stone-500 pl-[1.375rem] font-mono">
                            {step.costPerAttempt}c × ~{step.medianAttempts} attempts
                          </div>
                        )}
                        {step.checkCondition && (
                          <div className="text-[0.5625rem] text-stone-500 pl-[1.375rem]">
                            <ArrowRight className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5 text-stone-600" />
                            {step.checkCondition}
                            {step.onSuccess && <span className="text-emerald-400/60"> → {step.onSuccess}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Total line */}
                    {r.totalMedianCost != null && r.totalMedianCost > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1.5 mt-1" style={{ borderTop: '1px solid rgba(251, 191, 36, 0.1)' }}>
                        <span className="text-stone-400 text-[0.625rem]">Total (base + craft)</span>
                        <span className="font-mono font-semibold" style={{ color: '#fbbf24', textShadow: '0 0 8px rgba(251, 191, 36, 0.3)' }}>
                          ~{fmtChaos(r.totalMedianCost)}c
                          {r.totalMedianCostDivine && <span className="text-amber-200/50 font-normal text-[0.625rem]"> ({r.totalMedianCostDivine} div)</span>}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Currency breakdown */}
                {hasBreakdown && (
                  <div
                    className="px-2.5 py-1.5 rounded-lg space-y-1"
                    style={{
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(100, 116, 139, 0.12)',
                    }}
                  >
                    <div className="text-[0.5625rem] text-stone-500 uppercase tracking-wider font-medium">
                      Currency (median)
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {Object.entries(r.currencyBreakdown!)
                        .sort(([, a], [, b]) => b - a)
                        .map(([currency, count]) => (
                          <div key={currency} className="flex items-center justify-between text-xs">
                            <span className="text-stone-400 truncate text-[0.625rem]">{currency}</span>
                            <span className="text-stone-300 font-mono ml-2 text-[0.625rem]">{Math.round(count)}×</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// Unified Build — Inline Item Icon with hover tooltip
// =============================================================================

const INLINE_RARITY_STYLES: Record<string, { border: string; glow: string }> = {
  NORMAL: { border: 'border-stone-600/60', glow: '' },
  MAGIC: { border: 'border-blue-500/70', glow: 'shadow-[0_0_4px_rgba(59,130,246,0.25)]' },
  RARE: { border: 'border-yellow-500/70', glow: 'shadow-[0_0_4px_rgba(234,179,8,0.25)]' },
  UNIQUE: { border: 'border-orange-500/80', glow: 'shadow-[0_0_5px_rgba(249,115,22,0.35)]' },
};

function buildWikiIconUrl(name: string): string {
  const encoded = encodeURIComponent(name.replace(/ /g, '_'));
  return `https://www.poewiki.net/wiki/Special:Redirect/file/${encoded}_inventory_icon.png`;
}

const TOOL_CARD_FLASK_BASES = [
  'Divine Life Flask',
  'Eternal Life Flask',
  'Sanctified Life Flask',
  'Hallowed Life Flask',
  'Bubbling Life Flask',
  'Seething Life Flask',
  'Divine Mana Flask',
  'Eternal Mana Flask',
  'Sanctified Mana Flask',
  'Hallowed Mana Flask',
  'Diamond Flask',
  'Jade Flask',
  'Granite Flask',
  'Basalt Flask',
  'Quartz Flask',
  'Silver Flask',
  'Ruby Flask',
  'Sapphire Flask',
  'Topaz Flask',
  'Amethyst Flask',
  'Bismuth Flask',
  'Quicksilver Flask',
  'Stibnite Flask',
  'Sulphur Flask',
  'Aquamarine Flask',
].sort((a, b) => b.length - a.length);

function extractCleanToolCardFlaskBase(name: string): string | null {
  if (!name) return null;
  for (const base of TOOL_CARD_FLASK_BASES) {
    if (name.includes(base)) return base;
  }
  return null;
}

// Slot → sidebar dimensions (cells × 40px), scaled to 80%
const INLINE_SLOT_SIZES: Record<string, { w: number; h: number }> = {
  'Weapon 1': { w: 64, h: 128 },
  'Weapon 2': { w: 64, h: 128 },
  'Helmet': { w: 64, h: 64 },
  'Body Armour': { w: 64, h: 96 },
  'Gloves': { w: 64, h: 64 },
  'Boots': { w: 64, h: 64 },
  'Belt': { w: 64, h: 32 },
  'Amulet': { w: 32, h: 32 },
  'Ring 1': { w: 32, h: 32 },
  'Ring 2': { w: 32, h: 32 },
  'Jewel': { w: 32, h: 32 },
  'Flask 1': { w: 32, h: 64 },
  'Flask 2': { w: 32, h: 64 },
  'Flask 3': { w: 32, h: 64 },
  'Flask 4': { w: 32, h: 64 },
  'Flask 5': { w: 32, h: 64 },
};
const INLINE_DEFAULT_SIZE = { w: 64, h: 64 };

/** Compact item icon with game art + hover tooltip, mirroring the gear sidebar. */
function InlineItemIcon({ slot, itemText, display, preResolvedIconUrl, preResolvedFallbackUrl }: {
  slot: string;
  itemText: string;
  display?: GearItemDetail['display'];
  preResolvedIconUrl?: string;
  preResolvedFallbackUrl?: string;
}) {
  const dims = INLINE_SLOT_SIZES[slot] || INLINE_DEFAULT_SIZE;
  const parsed = parseRawItemText(itemText);
  // Use display data for name/rarity when available (more reliable than raw text parsing)
  const effectiveName = display?.name || parsed.name;
  // Strip variant suffixes like "(Armour/Energy Shield)" for icon lookups
  const effectiveBaseName = (display?.baseName || parsed.baseName).replace(/\s*\([^)]*\)\s*$/, '');
  const cleanFlaskBaseName = slot.toLowerCase().includes('flask')
    ? extractCleanToolCardFlaskBase(effectiveBaseName) ?? effectiveBaseName
    : null;
  const rarity = (display?.rarity?.toUpperCase() || parsed.rarity).toUpperCase();
  const rarityStyle = INLINE_RARITY_STYLES[rarity] || INLINE_RARITY_STYLES.NORMAL;

  // Prefer backend-provided icon URLs (CDN for bases, wiki for uniques), fall back to client-side wiki resolution
  const clientIconName = rarity === 'UNIQUE' && effectiveName ? effectiveName : effectiveBaseName;
  const iconUrl = preResolvedIconUrl ?? (clientIconName ? buildWikiIconUrl(clientIconName) : null);
  const fallbackUrl = preResolvedFallbackUrl
    ?? (slot.toLowerCase().includes('flask') && cleanFlaskBaseName ? buildWikiIconUrl(cleanFlaskBaseName) : null)
    ?? (rarity === 'UNIQUE' && effectiveBaseName ? buildWikiIconUrl(effectiveBaseName) : null);

  // Use structured display data (has tiers) when available, fall back to raw text parsing
  const tooltipProps = display
    ? gearDisplayToTooltipProps({ display, itemText, slot } as GearItemDetail)
    : { ...parsed, raw: itemText };

  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            className="flex flex-col items-center gap-0.5 cursor-pointer"
          >
            {/* Slot label */}
            <span className="text-[0.5rem] px-1 py-px rounded bg-amber-900/20 text-amber-400/60 border border-amber-500/10 font-medium uppercase tracking-wider leading-tight">
              {slot}
            </span>
            {/* Item icon box */}
            <div
              className={cn(
                'relative rounded-sm overflow-hidden',
                'bg-gradient-to-b from-[#2a2520] via-[#1f1b17] to-[#18140f]',
                'border border-[#3a3530]/60',
                'hover:border-[#4a4540]/80 transition-all duration-150',
              )}
              style={{ width: dims.w, height: dims.h }}
            >
              {/* Inner recess */}
              <div
                className={cn(
                  'absolute flex items-center justify-center overflow-hidden rounded-[1px]',
                  'shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),inset_0_0_8px_rgba(0,0,0,0.8)]',
                  'bg-[#0c0c0e]',
                  rarityStyle.glow,
                )}
                style={{ top: 2, left: 2, right: 2, bottom: 2 }}
              >
                {/* Rarity border */}
                <div className={cn('absolute inset-0 rounded-[1px] pointer-events-none border', rarityStyle.border)} />
                {/* Item art */}
                {iconUrl && !imgFailed ? (
                  <img
                    src={iconUrl}
                    alt={effectiveName || slot}
                    className="max-w-full max-h-full object-contain relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                    style={{ maxWidth: dims.w - 8, maxHeight: dims.h - 8 }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (fallbackUrl && target.src !== fallbackUrl) {
                        target.src = fallbackUrl;
                      } else if (slot.toLowerCase().includes('flask') && cleanFlaskBaseName) {
                        const cleanUrl = buildWikiIconUrl(cleanFlaskBaseName);
                        if (target.src !== cleanUrl) {
                          target.src = cleanUrl;
                        } else {
                          setImgFailed(true);
                        }
                      } else {
                        setImgFailed(true);
                      }
                    }}
                  />
                ) : (
                  <span className="text-[0.5rem] text-stone-500 text-center px-1 leading-tight">
                    {effectiveName || effectiveBaseName || slot}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side="top" sideOffset={6} className="z-50">
            <ItemTooltip
              {...tooltipProps}
            />
            <Tooltip.Arrow className="fill-stone-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// =============================================================================
// Unified Build — Expanded Package Detail
// =============================================================================

const SOURCE_TO_SECTION_KIND: Record<string, string> = {
  gear: 'gear',
  gemSwap: 'gemSwaps',
  skillSetup: 'skillSetups',
  tree: 'tree',
  combined: 'combined',
};

/** Renders expanded rich detail for a single unified top package, matching the individual pathway renderers. */
function ExpandedPackageDetail({ source, result, gemMap, gemReady, enrichment }: {
  source: string;
  result: Record<string, unknown>;
  gemMap: Map<string, GemTooltipPayload>;
  gemReady: boolean;
  enrichment: ReturnType<typeof useTreeNodeEnrichment>;
}) {
  // Tree notable tooltip state (must be before any returns — React hooks rule)
  const [treeTooltip, setTreeTooltip] = useState<TreeToolTooltipState | null>(null);

  const deltaColor = (val: number): string =>
    val > 0 ? 'text-emerald-400' : val < 0 ? 'text-red-400' : 'text-stone-400';

  if (source === 'gear') {
    const r = result as {
      label?: string;
      dps?: { before?: number; after?: number; change?: number; pct?: string };
      ehp?: { before?: number; after?: number; change?: number; pct?: string };
      resistances?: { fire?: number; cold?: number; lightning?: number; chaos?: number };
      warnings?: string[];
      hardConstraintViolations?: string[];
      significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
      configApplied?: string;
      unconstrainedImpact?: {
        dps?: { before?: number; after?: number; change?: number; pct?: string };
        ehp?: { before?: number; after?: number; change?: number; pct?: string };
        note?: string;
      };
      itemDetails?: GearItemDetail[];
    };
    const dpsPct = parsePct(r.dps?.pct);
    const ehpPct = parsePct(r.ehp?.pct);
    const itemDetails = r.itemDetails ?? [];
    const hasItems = itemDetails.some(d => d.display || d.itemText);
    const hasUncappedRes = r.resistances && ['fire', 'cold', 'lightning'].some(
      k => (r.resistances as Record<string, number>)[k] < 75
    );

    return (
      <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1.5">
        {/* Gear items — inline art icons with hover tooltip (icons first for consistency) */}
        {hasItems && (
          <div className="flex flex-wrap gap-1.5">
            {itemDetails.filter(d => d.display || d.itemText).map((detail, di) => (
              <InlineItemIcon
                key={di}
                slot={detail.slot ?? 'Unknown'}
                itemText={detail.itemText ?? detail.display?.raw ?? ''}
                display={detail.display}
                preResolvedIconUrl={detail.iconUrl}
                preResolvedFallbackUrl={detail.fallbackIconUrl}
              />
            ))}
          </div>
        )}
        {/* DPS + EHP with before→after */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={cn('flex items-center gap-0.5', deltaColor(dpsPct))}>
            {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
            {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
            {r.dps?.pct ?? '0%'} DPS
            {r.dps?.before != null && r.dps?.after != null && r.dps.before !== r.dps.after && (
              <span className="text-stone-500 text-[0.625rem] ml-0.5">
                ({formatCompactNumber(r.dps.before)}{'\u2192'}{formatCompactNumber(r.dps.after)})
              </span>
            )}
          </span>
          <span className={cn('flex items-center gap-0.5', deltaColor(ehpPct))}>
            {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
            {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
            {r.ehp?.pct ?? '0%'} EHP
            {r.ehp?.before != null && r.ehp?.after != null && r.ehp.before !== r.ehp.after && (
              <span className="text-stone-500 text-[0.625rem] ml-0.5">
                ({formatCompactNumber(r.ehp.before)}{'\u2192'}{formatCompactNumber(r.ehp.after)})
              </span>
            )}
          </span>
        </div>
        {/* Resistance warning */}
        {hasUncappedRes && r.resistances && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Uncapped: {['fire', 'cold', 'lightning'].filter(k => (r.resistances as Record<string, number>)[k] < 75)
              .map(k => `${k} (${(r.resistances as Record<string, number>)[k]}%)`).join(', ')}
          </div>
        )}
        {/* Significant extras */}
        {r.significantExtras && r.significantExtras.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.significantExtras.map((extra, ei) => (
              <span key={ei} className={`text-[0.625rem] px-1 py-0.5 rounded ${
                extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {formatExtraPill(extra)}
              </span>
            ))}
          </div>
        )}
        {/* Hard constraint violations */}
        {r.hardConstraintViolations && r.hardConstraintViolations.length > 0 && (
          <div className="space-y-0.5">
            {r.hardConstraintViolations.slice(0, 3).map((v, vi) => (
              <div key={vi} className="text-[0.6875rem] text-amber-400/80 italic">{v}</div>
            ))}
          </div>
        )}
        {/* Unconstrained impact */}
        {r.unconstrainedImpact && (
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-blue-500/8 border border-blue-500/15 text-xs">
            <span className="text-blue-400/70 text-[0.625rem] uppercase tracking-wider font-medium shrink-0">If fixed:</span>
            <div className="flex items-center gap-2 font-mono">
              {r.unconstrainedImpact.dps?.pct && (
                <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(r.unconstrainedImpact.dps.pct)))}>
                  {parsePct(r.unconstrainedImpact.dps.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                  {r.unconstrainedImpact.dps.pct} DPS
                </span>
              )}
              {r.unconstrainedImpact.ehp?.pct && (
                <span className={cn('flex items-center gap-0.5', deltaColor(parsePct(r.unconstrainedImpact.ehp.pct)))}>
                  {parsePct(r.unconstrainedImpact.ehp.pct) > 0 && <TrendingUp className="w-3 h-3" />}
                  {r.unconstrainedImpact.ehp.pct} EHP
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (source === 'gemSwap') {
    const r = result as {
      swap?: { removed?: string; added?: string; removedLevel?: number; addedLevel?: number };
      success?: boolean;
      change?: { absolute?: number; percent?: number };
      ehpChange?: { absolute?: number; percent?: number };
      lifeChange?: { absolute?: number; percent?: number };
      significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
      error?: string;
    };
    const percent = r.change?.percent ?? 0;
    const ehpPercent = r.ehpChange?.percent ?? 0;
    const lifePercent = r.lifeChange?.percent ?? 0;

    return (
      <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1.5">
        {/* Gem orbs: removed → added */}
        <div className="flex items-center gap-1.5">
          {r.swap?.removed && (
            <GemTooltipTrigger gem={{ name: r.swap.removed, level: r.swap.removedLevel }} gemMap={gemMap} ready={gemReady}>
              <div className="cursor-help">
                <ToolGemOrb gem={{ name: r.swap.removed, level: r.swap.removedLevel }} gemMap={gemMap} ready={gemReady} size="xs" marker="remove" dimmed />
              </div>
            </GemTooltipTrigger>
          )}
          <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          {r.swap?.added && (
            <GemTooltipTrigger gem={{ name: r.swap.added, level: r.swap.addedLevel }} gemMap={gemMap} ready={gemReady}>
              <div className="cursor-help">
                <ToolGemOrb gem={{ name: r.swap.added, level: r.swap.addedLevel }} gemMap={gemMap} ready={gemReady} size="xs" marker="add" />
              </div>
            </GemTooltipTrigger>
          )}
        </div>
        {/* DPS + EHP + Life deltas */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={cn('flex items-center gap-0.5', deltaColor(percent))}>
            {percent > 0 && <TrendingUp className="w-3 h-3" />}
            {percent < 0 && <TrendingDown className="w-3 h-3" />}
            {percent > 0 ? '+' : ''}{percent.toFixed(1)}% DPS
          </span>
          {ehpPercent !== 0 && (
            <span className={cn('flex items-center gap-0.5', deltaColor(ehpPercent))}>
              {ehpPercent > 0 ? '+' : ''}{ehpPercent.toFixed(1)}% EHP
            </span>
          )}
          {lifePercent !== 0 && (
            <span className={cn('flex items-center gap-0.5', deltaColor(lifePercent))}>
              {lifePercent > 0 ? '+' : ''}{lifePercent.toFixed(1)}% Life
            </span>
          )}
        </div>
        {/* Significant extras */}
        {r.significantExtras && r.significantExtras.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.significantExtras.map((extra, ei) => (
              <span key={ei} className={`text-[0.625rem] px-1 py-0.5 rounded ${
                extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {formatExtraPill(extra)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (source === 'skillSetup') {
    const r = result as {
      label?: string;
      success?: boolean;
      operations?: SkillToolOperation[];
      deltas?: {
        dps?: { absolute?: number; percent?: number };
        totalEhp?: { absolute?: number; percent?: number };
        manaUnreserved?: { absolute?: number; percent?: number };
      };
      feasible?: boolean;
      infeasibleReason?: string;
      operationWarnings?: string[];
      significantExtras?: Array<{ label: string; value: number; percent: number; displayMode?: string }>;
    };
    const dpsPercent = r.deltas?.dps?.percent ?? 0;
    const ehpPercent = r.deltas?.totalEhp?.percent ?? 0;
    const isPositive = dpsPercent > 0 || ehpPercent > 0;
    const isNegative = dpsPercent < 0 && ehpPercent < 0;

    return (
      <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1.5">
        {/* Gem operation row with orb icons */}
        {r.operations && r.operations.length > 0 && (
          <SkillSetupOperationRow
            operations={r.operations}
            gemMap={gemMap}
            ready={gemReady}
            accent={isPositive ? 'emerald' : isNegative ? 'red' : 'amber'}
          />
        )}
        {/* DPS + EHP + mana */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={cn('flex items-center gap-0.5', deltaColor(dpsPercent))}>
            {dpsPercent > 0 && <TrendingUp className="w-3 h-3" />}
            {dpsPercent < 0 && <TrendingDown className="w-3 h-3" />}
            {dpsPercent > 0 ? '+' : ''}{dpsPercent.toFixed(1)}% DPS
          </span>
          <span className={cn('flex items-center gap-0.5', deltaColor(ehpPercent))}>
            {ehpPercent > 0 && <TrendingUp className="w-3 h-3" />}
            {ehpPercent < 0 && <TrendingDown className="w-3 h-3" />}
            {ehpPercent > 0 ? '+' : ''}{ehpPercent.toFixed(1)}% EHP
          </span>
        </div>
        {/* Significant extras */}
        {r.significantExtras && r.significantExtras.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.significantExtras.map((extra, ei) => (
              <span key={ei} className={`text-[0.625rem] px-1 py-0.5 rounded ${
                extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {formatExtraPill(extra)}
              </span>
            ))}
          </div>
        )}
        {/* Infeasible warning */}
        {r.feasible === false && r.infeasibleReason && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {r.infeasibleReason}
          </div>
        )}
        {/* Operation warnings */}
        {r.operationWarnings && r.operationWarnings.length > 0 && (
          <div className="space-y-0.5">
            {r.operationWarnings.map((warn, wi) => (
              <div key={wi} className="flex items-center gap-1 text-xs text-amber-400/80">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (source === 'tree') {
    const r = result as UnifiedTreeResultEntry;
    return (
      <div className="mt-2 pt-2 border-t border-slate-700/30">
        {(r.type === 'jewel_equip') ? (
          <JewelEquipRow result={r} index={0} />
        ) : (r.type === 'cluster_chain') ? (
          <ClusterChainRow result={r} />
        ) : (
          <TreeChangeRow result={r} callNumber={undefined} enrichment={enrichment} />
        )}
      </div>
    );
  }

  if (source === 'combined') {
    // For combined packages, show a summary of what changed
    const r = result as unknown as CombinedChangeResult;
    const dpsPct = typeof r.dps?.pct === 'number' ? r.dps.pct : parsePct(String(r.dps?.pct ?? '0'));
    const ehpPct = typeof r.ehp?.pct === 'number' ? r.ehp.pct : parsePct(String(r.ehp?.pct ?? '0'));
    const lifePct = typeof r.life?.pct === 'number' ? r.life.pct : parsePct(String(r.life?.pct ?? '0'));
    const treeNodes = r.changeDetail?.treeNodes;
    const gearItems = r.changeDetail?.gearItems ?? [];
    const gemSwaps = r.changeDetail?.gemSwaps ?? [];
    const jewelItems = r.changeDetail?.jewelItems ?? [];
    const applied = r.appliedChanges;

    return (
      <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1.5">
        {/* Change summary badges */}
        <div className="flex flex-wrap gap-2 text-[0.625rem]">
          {applied && (applied.treeNodesAdded > 0 || applied.treeNodesRemoved > 0) && (
            <span className="flex items-center gap-1 text-purple-400/80">
              <Network className="w-2.5 h-2.5" />
              {[
                applied.treeNodesAdded > 0 ? `+${applied.treeNodesAdded}` : '',
                applied.treeNodesRemoved > 0 ? `−${applied.treeNodesRemoved}` : '',
              ].filter(Boolean).join('/')} nodes
            </span>
          )}
          {applied && applied.gearSlotsChanged > 0 && (
            <span className="flex items-center gap-1 text-teal-400/80">
              <Layers className="w-2.5 h-2.5" />
              {applied.gearSlotsChanged} slot{applied.gearSlotsChanged > 1 ? 's' : ''}
            </span>
          )}
          {applied && applied.gemSwaps > 0 && (
            <span className="flex items-center gap-1 text-blue-400/80">
              <Gem className="w-2.5 h-2.5" />
              {applied.gemSwaps} swap{applied.gemSwaps > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {/* Visual elements: skill changes, tree changes, gear/jewel icons (icons first for consistency) */}
        {(gemSwaps.length > 0 || (treeNodes && (treeNodes.add?.length || treeNodes.remove?.length))) && (() => {
          const { nodeIconMap, nodeStatsMap, spriteConfig, zoomLevel, nodeIdMap } = enrichment;
          const SIGNIFICANT = new Set(['notable', 'keystone', 'mastery', 'ascendancy']);
          const resolveNodes = (ids: number[] | undefined) =>
            (ids ?? []).map(id => nodeIdMap.get(Number(id))).filter(
              (n): n is { name: string; type: string } => n != null && n.name !== '' && SIGNIFICANT.has(n.type)
            );
          const removedTreeNodes = treeNodes ? resolveNodes(treeNodes.remove) : [];
          const addedTreeNodes = treeNodes ? resolveNodes(treeNodes.add) : [];
          const hasTreeNodes = removedTreeNodes.length > 0 || addedTreeNodes.length > 0;

          const showNodeTooltip = (e: React.MouseEvent, name: string, headerColor: string) => {
            const stats = nodeStatsMap.get(name);
            if (stats && stats.length > 0) {
              const rect = e.currentTarget.getBoundingClientRect();
              setTreeTooltip({ x: rect.right + 8, y: rect.top, name, stats, headerColor });
            }
          };
          const hideNodeTooltip = () => setTreeTooltip(null);

          return (
            <div className="flex flex-wrap gap-4">
              {/* Left: gem swaps */}
              {gemSwaps.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {gemSwaps.map((swap, si) => {
                    const ns = normalizeGemSwapEntry(swap);
                    return (
                      <div key={si} className="flex items-center gap-1">
                        {ns.op === 'adjust' ? (
                          <GemTooltipTrigger gem={{ name: ns.added, level: ns.level, quality: ns.quality }} gemMap={gemMap} ready={gemReady}>
                            <div className="cursor-help">
                              <ToolGemOrb gem={{ name: ns.added, level: ns.level, quality: ns.quality }} gemMap={gemMap} ready={gemReady} size="xs" marker="adjust" />
                            </div>
                          </GemTooltipTrigger>
                        ) : (
                          <>
                            {ns.removed && (
                              <GemTooltipTrigger gem={{ name: ns.removed }} gemMap={gemMap} ready={gemReady}>
                                <div className="cursor-help">
                                  <ToolGemOrb gem={{ name: ns.removed }} gemMap={gemMap} ready={gemReady} size="xs" marker="remove" dimmed />
                                </div>
                              </GemTooltipTrigger>
                            )}
                            {ns.removed && ns.added && (
                              <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                            )}
                            {ns.added && (
                              <GemTooltipTrigger gem={{ name: ns.added }} gemMap={gemMap} ready={gemReady}>
                                <div className="cursor-help">
                                  <ToolGemOrb gem={{ name: ns.added }} gemMap={gemMap} ready={gemReady} size="xs" marker="add" />
                                </div>
                              </GemTooltipTrigger>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Right: tree node badges */}
              {hasTreeNodes && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {removedTreeNodes.map((node, ni) => (
                    <div key={`rm-${ni}`} className="relative opacity-60 cursor-help"
                      onMouseEnter={(e) => showNodeTooltip(e, node.name, 'text-red-300')}
                      onMouseLeave={hideNodeTooltip}
                    >
                      <TreeNodeBadge name={node.name} nodeType={node.type} nodeIconMap={nodeIconMap} spriteConfig={spriteConfig} zoomLevel={zoomLevel} size={22} />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">&minus;</div>
                    </div>
                  ))}
                  {removedTreeNodes.length > 0 && addedTreeNodes.length > 0 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 mx-0.5 flex-shrink-0" />
                  )}
                  {addedTreeNodes.map((node, ni) => (
                    <div key={`add-${ni}`} className="relative cursor-help"
                      onMouseEnter={(e) => showNodeTooltip(e, node.name, 'text-emerald-300')}
                      onMouseLeave={hideNodeTooltip}
                    >
                      <TreeNodeBadge name={node.name} nodeType={node.type} nodeIconMap={nodeIconMap} spriteConfig={spriteConfig} zoomLevel={zoomLevel} size={22} />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500/90 flex items-center justify-center text-[0.5rem] text-white font-bold shadow-sm">+</div>
                    </div>
                  ))}
                  <TreeToolTooltip tooltip={treeTooltip} />
                </div>
              )}
            </div>
          );
        })()}
        {/* Gear items — inline art icons with hover tooltip (deduplicate by slot, last wins) */}
        {gearItems.length > 0 && (() => {
          const deduped = [...new Map(gearItems.map(gi => [gi.slot.toLowerCase(), gi])).values()];
          return (
            <div className="flex flex-wrap gap-1.5">
              {deduped.map((gi, gi_idx) => (
                <InlineItemIcon
                  key={gi_idx}
                  slot={gi.slot}
                  itemText={gi.itemText}
                  display={gi.display}
                  preResolvedIconUrl={gi.iconUrl}
                  preResolvedFallbackUrl={gi.fallbackIconUrl}
                />
              ))}
            </div>
          );
        })()}
        {/* Jewel items — same tooltip pattern as gear items */}
        {jewelItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {jewelItems.map((ji, ji_idx) => (
              <InlineItemIcon
                key={`jewel-${ji_idx}`}
                slot="Jewel"
                itemText={ji.jewelText}
              />
            ))}
          </div>
        )}
        {/* Stat deltas (after icons for consistent layout) */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={cn('flex items-center gap-0.5', deltaColor(dpsPct))}>
            {dpsPct > 0 && <TrendingUp className="w-3 h-3" />}
            {dpsPct < 0 && <TrendingDown className="w-3 h-3" />}
            {dpsPct > 0 ? '+' : ''}{dpsPct.toFixed(1)}% DPS
          </span>
          <span className={cn('flex items-center gap-0.5', deltaColor(ehpPct))}>
            {ehpPct > 0 && <TrendingUp className="w-3 h-3" />}
            {ehpPct < 0 && <TrendingDown className="w-3 h-3" />}
            {ehpPct > 0 ? '+' : ''}{ehpPct.toFixed(1)}% EHP
          </span>
          {lifePct !== 0 && (
            <span className={cn('flex items-center gap-0.5', deltaColor(lifePct))}>
              {lifePct > 0 ? '+' : ''}{lifePct.toFixed(1)}% Life
            </span>
          )}
        </div>
        {/* Significant extras */}
        {r.significantExtras && r.significantExtras.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.significantExtras.map((extra, ei) => (
              <span key={ei} className={`text-[0.625rem] px-1 py-0.5 rounded ${
                extra.value >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {formatExtraPill(extra)}
              </span>
            ))}
          </div>
        )}
        {/* Show on Tree — at the bottom, consistent with TreeChangeRow */}
        {treeNodes && (treeNodes.add?.length || treeNodes.remove?.length) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const store = useDesktopStore.getState();
                store.setTreeDiffNodes({
                  added: (treeNodes.add ?? []).map(Number),
                  removed: (treeNodes.remove ?? []).map(Number),
                });
                store.setActiveUnifiedTab('tree');
              }}
              className="inline-flex items-center gap-1 text-[0.625rem] px-2 py-0.5 rounded bg-sky-500/8 border border-sky-500/20 text-sky-400/90 hover:bg-sky-500/15 hover:border-sky-500/40 hover:text-sky-300 transition-all duration-150 cursor-pointer"
            >
              <Network className="w-2.5 h-2.5" /> Show on Tree
            </button>
          </div>
        )}
        {/* Constraint violations */}
        {r.hardConstraintViolations && r.hardConstraintViolations.length > 0 && (
          <div className="space-y-0.5">
            {r.hardConstraintViolations.slice(0, 3).map((v, vi) => (
              <div key={vi} className="text-[0.6875rem] text-amber-400/80 italic">{v}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/** Renders inline change detail for a top package based on source type. */
function TopPackageChangeDetail({ source, detail, enrichment }: {
  source: string;
  detail: Record<string, unknown>;
  enrichment?: ReturnType<typeof useTreeNodeEnrichment>;
}) {
  if (source === 'gemSwap') {
    const removed = typeof detail.removed === 'string' ? detail.removed : null;
    const added = typeof detail.added === 'string' ? detail.added : null;
    if (!removed && !added) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-[0.625rem]">
        {removed && <span className="text-red-400/80">{removed}</span>}
        <ArrowRight className="w-2.5 h-2.5 text-stone-500" />
        {added && <span className="text-emerald-400/80">{added}</span>}
      </div>
    );
  }

  if (source === 'gear') {
    const slots = Array.isArray(detail.slots) ? detail.slots.filter((s): s is string => typeof s === 'string') : [];
    if (slots.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {slots.map((slot, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded text-[0.5625rem] text-teal-300 bg-teal-500/10 border border-teal-500/20">
            {slot}
          </span>
        ))}
      </div>
    );
  }

  if (source === 'skillSetup') {
    const operations = Array.isArray(detail.operations)
      ? detail.operations as Array<Record<string, unknown>>
      : [];
    if (operations.length === 0) return null;
    return (
      <div className="flex flex-col gap-0.5 mt-1.5 text-[0.625rem]">
        {operations.slice(0, 3).map((op, i) => {
          const action = String(op.action ?? '');
          const gem = typeof op.gem === 'string' ? op.gem : null;
          const result = typeof op.result === 'string' ? op.result : null;
          const actionColor = action === 'remove' ? 'text-red-400/80'
            : action === 'add' ? 'text-emerald-400/80'
            : 'text-blue-400/80';
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span className={cn('uppercase font-medium tracking-wide', actionColor)}>{action}</span>
              {gem && <span className="text-stone-300">{gem}</span>}
              {result && (
                <>
                  <ArrowRight className="w-2.5 h-2.5 text-stone-500" />
                  <span className="text-stone-300">{result}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (source === 'tree') {
    const addedNodes = Array.isArray(detail.addedNodes) ? detail.addedNodes.filter((n): n is string => typeof n === 'string') : [];
    const removedNodes = Array.isArray(detail.removedNodes) ? detail.removedNodes.filter((n): n is string => typeof n === 'string') : [];
    const pointCost = typeof detail.pointCost === 'number' ? detail.pointCost : null;
    if (addedNodes.length === 0 && removedNodes.length === 0) return null;
    const nodeIconMap = enrichment?.nodeIconMap;
    const spriteConfig = enrichment?.spriteConfig;
    const zoomLevel = enrichment?.zoomLevel ?? 'medium';
    const renderNodeTag = (name: string, color: 'green' | 'red', prefix: string, key: string) => {
      const iconInfo = nodeIconMap?.get(name);
      return (
        <span key={key} className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.5625rem] font-medium',
          color === 'green' ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/20'
            : 'text-red-300 bg-red-500/10 border border-red-500/20',
        )}>
          {iconInfo && spriteConfig ? (
            <span className="flex-shrink-0" style={{ width: 14, height: 14, overflow: 'hidden', borderRadius: '50%' }}>
              <TreeNodeIcon
                iconPath={iconInfo.iconPath}
                spriteCategory={iconInfo.spriteCategory}
                spriteConfig={spriteConfig}
                zoomLevel={zoomLevel}
                size={14}
              />
            </span>
          ) : (
            <Sparkles className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
          )}
          {prefix}{name}
        </span>
      );
    };
    return (
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        {addedNodes.map((node, i) => renderNodeTag(node, 'green', '+', `add-${i}`))}
        {removedNodes.map((node, i) => renderNodeTag(node, 'red', '−', `rm-${i}`))}
        {pointCost !== null && pointCost > 0 && (
          <span className="text-stone-500 text-[0.5625rem] ml-0.5">({pointCost}pt)</span>
        )}
      </div>
    );
  }

  if (source === 'combined') {
    const treeAdded = Number(detail.treeNodesAdded ?? 0);
    const treeRemoved = Number(detail.treeNodesRemoved ?? 0);
    const gearSlots = Number(detail.gearSlotsChanged ?? 0);
    const gemSwaps = Number(detail.gemSwapCount ?? 0);
    const parts: Array<{ icon: ReactNode; text: string; color: string }> = [];
    if (treeAdded > 0 || treeRemoved > 0) {
      const treeText = [treeAdded > 0 ? `+${treeAdded}` : '', treeRemoved > 0 ? `−${treeRemoved}` : '']
        .filter(Boolean).join('/');
      parts.push({ icon: <Network className="w-2.5 h-2.5" />, text: `${treeText} nodes`, color: 'text-purple-400/80' });
    }
    if (gearSlots > 0) {
      parts.push({ icon: <Layers className="w-2.5 h-2.5" />, text: `${gearSlots} slot${gearSlots > 1 ? 's' : ''}`, color: 'text-teal-400/80' });
    }
    if (gemSwaps > 0) {
      parts.push({ icon: <Gem className="w-2.5 h-2.5" />, text: `${gemSwaps} swap${gemSwaps > 1 ? 's' : ''}`, color: 'text-blue-400/80' });
    }
    if (parts.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2.5 mt-1.5 text-[0.625rem]">
        {parts.map((part, i) => (
          <span key={i} className={cn('flex items-center gap-1', part.color)}>
            {part.icon}
            {part.text}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

function UnifiedBuildResult({ data }: { data: Record<string, unknown> }) {
  const tested = (data.tested ?? {}) as Record<string, unknown>;
  const topPackages = Array.isArray(data.topPackages) ? data.topPackages as Array<Record<string, unknown>> : [];
  const sections = Array.isArray(data.sections) ? data.sections as Array<Record<string, unknown>> : [];
  const summary = typeof data.summary === 'string' ? data.summary : undefined;
  const refTable = typeof data.refTable === 'string' ? data.refTable : undefined;

  // Hooks for rich rendering (called unconditionally per React rules)
  const { gemMap, ready: gemReady } = useGemLookup();
  const enrichment = useTreeNodeEnrichment();

  const testedEntries = Object.entries(tested)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => ({ key, value: Number(value) }));

  // Pre-compute package → section result lookup (by ref, or by label for combined)
  const packageToResult = useMemo(() => {
    // Build section result index: kind → results array
    // Display payloads nest results under section.data.results; model payloads
    // (used as fallback when the display queue is missed) spread data flat so
    // results may live directly at section.results.
    const sectionIndex = new Map<string, Array<Record<string, unknown>>>();
    for (const section of sections) {
      const sectionData = section.data && typeof section.data === 'object' ? section.data as Record<string, unknown> : null;
      const nestedResults = sectionData ? sectionData.results : undefined;
      const flatResults = (section as Record<string, unknown>).results;
      const results = Array.isArray(nestedResults) ? nestedResults as Array<Record<string, unknown>>
        : Array.isArray(flatResults) ? flatResults as Array<Record<string, unknown>>
        : [];
      if (results.length > 0 && typeof section.kind === 'string') sectionIndex.set(section.kind, results);
    }

    const map = new Map<number, { source: string; result: Record<string, unknown> }>();
    topPackages.forEach((pkg, index) => {
      const ref = typeof pkg.ref === 'string' ? pkg.ref : null;
      const source = typeof pkg.source === 'string' ? pkg.source : '';
      const label = typeof pkg.label === 'string' ? pkg.label : '';
      const sectionKind = SOURCE_TO_SECTION_KIND[source];
      if (!sectionKind) return;
      const results = sectionIndex.get(sectionKind);
      if (!results) return;

      // Match by ref first, fall back to label (display payloads may lack refs)
      const match = (ref ? results.find(r => r.ref === ref) : null)
        ?? results.find(r => r.label === label);
      if (match) {
        map.set(index, { source, result: match });
      }
    });
    return map;
  }, [topPackages, sections]);

  // Collect section errors to show at the bottom
  const sectionErrors = sections
    .filter(s => typeof s.error === 'string')
    .map(s => ({ kind: String(s.kind), title: typeof s.title === 'string' ? s.title : String(s.kind), error: String(s.error) }));

  return (
    <div className="text-sm px-1 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {typeof data.callNumber === 'number' && (
          <span className="text-amber-400/80 uppercase tracking-wide font-medium">
            Call {data.callNumber}
          </span>
        )}
        {summary && (
          <span className="text-stone-300">{summary}</span>
        )}
      </div>

      {testedEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {testedEntries.map((entry) => (
            <span
              key={entry.key}
              className="px-2 py-1 rounded border border-amber-500/20 bg-amber-500/10 text-[0.7rem] text-amber-200/90"
            >
              {entry.value} {entry.key}
            </span>
          ))}
        </div>
      )}

      {topPackages.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[0.7rem] uppercase tracking-[0.18em] text-stone-500">Top Overall Packages</div>
          {topPackages.slice(0, 6).map((item, index) => {
            const label = typeof item.label === 'string' ? item.label : `Package ${index + 1}`;
            const dpsPct = Number(item.dpsPct ?? 0);
            const ehpPct = Number(item.ehpPct ?? 0);
            const score = Number(item.compositeScore ?? 0);
            const ref = typeof item.ref === 'string' ? item.ref : null;
            const source = typeof item.source === 'string' ? item.source : '';
            const detail = item.changeDetail && typeof item.changeDetail === 'object'
              ? item.changeDetail as Record<string, unknown>
              : null;

            const matchedResult = packageToResult.get(index) ?? null;

            // Source type icon and color
            const sourceIcon = source === 'gear' ? <Layers className="w-3 h-3" />
              : source === 'gemSwap' ? <Gem className="w-3 h-3" />
              : source === 'skillSetup' ? <Settings2 className="w-3 h-3" />
              : source === 'tree' ? <Network className="w-3 h-3" />
              : source === 'combined' ? <Package className="w-3 h-3" />
              : null;
            const sourceColor = source === 'gear' ? 'text-teal-400'
              : source === 'gemSwap' ? 'text-blue-400'
              : source === 'skillSetup' ? 'text-blue-400'
              : source === 'tree' ? 'text-purple-400'
              : source === 'combined' ? 'text-amber-400'
              : 'text-stone-400';

            return (
              <div key={`${label}-${index}`} data-ref={ref?.toLowerCase()} className="rounded border border-slate-700/40 bg-slate-900/40 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  {sourceIcon && (
                    <span className={cn('flex-shrink-0', sourceColor)}>{sourceIcon}</span>
                  )}
                  <span className="text-stone-200 text-xs font-medium flex-1 min-w-0 truncate">{label}</span>
                  <span className="px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/15 text-[0.625rem] font-mono text-amber-300">
                    {score.toFixed(1)}
                  </span>
                </div>
                {/* Rich per-source detail — always visible */}
                {matchedResult ? (
                  <ExpandedPackageDetail
                    source={matchedResult.source}
                    result={matchedResult.result}
                    gemMap={gemMap}
                    gemReady={gemReady}
                    enrichment={enrichment}
                  />
                ) : (
                  detail && <TopPackageChangeDetail source={source} detail={detail} enrichment={enrichment} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section errors (if any sub-tool failed) */}
      {sectionErrors.length > 0 && (
        <div className="space-y-1.5">
          {sectionErrors.map((err) => (
            <div key={err.kind} className="rounded border border-red-900/40 bg-red-950/20 px-2.5 py-2">
              <div className="text-xs text-stone-200 mb-1">{err.title}</div>
              <div className="text-[0.6875rem] text-red-400">{err.error}</div>
            </div>
          ))}
        </div>
      )}

      <DiagnosticsPanel diagnostics={data.diagnostics as ToolDiagnostics | undefined} />
    </div>
  );
}

// =============================================================================
// LoadMechanicsModulesResult — shows which mechanics modules were loaded
// =============================================================================

function LoadMechanicsModulesResult({ data }: { data: Record<string, unknown> }) {
  const modules = Array.isArray(data.modules) ? data.modules as Array<{ id: string; name: string }> : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings as string[] : [];

  if (modules.length === 0) {
    return (
      <div className="text-xs px-1">
        <span className="text-stone-400 italic">No modules loaded.</span>
      </div>
    );
  }

  return (
    <div className="text-xs px-1 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {modules.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center px-2 py-0.5 rounded bg-amber-900/30 border border-amber-700/30 text-amber-200/90 text-[0.6875rem]"
          >
            {m.name}
          </span>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="text-amber-400/70 text-[0.625rem] italic">
          {warnings.join('; ')}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// JewelOptionsSection — rich display for loaded jewel options
// =============================================================================

interface JewelModDisplay {
  displayText: string;
  tier?: number;
  genType: 'prefix' | 'suffix';
  ladderUsage?: number;
  baseTag?: string;
}

interface ClusterBaseDisplay {
  enchantment: string;
  notables: Array<{ name: string; ladderUsage?: number }>;
}

const BASE_TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  crimson: { bg: 'bg-red-900/25', text: 'text-red-300/80', border: 'border-red-700/25' },
  viridian: { bg: 'bg-emerald-900/25', text: 'text-emerald-300/80', border: 'border-emerald-700/25' },
  cobalt: { bg: 'bg-blue-900/25', text: 'text-blue-300/80', border: 'border-blue-700/25' },
};

/** Sub-section for regular (rare) jewel mods */
function RegularJewelSection({ data }: { data: Record<string, unknown> }) {
  const prefixes = Array.isArray(data.prefixes) ? data.prefixes as JewelModDisplay[] : [];
  const suffixes = Array.isArray(data.suffixes) ? data.suffixes as JewelModDisplay[] : [];
  const basesFilter = data.basesFilter as string[] | null | undefined;
  const [isExpanded, setIsExpanded] = useState(false);

  const totalMods = prefixes.length + suffixes.length;
  if (totalMods === 0) {
    return (
      <div className="text-xs text-stone-400 italic px-1">No regular jewel mods available.</div>
    );
  }

  return (
    <div className="rounded bg-slate-900/30 border border-stone-700/20 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown className={cn(
          'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
          isExpanded && 'rotate-180',
        )} />
        <span className="text-xs text-emerald-300/90 font-medium flex-shrink-0">
          Regular Jewels
        </span>
        {basesFilter && basesFilter.length > 0 && (
          <span className="text-[0.6875rem] text-stone-500 truncate">
            ({basesFilter.join(', ')})
          </span>
        )}
        <span className="flex-1" />
        <span className="text-[0.625rem] px-1 py-px rounded bg-emerald-900/25 text-emerald-400/80 font-mono tabular-nums">
          {prefixes.length}P
        </span>
        <span className="text-[0.625rem] px-1 py-px rounded bg-violet-900/25 text-violet-400/80 font-mono tabular-nums">
          {suffixes.length}S
        </span>
      </button>

      {/* Expanded mod list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-stone-700/20">
              {/* Prefixes */}
              {prefixes.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-emerald-400/70">
                    Prefixes ({prefixes.length})
                  </div>
                  <div className="space-y-px">
                    {prefixes.map((m, j) => (
                      <JewelModRow key={j} mod={m} />
                    ))}
                  </div>
                </div>
              )}
              {/* Suffixes */}
              {suffixes.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-violet-400/70">
                    Suffixes ({suffixes.length})
                  </div>
                  <div className="space-y-px">
                    {suffixes.map((m, j) => (
                      <JewelModRow key={j} mod={m} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Single mod row for regular jewels */
function JewelModRow({ mod }: { mod: JewelModDisplay }) {
  const rowBg = mod.genType === 'prefix' ? 'bg-emerald-950/10' : 'bg-violet-950/10';
  const baseTagKey = mod.baseTag?.toLowerCase().split('/')[0];
  const baseColors = baseTagKey ? BASE_TAG_COLORS[baseTagKey] : undefined;

  return (
    <div className={cn('flex items-center justify-between gap-2 py-0.5 px-1.5 rounded text-xs', rowBg)}>
      <span className="text-stone-300 truncate">{mod.displayText}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {mod.baseTag && baseColors && (
          <span className={cn('text-[0.5625rem] px-1 py-px rounded border font-medium', baseColors.bg, baseColors.text, baseColors.border)}>
            {mod.baseTag}
          </span>
        )}
        {mod.tier != null && (
          <span className={cn('text-[0.625rem] px-1 py-px rounded border font-medium tabular-nums', tierBadgeColor(mod.tier))}>
            T{mod.tier}
          </span>
        )}
        {mod.ladderUsage != null && (
          <span className="text-[0.625rem] text-sky-500/60 font-mono">{Math.round(mod.ladderUsage)}%</span>
        )}
      </div>
    </div>
  );
}

/** Sub-section for cluster jewel options */
function ReferenceClusterJewelSection({ data }: { data: Record<string, unknown> }) {
  const largeBases = Array.isArray(data.largeBases) ? data.largeBases as ClusterBaseDisplay[] : [];
  const mediumBases = Array.isArray(data.mediumBases) ? data.mediumBases as ClusterBaseDisplay[] : [];
  const alsoGrantMods = Array.isArray(data.alsoGrantMods) ? data.alsoGrantMods as Array<{ text: string; genType: 'prefix' | 'suffix' }> : [];
  const ladderCombos = Number(data.ladderCombos ?? 0);
  const equippedClusters = Number(data.equippedClusters ?? 0);
  const availableSockets = Number(data.availableSockets ?? 0);
  const [isExpanded, setIsExpanded] = useState(false);

  const totalBases = largeBases.length + mediumBases.length;
  if (totalBases === 0 && !data.success) {
    return (
      <div className="text-xs text-stone-400 italic px-1">Cluster jewel data unavailable.</div>
    );
  }

  return (
    <div className="rounded bg-slate-900/30 border border-stone-700/20 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown className={cn(
          'w-3 h-3 text-stone-500 transition-transform duration-200 flex-shrink-0',
          isExpanded && 'rotate-180',
        )} />
        <span className="text-xs text-purple-300/90 font-medium flex-shrink-0">
          Cluster Jewels
        </span>
        <span className="flex-1" />
        {largeBases.length > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-purple-900/25 text-purple-400/80 font-mono tabular-nums">
            {largeBases.length} large
          </span>
        )}
        {mediumBases.length > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-purple-900/25 text-purple-400/80 font-mono tabular-nums">
            {mediumBases.length} medium
          </span>
        )}
        {ladderCombos > 0 && (
          <span className="text-[0.625rem] px-1 py-px rounded bg-sky-900/25 text-sky-400/70 font-mono tabular-nums">
            {ladderCombos} ladder
          </span>
        )}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 space-y-2 border-t border-stone-700/20">
              {/* Setup summary */}
              {(equippedClusters > 0 || availableSockets > 0) && (
                <div className="flex flex-wrap gap-1.5 text-[0.6875rem] text-stone-400">
                  {equippedClusters > 0 && <span>{equippedClusters} equipped</span>}
                  {availableSockets > 0 && <span>{availableSockets} open socket{availableSockets !== 1 ? 's' : ''}</span>}
                </div>
              )}

              {/* Large bases */}
              {largeBases.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-purple-400/70">
                    Large Bases ({largeBases.length})
                  </div>
                  {largeBases.map((base, j) => (
                    <ClusterBaseRow key={j} base={base} />
                  ))}
                </div>
              )}

              {/* Medium bases */}
              {mediumBases.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-purple-400/70">
                    Medium Bases ({mediumBases.length})
                  </div>
                  {mediumBases.map((base, j) => (
                    <ClusterBaseRow key={j} base={base} />
                  ))}
                </div>
              )}

              {/* Also Grant mods (explicit affixes on small passives) */}
              {alsoGrantMods.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[0.625rem] uppercase tracking-wider font-semibold text-stone-400/70">
                    "Also Grant" Affixes ({alsoGrantMods.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {alsoGrantMods.map((m, k) => (
                      <span
                        key={k}
                        className={cn(
                          'text-[0.625rem] px-1.5 py-0.5 rounded border',
                          m.genType === 'prefix'
                            ? 'bg-emerald-950/20 text-emerald-300/80 border-emerald-700/20'
                            : 'bg-violet-950/20 text-violet-300/80 border-violet-700/20',
                        )}
                      >
                        <span className="text-stone-500 mr-0.5">{m.genType === 'prefix' ? 'P' : 'S'}</span>
                        {m.text.replace(/^Added Small Passive Skills also grant: /, '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Single cluster base row with enchantment and notable pills */
function ClusterBaseRow({ base }: { base: ClusterBaseDisplay }) {
  return (
    <div className="py-0.5 px-1.5 rounded bg-purple-950/10">
      <div className="text-[0.6875rem] text-stone-200 font-medium">{base.enchantment}</div>
      {base.notables.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {base.notables.map((n, k) => (
            <span
              key={k}
              className="text-[0.625rem] px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-200/80 border border-purple-700/20"
            >
              {n.name}
              {n.ladderUsage != null && (
                <span className="text-purple-400/50 ml-1">{Math.round(n.ladderUsage)}%</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function JewelOptionsSection({ data }: { data: Record<string, unknown> }) {
  // Handle "both" mode (has regular + cluster sub-objects)
  const regular = data.regular as Record<string, unknown> | undefined;
  const cluster = data.cluster as Record<string, unknown> | undefined;

  // Handle single mode
  const type = data.type as string | undefined;
  const isCluster = type === 'cluster' || !!cluster;
  const isRegular = type === 'regular' || !!regular;

  // For single mode, use data directly; for "both" mode, use sub-objects
  const regularData = regular ?? (isRegular ? data : undefined);
  const clusterData = cluster ?? (isCluster ? data : undefined);

  // Error case
  const error = data.error as string | undefined;
  if (error) {
    return (
      <div className="text-xs px-1 space-y-1">
        <div className="text-amber-400/80 uppercase tracking-wide font-medium">Jewel Options</div>
        <div className="text-red-400/70 text-[0.6875rem]">{error}</div>
      </div>
    );
  }

  return (
    <div className="text-xs px-1 space-y-1.5">
      <div className="text-amber-400/80 uppercase tracking-wide font-medium">
        Jewel Options
      </div>
      {isRegular && regularData && (
        <RegularJewelSection data={regularData} />
      )}
      {isCluster && clusterData && (
        <ReferenceClusterJewelSection data={clusterData} />
      )}
    </div>
  );
}

// =============================================================================
// LoadReferenceDataResult — combined renderer for consolidated reference loader
// =============================================================================

function LoadReferenceDataResult({ data }: { data: Record<string, unknown> }) {
  const sections = data.sections as Record<string, unknown> | undefined;
  const summary = data.summary as string | undefined;

  if (!sections) return <DefaultResult data={data} />;

  return (
    <div className="text-sm px-1 space-y-3">
      {/* Summary line */}
      {summary && (
        <div className="text-xs text-stone-400">{summary}</div>
      )}

      {/* Mechanics section */}
      {Boolean(sections.mechanics) && (
        <div>
          <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium mb-1">
            Mechanics Modules
          </div>
          <LoadMechanicsModulesResult data={sections.mechanics as Record<string, unknown>} />
        </div>
      )}

      {/* Gear section — reuse BuildModMenusResult */}
      {Boolean(sections.gear) && (
        <div>
          <BuildModMenusResult data={sections.gear as Record<string, unknown>} />
        </div>
      )}

      {/* Jewels section */}
      {Boolean(sections.jewels) && (
        <JewelOptionsSection data={sections.jewels as Record<string, unknown>} />
      )}
    </div>
  );
}

// =============================================================================
// Tool result renderer dispatcher
// =============================================================================

export const TOOL_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, unknown> }>> = {
  get_full_calcs: FullCalcsResult,
  construct_rare_item: ConstructItemResult,
  equip_and_test_item: EquipAndTestResult,
  search_trade: SearchTradeResult,
  validate_items_with_pob: ValidateItemsResult,
  query_mod_pool: QueryModPoolResult,
  test_gem_swaps: GemSwapsResult,
  find_support_suggestions: SupportSuggestionsResult,
  find_setup_suggestions: SetupSuggestionsResult,
  explore_skill_options: ExploreSkillOptionsResult,
  test_skill_setup: SkillSetupResult,
  test_gear_setups: TestGearSetupsResult,
  find_gear_upgrades: FindGearUpgradesResult,
  get_slot_mods: GetSlotModsResult,
  search_and_validate: SearchAndValidateResult,
  discover_tree_nodes: DiscoverTreeNodesResult,
  simulate_tree_changes: SimulateTreeChangesResult,
  simulate_ascendancy_swap: SimulateAscendancySwapResult,
  batch_simulate_tree: BatchSimulateTreeResult,
  batch_test_tree: BatchTestTreeResult,
  analyze_allocated_tree: AnalyzeAllocatedTreeResult,
  batch_test_jewels: BatchTestJewelsResult,
  get_cluster_jewel_options: GetClusterJewelOptionsResult,
  discover_cluster_options: GetClusterJewelOptionsResult,
  test_popular_jewels: TestPopularJewelsResult,
  test_obvious_candidates: TestObviousCandidatesResult,
  test_ladder_clusters: TestLadderClustersResult,
  test_mastery_alternatives: TestMasteryAlternativesResult,
  discover_uniques: DiscoverUniquesResult,
  price_skill_gems: GemPricingResult,
  get_mod_pool: GetModPoolResult,
  build_mod_menus: BuildModMenusResult,
  load_gear_mod_menus: BuildModMenusResult,
  build_jewel_menus: BuildJewelMenusResult,
  detect_build_config: DetectBuildConfigResult,
  configure_combat: ConfigureCombatResult,
  test_combat_config: TestCombatConfigResult,
  analyze_flasks: AnalyzeFlasksResult,
  assess_progression: AssessProgressionResult,
  ladder_cross_reference: PreflightMarkdownResult,
  lookup_crafting_plans: PreflightMarkdownResult,
  price_gear_packages: PriceGearPackagesResult,
  test_combined_changes: CombinedChangesResult,
  test_unified_build: UnifiedBuildResult,
  load_mechanics_modules: LoadMechanicsModulesResult,
  load_reference_data: LoadReferenceDataResult,
  nominate_for_synthesis: NominateForSynthesisResult,
  synthesis_preflight: SynthesisPreflightResult,
  load_crafting_recipe: LoadCraftingRecipeResult,
  craft_item: CraftItemResult,
};

// =============================================================================
// ToolStepCard
// =============================================================================

export function ToolStepCard({
  tool,
  displayName,
  status,
  input: _input,
  result,
  error,
  durationMs,
  defaultExpanded = false,
  description,
  preflight,
  stepIndex,
}: ToolStepCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Listen for external expand requests (from simresult pill clicks)
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const handler = () => setExpanded(true);
    el.addEventListener('expand-tool-step', handler);
    return () => el.removeEventListener('expand-tool-step', handler);
  }, []);

  const isRunning = status === 'running';
  const isError = status === 'error';
  const isComplete = status === 'complete';
  const isCancelled = status === 'cancelled';

  // Status-only tools: show spinner while running but no expandable body when complete
  const isStatusOnly = tool.startsWith('prepare_') && tool.endsWith('_analysis');

  const hasBody = isStatusOnly
    ? (isRunning || isError)
    : (isRunning || (isComplete && result) || isError);
  const showBody = isRunning || isError || expanded;

  const Renderer = TOOL_RENDERERS[tool] ?? DefaultResult;

  // Extract outcome from result summary (or description fallback) if available (strip any XML-like tags)
  const rawOutcome = (result?.summary as string) ?? (result?.description as string) ?? null;
  const outcomeText = rawOutcome ? stripToolTags(rawOutcome) : null;

  return (
    <div
      ref={cardRef}
      id={stepIndex != null ? `tool-step-${stepIndex}` : undefined}
      data-tool-name={tool}
      data-call-number={result?.callNumber as number | undefined}
      className={cn(
        'rounded-lg my-2 overflow-hidden transition-all duration-300',
        // Base card styling - translucent forge aesthetic
        'bg-gradient-to-br from-slate-800/20 to-slate-900/25',
        // Left border accent
        'border-l-4 border border-r border-t border-b',
        // Preflight uses cool steel-blue; LLM uses warm amber
        isError && 'border-l-red-500/60 border-red-500/40 bg-red-950/20 shadow-red-500/10',
        isCancelled && 'border-l-stone-500/40 border-stone-600/30 opacity-60',
        !isError && !isCancelled && preflight && isRunning && 'border-l-sky-400/60 border-sky-400/30 shadow-lg shadow-sky-400/10',
        !isError && !isCancelled && preflight && isComplete && 'border-l-sky-400/40 border-sky-500/20 shadow-sm shadow-sky-400/5',
        !isError && !isCancelled && !preflight && isRunning && 'border-l-amber-500/60 border-amber-500/40 shadow-lg shadow-amber-500/10',
        !isError && !isCancelled && !preflight && isComplete && 'border-l-amber-500/50 border-amber-500/25 shadow-sm shadow-amber-500/5',
      )}
      style={{
        // Subtle inner glow for running state
        ...(isRunning && !preflight && {
          boxShadow: 'inset 0 0 20px rgba(251, 191, 36, 0.05), 0 4px 12px rgba(251, 191, 36, 0.1)',
        }),
        ...(isRunning && preflight && {
          boxShadow: 'inset 0 0 20px rgba(56, 189, 248, 0.05), 0 4px 12px rgba(56, 189, 248, 0.08)',
        }),
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => hasBody && setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2.5 text-left',
          'transition-colors duration-200',
          hasBody && 'cursor-pointer hover:bg-white/[0.02]',
          !hasBody && 'cursor-default',
        )}
      >
        {/* Status icon with glow effect - amber theme for consistency */}
        <div className="relative flex-shrink-0">
          {isRunning && (
            <>
              <Loader2 className={cn('w-4 h-4 animate-spin', preflight ? 'text-sky-400' : 'text-amber-400')} />
              <div className={cn('absolute inset-0 w-4 h-4 rounded-full blur-sm animate-pulse', preflight ? 'bg-sky-400/30' : 'bg-amber-400/30')} />
            </>
          )}
          {isComplete && (
            <>
              <CheckCircle2 className={cn('w-4 h-4', preflight ? 'text-sky-400' : 'text-amber-400')} />
              <div className={cn('absolute inset-0 w-4 h-4 rounded-full blur-sm', preflight ? 'bg-sky-400/20' : 'bg-amber-400/20')} />
            </>
          )}
          {isError && (
            <>
              <XCircle className="w-4 h-4 text-red-400" />
              <div className="absolute inset-0 w-4 h-4 bg-red-400/20 rounded-full blur-sm" />
            </>
          )}
          {isCancelled && (
            <>
              <XCircle className="w-4 h-4 text-stone-500" />
            </>
          )}
        </div>

        {/* Label and description - use display font for PoE aesthetic */}
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={cn(
              'text-sm font-medium truncate font-display tracking-wide',
              isRunning && !preflight && 'text-amber-100',
              isRunning && preflight && 'text-sky-100',
              isComplete && 'text-stone-200',
              isError && 'text-red-200',
              isCancelled && 'text-stone-400',
            )}
          >
            {displayName}
          </span>
          {isCancelled && (
            <span className="text-xs text-stone-500 italic truncate">
              Interrupted
            </span>
          )}
          {/* Show description when complete but no outcome text (not when running — dots section shows it) */}
          {description && !isCancelled && (isComplete && !outcomeText) && (
            <span className="text-xs text-stone-400 truncate">
              {stripToolTags(description)}
            </span>
          )}
          {/* Show outcome summary when complete and collapsed */}
          {isComplete && !expanded && outcomeText && (
            <span className={cn('text-xs truncate', preflight ? 'text-sky-400/80' : 'text-amber-400/80')}>
              {outcomeText}
            </span>
          )}
        </div>


        {/* Preflight badge — cool steel tag for deterministic tool calls */}
        {preflight && (
          <span className={cn(
            'text-[0.625rem] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded flex-shrink-0',
            'bg-sky-500/10 text-sky-400/90',
            'border border-sky-500/20',
          )}>
            Auto
          </span>
        )}

        {/* Duration badge */}
        {durationMs != null && (
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
            'bg-slate-700/30 text-slate-400',
            'border border-slate-600/30',
          )}>
            {formatDuration(durationMs)}
          </span>
        )}

        {/* Expand chevron */}
        {hasBody && !isRunning && (
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </motion.span>
        )}
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {showBody && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={cn(
              'px-3 pb-3 pt-2 tool-body',
              preflight ? 'border-t border-sky-500/10' : 'border-t border-amber-500/10',
              'bg-slate-900/20',
            )}>
              {isRunning && (
                <div className="flex items-center gap-2">
                  {/* Pulsing dots — sky for preflight, amber for LLM */}
                  <div className="flex gap-1">
                    <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', preflight ? 'bg-sky-400/60' : 'bg-amber-400/60')} style={{ animationDelay: '0ms' }} />
                    <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', preflight ? 'bg-sky-400/60' : 'bg-amber-400/60')} style={{ animationDelay: '150ms' }} />
                    <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', preflight ? 'bg-sky-400/60' : 'bg-amber-400/60')} style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-stone-400 italic">
                    {description || 'Processing...'}
                  </span>
                </div>
              )}
              {isComplete && result && <Renderer data={result} />}
              {isError && (
                <div className="text-xs text-red-300 font-mono bg-red-950/30 rounded px-2 py-1.5 border border-red-500/20">
                  {error ?? 'Unknown error'}
                </div>
              )}
              {isCancelled && (
                <span className="text-xs text-stone-500 italic">Interrupted</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
