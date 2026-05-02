/**
 * Tauri API Wrapper Service
 *
 * Provides type-safe wrapper functions around @tauri-apps/api invoke calls.
 * This service handles all IPC communication between the React frontend
 * and the Tauri Rust backend.
 *
 * Architecture:
 * - Trade API calls go through Tauri (user's IP for rate limiting)
 * - PoB/AI backend calls are proxied through Tauri to the backend server
 * - Configuration and caching are handled locally by Tauri
 *
 * Browser Fallback:
 * When running outside Tauri (e.g., in browser for multi-session dev mode),
 * this module falls back to browser-native APIs (fetch, localStorage).
 */

// ============================================
// Environment Detection
// ============================================

/**
 * Check if running inside Tauri environment
 */
const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

/**
 * Backend server URL for browser fallback mode
 */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';

/**
 * Trade API base URL
 */
const TRADE_API_BASE = 'https://www.pathofexile.com/api/trade';

/**
 * LocalStorage keys for browser fallback
 */
const STORAGE_KEYS = {
  CONFIG: 'poa_desktop_config',
  CACHED_BUILDS: 'poa_cached_builds',
} as const;

// ============================================
// Conditional Tauri Import
// ============================================

/**
 * Dynamically import Tauri invoke function only when in Tauri environment
 */
async function getTauriInvoke(): Promise<typeof import('@tauri-apps/api/core').invoke> {
  if (!isTauri) {
    throw new Error('Tauri is not available');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

// ============================================
// Type Definitions
// ============================================

/**
 * User configuration settings
 */
export interface UserConfig {
  backendUrl: string;
  preferredLeague: string | null;
  autoUpdate: boolean;
  theme: string;
}

/**
 * Build import response from the backend
 */
export interface BuildImportResponse {
  buildId: string;
  characterName?: string;
  class: string;
  ascendancy: string;
  level: number;
  pobCode?: string;
}

/**
 * Cached build information
 */
export interface CachedBuild {
  buildId: string;
  name: string;
  class: string;
  ascendancy: string;
  level: number;
  pobCode: string | null;
  cachedAt: string;
}

/**
 * Trade search query
 */
export interface TradeQuery {
  league: string;
  query: Record<string, unknown>;
}

/**
 * Trade search result from the API
 */
export interface TradeSearchResult {
  id: string;
  result: string[];
  total: number;
}

/**
 * Item detail result from trade fetch
 */
export interface ItemResult {
  result: Record<string, unknown>[];
}

/**
 * Analysis response from the backend
 */
export interface AnalysisResponse {
  buildId: string;
  analysis: Record<string, unknown>;
  pathways?: Array<{
    pillar: string;
    title: string;
    issues: string;
    priority: number;
  }>;
}

// ============================================
// Error Handling
// ============================================

/**
 * Custom error class for Tauri API errors
 */
export class TauriApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TauriApiError';
  }
}

/**
 * Wrap a Tauri invoke call with standardized error handling
 * Falls back to browser-native APIs when not running in Tauri
 */
async function invokeWithErrorHandling<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (isTauri) {
    // Running in Tauri - use native IPC
    try {
      const invoke = await getTauriInvoke();
      const result = await invoke<T>(command, args);
      return result;
    } catch (error) {
      const errorMessage =
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : String(error);

      throw new TauriApiError(
        `${command} failed: ${errorMessage}`,
        command,
        error
      );
    }
  } else {
    // Running in browser - use fallback implementations
    return browserFallback<T>(command, args);
  }
}

// ============================================
// Browser Fallback Implementation
// ============================================

/**
 * Browser-native fallback implementations for Tauri commands
 */
