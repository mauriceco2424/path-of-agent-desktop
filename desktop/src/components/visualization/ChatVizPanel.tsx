/**
 * ChatVizPanel Component
 *
 * Displays in the left panel when the Chat tab is active.
 * Shows compact build stats, active tools, and trade search progress.
 * Provides contextual information while the user chats.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Wrench,
  Search,
  Loader2,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Target,
  TrendingUp,
  Newspaper,
  Sword,
  Shield,
  Zap,
  FlaskConical,
  Map as MapIcon,
  TreePine,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LiveTradeSearchState } from '../../hooks/useDesktopChat';
import type { ToolExecutionInfo } from '../../../../shared/types/Chat';

// ============================================
// Type Definitions
// ============================================

export interface ChatVizPanelProps {
  activeTools?: Map<string, ToolExecutionInfo>;
  liveTradeSearch?: LiveTradeSearchState | null;
  suggestedQuestions?: string[];
  leagueQuestions?: string[];
  onSendQuestion?: (content: string) => Promise<void>;
  isSending?: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format large numbers with K/M suffixes
 */
function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format budget display with currency
 */
function formatBudget(budget?: { max: number; currency: 'chaos' | 'divine' }): string {
  if (!budget) return 'Unknown';
  const suffix = budget.currency === 'divine' ? 'div' : 'c';
  return `${budget.max} ${suffix}`;
}

// ============================================
// Constants
// ============================================

type GuidanceCategory = {
  id: string;
  label: string;
  icon: typeof Sparkles;
  color: string;
  bgColor: string;
  questions: string[];
};

const FALLBACK_BUILD_QUESTIONS = [
  '[Damage] What is my main damage scaling plan?',
  '[Damage][Sustain] What are the key mechanics my build relies on?',
  '[Defense] What defensive layers am I missing or under-invested in?',
];

const FALLBACK_LEAGUE_QUESTIONS = [
  '[League] What are the most important mechanics in the current league?',
  '[League][Gear] Which league rewards are most valuable for my build?',
  '[League][Mapping] How should I adapt my atlas strategy for this league with my build?',
];

const FALLBACK_OTHER_QUESTIONS = [
  '[Gear] What is the next cheapest upgrade that matters most?',
  '[Mapping] What should I farm with this build right now?',
];

type ParsedQuestion = {
  text: string;
  tags: string[];
};

function parseTaggedQuestion(raw: string): ParsedQuestion {
  const tags: string[] = [];
  let remaining = raw.trim().replace(/^["“”]+/, '').replace(/["“”]+$/, '').trim();

  while (remaining.startsWith('[')) {
    const end = remaining.indexOf(']');
    if (end <= 1) break;
    const tag = remaining.slice(1, end).trim();
    if (!tag) break;
    tags.push(tag);
    remaining = remaining.slice(end + 1).trim();
  }

  const uniqueTags = Array.from(new Set(tags)).slice(0, 3);
  const text = remaining.endsWith('?') ? remaining : `${remaining}?`;
  return { text, tags: uniqueTags };
}

function tagColor(tag: string): string {
  const normalized = tag.toLowerCase();
  if (normalized === 'damage') return 'bg-rose-500/10 text-rose-200 border-rose-500/20';
  if (normalized === 'defense') return 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20';
  if (normalized === 'auras') return 'bg-violet-500/10 text-violet-200 border-violet-500/20';
  if (normalized === 'gear') return 'bg-amber-500/10 text-amber-200 border-amber-500/20';
  if (normalized === 'tree') return 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20';
  if (normalized === 'flasks') return 'bg-lime-500/10 text-lime-200 border-lime-500/20';
  if (normalized === 'mapping') return 'bg-sky-500/10 text-sky-200 border-sky-500/20';
  if (normalized === 'bossing') return 'bg-fuchsia-500/10 text-fuchsia-200 border-fuchsia-500/20';
  if (normalized === 'sustain') return 'bg-teal-500/10 text-teal-200 border-teal-500/20';
  if (normalized === 'league') return 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20';
  return 'bg-slate-700/30 text-slate-200 border-slate-600/30';
}

function tagIcon(tag: string) {
  const normalized = tag.toLowerCase();
  if (normalized === 'damage') return Sword;
  if (normalized === 'defense') return Shield;
  if (normalized === 'auras') return Zap;
  if (normalized === 'gear') return Target;
  if (normalized === 'tree') return TreePine;
  if (normalized === 'flasks') return FlaskConical;
  if (normalized === 'mapping') return MapIcon;
  if (normalized === 'bossing') return Target;
  if (normalized === 'sustain') return Sparkles;
  if (normalized === 'league') return Newspaper;
  return Sparkles;
}

