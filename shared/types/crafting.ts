/**
 * Enhanced Crafting Types
 *
 * Type definitions for the enhanced crafting UX.
 * Supports recipe generation, mod pool exploration, and item building.
 */

/**
 * Influence types for crafted items
 */
export type InfluenceType =
  | 'shaper'
  | 'elder'
  | 'crusader'
  | 'hunter'
  | 'redeemer'
  | 'warlord'
  | 'searing'
  | 'eater';

/**
 * Quality grade for recipe confidence
 */
export type QualityGrade = 'A' | 'B' | 'C' | 'D';

/**
 * Difficulty rating for crafting recipes (1-5 scale)
 */
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;

/**
 * Time estimate for completing a craft
 */
export type TimeEstimate = 'quick' | 'moderate' | 'long';

/**
 * Warning severity levels for crafting guidance
 */
export type WarningSeverity = 'info' | 'warning' | 'error';

// =============================================================================
// Enhanced Craft Action Response (returned from /api/v1/actions/craft)
// =============================================================================

/**
 * Single step in a crafting recipe
 */
export interface CraftingRecipeStep {
  /** Step number (1-indexed) */
  step: number;
  /** Human-readable action description */
  action: string;
  /** Crafting method for this step (e.g., 'essence', 'chaos_spam', 'harvest') */
  method: string;
  /** Expected cost for this step in chaos */
  expectedCost: number;
  /** Cost range (low/high estimates) */
  costRange: { low: number; high: number };
  /** Success rate for this step (0-1) */
  successRate?: number;
  /** What constitutes success for this step */
  successCondition?: string;
  /** What to do if this step fails */
  failureAction?: string;
  /** Additional notes or tips */
  notes?: string;
}

/**
 * Alternative crafting method that was considered
 */
export interface CraftingAlternative {
  /** Method name */
  method: string;
  /** Expected cost in chaos */
  expectedCost: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Why this alternative exists */
  reason: string;
  /** When this method might be preferred */
  preferredWhen?: string;
}

/**
 * Recommended base item for crafting
 */
export interface RecommendedBase {
  /** Base type name (e.g., 'Astral Plate', 'Hubris Circlet') */
  name: string;
  /** Recommended item level */
  itemLevel: number;
  /** Optional influence type */
  influence?: InfluenceType;
  /** Estimated cost to acquire base */
  estimatedCost: number;
}

/**
 * Target mod specification for crafting
 */
export interface CraftTargetMod {
  /** Stat identifier */
  stat: string;
  /** Minimum value required */
  minValue?: number;
  /** Whether this mod is required */
  required: boolean;
}

/**
 * Warning about a crafting recipe or step
 */
export interface CraftingWarning {
  /** Warning severity */
  severity: WarningSeverity;
  /** Warning message */
  message: string;
}

/**
 * Complete crafting recipe returned from enhanced craft endpoint
 */
export interface CraftingRecipe {
  /** Unique recipe identifier */
  id: string;
  /** Human-readable recipe name */
  name: string;
  /** Primary crafting method */
  method: string;
  /** Total cost breakdown */
  totalCost: {
    average: number;
    low: number;
    high: number;
    currency: 'chaos' | 'divine';
  };
  /** Simulation statistics */
  simulation: {
    /** Probability of success within reasonable attempts */
    successRate: number;
    /** Expected number of attempts */
    expectedAttempts: number;
    /** 10th percentile attempts (lucky) */
    p10Attempts: number;
    /** 50th percentile attempts (median) */
    p50Attempts: number;
    /** 90th percentile attempts (unlucky) */
    p90Attempts: number;
  };
  /** Ordered crafting steps */
  steps: CraftingRecipeStep[];
  /** Recipe confidence score (0-1) */
  confidence: number;
  /** Quality grade based on confidence */
  qualityGrade: QualityGrade;
  /** Difficulty rating (1-5) */
  difficulty: DifficultyRating;
  /** Time estimate for completion */
  timeEstimate: TimeEstimate;
  /** Alternative methods considered */
  alternatives: CraftingAlternative[];
  /** Recommended base item */
  recommendedBase?: RecommendedBase;
  /** Target mods the recipe aims to achieve */
  targetMods: CraftTargetMod[];
  /** Warnings and caveats */
  warnings: CraftingWarning[];
}

