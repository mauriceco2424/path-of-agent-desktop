/**
 * LlmCallsTab - Per-LLM-call message viewer for the Oracle's Grimoire.
 *
 * Shows the full input messages for EACH LLM call during the agent loop,
 * giving complete transparency into what the LLM sees on each round-trip.
 * Each call is displayed as a collapsible card with role-badged messages.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import {
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  MessageSquare,
  Bot,
  User,
  Settings,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDesktopStore } from '../../../store';

// =============================================================================
// Types
// =============================================================================

interface LlmCallEntry {
  callIndex: number;
  messages: Array<{ role: string; content: string }>;
  timestamp: number;
}

// =============================================================================
// Constants
// =============================================================================

const ROLE_CONFIG = new Map<string, { label: string; icon: typeof Bot; colorClass: string; bgClass: string; borderClass: string }>([
  ['system', { label: 'System', icon: Settings, colorClass: 'text-teal-300', bgClass: 'bg-teal-500/10', borderClass: 'border-teal-500/20' }],
  ['user', { label: 'User', icon: User, colorClass: 'text-amber-300', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20' }],
  ['assistant', { label: 'Assistant', icon: Bot, colorClass: 'text-blue-300', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/20' }],
  ['tool', { label: 'Tool', icon: Wrench, colorClass: 'text-violet-300', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/20' }],
]);

const DEFAULT_ROLE_CONFIG = { label: 'Unknown', icon: MessageSquare, colorClass: 'text-slate-300', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/20' };

/** Max characters to show before truncating with expand toggle */
const TRUNCATE_THRESHOLD = 200;

const contentVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.25, ease: 'easeOut' }, opacity: { duration: 0.2, delay: 0.05 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.2, ease: 'easeIn' }, opacity: { duration: 0.1 } },
  },
};

// =============================================================================
// Sub-components
// =============================================================================

