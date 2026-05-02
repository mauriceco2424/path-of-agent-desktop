/**
 * Error Telemetry Types
 *
 * Lightweight error reporting from desktop apps to the production server.
 * All fields are designed to be safe (no PII, no build XML, no secrets).
 */

export type ErrorCategory =
  | 'sse_timeout'       // SSE watchdog fired (no response for 45s)
  | 'sse_parse_error'   // Failed to parse SSE event JSON
  | 'connection_error'  // Failed to connect to local sidecar or SSE stream
  | 'pob_failure'       // PoB API call failed (load, tool, etc.)
  | 'analysis_error'    // LangChain agent / analysis stream error
  | 'synthesis_error'   // Synthesis step failed
  | 'credit_error'      // Credit check/deduction issue
  | 'import_error'      // Build import failed
  | 'import_event'      // GGG account import attempted (success or failure, for debugging)
  | 'unknown';          // Catch-all

export interface ErrorReport {
  /** Error category for filtering/grouping */
  category: ErrorCategory;
  /** Error message (truncated to 500 chars, no stack traces) */
  message: string;
  /** Where the error originated */
  source: 'frontend' | 'sidecar';
  /** Optional context — all fields optional */
  context?: {
    pathway?: string;
    buildId?: string;
    tool?: string;
    httpStatus?: number;
    /** GGG account name (e.g., "lil_Morris#4889") — for import_event tracking */
    accountName?: string;
    /** Import outcome: success, private_profile, not_found, rate_limited, error */
    outcome?: string;
    /** Number of characters returned (for character list fetches) */
    characterCount?: number;
    /** Character name imported */
    characterName?: string;
    /** Game realm (pc, xbox, sony) */
    realm?: string;
  };
  /** App version from package.json */
  appVersion?: string;
  /** Client-side timestamp */
  timestamp: string;
}
