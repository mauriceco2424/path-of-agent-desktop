/**
 * FollowUpConfirmDialog
 *
 * Portal-based confirmation modal shown before sending a follow-up chat message.
 * Displays what the unified follow-up agent can do, the credit estimate, and a
 * "don't show again" option. Since unified is the only analysis mode, there is
 * no pathway concept — the capability list is fixed.
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  X,
  Coins,
  Check,
  MessageCircle,
  ArrowRight,
  Wrench,
  Shield,
  Sparkles,
  GitBranch,
  ShoppingCart,
  Combine,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MIN_CREDITS_FOLLOW_UP } from '../../../../../shared/types/Credits';

// =============================================================================
// localStorage helpers
// =============================================================================

const DISMISS_KEY = 'poa-followup-confirm-dismissed';

export function isFollowUpConfirmDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function resetFollowUpConfirmDismissed(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

// =============================================================================
// Capabilities — mirrors the unified follow-up tool bundle in
// backend/src/services/llm/langchain/tools/index.ts (UNIFIED_BUILD_TOOLS):
// test_unified_build (5 sub-tools) + search_trade.
//
// The HUB renders 4 pathway tiles (gear/skills/tree/trade) plus a full-width
// Combined Packages ribbon below — since "combined" is a cross-pathway
// capability, not a pathway itself.
// =============================================================================

interface PathwayTool {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Solid accent color (used for icon stroke, left bar, border glow). */
  color: string;
  /** RGB triplet (no alpha) for building rgba() values. */
  rgb: string;
}

const PATHWAY_TOOLS: PathwayTool[] = [
  {
    label: 'Gear',
    description: 'Test items, uniques & flasks in any slot',
    icon: Shield,
    color: '#14b8a6', // teal-500
    rgb: '20, 184, 166',
  },
  {
    label: 'Skills & Gems',
    description: 'Swap supports, auras, curses & heralds',
    icon: Sparkles,
    color: '#3b82f6', // blue-500
    rgb: '59, 130, 246',
  },
  {
    label: 'Passive Tree',
    description: 'Allocate nodes, test jewels & clusters',
    icon: GitBranch,
    color: '#a855f7', // purple-500
    rgb: '168, 85, 247',
  },
  {
    label: 'Trade Search',
    description: 'Find and price items on the PoE Trade API',
    icon: ShoppingCart,
    color: '#f59e0b', // amber-500
    rgb: '245, 158, 11',
  },
];

const ACCENT_COLOR = '#fbbf24'; // amber-400

// =============================================================================
// Motion variants — staggered entrance for the tile grid
// =============================================================================

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// =============================================================================
// Component
// =============================================================================

