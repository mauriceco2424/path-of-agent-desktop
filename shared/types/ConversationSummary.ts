/**
 * ConversationSummary Type Definition
 *
 * Represents a compressed conversation history that preserves important context
 * while reducing token usage for LLM context windows.
 *
 * This type supports the smart conversation summarization strategy defined in
 * Spec 013 (LLM-Centric Build Interpreter). Instead of sending the entire
 * conversation history to the LLM (which would quickly exceed token limits),
 * the system:
 *
 * 1. Preserves the build context that was established early in the conversation
 * 2. Tracks user-stated goals for reference
 * 3. Compresses middle exchanges into topic/outcome pairs
 * 4. Keeps the most recent messages in full for immediate context
 *
 * This allows for 10+ message conversations while staying within token limits
 * and maintaining coherent, contextual responses from the LLM.
 *
 */

import type { ChatMessage } from './Chat.js';

/**
 * Represents a compressed key exchange from the conversation history.
 * Used to preserve the substance of important interactions without
 * including full message text.
 */
export interface KeyExchange {
  /**
   * The topic or subject matter of the exchange.
   * Examples: "resistance gaps", "main skill selection", "budget constraints"
   */
  topic: string;

  /**
   * The outcome or resolution of the exchange.
   * What was discussed, decided, or clarified about this topic.
   * Examples: "identified uncapped chaos resistance", "user prefers budget options under 50c"
   */
  outcome: string;
}

/**
 * Compressed conversation history that preserves context while reducing tokens.
 *
 * The ConversationSummary allows long conversations (10+ messages) to maintain
 * coherent context without exceeding LLM token limits. It achieves this through
 * selective preservation:
 *
 * - Build context: Critical build understanding that anchors all advice
 * - User goals: Explicit objectives the user has stated
 * - Key exchanges: Compressed summaries of important prior discussions
 * - Recent messages: Full text of the last N messages for immediate context
 *
 * This structure ensures the LLM can:
 * - Remember what build is being discussed
 * - Recall what the user wants to achieve
 * - Reference prior discussion outcomes without full text
 * - Respond naturally to recent messages with full context
 */
export interface ConversationSummary {
  /**
   * Preserved build context from the full conversation data.
   *
   * This contains the essential build understanding established during
   * the conversation, including archetype detection results, identified
   * strengths/weaknesses, and any build-specific context that should
   * persist throughout the conversation.
   *
   * Example: "Level 95 Necromancer summoner build focusing on Spectres.
   * Primary weakness: uncapped chaos resistance. Strength: high life pool."
   */
  buildContext: string;

  /**
   * User-stated goals collected during the conversation.
   *
   * These are explicit objectives the user has mentioned, which should
   * inform all subsequent advice. Goals are accumulated throughout the
   * conversation and never removed (unless contradicted).
   *
   * Examples:
   * - "Improve boss damage"
   * - "Stay under 100 chaos budget"
   * - "Prepare for Uber content"
   * - "Fix survivability issues"
   */
  userGoals: string[];

  /**
   * Compressed summaries of important exchanges from the conversation.
   *
   * Middle messages are compressed into topic/outcome pairs that preserve
   * the substance without full text. This allows the LLM to reference
   * prior discussions without consuming excessive tokens.
   *
   * These are ordered chronologically and represent the "compressed middle"
   * of the conversation between the initial context and recent messages.
   */
  keyExchanges: KeyExchange[];

  /**
   * The most recent messages kept in full for immediate context.
   *
   * These are the last N messages (typically 3-5) that provide immediate
   * conversational context. Keeping these in full ensures natural
   * conversational flow and allows the LLM to respond appropriately
   * to the current exchange.
   *
   * Messages are in chronological order (oldest first within this array).
   */
  recentMessages: ChatMessage[];
}
