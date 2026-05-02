/**
 * SSE Client Service
 *
 * Handles Server-Sent Events connection to the backend chat endpoint.
 * Unlike the web frontend which uses fetch + ReadableStream directly,
 * the desktop app can use this service for a cleaner abstraction.
 *
 * Features:
 * - POST + SSE streaming (standard EventSource only supports GET)
 * - Automatic reconnection handling
 * - Type-safe event parsing
 * - Error handling and recovery
 */

import type {
  ChatRequest,
  StreamingChatEvent,
} from '../../../shared/types/Chat';
import { reportError } from './error-telemetry';
import { useDesktopStore } from '../store';

// ============================================
// Type Definitions
// ============================================

/**
 * SSE event handler callback
 */
export type SSEEventHandler = (event: StreamingChatEvent) => void;

/**
 * SSE connection options
 */
export interface SSEConnectionOptions {
  /** Callback for each event */
  onEvent: SSEEventHandler;
  /** Callback when connection opens */
  onOpen?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback when stream closes normally */
  onClose?: () => void;
}

/**
 * SSE connection state
 */
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// ============================================
// Constants
// ============================================

/** Default backend base URL - can be overridden via VITE_BACKEND_URL env var */
const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';

/** SSE request timeout in milliseconds (3 minutes for long operations) */
const SSE_TIMEOUT_MS = 180000;

/** Rolling watchdog for SSE streams — resets on every event (including keepalive).
 *  If no event arrives within this window, the connection is considered dead.
 *
 *  Set to 120s (was 45s). 45s was too tight under real user conditions where PoE
 *  or other games run alongside the app and starve the Tauri webview + PoB sidecar
 *  of CPU. Under contention, backend keepalive writes queue in TCP send buffers and
 *  arrive delayed, and the webview process decodes them slowly. With backend keepalive
 *  at 5s, 120s = 24 keepalive attempts per window — 23 can be dropped/delayed before
 *  the watchdog fires. This gives ~8x more headroom without weakening dead-connection
 *  detection for normal scenarios (idle typing still pings every 5s). */
const SSE_WATCHDOG_MS = 120_000;

// ============================================
// SSE Client Implementation
// ============================================

/**
 * Send a chat message with SSE streaming support.
 *
 * Uses fetch with ReadableStream to handle POST + SSE since standard
 * EventSource only supports GET requests.
 *
 * @param payload - The chat request payload
 * @param options - SSE connection options
 * @returns Promise that resolves when stream completes or rejects on error
 */