function MessageContent({ content, role }: { content: string; role: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const shouldTruncate = (role === 'system' || role === 'tool') && content.length > TRUNCATE_THRESHOLD;
  const displayContent = shouldTruncate && !isExpanded
    ? content.slice(0, TRUNCATE_THRESHOLD) + '...'
    : content;

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success('Copied message content');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [content]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="relative group">
      <pre className="text-[0.6875rem] text-slate-400 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[400px] overflow-y-auto scrollbar-fantasy">
        {displayContent}
      </pre>

      <div className="flex items-center gap-2 mt-1.5">
        {shouldTruncate && (
          <button
            type="button"
            onClick={handleToggle}
            className="text-[0.5625rem] text-teal-400/70 hover:text-teal-300 transition-colors"
          >
            {isExpanded ? 'Show less' : `Show all (${content.length.toLocaleString()} chars)`}
          </button>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="text-[0.5625rem] text-slate-600 hover:text-slate-400 transition-colors opacity-0 group-hover:opacity-100 ml-auto"
        >
          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

function CallCard({ entry, index }: { entry: LlmCallEntry; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const timeStr = useMemo(() => {
    const d = new Date(entry.timestamp);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [entry.timestamp]);

  const totalChars = useMemo(() => {
    return entry.messages.reduce((sum, m) => sum + m.content.length, 0);
  }, [entry.messages]);

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const msg of entry.messages) {
      counts.set(msg.role, (counts.get(msg.role) ?? 0) + 1);
    }
    return counts;
  }, [entry.messages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="rounded-lg overflow-hidden transition-shadow duration-200"
      style={{
        background: `linear-gradient(135deg, rgba(45, 212, 191, 0.03) 0%, rgba(15, 23, 42, 0.6) 100%)`,
        border: `1px solid ${isExpanded ? 'rgba(45, 212, 191, 0.22)' : 'rgba(45, 212, 191, 0.10)'}`,
        boxShadow: isExpanded
          ? '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 1px rgba(45, 212, 191, 0.22)'
          : '0 1px 3px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Header - clickable */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150',
          'hover:bg-teal-500/5',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-teal-500/40'
        )}
      >
        {/* Left accent bar */}
        <div
          className="w-[3px] self-stretch rounded-full flex-shrink-0"
          style={{
            background: isExpanded
              ? 'linear-gradient(180deg, #2dd4bf 0%, #14b8a6 100%)'
              : 'linear-gradient(180deg, rgba(45, 212, 191, 0.25) 0%, transparent 100%)',
            boxShadow: isExpanded ? '0 0 8px rgba(45, 212, 191, 0.3)' : 'none',
          }}
        />

        {/* Call icon */}
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(45, 212, 191, 0.08)',
            border: '1px solid rgba(45, 212, 191, 0.15)',
          }}
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-400/80" />
        </div>

        {/* Label and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] font-medium text-teal-200/90 font-display">
              Call {entry.callIndex + 1}
            </span>
            <span className="text-[0.5625rem] text-slate-600 tabular-nums">
              {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[0.5625rem] text-slate-500">
              {entry.messages.length} messages
            </span>
            <span className="text-[0.5625rem] text-slate-600">&bull;</span>
            <span className="text-[0.5625rem] text-slate-500 tabular-nums">
              ~{Math.ceil(totalChars / 4).toLocaleString()} tokens
            </span>
            {/* Role summary badges */}
            <div className="flex items-center gap-1 ml-1">
              {[...roleCounts.entries()].map(([role, count]) => {
                const cfg = ROLE_CONFIG.get(role) ?? DEFAULT_ROLE_CONFIG;
                return (
                  <span
                    key={role}
                    className={cn('px-1 py-px rounded text-[0.5rem] font-medium border', cfg.bgClass, cfg.colorClass, cfg.borderClass)}
                  >
                    {count}{role.charAt(0).toUpperCase()}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-600 transition-transform duration-200 flex-shrink-0',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 space-y-3"
              style={{ borderTop: '1px solid rgba(45, 212, 191, 0.08)' }}
            >
              <div className="pt-3 space-y-2.5">
                {entry.messages.map((msg, msgIdx) => {
                  const cfg = ROLE_CONFIG.get(msg.role) ?? DEFAULT_ROLE_CONFIG;
                  const RoleIcon = cfg.icon;
                  return (
                    <div
                      key={`${entry.callIndex}-msg-${msgIdx}`}
                      className="rounded-md overflow-hidden"
                      style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.06)',
                      }}
                    >
                      {/* Message role header */}
                      <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                        <RoleIcon className={cn('w-3 h-3', cfg.colorClass)} />
                        <span className={cn('text-[0.625rem] font-medium uppercase tracking-wider', cfg.colorClass)}>
                          {cfg.label}
                        </span>
                        <span className="text-[0.5rem] text-slate-600 ml-auto tabular-nums">
                          {msg.content.length.toLocaleString()} chars
                        </span>
                      </div>

                      {/* Message content */}
                      <div className="px-3 py-2">
                        <MessageContent content={msg.content} role={msg.role} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LlmCallsTab() {
  const llmCallDebugHistory = useDesktopStore((s) => s.llmCallDebugHistory);

  const sortedCalls = useMemo(() => {
    return [...llmCallDebugHistory].sort((a, b) => a.callIndex - b.callIndex);
  }, [llmCallDebugHistory]);

  if (sortedCalls.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-8 text-center max-w-md mx-auto mt-12"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.05) 0%, transparent 100%)',
          border: '1px solid rgba(45, 212, 191, 0.15)',
        }}
      >
        <Sparkles className="w-6 h-6 text-teal-400/40 mx-auto mb-3" />
        <p className="text-sm text-teal-300/60 font-display">No LLM call data yet</p>
        <p className="text-xs text-teal-400/40 mt-1.5 leading-relaxed">
          Run an analysis to see the full messages sent to the LLM on each agent loop round-trip.
        </p>
      </motion.div>
    );
  }

  const totalMessages = sortedCalls.reduce((sum, c) => sum + c.messages.length, 0);
  const totalChars = sortedCalls.reduce(
    (sum, c) => sum + c.messages.reduce((s, m) => s + m.content.length, 0),
    0,
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-teal-400 to-teal-600" />
        <span className="text-[0.6875rem] font-display font-semibold text-teal-300/80 uppercase tracking-wider">
          Agent Loop Calls
        </span>
        <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
          {sortedCalls.length} calls &bull; {totalMessages} msgs &bull; ~{Math.ceil(totalChars / 4).toLocaleString()} tokens
        </span>
      </motion.div>

      {/* Call cards */}
      <div className="space-y-2">
        {sortedCalls.map((entry, idx) => (
          <CallCard key={`call-${entry.callIndex}-${entry.timestamp}`} entry={entry} index={idx} />
        ))}
      </div>
    </div>
  );
}
