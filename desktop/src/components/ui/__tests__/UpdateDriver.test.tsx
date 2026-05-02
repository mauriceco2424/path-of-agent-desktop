/**
 * UpdateDriver guard tests.
 *
 * Two independent guards against the regression that shipped broken
 * auto-update in v0.1.4 → v0.2.2 (see SIGN-21 in deployment-learnings):
 *
 * 1. Functional: mounting <UpdateDriver /> in a Tauri-flagged window must
 *    cause Tauri's updater `check()` to fire after the initial delay.
 *    Catches breakage of the driver wiring (useAutoUpdate hook, dynamic
 *    import, isTauri detection).
 *
 * 2. Structural: App.tsx source must contain `<UpdateDriver />` JSX.
 *    Catches deletion of the mount site even if the driver itself still
 *    works. This is the exact regression class that broke v0.1.4 — the
 *    driver was healthy, but nothing in the render tree mounted it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { render, cleanup, act } from '@testing-library/react';

const checkMock = vi.fn(async () => null);

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: checkMock,
}));

describe('UpdateDriver — functional guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    checkMock.mockClear();
    // useAutoUpdate's isTauri detection checks for either of these globals.
    // The test setup defines __TAURI__ as writable, so direct assignment works.
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = undefined;
  });

  it('fires the Tauri updater check after the initial delay', async () => {
    const { UpdateDriver } = await import('../UpdateDriver');

    render(<UpdateDriver />);

    expect(checkMock).not.toHaveBeenCalled();

    // useAutoUpdate's INITIAL_DELAY_MS is 3000. Advance just past it and
    // drain microtasks so the dynamic import + check() promise chain runs.
    // Wrap in act() because the timer callback dispatches setState updates.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(checkMock).toHaveBeenCalledTimes(1);
  });
});

describe('UpdateDriver — structural guard (mount site)', () => {
  it('App.tsx must render <UpdateDriver /> somewhere in its tree', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const appSource = readFileSync(resolve(here, '..', '..', '..', 'App.tsx'), 'utf8');

    // The driver is mounted as JSX (self-closing or with children). If
    // someone deletes the mount, the store sits at idle forever and no
    // user ever auto-updates again — exactly the v0.1.4 → v0.2.2 bug.
    const mountedAsJsx = /<UpdateDriver\s*\/?>/.test(appSource);
    const importedFromBareSrc = /from\s+['"]\.\/components\/ui\/UpdateDriver['"]/.test(appSource);

    expect(
      mountedAsJsx,
      'App.tsx must render <UpdateDriver /> — see SIGN-21 in deployment-learnings.',
    ).toBe(true);
    expect(
      importedFromBareSrc,
      'App.tsx must import UpdateDriver from ./components/ui/UpdateDriver.',
    ).toBe(true);
  });
});
