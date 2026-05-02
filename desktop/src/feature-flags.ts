/**
 * Feature flags for gating unreleased functionality.
 * Flip to `true` when ready to ship.
 */
export const FEATURE_FLAGS = {
  /** Gear trade search UI (package planner, trade config cards, live search) */
  TRADE_SEARCH: true,
} as const;
