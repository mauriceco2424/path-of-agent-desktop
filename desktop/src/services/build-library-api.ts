/**
 * Desktop Build Library API Client
 *
 * Fetches build progression guides from the remote server
 * (api.pathofagent.com) in production, or from a local dev server in
 * development when `VITE_REMOTE_API_URL` points at `http://127.0.0.1:9876`.
 *
 * Guide JSONs live only on the server — the desktop sidecar (`app-desktop.ts`)
 * does NOT register the build-library route (see LEARNING-5). Uses Tauri's
 * plugin-http in production to bypass CSP/CORS on the cross-origin call.
 */
import type {
  BuildGuide,
  BuildGuideSummary,
} from '@shared/types/build-library';

const REMOTE_API_URL =
  import.meta.env.VITE_REMOTE_API_URL || 'https://api.pathofagent.com';

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

let tauriFetch: typeof globalThis.fetch | null = null;

async function getHttpFetch(): Promise<typeof globalThis.fetch> {
  if (!isTauri) return globalThis.fetch;
  if (tauriFetch) return tauriFetch;
  const { fetch: tFetch } = await import('@tauri-apps/plugin-http');
  tauriFetch = tFetch as unknown as typeof globalThis.fetch;
  return tauriFetch;
}

export class BuildLibraryApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BuildLibraryApiError';
    this.status = status;
  }
}

interface ListResponse {
  guides: BuildGuideSummary[];
  count: number;
}

/**
 * Cache-bypass fetch options. Guides get re-published frequently during
 * authoring sweeps, and any cached copy (Tauri's plugin-http, a corporate
 * proxy, or our own ETag layer) silently serves stale content. We bust the
 * cache two ways: (1) `cache: 'no-store'` on the Request, (2) a timestamp
 * query param so any URL-keyed cache treats each call as a fresh resource.
 */
const NO_CACHE_INIT: RequestInit = {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-cache' },
};

function bust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

/**
 * GET /api/v1/build-library — list all available guides.
 * Pass a `signal` to cancel the request when the consuming component unmounts.
 */
export async function listBuildGuides(signal?: AbortSignal): Promise<BuildGuideSummary[]> {
  const url = bust(`${REMOTE_API_URL}/api/v1/build-library`);
  const httpFetch = await getHttpFetch();
  let response: Response;
  try {
    response = await httpFetch(url, { ...NO_CACHE_INIT, signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new BuildLibraryApiError(
      `Failed to reach ${REMOTE_API_URL}: ${(err as Error).message}`,
    );
  }

  if (!response.ok) {
    throw new BuildLibraryApiError(
      `Build library list request failed: HTTP ${response.status}`,
      response.status,
    );
  }

  const body = (await response.json()) as ListResponse;
  return body.guides ?? [];
}

/**
 * GET /api/v1/build-library/:slug — fetch a single full guide.
 * Returns null on 404; throws on other errors.
 */
export async function getBuildGuide(
  slug: string,
  signal?: AbortSignal,
): Promise<BuildGuide | null> {
  const url = bust(
    `${REMOTE_API_URL}/api/v1/build-library/${encodeURIComponent(slug)}`,
  );
  const httpFetch = await getHttpFetch();
  let response: Response;
  try {
    response = await httpFetch(url, { ...NO_CACHE_INIT, signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new BuildLibraryApiError(
      `Failed to reach ${REMOTE_API_URL}: ${(err as Error).message}`,
    );
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new BuildLibraryApiError(
      `Build guide request failed: HTTP ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as BuildGuide;
}
