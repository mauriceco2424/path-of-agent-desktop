/**
 * Render-null component that drives the auto-update lifecycle.
 *
 * `useAutoUpdate()` is the active driver: it calls Tauri's `check()` API,
 * manages the download/install state machine, and writes status into the
 * `useUpdateAvailability` Zustand store. Display components like
 * `VersionBadge` subscribe to that store passively. There must be exactly
 * one driver mounted in the app tree, or the store sits at `idle` forever
 * and no update ever fires — see SIGN-21 in deployment-learnings for the
 * regression that broke v0.1.4 → v0.2.2 by removing the only mount site.
 *
 * Mount this once at the App root, after the auth + backend-readiness
 * gates pass. Do NOT mount inside route components — they unmount on
 * navigation, which would create a fresh driver per route and reset the
 * 2-hour recheck timer on every nav.
 */

import { useAutoUpdate } from '../../hooks/useAutoUpdate';

export function UpdateDriver(): null {
  useAutoUpdate();
  return null;
}
