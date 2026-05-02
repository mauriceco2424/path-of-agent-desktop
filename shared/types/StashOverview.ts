/**
 * Stash Overview Types
 *
 * Shared types for the stash overview feature — used by both the backend
 * SSE route and the frontend modal/hook.
 */

// =============================================================================
// Data Types
// =============================================================================

/** A single currency/material entry with pricing info */
export interface CurrencyEntry {
  /** Display name (e.g., "Chaos Orb", "Deafening Essence of Greed") */
  name: string;
  /** Total quantity across all stash tabs */
  count: number;
  /** Per-unit chaos equivalent value */
  chaosValue: number;
  /** Total chaos equivalent value (count × chaosValue) */
  totalChaosValue: number;
  /** GGG CDN icon URL (from stash API response) */
  icon?: string;
}

/** Map tier count entry */
export interface MapTierEntry {
  tier: number;
  count: number;
}

/** A valuable item (unique, rare, div card) found in stash */
export interface ValuableItem {
  /** Item name (for uniques) or typeLine (for rares) */
  name: string;
  /** Base type / type line */
  typeLine: string;
  /** Estimated chaos value from poe.ninja */
  chaosValue: number;
  /** GGG CDN icon URL */
  icon?: string;
  /** Name of the stash tab containing this item */
  tabName: string;
  /** frameType: 0=normal, 1=magic, 2=rare, 3=unique */
  rarity: number;
}

/** Complete stash overview data returned by the backend */
export interface StashOverviewData {
  // Wealth summary
  totalWealthChaos: number;
  totalWealthDivine: number;
  divineRate: number | null;

  // Currency categories
  liquidCurrency: CurrencyEntry[];
  craftingMaterials: CurrencyEntry[];
  fragments: CurrencyEntry[];
  essences: CurrencyEntry[];
  divinationCards: CurrencyEntry[];

  // Map pool
  mapPool: {
    totalMaps: number;
    highestTier: number;
    tiers: MapTierEntry[];
    estimatedValueChaos: number;
  };

  // Valuable equipment
  valuableItems: ValuableItem[];

  // Metadata
  tabsScanned: number;
  totalTabs: number;
  fetchedAt: string;
  league: string;
}

// =============================================================================
// SSE Event Types
// =============================================================================

export type StashOverviewEvent =
  | { type: 'progress'; tabsScanned: number; totalTabs: number; currentTab: string }
  | { type: 'complete'; data: StashOverviewData }
  | { type: 'error'; message: string };
