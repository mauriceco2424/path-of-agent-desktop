/**
 * InlineChatInput Component
 *
 * Compact chat input that appears inline within the analysis results view.
 * Allows users to ask follow-up questions while still seeing the analysis content.
 *
 * Features:
 * - Compact single-line input with send button
 * - Suggested question chips (optional)
 * - Dark fantasy aesthetic matching the rest of the UI
 *
 * Note: Response rendering (tool steps, content) is handled by AnalyzeMode
 * in the main content area, not in this input component.
 */

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Empty array constant to avoid creating new reference on each render */
const EMPTY_SUGGESTED_QUESTIONS: string[] = [];

export interface InlineChatInputProps {
  /** Whether a message is currently being sent/processed */
  isLoading: boolean;
  /** Callback when user sends a message */
  onSendMessage: (message: string) => void;
  /** Suggested questions to show as chips */
  suggestedQuestions?: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Optional className */
  className?: string;
  /** Whether the input is disabled (e.g., insufficient credits) */
  disabled?: boolean;
  /** Message to show when disabled */
  disabledMessage?: string;
}

/**
 * Suggestion chip for quick question selection
 */
function SuggestionChip({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs',
        'bg-slate-800/60 hover:bg-slate-700/60',
        'border border-slate-700/50 hover:border-indigo-500/40',
        'text-slate-300 hover:text-slate-100',
        'transition-all duration-200',
        'truncate max-w-[200px]'
      )}
      title={text}
    >
      {text}
    </button>
  );
}

export function InlineChatInput({
  isLoading,
  onSendMessage,
  suggestedQuestions = EMPTY_SUGGESTED_QUESTIONS,
  placeholder = 'Ask a follow-up question...',
  className,
  disabled = false,
  disabledMessage,
}: InlineChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle send message
  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading || disabled) return;

    setInputValue('');
    onSendMessage(trimmed);
  }, [inputValue, isLoading, disabled, onSendMessage]);

  // Handle keyboard submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle suggestion chip click
  const handleSuggestionClick = useCallback(
    (text: string) => {
      onSendMessage(text);
    },
    [onSendMessage]
  );

  return (
    <div className={cn(className)}>
      {/* Suggestion Chips - show when not loading and has suggestions */}
      {!isLoading && suggestedQuestions.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-slate-800/30">
          <MessageCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
          {suggestedQuestions.slice(0, 3).map((q, i) => (
            <SuggestionChip key={i} text={q} onClick={() => handleSuggestionClick(q)} />
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Input field */}
        <div
          className={cn(
            'flex-1 flex items-center gap-2 px-3 py-2 rounded-sm',
            'card-forge border border-amber-900/40',
            'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]',
            'transition-all duration-200',
            'focus-within:ring-1 focus-within:ring-amber-500/40 focus-within:border-amber-500/30'
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled && disabledMessage ? disabledMessage : placeholder}
            disabled={isLoading || disabled}
            className={cn(
              'flex-1 bg-transparent',
              'text-sm text-slate-200 placeholder-slate-500',
              'focus:outline-none',
              'disabled:opacity-50'
            )}
          />

          {/* Send Button */}
          <motion.button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || disabled}
            whileHover={inputValue.trim() && !isLoading && !disabled ? { scale: 1.05 } : {}}
            whileTap={inputValue.trim() && !isLoading && !disabled ? { scale: 0.95 } : {}}
            className={cn(
              'p-2 rounded-lg flex-shrink-0',
              'transition-all duration-200',
              inputValue.trim() && !isLoading && !disabled
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                : 'text-slate-400 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default InlineChatInput;
