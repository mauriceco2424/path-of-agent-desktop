/**
 * TokenUsagePanel Component
 *
 * A mystical orb button that displays LLM token usage cost.
 * Click opens the Oracle's Ledger (TokenUsageDrawer) slide-in panel.
 *
 * Styled to match the dark fantasy aesthetic with subtle violet glow.
 */

import { useTokenStore } from '../../store/tokenSlice';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TokenUsagePanelProps {
  onClick: () => void;
  className?: string;
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function TokenUsagePanel({ onClick, className }: TokenUsagePanelProps) {
  const totals = useTokenStore((state) => state.totals);
  const hasUsage = totals.totalTokens > 0;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative flex items-center gap-2 px-3 py-2',
        'rounded-lg transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
        className
      )}
      style={{
        background: hasUsage
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(91, 33, 182, 0.08) 100%)'
          : 'rgba(30, 30, 40, 0.6)',
        border: hasUsage
          ? '1px solid rgba(139, 92, 246, 0.25)'
          : '1px solid rgba(71, 85, 105, 0.3)',
        boxShadow: hasUsage
          ? '0 2px 8px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(167, 139, 250, 0.1)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
      onMouseEnter={(e) => {
        if (hasUsage) {
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(167, 139, 250, 0.15)';
        } else {
          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (hasUsage) {
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.25)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(167, 139, 250, 0.1)';
        } else {
          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
        }
      }}
      title="View Oracle's Ledger"
    >
      {/* Mystical scroll icon */}
      <div className="relative">
        <ScrollText
          className={cn(
            'w-4 h-4 transition-colors duration-200',
            hasUsage ? 'text-violet-400' : 'text-slate-500'
          )}
        />
        {/* Subtle glow when active */}
        {hasUsage && (
          <div
            className="absolute inset-0 blur-sm pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
            }}
          />
        )}
      </div>

      {/* Cost display */}
      <span
        className={cn(
          'text-sm font-display font-medium transition-colors duration-200',
          hasUsage ? 'text-violet-200' : 'text-slate-500'
        )}
      >
        {formatCost(totals.costUsd)}
      </span>

      {/* Active indicator dot */}
      {hasUsage && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
            boxShadow: '0 0 6px rgba(167, 139, 250, 0.6)',
          }}
        />
      )}
    </motion.button>
  );
}

export default TokenUsagePanel;
