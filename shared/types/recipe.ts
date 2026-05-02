/**
 * Recipe Types for Universal Action Recipe System (Spec 040)
 *
 * Type definitions for the action recipe system that provides
 * step-by-step checklists for improvement cards across all pathways.
 * LLM generates recipe paths and steps during initial analysis,
 * users follow checklists to complete improvements.
 */

// =============================================================================
// Impact Display Types
// =============================================================================

/**
 * Impact display configuration for improvement cards.
 * LLM determines type based on whether simulation provides value.
 * Shown on collapsed cards to indicate expected improvement.
 */
export interface ImpactDisplay {
  /**
   * Display type:
   * - 'simulated': Show concrete numbers from PoB calcWith
   * - 'qualitative': Show reasoning text (e.g., "Freeze immune")
   * - 'composite': Show both numbers and qualitative text
   */
  type: 'simulated' | 'qualitative' | 'composite';

  /**
   * Simulated impact values (when type is 'simulated' or 'composite').
   * Numbers come from PoB calcWith() during initial analysis.
   */
  simulated?: {
    /** DPS change as percentage (e.g., 12.4 for "+12.4%") */
    dpsPercent?: number;
    /** DPS change as absolute value */
    dpsAbsolute?: number;
    /** EHP change as percentage */
    ehpPercent?: number;
    /** EHP change as absolute value */
    ehpAbsolute?: number;
    /** Life reserved change (for auras) */
    lifeReservedPercent?: number;
    /** Mana reserved change */
    manaReservedPercent?: number;
  };

  /**
   * Qualitative impact text (when type is 'qualitative' or 'composite').
   * Human-readable descriptions for non-simulatable changes.
   * @example ["Ailment immune", "10% faster movement", "QoL: instant portals"]
   */
  qualitative?: string[];
}

// =============================================================================
// Recipe Step Types
// =============================================================================

/**
 * Step type taxonomy across all pathways.
 * Used for rendering appropriate UI and validation.
 */
export type RecipeStepType =
  // Socket configuration (Skills/Equipment)
  | 'socket_jeweller'    // Add/remove sockets
  | 'socket_fusing'      // Link sockets
  | 'socket_chromatic'   // Change socket colors
  // Gem acquisition (Skills)
  | 'acquire_lilly'      // Buy standard gem from Lilly
  | 'acquire_trade'      // Buy awakened/drop-only gem from Trade
  | 'acquire_owned'      // Use existing gem
  | 'socket_gems'        // Place gems in sockets
  // Equipment acquisition
  | 'search_trade'       // Open trade search panel
  | 'select_item'        // Choose item from results
  | 'craft_base'         // Acquire crafting base
  | 'craft_step'         // Apply crafting currency
  | 'equip_item'         // Equip item in slot
  // Tree modification
  | 'allocate_node'      // Allocate passive node
  | 'refund_node'        // Refund node with Orb of Regret
  // Universal
  | 'validate';          // Final validation step

/**
 * Single step in a recipe with completion tracking.
 * Each step can have an optional inline action button.
 */
export interface RecipeStep {
  /** Unique ID within recipe (e.g., 'step-1', 'chrome-body') */
  id: string;

  /** Step type for rendering and validation */
  type: RecipeStepType;

  /** Human-readable description of what to do */
  description: string;

  /**
   * Optional inline action for this step.
   * When present, renders a button/link next to the checkbox.
   */
  inlineAction?: {
    /** Action type: trade search, open link, or copy text */
    type: 'trade_search' | 'open_link' | 'copy_text';
    /** Button/link label */
    label: string;
    /** Action-specific data (URL, search params, text to copy) */
    data: Record<string, unknown>;
  };

  /**
   * Current vs target state for socket steps.
   * Rendered as visual diff (e.g., "3R 2G 1B -> 4R 1G 1B").
   */
  socketDiff?: {
    /** Current socket configuration */
    current: string;
    /** Target socket configuration */
    target: string;
  };

  /**
   * Gem details for acquisition steps.
   * Required for acquire_* and socket_gems step types.
   */
  gemInfo?: {
    /** Gem name */
    name: string;
    /** Target gem level */
    level?: number;
    /** Target gem quality (0-20+) */
    quality?: number;
    /** Alternate quality type */
    qualityType?: 'default' | 'anomalous' | 'divergent' | 'phantasmal';
  };

