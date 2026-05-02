/**
 * Error Telemetry Service
 *
 * Lightweight, fire-and-forget error reporting from the frontend to the local sidecar,
 * which forwards to the production server. Never impacts user experience.
 *
 * Rate-limited: max 10 reports/minute, deduplicates same message within 30s.
 */

import type { ErrorCategory, ErrorReport } from '../../../shared/types/ErrorTelemetry';

const SIDECAR_URL = 'http://127.0.0.1:9876/api/v1/telemetry/errors';
const MAX_PER_MINUTE = 10;
const DEDUP_WINDOW_MS = 30_000;

let reportCount = 0;
let windowStart = Date.now();
const recentMessages = new Map<string, number>(); // message → timestamp

/**
 * Report an error to the telemetry system.
 * Fire-and-forget — never throws, never blocks UI.
 */
export function reportError(
  category: ErrorCategory,
  message: string,
  context?: ErrorReport['context'],
): void {
  try {
    const now = Date.now();

    // Reset rate limit window every minute
    if (now - windowStart > 60_000) {
      reportCount = 0;
      windowStart = now;
    }

    // Rate limit
    if (reportCount >= MAX_PER_MINUTE) return;

    // Dedup: skip if same message was reported within 30s
    const truncated = message.slice(0, 500);
    const dedupKey = `${category}:${truncated}`;
    const lastSent = recentMessages.get(dedupKey);
    if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return;

    reportCount++;
    recentMessages.set(dedupKey, now);

    // Clean old dedup entries periodically
    if (recentMessages.size > 50) {
      for (const [key, ts] of recentMessages) {
        if (now - ts > DEDUP_WINDOW_MS) recentMessages.delete(key);
      }
    }

    const report: ErrorReport = {
      category,
      message: truncated,
      source: 'frontend',
      context,
      timestamp: new Date().toISOString(),
    };

    fetch(SIDECAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(3000),
    }).catch(() => { /* best-effort */ });
  } catch {
    // Never throw from telemetry
  }
}
