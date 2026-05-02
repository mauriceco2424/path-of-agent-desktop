/**
 * SSE event types for the visualization-stream endpoint.
 * Provides real-time progress updates during build visualization loading.
 */

export type VizStepName =
  | 'loading_build'
  | 'detecting_config'
  | 'calculating_stats';

export interface VizStepEvent {
  type: 'viz_step';
  step: VizStepName;
  label: string;
  status: 'started' | 'completed' | 'skipped' | 'error';
  /** Milliseconds elapsed for this step (only on completed) */
  durationMs?: number;
  /** Error message (only on error status) */
  error?: string;
}

export interface VizCompleteEvent {
  type: 'viz_complete';
  /** Full BuildVisualizationResponse payload (same shape as GET /visualization) */
  data: Record<string, unknown>;
}

export interface VizErrorEvent {
  type: 'viz_error';
  error: string;
  code?: string;
}

export type VizStreamEvent =
  | VizStepEvent
  | VizCompleteEvent
  | VizErrorEvent
  | { type: 'keepalive' }
  | { type: 'llm_context_debug'; data: import('./Chat.js').LLMContextDebugData }
  | { type: 'llm_call_debug'; data: import('./Chat.js').LLMCallDebugData };
