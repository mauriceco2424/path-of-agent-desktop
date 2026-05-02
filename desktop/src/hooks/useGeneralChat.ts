/**
 * useGeneralChat Hook
 *
 * Simplified chat hook for build-independent PoE knowledge chat.
 * Uses local React state (NOT Zustand) — fully independent from build analysis.
 *
 * Manages: messages, streaming state, tool calls, errors.
 * No PoB, no pathway, no preflight, no trade execution.
 */

import { useState, useRef, useCallback } from 'react';
import {
  sendGeneralChatStream,
  type GeneralChatStreamPayload,
} from '../services/sse-client';
import { appendEventToParts, type MessagePart } from '../../../shared/types/Chat';
import type { StreamingChatEvent } from '../../../shared/types/Chat';

// ============================================
// Types
// ============================================

export interface GeneralChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: MessagePart[];
  timestamp: number;
}

export interface UseGeneralChatReturn {
  messages: GeneralChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isSending: boolean;
  error: string | null;
  errorCode: string | null;
  streamingContent: string;
  streamingParts: MessagePart[];
  clearChat: () => void;
}

// ============================================
// Constants
// ============================================

let messageIdCounter = 0;
function nextMessageId(): string {
  return `gc-${Date.now()}-${++messageIdCounter}`;
}

// ============================================
// Hook
// ============================================

export function useGeneralChat(): UseGeneralChatReturn {
  const [messages, setMessages] = useState<GeneralChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setErrorCode(null);
    setStreamingContent('');
    setStreamingParts([]);
    threadIdRef.current = undefined;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return;

    // Cancel any in-progress stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Clear previous errors
    setError(null);
    setErrorCode(null);
    setStreamingContent('');
    setStreamingParts([]);

    // Add user message
    const userMessage: GeneralChatMessage = {
      id: nextMessageId(),
      role: 'user',
      content,
      parts: [{ type: 'text', content }],
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    // Build history from previous messages (skip current user message)
    const history = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const payload: GeneralChatStreamPayload = {
      message: content,
      history,
      threadId: threadIdRef.current,
    };

    // Track streaming parts locally (mutable for perf, copied on each setState)
    let currentParts: MessagePart[] = [];
    let accumulatedContent = '';

    try {
      await sendGeneralChatStream(
        payload,
        {
          onEvent: (event: StreamingChatEvent) => {
            switch (event.type) {
              case 'status':
                // Status events — ignore for now (could show as subtle indicator)
                break;

              case 'content':
                accumulatedContent += (event as { content?: string }).content ?? '';
                setStreamingContent(accumulatedContent);
                currentParts = appendEventToParts(currentParts, event);
                setStreamingParts([...currentParts]);
                break;

              case 'tool_start':
              case 'tool_result':
                currentParts = appendEventToParts(currentParts, event);
                setStreamingParts([...currentParts]);
                break;

              case 'error': {
                const errorEvent = event as { error?: string; code?: string };
                setError(errorEvent.error ?? 'Unknown error');
                if (errorEvent.code) setErrorCode(errorEvent.code);
                break;
              }

              case 'credit_deduction':
                // Could update credit display — handled by auth refresh
                break;

              case 'complete':
                // Finalize assistant message
                break;
            }
          },
          onError: (err: Error) => {
            setError(err.message);
          },
        },
        controller.signal,
      );

      // Stream complete — create assistant message from accumulated parts
      if (accumulatedContent || currentParts.length > 0) {
        const assistantMessage: GeneralChatMessage = {
          id: nextMessageId(),
          role: 'assistant',
          content: accumulatedContent,
          parts: currentParts,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      // Only set error if not already set by onError/onEvent
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(prev => prev ?? err.message);
      }
    } finally {
      setIsSending(false);
      setStreamingContent('');
      setStreamingParts([]);
    }
  }, [isSending, messages]);

  return {
    messages,
    sendMessage,
    isSending,
    error,
    errorCode,
    streamingContent,
    streamingParts,
    clearChat,
  };
}
