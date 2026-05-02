/**
 * Chat Types for Path of Agent
 *
 * This module defines the request/response types for the chat API.
 * Updated in Spec 015 to use raw PoB data instead of BuildSummary.
 *
 * Constitution Compliance:
 * - Principle II: All numerical data comes from PoB (deterministic)
 * - Principle III: LLM interprets but never computes
 * - Principle IV: KB modules provide grounded knowledge
 */

import type {
  FullCalcsResponse,
  PoBItemsResponse,
  PoBSkillsResponse,
  PoBTreeResponse,
  PoBBuildInfoResponse,
} from '../../backend/src/services/pob-api/types';
import type { CuratedStatComparison, ComparisonMeta } from './TradeComparison';
import type { StatChange } from './HybridTradeSearch';
import type { UnifiedActionItem } from './improvements';
import type { SuggestedAction, InitialSuggestedActions } from './SuggestedAction';
import type { PathwayType } from './pathway';
import type { BuildRatings } from './synthesis';
import type { GearSlotRatings } from './GearQuality';
import type { TokenUsageSummary } from './TokenUsage.js';

/**
 * Optimization focus preference.
 * Controls whether the analysis biases toward defensive or offensive improvements.
 */
export type OptimizationFocus = 'defensive' | 'balanced' | 'offensive';

/**
 * Raw PoB data context for LLM grounding
 *
 * Contains all raw PoB API responses needed to provide the LLM
 * with deterministic data for grounded reasoning.
 *
 * IMPORTANT: This replaces SummarizedContext. The LLM now receives
 * ALL 651 stats from PoB, not a curated summary.
 */
export interface PoBContext {
  /** Unique identifier for this build */
  buildId?: string;
  /** Character metadata (class, ascendancy, level) */
  pobBuildInfo?: PoBBuildInfoResponse;
  /** Full calculations from PoB (651 stat fields) */
  pobFullCalcs?: FullCalcsResponse;
  /** Equipped items with raw text */
  pobItems?: PoBItemsResponse;
  /** Socket groups and gem configurations */
  pobSkills?: PoBSkillsResponse;
  /** Passive tree allocation */
  pobTree?: PoBTreeResponse;
  /**
   * Active configuration settings (charges, buffs, conditions enabled)
   * Contains only enabled settings as string array (e.g., ["usePowerCharges", "enemyIsBoss:Pinnacle"])
   * LLM can infer anything not listed is disabled
   */
  activeConfig?: string[];
  [key: string]: unknown;
}

// ============================================
// Message Part Types (Rich Agent Messages)
// ============================================

/**
 * A message part represents a single inline element within a chat message.
 * Used for rendering LangChain agent tool calls inline alongside text.
 */
export type MessagePart =
  | TextPart
  | ToolCallPart
  | ActionButtonPart;

export interface TextPart {
  type: 'text';
  content: string;
  pathway?: string;
}

export interface ToolCallPart {
  type: 'tool_call';
  /** Unique ID for this tool call */
  id: string;
  /** Tool name: 'get_full_calcs', 'construct_rare_item', etc. */
  tool: string;
  /** Human label: 'Analyzing Build Stats', 'Constructing Item', etc. */
  displayName: string;
  /** Human-readable description of what the tool is doing */
  description?: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  /** Stable model-facing payload preserved for continuation/resume */
  modelResult?: Record<string, unknown>;
  error?: string;
  startTime?: number;
  durationMs?: number;
  pathway?: string;
  /** Whether this tool call was run deterministically by preflight (no LLM involved) */
  preflight?: boolean;
}

export interface ActionButtonPart {
  type: 'action_button';
  /** Button text: "Search Trade" */
  label: string;
  /** Action identifier: 'search_trade', 'apply_changes' */
  action: string;
  disabled?: boolean;
}

/**
 * Display name and description mapping for tools.
 * Maps internal tool names to human-readable labels and descriptions shown in the UI.
 */