export async function sendChatMessageStream(
  payload: ChatRequest,
  options: SSEConnectionOptions,
  externalSignal?: AbortSignal
): Promise<void> {
  const { onEvent, onOpen, onError, onClose } = options;

  // Get backend URL
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/api/v1/chat/stream`;

  // Create abort controller with rolling watchdog, link to external signal if provided
  const controller = new AbortController();
  let watchdogFired = false;
  let watchdogId: ReturnType<typeof setTimeout> | undefined;
  const resetWatchdog = () => {
    clearTimeout(watchdogId);
    watchdogId = setTimeout(() => { watchdogFired = true; controller.abort(); }, SSE_WATCHDOG_MS);
  };
  resetWatchdog();

  // If external signal aborts, abort our controller too
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    onOpen?.();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SSE request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process all complete SSE messages in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          // SSE format: "data: {json}\n"
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove "data: " prefix

            try {
              const event = JSON.parse(jsonStr) as StreamingChatEvent;
              resetWatchdog();
              if (event.type === 'keepalive') continue;
              onEvent(event);

              // Stop only on complete. Error events can be recoverable and
              // the backend may continue streaming additional events.
              if (event.type === 'complete') {
                clearTimeout(watchdogId);
                onClose?.();
                return;
              }
            } catch (parseError) {
              console.error('[SSE] Failed to parse event:', jsonStr, parseError);
              reportError('sse_parse_error', `Failed to parse SSE event: ${String(parseError)}`);
              // Propagate parse errors to the error handler so UI can respond appropriately
              // This handles cases like HTML error pages or malformed SSE data
              onError?.(new Error(`Failed to parse SSE event: ${String(parseError)}`));
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    clearTimeout(watchdogId);
    onClose?.();
  } catch (error) {
    clearTimeout(watchdogId);

    const err = error instanceof Error ? error : new Error(String(error));

    // Check for abort — distinguish watchdog timeout from user/external abort
    if (err.name === 'AbortError') {
      if (watchdogFired) {
        const timeoutError = new Error('Connection lost — no response from server for 45 seconds');
        reportError('sse_timeout', timeoutError.message);
        onError?.(timeoutError);
        throw timeoutError;
      }
      onClose?.();
      return;
    }

    onError?.(err);
    throw err;
  }
}

// ============================================
// Analyze Stream (Unified Analysis with LangChain Agent)
// ============================================

export interface AnalyzeStreamPayload {
  buildId: string;
  pathways: Array<'gear' | 'skills' | 'tree' | 'unified' | 'progression'>;
  /** Optimization focus — biases toward defensive or offensive improvements */
  optimizationFocus?: 'defensive' | 'balanced' | 'offensive';
  /** Optional user-authored prompt that should steer pathway analysis */
  customPrompt?: string;
  /** Enable jewel analysis in tree pathway (preflight menus, testing, cluster discovery). Default: false. */
  enableJewelAnalysis?: boolean;
  /** Pathway analysis results for cross-pathway synthesis (required when pathways includes 'synthesis') */
  pathwayResults?: { gear?: string; skills?: string; tree?: string };
  /** Whether the user consented to session data collection (logs uploaded to server for debugging) */
  sessionDataConsent?: boolean;
  /** Continuation context for interrupted pathways — lets the LLM resume without re-running completed tool calls */
  continuationContext?: Record<string, {
    /** Serialized preflight tool results */
    preflightSummary: string;
    /** Serialized completed agent tool calls and their stable model payloads */
    completedToolSummary: string;
    /** Partial LLM text output before interruption */
    partialContent: string;
    /** Whether preflight completed successfully before interruption */
    preflightCompleted: boolean;
  }>;
  /** GGG OAuth access token for stash API access (optional — enables stash tools when present) */
  gggAccessToken?: string;
}

/**
 * Send a unified analysis stream request via SSE.
 *
 * Uses POST + ReadableStream to `/api/v1/chat/analyze-stream`.
 * This uses LangChain agents with reasoning and tool events visible.
 * Accepts an AbortSignal for cancellation support.
 */
export async function sendAnalyzeStream(
  payload: AnalyzeStreamPayload,
  options: SSEConnectionOptions,
  signal?: AbortSignal
): Promise<void> {
  const { onEvent, onOpen, onError, onClose } = options;

  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/api/v1/chat/analyze-stream`;

  const controller = new AbortController();
  let watchdogFired = false;
  let watchdogId: ReturnType<typeof setTimeout> | undefined;
  const resetWatchdog = () => {
    clearTimeout(watchdogId);
    watchdogId = setTimeout(() => { watchdogFired = true; controller.abort(); }, SSE_WATCHDOG_MS);
  };
  resetWatchdog();

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    onOpen?.();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SSE request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr) as StreamingChatEvent;
              resetWatchdog();
              if (event.type === 'keepalive') continue;
              onEvent(event);
              if (event.type === 'complete') {
                clearTimeout(watchdogId);
                onClose?.();
                return;
              }
            } catch (parseError) {
              console.error('[SSE/Analyze] Failed to parse event:', jsonStr, parseError);
              reportError('sse_parse_error', `Failed to parse analyze SSE event: ${String(parseError)}`);
              onError?.(new Error(`Failed to parse SSE event: ${String(parseError)}`));
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    clearTimeout(watchdogId);
    onClose?.();
  } catch (error) {
    clearTimeout(watchdogId);
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'AbortError') {
      if (watchdogFired) {
        const timeoutError = new Error('Connection lost — no response from server for 45 seconds');
        reportError('sse_timeout', timeoutError.message);
        onError?.(timeoutError);
        throw timeoutError;
      }
      onClose?.();
      return;
    }
    onError?.(err);
    throw err;
  }
}

// ============================================
// Ladder Data Fetch Stream
// ============================================

import type {
  LadderFetchProgressEvent,
  LadderFetchStatsEvent,
  LadderFetchCompleteEvent,
  LadderFetchEvent,
} from '../../../shared/types/LadderData';

import type { VizStepEvent, VizStreamEvent } from '../../../shared/types/VisualizationStream';
import type { BuildVisualizationResponse } from '../store';

/** Timeout for ladder fetch SSE (10 minutes - fetching builds is slow due to GGG rate limits) */
const LADDER_FETCH_TIMEOUT_MS = 600000;

