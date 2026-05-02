/**
 * Suggested Action Types for Inline Chat Actions
 *
 * These types define the structure for suggested actions that the LLM can emit
 * alongside its text responses. Actions appear as clickable buttons below messages.
 *
 * Design Principles:
 * - Actions are contextual and appear where relevant in conversation
 * - User can configure parameters before execution (e.g., budget for trade)
 * - Different action types have different configuration UIs
 */

/**
 * Equipment slot types for trade searches.
 * Split into weighted (offensive) and affix-based (defensive) slots.
 */
export type TradeSlot =
  // Affix-based slots (defensive - user picks mods)
  | 'helmet'
  | 'body-armour'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'shield'
  // Weighted slots (offensive - PoB optimizes)
  | 'ring'
  | 'ring2'
  | 'amulet'
  | 'weapon'
  | 'weapon2'
  // Jewel slots (different jewel types)
  | 'jewel'
  | 'tree-jewel'
  | 'abyss-jewel'
  | 'cluster-jewel';

/**
 * Slots that use weighted search (PoB optimization).
 * Budget is the only user input needed.
 */
export const WEIGHTED_SLOTS: TradeSlot[] = [
  'ring',
  'ring2',
  'amulet',
  'weapon',
  'weapon2',
  'jewel',
  'tree-jewel',
  'abyss-jewel',
  'cluster-jewel',
];

/**
 * Jewel-specific slots for the jewel section.
 */
export const JEWEL_SLOTS: TradeSlot[] = [
  'tree-jewel',
  'abyss-jewel',
  'cluster-jewel',
];

/**
 * Slots that use affix-based search (user picks mods).
 * User configures budget + selects from recommended mods.
 */
export const AFFIX_SLOTS: TradeSlot[] = [
  'helmet',
  'body-armour',
  'gloves',
  'boots',
  'belt',
  'shield',
];

/**
 * Check if a slot uses weighted search.
 */
export function isWeightedSlot(slot: TradeSlot): boolean {
  return WEIGHTED_SLOTS.includes(slot);
}

/**
 * A single mod recommendation for affix-based trade search.
 * LLM provides these based on build analysis.
 */
export interface RecommendedMod {
  /** Trade API stat ID (e.g., "explicit.stat_3299347043") */
  id: string;
  /** Short display name (e.g., "Maximum Life") */
  name: string;
  /** Whether this is a prefix or suffix */
  affixType: 'prefix' | 'suffix';
  /** LLM's recommended minimum value */
  recommendedMin: number;
  /** T1 maximum value for this mod (for reference) */
  t1Max?: number;
  /** Whether LLM recommends this mod be enabled by default */
  recommended: boolean;
  /** Optional priority hint (1 = highest) */
  priority?: number;
}

/**
 * Trade search action - the main action type for gear upgrades.
 * LLM emits this when recommending a trade search.
 */
export interface TradeSearchAction {
  type: 'trade_search';
  /** Equipment slot to search */
  slot: TradeSlot;
  /** Search mode determined by slot type */
  searchMode: 'weighted' | 'affix';
  /** Recommended mods for affix-based search (only for affix slots) */
  recommendedMods?: RecommendedMod[];
  /** Default budget suggestion */
  suggestedBudget?: {
    amount: number;
    currency: 'chaos' | 'divine';
  };
  /** Brief context about why this upgrade matters */
  context?: string;
}

/**
 * Crafting action - for when crafting is a better option than trading.
 */
export interface CraftingAction {
  type: 'crafting';
  /** Target slot for crafting */
  slot: TradeSlot;
  /** Recommended base type */
  baseType?: string;
  /** Recommended crafting method */
  method?: string;
  /** Brief context */
  context?: string;
}

/**
 * Explore action - for when user should investigate options.
 */
export interface ExploreAction {
  type: 'explore';
  /** What to explore (e.g., "alternative skill gems", "cluster jewels") */
  topic: string;
  /** Pre-generated options if available */
  options?: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

/**
 * Union of all suggested action types.
 */
export type SuggestedAction = TradeSearchAction | CraftingAction | ExploreAction;

/**
 * Get a display label for an action.
 */
export function getActionLabel(action: SuggestedAction): string {
  switch (action.type) {
    case 'trade_search':
      return `Search Trade for ${formatSlotName(action.slot)}`;
    case 'crafting':
      return `Craft ${formatSlotName(action.slot)}`;
    case 'explore':
      return `Explore ${action.topic}`;
  }
}

/**
 * Format slot name for display.
 */
export function formatSlotName(slot: TradeSlot): string {
  const names: Record<TradeSlot, string> = {
    helmet: 'Helmet',
    'body-armour': 'Body Armour',
    gloves: 'Gloves',
    boots: 'Boots',
    belt: 'Belt',
    shield: 'Shield',
    ring: 'Ring',
    ring2: 'Ring 2',
    amulet: 'Amulet',
    weapon: 'Weapon',
    weapon2: 'Off-hand',
    jewel: 'Jewel',
    'tree-jewel': 'Tree Jewel',
    'abyss-jewel': 'Abyss Jewel',
    'cluster-jewel': 'Cluster Jewel',
  };
  return names[slot] || slot;
}

/**
 * Suggested actions attached to a message.
 * LLM can emit multiple actions per response.
 */
export interface MessageSuggestedActions {
  /** Actions to display as buttons */
  actions: SuggestedAction[];
  /** Optional header text above action buttons */
  header?: string;
}

/**
 * State for trade search configuration (frontend).
 * Tracks user's configuration before executing search.
 */
export interface TradeConfigState {
  /** The action being configured */
  action: TradeSearchAction;
  /** Is config panel expanded? */
  isExpanded: boolean;
  /** User's budget setting */
  budget: {
    amount: number;
    currency: 'chaos' | 'divine';
  };
  /** For affix search: which mods are enabled */
  enabledMods?: string[];
  /** For affix search: user-adjusted min values */
  modMinValues?: Record<string, number>;
  /** Current execution state */
  executionState: 'idle' | 'searching' | 'complete' | 'error';
  /** Search progress (for affix search iterations) */
  progress?: {
    iteration: number;
    maxIterations: number;
    resultCount: number;
    minPrice?: number;
    budgetUtilization?: number;
  };
  /** Search results */
  results?: TradeSearchResults;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Trade search results structure.
 */
export interface TradeSearchResults {
  /** Total items found */
  totalResults: number;
  /** Trade site URL */
  tradeUrl: string;
  /** Top items found */
  items: Array<{
    name: string;
    baseType: string;
    price: { amount: number; currency: string };
    mods: string[];
    /** PoB-validated stat changes */
    statChanges?: {
      dps?: { before: number; after: number; percent: number };
      ehp?: { before: number; after: number; percent: number };
    };
    /** Whether this is the "best value" item */
    isBestValue?: boolean;
  }>;
  /** Budget utilization info */
  budgetUtilization?: number;
  /** Iteration history for transparency */
  iterations?: Array<{
    step: number;
    resultCount: number;
    minPrice: number;
  }>;
}

/**
 * Initial actions to show after initial analysis.
 * These are always-available actions the user can take.
 */
export interface InitialSuggestedActions {
  /** Slots that could benefit from upgrades, in priority order */
  upgradeSlots: Array<{
    slot: TradeSlot;
    priority: number;
    reason: string;
  }>;
  /** Whether trade search is available */
  tradeAvailable: boolean;
  /** Whether crafting analysis is available */
  craftingAvailable: boolean;
}
