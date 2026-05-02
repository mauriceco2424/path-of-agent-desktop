/**
 * Desktop Auth API Client
 *
 * Calls the REMOTE server (api.pathofagent.com) for authentication.
 * Unlike the website auth client (which uses HttpOnly cookies), the desktop
 * client uses Bearer tokens stored in Tauri config and sends
 * X-Client-Type: desktop to receive the session token in the response body.
 *
 * In Tauri (production), uses @tauri-apps/plugin-http fetch which bypasses
 * WebView CSP restrictions on external domains. Falls back to global fetch
 * for web dev mode.
 */

const REMOTE_API_URL =
  import.meta.env.VITE_REMOTE_API_URL || 'https://api.pathofagent.com';

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

/** Lazily resolved Tauri HTTP fetch — avoids top-level dynamic import */
let tauriFetch: typeof globalThis.fetch | null = null;

async function getHttpFetch(): Promise<typeof globalThis.fetch> {
  if (!isTauri) return globalThis.fetch;
  if (tauriFetch) return tauriFetch;
  const { fetch: tFetch } = await import('@tauri-apps/plugin-http');
  tauriFetch = tFetch as unknown as typeof globalThis.fetch;
  return tauriFetch;
}

// ============================================
// Types
// ============================================

export class AuthApiError extends Error {
  code?: string;
  details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
    this.details = details;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  subscriptionStatus: string;
}

export interface SignInResponse {
  authenticated: true;
  user: SessionUser;
  csrfToken: string;
  expiresAt: string;
  idleExpiresAt: string;
  sessionToken: string; // Only returned for desktop clients
}

export interface AcceptedResponse {
  accepted: true;
  message: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
  csrfToken?: string;
  expiresAt?: string;
  idleExpiresAt?: string;
}

// ============================================
// Internal helpers
// ============================================

interface ApiErrorBody {
  message?: string;
  error?: string;
  details?: unknown;
}

async function readError(response: Response): Promise<AuthApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new AuthApiError(
      body.message || body.error || 'Request failed',
      body.error,
      body.details,
    );
  } catch {
    return new AuthApiError('Request failed');
  }
}

async function postJson<TResult>(
  path: string,
  body: object,
  headers?: Record<string, string>,
): Promise<TResult> {
  let httpFetch: typeof globalThis.fetch;
  try {
    httpFetch = await getHttpFetch();
    console.log('[auth-api] fetch resolved, isTauri:', isTauri, 'url:', `${REMOTE_API_URL}${path}`);
  } catch (err) {
    console.error('[auth-api] getHttpFetch failed:', err);
    throw err;
  }
  const response = await httpFetch(`${REMOTE_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'desktop',
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<TResult>;
}

async function getJson<TResult>(
  path: string,
  token?: string,
): Promise<TResult> {
  const headers: Record<string, string> = {
    'X-Client-Type': 'desktop',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const httpFetch = await getHttpFetch();
  const response = await httpFetch(`${REMOTE_API_URL}${path}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<TResult>;
}

// ============================================
// Public API
// ============================================

/** Sign in with email/password. Returns session token for desktop storage. */
export async function remoteSignIn(
  email: string,
  password: string,
): Promise<SignInResponse> {
  return postJson<SignInResponse>('/api/v1/auth/login', { email, password });
}

/** Create a new account. Returns accepted message (check email). */
export async function remoteCreateAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<AcceptedResponse> {
  return postJson<AcceptedResponse>('/api/v1/auth/register', {
    email,
    password,
    displayName,
  });
}

/** Request a password reset email. */
export async function remoteRequestPasswordReset(
  email: string,
): Promise<AcceptedResponse> {
  return postJson<AcceptedResponse>('/api/v1/auth/password/forgot', { email });
}

/** Resend email verification link. */
export async function remoteResendVerification(
  email: string,
): Promise<AcceptedResponse> {
  return postJson<AcceptedResponse>('/api/v1/auth/email/resend', { email });
}

/** Check if an existing session token is still valid. */
export async function remoteGetSession(
  token: string,
): Promise<SessionResponse> {
  return getJson<SessionResponse>('/api/v1/auth/session', token);
}