async function browserFallback<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  switch (command) {
    case 'get_config':
      return browserGetConfig() as T;

    case 'set_config':
      return browserSetConfig(args?.config as UserConfig) as T;

    case 'import_build':
      return browserImportBuild(args?.request as { pobCode: string }) as Promise<T>;

    case 'get_analysis':
      return browserGetAnalysis(args?.buildId as string) as Promise<T>;

    case 'call_backend':
      return browserCallBackend(
        args?.endpoint as string,
        args?.method as string,
        args?.body as Record<string, unknown> | null,
        args?.sessionToken as string | null
      ) as Promise<T>;

    case 'search_trade':
      return browserSearchTrade(args?.query as TradeQuery) as Promise<T>;

    case 'fetch_item_details':
      return browserFetchItemDetails(
        args?.resultIds as string[],
        args?.queryId as string
      ) as Promise<T>;

    case 'store_build':
      return browserStoreBuild(args?.build as CachedBuild) as T;

    case 'get_cached_builds':
      return browserGetCachedBuilds() as T;

    case 'clear_cache':
      return browserClearCache() as T;

    case 'save_session_snapshot':
      return browserSaveSessionSnapshot(args?.id as string, args?.data as unknown) as T;

    case 'load_session_snapshots':
      return browserLoadSessionSnapshots() as T;

    case 'delete_session_snapshot':
      return browserDeleteSessionSnapshot(args?.id as string) as T;

    case 'clear_session_snapshots':
      return browserClearSessionSnapshots() as T;

    case 'get_sessions_disk_usage':
      return browserGetSessionsDiskUsage() as T;

    case 'find_pob_installation':
      throw new TauriApiError(
        'Path of Building integration is only available in the desktop app',
        'DESKTOP_ONLY'
      );

    case 'open_in_pob':
      throw new TauriApiError(
        'Opening in Path of Building is only available in the desktop app',
        'DESKTOP_ONLY'
      );

    default:
      throw new TauriApiError(
        `Unknown command: ${command}. This may be a desktop-only feature.`,
        'UNKNOWN_COMMAND'
      );
  }
}

// ============================================
// Browser Fallback: Configuration
// ============================================

function browserGetConfig(): UserConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors, return defaults
  }

  // Return default config
  return {
    backendUrl: BACKEND_URL,
    preferredLeague: null,
    autoUpdate: true,
    theme: 'system',
  };
}

function browserSetConfig(config: UserConfig): void {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
}

// ============================================
// Browser Fallback: Backend API
// ============================================

async function browserImportBuild(
  request: { pobCode: string }
): Promise<BuildImportResponse> {
  const response = await fetch(`${BACKEND_URL}/api/v1/builds/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pobCode: request.pobCode }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TauriApiError(
      `Build import failed: ${errorText}`,
      'IMPORT_FAILED',
      { status: response.status }
    );
  }

  return response.json();
}

async function browserGetAnalysis(buildId: string): Promise<AnalysisResponse> {
  const response = await fetch(
    `${BACKEND_URL}/api/v1/builds/${buildId}/analysis`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new TauriApiError(
      `Failed to get analysis: ${errorText}`,
      'ANALYSIS_FAILED',
      { status: response.status }
    );
  }

  return response.json();
}

async function browserCallBackend<T>(
  endpoint: string,
  method: string,
  body: Record<string, unknown> | null,
  sessionToken: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const fetchUrl = `${BACKEND_URL}${endpoint}`;
  const fetchOptions: RequestInit = {
    method: method || 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(fetchUrl, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new TauriApiError(
      `Backend call failed: ${errorText}`,
      'BACKEND_CALL_FAILED',
      { status: response.status, endpoint }
    );
  }

  return response.json();
}

// ============================================
// Browser Fallback: Trade API
// ============================================

/**
 * Simple client-side rate limiter for browser mode
 */
const browserRateLimiter = {
  requests: [] as number[],
  maxRequests: 12,
  windowMs: 60000,

  checkAndRecord(): { allowed: boolean; waitMs?: number } {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldest = this.requests[0];
      const waitMs = this.windowMs - (now - oldest);
      return { allowed: false, waitMs };
    }

    this.requests.push(now);
    return { allowed: true };
  },
};

async function browserSearchTrade(query: TradeQuery): Promise<TradeSearchResult> {
  // Check client-side rate limit
  const rateCheck = browserRateLimiter.checkAndRecord();
  if (!rateCheck.allowed) {
    throw new TauriApiError(
      `Rate limited. Please wait ${Math.ceil((rateCheck.waitMs || 0) / 1000)} seconds before making another request.`,
      'RATE_LIMITED'
    );
  }

  const url = `${TRADE_API_BASE}/search/${encodeURIComponent(query.league)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(query.query),
  });

  // Handle rate limiting from the API
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    throw new TauriApiError(
      `Rate limited by Trade API. Please wait ${waitSeconds} seconds and try again.`,
      'RATE_LIMITED',
      { retryAfter: waitSeconds }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new TauriApiError(
      `Trade API error (${response.status}): ${errorText}`,
      'TRADE_API_ERROR',
      { status: response.status }
    );
  }

  return response.json();
}

