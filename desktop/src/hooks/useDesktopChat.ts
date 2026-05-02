/**
 * useDesktopChat Hook
 *
 * Main chat hook for the desktop application.
 * Port of key logic from frontend/src/hooks/useSeerChat.ts.
 *
 * Key Differences from Web Version:
 * - Trade searches execute via Tauri (user's IP for rate limiting)
 * - SSE streaming for real-time chat updates
 * - Desktop-specific store for state persistence
 * - Handles trade_search_instruction events from SSE
 *
 * Features:
 * - Initial analysis generation
 * - SSE streaming for chat responses
 * - Trade search execution via Tauri
 * - Tool result handling
 * - Session KB module tracking
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import {
  normalizePathwayHistories,
  useDesktopStore,
  useTokenStore,
  type ChatMessage as StoreChatMessage,
  type PathwayType,
  type ParsedPathwayCard,
  type ParsedGeneralAssessment,
  type AnalysisFocus,
} from '../store';
import { useAnalysisHistoryStore } from '../store/analysisHistoryStore';
import {
  sendChatMessageStream,
  sendAnalyzeStream,
  type AnalyzeStreamPayload,
  parseTradeSearchInstruction,
  type SSEConnectionOptions,
} from '../services/sse-client';
import { appendEventToParts, type MessagePart, type ToolCallPart } from '../../../shared/types/Chat';
import {
  executeTradeSearch,
  type TradeSearchInstruction,
} from '../services/trade-executor';
import { CURRENT_LEAGUE_NAME } from '../../../shared/constants/league';
import type {
  ChatRequest,
  StreamingChatEvent,
  TradeToolResult,
  SeerContextData,
  IterationSummary,
  ToolExecutionInfo,
} from '../../../shared/types/Chat';
import type {
  SuggestedAction,
  InitialSuggestedActions,
} from '../../../shared/types/SuggestedAction';
import { callBackend } from '../services/tauri-api';
import { useGearPackageStore, hydrateGearPackagesFromToolResult } from '../store/gearPackageStore';
import { useTreePackageStore, hydrateTreePackagesFromToolResult } from '../store/treePackageStore';
import { hydrateAtlasPackagesFromToolResult } from '../store/atlasPackageStore';
import { useSettingsStore } from '../store/settingsSlice';
import { reportError } from '../services/error-telemetry';

// ============================================
// Type Definitions
// ============================================

/**
 * PoB code data for rendering PoBCodeCard.
 */
export interface PoBCodeData {
  code: string;
  title?: string;
}

/**
 * Extended chat message with tool results.
 */
export interface DesktopChatMessage extends StoreChatMessage {
  /** Tool result for trade or crafting analysis */
  toolResult?: TradeToolResult;
  /** Iteration summary for trade searches */
  iterationSummary?: IterationSummary;
  /** Message type for special rendering */
  messageType?: 'newsletter';
  /** PoB code from export_modified_build tool */
  pobCode?: PoBCodeData;
}

/**
 * Per-slot state for the consolidated trade search live card.
 */
export interface TradeSearchSlotState {
  slot: string;
  status: 'queued' | 'running' | 'done' | 'error';
  maxProbes: number;
  /** 1-based probe number currently in flight (or most recent finished probe) */
  currentProbe: number;
  /** Result count from the latest probe on this slot */
  latestResultCount?: number;
  /** Cheapest listing price in chaos (divine-converted) */
  latestMinPrice?: number;
  /** Trade API URL — populated as soon as the first probe resolves */
  tradeUrl?: string;
  /** Free-text status line for the row (e.g. "exploring — probe 3/8") */
  statusText?: string;
  /** Budget passthrough from the plan */
  budget?: { max: number; currency: 'chaos' | 'divine' };
}

/**
 * Live trade search state for UI display.
 *
 * Two-layer shape:
 *  - top-level fields (state, startedAt, error, plan): global search status
 *  - `perSlot`: plain object keyed by slot name for per-slot rows
 *
 * Legacy flat fields (slot, iteration, resultCount, etc.) are kept for
 * backward compatibility with the old LiveTradeSearchCard / ChatVizPanel
 * consumers — the consolidated TradeSearchLiveCard uses the layered fields
 * instead.
 */
export interface LiveTradeSearchState {
  state: 'running' | 'complete' | 'error';
  /** Epoch ms when the search started (for elapsed-time display) */
  startedAt?: number;
  error?: string;
  /**
   * Plan emitted by the backend ONCE at the start of a multi-slot search.
   * Populated on `trade_search_plan` SSE event.
   */
  plan?: {
    slots: Array<{
      slot: string;
      maxProbes: number;
      budget?: { max: number; currency: 'chaos' | 'divine' };
    }>;
    totalProbes: number;
    estimatedSeconds: number;
  };
  /** Per-slot progress map — drives the multi-slot HUD rows. */
  perSlot?: Record<string, TradeSearchSlotState>;
  /** Slot currently being searched (for highlighting the active row) */
  currentSlotName?: string;

  // ─── Legacy flat fields (used by LiveTradeSearchCard + ChatVizPanel) ───
  slot?: string;
  budget?: { max: number; currency: 'chaos' | 'divine' };
  stats?: Array<{ id: string; min: number; label?: string }>;
  iteration?: number;
  maxIterations?: number;
  resultCount?: number | null;
  minPrice?: number;
  statusText?: string;
  tradeUrl?: string;
  totalResults?: number;
  currentIteration?: number;
  totalIterations?: number;
  currentFilters?: Record<string, unknown>;
}

/**
 * Hook parameters.
 */
interface UseDesktopChatParams {
  buildId?: string | null;
  /** Current league for trade searches */
  league?: string;
}

/**
 * Hook return type.
 */
interface UseDesktopChatReturn {
  messages: DesktopChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isSending: boolean;
  isGeneratingInitialAnalysis: boolean;
  error: string | null;
  /** Error code from backend (e.g. 'INSUFFICIENT_CREDITS') */
  errorCode: string | null;
  /** Context data for transparency panel */
  seerContext: SeerContextData | null;
  /** Suggested build-specific questions for clickable chat prompts */
  suggestedQuestions: string[];
  /** Suggested league questions for clickable chat prompts */
  leagueQuestions: string[];
  /** Currently executing tools */
  activeTools: Map<string, ToolExecutionInfo>;
  /** Live trade search state */
  liveTradeSearch: LiveTradeSearchState | null;
  /** Session KB module IDs */
  sessionKBModuleIds: string[];
  /** Session stat subset */
  sessionStatSubset: string[];
  /** Parsed general assessment from initial analysis */
  generalAssessment: ParsedGeneralAssessment | null;
  /** Parsed pathway cards from initial analysis */
  pathwayCards: ParsedPathwayCard[] | null;
  /** Currently active pathway (null = show card selection) */
  activePathway: PathwayType | 'unified' | 'progression' | null;
  /** Current analysis session ID for debug/logging */
  analysisSessionId?: string | null;
  /** Streaming content for real-time display (analysis stream) */
  streamingContent: string;
  /** Retry initial analysis after error */
  retryInitialAnalysis: () => void;
  /** Start initial build analysis with optional custom prompt */
  startAnalysis: (customMessage?: string) => Promise<void>;
  /** Message parts from initial analysis (tool calls, reasoning, content) */
  analysisMessageParts: MessagePart[];
  /** Cancel active initial analysis stream */
  cancelInitialAnalysis: () => void;
  /** Suggested actions from LLM (trade search, crafting, etc.) */
  suggestedActions: SuggestedAction[];
  /** Initial suggested actions (available after analysis) */
  initialSuggestedActions: InitialSuggestedActions | null;
  /** Cancel all active streaming operations (pathway chat, analysis) */
  cancelAllStreams: () => void;
  /** Launch cross-pathway synthesis analysis */
  launchSynthesis: () => Promise<void>;
  /** Set of pathways currently streaming (removed as each pathway_complete fires) */
  streamingPathways: Set<string>;
  /** Per-pathway accumulated streaming content */
  streamingContentByPathway: Record<string, string>;
  /** Real-time status message from backend (e.g. progress during setup) */
  streamingStatus: string | null;
}

// ============================================
// Constants
// ============================================

