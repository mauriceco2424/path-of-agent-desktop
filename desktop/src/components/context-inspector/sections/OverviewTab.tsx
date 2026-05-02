/**
 * OverviewTab - Call summary, token breakdown, cache metrics, and section index.
 *
 * Shows a high-level view of the LLM call: pathway, call type, model,
 * token estimates, cache breakdown (shared vs pathway-specific),
 * token distribution bar, and a grid of all top-level sections with
 * their token proportions and cache status.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  GitBranch,
  BarChart3,
  Wrench,
  MessageCircle,
  FileText,
  Settings2,
  BookOpen,
  Shield,
  Database,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LLMContextDebugData, LLMContextSection } from '../../../store';
import {
  formatTokens,
  formatPathway,
  formatCallType,
  estimateTokens,
  categorizeSection,
} from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface OverviewTabProps {
  data: LLMContextDebugData;
  groupedSections: Record<string, LLMContextSection[]> | null;
}

// =============================================================================
// Helpers
// =============================================================================

function getSectionIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('build context') || lower.includes('build')) return Package;
  if (lower.includes('patch') || lower.includes('delta') || lower.includes('game changes') || lower.includes('recent game')) return GitBranch;
  if (lower.includes('ladder') || lower.includes('meta')) return BarChart3;
  if (lower.includes('config') || lower.includes('recommended')) return Settings2;
  if (lower.includes('constraint') || lower.includes('snapshot')) return Shield;
  if (lower.includes('mechanics') || lower.includes('reference')) return BookOpen;
  if (lower.includes('tool')) return Wrench;
  if (lower.includes('history') || lower.includes('conversation')) return MessageCircle;
  return FileText;
}

/** Color tokens for section cards in the overview grid, keyed by Grimoire tab */
interface SectionColorTokens {
  bgTint: string;
  border: string;
  iconBg: string;
  iconBorder: string;
  iconClass: string;
}

/** Card colors match the token distribution bar for visual consistency */
const TAB_COLORS: Record<string, SectionColorTokens> = {
  'build-context': {
    bgTint: 'rgba(251, 146, 60, 0.04)',
    border: 'rgba(251, 146, 60, 0.14)',
    iconBg: 'rgba(251, 146, 60, 0.10)',
    iconBorder: 'rgba(251, 146, 60, 0.18)',
    iconClass: 'text-orange-400/80',
  },
  'game-changes': {
    bgTint: 'rgba(52, 211, 153, 0.04)',
    border: 'rgba(52, 211, 153, 0.14)',
    iconBg: 'rgba(52, 211, 153, 0.10)',
    iconBorder: 'rgba(52, 211, 153, 0.18)',
    iconClass: 'text-emerald-400/80',
  },
  'ladder': {
    bgTint: 'rgba(129, 140, 248, 0.04)',
    border: 'rgba(129, 140, 248, 0.14)',
    iconBg: 'rgba(129, 140, 248, 0.10)',
    iconBorder: 'rgba(129, 140, 248, 0.18)',
    iconClass: 'text-indigo-400/80',
  },
  'mechanics': {
    bgTint: 'rgba(16, 185, 129, 0.04)',
    border: 'rgba(16, 185, 129, 0.14)',
    iconBg: 'rgba(16, 185, 129, 0.10)',
    iconBorder: 'rgba(16, 185, 129, 0.18)',
    iconClass: 'text-emerald-400/80',
  },
  'messages': {
    bgTint: 'rgba(250, 204, 21, 0.04)',
    border: 'rgba(250, 204, 21, 0.14)',
    iconBg: 'rgba(250, 204, 21, 0.10)',
    iconBorder: 'rgba(250, 204, 21, 0.18)',
    iconClass: 'text-yellow-400/80',
  },
  'tools': {
    bgTint: 'rgba(251, 191, 36, 0.04)',
    border: 'rgba(251, 191, 36, 0.14)',
    iconBg: 'rgba(251, 191, 36, 0.10)',
    iconBorder: 'rgba(251, 191, 36, 0.18)',
    iconClass: 'text-amber-400/80',
  },
};

const DEFAULT_COLORS: SectionColorTokens = TAB_COLORS['build-context'];

function getSectionColors(label: string): SectionColorTokens {
  const tab = categorizeSection(label);
  return TAB_COLORS[tab] ?? DEFAULT_COLORS;
}

interface TokenSegment {
  label: string;
  tokens: number;
  color: string;
}

/** Colors for each segment — maximally distinct hues so they read clearly at small sizes */
const SEGMENT_COLORS: Record<string, string> = {
  'system-prompt': 'rgba(45, 212, 191, 0.8)',    // teal — behavioral instructions
  'build-context': 'rgba(251, 146, 60, 0.8)',    // orange — build data + config
  'game-changes':  'rgba(52, 211, 153, 0.8)',    // emerald — patch notes
  'ladder':        'rgba(129, 140, 248, 0.8)',    // indigo — ladder data
  'mechanics':     'rgba(16, 185, 129, 0.8)',    // emerald — mechanics reference
  'messages':      'rgba(250, 204, 21, 0.8)',     // yellow — user message + task
};

