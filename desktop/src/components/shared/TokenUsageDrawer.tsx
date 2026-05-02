/**
 * TokenUsageDrawer Component
 *
 * "The Oracle's Ledger" - tracks token usage and cost for the current session.
 * Entries are grouped by lifecycle phase (preflight / initial analysis / follow-up),
 * with a session-wide per-tool breakdown below.
 */

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  X,
  Clock,
  Zap,
  TrendingUp,
  Trash2,
  Sparkles,
  ScrollText,
  MessageCircle,
  Eye,
  Settings2,
  Cpu,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CREDIT_COST_USD } from '../../../../shared/types/Credits';
import { MODEL_PRICING } from '../../../../shared/types/TokenUsage';
import { useTokenStore, selectCreditBalance, selectCreditsUsedSession } from '../../store/tokenSlice';
import type {
  PhaseTokenBreakdown,
  TokenPhase,
  ToolTokenBreakdown,
  TokenUsageEntry,
} from '../../../../shared/types/TokenUsage';
import { TOOL_DISPLAY_INFO } from '../../../../shared/types/Chat';

interface TokenUsageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PhaseConfig {
  label: string;
  icon: typeof Eye;
  color: string;
  glowColor: string;
}

interface PhaseLedger {
  phase: TokenPhase;
  label: string;
  icon: typeof Eye;
  color: string;
  glowColor: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  phases: PhaseTokenBreakdown;
  tools: Record<string, ToolTokenBreakdown>;
}

const PHASE_CONFIG: Record<TokenPhase, PhaseConfig> = {
  preflight: {
    label: 'Preflight',
    icon: Settings2,
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.38)',
  },
  'initial-analysis': {
    label: 'Initial Analysis',
    icon: Eye,
    color: '#a78bfa',
    glowColor: 'rgba(167, 139, 250, 0.38)',
  },
  'follow-up': {
    label: 'Follow-up Chat',
    icon: MessageCircle,
    color: '#67e8f9',
    glowColor: 'rgba(103, 232, 249, 0.38)',
  },
  other: {
    label: 'Other',
    icon: Sparkles,
    color: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.38)',
  },
};

const PHASE_ORDER: TokenPhase[] = [
  'preflight',
  'initial-analysis',
  'follow-up',
  'other',
];

const emptyPhaseBreakdown: PhaseTokenBreakdown = {
  contextInputTokens: 0,
  staticContextInputTokens: 0,
  carryoverToolOutputContextTokens: 0,
  reasoningTokens: 0,
  toolCallInputTokens: 0,
  toolCallOutputTokens: 0,
  finalOutputTokens: 0,
};