export const TOOL_DISPLAY_INFO: Record<string, { label: string; description?: string }> = {
  // Trade tools
  'search_trade': { label: 'Searching Trade', description: 'Finding items on the trade site' },
  'search_trade_weighted': { label: 'Optimized Trade Search', description: 'Finding items with weighted stat priorities' },
  'validate_items_with_pob': { label: 'Validating Items', description: 'Testing items in Path of Building' },
  // PoB core tools
  'get_full_calcs': { label: 'Reading Build Stats', description: 'Getting DPS, EHP, and other stats' },
  'get_items': { label: 'Reading Equipment', description: 'Getting equipped item details' },
  'get_slot_stats': { label: 'Reading Slot', description: 'Getting stats for a gear slot' },
  'configure_combat': { label: 'Configuring Combat', description: 'Setting up boss and combat options' },
  'test_combat_config': { label: 'Testing Combat Config', description: 'Measuring config impact on DPS and EHP' },
  'analyze_flasks': { label: 'Analyzing Flasks', description: 'Measuring flask dependency and charge uptime sustainability' },
  'set_skill_config': { label: 'Configuring Skill', description: 'Setting active skill and skill options' },
  'export_modified_build': { label: 'Exporting Build', description: 'Creating updated PoB code' },

  // Gear tools
  'analyze_gear': { label: 'Analyzing Gear', description: 'Finding weakest equipment slot' },
  'get_slot_mods': { label: 'Checking Slot Mods', description: 'Discovering available mods for equipment slots by progression tier' },
  'equip_and_test_item': { label: 'Testing Item', description: 'Equipping and measuring impact' },
  'test_gear_setups': { label: 'Testing Gear', description: 'Comparing gear configurations in PoB' },
  'get_mod_pool': { label: 'Loading Mod Pool', description: 'Fetching available mods for selected bases' },
  'price_gear_packages': { label: 'Market Prices', description: 'Searching trade for recommended gear' },

  // Skill tools
  'get_socket_groups': { label: 'Reading Socket Groups', description: 'Getting gem link setups' },
  'test_gem_swaps': { label: 'Testing Support Gems', description: 'Swapping support gems and measuring DPS impact' },
  'test_skill_setup': { label: 'Testing Skill Combos', description: 'Testing aura, curse, herald, and guard combinations' },
  'find_support_suggestions': { label: 'Discovering Support Gems', description: 'Finding compatible support gems by tags' },
  'find_setup_suggestions': { label: 'Discovering Auras & Curses', description: 'Finding aura, curse, guard, and herald options' },

  // Tree tools
  'get_passive_tree': { label: 'Reading Passive Tree', description: 'Getting allocated nodes' },
  'search_passive_nodes': { label: 'Searching Tree', description: 'Finding passive nodes' },
  'simulate_tree_changes': { label: 'Simulating Tree', description: 'Testing passive changes' },
  'find_path_to_node': { label: 'Finding Path', description: 'Calculating shortest route' },
  'get_tree_stats': { label: 'Reading Tree Stats', description: 'Getting tree statistics' },
  'batch_test_tree': { label: 'Testing Tree & Jewels', description: 'Testing tree changes, jewel equips, and cluster chains' },
  'batch_simulate_tree': { label: 'Testing Tree Changes', description: 'Simulating passive tree node swaps' },
  'test_obvious_candidates': { label: 'Testing Node Candidates', description: 'Ranking candidates by per-point efficiency' },
  'discover_tree_nodes': { label: 'Discovering Tree', description: 'Scanning keystones, ladder meta, and point budget' },
  'analyze_allocated_tree': { label: 'Finding Weak Notables', description: 'Ranking allocated notables by efficiency' },
  'test_mastery_alternatives': { label: 'Testing Mastery Alternatives', description: 'Testing ladder-popular and notable-unlocked masteries' },
  'test_ladder_clusters': { label: 'Testing Ladder Notable Clusters', description: 'Simulating popular notable clusters from the ladder' },

  // Jewel tools
  'get_jewel_sockets': { label: 'Reading Jewel Sockets', description: 'Getting socket locations' },
  'explore_jewel_radius': { label: 'Exploring Radius', description: 'Finding nodes in jewel range' },
  'test_jewel_configuration': { label: 'Testing Jewel', description: 'Measuring jewel impact' },
  'get_cluster_nodes': { label: 'Reading Clusters', description: 'Getting cluster jewel nodes' },
  'batch_test_jewels': { label: 'Testing Jewels', description: 'Batch testing jewel configurations' },
  'get_cluster_jewel_options': { label: 'Discovering Clusters', description: 'Finding cluster jewel options for the build' },

  // Unique item tools
  'get_unique_item_text': { label: 'Getting Unique Info', description: 'Looking up unique item stats' },
  'compare_unique_item': { label: 'Comparing Unique', description: 'Testing unique vs current gear' },
  'list_uniques_for_slot': { label: 'Listing Uniques', description: 'Finding uniques for a slot' },
  'search_unique_on_trade': { label: 'Searching Unique', description: 'Finding unique on trade' },

  // Meta/KB tools
  'fetch_meta_builds': { label: 'Fetching Meta', description: 'Getting top ladder builds' },
  'retrieve_kb': { label: 'Checking Knowledge', description: 'Looking up game mechanics' },
  'web_search': { label: 'Searching Web', description: 'Looking up PoE info online' },
  'load_kb_module': { label: 'Loading Knowledge', description: 'Loading knowledge base module' },
  'fetch_youtube_transcript': { label: 'Fetching Transcript', description: 'Getting YouTube video transcript' },
  'browse_intel': { label: 'Browsing Intel', description: 'Searching recent PoE content discoveries' },
  'search_ladder_intel': { label: 'Searching Ladder Intel', description: 'Analyzing top-ladder build mechanics and trends' },

  // Gear tools (preflight)
  'build_mod_menus': { label: 'Building Mod Menus', description: 'Curating build-relevant mods per equipment slot' },
  'build_jewel_menus': { label: 'Building Jewel Menus', description: 'Curating jewel options per socket type' },
  // Preflight / progress
  'detect_build_config': { label: 'Detecting Build Config', description: 'Analyzing build for realistic combat configuration' },
  'assess_progression': { label: 'Assessing Progression', description: 'Estimating build progression tier and realistic mod targets' },
  'ladder_cross_reference': { label: 'Cross-Checking Ladder', description: 'Comparing current gear priorities against ladder patterns' },

  // Preflight jewel testing
  'test_popular_jewels': { label: 'Testing Popular Jewels', description: 'Testing popular jewels from ladder data in PoB' },

  // Gem pricing
  'price_skill_gems': { label: 'Gem Market Prices', description: 'Looking up gem prices on trade' },

  // Gear acquisition tools
  'plan_gear_craft': { label: 'Planning Craft', description: 'Computing crafting strategy and cost estimates' },
  'load_crafting_recipe': { label: 'Loading Recipes', description: 'Loading crafting strategies from knowledge base' },
  'craft_item': { label: 'Simulating Craft', description: 'Running Monte Carlo crafting simulation' },
  'discover_uniques': { label: 'Discovering Uniques', description: 'Finding unique item opportunities for the build' },
  'find_gear_upgrades': { label: 'Finding Upgrades', description: 'Searching for gear upgrade candidates' },
  'search_and_validate': { label: 'Search & Validate', description: 'Searching trade and validating items in PoB' },

  // Holistic testing tools
  'explore_skill_options': { label: 'Discovering Skill Options', description: 'Finding support gems, auras, curses, and utility setups' },
  'simulate_ascendancy_swap': { label: 'Testing Ascendancy', description: 'Simulating ascendancy swap and measuring impact' },

  // Preflight discovery tools
  'discover_cluster_options': { label: 'Discovering Cluster Options', description: 'Finding cluster jewel bases, notables, and ladder combos for this build' },
  'compare_ascendancies': { label: 'Comparing Ascendancies', description: 'Testing alternative ascendancy packages for the current class' },

  // Cross-pathway synthesis tools
  'test_combined_changes': { label: 'Testing Combined Changes', description: 'Applying tree + gear + skill changes together in PoB' },
  'test_unified_build': { label: 'Testing Whole Build', description: 'Testing gear, skills, tree, and combined packages together in PoB' },
  'load_mechanics_modules': { label: 'Loading Mechanics Reference', description: 'Loading build-specific game mechanics rules' },
  'load_gear_mod_menus': { label: 'Loading Gear Mod Menus', description: 'Loading curated mod options for equipment slots' },
  'load_jewel_options': { label: 'Loading Jewel Options', description: 'Loading jewel mod menus and cluster jewel options' },
  'load_reference_data': { label: 'Loading Reference Data', description: 'Loading mechanics modules, gear mod menus, and jewel options' },
  'nominate_for_synthesis': { label: 'Top Picks for Synthesis', description: 'Nominating best recommendations for cross-pathway testing' },
  'synthesis_preflight': { label: 'Testing Cross-Pathway Combos', description: 'Pre-testing combinations of gear, skill, and tree changes together' },

  // Stash tools (OAuth)
  'get_stash_currency': { label: 'Checking Stash Currency', description: 'Reading currency and crafting materials from stash' },
  'search_stash_items': { label: 'Searching Stash', description: 'Looking for equipment items in stash tabs' },

  // Atlas tools (Progression)
  'suggest_atlas_path': { label: 'Mapping Atlas Path', description: 'Finding the optimal path to target atlas nodes' },

  // Legacy
  'generate_trade_url': { label: 'Trade URL', description: 'Creating trade search link' },
};

