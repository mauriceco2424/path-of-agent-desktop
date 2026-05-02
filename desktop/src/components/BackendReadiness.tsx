/**
 * BackendReadiness Component - Backend Startup Loading Overlay
 *
 * Shown while the backend sidecar is starting up. Polls the health
 * endpoint and auto-dismisses when the backend is ready. Shows an
 * error state after a timeout.
 *
 * @module desktop/src/components/BackendReadiness
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import seerIcon from '@/assets/seer_icon.png';
import { cn } from '../lib/utils';
import { getConfig } from '../services/tauri-api';
import { pushSessionTokenToLocalBackend } from '../services/session-token';

// ============================================
// Constants
// ============================================

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 60_000;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';

// ============================================
// Types
// ============================================

type ReadinessPhase = 'starting' | 'initializing' | 'ready' | 'error';

interface PhaseConfig {
  label: string;
  sublabel: string;
}

const PHASE_CONFIGS: Record<ReadinessPhase, PhaseConfig> = {
  starting: {
    label: 'Starting backend...',
    sublabel: 'Launching the analysis engine',
  },
  initializing: {
    label: 'Initializing PoB engine...',
    sublabel: 'Loading game data and passive tree',
  },
  ready: {
    label: 'Ready!',
    sublabel: 'Let\'s optimize your build',
  },
  error: {
    label: 'Failed to start',
    sublabel: 'The backend did not respond within 60 seconds',
  },
};

// ============================================
// Props
// ============================================

interface BackendReadinessProps {
  /** Called when the backend health check succeeds */
  onReady: () => void;
}

// ============================================
// Component
// ============================================

export function BackendReadiness({ onReady }: BackendReadinessProps) {
  const [phase, setPhase] = useState<ReadinessPhase>('starting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(Date.now());
  const readyCalledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    readyCalledRef.current = false;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          cleanup();
          setPhase('ready');

          // Re-push stored session token to sidecar now that it's healthy.
          // Fixes race where login completes before sidecar is ready,
          // causing the initial token push from AuthScreen to fail.
          try {
            const config = await getConfig();
            const token = (config as unknown as Record<string, unknown>).sessionToken as string | undefined;
            if (token) {
              await pushSessionTokenToLocalBackend(token, AbortSignal.timeout(5000));
              console.log('[BackendReadiness] Session token pushed to sidecar');
            }
          } catch (err) {
            console.warn('[BackendReadiness] Failed to push session token to sidecar:', err);
          }

          // Brief delay to show the "Ready!" state before dismissing
          if (!readyCalledRef.current) {
            readyCalledRef.current = true;
            setTimeout(onReady, 600);
          }
        }
      } catch {
        // Backend not ready yet - update phase based on elapsed time
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed > 5000) {
          setPhase('initializing');
        }
      }
    };

    // Start polling
    void checkHealth();
    pollRef.current = setInterval(() => void checkHealth(), POLL_INTERVAL_MS);

    // Timeout after 60 seconds
    timeoutRef.current = setTimeout(() => {
      cleanup();
      setPhase('error');
    }, TIMEOUT_MS);

    return cleanup;
  }, [onReady, cleanup]);

  const handleRetry = useCallback(() => {
    setPhase('starting');
    startTimeRef.current = Date.now();
    readyCalledRef.current = false;
    window.location.reload();
  }, []);

  const config = PHASE_CONFIGS[phase];
  const isError = phase === 'error';
  const isReady = phase === 'ready';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#06060b]">
        <div
          className="absolute inset-0"
          style={{
            background: [
              'radial-gradient(ellipse 60% 40% at 50% -5%, rgba(251, 191, 36, 0.06) 0%, transparent 70%)',
              'radial-gradient(ellipse 80% 50% at 50% 110%, rgba(251, 191, 36, 0.03) 0%, transparent 60%)',
            ].join(', '),
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        {/* Animated Flame */}
        <div className="relative mb-8">
          {isError ? (
            <AlertTriangle className="w-12 h-12 text-red-400" />
          ) : (
            <>
              <img
                src={seerIcon}
                alt="Path of Agent"
                className={cn(
                  'w-12 h-12 rounded-full transition-all duration-500',
                  isReady ? 'scale-110' : 'animate-pulse'
                )}
              />
              {/* Glow ring */}
              <div
                className={cn(
                  'absolute -inset-3 rounded-full transition-all duration-700',
                  isReady
                    ? 'bg-cyan-500/15 blur-xl scale-125'
                    : 'bg-cyan-500/10 blur-lg animate-pulse'
                )}
              />
              {/* Spinning ring indicator */}
              {!isReady && (
                <svg
                  className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] animate-spin"
                  style={{ animationDuration: '3s' }}
                  viewBox="0 0 80 80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="rgba(251, 191, 36, 0.15)"
                    strokeWidth="1"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="rgba(251, 191, 36, 0.5)"
                    strokeWidth="1.5"
                    strokeDasharray="40 190"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </>
          )}
        </div>

        {/* Status Text */}
        <h2
          className={cn(
            'text-lg font-display font-semibold mb-1.5 transition-colors duration-300',
            isError ? 'text-red-400' : isReady ? 'text-amber-300' : 'text-slate-200'
          )}
        >
          {config.label}
        </h2>
        <p className="text-sm text-slate-500 text-center max-w-xs">
          {config.sublabel}
        </p>

        {/* Error Actions */}
        {isError && (
          <button
            onClick={handleRetry}
            className={cn(
              'mt-6 px-6 py-2.5 rounded-lg',
              'bg-slate-800/60 border border-slate-700/50',
              'text-sm text-slate-300 hover:text-amber-300',
              'hover:border-amber-500/30 hover:bg-slate-800/80',
              'transition-all duration-200'
            )}
          >
            Retry
          </button>
        )}

        {/* Progress dots */}
        {!isError && !isReady && (
          <div className="flex items-center gap-1.5 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-pulse"
                style={{ animationDelay: `${i * 300}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
