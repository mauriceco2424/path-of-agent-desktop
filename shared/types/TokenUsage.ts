/**
 * Token Usage Tracking Types
 *
 * Types for tracking LLM API token usage across all services.
 * Used by backend collector and frontend state.
 */

/** LLM call types that generate token usage */
export type LLMCallType =
  | 'initial-analysis-mechanics'
  | 'initial-analysis-pathway'
  | 'initial-analysis-synthesis'
  | 'upgrade-narration'
  | 'langchain-agent'
  | 'langchain-agent-toolcall'
  | 'langchain-agent-synthesis'
  | 'build-concept-parser'
  | 'build-ascendancy-scorer'
  | 'build-skill-architect'
  | 'build-tree-planner'
  | 'build-gear-planner'
  | 'build-progression-gen'
  | 'config-micro-agent'
  | 'mod-menu-filter'
  | 'holistic-follow-up';

/** Logical pathway/source for a token entry */
export type TokenPathway =
  | 'skills'
  | 'gear'
  | 'tree'
  | 'unified'
  | 'holistic'
  | 'general'
  | 'consultation'
  | 'synthesis'
  | 'analysis'
  | 'progression'
  | 'config'
  | 'other';

/** Lifecycle phase for grouping entries in the ledger UI */
export type TokenPhase =
  | 'preflight'
  | 'initial-analysis'
  | 'follow-up'
  | 'other';

/** Token usage buckets for transparency in the ledger */
export interface PhaseTokenBreakdown {
  contextInputTokens: number;
  /** Portion of context estimated to come from static prompt/build injection (non-tool history) */
  staticContextInputTokens?: number;
  /** Portion of context estimated to come from prior turns' tool outputs carried in history */
  carryoverToolOutputContextTokens?: number;
  reasoningTokens: number;
  toolCallInputTokens: number;
  toolCallOutputTokens: number;
  finalOutputTokens: number;
}

/** Per-tool token footprint (tool payload estimate) */
export interface ToolTokenBreakdown {
  tool: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
  estimated: boolean;
}

/** Single token usage entry from one LLM call */
export interface TokenUsageEntry {
  /** Unique ID for this entry */
  id: string;
  /** Type of LLM call */
  callType: LLMCallType;
  /** Human-readable label for display */
  displayName: string;
  /** Timestamp when call completed */
  timestamp: number;
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Cached input tokens (for cost savings display) */
  cachedInputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Calculated cost in USD */
  costUsd: number;
  /** Cost savings from cache (USD) */
  cacheSavingsUsd: number;
  /** Optional context (e.g., which pathway, which improvement) */
  context?: string;
  /** Tool names called during this LLM turn */
  tools?: string[];
  /** Pathway/source this usage belongs to */
  pathway?: TokenPathway;
  /** Lifecycle phase used to group entries in the UI */
  phase?: TokenPhase;
  /** Phase-level token split for UI transparency */
  phaseBreakdown?: PhaseTokenBreakdown;
  /** Per-tool token split for this entry */
  toolBreakdown?: ToolTokenBreakdown[];
  /** Model ID used for this call (e.g., 'gpt-5.4-2026-03-05') */
  modelId?: string;
}

/** Cumulative totals for a session */
export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number;
  savingsUsd: number;
}

/** Aggregated token usage summary for API response */
export interface TokenUsageSummary {
  entries: TokenUsageEntry[];
  totals: TokenUsageTotals;
}

/** Per-model pricing constants (per million tokens) */
/** Cache discount by generation: GPT-5.x = 90% off, GPT-4.1 = 75% off, GPT-4o = 50% off */
export const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number; cachedInputPerMillion: number }> = {
  'gpt-5.4-mini-2026-03-17': { inputPerMillion: 0.75, outputPerMillion: 4.5, cachedInputPerMillion: 0.075 },
  'gpt-5.4-2026-03-05': { inputPerMillion: 2.5, outputPerMillion: 15.0, cachedInputPerMillion: 0.25 },
  'gpt-5.2-2025-12-11': { inputPerMillion: 1.75, outputPerMillion: 14.0, cachedInputPerMillion: 0.175 },
  'gpt-5-mini-2025-08-07': { inputPerMillion: 0.25, outputPerMillion: 2.0, cachedInputPerMillion: 0.025 },
  'gpt-4.1-2025-04-14': { inputPerMillion: 2.0, outputPerMillion: 8.0, cachedInputPerMillion: 0.50 },
  'gpt-4o': { inputPerMillion: 2.50, outputPerMillion: 10.0, cachedInputPerMillion: 1.25 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60, cachedInputPerMillion: 0.075 },
};

/** Default pricing — must match PRIMARY_MODEL in backend/src/config/models.ts */
export const TOKEN_PRICING = MODEL_PRICING['gpt-5.4-2026-03-05']!;

/** Look up pricing for a model, falling back to primary model rates */
export function getPricingForModel(modelId: string): typeof TOKEN_PRICING {
  return MODEL_PRICING[modelId] ?? TOKEN_PRICING;
}

/** Human-readable display names for call types */
export const CALL_TYPE_DISPLAY_NAMES: Record<LLMCallType, string> = {
  'initial-analysis-mechanics': 'Mechanics Selection',
  'initial-analysis-pathway': 'Pathway Analysis',
  'initial-analysis-synthesis': 'Analysis Synthesis',
  'upgrade-narration': 'Upgrade Narration',
  'langchain-agent': 'Chat Response',
  'langchain-agent-toolcall': 'Tool Calling (Phase 1)',
  'langchain-agent-synthesis': 'Synthesis (Phase 2)',
  'build-concept-parser': 'Concept Parsing',
  'build-ascendancy-scorer': 'Ascendancy Scoring',
  'build-skill-architect': 'Skill Architecture',
  'build-tree-planner': 'Tree Planning',
  'build-gear-planner': 'Gear Planning',
  'build-progression-gen': 'Progression Generation',
  'config-micro-agent': 'Config Validation',
  'mod-menu-filter': 'Mod Menu Filter',
  'holistic-follow-up': 'Holistic Follow-up',
};