const SEGMENT_LABELS: Record<string, string> = {
  'system-prompt': 'System Prompt',
  'build-context': 'Build Context',
  'game-changes':  'Game Changes',
  'ladder':        'Ladder Data',
  'mechanics':     'Mechanics',
  'messages':      'Messages',
};

function buildTokenSegments(data: LLMContextDebugData): TokenSegment[] {
  const segments: TokenSegment[] = [];

  // 1. System prompt (behavioral instructions)
  const systemPromptTokens = estimateTokens(data.systemPromptContent);
  if (systemPromptTokens > 0) {
    segments.push({ label: SEGMENT_LABELS['system-prompt'], tokens: systemPromptTokens, color: SEGMENT_COLORS['system-prompt'] });
  }

  // 2-4. Break injected context into tab categories
  const tabTokens: Record<string, number> = {
    'build-context': 0,
    'game-changes': 0,
    'ladder': 0,
    'mechanics': 0,
  };

  for (const section of data.systemContentSections) {
    const tab = categorizeSection(section.label);
    if (tab in tabTokens) {
      tabTokens[tab] += section.tokenEstimate;
    } else {
      // Fallback: route overview/system-prompt/messages/tools sections to build-context
      tabTokens['build-context'] += section.tokenEstimate;
    }
  }

  for (const tabKey of ['build-context', 'game-changes', 'ladder', 'mechanics'] as const) {
    if (tabTokens[tabKey] > 0) {
      segments.push({
        label: SEGMENT_LABELS[tabKey],
        tokens: tabTokens[tabKey],
        color: SEGMENT_COLORS[tabKey],
      });
    }
  }

  // 5. Messages (user message + runtime instruction + task message)
  const messageTokens = estimateTokens(data.userMessage) +
    estimateTokens(data.runtimeInstruction ?? '') +
    estimateTokens(data.taskMessage ?? '');
  if (messageTokens > 0) {
    segments.push({ label: SEGMENT_LABELS['messages'], tokens: messageTokens, color: SEGMENT_COLORS['messages'] });
  }

  return segments;
}

/** Compute cache metrics from sections with the cached flag */
function computeCacheMetrics(sections: LLMContextSection[]) {
  let cachedTokens = 0;
  let freshTokens = 0;
  let cachedCount = 0;
  let freshCount = 0;

  for (const s of sections) {
    if (s.cached) {
      cachedTokens += s.tokenEstimate;
      cachedCount++;
    } else {
      freshTokens += s.tokenEstimate;
      freshCount++;
    }
  }

  const total = cachedTokens + freshTokens;
  const cachedPct = total > 0 ? Math.round((cachedTokens / total) * 100) : 0;
  const hasCacheInfo = sections.some(s => s.cached !== undefined);

  return { cachedTokens, freshTokens, cachedCount, freshCount, cachedPct, total, hasCacheInfo };
}

// =============================================================================
// Sub-components
// =============================================================================

