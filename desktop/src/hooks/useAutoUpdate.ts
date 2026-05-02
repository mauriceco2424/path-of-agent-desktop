/**
 * useAutoUpdate Hook
 *
 * Manages app auto-update lifecycle using Tauri's updater plugin.
 * Checks for updates on mount (with delay) and periodically.
 *
 * FORCED UPDATE MODEL:
 * - When an update is detected, download starts immediately (no user action).
 * - When download completes, install + restart triggers automatically.
 * - Analysis is blocked while an update is in progress.
 * - Users can still import builds during the update.
 */

import { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';

// ============================================
// Types
// ============================================

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error';

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

export interface AutoUpdateState {
  status: UpdateStatus;
  version: string | null;
  body: string | null;
  progress: UpdateProgress | null;
  error: string | null;
  checkNow: () => void;
  retryUpdate: () => void;
}

// ============================================
// Constants
// ============================================

const INITIAL_DELAY_MS = 3_000;
const RECHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const AUTO_INSTALL_DELAY_MS = 1_500; // Brief pause before auto-install so user sees "ready"

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

/**
 * Shared update state — readable from any component.
 * Written by useAutoUpdate(), read by AnalyzeMode to block analysis
 * and by UpdateIndicator for display.
 *
 * isUpdateBlocking: true when analysis should be prevented (downloading, ready, installing).
 */
export const useUpdateAvailability = create<{
  availableVersion: string | null;
  status: UpdateStatus;
  progress: UpdateProgress | null;
  /** True when the update is in a state that should block analysis */
  isUpdateBlocking: boolean;
  _setState: (patch: {
    availableVersion?: string | null;
    status?: UpdateStatus;
    progress?: UpdateProgress | null;
  }) => void;
}>((set) => ({
  availableVersion: null,
  status: 'idle',
  progress: null,
  isUpdateBlocking: false,
  _setState: (patch) =>
    set((prev) => {
      const next = { ...prev, ...patch };
      const blocking =
        next.status === 'downloading' ||
        next.status === 'ready' ||
        next.status === 'installing';
      return { ...next, isUpdateBlocking: blocking };
    }),
}));

// ============================================
// Hook
// ============================================

export function useAutoUpdate(): AutoUpdateState {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync local state to the shared store whenever it changes
  const syncToStore = useCallback(
    (s: UpdateStatus, v: string | null, p: UpdateProgress | null) => {
      useUpdateAvailability.getState()._setState({
        status: s,
        availableVersion: v,
        progress: p,
      });
    },
    []
  );

  const checkForUpdate = useCallback(async () => {
    if (!isTauri) return;

    try {
      setStatus('checking');
      setError(null);
      syncToStore('checking', null, null);

      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (!update) {
        setStatus('idle');
        syncToStore('idle', null, null);
        return;
      }

      // Guard against update loop: if we already installed this version
      // (downloadAndInstall completed but app didn't fully restart),
      // don't re-download the same version.
      const installedKey = `poa-update-installed-${update.version}`;
      if (sessionStorage.getItem(installedKey)) {
        console.warn(`[auto-update] Already installed v${update.version} this session, skipping re-download`);
        setStatus('idle');
        syncToStore('idle', null, null);
        return;
      }

      setVersion(update.version);
      setBody(update.body ?? null);

      // Auto-download immediately — no user action needed
      setStatus('downloading');
      const initialProgress = { downloaded: 0, total: null };
      setProgress(initialProgress);
      syncToStore('downloading', update.version, initialProgress);

      // Start download in the background
      let totalBytes: number | null = null;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = (event.data.contentLength as number) ?? null;
          const p = { downloaded: 0, total: totalBytes };
          setProgress(p);
          syncToStore('downloading', update.version, p);
        } else if (event.event === 'Progress') {
          downloadedBytes += (event.data.chunkLength as number) ?? 0;
          const p = { downloaded: downloadedBytes, total: totalBytes };
          setProgress(p);
          syncToStore('downloading', update.version, p);
        } else if (event.event === 'Finished') {
          // Mark this version as installed to prevent re-download loop
          sessionStorage.setItem(installedKey, '1');

          setStatus('ready');
          setProgress(null);
          syncToStore('ready', update.version, null);
        }
      });

      // downloadAndInstall resolves after install — Tauri handles restart
      setStatus('installing');
      syncToStore('installing', update.version, null);
    } catch (err) {
      // Update check failures are expected (no release published yet, network
      // issues, server down). Go back to idle — only show errors for actual
      // download failures. Log the error for debugging.
      console.warn('[auto-update] Update check failed:', err instanceof Error ? err.message : err);
      setStatus('idle');
      syncToStore('idle', null, null);
    }
  }, [syncToStore]);

  // Retry: re-attempt the download if it failed
  const retryUpdate = useCallback(() => {
    setError(null);
    void checkForUpdate();
  }, [checkForUpdate]);

  // Initial check with delay + periodic recheck
  useEffect(() => {
    if (!isTauri) return;

    const initialTimer = setTimeout(checkForUpdate, INITIAL_DELAY_MS);
    const interval = setInterval(checkForUpdate, RECHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  return {
    status,
    version,
    body,
    progress,
    error,
    checkNow: checkForUpdate,
    retryUpdate,
  };
}