function buildGuidanceCategories(params: {
  suggestedQuestions?: string[];
  leagueQuestions?: string[];
}): GuidanceCategory[] {
  const suggested = (params.suggestedQuestions?.filter(Boolean) ?? []).slice(0, 10);
  const league = (params.leagueQuestions?.filter(Boolean) ?? []).slice(0, 5);

  return [
    {
      id: 'your-build',
      label: 'For Your Build',
      icon: Sparkles,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      questions: suggested.length ? suggested : FALLBACK_BUILD_QUESTIONS,
    },
    {
      id: 'league',
      label: 'League',
      icon: Newspaper,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      questions: league.length ? league : FALLBACK_LEAGUE_QUESTIONS,
    },
    {
      id: 'next-steps',
      label: 'Next Steps',
      icon: Target,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      questions: FALLBACK_OTHER_QUESTIONS,
    },
    {
      id: 'farming',
      label: 'Farming',
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      questions: [
        '[Mapping] What content is my build best at farming?',
        '[Mapping] How do I avoid bricking maps (mods) for my build?',
      ],
    },
  ];
}

// ============================================
// Sub-Components
// ============================================

/**
 * Section header for the panel
 */
function SectionHeader({
  title,
  icon,
  color = 'text-amber-400',
}: {
  title: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
      <span className={color}>{icon}</span>
      <h3 className={cn('text-sm font-medium uppercase tracking-wider', color)}>
        {title}
      </h3>
    </div>
  );
}

/**
 * Active tools display section
 */
