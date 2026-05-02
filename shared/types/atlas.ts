/**
 * Atlas Passive Tree Types
 *
 * Shared types for atlas tree data, player allocations, and visualization.
 * The atlas tree is independent of character builds — it affects map/endgame content.
 */

/**
 * Player's atlas passive allocations fetched via GGG OAuth API.
 * Endpoint: GET /api/league-account/<league>
 * Scope: account:league_accounts
 */
export interface AtlasPassiveData {
  /** Active atlas passive allocation (node skill IDs) */
  hashes: number[];
}

/**
 * A named atlas tree configuration.
 * Players can save multiple atlas tree setups and swap between them.
 */
export interface AtlasNamedTree {
  /** Player-assigned name for this tree configuration */
  name: string;
  /** Allocated node skill IDs for this configuration */
  hashes: number[];
}

/**
 * Full atlas state for a player's league account.
 */
export interface AtlasTreeState {
  /** League this atlas state belongs to */
  league: string;
  /** Currently active atlas allocation */
  atlasPassives: AtlasPassiveData;
  /** All named tree configurations */
  atlasPassiveTrees: AtlasNamedTree[];
  /** When this data was fetched */
  fetchedAt: string;
}

/**
 * Resolved atlas node with full data from atlas-tree-latest.json.
 * Used for display in the sidebar.
 */
export interface ResolvedAtlasNode {
  /** Node ID (skill field from data.json) */
  id: number;
  /** Display name */
  name: string;
  /** Stat description lines */
  stats: string[];
  /** Node classification */
  type: 'keystone' | 'notable' | 'mastery' | 'normal';
  /** Icon path (atlas art) */
  icon: string;
}

/**
 * A single stat line from an allocated atlas node, with source attribution.
 */
export interface AtlasCategoryStat {
  /** The stat description text */
  stat: string;
  /** Source node name */
  source: string;
  /** Whether the source is a notable */
  isNotable?: boolean;
  /** Whether the source is a keystone */
  isKeystone?: boolean;
}

/**
 * Atlas tree summary for sidebar display.
 * Pre-computed from player allocations + static tree data.
 */
export interface AtlasTreeSummary {
  /** Total allocated points */
  allocatedPoints: number;
  /** Maximum available points */
  totalPoints: number;
  /** Allocated keystone names */
  keystones: string[];
  /** Allocated notable names */
  notables: string[];
  /** Content category breakdown: category name -> count of allocated nodes */
  contentCategories: Record<string, number>;
  /** All resolved allocated nodes grouped by category */
  allocatedNodes: ResolvedAtlasNode[];
  /** Stats grouped by content category for sidebar display */
  categoryStats: Record<string, AtlasCategoryStat[]>;
}

/**
 * Response from POST /api/v1/atlas/import
 */
export interface AtlasImportResponse {
  /** Unique ID for this atlas state */
  atlasId: string;
  /** The imported atlas state */
  state: AtlasTreeState;
  /** Pre-computed summary for sidebar display */
  summary: AtlasTreeSummary;
}