const drawerVariants = {
  hidden: { x: '100%', opacity: 0.8 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 280, damping: 28 },
  },
  exit: {
    x: '100%',
    opacity: 0.8,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
};

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/** Convert USD cost to credit display (whole number, floor rounding) */
function formatCredits(costUsd: number): string {
  const credits = Math.floor(costUsd / CREDIT_COST_USD);
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}K`;
  }
  return String(credits);
}

/** Format credit efficiency (credits per 1K tokens) */
function formatCreditEfficiency(costUsd: number, totalTokens: number): string {
  if (totalTokens === 0) return '0';
  const creditsPerToken = (costUsd / CREDIT_COST_USD) / totalTokens;
  const per1K = creditsPerToken * 1000;
  if (per1K < 1) return per1K.toFixed(2);
  return per1K.toFixed(1);
}

function resolvePhase(entry: TokenUsageEntry): TokenPhase {
  if (entry.phase) return entry.phase;

  // Back-compat inference for entries recorded before `phase` was added.
  if (entry.callType === 'config-micro-agent' || entry.callType === 'mod-menu-filter') {
    return 'preflight';
  }
  if (entry.callType.startsWith('initial-analysis')) return 'initial-analysis';
  if (entry.callType === 'holistic-follow-up') return 'follow-up';

  return 'other';
}

function fallbackPhaseBreakdown(entry: TokenUsageEntry): PhaseTokenBreakdown {
  if (entry.callType.startsWith('initial-analysis')) {
    return {
      contextInputTokens: entry.inputTokens,
      staticContextInputTokens: entry.inputTokens,
      carryoverToolOutputContextTokens: 0,
      reasoningTokens: 0,
      toolCallInputTokens: 0,
      toolCallOutputTokens: 0,
      finalOutputTokens: entry.outputTokens,
    };
  }

  return {
    contextInputTokens: 0,
    staticContextInputTokens: 0,
    carryoverToolOutputContextTokens: 0,
    reasoningTokens: 0,
    toolCallInputTokens: 0,
    toolCallOutputTokens: 0,
    finalOutputTokens: entry.outputTokens,
  };
}

function fallbackToolBreakdown(entry: TokenUsageEntry): ToolTokenBreakdown[] {
  if (!entry.tools || entry.tools.length === 0) return [];

  const count = entry.tools.length;
  const perToolIn = Math.round(entry.inputTokens / count);
  const perToolOut = Math.round(entry.outputTokens / count);

  return entry.tools.map((tool) => ({
    tool,
    inputTokens: perToolIn,
    outputTokens: perToolOut,
    totalTokens: perToolIn + perToolOut,
    calls: 1,
    estimated: true,
  }));
}

function mergePhaseBreakdown(
  target: PhaseTokenBreakdown,
  source: PhaseTokenBreakdown
): void {
  target.contextInputTokens += source.contextInputTokens;
  target.staticContextInputTokens =
    (target.staticContextInputTokens ?? 0) + (source.staticContextInputTokens ?? 0);
  target.carryoverToolOutputContextTokens =
    (target.carryoverToolOutputContextTokens ?? 0) + (source.carryoverToolOutputContextTokens ?? 0);
  target.reasoningTokens += source.reasoningTokens;
  target.toolCallInputTokens += source.toolCallInputTokens;
  target.toolCallOutputTokens += source.toolCallOutputTokens;
  target.finalOutputTokens += source.finalOutputTokens;
}

export function shouldShowReasoningRow(phases: PhaseTokenBreakdown[]): boolean {
  return phases.some((phase) => phase.reasoningTokens > 0);
}

const isDevMode = import.meta.env.DEV;

export function TokenUsageDrawer({ isOpen, onClose }: TokenUsageDrawerProps) {
  const entries = useTokenStore((state) => state.entries);
  const totals = useTokenStore((state) => state.totals);
  const sessionStarted = useTokenStore((state) => state.sessionStarted);
  const clearSession = useTokenStore((state) => state.clearSession);
  const creditBalance = useTokenStore(selectCreditBalance);
  const creditsUsedSession = useTokenStore(selectCreditsUsedSession);

  // Derive the active model from the most recent entry
  const activeModel = useMemo(() => {
    const lastWithModel = [...entries].reverse().find((e) => e.modelId);
    if (!lastWithModel?.modelId) return null;
    const id = lastWithModel.modelId;
    const pricing = MODEL_PRICING[id];
    // Format model name: "gpt-5.4-2026-03-05" → "GPT-5.4"
    const displayName = id
      .replace(/^gpt-/, 'GPT-')
      .replace(/-\d{4}-\d{2}-\d{2}$/, '')
      .replace(/-mini$/, ' Mini');
    return { id, displayName, pricing };
  }, [entries]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const { phaseLedgers, sessionTools } = useMemo(() => {
    const byPhase = new Map<TokenPhase, PhaseLedger>();
    const toolTotals: Record<string, ToolTokenBreakdown> = {};

    for (const entry of entries) {
      const phase = resolvePhase(entry);
      const config = PHASE_CONFIG[phase];
      let ledger = byPhase.get(phase);
      if (!ledger) {
        ledger = {
          phase,
          label: config.label,
          icon: config.icon,
          color: config.color,
          glowColor: config.glowColor,
          calls: 0,
          totalTokens: 0,
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          phases: { ...emptyPhaseBreakdown },
          tools: {},
        };
        byPhase.set(phase, ledger);
      }

      ledger.calls += 1;
      ledger.totalTokens += entry.totalTokens;
      ledger.costUsd += entry.costUsd;
      ledger.inputTokens += entry.inputTokens;
      ledger.outputTokens += entry.outputTokens;

      mergePhaseBreakdown(
        ledger.phases,
        entry.phaseBreakdown ?? fallbackPhaseBreakdown(entry)
      );

      const tools = entry.toolBreakdown && entry.toolBreakdown.length > 0
        ? entry.toolBreakdown
        : fallbackToolBreakdown(entry);

      for (const tool of tools) {
        const existing = ledger.tools[tool.tool];
        if (existing) {
          existing.inputTokens += tool.inputTokens;
          existing.outputTokens += tool.outputTokens;
          existing.totalTokens += tool.totalTokens;
          existing.calls += tool.calls;
          existing.estimated = existing.estimated || tool.estimated;
        } else {
          ledger.tools[tool.tool] = { ...tool };
        }

        const sessionTool = toolTotals[tool.tool];
        if (sessionTool) {
          sessionTool.inputTokens += tool.inputTokens;
          sessionTool.outputTokens += tool.outputTokens;
          sessionTool.totalTokens += tool.totalTokens;
          sessionTool.calls += tool.calls;
          sessionTool.estimated = sessionTool.estimated || tool.estimated;
        } else {
          toolTotals[tool.tool] = { ...tool };
        }
      }
    }

    const ledgers: PhaseLedger[] = [];
    for (const phase of PHASE_ORDER) {
      const item = byPhase.get(phase);
      if (item) ledgers.push(item);
    }

    const tools = Object.values(toolTotals).sort((a, b) => b.totalTokens - a.totalTokens);

    return { phaseLedgers: ledgers, sessionTools: tools };
  }, [entries]);

  const hasAnyReasoning = useMemo(
    () => shouldShowReasoningRow(phaseLedgers.map((ledger) => ledger.phases)),
    [phaseLedgers]
  );

  const getSessionDuration = () => {
    const elapsed = Date.now() - sessionStarted;
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const cacheSavingsPercentage = useMemo(() => {
    const wouldHaveCost = totals.costUsd + totals.savingsUsd;
    if (wouldHaveCost <= 0) return 0;
    return Math.round((totals.savingsUsd / wouldHaveCost) * 100);
  }, [totals.costUsd, totals.savingsUsd]);

  const renderLedgerCard = (ledger: PhaseLedger, index: number) => {
    const Icon = ledger.icon;
    const percentage = totals.totalTokens > 0
      ? Math.round((ledger.totalTokens / totals.totalTokens) * 100)
      : 0;
    const toolRows = Object.values(ledger.tools)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 8);
    const hasEstimatedTools = toolRows.some((tool) => tool.estimated);

    return (
      <motion.div
        key={ledger.phase}
        custom={index}
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="rounded-lg p-3"
        style={{
          background: `linear-gradient(135deg, ${ledger.glowColor.replace('0.38', '0.07')} 0%, transparent 100%)`,
          border: `1px solid ${ledger.glowColor.replace('0.38', '0.24')}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: ledger.glowColor.replace('0.38', '0.15'),
                border: `1px solid ${ledger.glowColor.replace('0.38', '0.26')}`,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: ledger.color }} />
            </div>
            <div>
              <div className="text-sm font-display font-medium text-slate-200">
                {ledger.label}
              </div>
              <div className="text-[0.625rem] text-slate-500">
                {ledger.calls} call{ledger.calls !== 1 ? 's' : ''} | {formatTokens(ledger.totalTokens)} tokens ({percentage}%)
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-sm font-semibold" style={{ color: ledger.color }}>
                {isDevMode ? formatCost(ledger.costUsd) : formatCredits(ledger.costUsd)}
              </span>
              <span className="text-[0.5625rem]" style={{ color: ledger.color, opacity: 0.6 }}>
                {isDevMode ? 'USD' : 'credits'}
              </span>
            </div>
            {isDevMode && (
              <div className="text-[0.5625rem] text-slate-500">
                {formatCredits(ledger.costUsd)} credits
              </div>
            )}
            <div className="text-[0.625rem] text-slate-500">
              {formatTokens(ledger.inputTokens)} in | {formatTokens(ledger.outputTokens)} out
            </div>
          </div>
        </div>

        <div className="mt-2 h-1 rounded-full bg-slate-800/50 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ delay: 0.2 + index * 0.05, duration: 0.4 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${ledger.color} 0%, ${ledger.glowColor.replace('0.38', '0.65')} 100%)`,
            }}
          />
        </div>

        <div className="mt-3 space-y-2 text-[0.625rem]">
          <div className="text-[0.5625rem] text-slate-500 uppercase tracking-wider">Input</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1.5">
              <span className="text-slate-400 uppercase tracking-wider">Context</span>
              <div className="mt-0.5 text-slate-200 font-medium">
                {formatTokens(ledger.phases.contextInputTokens)}
              </div>
              <div className="mt-1 space-y-0.5 text-[0.5625rem] text-slate-500 leading-tight">
                <div>
                  Static: {formatTokens(
                    ledger.phases.staticContextInputTokens
                      ?? Math.max(
                        0,
                        ledger.phases.contextInputTokens - (ledger.phases.carryoverToolOutputContextTokens ?? 0)
                      )
                  )}
                </div>
                <div>
                  From prior tool output (est.): {formatTokens(ledger.phases.carryoverToolOutputContextTokens ?? 0)}
                </div>
              </div>
            </div>
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1.5">
              <span className="text-slate-400 uppercase tracking-wider">Tool Input</span>
              <div className="mt-0.5 text-slate-200 font-medium">
                {formatTokens(ledger.phases.toolCallInputTokens)}
              </div>
            </div>
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1.5">
              <span className="text-slate-400 uppercase tracking-wider">Tool Output (est.)</span>
              <div className="mt-0.5 text-slate-200 font-medium">
                {formatTokens(ledger.phases.toolCallOutputTokens)}
              </div>
            </div>
          </div>
          <div className="text-[0.5625rem] text-slate-500 uppercase tracking-wider">Output</div>
          <div className={cn('grid gap-2', hasAnyReasoning ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1.5">
              <span className="text-slate-400 uppercase tracking-wider">Final Output</span>
              <div className="mt-0.5 text-slate-200 font-medium">
                {formatTokens(ledger.phases.finalOutputTokens)}
              </div>
            </div>
            {hasAnyReasoning && (
              <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1.5">
                <span className="text-slate-400 uppercase tracking-wider">Reasoning</span>
                <div className="mt-0.5 text-slate-200 font-medium">
                  {formatTokens(ledger.phases.reasoningTokens)}
                </div>
              </div>
            )}
          </div>
        </div>

        {toolRows.length > 0 && (
          <div className="mt-3 rounded-md border border-violet-900/30 bg-black/25 px-2 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.625rem] font-display text-violet-300/85 uppercase tracking-wider">
                Tool Calls
              </span>
              {hasEstimatedTools && (
                <span className="text-[0.5625rem] text-slate-500">
                  payload-estimated
                </span>
              )}
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-fantasy pr-1">
              {toolRows.map((tool) => (
                <div
                  key={`${ledger.phase}-${tool.tool}`}
                  className="flex items-center justify-between text-[0.625rem]"
                >
                  <span className="text-slate-300 truncate pr-2">
                    {TOOL_DISPLAY_INFO[tool.tool]?.label ?? tool.tool}
                  </span>
                  <span className="text-slate-400 whitespace-nowrap">
                    {formatTokens(tool.inputTokens)} in | {formatTokens(tool.outputTokens)} out
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 z-40"
            style={{
              background: 'radial-gradient(ellipse at 80% 50%, rgba(139, 92, 246, 0.08) 0%, rgba(0, 0, 0, 0.75) 70%)',
            }}
          />

          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed right-0 top-0 h-full w-full max-w-[460px] z-50',
              'overflow-hidden'
            )}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(180deg,
                    rgba(15, 10, 25, 0.98) 0%,
                    rgba(8, 5, 15, 0.99) 100%
                  )
                `,
              }}
            />

            <div
              className="absolute left-0 top-0 bottom-0 w-px"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(167, 139, 250, 0.3) 20%, rgba(167, 139, 250, 0.3) 80%, transparent 100%)',
              }}
            />

            <div className="relative flex h-full flex-col">
              <div className="flex-shrink-0 border-b border-violet-900/30 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, rgba(167, 139, 250, 0.3) 0%, rgba(139, 92, 246, 0.15) 50%, transparent 70%)',
                          border: '1px solid rgba(167, 139, 250, 0.3)',
                          boxShadow: '0 0 20px rgba(139, 92, 246, 0.2), inset 0 0 15px rgba(167, 139, 250, 0.1)',
                        }}
                      >
                        <ScrollText className="w-5 h-5 text-violet-300" />
                      </div>
                      <motion.div
                        animate={{
                          y: [0, -4, 0],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-400/60"
                        style={{ boxShadow: '0 0 6px rgba(167, 139, 250, 0.6)' }}
                      />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-semibold text-violet-100 tracking-wide">
                        Oracle&apos;s Ledger
                      </h2>
                      <p className="text-[0.6875rem] text-violet-400/70">
                        Cost of divine insights this session
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      'rounded-lg p-2 transition-all duration-200',
                      'text-violet-400/60 hover:text-violet-300',
                      'hover:bg-violet-500/10'
                    )}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-fantasy">
                {entries.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl p-6 text-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)',
                      border: '1px solid rgba(139, 92, 246, 0.15)',
                    }}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-violet-500/10">
                      <Sparkles className="w-6 h-6 text-violet-400/50" />
                    </div>
                    <p className="text-sm text-violet-300/70 font-display">
                      The ledger awaits
                    </p>
                    <p className="text-xs text-violet-400/50 mt-1">
                      Import a build to begin tracking oracle costs
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-5">
                    {creditBalance !== null && !isDevMode && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                      >
                        <div
                          className="relative rounded-xl p-4 overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(180, 83, 9, 0.06) 50%, rgba(139, 92, 246, 0.04) 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.25)',
                          }}
                        >
                          <div
                            className="absolute top-0 left-0 w-40 h-40 -translate-y-1/2 -translate-x-1/4 rounded-full pointer-events-none"
                            style={{
                              background: 'radial-gradient(circle, rgba(251, 191, 36, 0.12) 0%, transparent 70%)',
                            }}
                          />
                          <div
                            className="absolute bottom-0 right-0 w-24 h-24 translate-y-1/2 translate-x-1/4 rounded-full pointer-events-none"
                            style={{
                              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
                            }}
                          />
                          <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                              <Coins className="w-4 h-4 text-amber-400" />
                              <span className="text-[0.625rem] font-semibold text-amber-400/80 uppercase tracking-[0.15em]">
                                Credit Balance
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-display font-bold text-amber-300">
                                {creditBalance.toLocaleString()}
                              </span>
                              <span className="text-sm text-amber-400/60 font-display">
                                credits
                              </span>
                            </div>
                            {creditsUsedSession > 0 && (
                              <div className="text-[0.6875rem] text-amber-400/50 mt-1.5">
                                {creditsUsedSession.toLocaleString()} used this session
                              </div>
                            )}
                            {creditsUsedSession > 0 && (
                              <div className="mt-3 h-1 rounded-full bg-slate-800/60 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.max(2, Math.min(100, (creditBalance / (creditBalance + creditsUsedSession)) * 100))}%`,
                                  }}
                                  transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
                                  className="h-full rounded-full"
                                  style={{
                                    background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.8) 0%, rgba(52, 211, 153, 0.6) 100%)',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
                          <span className="text-[0.6875rem] font-display font-semibold text-violet-300/80 uppercase tracking-wider">
                            Session Totals
                          </span>
                        </div>
                        {activeModel && isDevMode && (
                          <div className="flex items-center gap-2">
                            <div
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                              style={{
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(96, 165, 250, 0.06) 100%)',
                                border: '1px solid rgba(139, 92, 246, 0.2)',
                              }}
                            >
                              <Cpu className="w-3 h-3 text-violet-400/70" />
                              <span className="text-[0.625rem] font-display font-semibold text-violet-300/90 tracking-wide">
                                {activeModel.displayName}
                              </span>
                              {activeModel.pricing && (
                                <>
                                  <span className="text-slate-600 mx-0.5">|</span>
                                  <span className="text-[0.5625rem] font-mono text-slate-500">
                                    ${activeModel.pricing.inputPerMillion}
                                    <span className="text-slate-600">/</span>
                                    ${activeModel.pricing.outputPerMillion}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="col-span-2 relative rounded-xl p-4 overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(180, 83, 9, 0.05) 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.2)',
                          }}
                        >
                          <div
                            className="absolute top-0 right-0 w-32 h-32 -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none"
                            style={{
                              background: 'radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%)',
                            }}
                          />
                          <div className="relative flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Coins className="w-4 h-4 text-amber-400" />
                                <span className="text-[0.625rem] font-display text-amber-400/70 uppercase tracking-wider">
                                  Session Cost
                                </span>
                              </div>
                              {isDevMode ? (
                                <>
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-display font-bold text-amber-300">
                                      {formatCost(totals.costUsd)}
                                    </span>
                                    <span className="text-xs text-amber-400/50 font-display">USD</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5 text-[0.6875rem]">
                                    <span className="text-violet-300">
                                      {formatTokens(totals.totalTokens)} <span className="text-violet-400/50">tokens</span>
                                    </span>
                                    <span className="text-slate-600">|</span>
                                    <span className="text-amber-400/70">
                                      {formatCredits(totals.costUsd)} <span className="text-amber-400/40">credits</span>
                                    </span>
                                  </div>
                                  {totals.savingsUsd > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Zap className="w-3 h-3 text-emerald-400" />
                                      <span className="text-[0.625rem] text-emerald-400">
                                        {formatCost(totals.savingsUsd)} saved via cache ({cacheSavingsPercentage}%)
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-display font-bold text-amber-300">
                                      {formatCredits(totals.costUsd)}
                                    </span>
                                    <span className="text-xs text-amber-400/50 font-display">credits</span>
                                  </div>
                                  {totals.savingsUsd > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Zap className="w-3 h-3 text-emerald-400" />
                                      <span className="text-[0.625rem] text-emerald-400">
                                        {formatCredits(totals.savingsUsd)} credits saved via cache
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-[0.625rem] text-slate-500 uppercase tracking-wider">
                                {isDevMode ? 'Cost / 1K tokens' : 'Efficiency'}
                              </div>
                              <div className="text-sm font-medium text-slate-400">
                                {isDevMode
                                  ? formatCost(totals.totalTokens > 0 ? (totals.costUsd / totals.totalTokens) * 1000 : 0)
                                  : `${formatCreditEfficiency(totals.costUsd, totals.totalTokens)} credits/1K`}
                              </div>
                              {isDevMode && (
                                <div className="text-[0.625rem] text-slate-500 mt-0.5">
                                  {formatCreditEfficiency(totals.costUsd, totals.totalTokens)} credits/1K
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className="rounded-xl p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.06) 0%, transparent 100%)',
                            border: '1px solid rgba(96, 165, 250, 0.15)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-400/70" />
                            <span className="text-[0.625rem] text-blue-400/60 uppercase tracking-wider">
                              Tokens
                            </span>
                          </div>
                          <div className="text-lg font-display font-semibold text-blue-200">
                            {formatTokens(totals.totalTokens)}
                          </div>
                          <div className="text-[0.625rem] text-slate-500 mt-0.5">
                            {formatTokens(totals.inputTokens)} in | {formatTokens(totals.outputTokens)} out
                          </div>
                        </div>

                        <div
                          className="rounded-xl p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, transparent 100%)',
                            border: '1px solid rgba(139, 92, 246, 0.15)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Clock className="w-3.5 h-3.5 text-violet-400/70" />
                            <span className="text-[0.625rem] text-violet-400/60 uppercase tracking-wider">
                              Session
                            </span>
                          </div>
                          <div className="text-lg font-display font-semibold text-violet-200">
                            {getSessionDuration()}
                          </div>
                          <div className="text-[0.625rem] text-slate-500 mt-0.5">
                            {entries.length} oracle call{entries.length !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {totals.cachedTokens > 0 && (
                          <div
                            className="col-span-2 rounded-xl p-3"
                            style={{
                              background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.06) 0%, transparent 100%)',
                              border: '1px solid rgba(52, 211, 153, 0.15)',
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-emerald-300">
                                  {formatTokens(totals.cachedTokens)} cached tokens
                                </span>
                              </div>
                              <span className="text-[0.625rem] text-emerald-400/70">
                                {cacheSavingsPercentage}% saved
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {phaseLedgers.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
                          <span className="text-[0.6875rem] font-display font-semibold text-violet-300/80 uppercase tracking-wider">
                            By Phase
                          </span>
                        </div>

                        <div className="space-y-3">
                          {phaseLedgers.map((ledger, index) => renderLedgerCard(ledger, index))}
                        </div>
                      </motion.div>
                    )}

                    {sessionTools.length > 0 && phaseLedgers.length > 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
                          <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
                            Tool Calls (Session)
                          </span>
                        </div>

                        <div
                          className="rounded-lg p-3"
                          style={{
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, transparent 100%)',
                            border: '1px solid rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Wrench className="w-3.5 h-3.5 text-amber-400/70" />
                              <span className="text-[0.625rem] text-amber-300/80 uppercase tracking-wider">
                                {sessionTools.length} tool{sessionTools.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {sessionTools.some((t) => t.estimated) && (
                              <span className="text-[0.5625rem] text-slate-500">
                                payload-estimated
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-fantasy pr-1">
                            {sessionTools.map((tool) => (
                              <div
                                key={tool.tool}
                                className="flex items-center justify-between text-[0.625rem] border-b border-slate-800/50 last:border-b-0 py-1"
                              >
                                <div className="flex items-baseline gap-2 min-w-0 pr-2">
                                  <span className="text-slate-200 truncate">
                                    {TOOL_DISPLAY_INFO[tool.tool]?.label ?? tool.tool}
                                  </span>
                                  <span className="text-[0.5625rem] text-slate-500 whitespace-nowrap">
                                    x{tool.calls}
                                  </span>
                                </div>
                                <span className="text-slate-400 whitespace-nowrap">
                                  {formatTokens(tool.inputTokens)} in | {formatTokens(tool.outputTokens)} out
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {entries.length > 0 && (
                <div className="flex-shrink-0 border-t border-violet-900/30 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      clearSession();
                      onClose();
                    }}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-2.5',
                      'text-sm font-display text-slate-500 hover:text-red-400',
                      'bg-transparent hover:bg-red-500/10',
                      'rounded-lg border border-slate-800 hover:border-red-500/30',
                      'transition-all duration-200'
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear Ledger</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default TokenUsageDrawer;