function ActiveToolsSection({ tools }: { tools: Map<string, ToolExecutionInfo> }) {
  const toolEntries = Array.from(tools.entries());

  if (toolEntries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-black/15 border border-amber-600/40 rounded-lg space-y-2"
    >
      <SectionHeader
        title="Active Tools"
        icon={<Wrench className="w-3 h-3" />}
        color="text-amber-400"
      />

      <div className="space-y-2">
        {toolEntries.map(([toolId, info]) => (
          <motion.div
            key={toolId}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
            <span className="text-xs text-slate-300">{info.displayName || toolId}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Live trade search progress display
 */
function TradeSearchProgress({ search }: { search: LiveTradeSearchState }) {
  const {
    state,
    slot,
    budget,
    iteration,
    maxIterations,
    resultCount,
    minPrice,
    statusText,
    tradeUrl,
    totalResults,
    error,
  } = search;

  const isRunning = state === 'running';
  const isComplete = state === 'complete';
  const isError = state === 'error';

  // Calculate progress percentage
  const progressPercent = iteration && maxIterations
    ? Math.min((iteration / maxIterations) * 100, 100)
    : 0;

  // Calculate budget utilization
  const utilization = budget && minPrice
    ? Math.round((minPrice / budget.max) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 rounded-lg space-y-2',
        isRunning && 'border border-amber-600/50 bg-amber-950/20',
        isComplete && 'border border-green-600/50 bg-green-950/20',
        isError && 'border border-red-600/50 bg-red-950/20'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
          ) : (
            <Search className={cn(
              'w-3 h-3',
              isComplete ? 'text-green-400' : 'text-red-400'
            )} />
          )}
          <span className="text-xs font-medium text-slate-100">
            {slot ? `Searching: ${slot}` : 'Trade Search'}
          </span>
        </div>

        {budget && (
          <span className="text-xs text-slate-400">
            {formatBudget(budget)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && iteration !== undefined && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Iteration {iteration}{maxIterations ? ` / ${maxIterations}` : ''}</span>
            {resultCount !== undefined && (
              <span>{resultCount === null ? 'Searching...' : `${resultCount} found`}</span>
            )}
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-500"
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Status text */}
      {statusText && (
        <p className="text-xs text-slate-400">{statusText}</p>
      )}

      {/* Completion results */}
      {isComplete && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            {totalResults !== undefined && (
              <span className="text-green-400">
                {totalResults} found
              </span>
            )}
            {utilization > 0 && (
              <span className={cn(
                'text-slate-500',
                utilization >= 80 && 'text-green-400'
              )}>
                {utilization}% budget
              </span>
            )}
          </div>

          {tradeUrl && (
            <a
              href={tradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              View
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Error display */}
      {isError && error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </motion.div>
  );
}

/**
 * Empty state when no activity
 */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full px-6 text-center"
    >
      <div className="p-4 rounded-full bg-slate-800/50 mb-4">
        <MessageCircle className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-sm font-medium text-slate-300 mb-2">
        General Chat
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Ask me anything about your build or Path of Exile. I can help with
        game mechanics, crafting strategies, or general questions.
      </p>
    </motion.div>
  );
}

/**
 * Individual guidance category with examples
 */
function GuidanceCategory({
  category,
  index,
  onSendQuestion,
  isSending,
}: {
  category: GuidanceCategory;
  index: number;
  onSendQuestion?: (content: string) => Promise<void>;
  isSending?: boolean;
}) {
  const Icon = category.icon;
  const [expanded, setExpanded] = useState(false);
  const maxGroups = category.id === 'your-build' ? 4 : 3;

  const parsedQuestions = useMemo(
    () => category.questions.map(parseTaggedQuestion),
    [category.questions]
  );

  const groups = useMemo(() => {
    const byTag = new Map<string, ParsedQuestion[]>();
    for (const q of parsedQuestions) {
      let key = q.tags[0] || 'Other';
      if (category.id === 'league' && key.toLowerCase() === 'league') {
        key = q.tags[1] || 'League';
      }
      const list = byTag.get(key) || [];
      list.push(q);
      byTag.set(key, list);
    }

    return Array.from(byTag.entries())
      .map(([tag, questions]) => ({ tag, questions }))
      .sort((a, b) => b.questions.length - a.questions.length);
  }, [parsedQuestions, category.id]);

  const visibleGroups = expanded ? groups : groups.slice(0, maxGroups);
  const hasMoreGroups = groups.length > maxGroups;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="space-y-1.5"
    >
      <div className={cn(
        'flex items-center gap-1.5 px-1.5 py-0.5 rounded w-fit',
        category.bgColor
      )}>
        <Icon className={cn('w-4 h-4', category.color)} />
        <span className={cn('text-sm font-medium', category.color)}>
          {category.label}
        </span>
      </div>

      <div className="space-y-2 pl-1">
        {visibleGroups.map(({ tag, questions }) => {
          const TagIcon = tagIcon(tag);
          const clickable = !!onSendQuestion;
          const visibleQuestions = expanded ? questions.slice(0, 3) : questions.slice(0, 2);

          return (
            <div
              key={tag}
              className={cn(
                'rounded-lg border border-slate-700/50 bg-black/30',
                'p-2 space-y-1.5'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-md border',
                    tagColor(tag)
                  )}
                >
                  <TagIcon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-medium text-slate-200">{tag}</span>
                <span className="text-[0.625rem] text-slate-500">{questions.length}</span>
              </div>

              <ul className="space-y-1">
                {visibleQuestions.map((q) => {
                  const secondaryTags = q.tags
                    .filter((t) => t !== tag && t.toLowerCase() !== 'league')
                    .slice(0, 2);

                  return (
                    <li key={q.text}>
                      {clickable ? (
                        <button
                          type="button"
                          disabled={!!isSending}
                          onClick={() => void onSendQuestion(q.text)}
                          className={cn(
                            'w-full text-left text-sm leading-relaxed',
                            'text-slate-400 hover:text-slate-200',
                            'transition-colors',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          {secondaryTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {secondaryTags.map((t) => (
                                <span
                                  key={t}
                                  className={cn(
                                    'inline-flex items-center px-1.5 py-0.5 rounded border',
                                    'text-[0.625rem] leading-none',
                                    tagColor(t)
                                  )}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          <span className={cn('block', 'line-clamp-2')}>"{q.text}"</span>
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400 leading-relaxed">"{q.text}"</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {hasMoreGroups && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'text-xs text-slate-500 hover:text-slate-300',
            'transition-colors',
            'pl-1 w-fit'
          )}
        >
          {expanded ? 'Show fewer groups' : `Show more (${groups.length - maxGroups})`}
        </button>
      )}
    </motion.div>
  );
}

/**
 * Chat guidance section showing what users can ask about
 */
function ChatGuidanceSection({
  suggestedQuestions,
  leagueQuestions,
  onSendQuestion,
  isSending,
}: {
  suggestedQuestions?: string[];
  leagueQuestions?: string[];
  onSendQuestion?: (content: string) => Promise<void>;
  isSending?: boolean;
}) {
  const categories = buildGuidanceCategories({ suggestedQuestions, leagueQuestions });
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <SectionHeader
        title="Ask Me About"
        icon={<HelpCircle className="w-4 h-4" />}
        color="text-amber-400"
      />

      <p className="text-sm text-slate-500 leading-relaxed">
        Click a question to ask it:
      </p>

      <div className="space-y-3">
        {categories.map((category, index) => (
          <GuidanceCategory
            key={category.id}
            category={category}
            index={index}
            onSendQuestion={onSendQuestion}
            isSending={isSending}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function ChatVizPanel({
  activeTools,
  liveTradeSearch,
  suggestedQuestions,
  leagueQuestions,
  onSendQuestion,
  isSending,
}: ChatVizPanelProps) {
  // Check if we have any active content to show
  const hasActiveTools = activeTools && activeTools.size > 0;
  const hasTradeSearch = !!liveTradeSearch;

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        'bg-black/20 rounded-xl',
        'border border-slate-700/50'
      )}
    >
      <div className="flex-1 overflow-y-auto scrollbar-fantasy p-3 space-y-3">
        <AnimatePresence mode="wait">
          {/* Trade search progress - highest priority */}
          {hasTradeSearch && (
            <TradeSearchProgress search={liveTradeSearch} />
          )}

          {/* Active tools section */}
          {hasActiveTools && (
            <ActiveToolsSection tools={activeTools} />
          )}

          {/* Chat guidance section */}
          <ChatGuidanceSection
            suggestedQuestions={suggestedQuestions}
            leagueQuestions={leagueQuestions}
            onSendQuestion={onSendQuestion}
            isSending={isSending}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ChatVizPanel;