/**
 * Display name mapping for gear upgrade tools.
 * Maps internal tool names to human-readable labels shown in the UI.
 * @deprecated Use TOOL_DISPLAY_INFO instead
 */
export const GEAR_TOOL_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_DISPLAY_INFO).map(([key, value]) => [key, value.label])
);

/** Monotonically increasing counter for unique tool_call part IDs */
let toolCallIdCounter = 0;

/**
 * Appends an SSE event to a message's parts array, returning a new array.
 * Used by useDesktopChat to build up parts as events stream in.
 */
export function appendEventToParts(
  parts: MessagePart[],
  event: {
    type: string;
    tool?: string;
    input?: unknown;
    data?: unknown;
    modelData?: unknown;
    content?: string;
    error?: string;
    durationMs?: number;
    pathway?: string;
    preflight?: boolean;
  }
): MessagePart[] {
  const newParts = [...parts];
  const asRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (value == null) return undefined;
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return { value };
  };

  switch (event.type) {
    case 'content': {
      const lastPart = newParts[newParts.length - 1];
      // Merge into existing text part only if same pathway (or both undefined)
      if (lastPart?.type === 'text' && lastPart.pathway === event.pathway) {
        newParts[newParts.length - 1] = { ...lastPart, content: lastPart.content + (event.content ?? '') };
      } else {
        newParts.push({ type: 'text', content: event.content ?? '', pathway: event.pathway });
      }
      break;
    }
    case 'tool_start': {
      const toolInfo = TOOL_DISPLAY_INFO[event.tool ?? ''];
      let displayName = toolInfo?.label ?? event.tool ?? 'Tool';
      let description = toolInfo?.description;

      // Override display for preflight vs LLM tool calls
      const inputRec = asRecord(event.input);
      if (inputRec?.type === 'preflight-singles') {
        displayName = 'Preflight: Ladder Rares';
        description = 'Testing ladder-pattern rare items per slot';
      } else if (inputRec?.type === 'unique-pretest') {
        displayName = 'Preflight: Ladder Uniques';
        description = 'Testing popular unique items from the ladder';
      }

      newParts.push({
        type: 'tool_call',
        id: `${event.tool}-${++toolCallIdCounter}`,
        tool: event.tool ?? '',
        displayName,
        description,
        status: 'running',
        input: inputRec,
        startTime: Date.now(),
        pathway: event.pathway,
        preflight: event.preflight || undefined,
      });
      break;
    }
    case 'tool_result': {
      // Scan forwards to find the FIRST running match (FIFO order).
      // Results arrive in the order tools were started, so the earliest
      // running tool_call with a matching name should be completed first.
      for (let i = 0; i < newParts.length; i++) {
        const part = newParts[i];
        if (part.type === 'tool_call' && part.tool === event.tool && part.status === 'running') {
          const resultData = event.data as Record<string, unknown> | undefined;
          const toolError = typeof resultData?.error === 'string' ? resultData.error : undefined;
          newParts[i] = {
            ...part,
            status: toolError ? 'error' : 'complete',
            result: asRecord(event.data),
            modelResult: asRecord(event.modelData),
            error: toolError,
            // Prefer server-provided duration, fall back to client-side calculation
            durationMs: event.durationMs ?? (part.startTime ? Date.now() - part.startTime : undefined),
          };
          break;
        }
      }
      break;
    }
    case 'error': {
      let lastRunningIdx = -1;
      for (let i = newParts.length - 1; i >= 0; i--) {
        const p = newParts[i];
        if (p.type === 'tool_call' && p.status === 'running') {
          lastRunningIdx = i;
          break;
        }
      }
      if (lastRunningIdx >= 0) {
        const part = newParts[lastRunningIdx] as ToolCallPart;
        newParts[lastRunningIdx] = { ...part, status: 'error', error: event.error };
      } else {
        newParts.push({ type: 'text', content: `Error: ${event.error}` });
      }
      break;
    }
  }

  return newParts;
}

