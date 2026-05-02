/**
 * ToolsTab - Tool bundle display for the current LLM call.
 *
 * Shows all tools available to the agent: name, description, and token estimate.
 * Empty state for tool-free modes (e.g., holistic assessment).
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LLMContextDebugData } from '../../../store';
import { formatTokens, estimateTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface ToolsTabProps {
  data: LLMContextDebugData;
}

// =============================================================================
// Component
// =============================================================================

export function ToolsTab({ data }: ToolsTabProps) {
  const totalTokens = useMemo(() => {
    return data.tools.reduce((sum, t) => sum + estimateTokens(`${t.name}\n${t.description}`), 0);
  }, [data.tools]);

  if (data.tools.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-8 text-center max-w-md mx-auto mt-12"
        style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, transparent 100%)',
          border: '1px solid rgba(251, 191, 36, 0.15)',
        }}
      >
        <Sparkles className="w-6 h-6 text-amber-400/40 mx-auto mb-3" />
        <p className="text-sm text-amber-300/60 font-display">No tools in this call</p>
        <p className="text-xs text-amber-400/40 mt-1.5">
          Tool-free mode (e.g., holistic assessment)
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-3 flex-wrap"
      >
        {/* Bundle name badge */}
        {data.toolBundleName && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
            }}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400/80" />
            <span className="text-[0.75rem] font-display font-medium text-amber-200">
              {data.toolBundleName}
            </span>
          </div>
        )}

        {/* Count + token estimate */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(251, 191, 36, 0.12)',
          }}
        >
          <span className="text-[0.625rem] font-mono text-amber-400/70 tabular-nums">
            {data.tools.length} tools &bull; ~{formatTokens(totalTokens)} tokens
          </span>
        </div>
      </motion.div>

      {/* Tool list */}
      <div className="space-y-2">
        {data.tools.map((tool, idx) => (
          <motion.div
            key={tool.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + idx * 0.025 }}
            className="rounded-lg p-3 flex items-start gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.03) 0%, rgba(15, 23, 42, 0.5) 100%)',
              border: '1px solid rgba(251, 191, 36, 0.10)',
            }}
          >
            {/* Index badge */}
            <div
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5',
                'text-[0.625rem] font-mono font-medium text-amber-400/70'
              )}
              style={{
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
              }}
            >
              {idx + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[0.75rem] font-medium font-mono text-amber-200/90">
                {tool.name}
              </div>
              <div className="text-[0.6875rem] text-slate-400 mt-0.5 leading-relaxed">
                {tool.description}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
