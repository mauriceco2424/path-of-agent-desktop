/**
 * BuildLoadingSteps - Real-time step progress display for build visualization loading.
 *
 * Replaces generic "Loading build data..." spinners with a detailed step list
 * that streams from the backend via SSE.
 *
 * Two variants:
 * - `full`: Centered vertical step list for main content / right sidebar
 * - `compact`: Single-line current step indicator for left sidebar
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Circle, Check, X, Loader2, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { VizStepEvent, VizStepName } from '../../../../shared/types/VisualizationStream';

// ============================================
// Types
// ============================================

interface BuildLoadingStepsProps {
  steps: VizStepEvent[];
  variant: 'full' | 'compact';
  error?: string | null;
}

type StepStatus = 'pending' | 'started' | 'completed' | 'skipped' | 'error';

// ============================================
// Constants
// ============================================

const STEP_DEFS: Array<{ step: VizStepName; label: string; conditional?: boolean }> = [
  { step: 'loading_build', label: 'Loading build into PoB' },
  { step: 'detecting_config', label: 'Detecting combat configuration' },
  { step: 'calculating_stats', label: 'Calculating stats' },
];

const ROW_VARIANTS = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

const CHECK_VARIANTS = {
  hidden: { scale: 0 },
  visible: { scale: 1 },
};

const STAGGER_CHILDREN = {
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

// ============================================
// Helpers
// ============================================

function getStepStatus(stepName: VizStepName, steps: VizStepEvent[]): StepStatus {
  const event = steps.find((s) => s.step === stepName);
  if (!event) return 'pending';
  return event.status;
}

function getStepDuration(stepName: VizStepName, steps: VizStepEvent[]): number | undefined {
  const event = steps.find((s) => s.step === stepName);
  return event?.durationMs;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================
// Step Row (Full Variant)
// ============================================

interface StepRowProps {
  label: string;
  status: StepStatus;
  durationMs?: number;
  isLast: boolean;
}

function StepRow({ label, status, durationMs, isLast }: StepRowProps) {
  return (
    <motion.div
      variants={ROW_VARIANTS}
      className="relative flex items-center gap-3 py-2"
    >
      {/* Connecting line (behind icon) */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-[9px] top-[28px] w-px h-[calc(100%-12px)]',
            status === 'completed' || status === 'skipped'
              ? 'bg-slate-700/70'
              : 'bg-slate-700/30',
          )}
        />
      )}

      {/* Status icon */}
      <div className="relative z-10 flex-shrink-0">
        {status === 'pending' && (
          <Circle className="w-5 h-5 text-slate-600/40" />
        )}
        {status === 'started' && (
          <div className="relative">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            <div className="absolute inset-0 blur-md bg-amber-500/20 rounded-full" />
          </div>
        )}
        {status === 'completed' && (
          <motion.div
            variants={CHECK_VARIANTS}
            initial="hidden"
            animate="visible"
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Check className="w-5 h-5 text-emerald-400" />
          </motion.div>
        )}
        {status === 'error' && (
          <X className="w-5 h-5 text-red-400" />
        )}
        {status === 'skipped' && (
          <Minus className="w-5 h-5 text-slate-600" />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'text-sm font-display tracking-wide flex-1',
          status === 'pending' && 'text-slate-600',
          status === 'started' && 'text-slate-300',
          status === 'completed' && 'text-slate-400',
          status === 'error' && 'text-red-300/80',
          status === 'skipped' && 'text-slate-600 line-through',
        )}
      >
        {label}
      </span>

      {/* Duration badge */}
      {status === 'completed' && durationMs != null && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-slate-500 font-mono tabular-nums tracking-wide"
        >
          {formatDuration(durationMs)}
        </motion.span>
      )}
    </motion.div>
  );
}

// ============================================
// Full Variant
// ============================================

function FullLoadingSteps({ steps, error }: { steps: VizStepEvent[]; error?: string | null }) {
  // Filter: only show conditional steps if they appear in the stream
  const visibleSteps = STEP_DEFS.filter((def) => {
    if (!def.conditional) return true;
    return steps.some((s) => s.step === def.step);
  });

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        className="w-full max-w-[320px] px-4"
        initial="hidden"
        animate="visible"
        variants={STAGGER_CHILDREN}
      >
        {visibleSteps.map((def, i) => {
          const status = getStepStatus(def.step, steps);
          const durationMs = getStepDuration(def.step, steps);
          return (
            <StepRow
              key={def.step}
              label={def.label}
              status={status}
              durationMs={durationMs}
              isLast={i === visibleSteps.length - 1}
            />
          );
        })}

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 px-3 py-2 rounded-md bg-red-950/30 border border-red-500/20"
            >
              <p className="text-xs text-red-400 font-display tracking-wide">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================
// Compact Variant
// ============================================

function CompactLoadingSteps({ steps, error }: { steps: VizStepEvent[]; error?: string | null }) {
  if (error) {
    return (
      <div className="flex items-center gap-2">
        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm text-red-400 truncate">{error}</span>
      </div>
    );
  }

  // Check for step-level errors (not caught by the global vizStreamError)
  const errorEvent = steps.find((s) => s.status === 'error');
  // Find active step (status === 'started'), or fall back to last completed
  const activeEvent = steps.find((s) => s.status === 'started');
  const lastCompleted = [...steps].reverse().find((s) => s.status === 'completed');
  const displayEvent = activeEvent ?? errorEvent ?? lastCompleted;

  const allDone = steps.length > 0 && steps.every((s) => s.status === 'completed' || s.status === 'skipped');

  if (allDone) {
    return (
      <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span className="text-sm text-slate-400 truncate">Build loaded</span>
      </div>
    );
  }

  if (errorEvent && !activeEvent) {
    const errorLabel = STEP_DEFS.find((d) => d.step === errorEvent.step)?.label ?? errorEvent.label;
    return (
      <div className="flex items-center gap-2">
        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm text-red-400 truncate">{errorLabel} failed</span>
      </div>
    );
  }

  const label = displayEvent
    ? STEP_DEFS.find((d) => d.step === displayEvent.step)?.label ?? displayEvent.label
    : 'Loading build data';

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-shrink-0">
        <Loader2 className="w-4 h-4 text-amber-400/50 animate-spin" />
      </div>
      <span className="text-sm text-slate-400 truncate">
        {label}...
      </span>
    </div>
  );
}

// ============================================
// Main Export
// ============================================

export function BuildLoadingSteps({ steps, variant, error }: BuildLoadingStepsProps) {
  if (variant === 'compact') {
    return <CompactLoadingSteps steps={steps} error={error} />;
  }
  return <FullLoadingSteps steps={steps} error={error} />;
}