  /**
   * Node details for tree steps.
   * Required for allocate_node and refund_node step types.
   */
  nodeInfo?: {
    /** Node name */
    name: string;
    /** PoB node ID for precise allocation */
    nodeId?: number;
    /** Human-readable location hint (e.g., "near Witch start") */
    locationHint?: string;
  };
}

// =============================================================================
// Recipe Path Types
// =============================================================================

/**
 * A single path to achieve the improvement goal.
 * LLM generates 1+ paths; user selects if multiple exist.
 * Each path contains an ordered list of steps.
 */
export interface RecipePath {
  /** Unique ID within this improvement (e.g., 'trade', 'craft', 'brutality') */
  id: string;

  /** Human-readable path name (e.g., "Buy on Trade", "Craft with Essences") */
  name: string;

  /** Cost estimate (e.g., "~50c", "200 fusings avg") */
  cost?: string;

  /**
   * Impact specific to this path (may differ from other paths).
   * If omitted, uses improvement-level impactDisplay.
   */
  pathImpact?: string;

  /** Trade-off description (e.g., "More expensive but immediate") */
  tradeoffs?: string;

  /** Ordered list of steps to complete this path */
  steps: RecipeStep[];

  /**
   * Pathway-specific action data for execution.
   * Contents depend on pathway type (skills, tree, gear).
   */
  actionData?: Record<string, unknown>;
}

// =============================================================================
// Socket Types
// =============================================================================

/**
 * Socket state for an equipment slot.
 * Used to determine if socket changes are needed.
 */
export interface SocketState {
  /** Equipment slot (e.g., "Body Armour", "Helmet") */
  slot: string;

  /** Total socket count (1-6) */
  socketCount: number;

  /** Largest link group (1-6) */
  maxLinks: number;

  /** Socket colors in PoB format (e.g., "R-R-G B-B") */
  socketString: string;

  /** Color breakdown */
  colors: {
    /** Number of red sockets */
    red: number;
    /** Number of green sockets */
    green: number;
    /** Number of blue sockets */
    blue: number;
    /** Number of white sockets */
    white: number;
  };
}

/**
 * Socket requirements for an improvement.
 * Compared against SocketState to generate socket steps.
 */
export interface SocketRequirement {
  /** Target slot */
  slot: string;

  /** Minimum socket count needed */
  minSockets: number;

  /** Minimum link count needed */
  minLinks: number;

  /** Required socket colors */
  requiredColors: {
    /** Minimum red sockets needed */
    red: number;
    /** Minimum green sockets needed */
    green: number;
    /** Minimum blue sockets needed */
    blue: number;
    /** Minimum white sockets needed (often 0) */
    white: number;
  };
}

// =============================================================================
// Gem Source Types
// =============================================================================

/**
 * Gem acquisition source classification.
 * Determines which step type to generate for gem acquisition.
 */
export type GemSourceType = 'lilly' | 'trade' | 'owned';

/**
 * Gem acquisition information.
 * Used for Skills pathway acquisition steps.
 */
export interface GemSource {
  /** Gem name */
  gemName: string;

  /** Where to acquire this gem */
  source: GemSourceType;

  /** Trade search parameters (when source is 'trade') */
  tradeParams?: {
    /** Gem name for search */
    gemName: string;
    /** Minimum gem level */
    minLevel?: number;
    /** Minimum quality */
    minQuality?: number;
    /** Alternate quality type (e.g., 'anomalous') */
    qualityType?: string;
  };

  /** Why trade is required (for display to user) */
  tradeReason?: 'awakened' | 'drop_only' | 'corrupted';
}

// =============================================================================
// Recipe Progress Types (Persistence)
// =============================================================================

// Note: TradeSearchSpec is defined in improvements.ts with full priority/fallback support.
// Use TradeSearchSpec from improvements.ts for all trade search pre-computation.

/**
 * Persisted recipe progress state.
 * Stored in sessionStorage keyed by improvement ID.
 * Tracks which path is selected and which steps are completed.
 */
export interface RecipeProgress {
  /** Improvement ID this progress belongs to */
  improvementId: string;

  /** Selected path ID (null if not yet selected) */
  selectedPathId: string | null;

  /** IDs of completed steps */
  completedStepIds: string[];

  /** Whether card is expanded in UI */
  isExpanded: boolean;

  /** Last update timestamp (Unix ms) */
  lastUpdated: number;

  /** User-specified budget for this improvement */
  budget?: {
    amount: number;
    currency: 'chaos' | 'divine';
  };
}