/**
 * Enhanced craft action response returned from /api/v1/actions/craft
 */
export interface EnhancedCraftActionResponse {
  /** Whether the request succeeded */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Generated crafting recipe (optional when success is false) */
  recipe?: CraftingRecipe;
}

// =============================================================================
// Craft Search Configuration (sent to /api/v1/actions/craft)
// =============================================================================

/**
 * Method preference for crafting
 */
export type CraftMethodPreference = 'recommended' | 'cheapest' | 'fastest';

/**
 * Configuration options for craft search request
 */
export interface CraftSearchConfig {
  /** Budget amount */
  budget: number;
  /** Currency type for budget */
  currency: 'chaos' | 'divine';
  /** Method selection preference */
  methodPreference?: CraftMethodPreference;
  /** Specific target mods to enable (by stat ID) */
  enabledTargetMods?: string[];
}

// =============================================================================
// Crafted Item Specification (for Item Builder, sent to /api/v1/actions/apply)
// =============================================================================

/**
 * A single mod on a crafted item
 */
export interface CraftedItemMod {
  /** Mod identifier (from RePoE) */
  id: string;
  /** Stat description */
  stat: string;
  /** Rolled values for each stat line */
  values: number[];
  /** Tier number (1 = best) */
  tier?: number;
  /** Mod slot type */
  type: 'prefix' | 'suffix' | 'implicit';
}

/**
 * Specification for a crafted item (Item Builder format)
 */
export interface CraftedItemSpec {
  /** Base type name (e.g., 'Astral Plate', 'Hubris Circlet') */
  baseType: string;
  /** Item level */
  itemLevel: number;
  /** Rarity */
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  /** Optional custom name for rare items */
  name?: string;
  /** Mods on the item */
  mods: CraftedItemMod[];
  /** Optional influence */
  influence?: InfluenceType;
  /** Whether the item is corrupted */
  corrupted?: boolean;
}

// =============================================================================
// Mod Pool Response (returned from /api/v1/crafting/mod-pool)
// =============================================================================

/**
 * A single stat line in a mod
 */
export interface ModStatLine {
  /** Stat identifier */
  id: string;
  /** Minimum roll value */
  min: number;
  /** Maximum roll value */
  max: number;
  /** Human-readable stat text */
  displayText: string;
}

/**
 * A mod entry in the mod pool
 */
export interface ModPoolEntry {
  /** Unique mod identifier */
  id: string;
  /** Display name */
  name: string;
  /** Tier number (1 = best) */
  tier: number;
  /** Mod group for mutual exclusion */
  group: string;
  /** Tags associated with this mod */
  tags: string[];
  /** Stat lines */
  stats: ModStatLine[];
  /** Spawn weight for this item class */
  spawnWeight: number;
  /** Minimum item level required */
  requiredLevel: number;
}

/**
 * Mod pool response from /api/v1/crafting/mod-pool endpoint
 */
export interface ModPoolResponse {
  /** Item class queried (e.g., 'Helmets', 'Body Armours') */
  itemClass: string;
  /** Item level used for filtering */
  itemLevel: number;
  /** Influence type if specified */
  influence?: InfluenceType;
  /** Available prefix mods */
  prefixes: ModPoolEntry[];
  /** Available suffix mods */
  suffixes: ModPoolEntry[];
  /** Total prefix spawn weight (for probability calculations) */
  totalPrefixWeight: number;
  /** Total suffix spawn weight */
  totalSuffixWeight: number;
}

// =============================================================================
// Mod Pool Request (query parameters for /api/v1/crafting/mod-pool)
// =============================================================================

/**
 * Query parameters for mod pool endpoint
 */
export interface ModPoolQueryParams {
  /** Item class (e.g., 'Helmets', 'Body Armours', 'Boots') */
  itemClass: string;
  /** Item level for mod tier filtering */
  itemLevel: number;
  /** Optional influence type */
  influence?: InfluenceType;
}
