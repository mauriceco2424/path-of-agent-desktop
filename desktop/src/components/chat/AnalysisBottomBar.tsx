/**
 * AnalysisBottomBar Component
 *
 * Three-button navigation bar for the analysis/improvements flow.
 * - Back: Navigate to previous step (arrow left)
 * - Chat: Open chat mode for current pathway (neutral)
 * - Proceed: Advance to next step (arrow right)
 *
 * Matches the visual style of existing AnalyzeMode buttons.
 */

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AnalysisBottomBarProps {
  /** Label for the back button */
  backLabel?: string;
  /** Label for the chat button */
  chatLabel?: string;
  /** Label for the proceed button */
  proceedLabel?: string;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Callback when chat button is clicked */
  onChat?: () => void;
  /** Callback when proceed button is clicked */
  onProceed?: () => void;
  /** Whether proceed button is disabled */
  proceedDisabled?: boolean;
  /** Whether chat is currently active/expanded */
  chatActive?: boolean;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Shared button style for the bottom bar
 */
function BottomBarButton({
  children,
  onClick,
  disabled,
  variant = 'neutral',
  active = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'back' | 'neutral' | 'proceed';
  active?: boolean;
}) {
  // Different colors based on variant
  const variantStyles = {
    back: {
      cornerColor: 'rgba(148, 163, 184, 0.2)',
      hoverShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 25px rgba(148, 163, 184, 0.15)',
      hoverBorder: 'rgba(148, 163, 184, 0.3)',
    },
    neutral: {
      cornerColor: 'rgba(148, 163, 184, 0.2)',
      hoverShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 25px rgba(148, 163, 184, 0.15)',
      hoverBorder: 'rgba(148, 163, 184, 0.3)',
    },
    proceed: {
      cornerColor: 'rgba(251, 191, 36, 0.3)', // amber
      hoverShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 25px rgba(251, 191, 36, 0.2)',
      hoverBorder: 'rgba(251, 191, 36, 0.4)',
    },
  };

  // Active state uses indigo color (chat is open)
  const activeStyles = {
    cornerColor: 'rgba(99, 102, 241, 0.4)',
    shadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 25px rgba(99, 102, 241, 0.25)',
    border: 'rgba(99, 102, 241, 0.5)',
  };

  const styles = variantStyles[variant];

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
        'card-forge corner-accent',
        'font-display font-medium text-xs',
        'transition-all duration-200',
        disabled
          ? 'opacity-50 cursor-not-allowed text-slate-500'
          : active
            ? 'text-indigo-400'
            : variant === 'proceed'
              ? 'text-amber-400'
              : 'text-slate-400'
      )}
      style={{
        ['--corner-color' as string]: active ? activeStyles.cornerColor : styles.cornerColor,
        ...(active && {
          boxShadow: activeStyles.shadow,
          borderColor: activeStyles.border,
        }),
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.boxShadow = styles.hoverShadow;
          e.currentTarget.style.borderColor = styles.hoverBorder;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.boxShadow = '';
          e.currentTarget.style.borderColor = '';
        }
      }}
    >
      {children}
    </motion.button>
  );
}

export function AnalysisBottomBar({
  backLabel = 'Back',
  chatLabel = 'Chat',
  proceedLabel = 'Proceed',
  onBack,
  onChat,
  onProceed,
  proceedDisabled,
  chatActive,
  className,
}: AnalysisBottomBarProps) {
  return (
    <div
      className={cn(
        'px-4 py-4 border-t border-slate-800/50 bg-slate-900/30',
        className
      )}
    >
      <div className="flex gap-3">
        {/* Back Button */}
        {onBack && (
          <BottomBarButton onClick={onBack} variant="back">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </BottomBarButton>
        )}

        {/* Chat Button */}
        {onChat && (
          <BottomBarButton onClick={onChat} variant="neutral" active={chatActive}>
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{chatLabel}</span>
          </BottomBarButton>
        )}

        {/* Proceed Button */}
        {onProceed && (
          <BottomBarButton
            onClick={onProceed}
            disabled={proceedDisabled}
            variant="proceed"
          >
            <span>{proceedLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </BottomBarButton>
        )}
      </div>
    </div>
  );
}

export default AnalysisBottomBar;
