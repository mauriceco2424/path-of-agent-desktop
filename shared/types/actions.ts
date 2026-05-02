/**
 * Actions API Types
 *
 * Types for direct build modification endpoints (item preview, gem apply, etc.)
 * These are independent of the improvement/recipe system.
 */

// =============================================================================
// Stat Preview Types
// =============================================================================

/**
 * Preview of stat changes from equipping an item or making a change
 */
export interface StatPreview {
  /** DPS change */
  dps: {
    before: number;
    after: number;
    delta: number;
    percent: number;
  };
  /** EHP change */
  ehp: {
    before: number;
    after: number;
    delta: number;
    percent: number;
  };
  /** Life change */
  life: {
    before: number;
    after: number;
    delta: number;
  };
  /** ES change */
  es: {
    before: number;
    after: number;
    delta: number;
  };
  /** Resistance changes (optional) */
  resistances?: {
    fire: { before: number; after: number };
    cold: { before: number; after: number };
    lightning: { before: number; after: number };
    chaos: { before: number; after: number };
  };
}

// =============================================================================
// Gem Apply Types
// =============================================================================

/**
 * Request to apply gem changes to a build
 */
export interface GemApplyRequest {
  /** Build ID */
  buildId: string;

  /** Socket group index (1-based) */
  socketGroupIndex: number;

  /** Changes to apply */
  changes: GemChanges;
}

/**
 * Gem changes to apply
 */
export interface GemChanges {
  /** Gems to add */
  add?: Array<{
    name: string;
    level?: number;
    quality?: number;
    qualityType?: 'Default' | 'Anomalous' | 'Divergent' | 'Phantasmal';
  }>;

  /** Gem names to remove */
  remove?: string[];
}

/**
 * Response from gem apply endpoint
 */
export interface GemApplyResponse {
  /** Whether apply succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Actual stat delta from PoB */
  actualDelta?: {
    dpsBefore: number;
    dpsAfter: number;
    dpsPercent: number;
    ehpBefore: number;
    ehpAfter: number;
    ehpPercent: number;
  };

  /** Updated PoB code */
  pobCode?: string;
}

// =============================================================================
// Item Preview Types
// =============================================================================

/**
 * Response from item preview endpoint
 */
export interface ItemPreviewResponse {
  success: boolean;
  preview?: StatPreview;
  pobCode?: string;
  error?: string;
  retryable?: boolean;
}

/**
 * Response from item validation endpoint
 */
export interface ItemValidationResponse {
  /** Whether item slot matches target */
  valid: boolean;
  /** Detected slot from item base type */
  detectedSlot?: string | null;
  /** Parsed item name */
  itemName?: string | null;
  /** Parsed base type */
  baseType?: string | null;
  /** Error message if validation failed */
  error?: string;
}