async function browserFetchItemDetails(
  resultIds: string[],
  queryId: string
): Promise<ItemResult> {
  if (resultIds.length === 0) {
    return { result: [] };
  }

  if (resultIds.length > 10) {
    throw new TauriApiError(
      'Cannot fetch more than 10 items at once',
      'fetch_item_details',
      { count: resultIds.length }
    );
  }

  // Check client-side rate limit
  const rateCheck = browserRateLimiter.checkAndRecord();
  if (!rateCheck.allowed) {
    throw new TauriApiError(
      `Rate limited. Please wait ${Math.ceil((rateCheck.waitMs || 0) / 1000)} seconds before making another request.`,
      'RATE_LIMITED'
    );
  }

  const ids = resultIds.join(',');
  const url = `${TRADE_API_BASE}/fetch/${ids}?query=${encodeURIComponent(queryId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  // Handle rate limiting from the API
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    throw new TauriApiError(
      `Rate limited by Trade API. Please wait ${waitSeconds} seconds and try again.`,
      'RATE_LIMITED',
      { retryAfter: waitSeconds }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new TauriApiError(
      `Trade API error (${response.status}): ${errorText}`,
      'TRADE_API_ERROR',
      { status: response.status }
    );
  }

  return response.json();
}

// ============================================
// Browser Fallback: Local Cache
// ============================================

function browserStoreBuild(build: CachedBuild): void {
  const builds = browserGetCachedBuilds();
  // Check if build already exists and update it, otherwise add
  const existingIndex = builds.findIndex((b) => b.buildId === build.buildId);
  if (existingIndex >= 0) {
    builds[existingIndex] = build;
  } else {
    builds.push(build);
  }
  localStorage.setItem(STORAGE_KEYS.CACHED_BUILDS, JSON.stringify(builds));
}

function browserGetCachedBuilds(): CachedBuild[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CACHED_BUILDS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors, return empty array
  }
  return [];
}

function browserClearCache(): void {
  localStorage.removeItem(STORAGE_KEYS.CACHED_BUILDS);
}

// ============================================
// Browser Fallback: Session Snapshots
// ============================================

const SESSION_STORAGE_KEY = 'poa-analysis-history';

function browserSaveSessionSnapshot(id: string, data: unknown): void {
  try {
    const all = browserLoadSessionSnapshotsRaw();
    const idx = all.findIndex((s: Record<string, unknown>) => s.id === id);
    if (idx >= 0) {
      all[idx] = data as Record<string, unknown>;
    } else {
      all.push(data as Record<string, unknown>);
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: { snapshots: all }, version: 3 }));
  } catch {
    // QuotaExceededError — best-effort, don't crash
  }
}

function browserLoadSessionSnapshots(): unknown[] {
  return browserLoadSessionSnapshotsRaw();
}

function browserLoadSessionSnapshotsRaw(): Record<string, unknown>[] {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.snapshots ?? [];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function browserDeleteSessionSnapshot(id: string): void {
  try {
    const all = browserLoadSessionSnapshotsRaw();
    const filtered = all.filter((s) => s.id !== id);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: { snapshots: filtered }, version: 3 }));
  } catch {
    // best-effort
  }
}

function browserClearSessionSnapshots(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function browserGetSessionsDiskUsage(): number {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  return stored ? stored.length : 0;
}

// ============================================
// Configuration API
// ============================================

/**
 * Get the current application configuration
 */
export async function getConfig(): Promise<UserConfig> {
  return invokeWithErrorHandling<UserConfig>('get_config');
}

/**
 * Update application configuration
 */
export async function setConfig(config: UserConfig): Promise<void> {
  return invokeWithErrorHandling<void>('set_config', { config });
}

// ============================================
// Backend API (via Tauri proxy or direct fetch)
// ============================================

/**
 * Import a build from PoB code via the backend server
 *
 * PoB computation happens server-side to avoid bundling PoB in the desktop app.
 */
export async function importBuild(pobCode: string): Promise<BuildImportResponse> {
  return invokeWithErrorHandling<BuildImportResponse>('import_build', {
    request: { pobCode },
  });
}

// ============================================
// Character Import from GGG API
// ============================================

/**
 * Character data from GGG API
 */
export interface GGGCharacter {
  name: string;
  league: string;
  classId: number;
  ascendancyClass: number;
  class: string;
  level: number;
  experience: number;
}

/**
 * Response from character list endpoint
 */
export interface CharacterListResponse {
  characters: GGGCharacter[];
}

/**
 * Fetch list of characters for a GGG account
 *
 * @param accountName - Account name with discriminator (e.g., "MyAccount#1234")
 * @param realm - Game realm (default: 'pc')
 * @param gggAccessToken - Optional OAuth token for private profile access
 * @returns List of characters
 */
export async function fetchCharacterList(
  accountName: string,
  realm: string = 'pc',
  gggAccessToken?: string
): Promise<CharacterListResponse> {
  const encodedAccount = encodeURIComponent(accountName);
  const params = new URLSearchParams();
  if (realm !== 'pc') params.set('realm', realm);
  if (gggAccessToken) params.set('gggAccessToken', gggAccessToken);
  const qs = params.toString();
  const url = `/api/v1/builds/characters/${encodedAccount}${qs ? `?${qs}` : ''}`;

  return callBackend<CharacterListResponse>(url, 'GET');
}

/**
 * Import a character from GGG API
 *
 * @param accountName - Account name with discriminator
 * @param characterName - Character name (case-sensitive)
 * @param realm - Game realm (default: 'pc')
 * @param gggAccessToken - Optional OAuth token for private profile access
 * @returns Build import response with buildId
 */
export async function importCharacter(
  accountName: string,
  characterName: string,
  realm: string = 'pc',
  gggAccessToken?: string
): Promise<BuildImportResponse> {
  return callBackend<BuildImportResponse>(
    '/api/v1/builds/import-character',
    'POST',
    { accountName, characterName, realm, ...(gggAccessToken ? { gggAccessToken } : {}) }
  );
}

// ============================================
// GGG Stash Tab API
// ============================================

/** Stash tab metadata from OAuth /api/stash endpoint */
export interface GGGStashTab {
  /** Unique tab id (hex string) */
  id: string;
  /** Tab name */
  name: string;
  /** Tab index (display order) */
  index: number;
  /** Tab type (e.g., "NormalStash", "CurrencyStash", "MapStash", "QuadStash") */
  type: string;
  /** Tab metadata */
  metadata?: { colour?: string };
}

/** Response from stash tab list endpoint */
export interface StashTabListResponse {
  stashes: GGGStashTab[];
}

/** Response from stash tab items endpoint */
export interface StashTabItemsResponse {
  stash: GGGStashTab & {
    items: Record<string, unknown>[];
  };
}

/**
 * Fetch stash tab list for the authenticated user (requires OAuth with account:stashes scope)
 */
export async function fetchStashTabs(
  league: string,
  gggAccessToken: string
): Promise<StashTabListResponse> {
  const params = new URLSearchParams({ league, gggAccessToken });
  return callBackend<StashTabListResponse>(`/api/v1/builds/stash/tabs?${params}`, 'GET');
}

/**
 * Fetch items in a specific stash tab by id (requires OAuth with account:stashes scope)
 */
export async function fetchStashTabItems(
  league: string,
  stashId: string,
  gggAccessToken: string
): Promise<StashTabItemsResponse> {
  const params = new URLSearchParams({ league, stashId, gggAccessToken });
  return callBackend<StashTabItemsResponse>(`/api/v1/builds/stash/tab-items?${params}`, 'GET');
}

/**
 * Import atlas passive tree allocations via GGG OAuth.
 * Requires account:league_accounts scope.
 */
export async function importAtlasPassives(
  accessToken: string,
  league: string
): Promise<import('../../../shared/types/atlas').AtlasImportResponse> {
  return callBackend<import('../../../shared/types/atlas').AtlasImportResponse>(
    '/api/v1/atlas/import',
    'POST',
    { accessToken, league }
  );
}

// ============================================
// GGG OAuth Flow (desktop ↔ GGG directly, no server proxy)
// ============================================

/**
 * Result from exchanging the GGG OAuth code
 */
export interface GGGOAuthResult {
  accountName: string;
  accessToken: string;
  characters: GGGCharacter[];
}

/**
 * Start the GGG OAuth flow — opens browser, returns immediately.
 * The deep link callback will fire when GGG redirects back.
 */
export async function startGGGOAuth(): Promise<{ started: boolean }> {
  return invokeWithErrorHandling<{ started: boolean }>('start_ggg_oauth');
}

/**
 * Exchange a GGG OAuth authorization code for an access token + characters.
 * Called when the deep link callback fires with code + state.
 * Talks directly to GGG — no server involvement.
 */
export async function exchangeGGGOAuth(code: string, state: string): Promise<GGGOAuthResult> {
  return invokeWithErrorHandling<GGGOAuthResult>('exchange_ggg_oauth', { code, state });
}

/**
 * Cancel an in-progress GGG OAuth flow.
 */
export async function cancelGGGOAuth(): Promise<void> {
  return invokeWithErrorHandling<void>('cancel_ggg_oauth');
}

/**
 * Get analysis for a build from the backend
 */
export async function getAnalysis(buildId: string): Promise<AnalysisResponse> {
  return invokeWithErrorHandling<AnalysisResponse>('get_analysis', { buildId });
}

/**
 * Make a generic backend API call
 *
 * Used for AI/LLM features and other backend endpoints.
 */
export async function callBackend<T = Record<string, unknown>>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: Record<string, unknown>,
  sessionToken?: string
): Promise<T> {
  return invokeWithErrorHandling<T>('call_backend', {
    endpoint,
    method,
    body: body ?? null,
    sessionToken: sessionToken ?? null,
  });
}

// ============================================
// Trade API (Direct from User's IP)
// ============================================

/**
 * Search the Trade API directly from the user's IP
 *
 * This solves the rate limiting problem by distributing requests
 * across all users rather than concentrating them on a single backend IP.
 */
export async function searchTrade(query: TradeQuery): Promise<TradeSearchResult> {
  return invokeWithErrorHandling<TradeSearchResult>('search_trade', { query });
}

/**
 * Fetch detailed item information for trade results
 *
 * Takes the result IDs from a search and retrieves full item data.
 * The Trade API limits fetches to 10 items at a time.
 */
export async function fetchItemDetails(
  resultIds: string[],
  queryId: string
): Promise<ItemResult> {
  if (resultIds.length > 10) {
    throw new TauriApiError(
      'Cannot fetch more than 10 items at once',
      'fetch_item_details',
      { count: resultIds.length }
    );
  }

  return invokeWithErrorHandling<ItemResult>('fetch_item_details', {
    resultIds,
    queryId,
  });
}

// ============================================
// Local Cache API
// ============================================

/**
 * Store a build in local cache
 */
export async function storeBuild(build: CachedBuild): Promise<void> {
  return invokeWithErrorHandling<void>('store_build', { build });
}

/**
 * Retrieve all cached builds
 */
export async function getCachedBuilds(): Promise<CachedBuild[]> {
  return invokeWithErrorHandling<CachedBuild[]>('get_cached_builds');
}

/**
 * Clear all cached builds
 */
export async function clearCache(): Promise<void> {
  return invokeWithErrorHandling<void>('clear_cache');
}

// ============================================
// Session Snapshot Storage API
// ============================================

/**
 * Save a session snapshot to disk (or localStorage in browser mode).
 * Each snapshot is stored as an individual file for efficient incremental writes.
 */
export async function saveSessionSnapshot(id: string, data: unknown): Promise<void> {
  return invokeWithErrorHandling<void>('save_session_snapshot', { id, data });
}

/**
 * Load all session snapshots from disk (or localStorage in browser mode).
 */
export async function loadSessionSnapshots(): Promise<unknown[]> {
  return invokeWithErrorHandling<unknown[]>('load_session_snapshots');
}

/**
 * Delete a single session snapshot from disk.
 */
export async function deleteSessionSnapshot(id: string): Promise<void> {
  return invokeWithErrorHandling<void>('delete_session_snapshot', { id });
}

/**
 * Clear all session snapshots from disk.
 */
export async function clearSessionSnapshots(): Promise<void> {
  return invokeWithErrorHandling<void>('clear_session_snapshots');
}

/**
 * Get total disk usage of all session snapshots (in bytes).
 */
export async function getSessionsDiskUsage(): Promise<number> {
  return invokeWithErrorHandling<number>('get_sessions_disk_usage');
}

// ============================================
// Connection Status
// ============================================

/**
 * Check if the backend server is reachable
 */
export async function checkBackendConnection(): Promise<boolean> {
  try {
    await callBackend('/api/v1/health', 'GET');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the Trade API is reachable
 */
export async function checkTradeApiConnection(): Promise<boolean> {
  try {
    // Try a minimal query to check connectivity
    await searchTrade({
      league: 'Standard',
      query: {
        status: { option: 'online' },
        name: '___connection_test___',
      },
    });
    // Even if no results, API responded
    return true;
  } catch (error) {
    // Check if it's a rate limit error (API is reachable but rate limited)
    if (error instanceof TauriApiError && error.message.includes('Rate limited')) {
      return true;
    }
    return false;
  }
}

// ============================================
// Environment Detection (exported for UI)
// ============================================

/**
 * Check if running in Tauri desktop environment
 *
 * Useful for UI to show/hide desktop-only features.
 */
export function isDesktopApp(): boolean {
  return isTauri;
}

// ============================================
// Authentication API (Re-exported from auth.ts)
// ============================================

// Auth functions are in a separate auth.ts service file
// to keep concerns separated. Import from there for auth operations.
// See: src/services/auth.ts

// ============================================
// Path of Building Integration
// ============================================

/**
 * PoB installation information
 */
export interface PoBInstallation {
  /** Full path to the PoB executable */
  path: string;
  /** How the installation was found */
  source: 'registry' | 'common_path';
}

/**
 * Check if Path of Building is installed on the user's machine.
 *
 * Searches in common locations:
 * - Windows registry (if installed via installer)
 * - Common install paths (Program Files, user directories)
 *
 * @returns Installation info if found, null otherwise
 * @throws TauriApiError in browser mode (desktop-only feature)
 */
export async function findPoBInstallation(): Promise<PoBInstallation | null> {
  return invokeWithErrorHandling<PoBInstallation | null>('find_pob_installation');
}

/**
 * Launch Path of Building with a build URL.
 *
 * PoB will fetch the build from the provided URL and open it.
 * The URL should point to a raw PoB code text response.
 *
 * @param buildUrl - URL that returns raw PoB code (e.g., from /api/v1/builds/share/:id)
 * @throws TauriApiError if PoB is not installed, launch fails, or in browser mode
 */
export async function openInPoB(buildUrl: string): Promise<void> {
  return invokeWithErrorHandling<void>('open_in_pob', { buildUrl });
}

/**
 * Build share response from the backend
 */
export interface BuildShareResponse {
  id: string;
  url: string;
  expiresIn: number;
}

/**
 * Share a build and open it in Path of Building.
 *
 * This is a high-level function that:
 * 1. Checks if PoB is installed
 * 2. Uploads the build to the backend share endpoint
 * 3. Launches PoB with the share URL
 *
 * @param pobCode - The PoB code to share and open
 * @throws TauriApiError if PoB is not installed or in browser mode
 * @throws Error if the share upload fails
 */
export async function shareBuildAndOpenInPoB(pobCode: string): Promise<void> {
  // First, check if PoB is installed
  const installation = await findPoBInstallation();
  if (!installation) {
    throw new TauriApiError(
      'Path of Building is not installed. Please install PoB to use this feature.',
      'POB_NOT_FOUND'
    );
  }

  // Share the build via the backend
  const shareResponse = await callBackend<BuildShareResponse>(
    '/api/v1/builds/share',
    'POST',
    { pobCode }
  );

  // Launch PoB with the share URL
  await openInPoB(shareResponse.url);
}