// ============================================
// Chat Message Types
// ============================================

export interface ChatMessage {
  /**
   * Client role hint.
   * Server-side chat routes sanitize history and only forward user/assistant roles to the model.
   */
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Optional semantic type for rendering/UI (e.g., newsletter card) */
  messageType?: 'newsletter';
  /** Rich message parts for agent messages with inline tool calls */
  parts?: MessagePart[];
}

export interface ChatRequest {
  /** Build identifier for the active analyzed build */
  buildId: string;
  message: string;
  /** Optional PoB context override */
  context?: PoBContext;
  history: ChatMessage[];
  /**
   * Active analysis pathway selected in UI when sending follow-up chat.
   * Used by backend to keep prompt, context, and tools scoped consistently.
   */
  activePathway?: 'gear' | 'skills' | 'tree' | 'unified' | 'synthesis' | 'progression';
  /**
   * User goals extracted from conversation
   * Used by LLM to provide goal-aware advice
   */
  userGoals?: string[];
  /**
   * Conversation summary for long chats
   * Preserves context while reducing token usage
   */
  conversationSummary?: string;
  /**
   * Session KB module IDs (Two-Tier KB System - Tier 1)
   *
   * These are the foundational KB modules selected during initial analysis.
   * They persist client-side and are sent with every subsequent request
   * to ensure the LLM always has build-relevant knowledge context.
   *
   * Examples: ["gladiator", "bleed-mechanics", "defensive-layers"]
   */
  sessionKBModuleIds?: string[];

  /**
   * Session stat subset selected during initial analysis (Spec 022)
   *
   * This subset filters numerical stats from PoB's `full_calcs` to ~100 most
   * relevant stats for this build. It reduces token usage from 651 to ~100.
   *
   * IMPORTANT: This only filters numerical stats. The following data is ALWAYS
   * included in full (not affected by stat selection):
   * - Equipped items (slot, name, rarity, base_type, mods)
   * - Skill gems (socket groups, main skills, supports)
   * - Passive tree (keystones, notables)
   * - Auras and defensive layers
   * - Combat configuration (charges, buffs, conditions)
   *
   * Frontend stores in sessionStorage and sends with each subsequent request.
   *
   * Examples: ["TotalDPS", "Life", "FireResist", "CritChance", ...]
   */
  sessionStatSubset?: string[];

  /** Optimization focus preference — biases toward defensive or offensive improvements */
  optimizationFocus?: OptimizationFocus;

  /** GGG OAuth access token for stash API access (optional — enables stash tools when present) */
  gggAccessToken?: string;
}

export type SeerToolName =
  | 'search_upgrades'
  | 'search_trade'
  | 'search_trade_stats'
  | 'fetch_meta_builds'
  | 'configure_combat'
  | 'request_kb_modules'
  | 'generate_upgrade_roadmap'
  | 'analyze_build'
  | 'explain_weakness';

export interface SeerToolCall {
  type: SeerToolName;
  args: any;
}

/**
 * Trade link for displaying clickable trade site URLs
 */
export interface TradeLink {
  /** Display text for the link */
  label: string;
  /** Full trade site URL */
  url: string;
  /** Brief description of what this search finds */
  description?: string;
  /** Budget constraint that was applied */
  budget?: number;
}

/**
 * Display format for individual trade listing items
 * Used in TradeToolResult to show search results in chat
 */
export interface TradeItemDisplay {
  /** Item name (e.g., "Hypnotic Essence Ruby Ring") */
  name: string;
  /** Base type (e.g., "Ruby Ring") */
  baseType: string;
  /** Price in chaos equivalent */
  price: {
    amount: number;
    currency: string;
  };
  /** Key stats that matched search (formatted strings) */
  matchedStats: string[];
  /** All explicit + implicit mods (from Spec 017) */
  allMods?: string[];
  /**
   * Stat comparison against current equipped item (Spec 020)
   * Optional - only present when comparison was performed
   */
  comparison?: CuratedStatComparison;
  /** Listing ID for per-item trade URLs */
  listingId?: string;
  /** PoB validation result (Phase 3 - auto-validation of lowest/highest items) */
  validation?: ItemValidationResult;
}

/**
 * Result from executing a trade tool (search_trade or search_upgrades)
 * Contains the trade URL and formatted item listings for display
 */
