/**
 * ContextInspectorSection Component
 *
 * An expandable card showing a single context section sent to the LLM.
 * Collapsed: icon + label + token badge + percentage progress bar.
 * Expanded: full content in monospace <pre> with scrollable overflow.
 *
 * Supports group-specific accent colors for visual grouping within tabs.
 * Falls back to teal accent when no group color is provided.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Named accent color presets — each group in the Grimoire picks one */
export type AccentColor = 'teal' | 'blue' | 'amber' | 'emerald' | 'violet' | 'slate';

interface AccentTokens {
  /** Card border idle */
  border: string;
  /** Card border hover / expanded */
  borderActive: string;
  /** Background gradient start (low-opacity tint) */
  bgTint: string;
  /** Accent bar idle */
  barIdle: string;
  /** Accent bar active (gradient) */
  barActiveFrom: string;
  barActiveTo: string;
  /** Icon container background + border */
  iconBg: string;
  iconBorder: string;
  /** Icon color class */
  iconClass: string;
  /** Token text color class */
  tokenClass: string;
  /** Progress bar gradient */
  progressFrom: string;
  progressTo: string;
  /** Content area border */
  contentBorder: string;
  /** Hover background */
  hoverBg: string;
  /** Focus ring */
  focusRing: string;
}

const ACCENT_TOKENS: Record<AccentColor, AccentTokens> = {
  teal: {
    border: 'rgba(45, 212, 191, 0.10)',
    borderActive: 'rgba(45, 212, 191, 0.22)',
    bgTint: 'rgba(45, 212, 191, 0.03)',
    barIdle: 'rgba(45, 212, 191, 0.25)',
    barActiveFrom: '#2dd4bf',
    barActiveTo: '#14b8a6',
    iconBg: 'rgba(45, 212, 191, 0.08)',
    iconBorder: 'rgba(45, 212, 191, 0.15)',
    iconClass: 'text-teal-400/80',
    tokenClass: 'text-teal-400/70',
    progressFrom: '#2dd4bf',
    progressTo: 'rgba(45, 212, 191, 0.4)',
    contentBorder: 'rgba(45, 212, 191, 0.08)',
    hoverBg: 'hover:bg-teal-500/5',
    focusRing: 'focus-visible:ring-teal-500/40',
  },
  blue: {
    border: 'rgba(96, 165, 250, 0.10)',
    borderActive: 'rgba(96, 165, 250, 0.22)',
    bgTint: 'rgba(96, 165, 250, 0.03)',
    barIdle: 'rgba(96, 165, 250, 0.25)',
    barActiveFrom: '#60a5fa',
    barActiveTo: '#3b82f6',
    iconBg: 'rgba(96, 165, 250, 0.08)',
    iconBorder: 'rgba(96, 165, 250, 0.15)',
    iconClass: 'text-blue-400/80',
    tokenClass: 'text-blue-400/70',
    progressFrom: '#60a5fa',
    progressTo: 'rgba(96, 165, 250, 0.4)',
    contentBorder: 'rgba(96, 165, 250, 0.08)',
    hoverBg: 'hover:bg-blue-500/5',
    focusRing: 'focus-visible:ring-blue-500/40',
  },
  amber: {
    border: 'rgba(251, 191, 36, 0.10)',
    borderActive: 'rgba(251, 191, 36, 0.22)',
    bgTint: 'rgba(251, 191, 36, 0.03)',
    barIdle: 'rgba(251, 191, 36, 0.25)',
    barActiveFrom: '#fbbf24',
    barActiveTo: '#f59e0b',
    iconBg: 'rgba(251, 191, 36, 0.08)',
    iconBorder: 'rgba(251, 191, 36, 0.15)',
    iconClass: 'text-amber-400/80',
    tokenClass: 'text-amber-400/70',
    progressFrom: '#fbbf24',
    progressTo: 'rgba(251, 191, 36, 0.4)',
    contentBorder: 'rgba(251, 191, 36, 0.08)',
    hoverBg: 'hover:bg-amber-500/5',
    focusRing: 'focus-visible:ring-amber-500/40',
  },
  emerald: {
    border: 'rgba(52, 211, 153, 0.10)',
    borderActive: 'rgba(52, 211, 153, 0.22)',
    bgTint: 'rgba(52, 211, 153, 0.03)',
    barIdle: 'rgba(52, 211, 153, 0.25)',
    barActiveFrom: '#34d399',
    barActiveTo: '#10b981',
    iconBg: 'rgba(52, 211, 153, 0.08)',
    iconBorder: 'rgba(52, 211, 153, 0.15)',
    iconClass: 'text-emerald-400/80',
    tokenClass: 'text-emerald-400/70',
    progressFrom: '#34d399',
    progressTo: 'rgba(52, 211, 153, 0.4)',
    contentBorder: 'rgba(52, 211, 153, 0.08)',
    hoverBg: 'hover:bg-emerald-500/5',
    focusRing: 'focus-visible:ring-emerald-500/40',
  },
  violet: {
    border: 'rgba(167, 139, 250, 0.10)',
    borderActive: 'rgba(167, 139, 250, 0.22)',
    bgTint: 'rgba(167, 139, 250, 0.03)',
    barIdle: 'rgba(167, 139, 250, 0.25)',
    barActiveFrom: '#a78bfa',
    barActiveTo: '#8b5cf6',
    iconBg: 'rgba(167, 139, 250, 0.08)',
    iconBorder: 'rgba(167, 139, 250, 0.15)',
    iconClass: 'text-violet-400/80',
    tokenClass: 'text-violet-400/70',
    progressFrom: '#a78bfa',
    progressTo: 'rgba(167, 139, 250, 0.4)',
    contentBorder: 'rgba(167, 139, 250, 0.08)',
    hoverBg: 'hover:bg-violet-500/5',
    focusRing: 'focus-visible:ring-violet-500/40',
  },
  slate: {
    border: 'rgba(148, 163, 184, 0.10)',
    borderActive: 'rgba(148, 163, 184, 0.18)',
    bgTint: 'rgba(148, 163, 184, 0.02)',
    barIdle: 'rgba(148, 163, 184, 0.20)',
    barActiveFrom: '#94a3b8',
    barActiveTo: '#64748b',
    iconBg: 'rgba(148, 163, 184, 0.06)',
    iconBorder: 'rgba(148, 163, 184, 0.12)',
    iconClass: 'text-slate-400/80',
    tokenClass: 'text-slate-400/60',
    progressFrom: '#94a3b8',
    progressTo: 'rgba(148, 163, 184, 0.4)',
    contentBorder: 'rgba(148, 163, 184, 0.08)',
    hoverBg: 'hover:bg-slate-500/5',
    focusRing: 'focus-visible:ring-slate-500/40',
  },
};

