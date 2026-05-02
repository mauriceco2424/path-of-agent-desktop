/**
 * NeonProgressBar Component
 *
 * A reusable progress bar with neon glow effects for the futuristic gaming-style UI.
 * Used in build score displays and pathway progress indicators.
 */

import { cn } from '../../lib/utils';

export interface NeonProgressBarProps {
  /** Current value (0-10 by default) */
  value: number;
  /** Maximum value (default 10) */
  max?: number;
  /** Color variant matching pathway colors */
  color: 'cyan' | 'magenta' | 'amber' | 'green' | 'red' | 'blue' | 'purple';
  /** Optional label displayed below the bar */
  label?: string;
  /** Show numeric value (default true) */
  showValue?: boolean;
  /** Bar height variant (default 'md') */
  size?: 'sm' | 'md';
  /** Optional title displayed above the bar (e.g., "Skills") */
  title?: string;
  /** Optional icon component to display with title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional completion progress to display (e.g., 2/5 complete) */
  progress?: { completed: number; total: number };
}

/**
 * Color configuration for each variant.
 * Includes gradient stops, glow effects, and text colors.
 */
const COLOR_CONFIG = {
  cyan: {
    gradient: 'from-cyan-400 to-cyan-600',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.5)]',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
  },
  magenta: {
    gradient: 'from-fuchsia-400 to-fuchsia-600',
    glow: 'shadow-[0_0_12px_rgba(217,70,239,0.5)]',
    text: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/20',
  },
  amber: {
    gradient: 'from-amber-400 to-amber-600',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    text: 'text-amber-400',
    bg: 'bg-amber-500/20',
  },
  green: {
    gradient: 'from-green-400 to-green-600',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.5)]',
    text: 'text-green-400',
    bg: 'bg-green-500/20',
  },
  red: {
    gradient: 'from-red-400 to-red-600',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]',
    text: 'text-red-400',
    bg: 'bg-red-500/20',
  },
  blue: {
    gradient: 'from-blue-400 to-blue-600',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.5)]',
    text: 'text-blue-400',
    bg: 'bg-blue-500/20',
  },
  purple: {
    gradient: 'from-violet-400 to-violet-600',
    glow: 'shadow-[0_0_12px_rgba(139,92,246,0.5)]',
    text: 'text-violet-400',
    bg: 'bg-violet-500/20',
  },
} as const;

/**
 * Height configuration for size variants.
 */
const SIZE_CONFIG = {
  sm: 'h-1.5',
  md: 'h-2.5',
} as const;

export function NeonProgressBar({
  value,
  max = 10,
  color,
  label,
  showValue = true,
  size = 'md',
  title,
  icon: Icon,
  progress,
}: NeonProgressBarProps) {
  // Clamp value between 0 and max
  const clampedValue = Math.max(0, Math.min(value, max));
  const percentage = (clampedValue / max) * 100;

  const colorConfig = COLOR_CONFIG[color];
  const heightClass = SIZE_CONFIG[size];

  return (
    <div className="w-full">
      {/* Title row with icon and progress */}
      {title && (
        <div className="flex items-center justify-between mb-1">
          <div className={cn('flex items-center gap-1.5', colorConfig.text)}>
            {Icon && <Icon className="w-4 h-4" />}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {progress && (
            <span className="text-xs text-slate-400">
              {progress.completed}/{progress.total} complete
            </span>
          )}
        </div>
      )}

      {/* Progress bar container */}
      <div
        className={cn(
          'relative w-full rounded-full overflow-hidden',
          'bg-slate-800/80 border border-slate-700/50',
          heightClass
        )}
      >
        {/* Filled portion with gradient and glow */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            'bg-gradient-to-r',
            colorConfig.gradient,
            colorConfig.glow,
            'transition-all duration-300 ease-out'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Label and value row */}
      {(label || showValue) && (
        <div className="flex items-center justify-between mt-1">
          {label && (
            <span className={cn('text-xs font-medium', colorConfig.text)}>
              {label}
            </span>
          )}
          {showValue && (
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                colorConfig.text,
                !label && 'ml-auto'
              )}
            >
              {clampedValue.toFixed(1)}/{max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default NeonProgressBar;