export interface TradeToolResult {
  /** Type of tool that was executed */
  tool: 'search_trade' | 'search_upgrades' | 'search_trade_weighted';
  /** Whether execution succeeded */
  success: boolean;
  /** URL to view full results on trade site */
  tradeUrl: string;
  /** Total items matching search */
  totalResults: number;
  /** Formatted item listings (first 5-10) */
  listings: TradeItemDisplay[];
  /** Ranked items for new orchestrator path */
  rankedItems?: Array<{
    name: string;
    price: string;
    efficiencyScore: number;
    dpsChangePercent: number;
    ehpChangePercent: number;
    canEquip: boolean;
    missingAttributes?: { str?: number; dex?: number; int?: number };
    targetedTradeUrl: string;
    mods: string[];
  }>;
  /** Error message if failed */
  error?: string;
  /** Message from orchestrator (preview/errors) */
  message?: string;
  /** Adjustment notes from tuning */
  adjustments?: string[];
  /** Suggestions from orchestrator */
  suggestions?: string[];
  /** Timing metadata */
  totalTimeMs?: number;
  /** Search intent description (e.g., "Ring with 70+ life, 35%+ chaos res") */
  searchIntent?: string;
  /** Slot being searched (e.g., "Ring 1", "Belt") for multi-search display */
  slot?: string;
  /** Budget context for the search */
  budget?: { max: number; currency: 'chaos' | 'divine' };
  /** Lowest price found (for live card) */
  minPrice?: number;
  /** Budget utilization ratio */
  budgetUtilization?: number;
  /** Iteration trail for transparency */
  iterations?: Array<{
    step: number;
    minValues: Record<string, number>;
    resultCount: number;
    minPrice: number;
  }>;
  /** Guidance returned by the backend */
  guidance?: string;
  /** Retry suggestion if search underused budget */
  suggestRetry?: boolean;
  retryRecommendation?: { reason: string; suggestions: string[] };
  /** Indicates preview/count-only result */
  preview?: boolean;
  /**
   * Comparison metadata (Spec 020)
   * Contains timing and success info for stat comparisons
   */
  comparisonMeta?: ComparisonMeta;
  /**
   * Sweep history from hybrid iterative search (Spec 023)
   * Shows parameter sweeping steps taken to converge on results
   */
  sweepHistory?: import('./HybridTradeSearch').SweepHistory;
  /**
   * Budget context from hybrid iterative search (Spec 023)
   * Shows budget utilization and recommendation for next action
   */
  budgetContext?: import('./HybridTradeSearch').BudgetContext;
}

/**
 * History entry for a single iteration step
 */
export interface IterationHistoryEntry {
  /** Iteration number (1-based) */
  iteration: number;
  /** Total results found in this iteration */
  resultCount: number;
  /** Action taken: 'preview' or 'full' */
  action: 'preview' | 'full';
  /** Time taken for this iteration step (ms) */
  timeMs: number;
}

/**
 * Validation result for a single trade item
 * Contains PoB-validated stat changes when equipping this item
 */
export interface ItemValidationResult {
  itemName: string;
  pricePosition: 'lowest' | 'highest';
  price: { amount: number; currency: string };

  // Key metrics
  dps: StatChange;
  ehp: StatChange;
  life: StatChange;
  resistances: {
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };

  // All stat changes for LLM interpretation
  allStatDiffs: Record<string, StatChange>;

  // Issues
  attributeIssues: string[];
  validationError?: string;
}

/**
 * Validation progress event for SSE streaming
 * Sent during PoB validation of trade items
 */
export interface ValidationProgressEvent {
  itemIndex: number;
  totalItems: number;
  itemName: string;
  status: 'validating' | 'complete' | 'error';
  message: string;
}

/**
 * Plan for a multi-slot trade search, emitted ONCE at the start so the UI
 * can render the full slot list and an ETA before the first probe completes.
 *
 * The consolidated TradeSearchLiveCard uses this to render slot rows in
 * 'queued' state up front, then transitions each row to 'running' / 'done'
 * as iteration_status events arrive.
 */
export interface TradeSearchPlanMessage {
  /** Ordered list of slot plans the agent will execute */
  slots: Array<{
    slot: string;
    maxProbes: number;
    budget?: { max: number; currency: 'chaos' | 'divine' };
  }>;
  /** Sum of maxProbes across all slots — drives the global progress bar */
  totalProbes: number;
  /**
   * Rough ETA in seconds, computed from totalProbes × per-probe latency.
   * The UI shows this as "Est. ~3m 20s".
   */
  estimatedSeconds: number;
}

/**
 * Real-time status message for trade search iterations (Spec 022)
 * Sent via SSE to provide user visibility into the search process
 */
export interface IterationStatusMessage {
  /** Message type for SSE event handling */
  type: 'iteration_status';

  /** Current iteration number (1-based) */
  iteration: number;

  /** Maximum iterations allowed (if provided) */
  maxIterations?: number;

  /** Total results found in this iteration */
  resultCount: number | null;

  /** Current search filters being used */
  currentFilters: {
    slot?: string;
    budget?: number;
    currency?: 'chaos' | 'divine';
    stats: Array<{ id: string; min: number; label?: string }>;
    minPrice?: number;
  };

  /** LLM's decision for this iteration */
  decision?: 'continue' | 'adjust' | 'finalize';

  /** Human-readable explanation of what happened */
  statusText: string;

  /** Time taken for this iteration (ms) */
  timeMs: number;

  /** Trade URL for this iteration's search */
  tradeUrl?: string;
}

/**
 * Tool execution tracking for UI visibility
 * Used to show which tools the LLM is using during responses
 */
