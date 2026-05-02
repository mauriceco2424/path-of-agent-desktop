/**
 * ContextInspectorButton Component
 *
 * Dev-only teal-themed button that opens the Oracle's Grimoire (LLM Context Inspector).
 * Follows the TokenUsagePanel pattern with teal accent colors.
 * Returns null in production builds.
 */

import { FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useDesktopStore } from '../../store';

interface ContextInspectorButtonProps {
  onClick: () => void;
  className?: string;
}

export function ContextInspectorButton({ onClick, className }: ContextInspectorButtonProps) {
  const hasData = useDesktopStore((s) => s.contextDebugData !== null);

  // Dev-only gate — renders nothing in production
  if (!import.meta.env.DEV) return null;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative flex items-center gap-1.5 px-2.5 py-1.5',
        'rounded-lg transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
        className
      )}
      style={{
        background: hasData
          ? 'linear-gradient(135deg, rgba(45, 212, 191, 0.12) 0%, rgba(20, 184, 166, 0.08) 100%)'
          : 'rgba(30, 30, 40, 0.6)',
        border: hasData
          ? '1px solid rgba(45, 212, 191, 0.25)'
          : '1px solid rgba(71, 85, 105, 0.3)',
        boxShadow: hasData
          ? '0 2px 8px rgba(45, 212, 191, 0.1), inset 0 1px 0 rgba(94, 234, 212, 0.1)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
      title="View Oracle's Grimoire (LLM Context Inspector)"
    >
      <FileCode2
        className={cn(
          'w-3.5 h-3.5 transition-colors duration-200',
          hasData ? 'text-teal-400' : 'text-slate-500'
        )}
      />
      <span
        className={cn(
          'text-[0.6875rem] font-medium transition-colors duration-200',
          hasData ? 'text-teal-300/90' : 'text-slate-500'
        )}
      >
        Context
      </span>

      {/* Active indicator dot */}
      {hasData && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #5eead4 0%, #14b8a6 100%)',
            boxShadow: '0 0 6px rgba(94, 234, 212, 0.6)',
          }}
        />
      )}
    </motion.button>
  );
}
