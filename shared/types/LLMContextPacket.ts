/**
 * LLMContextPacket - Combined context payload for LLM build interpretation
 *
 * This type represents the complete context package assembled by the backend
 * and passed to the LLM for grounded build analysis and reasoning.
 *
 * ## Assembly Process
 * The packet is assembled by the context-builder service:
 * 1. Build import triggers extraction of StructuredBuildData from PoB MCP
 * 2. KnowledgeSelector dynamically selects relevant KB modules based on:
 *    - Character class and ascendancy
 *    - Main skill and damage types
 *    - Build mechanics and defensive layers
 * 3. System instructions enforce grounding rules (Principle II: no number invention)
 * 4. Conversation summary preserves context for long conversations
 * 5. User goals are extracted from explicit user statements
 *
 * ## Usage
 * The packet is passed to the LLM as structured context, enabling:
 * - Archetype detection based on actual build data
 * - Synergy/mismatch identification using KB knowledge
 * - Contextual upgrade suggestions grounded in deterministic stats
 * - Build coaching with accurate PoE mechanics
 *
 * ## Constitution Compliance
 * - Principle II: All numerical data comes from StructuredBuildData (deterministic)
 * - Principle III: LLM interprets but does not compute
 * - Principle IV: KB modules provide authoritative game knowledge
 * - Principle IX: LLM output will be clearly marked as AI-generated
 */

import type { StructuredBuildData } from './StructuredBuildData';
import type { KnowledgeModule } from './KnowledgeModule';

export interface LLMContextPacket {
  /**
   * Complete structured build data extracted from PoB MCP
   *
   * Contains all deterministic build information organized by category:
   * character, items, skills, passives, defenses, offense, flasks, config.
   * This is the source of truth for all numerical values the LLM may reference.
   */
  structuredBuild: StructuredBuildData;

  /**
   * Dynamically selected knowledge base modules
   *
   * Curated PoE knowledge relevant to this specific build, selected by
   * the KnowledgeSelector based on build characteristics (class, ascendancy,
   * main skill, damage types, mechanics). Only relevant modules are included
   * to minimize context size and maximize relevance.
   *
   * Example modules:
   * - ascendancy/necromancer (for Necromancer builds)
   * - skill/summon-raging-spirit (for SRS builds)
   * - mechanic/dot-mechanics (for DoT damage builds)
   */
  kbModules: KnowledgeModule[];

  /**
   * System instructions for the LLM
   *
   * Contains grounding rules, persona definition, and behavioral constraints.
   * Key constraints include:
   * - MUST NOT invent numerical values
   * - MUST ground all facts in structuredBuild or kbModules
   * - MUST indicate uncertainty rather than hallucinate
   * - MUST reference specific data when making claims
   */
  systemInstructions: string;

  /**
   * Summarized conversation history for long conversations
   *
   * When conversation exceeds token limits, older messages are summarized
   * while preserving:
   * - Build context and key findings
   * - User-stated goals and preferences
   * - Important decisions and outcomes
   *
   * Recent messages are kept in full for immediate context.
   */
  conversationSummary?: string;

  /**
   * User goals extracted from conversation
   *
   * Explicit goals stated by the user during the conversation, such as:
   * - "I want to improve my single target damage"
   * - "Help me reach 75% chaos resistance"
   * - "I need more survivability for bosses"
   *
   * These goals guide the LLM's analysis and recommendations,
   * ensuring suggestions align with user intent.
   */
  userGoals?: string[];
}