export interface ToolExecutionInfo {
  /** Internal tool name (e.g., 'search_trade') */
  name: string;
  /** Human-readable display name (e.g., 'Trade Search') */
  displayName: string;
  /** Current execution status */
  status: 'running' | 'completed' | 'failed';
  /** Timestamp when tool started executing */
  startTime: number;
  /** Timestamp when tool finished (if completed/failed) */
  endTime?: number;
  /** Duration in milliseconds (if completed/failed) */
  durationMs?: number;
  /** Brief summary of tool input for display */
  inputSummary?: string;
}

/**
 * Generic tool result type that can represent any tool output.
 * Used in SSE streaming where different tools return different shapes.
 * The frontend uses type guards to determine the specific result type.
 */
export type GenericToolResult = TradeToolResult | Record<string, unknown>;

/** Section of LLM context (parsed from ## headers in system content) */
export interface LLMContextSection {
  label: string;          // "Patch Delta", "Build Context", "Ladder Data"
  content: string;        // Actual text content
  tokenEstimate: number;  // Math.ceil(content.length / 4)
  /** Whether this section is in the shared cache prefix (byte-identical across all pathways).
   *  Shared sections are cached by OpenAI's prefix caching at ~90% discount. */
  cached?: boolean;
}

/** Debug data capturing the full LLM context for a single call (dev only) */
export interface LLMContextDebugData {
  timestamp: number;
  pathway: string;
  callType: string;                            // 'initial-analysis' | 'follow-up' | 'config-micro-agent'
  model: string;
  systemPromptName: string;                    // e.g. 'unified-gear-preflight'
  systemPromptContent: string;                 // The behavioral instructions (resolved system prompt)
  systemContent: string;                       // The build context / injected data (## headers)
  systemContentSections: LLMContextSection[];  // Parsed ## sections from systemContent
  runtimeInstruction?: string;
  taskMessage?: string;
  userMessage: string;
  history: Array<{ role: string; content: string }>;
  toolBundleName: string;
  tools: Array<{ name: string; description: string }>;
  totalTokenEstimate: number;
}

/** Debug data capturing per-LLM-call input messages in the ReAct agent loop (dev only) */
export interface LLMCallDebugData {
  /** 1-based call index within this agent invocation */
  callIndex: number;
  /** The messages array sent to the LLM for this call */
  messages: Array<{ role: string; content: string }>;
  /** Epoch timestamp when the call started */
  timestamp: number;
}


/**
 * SSE event types from /api/v1/chat/stream endpoint (Spec 022)
 * Note: tool_result uses GenericToolResult to support both trade and crafting results.
 * Frontend should use type guards (isCraftingResult, isTradeResult) to handle specific types.
 */
export type StreamingChatEvent =
  | { type: 'content'; content: string; pathway?: string }
  | {
    type: 'context';
    seerContext: SeerContextData;
    sessionKBModuleIds: string[];
    suggestedQuestions?: string[];
    leagueQuestions?: string[];
    /** Top 5 globally-ranked action items across all pathways (Spec 040) */
    topActions?: UnifiedActionItem[];
    /** LLM-determined pathway priority order (Spec 040) */
    pathwayPriorityOrder?: PathwayType[];
    /** Build ratings (overall + per-pathway scores 0-10, includes buildMechanics and crossPathwayNotes) */
    buildRatings?: BuildRatings;
    /** Gear slot quality ratings for equipment health display */
    gearSlotRatings?: GearSlotRatings;
    /** Initial suggested actions available after analysis (upgrade slots, etc.) */
    initialSuggestedActions?: InitialSuggestedActions;
  }
  | {
    /** Suggested actions emitted by LLM during response */
    type: 'suggested_actions';
    actions: SuggestedAction[];
    /** Optional header text for the action section */
    header?: string;
  }
  | { type: 'trade_search_plan'; data: TradeSearchPlanMessage; pathway?: string }
  | { type: 'iteration_status'; data: IterationStatusMessage; pathway?: string }
  | { type: 'validation_progress'; data: ValidationProgressEvent; pathway?: string }
  | { type: 'tool_start'; tool: string; input?: unknown; pathway?: string; preflight?: boolean }
  | { type: 'tool_result'; tool?: string; data: GenericToolResult; modelData?: GenericToolResult; pathway?: string; durationMs?: number; preflight?: boolean }
  | { type: 'token_usage_interim'; data: TokenUsageSummary; pathway?: string }
  | { type: 'token_usage'; data: TokenUsageSummary; pathway?: string }
  | { type: 'credit_deduction'; data: import('./Credits.js').CreditDeductionEvent }

  | { type: 'pathway_complete'; pathway: string }
  | { type: 'complete'; data?: ChatResponse; pathway?: string }
  | { type: 'error'; error: string; pathway?: string; code?: string }
  | { type: 'llm_context_debug'; data: LLMContextDebugData }
  | { type: 'llm_call_debug'; data: LLMCallDebugData }
  | { type: 'session_started'; sessionId: string }
  | { type: 'status'; message: string }
  | { type: 'keepalive' };

/**
 * Summary of the trade search iteration process
 * Attached to responses that went through iterative refinement
 */
export interface IterationSummary {
  /** Total number of iterations performed */
  iterations: number;
  /** Total time for all iterations (ms) */
  totalTimeMs: number;
  /** History of each iteration step */
  history: IterationHistoryEntry[];
}

/**
 * Display format for build comparison in chat
 */
export interface BuildComparisonDisplay {
  level: number;
  ascendancy: string;
  stats: Record<string, number>;
  keystones: string[];
  equipped_items: {
    slot: string;
    name: string;
    rarity: string;
  }[];
}

/**
 * Result from executing the fetch_meta_builds tool
 * Contains build comparisons for meta analysis
 */