interface ContextInspectorSectionProps {
  label: string;
  content: string;
  tokenEstimate: number;
  totalTokens: number;
  icon: LucideIcon;
  index: number;
  /** Accent color for this card — matches the group it belongs to */
  accent?: AccentColor;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.3 },
  }),
};

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

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function ContextInspectorSection({
  label,
  content,
  tokenEstimate,
  totalTokens,
  icon: Icon,
  index,
  accent = 'teal',
}: ContextInspectorSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const t = ACCENT_TOKENS[accent];

  const percentage = totalTokens > 0
    ? Math.round((tokenEstimate / totalTokens) * 100)
    : 0;

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success(`Copied ${label}`);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [content, label]);

  const cardStyle = useMemo(() => ({
    background: `linear-gradient(135deg, ${t.bgTint} 0%, rgba(15, 23, 42, 0.6) 100%)`,
    border: `1px solid ${isExpanded ? t.borderActive : t.border}`,
    boxShadow: isExpanded
      ? `0 4px 16px rgba(0, 0, 0, 0.3), 0 0 1px ${t.borderActive}`
      : '0 1px 3px rgba(0, 0, 0, 0.15)',
  }), [t, isExpanded]);

  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="rounded-lg overflow-hidden transition-shadow duration-200"
      style={cardStyle}
    >
      {/* Clickable header */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5',
          'text-left transition-colors duration-150 cursor-pointer',
          t.hoverBg,
          'focus:outline-none focus-visible:ring-1',
          t.focusRing,
        )}
      >
        {/* Left accent bar */}
        <div
          className="w-0.5 h-5 flex-shrink-0 rounded-full transition-all duration-200"
          style={{
            background: isExpanded
              ? `linear-gradient(180deg, ${t.barActiveFrom} 0%, ${t.barActiveTo} 100%)`
              : t.barIdle,
          }}
        />

        {/* Icon */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{
            background: t.iconBg,
            border: `1px solid ${t.iconBorder}`,
          }}
        >
          <Icon className={cn('w-3.5 h-3.5', t.iconClass)} />
        </div>

        {/* Label */}
        <span className="flex-1 text-[0.75rem] font-medium text-slate-300 truncate">
          {label}
        </span>

        {/* Token badge */}
        <span className={cn('text-[0.625rem] font-mono tabular-nums flex-shrink-0', t.tokenClass)}>
          ~{formatTokens(tokenEstimate)}
        </span>

        {/* Percentage */}
        <span className="text-[0.5625rem] text-slate-500 w-8 text-right tabular-nums flex-shrink-0">
          {percentage}%
        </span>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={cn('p-1 rounded transition-colors flex-shrink-0', t.hoverBg)}
          title={`Copy ${label}`}
        >
          {isCopied
            ? <Check className={cn('w-3 h-3', t.iconClass)} />
            : <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />}
        </button>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        </motion.div>
      </div>

      {/* Progress bar (always visible) */}
      <div className="mx-3 mb-2 h-[3px] rounded-full bg-slate-800/50 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(1, percentage)}%` }}
          transition={{ delay: 0.1 + index * 0.04, duration: 0.4, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${t.progressFrom} 0%, ${t.progressTo} 100%)`,
          }}
        />
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <pre
                className={cn(
                  'text-[0.625rem] leading-relaxed font-mono',
                  'text-slate-400 whitespace-pre-wrap break-words',
                  'max-h-[300px] overflow-y-auto scrollbar-fantasy',
                  'rounded-md p-3',
                )}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${t.contentBorder}`,
                }}
              >
                {content || '(empty)'}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
