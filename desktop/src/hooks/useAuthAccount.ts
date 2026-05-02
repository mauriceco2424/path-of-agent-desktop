/**
 * useAuthAccount Hook
 *
 * Fetches authentication status and credit balance on mount.
 * Seeds the Zustand token store with the initial credit balance
 * so the UI can display remaining credits from the first render.
 *
 * Flow:
 * 1. Check auth status via Tauri IPC (`get_auth_status`)
 * 2. If authenticated, retrieve session token via `get_config`
 * 3. Fetch account overview from REMOTE server (`GET /api/v1/auth/account`)
 * 4. Seed token store with `billing.creditBalance`
 *
 * Note: The account/credits endpoint lives on the remote server
 * (api.pathofagent.com), not the local desktop backend. The local
 * backend (app-desktop.ts) has no auth routes.
 *
 * Browser fallback:
 * When running outside Tauri (web dev mode), the hook returns
 * an unauthenticated state without attempting IPC calls.
 */

import { useState, useEffect, useRef } from 'react';
import { useTokenStore } from '../store/tokenSlice';

// ============================================
// Type Definitions
// ============================================

/** Auth status response from the Tauri `get_auth_status` command */
interface AuthStatusResponse {
  isAuthenticated: boolean;
  accountName: string | null;
  expiresAt: string | null;
}

/** Desktop app config returned by the Tauri `get_config` command.
 *  Field names are camelCase because the Rust struct uses `#[serde(rename_all = "camelCase")]`. */
interface DesktopAppConfig {
  backendUrl: string;
  preferredLeague: string | null;
  autoUpdate: boolean;
  theme: string;
  sessionToken: string | null;
}

/** Account overview response from `GET /api/v1/auth/account` (remote server) */
interface AccountOverview {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  billing: {
    creditBalance: number;
    checkoutEnabled: boolean;
  };
  features: {
    billingCheckout: boolean;
  };
}

/** Public state returned by the hook */
export interface AuthAccountState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accountName: string | null;
  email: string | null;
  creditBalance: number | null;
  billingEnabled: boolean;
  error: string | null;
}

// ============================================
// Constants
// ============================================

const INITIAL_STATE: AuthAccountState = {
  isAuthenticated: false,
  isLoading: true,
  accountName: null,
  email: null,
  creditBalance: null,
  billingEnabled: false,
  error: null,
};

// ============================================
// Environment Detection
// ============================================

/**
 * Check if running inside a Tauri environment.
 * Duplicated from tauri-api.ts because that module's `isTauri` is not exported.
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

// ============================================
// Tauri Invoke Helper
// ============================================

/**
 * Dynamically import and invoke a Tauri command.
 * Mirrors the pattern used in `tauri-api.ts` without re-exporting internals.
 */
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Fetch auth status and credit balance on mount.
 *
 * - In Tauri mode: calls `get_auth_status` -> `get_config` -> remote server account endpoint
 * - In browser mode: returns unauthenticated state immediately
 * - Uses a ref guard to prevent double-fetch in React StrictMode
 */
export function useAuthAccount(): AuthAccountState {
  const [state, setState] = useState<AuthAccountState>(INITIAL_STATE);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Prevent double-fetch in StrictMode
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Browser fallback: no Tauri IPC available
    if (!isTauriEnvironment()) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    let cancelled = false;

    async function fetchAuthAndCredits(): Promise<void> {
      try {
        const authStatus = await tauriInvoke<AuthStatusResponse>('get_auth_status');

        if (cancelled) return;

        if (!authStatus.isAuthenticated) {
          setState({
            isAuthenticated: false,
            isLoading: false,
            accountName: null,
            email: null,
            creditBalance: null,
            billingEnabled: false,
            error: null,
          });
          return;
        }

        const config = await tauriInvoke<DesktopAppConfig>('get_config');

        if (cancelled) return;

        const sessionToken = config.sessionToken;
        if (!sessionToken) {
          // Authenticated but no token stored -- unusual but not fatal
          setState({
            isAuthenticated: true,
            isLoading: false,
            accountName: authStatus.accountName,
            email: null,
            creditBalance: null,
            billingEnabled: false,
            error: null,
          });
          return;
        }

        // Step 3: Fetch account overview from REMOTE server
        // Auth/credits live on api.pathofagent.com, not the local desktop backend
        const REMOTE_API_URL =
          import.meta.env.VITE_REMOTE_API_URL || 'https://api.pathofagent.com';

        const httpFetch = isTauriEnvironment()
          ? ((await import('@tauri-apps/plugin-http')).fetch as unknown as typeof globalThis.fetch)
          : globalThis.fetch;

        const resp = await httpFetch(`${REMOTE_API_URL}/api/v1/auth/account`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'X-Client-Type': 'desktop',
          },
        });

        if (!resp.ok) {
          throw new Error(`Account fetch failed (${resp.status})`);
        }

        const account = (await resp.json()) as AccountOverview;

        if (cancelled) return;

        // Step 4: Seed token store with credit balance
        const balance = account.billing.creditBalance;
        useTokenStore.getState().setCreditBalance(balance);

        setState({
          isAuthenticated: true,
          isLoading: false,
          accountName: account.user.displayName || authStatus.accountName,
          email: account.user.email,
          creditBalance: balance,
          billingEnabled: account.features.billingCheckout,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error ? err.message : String(err);

        console.warn('[useAuthAccount] FAILED at some step:', message);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
    }

    fetchAuthAndCredits();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