export interface MetaToolResult {
  /** Type of tool that was executed */
  tool: 'fetch_meta_builds';
  /** Whether execution succeeded */
  success: boolean;
  /** Build comparisons with requested stats */
  builds?: BuildComparisonDisplay[];
  /** Number of builds returned */
  sample_size?: number;
  /** Whether results came from cache */
  cached?: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Upgrade suggestion with trade context
 */
export interface UpgradeSuggestion {
  /** Equipment slot */
  slot: string;
  /** Suggested improvement focus */
  focus: string;
  /** Why this upgrade helps the build */
  reasoning: string;
  /** Expected stat improvements */
  expectedGains?: string[];
  /** Trade link for this upgrade */
  tradeLink?: TradeLink;
}

/**
 * Represents a socket group with main skill and linked support gems
 */
export interface SkillGroup {
  /** Main active skill name (e.g., "Sunder") */
  mainSkill: string;
  /** Support gems linked to this skill */
  supports: string[];
  /** All gems in this group (for KB loading) */
  allGems: string[];
  /** Equipment slot containing the gems */
  slot?: string;
  /** Whether this socket group is enabled */
  enabled: boolean;
  /** Whether this is the primary/main skill group */
  isMainGroup: boolean;
}

/**
 * Stat counts per category from CuratedStats (~49 key stats organized into 9 categories)
 * Used in Seer Context Panel to show what PoB data is available
 */
export interface StatCategoryCounts {
  /** Core Resource Pools: Life, ES, Mana, Ward, TotalEHP */
  pools: number;
  /** DPS Variants: CombinedDPS, TotalDPS, TotalDotDPS, HitDPS, etc. */
  dps: number;
  /** Elemental Resistances: Fire, Cold, Lightning, Chaos + overcaps */
  resistances: number;
  /** Physical Defense: Armour, PhysicalDamageReduction, Evasion */
  physicalDefense: number;
  /** Avoidance: Block, SpellBlock, Evade, SpellSuppression */
  avoidance: number;
  /** Maximum Hit Survivability: by damage type */
  maxHitTaken: number;
  /** Recovery: Regen, Leech, LifeOnHit */
  recovery: number;
  /** Offensive Modifiers: Crit, Speed, Accuracy */
  offense: number;
  /** Core Attributes: Str, Dex, Int */
  attributes: number;
}

/**
 * Context data for the sidebar transparency panel
 * Shows what data, knowledge, and instructions were provided to the Seer (LLM)
 */
export interface SeerContextData {
  /** PoB data summary (counts, not values) */
  pobData: {
    /** Number of stat fields from PoB full calcs */
    statCount: number;
    /** Categories of stats (Offensive, Defensive, etc.) - legacy, use statCategoryCounts */
    statCategories: string[];
    /** Counts of available stats per category (from CuratedStats) */
    statCategoryCounts?: StatCategoryCounts;
    /** Number of skill gems in socket groups */
    skillCount: number;
    /** Number of equipped items */
    itemCount: number;
  };
  /** Combat configuration status (charges, buffs, conditions) */
  combatConfig: {
    /** User's active config settings */
    userConfig: string[];
    /** Common config patterns in meta builds (only if meta builds loaded) */
    metaCommonConfig?: string[];
  };
  /** Knowledge base modules loaded for this build (excludes auto-loaded skills) */
  knowledgeBase: {
    modules: Array<{
      name: string;
      type: 'ascendancy' | 'skill' | 'mechanic' | 'class' | 'reference' | 'item' | 'affix';
    }>;
  };
  /** Auto-loaded skill modules (separate from KB for cleaner display) */
  skillsLoaded: {
    /** Skill names that had KB modules loaded */
    skills: string[];
    /** Total equipped skills (some may not have KB modules) */
    totalEquipped: number;
  };
  /** Full socket group structure with support gems */
  skillGroups?: SkillGroup[];
  /** Meta build comparison status (legacy - still populated for backward compat) */
  metaBuilds: {
    status: 'loaded' | 'failed' | 'unavailable';
    /** Total builds fetched for ascendancy */
    totalFetched?: number;
    /** Builds matching user's main skill (used for comparison) */
    sameSkillCount?: number;
    /** User's detected main skill */
    userMainSkill?: string;
    /** Level range of meta builds (e.g., "90-100") */
    levelRange?: string;
    /** Top skills used by this ascendancy (skill -> count) */
    topSkills?: Array<{ skill: string; count: number }>;
    /** Error message (if status is 'failed') */
    error?: string;
  };
  /**
   * KB module info for sidebar display (Spec 030)
   *
   * Replaces live poe.ninja meta build fetching with pre-generated KB modules.
   * Shows what ascendancy KB was loaded and meta data source info.
   */
  kbModuleInfo?: {
    /** Ascendancy name (e.g., "Necromancer") */
    ascendancy: string;
    /** League the meta KB was generated from (e.g., "Keepers") */
    league: string | null;
    /** Number of ladder builds sampled to generate meta KB */
    sampleSize: number | null;
    /** Whether the ascendancy has a meta KB module */
    hasMetaModule: boolean;
    /** ISO timestamp when the KB was generated */
    generated?: string | null;
  };
  /**
   * Parsed meta snapshot for frontend display (from KB meta modules)
   */
  metaSnapshot?: {
    /** Top skills from meta modules */
    topSkills?: Array<{ name: string; usage?: string }>;
    /** Common auras from meta modules */
    commonAuras?: Array<{ name: string; usage?: string }>;
    /** Stat benchmarks with optional user comparison */
    statBenchmarks?: Array<{
      stat: string;
      average: string;
      averageValue?: number;
      userValue?: number;
      deltaPercent?: number;
    }>;
    /** Common uniques (if present in meta module) */
    topUniques?: Array<{ name: string; slot?: string; usage?: string }>;
    /** Common mods (if present in meta module) */
    topMods?: Array<{ mod: string; slot?: string; usage?: string }>;
  };
  /** Seer instructions/capabilities summary */
  instructions: {
    /** Grounded in actual PoB stats */
    grounded: boolean;
    /** Can search trade market */
    tradeAccess: boolean;
    /** Can compare against meta builds */
    metaAccess: boolean;
  };
  /** Knowledge Library - counts of all available KB categories */
  knowledgeLibrary?: {
    skills: {
      total: number;
      description: string;
    };
    tree: {
      total: number;
      description: string;
    };
    gear: {
      total: number;
      description: string;
    };
    shared: {
      total: number;
      description: string;
    };
  };
}

export interface ChatResponse {
  message: string;
  /** Single tool call (first one, for backward compatibility) */
  toolCall?: SeerToolCall;
  /** All tool calls from LLM (for multi-search scenarios) */
  toolCalls?: SeerToolCall[];
  /** Trade links from tool calls for display in chat */
  tradeLinks?: TradeLink[];
  /** Upgrade suggestions with build-specific reasoning */
  upgradeSuggestions?: UpgradeSuggestion[];
  /** Result from executed trade tool (single, for backward compatibility) */
  toolResult?: TradeToolResult;
  /** Results from all executed trade tools (for multi-search scenarios) */
  toolResults?: TradeToolResult[];
  /** Result from fetch_meta_builds tool (for transparency/debugging) */
  metaToolResult?: MetaToolResult;
  /** Context data for sidebar transparency panel (only on initial analysis) */
  seerContext?: SeerContextData;
  /**
   * Suggested chat questions tailored to the user's build.
   * Intended for clickable UI prompts in the chat sidebar.
   */
  suggestedQuestions?: string[];
  /**
   * Suggested league-related questions (still tailored to the user's build when possible).
   */
  leagueQuestions?: string[];
  /**
   * Session KB module IDs (Two-Tier KB System - Tier 1)
   *
   * Returned on initial analysis with the module IDs selected by the LLM.
   * Frontend should store these and send them with every subsequent request.
   *
   * These are foundational modules for THIS build (ascendancy, damage mechanics, etc.)
   * that should always be in LLM context for this session.
   */
  sessionKBModuleIds?: string[];
  /**
   * KB modules loaded on-demand for this specific request (Two-Tier KB System - Tier 2)
   *
   * These are transient modules loaded via request_kb_modules tool during conversation.
   * Frontend can display these inline to show what knowledge was consulted for this response.
   *
   * Examples: ["reference/trade-core", "reference/trade-accessories"]
   */
  kbModulesLoaded?: string[];
  /**
   * Iteration summary for smart trade search (Spec 021)
   *
   * When iterative trade search is used, this contains details about the iteration process:
   * - How many iterations were performed
   * - Total time spent
   * - History of each iteration (result counts, actions)
   *
   * Frontend can display this to show the user that smart search was used.
   */
  iterationSummary?: IterationSummary;

