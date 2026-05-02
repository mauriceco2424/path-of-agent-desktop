/**
 * Open a URL in the system's default browser.
 *
 * Tries Tauri opener plugin first, falls back to window.open() in browser dev mode.
 *
 * IMPORTANT: This function is intentionally NOT async for the browser path.
 * Browsers block `window.open()` inside async functions (popup blocker treats
 * it as non-user-initiated). The Tauri path uses .then() to avoid blocking.
 */

export function openExternal(url: string): void {
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => openUrl(url))
    .catch(() => {
      // Tauri not available (browser dev mode) — fall back to window.open
      window.open(url, '_blank', 'noopener,noreferrer');
    });
}
