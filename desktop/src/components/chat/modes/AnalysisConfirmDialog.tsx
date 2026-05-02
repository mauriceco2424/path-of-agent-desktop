/**
 * AnalysisConfirmDialog
 *
 * Portal-based confirmation modal shown before starting an analysis.
 * Displays pathway breakdown, total cost, balance impact, bandit quest verification,
 * and a "don't show again" option.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Coins, Check, AlertTriangle, Swords, ArrowRight, ScrollText, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MIN_CREDITS_PER_PATHWAY } from '../../../../../shared/types/Credits';
import type { BanditChoice, MajorGod, MinorGod } from '../CompactStatsSidebar';

// =============================================================================
// localStorage helpers
// =============================================================================

const DISMISS_KEY = 'poa-analysis-confirm-dismissed';

export function isAnalysisConfirmDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function resetAnalysisConfirmDismissed(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore
  }
}

// =============================================================================
// Pathway display config (mirrors FOCUS_COLORS in AnalyzeMode)
// =============================================================================

const PATHWAY_META: Record<string, { label: string; color: string }> = {
  holistic: { label: 'Assessment', color: '#60a5fa' },
  skills: { label: 'Skills', color: '#22d3ee' },
  gear: { label: 'Gear', color: '#f59e0b' },
  tree: { label: 'Tree', color: '#34d399' },
  progression: { label: 'Progression', color: '#ec4899' },
};

// =============================================================================
// Bandit options (same data as CompactStatsSidebar.BANDIT_OPTIONS)
// =============================================================================

const BANDIT_OPTIONS: ReadonlyArray<{
  value: BanditChoice;
  label: string;
  bonus: string;
}> = [
  { value: 'None', label: 'Kill All', bonus: '+1 Passive' },
  { value: 'Alira', label: 'Alira', bonus: '+15% Ele Res' },
  { value: 'Oak', label: 'Oak', bonus: '+40 Life' },
  { value: 'Kraityn', label: 'Kraityn', bonus: '+8% Speed' },
];

// =============================================================================
// Pantheon options
// =============================================================================

const MAJOR_GOD_OPTIONS: ReadonlyArray<{ value: MajorGod; label: string; bonus: string }> = [
  { value: 'None', label: 'None', bonus: 'No major god selected' },
  { value: 'TheBrineKing', label: 'The Brine King', bonus: 'Stun/freeze recovery' },
  { value: 'Lunaris', label: 'Lunaris', bonus: 'Phys damage reduction, dodge' },
  { value: 'Solaris', label: 'Solaris', bonus: 'Crit damage reduction' },
  { value: 'Arakaali', label: 'Arakaali', bonus: 'DoT recovery, chaos res' },
];

const MINOR_GOD_OPTIONS: ReadonlyArray<{ value: MinorGod; label: string; bonus: string }> = [
  { value: 'None', label: 'None', bonus: 'No minor god selected' },
  { value: 'Gruthkul', label: 'Gruthkul', bonus: 'Phys reduction when hit' },
  { value: 'Yugul', label: 'Yugul', bonus: 'Cold/reflect reduction' },
  { value: 'Abberath', label: 'Abberath', bonus: 'Burning ground immunity' },
  { value: 'Tukohama', label: 'Tukohama', bonus: 'Phys reduction stationary' },
  { value: 'Garukhan', label: 'Garukhan', bonus: 'Movement speed, evade' },
  { value: 'Ralakesh', label: 'Ralakesh', bonus: 'Blind/maim immunity' },
  { value: 'Ryslatha', label: 'Ryslatha', bonus: 'Life flask recovery' },
  { value: 'Shakari', label: 'Shakari', bonus: 'Chaos reduction, poison' },
];

// =============================================================================
// Pantheon dropdown (styled to match dark fantasy UI)
// =============================================================================

function PantheonSelect<T extends string>({ options, value, onChange, disabled, accentColor = 'teal' }: {
  options: ReadonlyArray<{ value: T; label: string; bonus: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  accentColor?: 'teal' | 'amber';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const selected = options.find((o) => o.value === value) ?? options[0];
  const isTeal = accentColor === 'teal';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-left',
          'border',
          isTeal
            ? 'border-slate-700/40 hover:border-teal-500/30 focus:border-teal-500/40'
            : 'border-slate-700/40 hover:border-amber-500/30 focus:border-amber-500/40',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
        }}
      >
        <div className="flex flex-col min-w-0">
          <span className={cn(
            'text-xs font-medium truncate',
            selected.value === 'None' ? 'text-slate-400' : 'text-slate-200',
          )}>
            {selected.label}
          </span>
          <span className="text-[0.6rem] text-slate-500 truncate">{selected.bonus}</span>
        </div>
        <ChevronDown className={cn(
          'w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200',
          isTeal ? 'text-teal-500/50' : 'text-amber-500/50',
          isOpen && 'rotate-180',
        )} />
      </button>

      {isOpen && (
        <div
          className="absolute z-[60] w-full mt-1 rounded-lg border border-slate-700/60 shadow-2xl shadow-black/60 max-h-[220px] overflow-y-auto scrollbar-fantasy"
          style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.98) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150',
                  active
                    ? isTeal
                      ? 'bg-teal-500/10 border-l-2 border-teal-400/60'
                      : 'bg-amber-500/10 border-l-2 border-amber-400/60'
                    : 'border-l-2 border-transparent hover:bg-slate-800/70',
                )}
              >
                {/* Active indicator */}
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                  active
                    ? isTeal ? 'bg-teal-400' : 'bg-amber-400'
                    : 'bg-slate-700',
                )} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={cn(
                    'text-xs font-medium',
                    active
                      ? isTeal ? 'text-teal-200' : 'text-amber-200'
                      : 'text-slate-300',
                  )}>
                    {opt.label}
                  </span>
                  <span className={cn(
                    'text-[0.6rem] leading-relaxed',
                    active
                      ? isTeal ? 'text-teal-400/60' : 'text-amber-400/60'
                      : 'text-slate-600',
                  )}>
                    {opt.bonus}
                  </span>
                </div>
                {active && (
                  <Check className={cn(
                    'w-3 h-3 flex-shrink-0',
                    isTeal ? 'text-teal-400/70' : 'text-amber-400/70',
                  )} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export interface AnalysisConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  selectedPathways: string[];
  totalCost: number;
  currentBalance: number | null;
  bandit: BanditChoice;
  onBanditChange: (b: BanditChoice) => void;
  isBanditLoading?: boolean;
  pantheonMajor: MajorGod;
  pantheonMinor: MinorGod;
  onPantheonChange: (major?: MajorGod, minor?: MinorGod) => void;
  isPantheonLoading?: boolean;
}

export function AnalysisConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  selectedPathways,
  totalCost,
  currentBalance,
  bandit,
  onBanditChange,
  isBanditLoading,
  pantheonMajor,
  pantheonMinor,
  onPantheonChange,
  isPantheonLoading,
}: AnalysisConfirmDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const isProgression = selectedPathways.length === 1 && selectedPathways[0] === 'progression';

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

  const handleBanditClick = useCallback(
    (b: BanditChoice) => {
      if (b !== bandit) onBanditChange(b);
    },
    [bandit, onBanditChange],
  );

  const displayCost = totalCost;
  const remaining =
    currentBalance !== null ? currentBalance - displayCost : null;

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
          aria-label="Confirm analysis"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Card */}
          <motion.div
            className={cn(
              'relative w-full max-w-md mx-4',
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
                {isProgression ? 'Confirm Progression' : 'Confirm Analysis'}
              </h2>
              <button
                onClick={onCancel}
                className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-5 space-y-5">
              {/* Cost summary */}
              <div className="text-center space-y-3">
                <p className="text-sm text-slate-400">
                  This analysis will use approximately
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-2xl font-display font-semibold text-amber-200 tabular-nums text-glow-amber">
                    ~{displayCost}
                  </span>
                  <span className="text-sm text-slate-400">credits</span>
                </div>
              </div>

              {/* Pathway breakdown */}
              {selectedPathways.length > 1 && (
                <div className="space-y-1.5">
                  {selectedPathways.map((pathway) => {
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
                          ~{MIN_CREDITS_PER_PATHWAY}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

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
                      {currentBalance} credits
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
                      ~{remaining} credits
                    </span>
                  </div>

                  {/* Low balance warning */}
                  {remaining !== null && remaining >= 0 && remaining < MIN_CREDITS_PER_PATHWAY && (
                    <div className="flex items-start gap-2 mt-1 px-2.5 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-400/80 leading-relaxed">
                        You won't have enough credits for another analysis after this.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center px-1">
                  <p className="text-xs text-slate-500">
                    Estimated cost for follow-up: ~10 credits
                  </p>
                </div>
              )}

              {/* Pantheon section (hidden for progression — no PoB dependency) */}
              {!isProgression && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-teal-400/70" />
                  <span className="text-sm font-display font-semibold text-slate-200 tracking-wide">
                    Pantheon
                  </span>
                  {isPantheonLoading && (
                    <Loader2 className="w-3.5 h-3.5 text-teal-400/60 animate-spin ml-auto" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Major god */}
                  <div className="space-y-1.5">
                    <span className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-medium">Major God</span>
                    <PantheonSelect
                      options={MAJOR_GOD_OPTIONS}
                      value={pantheonMajor}
                      onChange={(v) => onPantheonChange(v, undefined)}
                      disabled={isPantheonLoading}
                    />
                  </div>
                  {/* Minor god */}
                  <div className="space-y-1.5">
                    <span className="text-[0.65rem] uppercase tracking-wider text-slate-500 font-medium">Minor God</span>
                    <PantheonSelect
                      options={MINOR_GOD_OPTIONS}
                      value={pantheonMinor}
                      onChange={(v) => onPantheonChange(undefined, v)}
                      disabled={isPantheonLoading}
                    />
                  </div>
                </div>
                <p className="text-xs text-teal-400/50 leading-relaxed px-0.5">
                  Pantheon is <span className="px-1 py-0.5 rounded bg-teal-500/10 text-teal-300/80 font-medium">not detected</span> from imports. Set your in-game choices for accurate defensive calculations.
                </p>
              </div>
              )}

              {/* Bandit Quest section (hidden for progression — no PoB dependency) */}
              {!isProgression && (
              <div className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-amber-400/70" />
                  <span className="text-sm font-display font-semibold text-slate-200 tracking-wide">
                    Bandit Quest
                  </span>
                  {isBanditLoading && (
                    <Loader2 className="w-3.5 h-3.5 text-amber-400/60 animate-spin ml-auto" />
                  )}
                </div>

                {/* 1x4 bandit button row */}
                <div className="grid grid-cols-4 gap-1.5">
                  {BANDIT_OPTIONS.map((opt) => {
                    const active = opt.value === bandit;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleBanditClick(opt.value)}
                        disabled={isBanditLoading}
                        className={cn(
                          'flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg transition-all duration-200',
                          'border text-center',
                          active
                            ? 'border-amber-500/30 bg-amber-500/[0.08]'
                            : 'border-slate-700/30 bg-slate-800/30 hover:border-slate-600/40 hover:bg-slate-800/50',
                          isBanditLoading && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs font-medium leading-tight',
                            active ? 'text-amber-200' : 'text-slate-300',
                          )}
                        >
                          {opt.label}
                        </span>
                        <span
                          className={cn(
                            'text-[0.6rem] leading-tight',
                            active ? 'text-amber-400/70' : 'text-slate-500',
                          )}
                        >
                          {opt.bonus}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-amber-400/60 leading-relaxed px-0.5">
                  Bandit quest is <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-300/80 font-medium">not detected</span> from imports. If <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-300/80 font-medium">your in-game resistances are 15% higher</span> than shown in the sidebar, you likely have Alira — select it here for accurate analysis.
                </p>
              </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex items-center justify-between">
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
              <div className="flex items-center gap-2.5">
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
                  onClick={handleConfirm}
                  disabled={isBanditLoading || isPantheonLoading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-semibold',
                    'text-amber-200 hover:text-amber-100',
                    'border border-amber-500/40 hover:border-amber-500/60',
                    'transition-all duration-200',
                    (isBanditLoading || isPantheonLoading) && 'opacity-60 cursor-not-allowed',
                  )}
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.2) 50%, rgba(251, 191, 36, 0.1) 100%)',
                    boxShadow:
                      '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    if (isBanditLoading || isPantheonLoading) return;
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
                  {(isBanditLoading || isPantheonLoading) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Swords className="w-4 h-4" />
                  )}
                  {isProgression ? 'Start Assessment' : 'Start Analysis'}
                  <ArrowRight className="w-3.5 h-3.5" />
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