  /**
   * Session stat subset selected by LLM during initial analysis (Spec 022)
   *
   * Returned on initial analysis response with the ~100 stats the LLM
   * selected as most relevant for this build. Frontend should store
   * in sessionStorage and send with every subsequent request.
   *
   * This reduces token usage from 651 stats to ~100 per request.
   *
   * Examples: ["TotalDPS", "Life", "FireResist", "CritChance", ...]
   */
  sessionStatSubset?: string[];
  /**
   * Agent path used to fulfill the request (legacy initial analysis vs LangChain follow-ups)
   */
  agentPath?: 'legacy' | 'langchain';
  /**
   * Token usage from the upstream provider (prompt/completion/total)
   */
  tokenUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  /**
   * Runtime of the request in milliseconds
   */
  runtimeMs?: number;

  /**
   * Top actions from initial analysis for overview panel
   */
  topActions?: UnifiedActionItem[];

  /**
   * Pathway priority order (e.g., ['gear', 'skills', 'tree'])
   */
  pathwayPriorityOrder?: PathwayType[];

  /**
   * Build ratings from synthesis (offensive, defensive, utility scores)
   */
  buildRatings?: BuildRatings;

  /**
   * Gear slot ratings from initial analysis
   */
  gearSlotRatings?: GearSlotRatings;

  /**
   * Suggested actions for the user (trade search, crafting, etc.)
   * Emitted by LLM when it identifies actionable opportunities.
   */
  suggestedActions?: SuggestedAction[];

  /**
   * Initial suggested actions available after analysis.
   * Shows upgrade slots and available action types.
   */
  initialSuggestedActions?: InitialSuggestedActions;
}

/**
 * Legacy SummarizedContext - kept for backward compatibility
 * TODO: Migrate all usages to PoBContext
 */
export interface SummarizedContext extends Partial<PoBContext> {
  buildId: string;
  archetype: string;
  level: number;
  mainSkill: string;
  stats: {
    totalDPS: number;
    effectiveHP: number;
    life: number;
    energyShield: number;
    resistances: {
      fire: number;
      cold: number;
      lightning: number;
      chaos: number;
    };
  };
  weaknesses: Array<{
    severity: string;
    description: string;
  }>;
  themes?: string[];
}
