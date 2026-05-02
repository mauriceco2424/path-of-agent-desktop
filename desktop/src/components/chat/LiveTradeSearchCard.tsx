/**
 * LiveTradeSearchCard — consolidated multi-slot trade search HUD
 *
 * Renders inline in the follow-up chat bubble for the entire search_trade
 * lifecycle — while running AND after completion. Takes over the generic
 * ToolActivitySummary path for this tool so the UX stays in one place:
 *
 *  - While running (`search` populated, state === 'running'): header with
 *    elapsed counter, per-slot rows with probe N/M + min price, ETA footer.
 *  - After completion (`finalResult` populated, `search` may be null):
 *    per-slot rows switch to "done" visuals and a PoB-verified items list
 *    renders below each slot.
 *
 * Either `search`, `finalResult`, or both MUST be provided — otherwise the
 * component returns null. When both are present, `search` drives the live
 * HUD and `finalResult` drives the items list.
 *
 * Design system: Onyx Gold (amber accents, dark gradients, left edge bar,
 * font-display uppercase labels, tabular-nums for counters).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  CheckCircle2,
  Loader2,
  Clock,
  XCircle,
  Circle,
  ExternalLink,
  Coins,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { openExternal } from '../../utils/open-external';
import type { LiveTradeSearchState, TradeSearchSlotState } from '../../hooks/useDesktopChat';

// =============================================================================
// Final-result shape (subset of the search_trade tool payload)
// =============================================================================

interface FinalItemDelta {
  change?: number;
  pct?: number;
}

interface FinalTradeItem {
  price?: number;
  currency?: string;
  name?: string;
  ilvl?: number;
  mods?: string[];
  dps?: FinalItemDelta;
  ehp?: FinalItemDelta;
  life?: FinalItemDelta;
  significantExtras?: Array<{ label: string; pct: number }>;
  pobVerified?: boolean;
}

interface FinalTradeSlot {
  slot?: string;
  totalResults?: number;
  tradeUrl?: string;
  selectedProbeLabel?: string;
  items?: FinalTradeItem[];
  resNote?: string;
}

interface FinalTradeResult {
  slots?: FinalTradeSlot[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function formatBudget(budget?: { max: number; currency: 'chaos' | 'divine' }): string | null {
  if (!budget) return null;
  const suffix = budget.currency === 'divine' ? 'div' : 'c';
  return `${budget.max}${suffix}`;
}

/** Compute rough global progress across all slots (0..1). */
function computeOverallProgress(
  plan: LiveTradeSearchState['plan'],
  perSlot: Record<string, TradeSearchSlotState>,
): number {
  if (!plan || plan.totalProbes === 0) return 0;
  let probesDone = 0;
  for (const s of plan.slots) {
    const row = perSlot[s.slot];
    if (!row) continue;
    if (row.status === 'done') {
      probesDone += row.maxProbes;
    } else if (row.status === 'running') {
      probesDone += Math.max(0, row.currentProbe - 1);
    }
  }
  return Math.min(1, probesDone / plan.totalProbes);
}

/** Rows in plan order (guarantees stable render when perSlot populates late). */
function orderedRows(
  plan: LiveTradeSearchState['plan'],
  perSlot: Record<string, TradeSearchSlotState>,
): TradeSearchSlotState[] {
  if (!plan) return Object.values(perSlot);
  return plan.slots.map((s) =>
    perSlot[s.slot] ?? {
      slot: s.slot,
      status: 'queued' as const,
      maxProbes: s.maxProbes,
      currentProbe: 0,
      ...(s.budget ? { budget: s.budget } : {}),
    },
  );
}

// =============================================================================
// Status icon
// =============================================================================

function SlotStatusIcon({ status }: { status: TradeSearchSlotState['status'] }) {
  const color =
    status === 'done'
      ? 'text-emerald-400/85'
      : status === 'running'
        ? 'text-amber-400'
        : status === 'error'
          ? 'text-red-400/85'
          : 'text-slate-600';

  if (status === 'running') {
    return <Loader2 className={cn('w-3 h-3 animate-spin flex-shrink-0', color)} />;
  }
  if (status === 'done') {
    return <CheckCircle2 className={cn('w-3 h-3 flex-shrink-0', color)} />;
  }
  if (status === 'error') {
    return <XCircle className={cn('w-3 h-3 flex-shrink-0', color)} />;
  }
  return <Circle className={cn('w-3 h-3 flex-shrink-0', color)} />;
}