/** Tool display names for UI - human-readable labels instead of technical names */
const TOOL_DISPLAY_NAMES: Record<string, { label: string; icon: string; description?: string }> = {
  // Trade tools
  'search_trade': { label: 'Searching Trade', icon: 'search', description: 'Finding items on the trade site' },
  'search_trade_weighted': { label: 'Optimized Trade Search', icon: 'search', description: 'Finding items with weighted stat priorities' },
  'validate_items_with_pob': { label: 'Validating Items', icon: 'check', description: 'Testing items in Path of Building' },
  'plan_gear_upgrade': { label: 'Planning Upgrade', icon: 'compass', description: 'Creating an upgrade strategy' },

  // PoB core tools
  'get_full_calcs': { label: 'Reading Build Stats', icon: 'bar-chart', description: 'Getting DPS, EHP, and other stats' },
  'get_items': { label: 'Reading Equipment', icon: 'package', description: 'Getting equipped item details' },
  'get_slot_stats': { label: 'Reading Slot', icon: 'shield', description: 'Getting stats for a gear slot' },
  'configure_combat': { label: 'Configuring Combat', icon: 'settings', description: 'Exploring combat conditions and measuring impact' },
  'export_modified_build': { label: 'Exporting Build', icon: 'download', description: 'Creating updated PoB code' },

  // Gear tools
  'analyze_gear': { label: 'Analyzing Gear', icon: 'shield', description: 'Finding weakest equipment slot' },
  'query_mod_pool': { label: 'Checking Mod Pool', icon: 'database', description: 'Looking up available mods' },
  'construct_rare_item': { label: 'Building Test Item', icon: 'hammer', description: 'Creating a theoretical item' },
  'equip_and_test_item': { label: 'Testing Item', icon: 'flask', description: 'Equipping and measuring impact' },
  // Skill tools
  'get_socket_groups': { label: 'Reading Socket Groups', icon: 'layers', description: 'Getting gem link setups' },
  'test_gem_swaps': { label: 'Testing Support Gems', icon: 'refresh-cw', description: 'Swapping support gems and measuring DPS impact' },
  'test_skill_setup': { label: 'Testing Skill Combos', icon: 'zap', description: 'Testing aura, curse, herald, and guard combinations' },
  'test_unified_build': { label: 'Testing Whole Build', icon: 'compass', description: 'Testing gear, skills, tree, and combined packages together' },
  'find_support_suggestions': { label: 'Discovering Support Gems', icon: 'sparkles', description: 'Finding compatible support gems by tags' },
  'find_setup_suggestions': { label: 'Discovering Auras & Curses', icon: 'lightbulb', description: 'Finding aura, curse, guard, and herald options' },

  // Tree tools
  'get_passive_tree': { label: 'Reading Passive Tree', icon: 'git-branch', description: 'Getting allocated nodes' },
  'search_passive_nodes': { label: 'Searching Tree', icon: 'search', description: 'Finding passive nodes' },
  'simulate_tree_changes': { label: 'Simulating Tree', icon: 'play', description: 'Testing passive changes' },
  'find_path_to_node': { label: 'Finding Path', icon: 'route', description: 'Calculating shortest route' },
  'get_tree_stats': { label: 'Reading Tree Stats', icon: 'bar-chart-2', description: 'Getting tree statistics' },
  'batch_simulate_tree': { label: 'Testing Tree Changes', icon: 'layers', description: 'Simulating passive tree node swaps' },
  'batch_test_tree': { label: 'Testing Tree', icon: 'layers', description: 'Testing tree changes, jewels, and clusters' },

  // Jewel tools
  'get_jewel_sockets': { label: 'Reading Jewel Sockets', icon: 'gem', description: 'Getting socket locations' },
  'explore_jewel_radius': { label: 'Exploring Radius', icon: 'circle', description: 'Finding nodes in jewel range' },
  'test_jewel_configuration': { label: 'Testing Jewel', icon: 'flask', description: 'Measuring jewel impact' },
  'get_cluster_nodes': { label: 'Reading Clusters', icon: 'share-2', description: 'Getting cluster jewel nodes' },

  // Unique item tools
  'get_unique_item_text': { label: 'Getting Unique Info', icon: 'star', description: 'Looking up unique item stats' },
  'compare_unique_item': { label: 'Comparing Unique', icon: 'git-compare', description: 'Testing unique vs current gear' },
  'list_uniques_for_slot': { label: 'Listing Uniques', icon: 'list', description: 'Finding uniques for a slot' },
  'search_unique_on_trade': { label: 'Searching Unique', icon: 'search', description: 'Finding unique on trade' },

  // Meta/KB tools
  'fetch_meta_builds': { label: 'Fetching Meta', icon: 'trophy', description: 'Getting top ladder builds' },
  'retrieve_kb': { label: 'Checking Knowledge', icon: 'book', description: 'Looking up game mechanics' },
  'web_search': { label: 'Searching Web', icon: 'globe', description: 'Looking up PoE info online' },

  // Preflight / progress
  'build_mod_menus': { label: 'Building Mod Menus', icon: 'database', description: 'Curating build-relevant mods per equipment slot' },
  'test_popular_jewels': { label: 'Testing Popular Jewels', icon: 'gem', description: 'Testing ladder-popular jewels in the build' },

  // Legacy
  'generate_trade_url': { label: 'Trade URL', icon: 'link', description: 'Creating trade search link' },
};

/** Default league for trade searches */
const DEFAULT_LEAGUE = CURRENT_LEAGUE_NAME;

/** Default params to avoid object recreation on each render */
const DEFAULT_PARAMS: UseDesktopChatParams = {};


// ============================================
// Helper Functions
// ============================================

/**
 * Format tool input for display.
 */
function formatToolInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case 'search_trade': {
      const searches = Array.isArray(obj.searches)
        ? obj.searches as Array<{ slot?: string }>
        : [];
      if (searches.length > 0) {
        const slots = searches
          .map((search) => search.slot)
          .filter((slot): slot is string => typeof slot === 'string' && slot.length > 0);
        return slots.length > 0 ? `${slots.length} slot${slots.length !== 1 ? 's' : ''}: ${slots.join(', ')}` : `${searches.length} slot search${searches.length !== 1 ? 'es' : ''}`;
      }

      const slot = obj.slot as string | undefined;
      const budget = obj.budget as { max?: number; currency?: string } | undefined;
      const budgetStr = budget?.max
        ? `${budget.max}${budget.currency === 'divine' ? 'd' : 'c'}`
        : '';
      return [slot, budgetStr].filter(Boolean).join(' | ');
    }
    case 'retrieve_kb': {
      const moduleIds = obj.moduleIds as string[] | undefined;
      return moduleIds?.length ? `${moduleIds.length} module(s)` : '';
    }
    default:
      return '';
  }
}

const TOOL_HISTORY_MAX_CALLS_PER_MESSAGE = 10;
const TOOL_HISTORY_MAX_INPUT_CHARS = 220;
const TOOL_HISTORY_MAX_RESULT_CHARS = 1000;
const TOOL_HISTORY_MAX_TOTAL_CHARS = 6000;

