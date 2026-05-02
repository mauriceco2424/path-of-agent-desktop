/**
 * GeneralChatPage
 *
 * Build-independent PoE knowledge chat page.
 * No PoB dependency, no build context — just game knowledge via KB modules, web search, and intel.
 *
 * Accessible from the Import page via "Ask About Path of Exile" card.
 * Route: /general-chat
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Sparkles,
  MessageCircle,
  Trash2,
  Newspaper,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGeneralChat, type GeneralChatMessage } from '../hooks/useGeneralChat';
import { useMetaIntel, type IntelItem } from '../hooks/useMetaIntel';
import { SemanticMarkdown } from '../utils/semantic-markdown';
import { ToolStepCard } from '../components/chat/ToolStepCard';
import { TOOL_DISPLAY_INFO, type MessagePart } from '../../../shared/types/Chat';
import { WindowControls } from '../components/ui/WindowControls';
import { VersionBadge } from '../components/ui/VersionBadge';
import { DiscordButton } from '../components/ui/DiscordButton';
import { SettingsPopover } from '../components/ui/SettingsPopover';

// ============================================
// Constants
// ============================================

const STATIC_SUGGESTIONS = [
  'What are the top builds this league?',
  'How does spell suppression work?',
  'Best league starter builds?',
  'Explain crafting basics',
];

const MAX_INTEL_SUGGESTIONS = 3;

// ============================================
// Sub-Components
// ============================================

function StarterSuggestions({
  onSelect,
  intelItems,
  intelLoading,
}: {
  onSelect: (text: string) => void;
  intelItems: IntelItem[];
  intelLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center gap-6 max-w-2xl mx-auto"
    >
      {/* Welcome */}
      <div className="text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.25)',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.08)',
          }}
        >
          <BookOpen className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-display font-semibold text-amber-200 mb-2 text-glow-amber">
          Ask About Path of Exile
        </h2>
        <p className="text-sm text-slate-400 max-w-md">
          Get answers about game mechanics, builds, crafting, and more.
          Powered by curated knowledge and live web search.
        </p>
      </div>

      {/* Static Suggestions */}
      <div className="grid grid-cols-2 gap-2.5 w-full">
        {STATIC_SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            className={cn(
              'group relative p-3.5 rounded-xl text-left transition-all duration-200',
              'bg-slate-900/30 border border-slate-700/40',
              'hover:border-amber-500/30 hover:bg-slate-800/40',
            )}
          >
            <div className="flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-slate-500 group-hover:text-amber-400/70 mt-0.5 flex-shrink-0 transition-colors" />
              <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                {text}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Intel Headlines */}
      {(intelLoading || intelItems.length > 0) && (
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="w-3.5 h-3.5 text-violet-400/70" />
            <span className="text-[0.6875rem] font-display font-semibold text-violet-300/70 uppercase tracking-wider">
              Recent Discoveries
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-violet-500/20 to-transparent" />
          </div>

          {intelLoading ? (
            <div className="flex items-center justify-center py-4 text-slate-500 text-sm gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading headlines...
            </div>
          ) : (
            <div className="space-y-2">
              {intelItems.slice(0, MAX_INTEL_SUGGESTIONS).map((item) => (
                <button
                  key={item.url}
                  onClick={() => onSelect(`Tell me about: ${item.title}`)}
                  className={cn(
                    'group w-full p-3 rounded-lg text-left transition-all duration-200',
                    'bg-violet-950/20 border border-violet-500/15',
                    'hover:border-violet-500/30 hover:bg-violet-950/30',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400/60 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-slate-300 group-hover:text-slate-200 line-clamp-1 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[0.625rem] text-slate-500 mt-0.5 block">
                        {item.author} &middot; {item.category}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ChatMessageBubble({ message }: { message: GeneralChatMessage }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div
          className={cn(
            'max-w-[75%] px-4 py-3 rounded-2xl rounded-br-md',
            'bg-amber-500/15 border border-amber-500/25',
            'text-sm text-slate-200',
          )}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  // Assistant message — render parts (tool calls + text)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] space-y-2">
        {message.parts.map((part, i) => (
          <MessagePartRenderer key={i} part={part} />
        ))}
      </div>
    </motion.div>
  );
}

function MessagePartRenderer({ part }: { part: MessagePart }) {
  if (part.type === 'text') {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <SemanticMarkdown content={part.content} />
      </div>
    );
  }

  if (part.type === 'tool_call') {
    const toolInfo = TOOL_DISPLAY_INFO[part.tool] ?? { label: part.tool };
    return (
      <ToolStepCard
        tool={part.tool}
        displayName={part.displayName || toolInfo.label}
        description={part.description ?? toolInfo.description}
        status={part.status}
        input={part.input}
        result={part.result}
        error={part.error}
        durationMs={part.durationMs}
        preflight={part.preflight}
      />
    );
  }

  return null;
}

function StreamingIndicator({
  streamingParts,
  streamingContent,
}: {
  streamingParts: MessagePart[];
  streamingContent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] space-y-2">
        {streamingParts.map((part, i) => (
          <MessagePartRenderer key={i} part={part} />
        ))}
        {/* Show cursor when content is streaming */}
        {streamingContent && streamingParts.every(p => p.type !== 'text') && (
          <div className="prose prose-invert prose-sm max-w-none">
            <SemanticMarkdown content={streamingContent} />
          </div>
        )}
        {/* Typing indicator when no content yet */}
        {!streamingContent && streamingParts.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 text-slate-500 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking...
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function GeneralChatPage() {
  const navigate = useNavigate();
  const {
    messages,
    sendMessage,
    isSending,
    error,
    errorCode,
    streamingContent,
    streamingParts,
    clearChat,
  } = useGeneralChat();

  const { allItems: intelItems, loading: intelLoading } = useMetaIntel();

  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingParts]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;
    setInputValue('');
    sendMessage(trimmed);
  }, [inputValue, isSending, sendMessage]);

  const handleSuggestionSelect = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const hasMessages = messages.length > 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#06060b]">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => navigate('/')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
              'text-slate-400 hover:text-slate-200',
              'hover:bg-slate-800/60',
              'transition-all duration-200',
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="h-4 w-px bg-slate-700/50" />

          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400/70" />
            <span className="text-sm font-display text-amber-200/90">General Chat</span>
          </div>
        </div>

        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {hasMessages && (
            <button
              onClick={clearChat}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
                'text-slate-500 hover:text-red-400',
                'hover:bg-red-950/30',
                'border border-transparent hover:border-red-500/20',
                'transition-all duration-200',
              )}
              title="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-xs">Clear</span>
            </button>
          )}
          <VersionBadge />
          <DiscordButton />
          <SettingsPopover />
          <WindowControls />
        </div>
      </header>

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-fantasy"
      >
        <div className="max-w-3xl mx-auto px-4 py-6">
          {!hasMessages && !isSending ? (
            /* Starter screen with suggestions */
            <div className="flex items-center justify-center min-h-[60vh]">
              <StarterSuggestions
                onSelect={handleSuggestionSelect}
                intelItems={intelItems}
                intelLoading={intelLoading}
              />
            </div>
          ) : (
            /* Message list */
            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}

              {/* Streaming indicator */}
              {isSending && (
                <StreamingIndicator
                  streamingParts={streamingParts}
                  streamingContent={streamingContent}
                />
              )}

              {/* Error display */}
              {error && !isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <p className="text-sm text-red-400">
                    {errorCode === 'INSUFFICIENT_CREDITS'
                      ? 'Insufficient credits. Please add more credits to continue.'
                      : error}
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800/50 bg-[#08080e]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-sm',
              'bg-slate-900/40 border border-amber-900/40',
              'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]',
              'transition-all duration-200',
              'focus-within:ring-1 focus-within:ring-amber-500/30 focus-within:border-amber-500/25',
            )}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Path of Exile..."
              disabled={isSending}
              autoFocus
              className={cn(
                'flex-1 bg-transparent',
                'text-sm text-slate-200 placeholder-slate-500',
                'focus:outline-none',
                'disabled:opacity-50',
              )}
            />
            <motion.button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending}
              whileHover={inputValue.trim() && !isSending ? { scale: 1.05 } : {}}
              whileTap={inputValue.trim() && !isSending ? { scale: 0.95 } : {}}
              className={cn(
                'p-2 rounded-lg flex-shrink-0 transition-all duration-200',
                inputValue.trim() && !isSending
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                  : 'text-slate-600 cursor-not-allowed',
              )}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400/60" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </motion.button>
          </div>
          <p className="text-[0.625rem] text-slate-600 mt-1.5 text-center">
            Answers are grounded in curated knowledge and verified sources.
            Press <kbd className="px-1 py-0.5 bg-slate-800/60 rounded text-slate-500 text-[0.5625rem]">Enter</kbd> to send.
          </p>
        </div>
      </div>
    </div>
  );
}
