/**
 * PathwayCostConfirmDialog
 *
 * Lightweight credit confirmation dialog shown before running pathway analyses
 * from the holistic proposals. Shows pathway breakdown, estimated costs,
 * and balance impact. Always shown (no "don't show again" option).
 */

import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Coins, AlertTriangle, ArrowRight, Swords } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MIN_CREDITS_PER_PATHWAY } from '../../../../shared/types/Credits';

// =============================================================================
// Pathway display config
// =============================================================================

const PATHWAY_META: Record<string, { label: string; color: string }> = {
  skills: { label: 'Skills', color: '#22d3ee' },
  gear: { label: 'Gear', color: '#f59e0b' },
  tree: { label: 'Tree', color: '#34d399' },
};

// =============================================================================
// Props
// =============================================================================

interface PathwayCostConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  pathways: string[];
  currentBalance: number | null;
}

// =============================================================================
// Component
// =============================================================================

export function PathwayCostConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  pathways,
  currentBalance,
}: PathwayCostConfirmDialogProps) {
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

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  const totalCost = pathways.length * MIN_CREDITS_PER_PATHWAY;
  const remaining =
    currentBalance !== null ? currentBalance - totalCost : null;

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
          aria-label="Confirm pathway analysis"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Card */}
          <motion.div
            className={cn(
              'relative w-full max-w-sm mx-4',
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
            <div className="flex items-center gap-3 px-6 pt-5 pb-4">
              <div className="relative">
                <Coins className="w-5 h-5 text-amber-400" />
                <div className="absolute inset-0 blur-md bg-amber-400/30 rounded-full" />
              </div>
              <h2 className="font-display text-lg font-semibold text-slate-100 tracking-wide">
                Confirm Analysis
              </h2>
              <button
                onClick={onCancel}
                className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-5 space-y-4">
              {/* Cost summary */}
              <div className="text-center space-y-3">
                <p className="text-sm text-slate-400">
                  This will use approximately
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-2xl font-display font-semibold text-amber-200 tabular-nums text-glow-amber">
                    ~{totalCost}
                  </span>
                  <span className="text-sm text-slate-400">credits</span>
                </div>
              </div>

              {/* Pathway breakdown */}
              <div className="space-y-1.5">
                {pathways.map((pathway) => {
                  const meta = PATHWAY_META[pathway];
                  if (!meta) return null;
                  return (
                    <div
                      key={pathway}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800/30"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-sm text-slate-300">
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-sm text-slate-400 tabular-nums">
                        ~{MIN_CREDITS_PER_PATHWAY}c
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="divider-ornate w-3/4 mx-auto" />

              {/* Balance section (prod) or dev-mode note */}
              {currentBalance !== null ? (
                <div className="space-y-2 px-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Current balance
                    </span>
                    <span className="text-sm text-slate-200 tabular-nums font-medium">
                      {currentBalance}c
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      After analysis
                    </span>
                    <span
                      className={cn(
                        'text-sm tabular-nums font-medium',
                        remaining !== null && remaining >= MIN_CREDITS_PER_PATHWAY
                          ? 'text-emerald-400'
                          : 'text-amber-400',
                      )}
                    >
                      ~{remaining}c
                    </span>
                  </div>

                  {/* Low balance warning */}
                  {remaining !== null && remaining >= 0 && remaining < MIN_CREDITS_PER_PATHWAY && (
                    <div className="flex items-start gap-2 mt-1 px-2.5 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-400/80 leading-relaxed">
                        You won't have enough credits for another pathway after this.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center px-1">
                  <p className="text-xs text-slate-500">
                    Development mode — no credits will be deducted
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex items-center justify-end gap-2.5">
              <button
                onClick={onCancel}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'text-slate-400 hover:text-slate-200',
                  'bg-slate-800/50 border border-slate-700/50',
                  'hover:bg-slate-800 hover:border-slate-600/50',
                  'transition-all duration-200',
                )}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-semibold',
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
                <Swords className="w-4 h-4" />
                Run Analysis
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