function truncateForHistory(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

function stringifyForHistory(value: unknown, maxChars: number): string {
  if (value == null) return '';
  if (typeof value === 'string') return truncateForHistory(value, maxChars);
  try {
    return truncateForHistory(JSON.stringify(value), maxChars);
  } catch {
    return '[unserializable]';
  }
}

function buildToolTranscript(parts?: MessagePart[]): string {
  if (!parts || parts.length === 0) return '';

  const toolCalls = parts.filter((part): part is Extract<MessagePart, { type: 'tool_call' }> => (
    part.type === 'tool_call' && part.status !== 'running'
  ));
  if (toolCalls.length === 0) return '';

  const lines: string[] = [];
  const shown = toolCalls.slice(0, TOOL_HISTORY_MAX_CALLS_PER_MESSAGE);
  for (const part of shown) {
    const status = part.status.toUpperCase();
    let line = `- ${part.tool} [${status}]`;

    const input = stringifyForHistory(part.input, TOOL_HISTORY_MAX_INPUT_CHARS);
    if (input) line += ` input=${input}`;

    if (part.error) {
      line += ` error=${truncateForHistory(part.error, TOOL_HISTORY_MAX_RESULT_CHARS)}`;
    } else {
      const result = stringifyForHistory(part.result, TOOL_HISTORY_MAX_RESULT_CHARS);
      if (result) line += ` result=${result}`;
    }

    lines.push(line);
  }

  const omitted = toolCalls.length - shown.length;
  if (omitted > 0) {
    lines.push(`- ... ${omitted} additional tool call(s) omitted`);
  }

  const transcript = lines.join('\n');
  if (transcript.length <= TOOL_HISTORY_MAX_TOTAL_CHARS) return transcript;
  return `${transcript.slice(0, TOOL_HISTORY_MAX_TOTAL_CHARS)}\n- ... transcript truncated`;
}

function buildHistoryMessageContent(message: StoreChatMessage): string {
  const base = message.content?.trim() ?? '';
  const toolTranscript = buildToolTranscript(message.parts);
  if (!toolTranscript) return base;
  if (!base) return `Tool execution summary:\n${toolTranscript}`;
  return `${base}\n\nTool execution summary:\n${toolTranscript}`;
}

function buildCompactHistoryMessageContent(message: StoreChatMessage): string {
  return message.content?.trim() ?? '';
}

// ============================================
// Continuation Context Builder
// ============================================

/**
 * Build a continuation context from interrupted analysis parts for a given pathway.
 * Extracts completed preflight + agent tool calls and partial text so the LLM
 * can resume without re-running tools.
 */
function buildPathwayContinuationContext(
  parts: MessagePart[],
  pathway: string,
): { preflightSummary: string; completedToolSummary: string; partialContent: string; preflightCompleted: boolean } | null {
  // Filter parts belonging to this pathway
  const pathwayParts = parts.filter(p => ('pathway' in p ? p.pathway : undefined) === pathway);
  if (pathwayParts.length === 0) return null;

  const completedToolCalls = pathwayParts.filter(
    (p): p is ToolCallPart => p.type === 'tool_call' && p.status === 'complete'
  );

  // No completed tool calls means nothing worth continuing from
  if (completedToolCalls.length === 0) return null;

  const preflightCalls = completedToolCalls.filter(p => p.preflight);
  const agentCalls = completedToolCalls.filter(p => !p.preflight);

  const serializePayload = (value: Record<string, unknown> | undefined): string =>
    value ? JSON.stringify(value) : 'completed';

  // Preserve the original model-facing payload when available. This keeps
  // continuation context cache-stable instead of rebuilding it from truncated UI data.
  const preflightSummary = preflightCalls.map(p => {
    const resultStr = serializePayload(p.modelResult ?? p.result);
    return `- ${p.tool}: ${resultStr}`;
  }).join('\n');

  // Preserve full tool inputs + stable model payloads so resumed analysis can
  // continue from the exact prior tool state without lossy post-hoc compaction.
  const completedToolSummary = agentCalls.map(p => {
    const inputStr = p.input ? JSON.stringify(p.input) : '';
    const resultStr = serializePayload(p.modelResult ?? p.result);
    return `### ${p.displayName || p.tool}\nInput: ${inputStr}\nResult: ${resultStr}`;
  }).join('\n\n');

  // Extract partial text content
  const textParts = pathwayParts.filter(p => p.type === 'text');
  const partialContent = textParts.map(p => p.content).join('');

  return {
    preflightSummary,
    completedToolSummary,
    partialContent,
    preflightCompleted: preflightCalls.length > 0,
  };
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Main desktop chat hook.
 *
 * Handles chat communication with the backend via SSE streaming,
 * trade execution via Tauri, and state management.
 */
export function useDesktopChat({
  buildId: buildIdParam,
  league = DEFAULT_LEAGUE,
}: UseDesktopChatParams = DEFAULT_PARAMS): UseDesktopChatReturn {
  // ===========================================
  // Store selectors - grouped with useShallow to reduce subscriptions
  // ===========================================

  // Group 1: Build state (rarely changes)
  const { currentBuild, isInitialAnalysisComplete } = useDesktopStore(
    useShallow((s) => ({
      currentBuild: s.currentBuild,
      isInitialAnalysisComplete: s.isInitialAnalysisComplete,
    }))
  );

  // Use passed buildId or fall back to currentBuild.buildId from store
  const buildId = buildIdParam ?? currentBuild?.buildId;

  // Group 2: Pathway state (changes together during optimization)
  const { pathwayCards, generalAssessment, activePathway, pathwayHistories: rawPathwayHistories } = useDesktopStore(
    useShallow((s) => ({
      pathwayCards: s.pathwayCards,
      generalAssessment: s.generalAssessment,
      activePathway: s.activePathway,
      pathwayHistories: s.pathwayHistories,
    }))
  );
  const pathwayHistories = useMemo(
    () => normalizePathwayHistories(rawPathwayHistories),
    [rawPathwayHistories],
  );

  // Group 3: Pathway setters (stable functions - group together)
  const {
    setPathwayCards,
    setGeneralAssessment,
    setActivePathway,
    addPathwayMessage,
    updateLastPathwayMessage,
    updateLastPathwayMessageParts,
    setTopActions,
    setPathwayPriorityOrder,
    setBuildRatings,
    setGearSlotRatings,
    markPathwayCompleted,
    setSynthesisRunning,
    setActivePathwayTab,
  } = useDesktopStore(
    useShallow((s) => ({
      setPathwayCards: s.setPathwayCards,
      setGeneralAssessment: s.setGeneralAssessment,
      setActivePathway: s.setActivePathway,
      addPathwayMessage: s.addPathwayMessage,
      updateLastPathwayMessage: s.updateLastPathwayMessage,
      updateLastPathwayMessageParts: s.updateLastPathwayMessageParts,
      setTopActions: s.setTopActions,
      setPathwayPriorityOrder: s.setPathwayPriorityOrder,
      setBuildRatings: s.setBuildRatings,
      setGearSlotRatings: s.setGearSlotRatings,
      markPathwayCompleted: s.markPathwayCompleted,
      setSynthesisRunning: s.setSynthesisRunning,
      setActivePathwayTab: s.setActivePathwayTab,
    }))
  );

  // Group 6: Context and config
  const {
    seerContext,
    setSeerContext,
    storeSuggestedQuestions,
    setStoreSuggestedQuestions,
    analysisConfig,
  } = useDesktopStore(
    useShallow((s) => ({
      seerContext: s.seerContext,
      setSeerContext: s.setSeerContext,
      storeSuggestedQuestions: s.suggestedQuestions,
      setStoreSuggestedQuestions: s.setSuggestedQuestions,
      analysisConfig: s.analysisConfig,
    }))
  );

  // Local state
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  /** Analysis session ID from the backend — shown in UI for bug reports */
  const [analysisSessionId, setAnalysisSessionId] = useState<string | null>(null);
  const [isGeneratingInitialAnalysis, setIsGeneratingInitialAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [leagueQuestions, setLeagueQuestions] = useState<string[]>([]);
  const [activeTools, setActiveTools] = useState<Map<string, ToolExecutionInfo>>(new Map());
  const [liveTradeSearch, setLiveTradeSearch] = useState<LiveTradeSearchState | null>(null);
  const [sessionKBModuleIds, setSessionKBModuleIds] = useState<string[]>([]);
  const [sessionStatSubset, setSessionStatSubset] = useState<string[]>([]);
  // Track pobCode per message ID for attaching to messages
  const [messagePobCodes, setMessagePobCodes] = useState<Map<string, PoBCodeData>>(new Map());
  // Suggested actions from LLM
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  // Initial suggested actions (available slots for upgrade)
  const [initialSuggestedActions, setInitialSuggestedActions] = useState<InitialSuggestedActions | null>(null);
  // Pathway chat stream state
  const pathwayChatAbortRef = useRef<AbortController | null>(null);
  // Initial analysis stream state
  const [analysisMessageParts, setAnalysisMessageParts] = useState<MessagePart[]>([]);
  const analysisPartsRef = useRef<MessagePart[]>([]);
  const initialAnalysisAbortRef = useRef<AbortController | null>(null);
  // Per-pathway streaming state
  const [streamingPathways, setStreamingPathways] = useState<Set<string>>(new Set());
  const [streamingContentByPathway, setStreamingContentByPathway] = useState<Record<string, string>>({});

  // Real-time status message from backend (replaces generic "Thinking..." spinner)
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);

  // Refs
  const initialAnalysisTriggeredRef = useRef<string | null>(null);
  // Track the current assistant message ID during streaming
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Counter for unique activeTools keys (prevents collision when same tool runs concurrently)
  const toolCallCounter = useRef(0);

  const getSnapshotAnalysisState = useCallback((): {
    focus: AnalysisFocus[];
    customPrompt: string;
    label: string;
  } => {
    const customPrompt = analysisConfig?.customPrompt?.trim() ?? '';
    const pathwayFocus = analysisConfig?.focus ?? [];
    const focus = (customPrompt.length > 0 ? ['qa', ...pathwayFocus] : pathwayFocus) as AnalysisFocus[];

    let label = 'Analysis';
    if (pathwayFocus.length === 0 && customPrompt.length > 0) {
      label = 'Q&A';
    } else if (pathwayFocus.length === 3) {
      label = 'Full Analysis';
    } else if (pathwayFocus.length === 1) {
      const singleLabels: Record<string, string> = {

        unified: 'Unified',
        skills: 'Skills',
        gear: 'Gear',
        tree: 'Tree',
      };
      label = singleLabels[pathwayFocus[0]] || 'Analysis';
    } else if (pathwayFocus.length === 2) {
      label = pathwayFocus
        .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
        .join(' + ');
    }

    return { focus, customPrompt, label };
  }, [analysisConfig]);

  // Get messages from active pathway
  const messages = useMemo<DesktopChatMessage[]>(() => {
    // If a pathway is active, use that pathway's history
    if (activePathway) {
      return pathwayHistories[activePathway].map((msg: StoreChatMessage) => ({
        ...msg,
        pobCode: messagePobCodes.get(msg.id),
      }));
    }
    // No active pathway - return empty (pathway selection UI will be shown)
    return [];
  }, [activePathway, pathwayHistories, messagePobCodes]);

  // Cleanup on unmount - prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep analysisPartsRef in sync for access in callbacks (e.g. cancelInitialAnalysis)
  useEffect(() => {
    analysisPartsRef.current = analysisMessageParts;
  }, [analysisMessageParts]);


  /**
   * Generate initial build analysis using the unified analysis SSE endpoint.
   * Uses LangChain agents with reasoning and tool events visible.
   * @param customMessage - Optional user-authored custom analysis goal
   */
  const generateInitialAnalysis = useCallback(async (customMessage?: string) => {
    if (!buildId || !currentBuild) return;

    // If an analysis is already running, cancel it before starting a new one
    if (initialAnalysisAbortRef.current) {
      initialAnalysisAbortRef.current.abort();
      initialAnalysisAbortRef.current = null;
      setIsGeneratingInitialAnalysis(false);
      // Brief wait for backend abort to propagate (SSE close → abort → mutex release)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Create abort controller for cancellation support
    const abortController = new AbortController();
    initialAnalysisAbortRef.current = abortController;

    // Map AnalysisFocus to pathway types, filtering out 'qa' which isn't a valid pathway.
    // Also filter out already-completed pathways to avoid re-running them.
    // Normalize order to match tab display priority so the first visible tab streams first.
    // Read fresh config from store — the closure value may be stale when called
    // synchronously after a store update.
    const PATHWAY_ORDER: Array<'unified' | 'progression' | 'skills' | 'gear' | 'tree'> = ['unified', 'progression', 'skills', 'gear', 'tree'];
    const storeStateEarly = useDesktopStore.getState();
    const freshConfig = storeStateEarly.analysisConfig;
    const focusAreas = freshConfig?.focus || ['skills', 'gear', 'tree'];
    const completed = storeStateEarly.completedPathways || [];
    const pathways = PATHWAY_ORDER.filter(
      (p) => focusAreas.includes(p) && (p === 'unified' || p === 'progression' || !completed.includes(p as PathwayType))
    );

    setIsGeneratingInitialAnalysis(true);
    setError(null);
    setErrorCode(null);
    // Build continuation context from interrupted parts BEFORE clearing state.
    // Primary source: in-memory ref (same-session cancel+resume).
    // Fallback: active snapshot in history store (app restart after interruption).
    let existingParts = analysisPartsRef.current;
    if (existingParts.length === 0) {
      const activeSnapshot = useAnalysisHistoryStore.getState().getActiveSnapshot();
      if (activeSnapshot?.status === 'interrupted' && activeSnapshot.parts?.length) {
        existingParts = activeSnapshot.parts;
      }
    }
    const continuationCtx: Record<string, {
      preflightSummary: string;
      completedToolSummary: string;
      partialContent: string;
      preflightCompleted: boolean;
    }> = {};
    if (existingParts.length > 0) {
      for (const pw of pathways) {
        if (pw === 'unified' || pw === 'progression') continue;
        const ctx = buildPathwayContinuationContext(existingParts, pw);
        if (ctx) {
          continuationCtx[pw] = ctx;
        }
      }
    }
    const hasContinuation = Object.keys(continuationCtx).length > 0;

    setStreamingContent('');
    setStreamingPathways(new Set(pathways));
    setStreamingContentByPathway({});

    // If continuing interrupted pathways, preserve existing parts and add separator.
    // Otherwise start fresh.
    if (hasContinuation) {
      setAnalysisMessageParts(prev => [
        ...prev,
        { type: 'text' as const, content: '\n\n---\n\n*Continuing analysis...*\n\n' },
      ]);
    } else {
      setAnalysisMessageParts([]);
    }

    // Only clear package tooltip data if the relevant pathway is being (re-)analyzed.
    // On resume, completed pathways keep their packages intact.
    if (pathways.includes('gear') || pathways.includes('unified')) {
      useGearPackageStore.getState().clearPackages();
    }
    if (pathways.includes('tree') || pathways.includes('unified')) {
      useTreePackageStore.getState().clearPackages();
    }

    // Read gear budget from store (always include when gear pathway is selected)
    const storeState = useDesktopStore.getState();

    // Build unified analysis payload
    const customPrompt = customMessage?.trim();
    // Read session-scoped consent from the build (captured at import time).
    // Settings changes don't affect the current session — only future imports.
    const buildConsent = useDesktopStore.getState().currentBuild?.sessionDataConsent;

    const stashToken = useDesktopStore.getState().gggAccessToken;
    const payload: AnalyzeStreamPayload = {
      buildId,
      pathways,
      ...(customPrompt ? { customPrompt } : {}),
      ...(storeState.optimizationFocus !== 'balanced' && { optimizationFocus: storeState.optimizationFocus }),
      ...(hasContinuation ? { continuationContext: continuationCtx } : {}),
      ...(buildConsent === true && { sessionDataConsent: true }),
      ...(stashToken ? { gggAccessToken: stashToken } : {}),
    };
    // When continuing, initialize currentParts from existing state so new events
    // are appended after the separator. Otherwise start empty.
    let currentParts: MessagePart[] = hasContinuation
      ? [...existingParts, { type: 'text' as const, content: '\n\n---\n\n*Continuing analysis...*\n\n' }]
      : [];
    let currentContent = '';
    const currentContentByPathway: Record<string, string> = {};
    const pathwayCompleteStored = new Set<string>();

    const sseOptions: SSEConnectionOptions = {
      onEvent: async (event: StreamingChatEvent) => {
        if (!isMountedRef.current) return;

        // Use appendEventToParts for tool_start, tool_result, reasoning, content, error
        currentParts = appendEventToParts(currentParts, event);
        setAnalysisMessageParts([...currentParts]);

        switch (event.type) {
          case 'session_started':
            setAnalysisSessionId(event.sessionId);
            break;

          case 'content':
            currentContent += event.content ?? '';
            // Update streamingContent for real-time display in Analysis panel
            setStreamingContent(currentContent);
            // Per-pathway content tracking
            if (event.pathway) {
              currentContentByPathway[event.pathway] = (currentContentByPathway[event.pathway] || '') + (event.content ?? '');
              setStreamingContentByPathway({ ...currentContentByPathway });
            }
            break;

          case 'context':
            if (event.seerContext) {
              setSeerContext(event.seerContext);
            }
            if (event.sessionKBModuleIds) {
              setSessionKBModuleIds(event.sessionKBModuleIds);
            }
            if (event.initialSuggestedActions) {
              setInitialSuggestedActions(event.initialSuggestedActions);
            }
            // Handle suggested questions from initial analysis
            if (Array.isArray(event.suggestedQuestions)) {
              setSuggestedQuestions(event.suggestedQuestions);
              setStoreSuggestedQuestions(event.suggestedQuestions);
            }
            // Handle build ratings
            if (event.buildRatings) {
              setBuildRatings(event.buildRatings);
            }
            // Handle gear slot ratings
            if (event.gearSlotRatings) {
              setGearSlotRatings(event.gearSlotRatings);
            }
            // Handle top actions and pathway priority
            if (event.topActions) {
              setTopActions(event.topActions);
            }
            if (event.pathwayPriorityOrder) {
              setPathwayPriorityOrder(event.pathwayPriorityOrder);
            }
            break;

          case 'status':
            if (event.message) {
              setStreamingStatus(event.message);
            }
            break;

          case 'tool_start':
            // Clear status message once tool calls begin arriving
            setStreamingStatus(null);
            break;
          case 'tool_result':
            // Hydrate gear packages at SSE receive time for PackagePill tooltips
            if (event.tool === 'test_gear_setups' && event.data) {
              hydrateGearPackagesFromToolResult(event.data as Record<string, unknown>);
            }
            // Hydrate tree packages at SSE receive time for TreePill "Show on Tree"
            if ((event.tool === 'batch_test_tree' || event.tool === 'batch_simulate_tree') && event.data) {
              hydrateTreePackagesFromToolResult(event.data as Record<string, unknown>);
            }
            // Hydrate atlas packages at SSE receive time for AtlasPill "Show on Atlas"
            if (event.tool === 'suggest_atlas_path' && event.data) {
              hydrateAtlasPackagesFromToolResult(event.data as Record<string, unknown>);
            }
            // Unified tool: hydrate gear + tree packages from their sections.
            // Display payloads nest results under section.data; model payloads
            // (fallback when display queue is missed) spread data flat at the
            // section level. Check both paths so hydration works either way.
            if (event.tool === 'test_unified_build' && event.data) {
              const unifiedData = event.data as Record<string, unknown>;
              const unifiedSections = Array.isArray(unifiedData.sections) ? unifiedData.sections as Array<Record<string, unknown>> : [];
              console.log('[hydration] unified sections:', unifiedSections.map(s => ({
                kind: s.kind,
                hasData: !!s.data,
                hasResults: Array.isArray(s.results),
                nestedResults: s.data && typeof s.data === 'object' && Array.isArray((s.data as Record<string, unknown>).results),
              })));
              const extractSectionData = (s: Record<string, unknown>): Record<string, unknown> | null => {
                if (s.data && typeof s.data === 'object') return s.data as Record<string, unknown>;
                if (Array.isArray(s.results)) return s as Record<string, unknown>;
                return null;
              };
              const gearSection = unifiedSections.find((s) => s.kind === 'gear');
              const gearData = gearSection ? extractSectionData(gearSection) : null;
              if (gearData) {
                const results = (gearData.results ?? []) as Array<Record<string, unknown>>;
                console.log('[hydration] gear:', { resultCount: results.length, refs: results.slice(0, 3).map(r => r.ref) });
                hydrateGearPackagesFromToolResult(gearData);
              } else {
                console.warn('[hydration] gear section missing or empty');
              }
              const treeSection = unifiedSections.find((s) => s.kind === 'tree');
              const treeData = treeSection ? extractSectionData(treeSection) : null;
              if (treeData) {
                const results = (treeData.results ?? []) as Array<Record<string, unknown>>;
                console.log('[hydration] tree:', { resultCount: results.length, refs: results.slice(0, 3).map(r => r.ref) });
                hydrateTreePackagesFromToolResult(treeData);
              } else {
                console.warn('[hydration] tree section missing or empty');
              }
            }
            break;

          case 'pathway_complete': {
            const pw = event.pathway as PathwayType | 'unified' | 'progression';
            if (!pw) break;

            // Remove from streaming set
            setStreamingPathways(prev => {
              const next = new Set(prev);
              next.delete(pw);
              return next;
            });

            // Split accumulated parts for this pathway and store immediately
            const STORABLE_PATHWAYS = ['skills', 'gear', 'tree', 'unified', 'progression'] as const;
            const CORE_PATHWAYS: PathwayType[] = ['skills', 'gear', 'tree'];
            if (STORABLE_PATHWAYS.includes(pw)) {
              const partsForPw = currentParts.filter(
                p => ('pathway' in p ? p.pathway : undefined) === pw
              );
              const pwContent = (currentContentByPathway[pw] || '')
                .replace(/```suggested_questions[\s\S]*?```/g, '')
                .replace(/```improvements_json[\s\S]*?```/g, '')
                .trim();

              if (partsForPw.length > 0 || pwContent) {
                const pwStore = useDesktopStore.getState();
                pwStore.addPathwayMessage(pw, {
                  id: `analysis-${pw}-${Date.now()}`,
                  role: 'assistant',
                  content: pwContent,
                  timestamp: Date.now(),
                  parts: partsForPw,
                });
                pathwayCompleteStored.add(pw);
                if (CORE_PATHWAYS.includes(pw as PathwayType)) {
                  markPathwayCompleted(pw as PathwayType);
                }

                // Incremental persistence: save partial snapshot to localStorage
                // so user doesn't lose completed pathways if app closes mid-analysis
                const historyStore = useAnalysisHistoryStore.getState();
                const activeId = historyStore.activeSnapshotId;
                const currentBuild = useDesktopStore.getState().currentBuild;
                const snapshotMeta = getSnapshotAnalysisState();
                if (activeId) {
                  // Update existing streaming snapshot — merge pathwayContent with
                  // any previously saved content so resume doesn't lose completed pathways.
                  const existingSnapshot = historyStore.getActiveSnapshot();
                  const mergedPathwayContent = {
                    ...(existingSnapshot?.pathwayContent ?? {}),
                    ...currentContentByPathway,
                  };
                  const updatedCompletedPathways = useDesktopStore.getState().completedPathways;
                  historyStore.upsertSnapshot(activeId, {
                    focus: snapshotMeta.focus,
                    customPrompt: snapshotMeta.customPrompt,
                    label: snapshotMeta.label,
                    pathwayContent: mergedPathwayContent,
                    completedPathways: [...updatedCompletedPathways],
                    status: 'streaming',
                    pathwayHistories: useDesktopStore.getState().pathwayHistories,
                    // Incremental token/session capture
                    tokenEntries: useTokenStore.getState().entries,
                    tokenTotals: useTokenStore.getState().totals,
                    creditsUsed: useTokenStore.getState().creditsUsedSession,
                  });
                } else if (currentBuild?.pobCode) {
                  // First pathway completed — create a new streaming snapshot
                  const snapshotId = historyStore.saveSnapshot({
                    build: {
                      characterName: currentBuild.characterName,
                      class: currentBuild.class,
                      ascendancy: currentBuild.ascendancy || currentBuild.class,
                      level: currentBuild.level,
                      pobCode: currentBuild.pobCode,
                    },
                    focus: snapshotMeta.focus,
                    customPrompt: snapshotMeta.customPrompt,
                    label: snapshotMeta.label,
                    pathwayContent: { ...currentContentByPathway },
                    isPartial: true,
                  completedPathways: CORE_PATHWAYS.includes(pw as PathwayType) ? [pw as PathwayType] : [],
                    status: 'streaming',
                    // Incremental token/session capture
                    tokenEntries: useTokenStore.getState().entries,
                    tokenTotals: useTokenStore.getState().totals,
                    creditsUsed: useTokenStore.getState().creditsUsedSession,
                  });
                  // Mark as active so subsequent pathway_complete events update it
                  historyStore.setActiveSnapshotId(snapshotId);
                }
              }
            }
            break;
          }

          case 'complete': {
            // Clear status message on stream completion
            setStreamingStatus(null);

            // Strip suggested_questions and improvements_json code blocks for clean display
            const cleanContent = currentContent
              .replace(/```suggested_questions[\s\S]*?```/g, '')
              .replace(/```improvements_json[\s\S]*?```/g, '')
              .trim();
            // Keep the clean content in streamingContent (don't clear)
            // This persists the analysis for the Analysis panel
            setStreamingContent(cleanContent);
            currentAssistantMessageIdRef.current = null;
            initialAnalysisAbortRef.current = null;

            // Safety net: store any pathways not already stored by pathway_complete.
            // Split the accumulated parts by pathway tag.
            const VALID_PATHWAYS = ['skills', 'gear', 'tree', 'unified', 'progression'] as const;
            const CORE_PATHWAYS: PathwayType[] = ['skills', 'gear', 'tree'];
            const store = useDesktopStore.getState();
            const alreadyCompleted = store.completedPathways;

            const partsByPathway: Record<(typeof VALID_PATHWAYS)[number], MessagePart[]> = {
              skills: [],
              gear: [],
              tree: [],
              unified: [],
              progression: [],
            };
            const contentByPathway: Record<(typeof VALID_PATHWAYS)[number], string> = {
              skills: '',
              gear: '',
              tree: '',
              unified: '',
              progression: '',
            };

            for (const part of currentParts) {
              const pw = ('pathway' in part ? part.pathway : undefined) as string | undefined;
              if (pw && VALID_PATHWAYS.includes(pw as (typeof VALID_PATHWAYS)[number])) {
                partsByPathway[pw as (typeof VALID_PATHWAYS)[number]].push(part);
                if (part.type === 'text') {
                  contentByPathway[pw as (typeof VALID_PATHWAYS)[number]] += part.content;
                }
              } else {
                // Parts without a pathway tag (or 'shared') go into all active pathways
                for (const p of pathways as Array<(typeof VALID_PATHWAYS)[number]>) {
                  partsByPathway[p].push(part);
                  if (part.type === 'text') {
                    contentByPathway[p] += part.content;
                  }
                }
              }
            }

            for (const pw of pathways as Array<(typeof VALID_PATHWAYS)[number]>) {
              // Skip pathways already stored by pathway_complete
              if (pathwayCompleteStored.has(pw)) continue;

              if (partsByPathway[pw].length > 0 || contentByPathway[pw]) {
                const pwContent = contentByPathway[pw]
                  .replace(/```suggested_questions[\s\S]*?```/g, '')
                  .replace(/```improvements_json[\s\S]*?```/g, '')
                  .trim();
                store.addPathwayMessage(pw, {
                  id: `analysis-${pw}-${Date.now()}`,
                  role: 'assistant',
                  content: pwContent,
                  timestamp: Date.now(),
                  parts: partsByPathway[pw],
                });
              }
            }

            // Mark any remaining pathways as completed (safety net for synthesis unlock)
            for (const pw of pathways as Array<(typeof VALID_PATHWAYS)[number]>) {
              if (!CORE_PATHWAYS.includes(pw as PathwayType) || !alreadyCompleted.includes(pw as PathwayType)) {
                if (partsByPathway[pw].length > 0 || contentByPathway[pw]) {
                  if (CORE_PATHWAYS.includes(pw as PathwayType)) {
                    markPathwayCompleted(pw as PathwayType);
                  }
                }
              }
            }

            // Clear streaming pathways set
            setStreamingPathways(new Set());

            useDesktopStore.getState().setInitialAnalysisComplete(true);

            // Finalize the snapshot to 'complete' with all enriched data.
            // Merge pathwayContent so resume doesn't lose previously completed pathways.
            {
              const histStore = useAnalysisHistoryStore.getState();
              const activeSnapId = histStore.activeSnapshotId;
              if (activeSnapId) {
                const existingSnap = histStore.snapshots.find(s => s.id === activeSnapId);
                const mergedPathwayContent = {
                  ...(existingSnap?.pathwayContent ?? {}),
                  ...currentContentByPathway,
                };
                const finalState = useDesktopStore.getState();
                const snapshotMeta = getSnapshotAnalysisState();
                histStore.upsertSnapshot(activeSnapId, {
                  focus: snapshotMeta.focus,
                  customPrompt: snapshotMeta.customPrompt,
                  status: 'complete',
                  isPartial: false,
                  label: snapshotMeta.label,
                  pathwayContent: mergedPathwayContent,
                  completedPathways: [...finalState.completedPathways],
                  pathwayHistories: finalState.pathwayHistories,
                  vizData: finalState.vizData,
                  pathwayCards: finalState.pathwayCards,
                  generalAssessment: finalState.generalAssessment,
                  buildRatings: finalState.buildRatings,
                  gearSlotRatings: finalState.gearSlotRatings,
                  seerContext: finalState.seerContext,
                  topActions: finalState.topActions,
                  pathwayPriorityOrder: finalState.pathwayPriorityOrder,
                });
              }
            }
            break;
          }

          case 'token_usage_interim':
          case 'token_usage':
            useTokenStore.getState().addTokenUsage(event.data);
            break;

          case 'credit_deduction':
            useTokenStore.getState().applyCreditDeduction(
              event.data.creditsDeducted,
              event.data.creditsRemaining,
            );
            break;

          case 'llm_context_debug':
            if (import.meta.env.DEV) {
              useDesktopStore.getState().setContextDebugData(event.data);
            }
            break;

          case 'llm_call_debug':
            if (import.meta.env.DEV) {
              useDesktopStore.getState().appendLlmCallDebug(event.data);
            }
            break;

          case 'keepalive':
            // Connection health indicator — consumed by SSE client watchdog
            break;

          case 'error':
            setError(event.error);
            setErrorCode((event as Record<string, unknown>).code as string || null);
            initialAnalysisAbortRef.current = null;
            if ((event as Record<string, unknown>).code === 'INSUFFICIENT_CREDITS') {
              setStreamingContent(''); // Don't show error as streaming content for credit errors
            } else if ((event as Record<string, unknown>).code === 'CREDIT_OVERDRAFT') {
              // Don't clear streaming content — partial analysis results are still useful
              // The error message itself tells the user what happened
            } else if ((event as Record<string, unknown>).code === 'SESSION_EXPIRED') {
              // Friendly message + toast so the user knows how to recover
              setStreamingContent(event.error);
              toast.error('Session expired', {
                description: 'Please sign out and sign back in, then try again.',
              });
            } else {
              reportError('analysis_error', event.error || 'Unknown analysis error', { buildId });
              // Show error in streamingContent, not chat messages
              setStreamingContent(`Analysis failed: ${event.error}`);
            }
            break;
        }
      },
      onError: (err) => {
        if (!isMountedRef.current) return;
        setError(err.message);
        initialAnalysisAbortRef.current = null;
        reportError(
          err.message.includes('no response') ? 'sse_timeout' : 'connection_error',
          err.message,
          { buildId },
        );
        setStreamingContent(`Connection failed: ${err.message}`);
      },
      onClose: () => {
        initialAnalysisAbortRef.current = null;
      },
    };

    try {
      await sendAnalyzeStream(payload, sseOptions, abortController.signal);
    } catch (err) {
      // Don't show error for intentional cancellation
      if (abortController.signal.aborted) {
        return;
      }
      const errorMsg = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMsg);
      reportError('analysis_error', errorMsg, { buildId });
      setStreamingContent(`The spirits are distant: ${errorMsg}`);
    } finally {
      setIsGeneratingInitialAnalysis(false);
      setStreamingPathways(new Set());
      initialAnalysisAbortRef.current = null;
    }
  }, [buildId, currentBuild, analysisConfig, getSnapshotAnalysisState, setSuggestedQuestions, setStoreSuggestedQuestions, setBuildRatings, setGearSlotRatings, setTopActions, setPathwayPriorityOrder]);

  /**
   * Cancel an active initial analysis stream.
   */
  const cancelInitialAnalysis = useCallback(() => {
    if (initialAnalysisAbortRef.current) {
      initialAnalysisAbortRef.current.abort();
      // Don't null out the ref — leave the aborted controller in place so
      // generateInitialAnalysis detects it and waits for backend mutex release.
    }
    setIsGeneratingInitialAnalysis(false);
    setStreamingPathways(new Set());

    // Mark any running tool_call parts as cancelled, then append cancellation text
    setAnalysisMessageParts(prev => [
      ...prev.map(p =>
        p.type === 'tool_call' && p.status === 'running'
          ? { ...p, status: 'cancelled' as const }
          : p
      ),
      { type: 'text', content: '\n\n*Cancelled by user.*' },
    ]);
    setStreamingContent(prev => prev + '\n\n*Cancelled by user.*');

    // Persist the interrupted snapshot so it doesn't remain as 'streaming' forever.
    // Include the current analysisMessageParts so continuation can read them back.
    const histStore = useAnalysisHistoryStore.getState();
    const activeSnapId = histStore.activeSnapshotId;
    if (activeSnapId) {
      const storeState = useDesktopStore.getState();
      const snapshotMeta = getSnapshotAnalysisState();
      histStore.upsertSnapshot(activeSnapId, {
        focus: snapshotMeta.focus,
        customPrompt: snapshotMeta.customPrompt,
        label: `${snapshotMeta.label} (partial)`,
        status: 'interrupted',
        isPartial: true,
        parts: analysisPartsRef.current,
        pathwayHistories: storeState.pathwayHistories,
        vizData: storeState.vizData,
        pathwayCards: storeState.pathwayCards,
        generalAssessment: storeState.generalAssessment,
        buildRatings: storeState.buildRatings,
        gearSlotRatings: storeState.gearSlotRatings,
        seerContext: storeState.seerContext,
        topActions: storeState.topActions,
        pathwayPriorityOrder: storeState.pathwayPriorityOrder,
      });
    }
  }, [getSnapshotAnalysisState]);

  /**
   * Launch cross-pathway synthesis.
   * Extracts analysis text from each pathway's assistant messages and sends
   * a synthesis request to the backend.
   */
  const launchSynthesis = useCallback(async () => {
    if (!buildId || !currentBuild) return;

    const store = useDesktopStore.getState();
    const histories = store.pathwayHistories;

    // Extract analysis text from each pathway's assistant messages
    const extractPathwayText = (msgs: StoreChatMessage[]): string => {
      return msgs
        .filter((m) => m.role === 'assistant')
        .map((m) => buildHistoryMessageContent(m))
        .join('\n\n')
        .trim();
    };

    const gearText = extractPathwayText(histories.gear);
    const skillsText = extractPathwayText(histories.skills);
    const treeText = extractPathwayText(histories.tree);

    // Switch to synthesis tab and mark as running
    setActivePathwayTab('synthesis' as unknown as AnalysisFocus);
    setSynthesisRunning(true);

    const payload: AnalyzeStreamPayload = {
      buildId,
      pathways: ['synthesis' as unknown as 'unified'],
      pathwayResults: {
        gear: gearText,
        skills: skillsText,
        tree: treeText,
      },
    };

    let currentParts: MessagePart[] = [];
    let currentContent = '';

    // Add a placeholder assistant message for streaming
    const assistantMessageId = `synthesis-${Date.now()}`;
    addPathwayMessage('synthesis', {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      parts: [],
    });

    const sseOptions: SSEConnectionOptions = {
      onEvent: (event: StreamingChatEvent) => {
        if (!isMountedRef.current) return;

        currentParts = appendEventToParts(currentParts, event);

        switch (event.type) {
          case 'content':
            currentContent += event.content ?? '';
            updateLastPathwayMessageParts('synthesis', [...currentParts], currentContent);
            break;

          case 'status':
            if (event.message) {
              setStreamingStatus(event.message);
            }
            break;

          case 'tool_start':
          case 'tool_result':
            setStreamingStatus(null);
            updateLastPathwayMessageParts('synthesis', [...currentParts], currentContent);
            break;

          case 'complete': {
            setStreamingStatus(null);

            const cleanContent = currentContent
              .replace(/```suggested_questions[\s\S]*?```/g, '')
              .replace(/```improvements_json[\s\S]*?```/g, '')
              .trim();

            // Finalize the synthesis message
            updateLastPathwayMessageParts('synthesis', [...currentParts], cleanContent);
            setSynthesisRunning(false);

            // Update suggested questions if provided
            if (event.data?.suggestedQuestions && Array.isArray(event.data.suggestedQuestions)) {
              setSuggestedQuestions(event.data.suggestedQuestions);
              setStoreSuggestedQuestions(event.data.suggestedQuestions);
            }
            break;
          }

          case 'token_usage_interim':
          case 'token_usage':
            useTokenStore.getState().addTokenUsage(event.data);
            break;

          case 'credit_deduction':
            useTokenStore.getState().applyCreditDeduction(
              event.data.creditsDeducted,
              event.data.creditsRemaining,
            );
            break;

          case 'error':
            setSynthesisRunning(false);
            updateLastPathwayMessageParts('synthesis', [...currentParts], `Synthesis failed: ${event.error}`);
            toast.error(`Synthesis failed: ${event.error}`);
            break;
        }
      },
      onError: (err) => {
        if (!isMountedRef.current) return;
        setSynthesisRunning(false);
        toast.error(`Synthesis connection failed: ${err.message}`);
      },
      onClose: () => {
        // Stream ended
      },
    };

    try {
      await sendAnalyzeStream(payload, sseOptions);
    } catch (err) {
      setSynthesisRunning(false);
      const errorMsg = err instanceof Error ? err.message : 'Synthesis failed';
      toast.error(`Synthesis error: ${errorMsg}`);
    }
  }, [buildId, currentBuild, analysisConfig, addPathwayMessage, updateLastPathwayMessageParts, setSynthesisRunning, setActivePathwayTab, setSuggestedQuestions, setStoreSuggestedQuestions]);

  // Auto-analysis removed: LLM analysis now only triggers when user clicks "Analyze Build"
  // The generateInitialAnalysis() function is still available for manual trigger via retryInitialAnalysis()

  /**
   * Handle trade search execution from SSE instruction.
   */
  const handleTradeSearchInstruction = useCallback(async (
    instruction: TradeSearchInstruction
  ): Promise<TradeToolResult | null> => {
    setLiveTradeSearch({
      state: 'running',
      slot: instruction.slot,
      budget: instruction.budget,
      stats: instruction.stats,
      iteration: 1,
      statusText: 'Starting trade search...',
    });

    try {
      const result = await executeTradeSearch(instruction, {
        league,
        onProgress: (progress) => {
          setLiveTradeSearch(prev => ({
            ...prev,
            state: 'running',
            iteration: progress.iteration,
            maxIterations: progress.maxIterations,
            resultCount: progress.resultCount,
            minPrice: progress.minPrice,
            statusText: progress.statusText,
            tradeUrl: progress.tradeUrl,
          }));
        },
      });

      if (result.success && result.result) {
        setLiveTradeSearch(prev => ({
          ...prev,
          state: 'complete',
          totalResults: result.result!.totalResults,
          tradeUrl: result.result!.tradeUrl,
        }));
        return result.result;
      } else {
        setLiveTradeSearch(prev => ({
          ...prev,
          state: 'error',
          error: result.error,
        }));
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Trade search failed';
      setLiveTradeSearch(prev => ({
        ...prev,
        state: 'error',
        error: errorMsg,
      }));
      console.error('[useDesktopChat] Trade search error:', err);
      return null;
    }
  }, [league]);

  /**
   * Send a chat message.
   * Routes to pathway-specific history if a pathway is active.
   */
  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !buildId || !currentBuild) {
      console.warn('[useDesktopChat] sendMessage early return: trimmed=%s, buildId=%s, currentBuild=%s', !!trimmed, buildId, !!currentBuild);
      return;
    }

    // Read activePathway directly from store to get latest value
    // (avoids stale closure when pathway is set immediately before sendMessage)
    // Also check activePathwayTab for synthesis follow-up routing
    const storeState = useDesktopStore.getState();
    const isSynthesisTab = (storeState.activePathwayTab as string) === 'synthesis';
    const currentActivePathway: PathwayType | 'synthesis' | 'unified' | 'progression' | null = isSynthesisTab
      ? 'synthesis'
      : (storeState.activePathway || activePathway || null);

    console.log('[useDesktopChat] sendMessage: pathway=%s, tab=%s, storePathway=%s, closurePathway=%s', currentActivePathway, storeState.activePathwayTab, storeState.activePathway, activePathway);

    // Must have an active pathway to send messages
    if (!currentActivePathway) {
      console.warn('[useDesktopChat] Cannot send message without active pathway');
      return;
    }

    // Reset state
    setLiveTradeSearch(null);
    setError(null);
    setErrorCode(null);
    setActiveTools(new Map());

    // Add user message to pathway history
    const userMessage: StoreChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    addPathwayMessage(currentActivePathway, userMessage);

    setIsSending(true);

    // Build chat request - context will be fetched server-side from buildId
    const context = {
      buildId,
    } as import('../../../shared/types/Chat').PoBContext;

    // Get current pathway messages for history (read from store AFTER addPathwayMessage which is synchronous)
    const currentPathwayMessages = useDesktopStore.getState().pathwayHistories[currentActivePathway];
    // currentPathwayMessages already contains userMessage (Zustand setState is sync), don't append again
    const history = currentPathwayMessages
      .map((m: StoreChatMessage) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: buildCompactHistoryMessageContent(m),
        timestamp: m.timestamp,
      }))
      .filter((m) => m.content.length > 0);

    const storeSnapshot = useDesktopStore.getState();

    const followUpStashToken = useDesktopStore.getState().gggAccessToken;
    const payload: ChatRequest = {
      buildId,
      message: trimmed,
      context,
      history,
      activePathway: currentActivePathway,
      sessionKBModuleIds: sessionKBModuleIds.length > 0 ? sessionKBModuleIds : undefined,
      sessionStatSubset: sessionStatSubset.length > 0 ? sessionStatSubset : undefined,
      ...(storeSnapshot.optimizationFocus !== 'balanced' && {
        optimizationFocus: storeSnapshot.optimizationFocus,
      }),
      ...(followUpStashToken ? { gggAccessToken: followUpStashToken } : {}),
    };

    // Follow-up chat is always streamed to keep tool/progress/token behavior consistent.
    const abortController = new AbortController();
    pathwayChatAbortRef.current = abortController;

    // Add placeholder message for streaming to pathway history (with parts for tool calls)
    const assistantMessageId = `assistant-${Date.now()}`;
    currentAssistantMessageIdRef.current = assistantMessageId;
    addPathwayMessage(currentActivePathway, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      parts: [], // Initialize parts array for tool call rendering
    });

    let streamedContent = '';
    let currentParts: MessagePart[] = []; // Track message parts for tool calls
    let tradeResult: TradeToolResult | null = null;
    let pobCodeResult: PoBCodeData | null = null;

    const sseOptions: SSEConnectionOptions = {
      onEvent: async (event: StreamingChatEvent) => {
        // Ignore events if component unmounted
        if (!isMountedRef.current) return;

        switch (event.type) {
          case 'content':
            streamedContent += event.content;
            // Append content to parts and update message with both content and parts
            currentParts = appendEventToParts(currentParts, event);
            updateLastPathwayMessageParts(currentActivePathway, [...currentParts], streamedContent);
            break;

          case 'context':
            if (event.seerContext) {
              setSeerContext(event.seerContext);
            }
            if (event.sessionKBModuleIds) {
              setSessionKBModuleIds(event.sessionKBModuleIds);
            }
            if (Array.isArray(event.suggestedQuestions)) {
              setSuggestedQuestions(event.suggestedQuestions);
              setStoreSuggestedQuestions(event.suggestedQuestions);
            }
            if (Array.isArray(event.leagueQuestions)) {
              setLeagueQuestions(event.leagueQuestions);
            }
            if (Array.isArray(event.topActions)) {
              setTopActions(event.topActions);
            }
            if (Array.isArray(event.pathwayPriorityOrder)) {
              setPathwayPriorityOrder(event.pathwayPriorityOrder);
            }
            if (event.buildRatings) {
              setBuildRatings(event.buildRatings);
            }
            if (event.gearSlotRatings) {
              setGearSlotRatings(event.gearSlotRatings);
            }
            if (event.initialSuggestedActions) {
              setInitialSuggestedActions(event.initialSuggestedActions);
            }
            break;

          case 'suggested_actions':
            if (Array.isArray(event.actions)) {
              setSuggestedActions(event.actions);
            }
            break;

          case 'status':
            if (event.message) {
              setStreamingStatus(event.message);
            }
            break;

          case 'tool_start': {
            // Clear status message once tool calls begin arriving
            setStreamingStatus(null);

            const toolConfig = TOOL_DISPLAY_NAMES[event.tool] || { label: event.tool, icon: 'tool' };
            let toolDisplayName = toolConfig.label;
            // Override for preflight tool calls
            const inputObj = event.input as Record<string, unknown> | undefined;
            const inputType = inputObj?.type;
            if (inputType === 'preflight-singles') toolDisplayName = 'Preflight: Ladder Rares';
            else if (inputType === 'unique-pretest') toolDisplayName = 'Preflight: Ladder Uniques';

            const toolCallId = `${event.tool}_${toolCallCounter.current++}`;
            const toolInfo: ToolExecutionInfo = {
              name: event.tool,
              displayName: toolDisplayName,
              status: 'running',
              startTime: Date.now(),
              inputSummary: formatToolInput(event.tool, event.input),
            };
            setActiveTools(prev => {
              const updated = new Map(prev);
              updated.set(toolCallId, toolInfo);
              return updated;
            });

            // Append tool_start to parts for ToolStepCard rendering
            currentParts = appendEventToParts(currentParts, event);
            // Flush parts to store so the ToolActivitySummary card renders immediately
            if (currentActivePathway) {
              updateLastPathwayMessageParts(currentActivePathway, [...currentParts], streamedContent);
            }

            // Check if this is a trade search we should execute locally
            const tradeInstruction = parseTradeSearchInstruction(event);
            if (tradeInstruction) {
              // Execute trade search via Tauri (user's IP)
              tradeResult = await handleTradeSearchInstruction(tradeInstruction);
            }
            break;
          }

          case 'tool_result': {
            const toolName = event.tool;
            if (toolName) {
              setActiveTools(prev => {
                const updated = new Map(prev);
                // Find the first active entry matching this tool name and remove it
                for (const [key, info] of updated) {
                  if (info.name === toolName) {
                    updated.delete(key);
                    break;
                  }
                }
                return updated;
              });
            }

            // Append tool_result to parts for ToolStepCard rendering
            currentParts = appendEventToParts(currentParts, event);
            // Flush parts to store so completed tool cards update immediately
            if (currentActivePathway) {
              updateLastPathwayMessageParts(currentActivePathway, [...currentParts], streamedContent);
            }

            // Hydrate gear package store at SSE receive time so PackagePill
            // tooltips work even when ToolActivitySummary hasn't expanded the card.
            if (toolName === 'test_gear_setups' && event.data) {
              hydrateGearPackagesFromToolResult(event.data as Record<string, unknown>);
            }
            // Hydrate tree packages for TreePill "Show on Tree" inline pills
            if ((toolName === 'batch_test_tree' || toolName === 'batch_simulate_tree') && event.data) {
              hydrateTreePackagesFromToolResult(event.data as Record<string, unknown>);
            }
            // Hydrate atlas packages for AtlasPill "Show on Atlas" inline pills
            if (toolName === 'suggest_atlas_path' && event.data) {
              hydrateAtlasPackagesFromToolResult(event.data as Record<string, unknown>);
            }
            // Unified tool follow-up: hydrate gear + tree from their sections.
            // Display payloads nest under section.data; model payloads spread flat.
            if (toolName === 'test_unified_build' && event.data) {
              const ud = event.data as Record<string, unknown>;
              const uSections = Array.isArray(ud.sections) ? ud.sections as Array<Record<string, unknown>> : [];
              const extractData = (s: Record<string, unknown>): Record<string, unknown> | null => {
                if (s.data && typeof s.data === 'object') return s.data as Record<string, unknown>;
                if (Array.isArray(s.results)) return s as Record<string, unknown>;
                return null;
              };
              const gs = uSections.find((s) => s.kind === 'gear');
              const gd = gs ? extractData(gs) : null;
              if (gd) hydrateGearPackagesFromToolResult(gd);
              const ts = uSections.find((s) => s.kind === 'tree');
              const td = ts ? extractData(ts) : null;
              if (td) hydrateTreePackagesFromToolResult(td);
            }

            // Handle export_modified_build tool result
            if (toolName === 'export_modified_build' && event.data) {
              const toolData = event.data as {
                success?: boolean;
                pobCode?: string;
                message?: string;
              };
              if (toolData.success && toolData.pobCode) {
                pobCodeResult = {
                  code: toolData.pobCode,
                  title: 'Your Updated Build',
                };
              }
            }
            break;
          }

          case 'trade_search_plan': {
            // Initial plan — seed per-slot state in 'queued', record total
            // probes + ETA, stamp startedAt for the elapsed-time display.
            const planData = event.data;
            setLiveTradeSearch(prev => {
              const nextPerSlot: Record<string, TradeSearchSlotState> = {};
              for (const s of planData.slots) {
                nextPerSlot[s.slot] = {
                  slot: s.slot,
                  status: 'queued',
                  maxProbes: s.maxProbes,
                  currentProbe: 0,
                  ...(s.budget ? { budget: s.budget } : {}),
                };
              }
              return {
                ...prev,
                state: 'running' as const,
                startedAt: prev?.startedAt ?? Date.now(),
                plan: {
                  slots: planData.slots,
                  totalProbes: planData.totalProbes,
                  estimatedSeconds: planData.estimatedSeconds,
                },
                perSlot: nextPerSlot,
              };
            });
            break;
          }

          case 'iteration_status': {
            const data = event.data;
            const slotName = data.currentFilters?.slot;
            setLiveTradeSearch(prev => {
              const basePerSlot = prev?.perSlot ?? {};
              let nextPerSlot = basePerSlot;
              if (slotName) {
                // Mark any previously-running OTHER slots as done (they'd
                // already have their final trade URL), then update the
                // current slot row with the latest probe info.
                nextPerSlot = { ...basePerSlot };
                for (const [name, row] of Object.entries(basePerSlot)) {
                  if (name !== slotName && row.status === 'running') {
                    nextPerSlot[name] = { ...row, status: 'done' };
                  }
                }
                const existing = basePerSlot[slotName];
                nextPerSlot[slotName] = {
                  slot: slotName,
                  status: 'running',
                  maxProbes: existing?.maxProbes ?? data.maxIterations ?? 8,
                  currentProbe: (data.iteration ?? 0) + 1,
                  ...(data.resultCount != null ? { latestResultCount: data.resultCount } : {}),
                  ...(data.currentFilters?.minPrice != null ? { latestMinPrice: data.currentFilters.minPrice } : {}),
                  ...(data.tradeUrl ? { tradeUrl: data.tradeUrl } : existing?.tradeUrl ? { tradeUrl: existing.tradeUrl } : {}),
                  ...(data.statusText ? { statusText: data.statusText } : {}),
                  ...(existing?.budget ? { budget: existing.budget } : data.currentFilters?.budget != null
                    ? { budget: { max: data.currentFilters.budget, currency: data.currentFilters.currency ?? 'chaos' } }
                    : {}),
                };
              }
              return {
                ...prev,
                state: 'running' as const,
                startedAt: prev?.startedAt ?? Date.now(),
                perSlot: nextPerSlot,
                ...(slotName ? { currentSlotName: slotName } : {}),
                // Legacy flat fields for backward compat with old cards
                currentIteration: data.iteration,
                totalIterations: data.maxIterations,
                currentFilters: data.currentFilters,
                slot: slotName ?? prev?.slot,
                budget: data.currentFilters?.budget != null
                  ? { max: data.currentFilters.budget, currency: data.currentFilters.currency ?? 'chaos' }
                  : prev?.budget,
                iteration: data.iteration,
                maxIterations: data.maxIterations,
                resultCount: data.resultCount,
                statusText: data.statusText,
                tradeUrl: data.tradeUrl,
              };
            });
            break;
          }

          case 'complete':
            // Clear status message on stream completion
            setStreamingStatus(null);

            // Flush final parts to pathway message (covers streams ending with tool_result)
            if (currentActivePathway) {
              updateLastPathwayMessageParts(currentActivePathway, [...currentParts], streamedContent);
            }

            setActiveTools(new Map());
            setLiveTradeSearch(null);

            // Update session data if provided
            if (event.data?.sessionKBModuleIds) {
              setSessionKBModuleIds(event.data.sessionKBModuleIds);
            }
            if (event.data?.sessionStatSubset) {
              setSessionStatSubset(event.data.sessionStatSubset);
            }
            if (Array.isArray(event.data?.suggestedQuestions)) {
              setSuggestedQuestions(event.data.suggestedQuestions);
              setStoreSuggestedQuestions(event.data.suggestedQuestions);
            }
            if (Array.isArray(event.data?.leagueQuestions)) {
              setLeagueQuestions(event.data.leagueQuestions);
            }
            if (Array.isArray(event.data?.topActions)) {
              setTopActions(event.data.topActions);
            }
            if (Array.isArray(event.data?.pathwayPriorityOrder)) {
              setPathwayPriorityOrder(event.data.pathwayPriorityOrder);
            }

            // If we have a local trade result, use it
            if (tradeResult && tradeResult.success) {
              // Update message with trade result
              // The message content already has the LLM response
              // We would attach toolResult here for card rendering
            }

            // If we have a pobCode result, store it for the current message
            const currentMsgId = currentAssistantMessageIdRef.current;
            if (pobCodeResult && currentMsgId) {
              const finalPobCode: PoBCodeData = pobCodeResult;
              setMessagePobCodes(prev => {
                const updated = new Map(prev);
                updated.set(currentMsgId, finalPobCode);
                return updated;
              });
            }
            currentAssistantMessageIdRef.current = null;

            // Phase 3: Persist follow-up chat to analysis history snapshot
            {
              const histStore = useAnalysisHistoryStore.getState();
              const activeSnapId = histStore.activeSnapshotId;
              if (activeSnapId) {
                histStore.upsertSnapshot(activeSnapId, {
                  pathwayHistories: useDesktopStore.getState().pathwayHistories,
                });
              }
            }
            break;

          case 'token_usage_interim':
          case 'token_usage':
            // Add token usage to the store
            useTokenStore.getState().addTokenUsage(event.data);
            break;

          case 'credit_deduction':
            useTokenStore.getState().applyCreditDeduction(
              event.data.creditsDeducted,
              event.data.creditsRemaining,
            );
            break;

          case 'llm_context_debug':
            if (import.meta.env.DEV) {
              useDesktopStore.getState().setContextDebugData(event.data);
            }
            break;

          case 'llm_call_debug':
            if (import.meta.env.DEV) {
              useDesktopStore.getState().appendLlmCallDebug(event.data);
            }
            break;

          case 'keepalive':
            // Connection health indicator — consumed by SSE client watchdog
            break;

          case 'error':
            setActiveTools(new Map());
            setError(event.error);
            setErrorCode((event as Record<string, unknown>).code as string || null);
            if ((event as Record<string, unknown>).code === 'INSUFFICIENT_CREDITS') {
              toast.error('Insufficient credits', {
                description: 'You need more credits to continue. Visit your account to purchase more.',
              });
            } else if ((event as Record<string, unknown>).code === 'CREDIT_OVERDRAFT') {
              toast.error('Credit limit reached', {
                description: 'Analysis was stopped because your balance exceeded the overdraft limit.',
              });
            } else if ((event as Record<string, unknown>).code === 'SESSION_EXPIRED') {
              toast.error('Session expired', {
                description: 'Please sign out and sign back in, then try again.',
              });
            } else {
              toast.error('Stream error', { description: event.error });
            }
            updateLastPathwayMessage(currentActivePathway, `Error: ${event.error}`);
            break;
        }
      },
      onError: (err) => {
        setActiveTools(new Map());
        setError(err.message);
        toast.error('Connection failed', { description: err.message });
      },
    };

    try {
      console.log('[useDesktopChat] Calling sendChatMessageStream with pathway=%s, buildId=%s', currentActivePathway, buildId);
      await sendChatMessageStream(payload, sseOptions, abortController.signal);
      console.log('[useDesktopChat] sendChatMessageStream completed successfully');
    } catch (err) {
      console.error('[useDesktopChat] sendChatMessageStream error:', err);
      if (abortController.signal.aborted) return;
      const errorMsg = err instanceof Error ? err.message : 'Stream failed';
      setError(errorMsg);
      updateLastPathwayMessage(currentActivePathway, `The spirits are distant: ${errorMsg}`);
    } finally {
      pathwayChatAbortRef.current = null;
      setIsSending(false);
    }
  }, [
    buildId,
    currentBuild,
    activePathway,
    sessionKBModuleIds,
    sessionStatSubset,
    analysisConfig,
    addPathwayMessage,
    updateLastPathwayMessage,
    updateLastPathwayMessageParts,
    handleTradeSearchInstruction,
  ]);

  /**
   * Cancel all active streams (for Escape key).
   * Cancels initial analysis and pathway chat streams.
   */
  const cancelAllStreams = useCallback(() => {
    // Cancel initial analysis stream
    if (initialAnalysisAbortRef.current) {
      initialAnalysisAbortRef.current.abort();
      initialAnalysisAbortRef.current = null;
      setIsGeneratingInitialAnalysis(false);
      // Mark any running tool_call parts as cancelled, then append cancellation text
      setAnalysisMessageParts(prev => [
        ...prev.map(p =>
          p.type === 'tool_call' && p.status === 'running'
            ? { ...p, status: 'cancelled' as const }
            : p
        ),
        { type: 'text', content: '\n\n*Cancelled by user.*' },
      ]);
      setStreamingContent(prev => prev + '\n\n*Cancelled by user.*');
    }

    // Cancel pathway chat stream and mark running tools as cancelled in pathway message parts
    if (pathwayChatAbortRef.current) {
      pathwayChatAbortRef.current.abort();
      pathwayChatAbortRef.current = null;

      // Mark running tools as cancelled in the current pathway message
      const currentPathway = useDesktopStore.getState().activePathway;
      if (currentPathway) {
        const pathwayMessages = useDesktopStore.getState().pathwayHistories[currentPathway];
        const lastMsg = pathwayMessages[pathwayMessages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.parts) {
          const updatedParts = lastMsg.parts.map((p: import('../../../shared/types/Chat').MessagePart) =>
            p.type === 'tool_call' && p.status === 'running'
              ? { ...p, status: 'cancelled' as const }
              : p
          );
          // Append cancellation text
          updatedParts.push({ type: 'text', content: '\n\n*Cancelled by user.*' });
          useDesktopStore.getState().updateLastPathwayMessageParts(
            currentPathway,
            updatedParts,
            lastMsg.content + '\n\n*Cancelled by user.*'
          );
        }
      }
    }
    setIsSending(false);
    setActiveTools(new Map());
  }, []);

  /**
   * Retry initial analysis after a failure.
   * Directly calls generateInitialAnalysis since ref/state changes don't trigger useEffect.
   */
  const retryInitialAnalysis = useCallback(() => {
    if (buildId && currentBuild) {
      // Reset state for a clean retry
      initialAnalysisTriggeredRef.current = buildId;
      setError(null);
      setErrorCode(null);
      // Directly call generateInitialAnalysis - don't rely on useEffect
      generateInitialAnalysis();
    }
  }, [buildId, currentBuild, generateInitialAnalysis]);

  // Phase 2b: Save snapshot on app close / component unmount during active analysis
  useEffect(() => {
    const saveOnClose = () => {
      if (!isGeneratingInitialAnalysis) return;
      const histStore = useAnalysisHistoryStore.getState();
      const activeSnapId = histStore.activeSnapshotId;
      const storeState = useDesktopStore.getState();
      const snapshotMeta = getSnapshotAnalysisState();

      if (activeSnapId) {
        // Update existing streaming snapshot to 'interrupted'
        histStore.upsertSnapshot(activeSnapId, {
          focus: snapshotMeta.focus,
          customPrompt: snapshotMeta.customPrompt,
          label: `${snapshotMeta.label} (partial)`,
          status: 'interrupted',
          isPartial: true,
          pathwayHistories: storeState.pathwayHistories,
          vizData: storeState.vizData,
          pathwayCards: storeState.pathwayCards,
          generalAssessment: storeState.generalAssessment,
          buildRatings: storeState.buildRatings,
          gearSlotRatings: storeState.gearSlotRatings,
          seerContext: storeState.seerContext,
          topActions: storeState.topActions,
          pathwayPriorityOrder: storeState.pathwayPriorityOrder,
        });
      } else if (storeState.currentBuild?.pobCode) {
        // No snapshot yet but analysis was running — create an interrupted snapshot
        const completedPws = storeState.completedPathways;
        if (completedPws.length > 0) {
          const pwContent: Record<string, string> = {};
          for (const pw of completedPws) {
            const msgs = storeState.pathwayHistories[pw];
            if (msgs.length > 0) {
              pwContent[pw] = msgs[msgs.length - 1].content;
            }
          }
          histStore.saveSnapshot({
            build: {
              characterName: storeState.currentBuild.characterName,
              class: storeState.currentBuild.class,
              ascendancy: storeState.currentBuild.ascendancy || storeState.currentBuild.class,
              level: storeState.currentBuild.level,
              pobCode: storeState.currentBuild.pobCode,
            },
            focus: snapshotMeta.focus,
            customPrompt: snapshotMeta.customPrompt,
            label: `${snapshotMeta.label} (partial)`,
            pathwayContent: pwContent,
            isPartial: true,
            completedPathways: [...completedPws],
            status: 'interrupted',
            pathwayHistories: storeState.pathwayHistories,
            vizData: storeState.vizData,
            pathwayCards: storeState.pathwayCards,
            generalAssessment: storeState.generalAssessment,
            buildRatings: storeState.buildRatings,
            gearSlotRatings: storeState.gearSlotRatings,
            seerContext: storeState.seerContext,
            topActions: storeState.topActions,
            pathwayPriorityOrder: storeState.pathwayPriorityOrder,
          });
        }
      }
    };

    window.addEventListener('beforeunload', saveOnClose);

    // Tauri-specific: listen for window close request
    let unlisten: (() => void) | undefined;
    const tauriEvent = (window as unknown as Record<string, unknown>).__TAURI__ as
      | { event?: { listen: (event: string, handler: () => void) => Promise<() => void> } }
      | undefined;
    if (tauriEvent?.event?.listen) {
      tauriEvent.event.listen('tauri://close-requested', saveOnClose).then(fn => {
        unlisten = fn;
      });
    }

    return () => {
      window.removeEventListener('beforeunload', saveOnClose);
      unlisten?.();
    };
  }, [getSnapshotAnalysisState, isGeneratingInitialAnalysis]);

  return {
    messages,
    sendMessage,
    isSending,
    isGeneratingInitialAnalysis,
    error,
    errorCode,
    seerContext,
    // Return local state first, fallback to store for persistence across mode switches
    suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : (storeSuggestedQuestions || []),
    leagueQuestions,
    activeTools,
    liveTradeSearch,
    sessionKBModuleIds,
    sessionStatSubset,
    generalAssessment,
    pathwayCards,
    activePathway,
    // Analysis stream state
    streamingContent,
    // Error recovery
    retryInitialAnalysis,
    // Initial analysis with custom prompt
    startAnalysis: generateInitialAnalysis,
    // Initial analysis message parts (tool calls, reasoning, content)
    analysisMessageParts,
    // Cancel initial analysis
    cancelInitialAnalysis,
    // Suggested actions
    suggestedActions,
    initialSuggestedActions,
    // Cancel all streaming
    cancelAllStreams,
    // Synthesis
    launchSynthesis,
    // Per-pathway streaming state
    streamingPathways,
    streamingContentByPathway,
    // Real-time status from backend (replaces "Thinking..." spinner text)
    streamingStatus,
    // Session ID for bug reports (shown in UI, user can copy for Discord)
    analysisSessionId,
  };
}

export default useDesktopChat;