// =============================================================================
// Per-slot row
// =============================================================================

function SlotRow({ row, isActive }: { row: TradeSearchSlotState; isActive: boolean }) {
  const hasResults = row.latestResultCount !== undefined && row.latestResultCount > 0;
  const showProgressBar = row.status === 'running';
  const probeFraction = row.maxProbes > 0 ? Math.min(1, row.currentProbe / row.maxProbes) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'relative rounded-md overflow-hidden',
        'transition-all duration-200',
      )}
      style={{
        background:
          row.status === 'running'
            ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(251, 191, 36, 0.02) 100%)'
            : row.status === 'done'
              ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, transparent 100%)'
              : row.status === 'error'
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)'
                : 'linear-gradient(135deg, rgba(71, 85, 105, 0.05) 0%, transparent 100%)',
        border: `1px solid ${
          isActive
            ? 'rgba(251, 191, 36, 0.25)'
            : row.status === 'done'
              ? 'rgba(52, 211, 153, 0.15)'
              : 'rgba(71, 85, 105, 0.18)'
        }`,
      }}
    >
      {/* Left edge accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
        style={{
          background:
            row.status === 'running'
              ? 'linear-gradient(180deg, rgba(251, 191, 36, 0.6) 0%, rgba(251, 191, 36, 0.15) 100%)'
              : row.status === 'done'
                ? 'linear-gradient(180deg, rgba(52, 211, 153, 0.5) 0%, rgba(52, 211, 153, 0.1) 100%)'
                : row.status === 'error'
                  ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.5) 0%, rgba(239, 68, 68, 0.1) 100%)'
                  : 'linear-gradient(180deg, rgba(71, 85, 105, 0.3) 0%, rgba(71, 85, 105, 0.08) 100%)',
        }}
      />

      <div className="relative pl-3 pr-2.5 py-1.5">
        {/* Header row: icon + slot + probe + result count + trade link */}
        <div className="flex items-center gap-2">
          <SlotStatusIcon status={row.status} />

          {/* Slot name */}
          <span
            className={cn(
              'text-[0.6875rem] font-display font-semibold tracking-wide uppercase truncate flex-shrink-0',
              row.status === 'done' ? 'text-emerald-100/85' : 'text-slate-200',
            )}
          >
            {row.slot.replace(/_/g, ' ')}
          </span>

          {/* Probe counter */}
          {row.status !== 'queued' && (
            <span className="text-[0.5625rem] font-mono tabular-nums text-slate-500/80 flex-shrink-0">
              {row.currentProbe}/{row.maxProbes}
            </span>
          )}

          {/* Results + min price pushed to the right */}
          <div className="ml-auto flex items-center gap-2 text-[0.625rem] tabular-nums flex-shrink-0">
            {hasResults && (
              <span className="text-slate-300/80">
                {row.latestResultCount} {row.latestResultCount === 1 ? 'result' : 'results'}
              </span>
            )}
            {row.latestMinPrice !== undefined && row.latestMinPrice > 0 && (
              <span className="flex items-center gap-0.5 text-amber-300/80">
                <Coins className="w-2.5 h-2.5" />
                {Math.round(row.latestMinPrice)}c
              </span>
            )}
            {row.tradeUrl && row.status !== 'queued' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openExternal(row.tradeUrl!);
                }}
                className={cn(
                  'flex items-center gap-0.5 px-1.5 py-[1px] rounded',
                  'text-[0.5625rem] font-medium',
                  'text-amber-300 hover:text-amber-200',
                  'bg-amber-500/10 hover:bg-amber-500/20',
                  'border border-amber-500/25 hover:border-amber-500/40',
                  'transition-all duration-150',
                )}
                title="Open this slot's trade search on pathofexile.com"
              >
                View
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status text + thin progress bar for running slots */}
        {row.status === 'running' && (
          <div className="mt-1 space-y-1">
            {row.statusText && (
              <p className="text-[0.5625rem] text-amber-300/55 truncate">
                {row.statusText}
              </p>
            )}
            <div className="h-[2px] rounded-full overflow-hidden bg-slate-800/60">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${probeFraction * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  background:
                    'linear-gradient(90deg, rgba(251, 191, 36, 0.7) 0%, rgba(251, 191, 36, 0.4) 100%)',
                  boxShadow: '0 0 6px rgba(251, 191, 36, 0.3)',
                }}
              />
            </div>
          </div>
        )}

        {/* Done rows get a muted one-line status */}
        {row.status === 'done' && row.statusText && (
          <p className="mt-0.5 text-[0.5625rem] text-emerald-300/40 truncate">
            {row.statusText}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Post-complete items block (rendered per slot after search finishes)
// =============================================================================

function formatDelta(delta: FinalItemDelta | undefined): { text: string; color: string } | null {
  if (!delta || typeof delta.pct !== 'number') return null;
  const pct = delta.pct;
  if (Math.abs(pct) < 0.1) return { text: '±0%', color: 'text-slate-500' };
  const sign = pct > 0 ? '+' : '';
  const color = pct > 0 ? 'text-emerald-300/90' : 'text-red-400/85';
  return { text: `${sign}${pct.toFixed(1)}%`, color };
}

function formatItemPrice(price: number | undefined, currency: string | undefined): string | null {
  if (typeof price !== 'number') return null;
  const suffix = currency === 'divine' ? 'd' : 'c';
  return `${price}${suffix}`;
}

function SlotItemsBlock({
  slot,
  tradeUrl,
  items,
  resNote,
}: {
  slot: string;
  tradeUrl?: string;
  items: FinalTradeItem[];
  resNote?: string;
}) {
  const slotLabel = slot.replace(/_/g, ' ');

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.03) 0%, transparent 100%)',
        border: '1px solid rgba(52, 211, 153, 0.12)',
      }}
    >
      {/* Slot header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-emerald-900/15">
        <span className="text-[0.625rem] font-display font-semibold tracking-wide uppercase text-emerald-200/85">
          {slotLabel}
        </span>
        <span className="text-[0.5625rem] text-slate-500/75 tabular-nums">
          {items.length} top pick{items.length === 1 ? '' : 's'}
        </span>
        {tradeUrl && (
          <button
            type="button"
            onClick={() => { openExternal(tradeUrl); }}
            className={cn(
              'ml-auto flex items-center gap-0.5 px-1.5 py-[1px] rounded',
              'text-[0.5625rem] font-medium',
              'text-amber-300 hover:text-amber-200',
              'bg-amber-500/10 hover:bg-amber-500/20',
              'border border-amber-500/25 hover:border-amber-500/40',
              'transition-all duration-150',
            )}
          >
            Open search
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="px-2.5 py-1.5 space-y-1.5">
        {items.map((item, i) => {
          const priceLabel = formatItemPrice(item.price, item.currency);
          const dps = formatDelta(item.dps);
          const ehp = formatDelta(item.ehp);
          const life = formatDelta(item.life);
          const topMods = (item.mods ?? []).slice(0, 3);

          return (
            <div key={i} className="space-y-0.5">
              {/* Name + price + deltas */}
              <div className="flex items-center gap-2 text-[0.6875rem] tabular-nums">
                <span className="text-slate-200 truncate">
                  {item.name ?? 'Unnamed item'}
                </span>
                {priceLabel && (
                  <span className="flex items-center gap-0.5 text-amber-300/85 flex-shrink-0">
                    <Coins className="w-2.5 h-2.5" />
                    {priceLabel}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2 flex-shrink-0 text-[0.625rem]">
                  {dps && (
                    <span className={dps.color}>
                      <span className="text-slate-500 mr-0.5">DPS</span>{dps.text}
                    </span>
                  )}
                  {ehp && (
                    <span className={ehp.color}>
                      <span className="text-slate-500 mr-0.5">EHP</span>{ehp.text}
                    </span>
                  )}
                  {life && (
                    <span className={life.color}>
                      <span className="text-slate-500 mr-0.5">Life</span>{life.text}
                    </span>
                  )}
                </div>
              </div>

              {/* Top mods — truncated */}
              {topMods.length > 0 && (
                <p className="text-[0.5625rem] text-slate-500/85 truncate">
                  {topMods.join(' · ')}
                  {(item.mods?.length ?? 0) > topMods.length ? ' …' : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {resNote && (
        <p className="px-2.5 pb-1.5 text-[0.5625rem] text-slate-500/70 italic">
          {resNote}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Main card
// =============================================================================

export interface LiveTradeSearchCardProps {
  /** Live progress state — populated while the search is running. */
  search?: LiveTradeSearchState | null;
  /**
   * Final tool result — populated once search_trade completes. Passed
   * straight from the `tool_call` part's `result` field, which is a loose
   * `Record<string, unknown>`; the card narrows internally.
   */
  finalResult?: Record<string, unknown> | null;
  className?: string;
}

export function LiveTradeSearchCard({ search, finalResult: rawFinalResult, className }: LiveTradeSearchCardProps) {
  // Narrow the loose tool-result payload into a structured FinalTradeResult
  // once. `slots` is the only field the card reads; everything else is
  // passed through to items rendering.
  const finalResult: FinalTradeResult | null = useMemo(() => {
    if (!rawFinalResult || typeof rawFinalResult !== 'object') return null;
    const slots = (rawFinalResult as { slots?: unknown }).slots;
    if (!Array.isArray(slots)) return null;
    return { slots: slots as FinalTradeSlot[] };
  }, [rawFinalResult]);

  // Live elapsed timer — re-renders every second while running
  const [, setTick] = useState(0);
  useEffect(() => {
    if (search?.state !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [search?.state]);

  // Synthesize a minimal live-state from finalResult when search is absent
  // (post-complete cleanup, history replay). Rows drive the existing
  // per-slot HUD; items drive the new post-complete listings block.
  const displaySearch = useMemo<LiveTradeSearchState | null>(() => {
    if (search) return search;
    if (!finalResult?.slots?.length) return null;
    const perSlot: Record<string, TradeSearchSlotState> = {};
    for (const s of finalResult.slots) {
      const slotName = s.slot ?? 'unknown';
      perSlot[slotName] = {
        slot: slotName,
        status: 'done',
        maxProbes: 1,
        currentProbe: 1,
        ...(typeof s.totalResults === 'number' ? { latestResultCount: s.totalResults } : {}),
        ...(s.tradeUrl ? { tradeUrl: s.tradeUrl } : {}),
        ...(s.selectedProbeLabel ? { statusText: s.selectedProbeLabel } : {}),
      };
    }
    return {
      state: 'complete',
      perSlot,
      plan: {
        slots: finalResult.slots.map((s) => ({
          slot: s.slot ?? 'unknown',
          maxProbes: 1,
        })),
        totalProbes: finalResult.slots.length,
        estimatedSeconds: 0,
      },
    };
  }, [search, finalResult]);

  // Top items per slot (up to 3) — only surfaced post-complete.
  // Must be declared before any early return to keep hook order stable.
  const slotItems = useMemo(() => {
    if (!finalResult?.slots?.length) return [];
    return finalResult.slots.map((s) => ({
      slot: s.slot ?? 'unknown',
      tradeUrl: s.tradeUrl,
      items: (s.items ?? []).slice(0, 3),
      resNote: s.resNote,
    }));
  }, [finalResult]);

  if (!displaySearch) return null;

  const plan = displaySearch.plan;
  const perSlot = displaySearch.perSlot ?? {};
  const rows = orderedRows(plan, perSlot);

  const slotsDone = rows.filter((r) => r.status === 'done').length;
  const totalSlots = rows.length;

  const elapsedMs = displaySearch.startedAt ? Date.now() - displaySearch.startedAt : 0;
  const overallProgress = computeOverallProgress(plan, perSlot);
  const etaSeconds = plan
    ? Math.max(0, plan.estimatedSeconds - Math.floor(elapsedMs / 1000))
    : 0;

  // Header color transitions from amber (running) → emerald (done)
  const isRunning = displaySearch.state === 'running';
  const hasError = displaySearch.state === 'error';

  const hasItemsBlock = !isRunning && slotItems.some((s) => s.items.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('relative rounded-xl overflow-hidden', className)}
      style={{
        background:
          'linear-gradient(180deg, rgba(15, 10, 25, 0.94) 0%, rgba(8, 5, 15, 0.97) 100%)',
        border: `1px solid ${
          isRunning
            ? 'rgba(251, 191, 36, 0.22)'
            : hasError
              ? 'rgba(239, 68, 68, 0.22)'
              : 'rgba(52, 211, 153, 0.2)'
        }`,
        boxShadow:
          '0 4px 18px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Left full-height accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
        style={{
          background: isRunning
            ? 'linear-gradient(180deg, rgba(251, 191, 36, 0.7) 0%, rgba(251, 191, 36, 0.15) 100%)'
            : hasError
              ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.6) 0%, rgba(239, 68, 68, 0.1) 100%)'
              : 'linear-gradient(180deg, rgba(52, 211, 153, 0.6) 0%, rgba(52, 211, 153, 0.12) 100%)',
          boxShadow: isRunning ? '0 0 8px rgba(251, 191, 36, 0.25)' : 'none',
        }}
      />

      {/* ── HUD header ────────────────────────────────────────────── */}
      <div className="relative pl-3.5 pr-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          {/* Icon pill */}
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{
              background: isRunning
                ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.18) 0%, rgba(251, 191, 36, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(52, 211, 153, 0.04) 100%)',
              border: `1px solid ${
                isRunning ? 'rgba(251, 191, 36, 0.28)' : 'rgba(52, 211, 153, 0.25)'
              }`,
            }}
          >
            <ShoppingBag
              className={cn(
                'w-3 h-3',
                isRunning ? 'text-amber-400' : 'text-emerald-400/80',
              )}
            />
          </div>

          {/* Title */}
          <span
            className={cn(
              'text-[0.625rem] font-display font-semibold tracking-[0.2em] uppercase',
              isRunning ? 'text-amber-300/85' : 'text-emerald-200/85',
            )}
            style={
              isRunning ? { textShadow: '0 0 10px rgba(251, 191, 36, 0.2)' } : undefined
            }
          >
            Trade Search
          </span>

          {/* Divider glow line */}
          <div className="flex-1 h-px bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent" />

          {/* Slots-done counter + elapsed time */}
          <div className="flex items-center gap-2 text-[0.5625rem] font-mono tabular-nums text-slate-500/85 flex-shrink-0">
            <span>
              {slotsDone}/{totalSlots} {totalSlots === 1 ? 'slot' : 'slots'}
            </span>
            {elapsedMs > 0 && (
              <>
                <span className="text-slate-700">•</span>
                <span>{formatDuration(elapsedMs)}</span>
              </>
            )}
          </div>
        </div>

        {/* Overall progress bar — only while running */}
        {isRunning && plan && plan.totalProbes > 0 && (
          <div className="mt-2 h-[3px] rounded-full overflow-hidden bg-slate-800/60">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(overallProgress * 100, 2)}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                background:
                  'linear-gradient(90deg, rgba(251, 191, 36, 0.75) 0%, rgba(251, 191, 36, 0.4) 100%)',
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.35)',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Per-slot rows ─────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="px-2 pb-2 space-y-1">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <SlotRow
                key={row.slot}
                row={row}
                isActive={row.slot === displaySearch.currentSlotName}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Post-complete items list ──────────────────────────────── */}
      {hasItemsBlock && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-slate-700/20">
          {slotItems
            .filter((s) => s.items.length > 0)
            .map((slotBlock) => (
              <SlotItemsBlock
                key={slotBlock.slot}
                slot={slotBlock.slot}
                tradeUrl={slotBlock.tradeUrl}
                items={slotBlock.items}
                resNote={slotBlock.resNote}
              />
            ))}
        </div>
      )}

      {/* ── ETA footer (only while running + plan known) ─────────── */}
      {isRunning && plan && (
        <div
          className="px-3.5 py-1.5 flex items-center gap-1.5 text-[0.5625rem] text-slate-500/80"
          style={{
            borderTop: '1px solid rgba(71, 85, 105, 0.15)',
            background: 'rgba(2, 6, 23, 0.35)',
          }}
        >
          <Clock className="w-2.5 h-2.5 text-slate-500/70" />
          {etaSeconds > 0 ? (
            <span>
              Est. remaining ~{formatDuration(etaSeconds * 1000)} · {plan.totalProbes} probes planned
            </span>
          ) : (
            <span>Finalizing results…</span>
          )}
          {plan?.slots[0]?.budget && (
            <span className="ml-auto text-slate-600/70 tabular-nums">
              Budget: {formatBudget(plan.slots[0].budget)}
            </span>
          )}
        </div>
      )}

      {/* Error state */}
      {hasError && displaySearch.error && (
        <div className="px-3.5 pt-0 pb-2">
          <p className="text-[0.625rem] text-red-400/80">{displaySearch.error}</p>
        </div>
      )}
    </motion.div>
  );
}

export default LiveTradeSearchCard;