/**
 * Fetch ladder data via SSE streaming.
 *
 * POSTs to `/api/v1/builds/:buildId/ladder-fetch` and reads SSE events
 * for progress updates, stats, completion, and errors.
 *
 * @param buildId - The build ID to fetch ladder data for
 * @param targetCount - Number of builds to fetch (10, 20, 30, 50, or 100)
 * @param onProgress - Callback for progress events
 * @param onStats - Callback for stats events (intermediate results)
 * @param onComplete - Callback for completion event
 * @param onError - Callback for error messages
 * @param signal - Optional AbortSignal for cancellation
 */
export async function fetchLadderDataStream(
  buildId: string,
  targetCount: 10 | 20 | 30 | 50 | 100,
  onProgress: (event: LadderFetchProgressEvent) => void,
  onStats: (event: LadderFetchStatsEvent) => void,
  onComplete: (event: LadderFetchCompleteEvent) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
  freshFetch?: boolean,
  /** Fallback params when build not in sidecar memory */
  buildContext?: { skill?: string; ascendancy?: string; level?: number },
): Promise<void> {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/api/v1/builds/${buildId}/ladder-fetch`;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, LADDER_FETCH_TIMEOUT_MS);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetCount,
        ...(freshFetch ? { freshFetch: true } : {}),
        ...(buildContext?.skill ? { skill: buildContext.skill } : {}),
        ...(buildContext?.ascendancy ? { ascendancy: buildContext.ascendancy } : {}),
        ...(buildContext?.level ? { level: buildContext.level } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ladder fetch failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr) as LadderFetchEvent;

              switch (event.type) {
                case 'ladder_progress':
                  onProgress(event);
                  break;
                case 'ladder_stats':
                  onStats(event);
                  break;
                case 'ladder_complete':
                  onComplete(event);
                  clearTimeout(timeoutId);
                  return;
                case 'ladder_error':
                  onError(event.message);
                  clearTimeout(timeoutId);
                  return;
              }
            } catch (parseError) {
              console.error('[SSE/LadderFetch] Failed to parse event:', jsonStr, parseError);
              onError('Unexpected response from server during ladder fetch.');
              clearTimeout(timeoutId);
              return;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Stream ended without ladder_complete or ladder_error event.
    // This happens if the backend crashes or connection drops mid-stream.
    clearTimeout(timeoutId);
    onError('Connection lost during ladder fetch. Try again.');
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'AbortError') {
      if (timedOut) {
        onError('Ladder fetch timed out. The GGG API may be slow — try again later.');
        return;
      }
      // Don't report user-initiated cancellation as an error
      return;
    }
    onError(err.message);
  }
}

// ============================================
// Visualization Stream (Build Loading Steps)
// ============================================

/** Timeout for visualization stream (60 seconds) */
const VIZ_STREAM_TIMEOUT_MS = 60_000;

/** Result of a visualization stream — either success with data, or error with message and HTTP status */
export type VizStreamResult =
  | { ok: true; data: BuildVisualizationResponse }
  | { ok: false; error: string; httpStatus?: number };

/**
 * Fetch build visualization data via SSE streaming.
 *
 * GETs `/api/v1/builds/:buildId/visualization-stream` and reads SSE events
 * for step progress, completion, and errors.
 *
 * Returns a structured result (never throws) so callers can handle
 * retry logic sequentially without async callback pitfalls.
 *
 * @param buildId - The build ID to fetch visualization for
 * @param onStep - Callback for step progress events (called synchronously)
 * @param signal - Optional AbortSignal for cancellation
 */
export async function fetchVisualizationStream(
  buildId: string,
  onStep: (event: VizStepEvent) => void,
  signal?: AbortSignal,
): Promise<VizStreamResult> {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/api/v1/builds/${buildId}/visualization-stream`;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, VIZ_STREAM_TIMEOUT_MS);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorText = await response.text();
      return { ok: false, error: errorText, httpStatus: response.status };
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      return { ok: false, error: 'Response body is null' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr) as VizStreamEvent;

              switch (event.type) {
                case 'viz_step':
                  onStep(event);
                  break;
                case 'viz_complete':
                  clearTimeout(timeoutId);
                  return { ok: true, data: event.data as unknown as BuildVisualizationResponse };
                case 'viz_error':
                  clearTimeout(timeoutId);
                  return { ok: false, error: event.error };
                case 'llm_context_debug':
                  useDesktopStore.getState().setContextDebugData(event.data);
                  break;
                case 'llm_call_debug':
                  useDesktopStore.getState().appendLlmCallDebug(event.data);
                  break;
                case 'keepalive':
                  break;
              }
            } catch (parseError) {
              console.error('[SSE/VizStream] Failed to parse event:', jsonStr, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    clearTimeout(timeoutId);
    return { ok: false, error: 'Stream ended without completion event' };
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'AbortError') {
      if (timedOut) {
        return { ok: false, error: 'Visualization loading timed out' };
      }
      // User-initiated cancellation — not an error
      return { ok: false, error: 'cancelled' };
    }
    return { ok: false, error: err.message };
  }
}

