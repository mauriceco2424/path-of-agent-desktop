/**
 * MessagesTab - Conversation messages sent to the LLM.
 *
 * Shows the messages[] array content: task message, conversation history,
 * and user message. Runtime instruction is shown on the System Prompt tab
 * since it's a behavioral directive.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, MessageCircle, User, Sparkles } from 'lucide-react';
import type { LLMContextDebugData } from '../../../store';
import { ContextInspectorSection, type AccentColor } from '../../shared/ContextInspectorSection';
import { estimateTokens, formatTokens } from '../ContextInspectorModal';

// =============================================================================
// Types
// =============================================================================

interface MessagesTabProps {
  data: LLMContextDebugData;
}

interface GroupItem {
  label: string;
  content: string;
  tokens: number;
  icon: typeof BookOpen;
}

// =============================================================================
// Component
// =============================================================================

export function MessagesTab({ data }: MessagesTabProps) {
  const historyContent = useMemo(() => {
    if (data.history.length === 0) return '';
    return data.history
      .map((m) => `[${m.role}]\n${m.content}`)
      .join('\n\n---\n\n');
  }, [data.history]);

  const { items, totalTokens } = useMemo(() => {
    const msgs: GroupItem[] = [];

    if (data.taskMessage) {
      msgs.push({ label: 'Task Message', content: data.taskMessage, tokens: estimateTokens(data.taskMessage), icon: BookOpen });
    }
    if (data.history.length > 0) {
      const historyTokens = estimateTokens(data.history.map((m) => m.content).join(''));
      msgs.push({ label: `History (${data.history.length} msgs)`, content: historyContent, tokens: historyTokens, icon: MessageCircle });
    }
    if (data.userMessage) {
      msgs.push({ label: 'User Message', content: data.userMessage, tokens: estimateTokens(data.userMessage), icon: User });
    }

    const total = msgs.reduce((sum, item) => sum + item.tokens, 0);
    return { items: msgs, totalTokens: total };
  }, [data, historyContent]);

  if (items.length === 0) {
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
        <p className="text-sm text-amber-300/60 font-display">No messages in this call</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Group header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
        <span className="text-[0.6875rem] font-display font-semibold text-amber-300/80 uppercase tracking-wider">
          Conversation
        </span>
        <span className="text-[0.5625rem] text-slate-500 ml-auto tabular-nums">
          {items.length} sections &bull; ~{formatTokens(totalTokens)}
        </span>
      </motion.div>

      {/* Section cards */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <ContextInspectorSection
            key={`msg-${item.label}-${idx}`}
            label={item.label}
            content={item.content}
            tokenEstimate={item.tokens}
            totalTokens={totalTokens}
            icon={item.icon}
            index={idx}
            accent="amber"
          />
        ))}
      </div>
    </div>
  );
}
