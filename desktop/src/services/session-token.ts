const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:9876';

export async function pushSessionTokenToLocalBackend(
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/v1/session-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Session token sync failed with ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }
}