// ============================================
// General Chat Stream (Build-Independent PoE Knowledge Chat)
// ============================================

export interface GeneralChatStreamPayload {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  threadId?: string;
}

/**
 * Send a general chat message with SSE streaming support.
 *
 * Uses POST + ReadableStream to `/api/v1/chat/general-stream`.
 * Build-independent — no PoB, no build context, no analysis mutex.
 */
export async function sendGeneralChatStream(
  payload: GeneralChatStreamPayload,
  options: SSEConnectionOptions,
  externalSignal?: AbortSignal,
): Promise<void> {
  const { onEvent, onOpen, onError, onClose } = options;

  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/api/v1/chat/general-stream`;

  const controller = new AbortController();
  let watchdogFired = false;
  let watchdogId: ReturnType<typeof setTimeout> | undefined;
  const resetWatchdog = () => {
    clearTimeout(watchdogId);
    watchdogId = setTimeout(() => { watchdogFired = true; controller.abort(); }, SSE_WATCHDOG_MS);
  };
  resetWatchdog();

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    onOpen?.();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SSE request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event = JSON.parse(jsonStr) as StreamingChatEvent;
              resetWatchdog();
              if (event.type === 'keepalive') continue;
              onEvent(event);
              if (event.type === 'complete') {
                clearTimeout(watchdogId);
                onClose?.();
                return;
              }
            } catch (parseError) {
              console.error('[SSE/GeneralChat] Failed to parse event:', jsonStr, parseError);
              reportError('sse_parse_error', `Failed to parse general chat SSE event: ${String(parseError)}`);
              onError?.(new Error(`Failed to parse SSE event: ${String(parseError)}`));
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    clearTimeout(watchdogId);
    onClose?.();
  } catch (error) {
    clearTimeout(watchdogId);
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'AbortError') {
      if (watchdogFired) {
        const timeoutError = new Error('Connection lost — no response from server for 45 seconds');
        reportError('sse_timeout', timeoutError.message);
        onError?.(timeoutError);
        throw timeoutError;
      }
      onClose?.();
      return;
    }
    onError?.(err);
    throw err;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the backend URL.
 *
 * Uses VITE_BACKEND_URL env var or falls back to localhost for development.
 */
function getBackendUrl(): string {
  return DEFAULT_BACKEND_URL;
}

/**
 * Parse trade search instruction from SSE event.
 *
 * Used when the backend signals the desktop app to execute a trade search
 * from the user's IP instead of server-side.
 */
export function parseTradeSearchInstruction(
  event: StreamingChatEvent
): import('../../../shared/types/AffixSearch').AffixSearchRequest | null {
  if (event.type !== 'tool_start') {
    return null;
  }

  // Check if this is a trade search tool that desktop should handle
  const tradeTools = ['search_trade', 'search_trade_weighted'];
  if (!tradeTools.includes(event.tool)) {
    return null;
  }

  // Extract the search request from tool input
  const input = event.input as Record<string, unknown> | undefined;
  if (!input) {
    return null;
  }

  // Multi-slot backend-native trade search should not be intercepted by the
  // legacy desktop executor. Let the backend tool complete and stream its
  // richer slots[] result through the normal tool_result path.
  if (Array.isArray(input.searches)) {
    return null;
  }

  if (typeof input.slot !== 'string' || !Array.isArray(input.stats) || !input.budget) {
    return null;
  }

  // Convert tool input to AffixSearchRequest format
  return {
    slot: input.slot as string,
    stats: (input.stats as Array<{ id: string; min: number }>) || [],
    budget: input.budget as { max: number; currency: 'chaos' | 'divine' },
    constraints: input.constraints as Record<string, unknown> | undefined,
  };
}
