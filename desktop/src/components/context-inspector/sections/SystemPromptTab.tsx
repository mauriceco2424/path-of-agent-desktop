/**
 * SystemPromptTab - Full system prompt display.
 *
 * Shows the behavioral instructions sent to the LLM: prompt name badge,
 * token estimate, and the full prompt content with basic syntax highlighting
 * (lines starting with # get teal color).
 */

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileCode2, Cpu, Sparkles, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LLMContextDebugData } from '../../../store';
import { formatTokens, estimateTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface SystemPromptTabProps {
  data: LLMContextDebugData;
}

// =============================================================================
// Helpers
// =============================================================================

function formatPromptName(name: string): string {
  if (!name) return 'System Prompt';
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Basic syntax highlighting: lines starting with # get a heading style,
 * lines starting with - get list marker style.
 */
function highlightLine(line: string, idx: number): React.ReactNode {
  if (line.startsWith('#')) {
    return (
      <span key={idx} className="text-teal-300/90 font-semibold">
        {line}
        {'\n'}
      </span>
    );
  }

  if (line.startsWith('- ') || line.startsWith('* ')) {
    return (
      <span key={idx}>
        <span className="text-teal-400/50">{line.charAt(0)}</span>
        {line.slice(1)}
        {'\n'}
      </span>
    );
  }

  return <span key={idx}>{line}{'\n'}</span>;
}

// =============================================================================
// Component
// =============================================================================

export function SystemPromptTab({ data }: SystemPromptTabProps) {
  const [isCopied, setIsCopied] = useState(false);
  const promptName = formatPromptName(data.systemPromptName);
  const tokenEst = useMemo(() => estimateTokens(data.systemPromptContent), [data.systemPromptContent]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.systemPromptContent);
      setIsCopied(true);
      toast.success('Copied system prompt');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [data.systemPromptContent]);

  const lines = useMemo(
    () => (data.systemPromptContent || '').split('\n'),
    [data.systemPromptContent]
  );

  if (!data.systemPromptContent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl p-8 text-center max-w-md mx-auto mt-12"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.05) 0%, transparent 100%)',
          border: '1px solid rgba(45, 212, 191, 0.15)',
        }}
      >
        <Sparkles className="w-6 h-6 text-teal-400/40 mx-auto mb-3" />
        <p className="text-sm text-teal-300/60 font-display">No system prompt in this call</p>
      </motion.div>
    );
  }

  const runtimeTokenEst = useMemo(() => estimateTokens(data.runtimeInstruction ?? ''), [data.runtimeInstruction]);
  const runtimeLines = useMemo(
    () => (data.runtimeInstruction || '').split('\n'),
    [data.runtimeInstruction]
  );

  return (
    <div className="space-y-4">
      {/* Header badges */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-3 flex-wrap"
      >
        {/* Prompt name badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(45, 212, 191, 0.2)',
          }}
        >
          <FileCode2 className="w-3.5 h-3.5 text-teal-400/80" />
          <span className="text-[0.75rem] font-display font-medium text-teal-200">
            {promptName}
          </span>
        </div>

        {/* Token estimate badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(45, 212, 191, 0.12)',
          }}
        >
          <span className="text-[0.625rem] font-mono text-teal-400/70 tabular-nums">
            ~{formatTokens(tokenEst)} tokens
          </span>
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-lg transition-colors hover:bg-teal-400/10"
          style={{ border: '1px solid rgba(45, 212, 191, 0.12)' }}
          title="Copy system prompt"
        >
          {isCopied
            ? <Check className="w-3.5 h-3.5 text-teal-400" />
            : <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />}
        </button>
      </motion.div>

      {/* Full prompt content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.03) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(45, 212, 191, 0.10)',
        }}
      >
        <pre
          className={cn(
            'text-[0.6875rem] leading-relaxed font-mono',
            'text-slate-400 whitespace-pre-wrap break-words',
            'overflow-y-auto scrollbar-fantasy',
            'p-4'
          )}
          style={{
            maxHeight: data.runtimeInstruction ? 'calc(100vh - 440px)' : 'calc(100vh - 320px)',
          }}
        >
          {lines.map((line, idx) => highlightLine(line, idx))}
        </pre>
      </motion.div>

      {/* Runtime Instruction (behavioral directive injected into messages) */}
      {data.runtimeInstruction && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3 flex-wrap pt-2"
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.07) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1px solid rgba(45, 212, 191, 0.15)',
              }}
            >
              <Cpu className="w-3.5 h-3.5 text-teal-400/60" />
              <span className="text-[0.75rem] font-display font-medium text-teal-200/80">
                Runtime Instruction
              </span>
            </div>

            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(45, 212, 191, 0.08)',
              }}
            >
              <span className="text-[0.625rem] font-mono text-teal-400/50 tabular-nums">
                ~{formatTokens(runtimeTokenEst)} tokens
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.02) 0%, rgba(15, 23, 42, 0.5) 100%)',
              border: '1px solid rgba(45, 212, 191, 0.08)',
            }}
          >
            <pre
              className={cn(
                'text-[0.6875rem] leading-relaxed font-mono',
                'text-slate-400 whitespace-pre-wrap break-words',
                'overflow-y-auto scrollbar-fantasy',
                'p-4'
              )}
              style={{ maxHeight: '200px' }}
            >
              {runtimeLines.map((line, idx) => highlightLine(line, idx))}
            </pre>
          </motion.div>
        </>
      )}
    </div>
  );
}