export interface FollowUpConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FollowUpConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
}: FollowUpConfirmDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleConfirm = useCallback(() => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(DISMISS_KEY, 'true');
      } catch {
        // ignore
      }
    }
    onConfirm();
  }, [dontShowAgain, onConfirm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Follow-up chat info"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Card */}
          <motion.div
            className={cn(
              'relative w-full max-w-lg mx-4',
              'card-forge corner-accent rounded-2xl',
              'border border-slate-700/50 bg-slate-900/95 shadow-2xl',
              'overflow-hidden',
            )}
            style={{
              ['--corner-color' as string]: 'rgba(251, 191, 36, 0.4)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3">
              <div className="relative">
                <MessageCircle className="w-5 h-5 text-amber-400" />
                <div className="absolute inset-0 blur-md bg-amber-400/30 rounded-full" />
              </div>
              <h2 className="font-display text-base font-semibold text-slate-100 tracking-wide">
                Follow-Up Chat
              </h2>
              <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-display font-semibold text-amber-200 tabular-nums">
                  ~{MIN_CREDITS_FOLLOW_UP}
                </span>
              </div>
              <button
                onClick={onCancel}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content — Capabilities HUB */}
            <div className="px-5 pb-4">
              {/* Section header with gradient fade */}
              <div className="flex items-center gap-2.5 mb-3">
                <Wrench
                  className="w-3.5 h-3.5"
                  style={{ color: ACCENT_COLOR, opacity: 0.9 }}
                />
                <span className="text-[0.6875rem] font-display font-semibold uppercase tracking-[0.2em] text-amber-400/90">
                  What the agent can do
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/15 to-transparent" />
              </div>

              {/* 2x2 pathway tile grid */}
              <motion.div
                className="grid grid-cols-2 gap-2"
                variants={gridVariants}
                initial="hidden"
                animate="visible"
              >
                {PATHWAY_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <motion.div
                      key={tool.label}
                      variants={tileVariants}
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="group relative overflow-hidden rounded-lg cursor-default"
                      style={{
                        background: `linear-gradient(135deg, rgba(${tool.rgb}, 0.10) 0%, rgba(2, 6, 23, 0.55) 55%, rgba(${tool.rgb}, 0.06) 100%)`,
                        border: `1px solid rgba(${tool.rgb}, 0.22)`,
                        boxShadow: `0 2px 10px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 18px rgba(${tool.rgb}, 0.05)`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.border = `1px solid rgba(${tool.rgb}, 0.42)`;
                        e.currentTarget.style.boxShadow = `0 4px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 28px rgba(${tool.rgb}, 0.12)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.border = `1px solid rgba(${tool.rgb}, 0.22)`;
                        e.currentTarget.style.boxShadow = `0 2px 10px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 0 18px rgba(${tool.rgb}, 0.05)`;
                      }}
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px]"
                        style={{
                          background: `linear-gradient(180deg, ${tool.color} 0%, rgba(${tool.rgb}, 0.15) 100%)`,
                          boxShadow: `0 0 10px rgba(${tool.rgb}, 0.35)`,
                        }}
                      />

                      {/* Top edge highlight */}
                      <div
                        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                        style={{
                          background: `linear-gradient(90deg, transparent 10%, rgba(${tool.rgb}, 0.35) 50%, transparent 90%)`,
                        }}
                      />

                      {/* Content */}
                      <div className="relative flex items-start gap-2.5 px-3 py-2.5">
                        {/* Icon container */}
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, rgba(${tool.rgb}, 0.18) 0%, rgba(${tool.rgb}, 0.08) 100%)`,
                            border: `1px solid rgba(${tool.rgb}, 0.3)`,
                            boxShadow: `0 0 14px rgba(${tool.rgb}, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.06)`,
                          }}
                        >
                          <Icon
                            className="w-[18px] h-[18px]"
                            style={{ color: tool.color }}
                          />
                        </div>

                        {/* Label + description */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div
                            className="text-[0.75rem] font-display font-semibold uppercase tracking-wide text-slate-100 leading-tight"
                            style={{
                              textShadow: `0 0 10px rgba(${tool.rgb}, 0.25)`,
                            }}
                          >
                            {tool.label}
                          </div>
                          <div className="text-[0.625rem] text-slate-400 mt-1 leading-snug">
                            {tool.description}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Combined Packages meta-ribbon (full width, amber-tinted) */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: 0.45 }}
                className="relative overflow-hidden rounded-lg mt-2 flex items-center gap-3 px-3 py-2"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(251, 191, 36, 0.09) 0%, rgba(180, 83, 9, 0.06) 50%, rgba(251, 191, 36, 0.09) 100%)',
                  border: '1px solid rgba(251, 191, 36, 0.25)',
                  boxShadow:
                    'inset 0 1px 0 rgba(251, 191, 36, 0.08), 0 2px 10px rgba(0, 0, 0, 0.2)',
                }}
              >
                {/* Top edge highlight */}
                <div
                  className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 10%, rgba(251, 191, 36, 0.4) 50%, transparent 90%)',
                  }}
                />

                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.18) 0%, rgba(180, 83, 9, 0.12) 100%)',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    boxShadow: '0 0 12px rgba(251, 191, 36, 0.15)',
                  }}
                >
                  <Combine className="w-4 h-4 text-amber-300" />
                </div>

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.6875rem] font-display font-semibold uppercase tracking-wider text-amber-200">
                    Combined Packages
                  </div>
                  <div className="text-[0.625rem] text-amber-200/60 leading-snug">
                    Bundle cross-pathway changes into one test
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 flex items-center justify-between">
              {/* Don't show again checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-all duration-200',
                    dontShowAgain
                      ? 'bg-amber-500/20 border-amber-500/50'
                      : 'border-slate-600 group-hover:border-slate-500',
                  )}
                  onClick={() => setDontShowAgain(!dontShowAgain)}
                >
                  {dontShowAgain && (
                    <Check className="w-3 h-3 text-amber-400" />
                  )}
                </div>
                <span
                  className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors"
                  onClick={() => setDontShowAgain(!dontShowAgain)}
                >
                  Don't show again
                </span>
              </label>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onCancel}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium',
                    'text-slate-400 hover:text-slate-200',
                    'bg-slate-800/50 border border-slate-700/50',
                    'hover:bg-slate-800 hover:border-slate-600/50',
                    'transition-all duration-200',
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold',
                    'text-amber-200 hover:text-amber-100',
                    'border border-amber-500/40 hover:border-amber-500/60',
                    'transition-all duration-200',
                  )}
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.2) 50%, rgba(251, 191, 36, 0.1) 100%)',
                    boxShadow:
                      '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(180, 83, 9, 0.3) 50%, rgba(251, 191, 36, 0.2) 100%)';
                    e.currentTarget.style.boxShadow =
                      '0 6px 25px rgba(0, 0, 0, 0.4), 0 0 30px rgba(251, 191, 36, 0.15), inset 0 1px 0 rgba(251, 191, 36, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.2) 50%, rgba(251, 191, 36, 0.1) 100%)';
                    e.currentTarget.style.boxShadow =
                      '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(251, 191, 36, 0.1)';
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Send Message
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