function SummaryCard({ data }: { data: LLMContextDebugData }) {
  const items = [
    { label: 'Pathway', value: formatPathway(data.pathway), accent: true },
    { label: 'Call Type', value: formatCallType(data.callType), accent: true },
    { label: 'Model', value: data.model || 'Unknown', accent: false },
    { label: 'Est. Tokens', value: `~${formatTokens(data.totalTokenEstimate)}`, accent: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-lg p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.07) 0%, rgba(15, 23, 42, 0.5) 100%)',
        border: '1px solid rgba(45, 212, 191, 0.18)',
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[0.5625rem] text-slate-500 uppercase tracking-wider">
              {item.label}
            </div>
            <div className={cn(
              'text-[0.8125rem] font-medium mt-0.5',
              item.accent ? 'text-teal-300' : 'text-slate-300'
            )}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CacheBreakdown({ sections }: { sections: LLMContextSection[] }) {
  const metrics = useMemo(() => computeCacheMetrics(sections), [sections]);

  if (!metrics.hasCacheInfo || metrics.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-lg p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
        border: '1px solid rgba(45, 212, 191, 0.12)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
        <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
          Prefix Cache
        </span>
        <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
          {metrics.cachedPct}% cached &bull; ~{formatTokens(metrics.total)} context tokens
        </span>
      </div>

      {/* Two-segment bar: cached (cyan/teal) vs fresh (slate) */}
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-800/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(metrics.cachedPct, 0.5)}%` }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
          className="h-full"
          style={{ background: 'rgba(45, 212, 191, 0.6)' }}
          title={`Shared (Cached): ~${formatTokens(metrics.cachedTokens)} (${metrics.cachedPct}%)`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(100 - metrics.cachedPct, 0.5)}%` }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
          className="h-full"
          style={{ background: 'rgba(148, 163, 184, 0.35)' }}
          title={`Pathway-Specific: ~${formatTokens(metrics.freshTokens)} (${100 - metrics.cachedPct}%)`}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-3">
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-teal-400/70" />
          <span className="text-[0.625rem] text-teal-400/80 font-medium">
            Shared Prefix
          </span>
          <span className="text-[0.5625rem] text-slate-500 tabular-nums">
            ~{formatTokens(metrics.cachedTokens)} &bull; {metrics.cachedCount} sections
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-slate-400/70" />
          <span className="text-[0.625rem] text-slate-400 font-medium">
            Pathway-Specific
          </span>
          <span className="text-[0.5625rem] text-slate-500 tabular-nums">
            ~{formatTokens(metrics.freshTokens)} &bull; {metrics.freshCount} sections
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function TokenBreakdownBar({ segments, total }: { segments: TokenSegment[]; total: number }) {
  if (total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-lg p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.04) 0%, rgba(15, 23, 42, 0.5) 100%)',
        border: '1px solid rgba(45, 212, 191, 0.12)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
        <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
          Token Distribution
        </span>
        <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
          ~{formatTokens(total)} total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-slate-800/50">
        {segments.map((seg) => {
          const pct = (seg.tokens / total) * 100;
          return (
            <motion.div
              key={seg.label}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct, 0.5)}%` }}
              transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
              className="h-full"
              style={{ background: seg.color }}
              title={`${seg.label}: ~${formatTokens(seg.tokens)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {segments.map((seg) => {
          const pct = ((seg.tokens / total) * 100).toFixed(1);
          return (
            <div key={seg.label} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: seg.color }}
              />
              <span className="text-[0.625rem] text-slate-400">
                {seg.label}
              </span>
              <span className="text-[0.5625rem] text-slate-600 tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SectionIndex({ sections }: { sections: LLMContextSection[] }) {
  if (sections.length === 0) return null;

  const totalTokens = sections.reduce((sum, s) => sum + s.tokenEstimate, 0);
  const hasCacheInfo = sections.some(s => s.cached !== undefined);

  // Split into cached and fresh groups when cache info is available
  const cachedSections = hasCacheInfo ? sections.filter(s => s.cached) : [];
  const freshSections = hasCacheInfo ? sections.filter(s => !s.cached) : [];

  const renderSectionCard = (section: LLMContextSection, idx: number, baseDelay: number) => {
    const Icon = getSectionIcon(section.label);
    const colors = getSectionColors(section.label);
    const pct = totalTokens > 0 ? ((section.tokenEstimate / totalTokens) * 100).toFixed(1) : '0';

    return (
      <motion.div
        key={`${section.label}-${idx}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: baseDelay + idx * 0.03 }}
        className="rounded-lg p-3 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, ${colors.bgTint} 0%, rgba(15, 23, 42, 0.5) 100%)`,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{
            background: colors.iconBg,
            border: `1px solid ${colors.iconBorder}`,
          }}
        >
          <Icon className={cn('w-3.5 h-3.5', colors.iconClass)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[0.75rem] font-medium text-slate-300 truncate">
            {section.label}
          </div>
          <div className="text-[0.5625rem] text-slate-500 tabular-nums">
            ~{formatTokens(section.tokenEstimate)} &bull; {pct}%
          </div>
        </div>
      </motion.div>
    );
  };

  // If no cache info, render flat list (backwards compatible)
  if (!hasCacheInfo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
          <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
            Context Sections
          </span>
          <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
            {sections.length} sections &bull; ~{formatTokens(totalTokens)}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {sections.map((section, idx) => renderSectionCard(section, idx, 0.2))}
        </div>
      </motion.div>
    );
  }

  // Grouped by cache status
  const cachedTokens = cachedSections.reduce((sum, s) => sum + s.tokenEstimate, 0);
  const freshTokens = freshSections.reduce((sum, s) => sum + s.tokenEstimate, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="space-y-5"
    >
      {/* Shared Prefix group */}
      {cachedSections.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-3.5 h-3.5 text-teal-400/70" />
            <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
              Shared Prefix
            </span>
            <span className="text-[0.5rem] font-medium text-teal-500/60 uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(45, 212, 191, 0.08)', border: '1px solid rgba(45, 212, 191, 0.15)' }}
            >
              Cached
            </span>
            <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
              {cachedSections.length} sections &bull; ~{formatTokens(cachedTokens)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {cachedSections.map((section, idx) => renderSectionCard(section, idx, 0.2))}
          </div>
        </div>
      )}

      {/* Pathway-Specific group */}
      {freshSections.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-slate-400/70" />
            <span className="text-[0.6875rem] font-display font-semibold text-slate-400/80 uppercase tracking-wider">
              Pathway-Specific
            </span>
            <span className="text-[0.5rem] font-medium text-slate-500/60 uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.15)' }}
            >
              Fresh
            </span>
            <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
              {freshSections.length} sections &bull; ~{formatTokens(freshTokens)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {freshSections.map((section, idx) => renderSectionCard(section, idx, 0.3))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// =============================================================================
// Main
// =============================================================================

export function OverviewTab({ data, groupedSections: _groupedSections }: OverviewTabProps) {
  const segments = useMemo(() => buildTokenSegments(data), [data]);

  return (
    <div className="space-y-6">
      <SummaryCard data={data} />
      <CacheBreakdown sections={data.systemContentSections} />
      <TokenBreakdownBar segments={segments} total={data.totalTokenEstimate} />
      <SectionIndex sections={data.systemContentSections} />
    </div>
  );
}
